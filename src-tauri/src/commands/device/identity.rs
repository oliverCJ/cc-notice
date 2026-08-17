use crate::app_services::device_info_probe::stable_uid_policy;
use crate::core::boards::StableUidPolicy;
use crate::core::device::DeviceRuntimeState;
use crate::AppState;

use super::firmware_lookup::bundled_firmware_artifact_for_state;

pub(crate) fn reset_device_identity_impl(
    state: &AppState,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    let current_state = {
        let registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry
            .state(&device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?
    };

    if current_state.status != crate::core::device::DeviceConnectionStatus::Connected {
        return Err("device must be connected before resetting identity".to_string());
    }

    let board_id = current_state
        .board_id
        .clone()
        .ok_or_else(|| "device board is unknown".to_string())?;
    if stable_uid_policy(&board_id) != Some(StableUidPolicy::Limited) {
        return Err(
            "device identity reset is only supported for limited-identity boards".to_string(),
        );
    }

    let new_device_uid = unique_short_device_uid(state, &board_id)?;
    let artifact = bundled_firmware_artifact_for_state(&current_state)?
        .ok_or_else(|| "bundled firmware artifact not found for device board".to_string())?;

    let prepared_set_uid = {
        let registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.prepare_set_device_uid_command(&device_id, &new_device_uid)?
    };
    let set_uid_session_id = prepared_set_uid.session_id;
    let set_uid_result = prepared_set_uid
        .worker
        .send_protocol_command(prepared_set_uid.command);
    state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .complete_set_device_uid_command(&device_id, set_uid_session_id, set_uid_result)?;

    let prepared_query = {
        let registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.prepare_device_info_query(&device_id)?
    };
    let query_session_id = prepared_query.session_id;
    let query_result = prepared_query.worker.query_device_info_line();
    let verified_state = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .complete_device_info_query(&device_id, query_session_id, &artifact, query_result)?;
    if verified_state.device_uid.as_deref() != Some(new_device_uid.as_str()) {
        return Err("device_info response did not confirm reset device_uid".to_string());
    }

    persist_device_uid(state, &device_id, &new_device_uid)?;
    Ok(verified_state)
}

fn unique_short_device_uid(state: &AppState, board_id: &str) -> Result<String, String> {
    let config = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?
        .config();

    for _ in 0..8 {
        let uuid_hex = uuid::Uuid::new_v4().simple().to_string();
        let candidate = format!("{board_id}:{}", &uuid_hex[..16]);
        if !config
            .devices
            .iter()
            .any(|device| device.device_uid.as_deref() == Some(candidate.as_str()))
        {
            return Ok(candidate);
        }
    }

    Err("failed to generate unique device uid".to_string())
}

fn persist_device_uid(state: &AppState, device_id: &str, device_uid: &str) -> Result<(), String> {
    let mut config_service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = config_service.config();
    let device = config
        .devices
        .iter_mut()
        .find(|device| device.id == device_id)
        .ok_or_else(|| format!("device is not registered: {device_id}"))?;
    device.device_uid = Some(device_uid.to_string());
    config_service.save_config(config).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::{
        DeviceChannel, DeviceConnectionStatus, DeviceInstance, DeviceRuntimeState,
        DeviceTransportConfig,
    };
    use crate::test_support::{minimal_app_state_for_root, unique_temp_root};

    #[test]
    fn generated_short_device_uid_uses_board_prefix_and_16_hex_suffix() {
        let root = unique_temp_root("cc-notice-reset-device-uid-format");
        let state = minimal_app_state_for_root(&root);

        let uid = unique_short_device_uid(&state, "arduino-nano").expect("uid should generate");
        let suffix = uid
            .strip_prefix("arduino-nano:")
            .expect("uid should use board prefix");

        assert_eq!(16, suffix.len());
        assert!(suffix.chars().all(|value| value.is_ascii_hexdigit()));
    }

    #[test]
    fn persist_device_uid_updates_registered_device_without_changing_device_id() {
        let root = unique_temp_root("cc-notice-reset-device-uid-persist");
        let state = minimal_app_state_for_root(&root);
        let device = DeviceInstance {
            id: "desk-nano".to_string(),
            label: "Desk Nano".to_string(),
            board_id: "arduino-nano".to_string(),
            device_uid: Some("arduino-nano:old".to_string()),
            transport: DeviceTransportConfig::serial("/dev/cu.usbserial-nano", 115200),
            channels: Vec::<DeviceChannel>::new(),
            enabled: true,
        };
        {
            let mut config_service = state.app_config_service.lock().expect("config lock");
            let mut config = config_service.config();
            config.devices.push(device);
            config_service
                .save_config(config)
                .expect("config should save");
        }

        persist_device_uid(&state, "desk-nano", "arduino-nano:1234567890abcdef")
            .expect("device uid should persist");

        let config = state
            .app_config_service
            .lock()
            .expect("config lock")
            .config();
        let persisted_device = config
            .devices
            .iter()
            .find(|device| device.id == "desk-nano")
            .expect("target device should remain registered");
        assert_eq!("desk-nano", persisted_device.id);
        assert_eq!(
            Some("arduino-nano:1234567890abcdef"),
            persisted_device.device_uid.as_deref()
        );
    }

    #[allow(dead_code)]
    fn connected_state(device_id: &str) -> DeviceRuntimeState {
        let mut state = DeviceRuntimeState::disconnected();
        state.device_id = Some(device_id.to_string());
        state.status = DeviceConnectionStatus::Connected;
        state.board_id = Some("arduino-nano".to_string());
        state
    }
}
