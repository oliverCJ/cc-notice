use crate::app_services::device_connection_service::DeviceConnectionService;
use crate::app_services::device_discovery_service::DeviceDiscoveryService;
use crate::app_services::device_handshake_service::DeviceHandshakeService;
use crate::core::device::{DeviceCandidateResource, DeviceInstance, DeviceRuntimeState};
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;
use crate::AppState;

use super::candidate_match::matched_connected_candidate;
use super::defaults::{default_channels_for_board, non_blank_or, unique_device_id};
use super::requests::{IdentifyDeviceCandidateRequest, RegisterIdentifiedDeviceRequest};

pub(crate) fn scan_device_transports_impl() -> Result<Vec<DevicePortDescriptor>, String> {
    DeviceConnectionService::scan_transports()
}

pub(crate) fn scan_device_candidates_impl(
    state: &AppState,
) -> Result<Vec<DeviceCandidateResource>, String> {
    let ports = DeviceConnectionService::scan_transports()?;
    let registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    let registered = registry.registered_devices();
    let states = registry.states();
    Ok(
        DeviceDiscoveryService::candidates_from_ports_with_registered_and_runtime_states(
            ports,
            &registered,
            &states,
        ),
    )
}

pub(crate) fn identify_device_candidate_impl(
    state: &AppState,
    request: IdentifyDeviceCandidateRequest,
) -> Result<DeviceCandidateResource, String> {
    if let Some(candidate) = matched_connected_candidate(state, &request)? {
        return Ok(candidate);
    }
    let candidate = DeviceHandshakeService::identify_candidate(
        &request.resource_id,
        &request.display_name,
        request.transport,
    )?;
    let registered = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .registered_devices();
    Ok(match_identified_candidate_to_registered_device(
        candidate,
        &registered,
    ))
}

fn match_identified_candidate_to_registered_device(
    mut candidate: DeviceCandidateResource,
    registered: &[DeviceInstance],
) -> DeviceCandidateResource {
    let Some(handshake) = candidate.handshake_info.as_ref() else {
        return candidate;
    };
    let Some(device) = registered.iter().find(|device| {
        device.device_uid.as_deref() == Some(handshake.device_uid.as_str())
            && device.board_id == handshake.board_id
    }) else {
        return candidate;
    };
    candidate.discovery_status = crate::core::device::DeviceDiscoveryStatus::Matched;
    candidate.device_uid = Some(handshake.device_uid.clone());
    candidate.matched_device_id = Some(device.id.clone());
    candidate.error = None;
    candidate
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::{
        DeviceCandidateHandshakeInfo, DeviceDiscoveryStatus, DeviceIdentityPersistence,
        DeviceTransportConfig,
    };

    #[test]
    fn identified_candidate_matches_registered_device_by_uid_and_board() {
        let candidate = identified_candidate("rp2040-pico", "rp2040-pico:0011223344556677");
        let registered = vec![registered_device(
            "desk-pico",
            "rp2040-pico",
            Some("rp2040-pico:0011223344556677"),
        )];

        let matched = match_identified_candidate_to_registered_device(candidate, &registered);

        assert_eq!(DeviceDiscoveryStatus::Matched, matched.discovery_status);
        assert_eq!(Some("desk-pico".to_string()), matched.matched_device_id);
        assert_eq!(
            Some("rp2040-pico:0011223344556677".to_string()),
            matched.device_uid
        );
    }

    #[test]
    fn identified_candidate_does_not_match_registered_device_with_different_board() {
        let candidate = identified_candidate("rp2040-pico", "rp2040-pico:0011223344556677");
        let registered = vec![registered_device(
            "desk-wio",
            "seeed-wio-terminal",
            Some("rp2040-pico:0011223344556677"),
        )];

        let matched = match_identified_candidate_to_registered_device(candidate, &registered);

        assert_eq!(DeviceDiscoveryStatus::Identified, matched.discovery_status);
        assert_eq!(None, matched.matched_device_id);
    }

    fn identified_candidate(board_id: &str, device_uid: &str) -> DeviceCandidateResource {
        DeviceCandidateResource {
            resource_id: "serial:/dev/cu.usbmodem-new".to_string(),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-new", 115200),
            display_name: "Identified Device".to_string(),
            discovery_status: DeviceDiscoveryStatus::Identified,
            handshake_info: Some(DeviceCandidateHandshakeInfo {
                board_id: board_id.to_string(),
                device_uid: device_uid.to_string(),
                firmware_version: "0.2.3".to_string(),
                protocol_version: 2,
                identity_persistence: DeviceIdentityPersistence::Persisted,
            }),
            device_uid: Some(device_uid.to_string()),
            matched_device_id: None,
            error: None,
        }
    }

    fn registered_device(id: &str, board_id: &str, device_uid: Option<&str>) -> DeviceInstance {
        DeviceInstance {
            id: id.to_string(),
            label: id.to_string(),
            board_id: board_id.to_string(),
            device_uid: device_uid.map(str::to_string),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-old", 115200),
            channels: Vec::new(),
            enabled: true,
        }
    }
}

pub(crate) fn register_identified_device_impl(
    state: &AppState,
    request: RegisterIdentifiedDeviceRequest,
) -> Result<DeviceRuntimeState, String> {
    let handshake = request
        .resource
        .handshake_info
        .as_ref()
        .ok_or_else(|| "identified device requires handshake info".to_string())?;
    let device_uid = request
        .resource
        .device_uid
        .clone()
        .unwrap_or_else(|| handshake.device_uid.clone());
    if device_uid.trim().is_empty() {
        return Err("identified device requires device_uid".to_string());
    }
    if handshake.device_uid != device_uid {
        return Err("identified device uid does not match handshake info".to_string());
    }

    let mut config_service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = config_service.config();
    if config
        .devices
        .iter()
        .any(|device| device.device_uid.as_deref() == Some(device_uid.as_str()))
    {
        return Err(format!("device uid already registered: {device_uid}"));
    }

    let board_id = handshake.board_id.clone();
    let label = non_blank_or(&request.label, &request.resource.display_name);
    let transport = request.resource.transport.clone();
    let channels = default_channels_for_board(&request.resource);
    let device = DeviceInstance {
        id: unique_device_id(&config.devices, &device_uid),
        label,
        board_id,
        device_uid: Some(device_uid),
        transport,
        channels,
        enabled: true,
    };
    config.devices.push(device.clone());
    config_service.save_config(config)?;
    drop(config_service);

    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.register_device(device.clone());
    registry
        .state(&device.id)
        .ok_or_else(|| format!("device is not registered: {}", device.id))
}
