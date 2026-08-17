use std::path::PathBuf;

use crate::app_services::firmware_flash::{
    flash_artifact, status_for_artifact, FirmwareFlashContext,
};
pub use crate::app_services::firmware_flash::{
    FirmwareFlashPortTarget, FirmwareFlashRequest, FirmwareFlashResult, FirmwareFlashStatus,
    FirmwareFlashTarget,
};
use crate::app_services::firmware_service::FirmwareService;
use crate::core::device::DeviceTransportConfig;
use crate::core::firmware::{FirmwareArtifact, FirmwareManifest};

pub struct FirmwareFlashService {
    firmware_service: FirmwareService,
    firmware_root: PathBuf,
    context: FirmwareFlashContext,
}

impl FirmwareFlashService {
    pub fn new(
        manifest: FirmwareManifest,
        firmware_root: PathBuf,
        tool_root: PathBuf,
        mount_roots: Vec<PathBuf>,
        arduino_cli_path: Option<String>,
    ) -> Self {
        Self {
            firmware_service: FirmwareService::new(manifest),
            firmware_root,
            context: FirmwareFlashContext {
                mount_roots,
                tool_root,
                arduino_cli_path,
            },
        }
    }

    pub fn status(&self, artifact_id: &str) -> Result<FirmwareFlashStatus, String> {
        let artifact = self.artifact(artifact_id)?;
        status_for_artifact(artifact_id, artifact, &self.context)
    }

    pub fn flash(
        &self,
        request: &FirmwareFlashRequest,
        target_transport: Option<DeviceTransportConfig>,
    ) -> Result<FirmwareFlashResult, String> {
        let artifact = self.artifact(&request.artifact_id)?;
        flash_artifact(
            request,
            artifact,
            &self.firmware_root,
            &self.context,
            target_transport,
        )
    }

    fn artifact(&self, artifact_id: &str) -> Result<&FirmwareArtifact, String> {
        self.firmware_service
            .find_by_artifact_id(artifact_id)
            .ok_or_else(|| format!("firmware artifact not found: {artifact_id}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::unique_temp_root;
    use std::fs;

    #[test]
    fn status_reports_ready_when_rpi_rp2_volume_exists() {
        let root = unique_temp_root("cc-notice-firmware-status");
        let mount_root = root.join("Volumes");
        fs::create_dir_all(mount_root.join("RPI-RP2")).expect("mock volume should be created");
        let service = service_with_roots(root.join("firmware"), vec![mount_root]);

        let status = service
            .status("local-bundled:rp2040-pico:0.1.0:cc-notice-rp2040-pico.uf2")
            .expect("status should be returned");

        assert!(status.ready);
        assert_eq!("cc-notice-rp2040-pico.uf2", status.artifact_name);
        assert_eq!(
            Some("RPI-RP2".to_string()),
            status.target.map(|target| target.volume_name)
        );
    }

    #[test]
    fn flash_copies_uf2_to_rpi_rp2_volume() {
        let root = unique_temp_root("cc-notice-firmware-flash");
        let firmware_root = root.join("firmware");
        let mount_root = root.join("Volumes");
        let volume = mount_root.join("RPI-RP2");
        let source = firmware_root.join("rp2040-pico/cc-notice-rp2040-pico.uf2");
        fs::create_dir_all(source.parent().expect("source parent should exist"))
            .expect("firmware directory should be created");
        fs::create_dir_all(&volume).expect("mock volume should be created");
        fs::write(&source, b"mock uf2").expect("mock uf2 should be written");
        let service = service_with_roots(firmware_root, vec![mount_root]);

        let result = service
            .flash(
                &flash_request("local-bundled:rp2040-pico:0.1.0:cc-notice-rp2040-pico.uf2"),
                None,
            )
            .expect("firmware should be copied");

        assert_eq!(8, result.copied_bytes);
        assert_eq!(
            b"mock uf2".as_slice(),
            fs::read(volume.join("cc-notice-rp2040-pico.uf2"))
                .expect("target firmware should exist")
                .as_slice()
        );
    }

    #[test]
    fn flash_uses_artifact_id_instead_of_first_board_artifact() {
        let root = unique_temp_root("cc-notice-firmware-artifact-id-flash");
        let firmware_root = root.join("firmware");
        let mount_root = root.join("Volumes");
        let volume = mount_root.join("RPI-RP2");
        let old_source = firmware_root.join("rp2040-pico/0.1.4.uf2");
        let new_source = firmware_root.join("rp2040-pico/0.1.5.uf2");
        fs::create_dir_all(old_source.parent().expect("source parent should exist"))
            .expect("firmware directory should be created");
        fs::create_dir_all(&volume).expect("mock volume should be created");
        fs::write(&old_source, b"old uf2").expect("old uf2 should be written");
        fs::write(&new_source, b"new uf2").expect("new uf2 should be written");

        let service = FirmwareFlashService::new(
            FirmwareManifest {
                firmware: vec![
                    FirmwareArtifact {
                        target_id: None,
                        board_id: "rp2040-pico".to_string(),
                        firmware_version: "0.1.4".to_string(),
                        protocol_version: 2,
                        visible: true,
                        toolchain: None,
                        artifact_name: "cc-notice-rp2040-pico.uf2".to_string(),
                        artifact_type: "uf2".to_string(),
                        flash_strategy: "uf2_mount_copy".to_string(),
                        flash_volume_name: "RPI-RP2".to_string(),
                        relative_path: "rp2040-pico/0.1.4.uf2".to_string(),
                        upload: None,
                    },
                    FirmwareArtifact {
                        target_id: None,
                        board_id: "rp2040-pico".to_string(),
                        firmware_version: "0.1.5".to_string(),
                        protocol_version: 2,
                        visible: true,
                        toolchain: None,
                        artifact_name: "cc-notice-rp2040-pico.uf2".to_string(),
                        artifact_type: "uf2".to_string(),
                        flash_strategy: "uf2_mount_copy".to_string(),
                        flash_volume_name: "RPI-RP2".to_string(),
                        relative_path: "rp2040-pico/0.1.5.uf2".to_string(),
                        upload: None,
                    },
                ],
            },
            firmware_root,
            root.join("tools"),
            vec![mount_root],
            None,
        );

        let result = service
            .flash(
                &flash_request("local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2"),
                None,
            )
            .expect("selected artifact should be flashed");

        assert_eq!(
            "local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2",
            result.artifact_id
        );
        assert_eq!(
            b"new uf2".as_slice(),
            fs::read(volume.join("cc-notice-rp2040-pico.uf2"))
                .expect("target firmware should exist")
                .as_slice()
        );
    }

    #[test]
    fn status_reports_arduino_cli_state_for_arduino_upload() {
        let root = unique_temp_root("cc-notice-firmware-arduino-status");
        let mount_root = root.join("Volumes");
        fs::create_dir_all(&mount_root).expect("mock mount root should be created");
        let service = FirmwareFlashService::new(
            FirmwareManifest {
                firmware: vec![FirmwareArtifact {
                    target_id: Some("arduino-leonardo-default".to_string()),
                    board_id: "arduino-leonardo".to_string(),
                    firmware_version: "0.2.0".to_string(),
                    protocol_version: 2,
                    visible: true,
                    toolchain: Some("arduino-cli".to_string()),
                    artifact_name: "cc-notice-arduino-leonardo.hex".to_string(),
                    artifact_type: "hex".to_string(),
                    flash_strategy: "arduino_cli_upload".to_string(),
                    flash_volume_name: String::new(),
                    relative_path: "arduino-leonardo/cc-notice-arduino-leonardo.hex".to_string(),
                    upload: Some(arduino_upload_config()),
                }],
            },
            root.join("firmware"),
            root.join("tools"),
            vec![mount_root],
            None,
        );

        let status = service
            .status("local-bundled:arduino-leonardo:0.2.0:cc-notice-arduino-leonardo.hex")
            .expect("arduino status should be returned");

        assert_eq!("arduino_cli_upload", status.flash_strategy);
        assert!(status.target.is_none());
        let cli_status = status
            .arduino_cli
            .expect("arduino status should report cli availability");
        assert_eq!("arduino-cli", cli_status.resolved_path);
    }

    #[test]
    fn status_reports_configured_arduino_cli_path() {
        let root = unique_temp_root("cc-notice-firmware-arduino-tool-status");
        let service = FirmwareFlashService::new(
            FirmwareManifest {
                firmware: vec![FirmwareArtifact {
                    target_id: Some("arduino-leonardo-default".to_string()),
                    board_id: "arduino-leonardo".to_string(),
                    firmware_version: "0.2.0".to_string(),
                    protocol_version: 2,
                    visible: true,
                    toolchain: Some("arduino-cli".to_string()),
                    artifact_name: "cc-notice-arduino-leonardo.hex".to_string(),
                    artifact_type: "hex".to_string(),
                    flash_strategy: "arduino_cli_upload".to_string(),
                    flash_volume_name: String::new(),
                    relative_path: "arduino-leonardo/cc-notice-arduino-leonardo.hex".to_string(),
                    upload: Some(arduino_upload_config()),
                }],
            },
            root.join("firmware"),
            root.join("tools"),
            vec![root.join("Volumes")],
            Some("/custom/bin/arduino-cli".to_string()),
        );

        let status = service
            .status("local-bundled:arduino-leonardo:0.2.0:cc-notice-arduino-leonardo.hex")
            .expect("arduino status should be returned");

        let cli_status = status
            .arduino_cli
            .expect("arduino status should report cli availability");
        assert_eq!("/custom/bin/arduino-cli", cli_status.resolved_path);
    }

    #[test]
    fn flash_reports_strategy_error_for_arduino_cli_upload() {
        let root = unique_temp_root("cc-notice-firmware-arduino-flash");
        let service = FirmwareFlashService::new(
            FirmwareManifest {
                firmware: vec![FirmwareArtifact {
                    target_id: Some("arduino-leonardo-default".to_string()),
                    board_id: "arduino-leonardo".to_string(),
                    firmware_version: "0.2.0".to_string(),
                    protocol_version: 2,
                    visible: true,
                    toolchain: Some("arduino-cli".to_string()),
                    artifact_name: "cc-notice-arduino-leonardo.hex".to_string(),
                    artifact_type: "hex".to_string(),
                    flash_strategy: "arduino_cli_upload".to_string(),
                    flash_volume_name: String::new(),
                    relative_path: "arduino-leonardo/cc-notice-arduino-leonardo.hex".to_string(),
                    upload: Some(arduino_upload_config()),
                }],
            },
            root.join("firmware"),
            root.join("tools"),
            vec![root.join("Volumes")],
            None,
        );

        let error = service
            .flash(
                &flash_request(
                    "local-bundled:arduino-leonardo:0.2.0:cc-notice-arduino-leonardo.hex",
                ),
                None,
            )
            .expect_err("arduino upload should be handled by its strategy");

        assert_eq!("请选择烧录串口", error);
    }

    #[test]
    fn flash_returns_error_when_bootsel_volume_is_missing() {
        let root = unique_temp_root("cc-notice-firmware-missing-volume");
        let firmware_root = root.join("firmware");
        let source = firmware_root.join("rp2040-pico/cc-notice-rp2040-pico.uf2");
        fs::create_dir_all(source.parent().expect("source parent should exist"))
            .expect("firmware directory should be created");
        fs::write(&source, b"mock uf2").expect("mock uf2 should be written");
        let service = service_with_roots(firmware_root, vec![root.join("Volumes")]);

        let error = service
            .flash(
                &flash_request("local-bundled:rp2040-pico:0.1.0:cc-notice-rp2040-pico.uf2"),
                None,
            )
            .expect_err("missing BOOTSEL volume should be reported");

        assert_eq!("RPI-RP2 volume is not mounted", error);
    }

    #[test]
    fn status_uses_flash_volume_name_from_manifest() {
        let root = unique_temp_root("cc-notice-firmware-custom-volume");
        let mount_root = root.join("Volumes");
        fs::create_dir_all(mount_root.join("CUSTOM-UF2")).expect("mock volume should be created");
        let service = FirmwareFlashService::new(
            FirmwareManifest {
                firmware: vec![FirmwareArtifact {
                    target_id: None,
                    board_id: "custom-board".to_string(),
                    firmware_version: "0.1.0".to_string(),
                    protocol_version: 2,
                    visible: true,
                    toolchain: None,
                    artifact_name: "custom.uf2".to_string(),
                    artifact_type: "uf2".to_string(),
                    flash_strategy: "uf2_mount_copy".to_string(),
                    flash_volume_name: "CUSTOM-UF2".to_string(),
                    relative_path: "custom-board/custom.uf2".to_string(),
                    upload: None,
                }],
            },
            root.join("firmware"),
            root.join("tools"),
            vec![mount_root],
            None,
        );

        let status = service
            .status("local-bundled:custom-board:0.1.0:custom.uf2")
            .expect("custom board status should be returned");

        assert!(status.ready);
        assert_eq!(
            Some("CUSTOM-UF2".to_string()),
            status.target.map(|target| target.volume_name)
        );
    }

    fn service_with_roots(
        firmware_root: PathBuf,
        mount_roots: Vec<PathBuf>,
    ) -> FirmwareFlashService {
        FirmwareFlashService::new(
            FirmwareManifest {
                firmware: vec![FirmwareArtifact {
                    target_id: None,
                    board_id: "rp2040-pico".to_string(),
                    firmware_version: "0.1.0".to_string(),
                    protocol_version: 2,
                    visible: true,
                    toolchain: None,
                    artifact_name: "cc-notice-rp2040-pico.uf2".to_string(),
                    artifact_type: "uf2".to_string(),
                    flash_strategy: "uf2_mount_copy".to_string(),
                    flash_volume_name: "RPI-RP2".to_string(),
                    relative_path: "rp2040-pico/cc-notice-rp2040-pico.uf2".to_string(),
                    upload: None,
                }],
            },
            firmware_root,
            PathBuf::from("tools"),
            mount_roots,
            None,
        )
    }

    fn arduino_upload_config() -> crate::core::firmware::FirmwareUploadConfig {
        crate::core::firmware::FirmwareUploadConfig {
            fqbn: "arduino:avr:leonardo".to_string(),
            protocol: "avr109".to_string(),
            speed: 57600,
            requires_1200bps_reset: true,
            bootloader_wait_ms: 8000,
            board_options: std::collections::BTreeMap::new(),
        }
    }

    fn flash_request(artifact_id: &str) -> FirmwareFlashRequest {
        FirmwareFlashRequest {
            artifact_id: artifact_id.to_string(),
            target_id: None,
        }
    }
}
