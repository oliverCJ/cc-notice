use crate::commands::device::requests::IdentifyDeviceCandidateRequest;
use crate::core::device::{
    DeviceCandidateHandshakeInfo, DeviceCandidateResource, DeviceConnectionStatus,
    DeviceDiscoveryStatus, DeviceIdentityPersistence,
};
use crate::AppState;

pub(crate) fn matched_connected_candidate(
    state: &AppState,
    request: &IdentifyDeviceCandidateRequest,
) -> Result<Option<DeviceCandidateResource>, String> {
    let registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    let Some(request_serial_port) = request.transport.serial_port.as_deref() else {
        return Ok(None);
    };

    let matched_state = registry.states().into_iter().find(|state| {
        state.status == DeviceConnectionStatus::Connected
            && state
                .transport
                .as_ref()
                .and_then(|transport| transport.serial_port.as_deref())
                == Some(request_serial_port)
    });

    Ok(matched_state.map(|state| DeviceCandidateResource {
        resource_id: request.resource_id.clone(),
        transport: request.transport.clone(),
        display_name: request.display_name.clone(),
        discovery_status: DeviceDiscoveryStatus::Matched,
        handshake_info: state
            .firmware_info
            .as_ref()
            .map(|info| DeviceCandidateHandshakeInfo {
                board_id: info.board_id.clone(),
                device_uid: info.device_uid.clone(),
                firmware_version: info.firmware_version.clone(),
                protocol_version: info.protocol_version,
                identity_persistence: DeviceIdentityPersistence::Persisted,
            }),
        device_uid: state.device_uid,
        matched_device_id: state.device_id,
        error: None,
    }))
}
