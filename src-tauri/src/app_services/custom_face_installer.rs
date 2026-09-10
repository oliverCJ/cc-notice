use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use std::sync::{Arc, Mutex};

use crate::app_services::device_io_worker::{DeviceIoCommandResult, DeviceIoError};
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::commands::device::bundled_firmware_artifact_for_state;
use crate::core::custom_faces::device_protocol_generated::CUSTOM_FACE_DEVICE_MAX_RAW_CHUNK_BYTES;
use crate::core::custom_faces::{compile_group, package_hash, CustomFaceGroup};
use crate::core::device::{DeviceCustomFaceActiveSource, DeviceRuntimeState};
use crate::core::protocol::{ProtocolAck, ProtocolCommandV2};

pub fn build_full_install_commands(
    group: &CustomFaceGroup,
    session_id: &str,
) -> Result<Vec<ProtocolCommandV2>, String> {
    if session_id.trim().is_empty() {
        return Err("custom face install session id is empty".to_string());
    }
    let compiled = compile_group(group).map_err(|error| error.to_string())?;
    let mut payload = Vec::new();
    payload.extend_from_slice(&compiled.manifest_bytes);
    for blob in compiled.face_blobs.values() {
        payload.extend_from_slice(blob);
    }
    let package_hash = package_hash(
        1,
        None,
        compiled.group_runtime_hash,
        &compiled.manifest_bytes,
        &[],
        &compiled.face_blobs,
    );
    let total_bytes = u32::try_from(payload.len())
        .map_err(|_| "custom face install payload is too large".to_string())?;
    let chunk_bytes = u16::try_from(CUSTOM_FACE_DEVICE_MAX_RAW_CHUNK_BYTES)
        .map_err(|_| "custom face chunk size is invalid".to_string())?;
    let mut commands = Vec::new();
    commands.push(ProtocolCommandV2::custom_face_install_begin(
        session_id.to_string(),
        compiled.profile_code,
        compiled.group_id.to_string(),
        hex_lower(&compiled.group_runtime_hash),
        hex_lower(&package_hash),
        total_bytes,
        chunk_bytes,
    ));
    for (index, chunk) in payload
        .chunks(CUSTOM_FACE_DEVICE_MAX_RAW_CHUNK_BYTES)
        .enumerate()
    {
        let offset = index
            .checked_mul(CUSTOM_FACE_DEVICE_MAX_RAW_CHUNK_BYTES)
            .and_then(|value| u32::try_from(value).ok())
            .ok_or_else(|| "custom face chunk offset is too large".to_string())?;
        commands.push(ProtocolCommandV2::custom_face_install_chunk(
            session_id.to_string(),
            offset,
            STANDARD.encode(chunk),
        ));
    }
    commands.push(ProtocolCommandV2::custom_face_install_commit(
        session_id.to_string(),
    ));
    Ok(commands)
}

pub fn install_custom_face_group(
    registry: &mut DeviceRuntimeRegistry,
    device_id: &str,
    group: &CustomFaceGroup,
    session_id: &str,
) -> Result<DeviceRuntimeState, String> {
    let commands = build_full_install_commands(group, session_id)?;
    tracing::info!(
        device_id,
        group_id = group.group_id,
        command_count = commands.len(),
        "installing custom face group through existing device worker"
    );
    for command in commands {
        send_install_command(registry, device_id, command)?;
    }
    let prepared_status = registry.prepare_custom_face_status_query(device_id)?;
    let status_session_id = prepared_status.session_id;
    let status_result = prepared_status
        .worker
        .send_protocol_command(prepared_status.command);
    let mut state =
        registry.complete_custom_face_status_query(device_id, status_session_id, status_result)?;
    state = sync_device_after_custom_face_install(registry, device_id, state)?;
    Ok(state)
}

pub fn install_custom_face_group_with_shared_registry(
    registry: &Arc<Mutex<DeviceRuntimeRegistry>>,
    device_id: &str,
    group: &CustomFaceGroup,
    session_id: &str,
) -> Result<DeviceRuntimeState, String> {
    let commands = build_full_install_commands(group, session_id)?;
    tracing::info!(
        device_id,
        group_id = group.group_id,
        command_count = commands.len(),
        "installing custom face group without holding registry lock during device I/O"
    );
    for command in commands {
        send_install_command_with_shared_registry(registry, device_id, command)?;
    }
    let prepared_status = registry
        .lock()
        .map_err(|error| error.to_string())?
        .prepare_custom_face_status_query(device_id)?;
    let status_session_id = prepared_status.session_id;
    let status_result = prepared_status
        .worker
        .send_protocol_command(prepared_status.command);
    let mut state = registry
        .lock()
        .map_err(|error| error.to_string())?
        .complete_custom_face_status_query(device_id, status_session_id, status_result)?;
    state = sync_device_after_custom_face_install_with_shared_registry(registry, device_id, state)?;
    Ok(state)
}

fn send_install_command(
    registry: &DeviceRuntimeRegistry,
    device_id: &str,
    command: ProtocolCommandV2,
) -> Result<(), String> {
    let expected_ack_type = command.expected_ack_type();
    let prepared = registry.prepare_custom_face_install_command(device_id, command)?;
    let result = prepared.worker.send_protocol_command(prepared.command);
    validate_install_ack(expected_ack_type, result)
}

fn send_install_command_with_shared_registry(
    registry: &Arc<Mutex<DeviceRuntimeRegistry>>,
    device_id: &str,
    command: ProtocolCommandV2,
) -> Result<(), String> {
    let expected_ack_type = command.expected_ack_type();
    let prepared = registry
        .lock()
        .map_err(|error| error.to_string())?
        .prepare_custom_face_install_command(device_id, command)?;
    let result = prepared.worker.send_protocol_command(prepared.command);
    validate_install_ack(expected_ack_type, result)
}

fn validate_install_ack(
    expected_ack_type: &str,
    result: Result<DeviceIoCommandResult, DeviceIoError>,
) -> Result<(), String> {
    let result = result.map_err(|error| error.message)?;
    let ack_line = result
        .ack
        .ok_or_else(|| format!("{expected_ack_type} response timed out"))?;
    let ack = ProtocolAck::parse(&ack_line)?;
    if ack.v != 2 {
        return Err(format!(
            "unsupported {expected_ack_type} response protocol version"
        ));
    }
    if !ack.ok {
        return Err(ack
            .error
            .unwrap_or_else(|| format!("{expected_ack_type} failed")));
    }
    if ack.ack_type.as_deref() != Some(expected_ack_type) {
        return Err(format!("unexpected {expected_ack_type} response type"));
    }
    Ok(())
}

fn sync_device_after_custom_face_install(
    registry: &mut DeviceRuntimeRegistry,
    device_id: &str,
    state: DeviceRuntimeState,
) -> Result<DeviceRuntimeState, String> {
    let installed = state
        .custom_face_status
        .installed
        .as_ref()
        .ok_or_else(|| "custom face install did not produce an installed group".to_string())?;
    registry.set_custom_face_active_source(
        device_id,
        DeviceCustomFaceActiveSource::Custom,
        Some(installed.group_id.clone()),
    )?;
    let artifact = bundled_firmware_artifact_for_state(&state)?
        .ok_or_else(|| "bundled firmware artifact not found for device board".to_string())?;
    let refreshed_state = registry.query_device_info(device_id, &artifact)?;
    send_display_clear(registry, device_id)?;
    Ok(refreshed_state)
}

fn sync_device_after_custom_face_install_with_shared_registry(
    registry: &Arc<Mutex<DeviceRuntimeRegistry>>,
    device_id: &str,
    state: DeviceRuntimeState,
) -> Result<DeviceRuntimeState, String> {
    let installed = state
        .custom_face_status
        .installed
        .as_ref()
        .ok_or_else(|| "custom face install did not produce an installed group".to_string())?;
    registry
        .lock()
        .map_err(|error| error.to_string())?
        .set_custom_face_active_source(
            device_id,
            DeviceCustomFaceActiveSource::Custom,
            Some(installed.group_id.clone()),
        )?;
    let artifact = bundled_firmware_artifact_for_state(&state)?
        .ok_or_else(|| "bundled firmware artifact not found for device board".to_string())?;
    let refreshed_state = registry
        .lock()
        .map_err(|error| error.to_string())?
        .query_device_info(device_id, &artifact)?;
    send_display_clear_with_shared_registry(registry, device_id)?;
    Ok(refreshed_state)
}

fn send_display_clear(
    registry: &mut DeviceRuntimeRegistry,
    device_id: &str,
) -> Result<(), String> {
    let action = crate::core::device::DeviceExtensionAction {
        device_id: device_id.to_string(),
        channel_id: None,
        action: crate::core::device::DeviceExtensionActionType::DisplayClear,
        status: None,
        title: None,
        message: None,
        icon: None,
        lines: None,
        face_template: None,
        face_intensity: None,
        custom_face_group_id: None,
        custom_face_id: None,
        duration_ms: None,
        pattern: None,
        control: None,
        active: None,
    };
    let prepared = registry
        .prepare_extension_command(&action)
        .map_err(|result| result.error.unwrap_or_else(|| "display_clear failed".to_string()))?;
    let session_id = prepared.session_id;
    let result = prepared.worker.send_protocol_command(prepared.command);
    let (command_result, fallback) = registry.complete_extension_command(&action, session_id, result);
    if fallback.is_some() {
        return Err("display_clear unexpectedly required fallback".to_string());
    }
    if command_result.status != "sent" {
        return Err(command_result
            .error
            .unwrap_or_else(|| "display_clear failed".to_string()));
    }
    Ok(())
}

fn send_display_clear_with_shared_registry(
    registry: &Arc<Mutex<DeviceRuntimeRegistry>>,
    device_id: &str,
) -> Result<(), String> {
    let action = crate::core::device::DeviceExtensionAction {
        device_id: device_id.to_string(),
        channel_id: None,
        action: crate::core::device::DeviceExtensionActionType::DisplayClear,
        status: None,
        title: None,
        message: None,
        icon: None,
        lines: None,
        face_template: None,
        face_intensity: None,
        custom_face_group_id: None,
        custom_face_id: None,
        duration_ms: None,
        pattern: None,
        control: None,
        active: None,
    };
    let prepared = registry
        .lock()
        .map_err(|error| error.to_string())?
        .prepare_extension_command(&action)
        .map_err(|result| result.error.unwrap_or_else(|| "display_clear failed".to_string()))?;
    let session_id = prepared.session_id;
    let result = prepared.worker.send_protocol_command(prepared.command);
    let (command_result, fallback) = registry
        .lock()
        .map_err(|error| error.to_string())?
        .complete_extension_command(&action, session_id, result);
    if fallback.is_some() {
        return Err("display_clear unexpectedly required fallback".to_string());
    }
    if command_result.status != "sent" {
        return Err(command_result
            .error
            .unwrap_or_else(|| "display_clear failed".to_string()));
    }
    Ok(())
}

fn hex_lower(bytes: &[u8; 32]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(64);
    for byte in bytes {
        output.push(DIGITS[usize::from(byte >> 4)] as char);
        output.push(DIGITS[usize::from(byte & 0x0f)] as char);
    }
    output
}
