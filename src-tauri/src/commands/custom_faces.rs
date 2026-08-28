use std::path::PathBuf;

use serde::Deserialize;

use crate::app_services::custom_face_library::{
    CustomFaceGroupSummary, CustomFaceImportMode, CustomFaceImportPreview,
    SaveCustomFaceGroupResult,
};
use crate::core::custom_faces::CustomFaceGroup;
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
