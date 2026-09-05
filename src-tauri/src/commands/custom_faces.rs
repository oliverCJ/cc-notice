use std::path::PathBuf;

use serde::Deserialize;

use crate::app_services::custom_face_installer::install_custom_face_group_with_shared_registry;
use crate::app_services::custom_face_library::{
    CustomFaceGifExportResult, CustomFaceGroupSummary, CustomFaceImportMode,
    CustomFaceImportPreview, CustomFaceItemImportPreview, PersonalCustomFaceAsset,
    SaveCustomFaceGroupResult,
};
use crate::core::custom_faces::{CustomFace, CustomFaceGroup};
use crate::core::device::{DeviceCustomFaceActiveSource, DeviceRuntimeState};
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCustomFaceGroupRequest {
    pub group: CustomFaceGroup,
    pub expected_library_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceImportRequest {
    pub path: String,
    pub mode: CustomFaceImportMode,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCustomFaceRequest {
    pub face: CustomFace,
    pub display_profile_id: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCustomFaceGifRequest {
    pub face: CustomFace,
    pub display_profile_id: String,
    pub path: String,
    pub scale: u8,
    #[serde(default)]
    pub invert: bool,
    #[serde(default)]
    pub transparent_background: bool,
    #[serde(default)]
    pub frame_indices: Vec<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCustomFacePngRequest {
    pub packed_pixels: Vec<u8>,
    pub display_profile_id: String,
    pub path: String,
    pub scale: u8,
    #[serde(default)]
    pub invert: bool,
    #[serde(default)]
    pub transparent_background: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallCustomFaceGroupRequest {
    pub device_id: String,
    pub group_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetCustomFaceActiveSourceRequest {
    pub device_id: String,
    pub source: DeviceCustomFaceActiveSource,
    pub group_id: Option<String>,
}

#[tauri::command]
pub fn custom_face_assets(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<PersonalCustomFaceAsset>, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .list_assets()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_custom_face_asset(
    state: tauri::State<'_, AppState>,
    asset: PersonalCustomFaceAsset,
) -> Result<PersonalCustomFaceAsset, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .save_asset(asset)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_custom_face_asset(
    state: tauri::State<'_, AppState>,
    asset_id: String,
) -> Result<(), String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .delete_asset(&asset_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_custom_face_svg(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("svg"))
        != Some(true)
    {
        return Err("SVG 文件扩展名无效".to_string());
    }
    let metadata = std::fs::metadata(&path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > 2 * 1024 * 1024 {
        return Err("SVG 文件不存在、不是普通文件或超过 2 MiB".to_string());
    }
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn custom_face_groups(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<CustomFaceGroupSummary>, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .list_groups()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn custom_face_group(
    state: tauri::State<'_, AppState>,
    group_id: String,
) -> Result<CustomFaceGroup, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .load_group(&group_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_custom_face_group(
    state: tauri::State<'_, AppState>,
    request: SaveCustomFaceGroupRequest,
) -> Result<SaveCustomFaceGroupResult, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .save_group(request.group, request.expected_library_hash.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_custom_face_group(
    state: tauri::State<'_, AppState>,
    group_id: String,
    expected_library_hash: String,
) -> Result<(), String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .delete_group(&group_id, &expected_library_hash)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_custom_face_recovery(
    state: tauri::State<'_, AppState>,
    group: CustomFaceGroup,
) -> Result<(), String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .save_recovery(&group)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn custom_face_recovery(
    state: tauri::State<'_, AppState>,
    group_id: String,
) -> Result<Option<CustomFaceGroup>, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .load_recovery(&group_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_custom_face_recovery(
    state: tauri::State<'_, AppState>,
    group_id: String,
) -> Result<(), String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .clear_recovery(&group_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_custom_face_group(
    state: tauri::State<'_, AppState>,
    group_id: String,
    path: String,
) -> Result<(), String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .export_group(&group_id, &PathBuf::from(path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_custom_face_group_import(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<CustomFaceImportPreview, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .preview_import(&PathBuf::from(path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn import_custom_face_group(
    state: tauri::State<'_, AppState>,
    request: CustomFaceImportRequest,
) -> Result<SaveCustomFaceGroupResult, String> {
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .import_group(&PathBuf::from(request.path), request.mode)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn install_custom_face_group_to_device(
    state: tauri::State<'_, AppState>,
    request: InstallCustomFaceGroupRequest,
) -> Result<DeviceRuntimeState, String> {
    install_custom_face_group_to_device_impl(&state, request)
}

#[tauri::command]
pub fn set_custom_face_active_source(
    state: tauri::State<'_, AppState>,
    request: SetCustomFaceActiveSourceRequest,
) -> Result<DeviceRuntimeState, String> {
    state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .set_custom_face_active_source(&request.device_id, request.source, request.group_id)
}

pub(crate) fn install_custom_face_group_to_device_impl(
    state: &AppState,
    request: InstallCustomFaceGroupRequest,
) -> Result<DeviceRuntimeState, String> {
    let group = state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .load_group(&request.group_id)
        .map_err(|error| error.to_string())?;
    let session_id = uuid::Uuid::new_v4().to_string();
    install_custom_face_group_with_shared_registry(
        &state.device_runtime_registry,
        &request.device_id,
        &group,
        &session_id,
    )
}

#[tauri::command]
pub fn preview_custom_face_item_import(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<CustomFaceItemImportPreview, String> {
    require_extension(&path, "ccfaceitem")?;
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .preview_face_item_import(&PathBuf::from(path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_custom_face_item(
    state: tauri::State<'_, AppState>,
    request: ExportCustomFaceRequest,
) -> Result<(), String> {
    require_extension(&request.path, "ccfaceitem")?;
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .export_face_item(
            &request.face,
            &request.display_profile_id,
            &PathBuf::from(request.path),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_custom_face_gif(
    state: tauri::State<'_, AppState>,
    request: ExportCustomFaceGifRequest,
) -> Result<CustomFaceGifExportResult, String> {
    require_extension(&request.path, "gif")?;
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .export_face_gif(
            &request.face,
            &request.display_profile_id,
            &PathBuf::from(request.path),
            request.scale,
            request.invert,
            request.transparent_background,
            &request.frame_indices,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_custom_face_png(
    state: tauri::State<'_, AppState>,
    request: ExportCustomFacePngRequest,
) -> Result<(), String> {
    require_extension(&request.path, "png")?;
    state
        .custom_face_library_service
        .lock()
        .map_err(|error| error.to_string())?
        .export_face_png(
            &request.packed_pixels,
            &request.display_profile_id,
            &PathBuf::from(request.path),
            request.scale,
            request.invert,
            request.transparent_background,
        )
        .map_err(|error| error.to_string())
}

fn require_extension(path: &str, extension: &str) -> Result<(), String> {
    PathBuf::from(path)
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
        .then_some(())
        .ok_or_else(|| format!("expected .{extension} file"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_services::custom_face_installer::build_full_install_commands;
    use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
    use crate::core::custom_faces::{CustomFaceColor, CustomFaceFrame};
    use crate::core::device::{
        ActiveLevel, DeviceChannel, DeviceConnectionStatus, DeviceCustomFaceStatusState,
        DeviceInstance, DeviceTransportConfig,
    };
    use crate::core::firmware::FirmwareArtifact;
    use crate::infrastructure::transports::mock::MockDeviceTransport;
    use crate::test_support::minimal_app_state_for_root;

    #[test]
    fn install_custom_face_group_command_loads_library_group_and_updates_device_status() {
        let root = crate::test_support::unique_temp_root("cc-notice-custom-face-install-command");
        let state = minimal_app_state_for_root(&root);
        let group = test_group();
        state
            .custom_face_library_service
            .lock()
            .expect("library lock")
            .save_group(group.clone(), None)
            .expect("group should save");
        setup_connected_wio_with_custom_face_support(&state, &group);

        let runtime = install_custom_face_group_to_device_impl(
            &state,
            InstallCustomFaceGroupRequest {
                device_id: "desk-wio".to_string(),
                group_id: group.group_id.clone(),
            },
        )
        .expect("install command should complete");

        assert_eq!(DeviceConnectionStatus::Connected, runtime.status);
        assert_eq!(
            DeviceCustomFaceStatusState::Installed,
            runtime.custom_face_status.state
        );
        let registry = state.device_runtime_registry.lock().expect("registry lock");
        let sent_lines = registry.sent_lines("desk-wio");
        assert!(sent_lines
            .iter()
            .any(|line| line.contains("\"type\":\"custom_face_install_begin\"")));
        assert!(sent_lines
            .iter()
            .any(|line| line.contains("\"type\":\"custom_face_install_commit\"")));
        assert_eq!(
            "{\"v\":2,\"type\":\"custom_face_status\"}\n",
            sent_lines.last().expect("refreshed status")
        );
    }

    fn setup_connected_wio_with_custom_face_support(state: &AppState, group: &CustomFaceGroup) {
        let expected_commands =
            build_full_install_commands(group, "session-for-test").expect("commands should build");
        let begin_line = expected_commands
            .first()
            .expect("begin command")
            .to_json_line()
            .expect("begin command should serialize");
        let begin: serde_json::Value = serde_json::from_str(&begin_line).unwrap();
        let group_hash = begin
            .get("group_runtime_hash")
            .and_then(serde_json::Value::as_str)
            .expect("group hash");
        let encoded_bytes = begin
            .get("total_bytes")
            .and_then(serde_json::Value::as_u64)
            .expect("total bytes");
        let mut ack_lines = vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"seeed-wio-terminal","device_uid":"seeed-wio-terminal:0011223344556677","firmware_version":"0.2.1","protocol_version":2,"custom_face":{"protocol_version":1,"profile_code":3,"pixel_width":320,"pixel_height":240,"max_faces":15,"max_frames_per_face":10,"max_group_bytes":393216,"chunk_bytes":512,"incremental_update":true}}"#.to_string(),
            r#"{"ok":true,"v":2,"type":"custom_face_status","state":"empty"}"#.to_string(),
        ];
        for command in &expected_commands {
            ack_lines.push(format!(
                r#"{{"ok":true,"v":2,"type":"{}"}}"#,
                command.expected_ack_type()
            ));
        }
        ack_lines.push(format!(
            r#"{{"ok":true,"v":2,"type":"custom_face_status","state":"installed","profile_code":3,"group_id":"{}","group_runtime_hash":"{}","default_face_id":"{}","face_count":1,"encoded_bytes":{}}}"#,
            group.group_id, group_hash, group.default_face_id, encoded_bytes
        ));

        let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-wio")]);
        registry
            .connect_with_transport(
                "desk-wio",
                Box::new(MockDeviceTransport::with_received_lines(ack_lines)),
            )
            .expect("device should connect");
        let prepared = registry
            .prepare_device_info_query("desk-wio")
            .expect("device_info should prepare");
        let device_info_result = prepared.worker.query_device_info_line();
        registry
            .complete_device_info_query(
                "desk-wio",
                prepared.session_id,
                &bundled_artifact_for_board("seeed-wio-terminal", "0.2.1", 2),
                device_info_result,
            )
            .expect("device_info should complete");
        let prepared_status = registry
            .prepare_custom_face_status_query("desk-wio")
            .expect("status should prepare");
        let status_result = prepared_status
            .worker
            .send_protocol_command(prepared_status.command);
        registry
            .complete_custom_face_status_query(
                "desk-wio",
                prepared_status.session_id,
                status_result,
            )
            .expect("initial status should complete");
        *state.device_runtime_registry.lock().expect("registry lock") = registry;
    }

    fn test_group() -> CustomFaceGroup {
        let mut pixels = vec![0; 320 * 240 / 8];
        for (index, value) in pixels.iter_mut().enumerate() {
            *value = (index % 251) as u8 + 1;
        }
        CustomFaceGroup {
            schema_version: 1,
            group_id: "00000000-0000-4000-8000-000000000101".to_string(),
            name: "Wio group".to_string(),
            display_profile_id: "custom-mono-320x240-v1".to_string(),
            revision: 1,
            default_face_id: "00000000-0000-4000-8000-000000000111".to_string(),
            faces: vec![CustomFace {
                face_id: "00000000-0000-4000-8000-000000000111".to_string(),
                name: "Idle".to_string(),
                color: CustomFaceColor {
                    red: 255,
                    green: 255,
                    blue: 255,
                },
                frames: vec![CustomFaceFrame {
                    duration_ms: 200,
                    packed_pixels: pixels,
                }],
            }],
        }
    }

    fn test_device(device_id: &str) -> DeviceInstance {
        DeviceInstance {
            id: device_id.to_string(),
            label: device_id.to_string(),
            board_id: "seeed-wio-terminal".to_string(),
            device_uid: None,
            transport: DeviceTransportConfig::serial("/dev/tty.usbmodem-test", 115200),
            channels: vec![DeviceChannel::digital_output(
                "pin.d0",
                "D0",
                0,
                ActiveLevel::High,
                ActiveLevel::Low,
            )],
            enabled: true,
        }
    }

    fn bundled_artifact_for_board(
        board_id: &str,
        firmware_version: &str,
        protocol_version: u16,
    ) -> FirmwareArtifact {
        FirmwareArtifact {
            target_id: None,
            board_id: board_id.to_string(),
            firmware_version: firmware_version.to_string(),
            protocol_version,
            visible: true,
            toolchain: None,
            artifact_name: format!("cc-notice-{board_id}.bin"),
            artifact_type: "bin".to_string(),
            flash_strategy: "arduino_cli_upload".to_string(),
            flash_volume_name: String::new(),
            relative_path: format!("{board_id}/cc-notice-{board_id}.bin"),
            upload: None,
        }
    }
}
