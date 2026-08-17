use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FirmwareManifest {
    pub firmware: Vec<FirmwareArtifact>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FirmwareArtifact {
    #[serde(default)]
    pub target_id: Option<String>,
    pub board_id: String,
    pub firmware_version: String,
    pub protocol_version: u16,
    #[serde(default = "default_visible")]
    pub visible: bool,
    #[serde(default)]
    pub toolchain: Option<String>,
    pub artifact_name: String,
    pub artifact_type: String,
    pub flash_strategy: String,
    pub flash_volume_name: String,
    pub relative_path: String,
    #[serde(default)]
    pub upload: Option<FirmwareUploadConfig>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct FirmwareUploadConfig {
    pub fqbn: String,
    pub protocol: String,
    pub speed: u32,
    pub requires_1200bps_reset: bool,
    pub bootloader_wait_ms: u64,
    #[serde(default)]
    pub board_options: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareCatalog {
    pub artifacts: Vec<FirmwareCatalogArtifact>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareCatalogArtifact {
    pub artifact_id: String,
    pub board_id: String,
    pub board_name: String,
    pub target_id: Option<String>,
    pub firmware_version: String,
    pub protocol_version: u16,
    pub visible: bool,
    #[serde(default)]
    pub toolchain: Option<String>,
    pub artifact_name: String,
    pub artifact_type: String,
    pub flash_strategy: String,
    pub flash_volume_name: String,
    pub relative_path: String,
    pub source: String,
    pub upload: Option<FirmwareUploadConfig>,
}

impl FirmwareManifest {
    pub fn validate(&self) -> Result<(), String> {
        if self.firmware.is_empty() {
            return Err("firmware list is empty".to_string());
        }

        for artifact in &self.firmware {
            if artifact.board_id.trim().is_empty() {
                return Err("board_id is empty".to_string());
            }
            if let Some(target_id) = &artifact.target_id {
                if target_id.trim().is_empty() {
                    return Err("target_id is empty".to_string());
                }
            }
            if artifact.firmware_version.trim().is_empty() {
                return Err("firmware_version is empty".to_string());
            }
            if artifact.protocol_version == 0 {
                return Err("protocol_version must be positive".to_string());
            }
            if let Some(toolchain) = &artifact.toolchain {
                if toolchain.trim().is_empty() {
                    return Err("toolchain is empty".to_string());
                }
            }
            if artifact.artifact_name.trim().is_empty() {
                return Err("artifact_name is empty".to_string());
            }
            if artifact.artifact_type.trim().is_empty() {
                return Err("artifact_type is empty".to_string());
            }
            if artifact.flash_strategy.trim().is_empty() {
                return Err("flash_strategy is empty".to_string());
            }
            if requires_flash_volume_name(&artifact.flash_strategy)
                && artifact.flash_volume_name.trim().is_empty()
            {
                return Err("flash_volume_name is empty".to_string());
            }
            if artifact.relative_path.trim().is_empty() {
                return Err("relative_path is empty".to_string());
            }
            validate_upload_metadata(artifact)?;
        }

        Ok(())
    }
}

fn default_visible() -> bool {
    true
}

fn requires_flash_volume_name(flash_strategy: &str) -> bool {
    flash_strategy == "uf2_mount_copy"
}

fn validate_upload_metadata(artifact: &FirmwareArtifact) -> Result<(), String> {
    if artifact.flash_strategy == "arduino_cli_upload" && artifact.upload.is_none() {
        return Err("upload metadata is required for arduino_cli_upload".to_string());
    }

    let Some(upload) = &artifact.upload else {
        return Ok(());
    };

    if upload.protocol.trim().is_empty() {
        return Err("upload protocol is empty".to_string());
    }
    if upload.fqbn.trim().is_empty() {
        return Err("upload fqbn is empty".to_string());
    }
    if upload.speed == 0 {
        return Err("upload speed must be positive".to_string());
    }
    if upload.bootloader_wait_ms == 0 {
        return Err("bootloader_wait_ms must be positive".to_string());
    }
    for (key, value) in &upload.board_options {
        if key.trim().is_empty() {
            return Err("upload board option key is empty".to_string());
        }
        if value.trim().is_empty() {
            return Err(format!("upload board option {key} is empty"));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_rejects_empty_firmware_list() {
        let manifest = FirmwareManifest { firmware: vec![] };

        let error = manifest
            .validate()
            .expect_err("empty firmware list must be rejected");

        assert_eq!("firmware list is empty", error);
    }

    #[test]
    fn manifest_accepts_rp2040_artifact() {
        let manifest = FirmwareManifest {
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
        };

        assert!(manifest.validate().is_ok());
    }

    #[test]
    fn manifest_accepts_firmware_target_metadata() {
        let manifest = FirmwareManifest {
            firmware: vec![FirmwareArtifact {
                target_id: Some("rp2040-pico-default".to_string()),
                board_id: "rp2040-pico".to_string(),
                firmware_version: "0.2.3".to_string(),
                protocol_version: 2,
                visible: true,
                toolchain: Some("pico-sdk-cmake".to_string()),
                artifact_name: "cc-notice-rp2040-pico.uf2".to_string(),
                artifact_type: "uf2".to_string(),
                flash_strategy: "uf2_mount_copy".to_string(),
                flash_volume_name: "RPI-RP2".to_string(),
                relative_path: "rp2040-pico/cc-notice-rp2040-pico.uf2".to_string(),
                upload: None,
            }],
        };

        assert!(manifest.validate().is_ok());
    }

    #[test]
    fn manifest_rejects_empty_relative_path() {
        let manifest = FirmwareManifest {
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
                relative_path: String::new(),
                upload: None,
            }],
        };

        let error = manifest
            .validate()
            .expect_err("empty relative_path must be rejected");

        assert_eq!("relative_path is empty", error);
    }

    #[test]
    fn manifest_rejects_empty_flash_volume_name() {
        let manifest = FirmwareManifest {
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
                flash_volume_name: String::new(),
                relative_path: "rp2040-pico/cc-notice-rp2040-pico.uf2".to_string(),
                upload: None,
            }],
        };

        let error = manifest
            .validate()
            .expect_err("empty flash_volume_name must be rejected");

        assert_eq!("flash_volume_name is empty", error);
    }

    #[test]
    fn manifest_accepts_arduino_cli_upload_without_flash_volume_name() {
        let manifest = FirmwareManifest {
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
        };

        assert!(manifest.validate().is_ok());
    }

    #[test]
    fn manifest_rejects_arduino_cli_upload_without_upload_metadata() {
        let manifest = FirmwareManifest {
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
                upload: None,
            }],
        };

        let error = manifest
            .validate()
            .expect_err("arduino upload artifacts must declare upload metadata");

        assert_eq!("upload metadata is required for arduino_cli_upload", error);
    }

    fn arduino_upload_config() -> FirmwareUploadConfig {
        FirmwareUploadConfig {
            fqbn: "arduino:avr:leonardo".to_string(),
            protocol: "avr109".to_string(),
            speed: 57600,
            requires_1200bps_reset: true,
            bootloader_wait_ms: 8000,
            board_options: BTreeMap::new(),
        }
    }
}
