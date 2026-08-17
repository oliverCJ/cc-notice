use std::fs;
use std::path::{Path, PathBuf};

use crate::core::firmware::FirmwareArtifact;

use super::{FirmwareFlashResult, FirmwareFlashStatus, FirmwareFlashTarget};

pub fn status(
    artifact_id: &str,
    artifact: &FirmwareArtifact,
    mount_roots: &[PathBuf],
) -> Result<FirmwareFlashStatus, String> {
    validate_uf2_artifact(artifact)?;
    let target = find_uf2_target(&artifact.flash_volume_name, mount_roots);

    Ok(FirmwareFlashStatus {
        artifact_id: artifact_id.to_string(),
        board_id: artifact.board_id.clone(),
        artifact_name: artifact.artifact_name.clone(),
        artifact_type: artifact.artifact_type.clone(),
        flash_strategy: artifact.flash_strategy.clone(),
        ready: target.is_some(),
        target,
        upload_tool: None,
        arduino_cli: None,
    })
}

pub fn flash(
    artifact_id: &str,
    artifact: &FirmwareArtifact,
    firmware_root: &Path,
    mount_roots: &[PathBuf],
) -> Result<FirmwareFlashResult, String> {
    validate_uf2_artifact(artifact)?;

    let target = find_uf2_target(&artifact.flash_volume_name, mount_roots)
        .ok_or_else(|| format!("{} volume is not mounted", artifact.flash_volume_name))?;
    let source_path = firmware_root.join(&artifact.relative_path);
    let target_path = Path::new(&target.mount_path).join(&artifact.artifact_name);

    let copied_bytes = fs::copy(&source_path, &target_path)
        .map_err(|error| format!("failed to copy firmware artifact: {error}"))?;

    Ok(FirmwareFlashResult {
        artifact_id: artifact_id.to_string(),
        board_id: artifact.board_id.clone(),
        artifact_name: artifact.artifact_name.clone(),
        target,
        copied_bytes,
    })
}

fn validate_uf2_artifact(artifact: &FirmwareArtifact) -> Result<(), String> {
    if artifact.artifact_type != "uf2" {
        return Err(format!(
            "unsupported artifact type: {}",
            artifact.artifact_type
        ));
    }

    Ok(())
}

fn find_uf2_target(volume_name: &str, mount_roots: &[PathBuf]) -> Option<FirmwareFlashTarget> {
    mount_roots.iter().find_map(|root| {
        if mount_root_matches_volume(root, volume_name) {
            return Some(FirmwareFlashTarget {
                mount_path: root.to_string_lossy().to_string(),
                volume_name: volume_name.to_string(),
            });
        }

        let mount_path = root.join(volume_name);
        if !mount_path.is_dir() {
            return None;
        }

        Some(FirmwareFlashTarget {
            mount_path: mount_path.to_string_lossy().to_string(),
            volume_name: volume_name.to_string(),
        })
    })
}

fn mount_root_matches_volume(root: &Path, volume_name: &str) -> bool {
    root.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case(volume_name))
        .unwrap_or(false)
        || platform_volume_label_matches(root, volume_name)
}

#[cfg(target_os = "windows")]
fn platform_volume_label_matches(root: &Path, volume_name: &str) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW;

    let mut root_text = root.as_os_str().encode_wide().collect::<Vec<u16>>();
    if !matches!(root_text.last(), Some(value) if *value == b'\\' as u16) {
        root_text.push(b'\\' as u16);
    }
    root_text.push(0);

    let mut volume_buffer = [0u16; 256];
    // Windows Pico BOOTSEL exposes the desired name as a volume label on a drive root such as E:\.
    let ok = unsafe {
        GetVolumeInformationW(
            root_text.as_ptr(),
            volume_buffer.as_mut_ptr(),
            volume_buffer.len() as u32,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
        )
    };
    if ok == 0 {
        return false;
    }

    let end = volume_buffer
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(volume_buffer.len());
    String::from_utf16_lossy(&volume_buffer[..end]).eq_ignore_ascii_case(volume_name)
}

#[cfg(not(target_os = "windows"))]
fn platform_volume_label_matches(_root: &Path, _volume_name: &str) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_uf2_target_when_mount_root_is_the_volume_itself() {
        let root = crate::test_support::unique_temp_root("cc-notice-uf2-volume-root");
        let volume = root.join("RPI-RP2");
        fs::create_dir_all(&volume).expect("mock volume should be created");

        let target = find_uf2_target("RPI-RP2", &[volume.clone()])
            .expect("volume root should be detected");

        assert_eq!(volume.to_string_lossy(), target.mount_path);
        assert_eq!("RPI-RP2", target.volume_name);
    }
}
