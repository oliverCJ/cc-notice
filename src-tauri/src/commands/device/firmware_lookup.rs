use crate::app_services::firmware_service::FirmwareService;
use crate::core::device::DeviceRuntimeState;
use crate::core::firmware::FirmwareArtifact;

pub(crate) fn bundled_firmware_artifact_for_state(
    runtime_state: &DeviceRuntimeState,
) -> Result<Option<FirmwareArtifact>, String> {
    let Some(board_id) = runtime_state.board_id.as_deref() else {
        return Ok(None);
    };
    let manifest = crate::commands::firmware::firmware_manifest()?;
    let service = FirmwareService::new(manifest);
    Ok(service.find_by_board(board_id).cloned())
}
