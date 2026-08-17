use crate::adapters::boards::BoardCatalogRegistry;
use crate::core::firmware::{
    FirmwareArtifact, FirmwareCatalog, FirmwareCatalogArtifact, FirmwareManifest,
};

pub struct FirmwareService {
    manifest: FirmwareManifest,
}

pub const LOCAL_BUNDLED_FIRMWARE_SOURCE: &str = "local-bundled";

impl FirmwareService {
    pub fn new(manifest: FirmwareManifest) -> Self {
        Self { manifest }
    }

    pub fn find_by_board(&self, board_id: &str) -> Option<&FirmwareArtifact> {
        self.manifest
            .firmware
            .iter()
            .find(|artifact| artifact.board_id == board_id)
    }

    pub fn find_by_artifact_id(&self, artifact_id: &str) -> Option<&FirmwareArtifact> {
        self.manifest.firmware.iter().find(|artifact| {
            firmware_artifact_id(LOCAL_BUNDLED_FIRMWARE_SOURCE, artifact) == artifact_id
        })
    }

    pub fn resource_relative_path(&self, board_id: &str) -> Option<&str> {
        self.find_by_board(board_id)
            .map(|artifact| artifact.relative_path.as_str())
    }

    pub fn catalog(&self) -> FirmwareCatalog {
        FirmwareCatalog {
            artifacts: self
                .manifest
                .firmware
                .iter()
                .filter(|artifact| artifact.visible)
                .map(|artifact| FirmwareCatalogArtifact {
                    artifact_id: firmware_artifact_id(LOCAL_BUNDLED_FIRMWARE_SOURCE, artifact),
                    board_id: artifact.board_id.clone(),
                    board_name: board_display_name(&artifact.board_id),
                    target_id: artifact.target_id.clone(),
                    firmware_version: artifact.firmware_version.clone(),
                    protocol_version: artifact.protocol_version,
                    visible: artifact.visible,
                    toolchain: artifact.toolchain.clone(),
                    artifact_name: artifact.artifact_name.clone(),
                    artifact_type: artifact.artifact_type.clone(),
                    flash_strategy: artifact.flash_strategy.clone(),
                    flash_volume_name: artifact.flash_volume_name.clone(),
                    relative_path: artifact.relative_path.clone(),
                    source: LOCAL_BUNDLED_FIRMWARE_SOURCE.to_string(),
                    upload: artifact.upload.clone(),
                })
                .collect(),
        }
    }
}

pub fn firmware_artifact_id(source: &str, artifact: &FirmwareArtifact) -> String {
    format!(
        "{}:{}:{}:{}",
        source, artifact.board_id, artifact.firmware_version, artifact.artifact_name
    )
}

fn board_display_name(board_id: &str) -> String {
    BoardCatalogRegistry::bundled()
        .ok()
        .and_then(|registry| {
            registry
                .board(board_id)
                .map(|board| board.display_name().to_string())
        })
        .unwrap_or_else(|| board_id.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::firmware::FirmwareUploadConfig;
    use std::collections::BTreeMap;

    #[test]
    fn finds_firmware_by_board_id() {
        let service = FirmwareService::new(FirmwareManifest {
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
        });

        let artifact = service
            .find_by_board("rp2040-pico")
            .expect("rp2040 firmware should exist");

        assert_eq!("cc-notice-rp2040-pico.uf2", artifact.artifact_name);
    }

    #[test]
    fn returns_firmware_resource_relative_path_by_board_id() {
        let service = FirmwareService::new(FirmwareManifest {
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
        });

        let path = service
            .resource_relative_path("rp2040-pico")
            .expect("rp2040 firmware resource path should exist");

        assert_eq!("rp2040-pico/cc-notice-rp2040-pico.uf2", path);
    }

    #[test]
    fn catalog_includes_local_bundled_artifact_with_board_name() {
        let service = FirmwareService::new(FirmwareManifest {
            firmware: vec![FirmwareArtifact {
                target_id: None,
                board_id: "rp2040-pico".to_string(),
                firmware_version: "0.2.2".to_string(),
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
        });

        let catalog = service.catalog();

        assert_eq!(1, catalog.artifacts.len());
        let artifact = &catalog.artifacts[0];
        assert_eq!("rp2040-pico", artifact.board_id);
        assert_eq!("Raspberry Pi Pico", artifact.board_name);
        assert_eq!("0.2.2", artifact.firmware_version);
        assert!(artifact.visible);
        assert_eq!("local-bundled", artifact.source);
    }

    #[test]
    fn catalog_includes_stable_artifact_id() {
        let service = FirmwareService::new(FirmwareManifest {
            firmware: vec![FirmwareArtifact {
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
                relative_path: "rp2040-pico/cc-notice-rp2040-pico.uf2".to_string(),
                upload: None,
            }],
        });

        let catalog = service.catalog();

        assert_eq!(
            "local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2",
            catalog.artifacts[0].artifact_id
        );
    }

    #[test]
    fn catalog_excludes_hidden_artifacts_but_keeps_lookup_available() {
        let hidden_artifact = FirmwareArtifact {
            target_id: Some("stm32f103cx-blue-pill-default".to_string()),
            board_id: "stm32f103cx-blue-pill".to_string(),
            firmware_version: "0.2.0".to_string(),
            protocol_version: 2,
            visible: false,
            toolchain: Some("arduino-cli".to_string()),
            artifact_name: "cc-notice-stm32f103cx-blue-pill.bin".to_string(),
            artifact_type: "bin".to_string(),
            flash_strategy: "arduino_cli_upload".to_string(),
            flash_volume_name: String::new(),
            relative_path: "stm32f103cx-blue-pill/cc-notice-stm32f103cx-blue-pill.bin".to_string(),
            upload: Some(FirmwareUploadConfig {
                fqbn: "STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C6".to_string(),
                protocol: "serial".to_string(),
                speed: 115200,
                requires_1200bps_reset: false,
                bootloader_wait_ms: 2000,
                board_options: BTreeMap::new(),
            }),
        };
        let artifact_id = firmware_artifact_id(LOCAL_BUNDLED_FIRMWARE_SOURCE, &hidden_artifact);
        let service = FirmwareService::new(FirmwareManifest {
            firmware: vec![hidden_artifact],
        });

        let catalog = service.catalog();

        assert!(catalog.artifacts.is_empty());
        assert!(service.find_by_artifact_id(&artifact_id).is_some());
    }

    #[test]
    fn catalog_includes_upload_metadata_for_arduino_artifact() {
        let service = FirmwareService::new(FirmwareManifest {
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
                upload: Some(FirmwareUploadConfig {
                    fqbn: "arduino:avr:leonardo".to_string(),
                    protocol: "avr109".to_string(),
                    speed: 57600,
                    requires_1200bps_reset: true,
                    bootloader_wait_ms: 8000,
                    board_options: BTreeMap::new(),
                }),
            }],
        });

        let catalog = service.catalog();
        let upload = catalog.artifacts[0]
            .upload
            .as_ref()
            .expect("arduino artifact should expose upload metadata");
        let value = serde_json::to_value(upload).expect("upload metadata should serialize");

        assert_eq!("avr109", upload.protocol);
        assert_eq!(57600, upload.speed);
        assert_eq!(true, value["requires1200bpsReset"]);
        assert_eq!(8000, value["bootloaderWaitMs"]);
    }

    #[test]
    fn finds_firmware_by_artifact_id_when_board_has_multiple_artifacts() {
        let service = FirmwareService::new(FirmwareManifest {
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
        });

        let artifact = service
            .find_by_artifact_id("local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2")
            .expect("0.1.5 artifact should be found");

        assert_eq!("0.1.5", artifact.firmware_version);
        assert_eq!("rp2040-pico/0.1.5.uf2", artifact.relative_path);
    }
}
