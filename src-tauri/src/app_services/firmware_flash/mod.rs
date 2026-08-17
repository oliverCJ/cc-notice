mod arduino_cli_upload;
mod model;
mod uf2_mount_copy;

use std::path::Path;

use crate::core::device::DeviceTransportConfig;
use crate::core::firmware::FirmwareArtifact;

pub use model::{
    FirmwareFlashContext, FirmwareFlashPortTarget, FirmwareFlashRequest, FirmwareFlashResult,
    FirmwareFlashStatus, FirmwareFlashTarget, FirmwareUploadToolStatus,
};

pub fn status_for_artifact(
    artifact_id: &str,
    artifact: &FirmwareArtifact,
    context: &FirmwareFlashContext,
) -> Result<FirmwareFlashStatus, String> {
    match artifact.flash_strategy.as_str() {
        "uf2_mount_copy" => uf2_mount_copy::status(artifact_id, artifact, &context.mount_roots),
        "arduino_cli_upload" => arduino_cli_upload::status(artifact_id, artifact, context),
        unsupported => Err(format!("unsupported flash strategy: {unsupported}")),
    }
}

pub fn flash_artifact(
    request: &FirmwareFlashRequest,
    artifact: &FirmwareArtifact,
    firmware_root: &Path,
    context: &FirmwareFlashContext,
    target_transport: Option<DeviceTransportConfig>,
) -> Result<FirmwareFlashResult, String> {
    match artifact.flash_strategy.as_str() {
        "uf2_mount_copy" => uf2_mount_copy::flash(
            &request.artifact_id,
            artifact,
            firmware_root,
            &context.mount_roots,
        ),
        "arduino_cli_upload" => {
            arduino_cli_upload::flash(request, artifact, firmware_root, context, target_transport)
        }
        unsupported => Err(format!("unsupported flash strategy: {unsupported}")),
    }
}
