use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

use crate::app_services::device_info_probe::{firmware_info_from_ack, query_device_info_line};
use crate::app_services::device_io_worker::DeviceTransportMonitorRecorder;
use crate::app_services::device_runtime_event_service::{
    DeviceRuntimeUpdatedPayload, DEVICE_RUNTIME_UPDATED_EVENT,
};
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::app_services::device_transport_monitor_service::DeviceTransportMonitorService;
use crate::core::app_config::AppConfig;
use crate::core::device::{
    DeviceFirmwareInfo, DeviceFirmwareStatus, DeviceRuntimeState, DeviceTransportConfig,
};
use crate::core::device_transport_monitor::DeviceTransportMonitorEvent;
use crate::core::firmware::FirmwareArtifact;
use crate::core::protocol::DeviceInfoAck;
use crate::infrastructure::transports::factory::open_transport;
use crate::infrastructure::transports::transport::DeviceTransport;
use tauri::Emitter;
use tauri::Manager;

#[derive(Clone)]
pub struct DeviceConnectionOperationInput {
    pub device_id: String,
    pub operation_id: u64,
    pub deadline_ms: u64,
    pub transport: DeviceTransportConfig,
    pub firmware_artifact: Option<FirmwareArtifact>,
    pub expected_device_uid: Option<String>,
}

pub fn spawn_connection_operation(
    app: tauri::AppHandle,
    registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    input: DeviceConnectionOperationInput,
) {
    let input_event_app = app.clone();
    let monitor_service = app
        .try_state::<crate::AppState>()
        .map(|state| Arc::clone(&state.device_transport_monitor_service));
    spawn_connection_operation_with_emit(
        registry,
        input,
        Some(input_event_app),
        monitor_service,
        Some(app.clone()),
        move |device_id| {
            if let Err(error) = app.emit(
                DEVICE_RUNTIME_UPDATED_EVENT,
                DeviceRuntimeUpdatedPayload {
                    reason: "device-connection-operation".to_string(),
                    device_ids: vec![device_id],
                },
            ) {
                tracing::warn!(error = %error, "failed to emit device connection update");
            }
            crate::startup::tray::refresh_tray_menu_after_state_change(
                &app,
                "device connection operation completed",
            );
        },
    );
}

pub fn spawn_connection_operation_without_emit(
    registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    input: DeviceConnectionOperationInput,
) {
    spawn_connection_operation_with_emit(registry, input, None, None, None, |_| {});
}

fn spawn_connection_operation_with_emit<F>(
    registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    input: DeviceConnectionOperationInput,
    input_event_app: Option<tauri::AppHandle>,
    monitor_service: Option<Arc<Mutex<DeviceTransportMonitorService>>>,
    monitor_app: Option<tauri::AppHandle>,
    emit_update: F,
) where
    F: Fn(String) + Send + 'static,
{
    thread::spawn(move || {
        let started = Instant::now();
        let device_id = input.device_id.clone();
        let result = run_connection_operation(&input);
        let elapsed_ms = started.elapsed().as_millis() as u64;
        let result = if elapsed_ms > input.deadline_ms {
            Err("operation_timeout".to_string())
        } else {
            result
        };
        let mut registry_guard = match registry.lock() {
            Ok(registry) => registry,
            Err(error) => {
                tracing::warn!(
                    error = %error,
                    "failed to lock registry after device connection operation"
                );
                return;
            }
        };

        if !registry_guard.operation_matches(&input.device_id, input.operation_id) {
            tracing::info!(
                device_id = input.device_id,
                operation_id = input.operation_id,
                "discarded stale device connection result"
            );
            return;
        }

        let mut persist_transport = None;
        let mut prepared_gpio_input_commands = Vec::new();
        match result {
            Ok(result) => {
                let input_callback = registry_guard.input_event_callback(input_event_app.clone());
                let monitor_recorder =
                    monitor_recorder(monitor_service.clone(), monitor_app.clone());
                if let Err(error) = registry_guard.complete_connect_operation(
                    &input.device_id,
                    input.operation_id,
                    input.transport.clone(),
                    result.transport,
                    result.state,
                    Some(input_callback),
                    monitor_recorder,
                ) {
                    tracing::warn!(error, "failed to complete device connection operation");
                } else if let Some(app) = &input_event_app {
                    prepared_gpio_input_commands = registry_guard
                        .prepare_gpio_input_config_commands(&input.device_id, &[])
                        .unwrap_or_else(|error| {
                            tracing::warn!(
                                device_id = input.device_id,
                                error,
                                "failed to prepare gpio input config after connection"
                            );
                            Vec::new()
                        });
                    persist_transport = Some((
                        app.clone(),
                        input.device_id.clone(),
                        input.transport.clone(),
                    ));
                }
            }
            Err(error) => {
                if let Err(write_error) = registry_guard.fail_operation_if_current(
                    &input.device_id,
                    input.operation_id,
                    error,
                ) {
                    tracing::warn!(
                        error = write_error,
                        "failed to write device connection operation failure"
                    );
                }
            }
        }
        drop(registry_guard);
        for prepared in prepared_gpio_input_commands {
            let session_id = prepared.session_id;
            let result = prepared.worker.send_protocol_command(prepared.command);
            match registry.lock() {
                Ok(mut registry) => {
                    if let Err(error) =
                        registry.complete_gpio_input_config_command(&device_id, session_id, result)
                    {
                        tracing::warn!(
                            device_id,
                            error,
                            "failed to sync gpio input config after connection"
                        );
                    }
                }
                Err(error) => {
                    tracing::warn!(
                        error = %error,
                        "failed to lock registry after gpio input config sync"
                    );
                    break;
                }
            }
        }
        if let Some((app, device_id, transport)) = persist_transport {
            persist_successful_connection_transport(&app, &device_id, &transport);
        }
        emit_update(device_id);
    });
}

pub(crate) fn monitor_recorder(
    monitor_service: Option<Arc<Mutex<DeviceTransportMonitorService>>>,
    monitor_app: Option<tauri::AppHandle>,
) -> Option<DeviceTransportMonitorRecorder> {
    let monitor_service = monitor_service?;
    let monitor_app = monitor_app?;
    let active_service = Arc::clone(&monitor_service);
    let is_active = Arc::new(move |device_id: &str| match active_service.lock() {
        Ok(service) => service.is_session_active(device_id),
        Err(error) => {
            tracing::warn!(
                error = %error,
                "failed to lock device transport monitor service for active check"
            );
            false
        }
    });
    let record_event = Arc::new(move |event: DeviceTransportMonitorEvent| {
        let recorded = match monitor_service.lock() {
            Ok(mut service) => service.record(event.clone()),
            Err(error) => {
                tracing::warn!(
                    error = %error,
                    "failed to lock device transport monitor service"
                );
                false
            }
        };
        if recorded {
            let event_device_id = event.device_id.clone();
            if let Err(error) = monitor_app.emit(
                crate::app_services::device_runtime_event_service::DEVICE_TRANSPORT_MONITOR_EVENT,
                event,
            ) {
                tracing::warn!(
                    device_id = event_device_id,
                    error = %error,
                    "failed to emit device transport monitor event"
                );
            }
        }
    });
    Some(DeviceTransportMonitorRecorder::new(is_active, record_event))
}

fn persist_successful_connection_transport(
    app: &tauri::AppHandle,
    device_id: &str,
    transport: &DeviceTransportConfig,
) {
    let state = app.state::<crate::AppState>();
    let mut config_service = match state.app_config_service.lock() {
        Ok(config_service) => config_service,
        Err(error) => {
            tracing::warn!(
                device_id,
                error = %error,
                "failed to lock config for successful device transport persistence"
            );
            return;
        }
    };
    let mut config = config_service.config();
    let Some(current_transport) = config
        .devices
        .iter()
        .find(|device| device.id == device_id)
        .map(|device| device.transport.clone())
    else {
        tracing::warn!(
            device_id,
            "failed to find device config for successful transport persistence"
        );
        return;
    };
    if current_transport == *transport {
        return;
    }
    if let Err(error) = update_device_transport_in_config(&mut config, device_id, transport.clone())
    {
        tracing::warn!(
            device_id,
            error,
            "failed to update successful device transport in config"
        );
        return;
    }
    if let Err(error) = config_service.save_config(config) {
        tracing::warn!(
            device_id,
            error,
            "failed to persist successful device transport"
        );
    }
}

fn update_device_transport_in_config(
    config: &mut AppConfig,
    device_id: &str,
    transport: DeviceTransportConfig,
) -> Result<(), String> {
    let Some(device) = config
        .devices
        .iter_mut()
        .find(|device| device.id == device_id)
    else {
        return Err(format!("device config not found: {device_id}"));
    };
    device.transport = transport;
    Ok(())
}

struct DeviceConnectionOperationResult {
    transport: Box<dyn DeviceTransport>,
    state: DeviceRuntimeState,
}

fn run_connection_operation(
    input: &DeviceConnectionOperationInput,
) -> Result<DeviceConnectionOperationResult, String> {
    let mut transport = open_transport(&input.transport)?;
    let mut state = DeviceRuntimeState::disconnected();
    state.device_id = Some(input.device_id.clone());
    state.transport = Some(input.transport.clone());

    match &input.firmware_artifact {
        Some(artifact) => {
            query_firmware_state(transport.as_mut(), &input.transport, artifact, &mut state)?;
        }
        None if input.expected_device_uid.is_some() => {
            query_identity_state(transport.as_mut(), &input.transport, &mut state)?;
        }
        None => {}
    }
    validate_connected_device_uid(input.expected_device_uid.as_deref(), &state)?;

    Ok(DeviceConnectionOperationResult { transport, state })
}

fn validate_connected_device_uid(
    expected_device_uid: Option<&str>,
    state: &DeviceRuntimeState,
) -> Result<(), String> {
    let Some(expected_device_uid) = expected_device_uid else {
        return Ok(());
    };
    let Some(actual_device_uid) = state.device_uid.as_deref() else {
        tracing::warn!(
            expected_device_uid,
            device_id = state.device_id.as_deref().unwrap_or(""),
            "connected device uid missing"
        );
        return Err(format!(
            "connected device uid missing: expected {expected_device_uid}"
        ));
    };
    if actual_device_uid != expected_device_uid {
        tracing::warn!(
            expected_device_uid,
            actual_device_uid,
            device_id = state.device_id.as_deref().unwrap_or(""),
            "connected device uid mismatch"
        );
        return Err(format!(
            "connected device uid mismatch: expected {expected_device_uid}, got {actual_device_uid}"
        ));
    }
    Ok(())
}

fn query_identity_state(
    transport: &mut dyn DeviceTransport,
    transport_config: &DeviceTransportConfig,
    state: &mut DeviceRuntimeState,
) -> Result<(), String> {
    let Some(ack_line) = query_device_info_line(transport)? else {
        state.firmware_status = DeviceFirmwareStatus::Unknown;
        state.firmware_check_error = Some("device_info response timed out".to_string());
        return Ok(());
    };

    state.last_ack = Some(ack_line.clone());
    let ack = DeviceInfoAck::parse(&ack_line)?;
    let info = firmware_info_from_ack(ack, transport_config)?;
    apply_identity_info(state, info);
    Ok(())
}

fn query_firmware_state(
    transport: &mut dyn DeviceTransport,
    transport_config: &DeviceTransportConfig,
    artifact: &FirmwareArtifact,
    state: &mut DeviceRuntimeState,
) -> Result<(), String> {
    state.bundled_firmware_version = Some(artifact.firmware_version.clone());
    let Some(ack_line) = query_device_info_line(transport)? else {
        state.firmware_status = DeviceFirmwareStatus::Unknown;
        state.firmware_check_error = Some("device_info response timed out".to_string());
        return Ok(());
    };

    state.last_ack = Some(ack_line.clone());
    let ack = DeviceInfoAck::parse(&ack_line)?;
    let info = firmware_info_from_ack(ack, transport_config)?;
    apply_firmware_info(state, info, artifact);
    Ok(())
}

fn apply_identity_info(state: &mut DeviceRuntimeState, info: DeviceFirmwareInfo) {
    state.device_uid = Some(info.device_uid.clone());
    state.board_id = Some(info.board_id.clone());
    state.firmware_info = Some(info);
    state.firmware_check_error = None;
}

fn apply_firmware_info(
    state: &mut DeviceRuntimeState,
    info: DeviceFirmwareInfo,
    artifact: &FirmwareArtifact,
) {
    state.firmware_status = if info.board_id != artifact.board_id
        || info.protocol_version != artifact.protocol_version
    {
        DeviceFirmwareStatus::Incompatible
    } else if firmware_version_is_older(&info.firmware_version, &artifact.firmware_version) {
        DeviceFirmwareStatus::UpdateAvailable
    } else {
        DeviceFirmwareStatus::UpToDate
    };
    apply_identity_info(state, info);
}

fn firmware_version_is_older(current: &str, bundled: &str) -> bool {
    let current_parts = parse_version_tuple(current);
    let bundled_parts = parse_version_tuple(bundled);
    let max_len = current_parts.len().max(bundled_parts.len());

    for index in 0..max_len {
        let current_part = current_parts.get(index).copied().unwrap_or(0);
        let bundled_part = bundled_parts.get(index).copied().unwrap_or(0);
        if current_part < bundled_part {
            return true;
        }
        if current_part > bundled_part {
            return false;
        }
    }

    false
}

fn parse_version_tuple(value: &str) -> Vec<u32> {
    value
        .split('.')
        .map(|part| part.parse::<u32>().unwrap_or(0))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::DeviceInstance;

    #[test]
    fn validate_connected_device_uid_rejects_mismatched_uid() {
        let mut state = DeviceRuntimeState::disconnected();
        state.device_id = Some("desk-pico".to_string());
        state.device_uid = Some("rp2040-pico:actual".to_string());

        let result = validate_connected_device_uid(Some("rp2040-pico:expected"), &state);

        assert!(result.is_err());
    }

    #[test]
    fn validate_connected_device_uid_rejects_missing_actual_uid() {
        let mut state = DeviceRuntimeState::disconnected();
        state.device_id = Some("desk-pico".to_string());

        let result = validate_connected_device_uid(Some("rp2040-pico:expected"), &state);

        assert!(result.is_err());
    }

    #[test]
    fn validate_connected_device_uid_allows_matching_uid() {
        let mut state = DeviceRuntimeState::disconnected();
        state.device_id = Some("desk-pico".to_string());
        state.device_uid = Some("rp2040-pico:expected".to_string());

        validate_connected_device_uid(Some("rp2040-pico:expected"), &state)
            .expect("matching uid should be accepted");
    }

    #[test]
    fn update_device_transport_in_config_updates_existing_device_only() {
        let old_transport = DeviceTransportConfig::serial("/dev/cu.usbmodem-old", 115200);
        let new_transport = DeviceTransportConfig::serial("/dev/cu.usbmodem-new", 115200);
        let other_transport = DeviceTransportConfig::serial("/dev/cu.usbmodem-other", 115200);
        let mut config = AppConfig {
            devices: vec![
                DeviceInstance {
                    id: "desk-pico".to_string(),
                    label: "Desk Pico".to_string(),
                    board_id: "rp2040-pico".to_string(),
                    device_uid: Some("rp2040-pico:expected".to_string()),
                    transport: old_transport,
                    channels: Vec::new(),
                    enabled: true,
                },
                DeviceInstance {
                    id: "wio-display".to_string(),
                    label: "Wio Display".to_string(),
                    board_id: "seeed-wio-terminal".to_string(),
                    device_uid: None,
                    transport: other_transport.clone(),
                    channels: Vec::new(),
                    enabled: true,
                },
            ],
            ..AppConfig::default()
        };

        update_device_transport_in_config(&mut config, "desk-pico", new_transport.clone())
            .expect("registered device transport should update");

        assert_eq!(new_transport, config.devices[0].transport);
        assert_eq!(other_transport, config.devices[1].transport);
    }

    #[test]
    fn update_device_transport_in_config_rejects_unknown_device() {
        let mut config = AppConfig::default();
        let transport = DeviceTransportConfig::serial("/dev/cu.usbmodem-new", 115200);

        let error = update_device_transport_in_config(&mut config, "missing-device", transport)
            .expect_err("unknown device should not update config");

        assert_eq!("device config not found: missing-device", error);
    }
}
