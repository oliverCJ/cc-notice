use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::app_services::custom_face_pixelizer::{
    pixelize_custom_face_image as pixelize_image, CustomFacePixelizeRequest,
    CustomFacePixelizeResult, CustomFacePixelizeSourceRequest,
    PrepareCustomFacePixelizerSourceRequest, PrepareCustomFacePixelizerSourceResult,
};
use crate::infrastructure::app_paths;
use crate::AppState;

pub const CUSTOM_FACE_IMAGE_PIXELIZER_LABEL: &str = "custom-face-image-pixelizer";
pub const CUSTOM_FACE_IMAGE_IMPORT_READY_EVENT: &str = "cc-notice://custom-face-image-import-ready";
pub const CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT: &str =
    "cc-notice://custom-face-image-pixelizer-open-request";
pub const CUSTOM_FACE_IMAGE_PIXELIZER_STATE_EVENT: &str =
    "cc-notice://custom-face-image-pixelizer-state-changed";
pub const CUSTOM_FACE_IMAGE_PIXELIZER_INNER_SIZE: (f64, f64) = (1920.0, 1080.0);
pub const CUSTOM_FACE_IMAGE_PIXELIZER_MIN_INNER_SIZE: (f64, f64) = (1440.0, 900.0);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceImageImportReadyPayload {
    pub packed_pixels: Vec<u8>,
    pub source_width: u32,
    pub source_height: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCustomFaceImagePixelizerRequest {
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn open_custom_face_image_pixelizer(
    app: AppHandle,
    request: OpenCustomFaceImagePixelizerRequest,
) -> Result<(), String> {
    open_or_focus(&app, request)
}

#[tauri::command]
pub async fn close_custom_face_image_pixelizer(app: AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppState>() {
        state.custom_face_pixelizer_source_store.clear();
    }
    let Some(window) = app.get_webview_window(CUSTOM_FACE_IMAGE_PIXELIZER_LABEL) else {
        return Ok(());
    };
    window.destroy().map_err(|error| error.to_string())?;
    emit_pixelizer_state(&app, false);
    Ok(())
}

#[tauri::command]
pub async fn prepare_custom_face_image_pixelizer_source(
    state: State<'_, AppState>,
    request: PrepareCustomFacePixelizerSourceRequest,
) -> Result<PrepareCustomFacePixelizerSourceResult, String> {
    let source_store = state.custom_face_pixelizer_source_store.clone();
    tauri::async_runtime::spawn_blocking(move || source_store.prepare_source(request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn pixelize_custom_face_image_source(
    state: State<'_, AppState>,
    request: CustomFacePixelizeSourceRequest,
) -> Result<CustomFacePixelizeResult, String> {
    let source_store = state.custom_face_pixelizer_source_store.clone();
    tauri::async_runtime::spawn_blocking(move || source_store.pixelize_source(request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn release_custom_face_image_pixelizer_source(
    state: State<'_, AppState>,
    source_id: String,
) -> Result<bool, String> {
    Ok(state
        .custom_face_pixelizer_source_store
        .release_source(&source_id))
}

#[tauri::command]
pub async fn pixelize_custom_face_image(
    request: CustomFacePixelizeRequest,
) -> Result<CustomFacePixelizeResult, String> {
    let app_home = app_paths::app_home_dir()?;
    tauri::async_runtime::spawn_blocking(move || pixelize_image(&app_home, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn apply_custom_face_image_import(
    app: AppHandle,
    payload: CustomFaceImageImportReadyPayload,
) -> Result<(), String> {
    if app.get_webview_window("custom-face-editor").is_none() {
        return Err("custom-face-editor-not-open".to_string());
    }
    app.emit(CUSTOM_FACE_IMAGE_IMPORT_READY_EVENT, payload)
        .map_err(|error| error.to_string())
}

fn open_or_focus(
    app: &AppHandle,
    request: OpenCustomFaceImagePixelizerRequest,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(CUSTOM_FACE_IMAGE_PIXELIZER_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        app.emit_to(
            CUSTOM_FACE_IMAGE_PIXELIZER_LABEL,
            CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT,
            request,
        )
        .map_err(|error| error.to_string())?;
        emit_pixelizer_state(app, true);
        return Ok(());
    }
    let url = format!(
        "/custom-face-image-pixelizer?width={}&height={}",
        request.width, request.height
    );
    let window = WebviewWindowBuilder::new(
        app,
        CUSTOM_FACE_IMAGE_PIXELIZER_LABEL,
        WebviewUrl::App(url.into()),
    )
    .title("CC Notice 图片导入")
    .inner_size(
        CUSTOM_FACE_IMAGE_PIXELIZER_INNER_SIZE.0,
        CUSTOM_FACE_IMAGE_PIXELIZER_INNER_SIZE.1,
    )
    .min_inner_size(
        CUSTOM_FACE_IMAGE_PIXELIZER_MIN_INNER_SIZE.0,
        CUSTOM_FACE_IMAGE_PIXELIZER_MIN_INNER_SIZE.1,
    )
    .build()
    .map_err(|error| error.to_string())?;
    let destroyed_app = app.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            emit_pixelizer_state(&destroyed_app, false);
        }
    });
    emit_pixelizer_state(app, true);
    tracing::info!("custom face image pixelizer window opened");
    Ok(())
}

fn emit_pixelizer_state(app: &AppHandle, open: bool) {
    if let Err(error) = app.emit(CUSTOM_FACE_IMAGE_PIXELIZER_STATE_EVENT, open) {
        tracing::warn!(open, %error, "failed to emit custom face image pixelizer state");
    }
}

#[cfg(test)]
mod tests {
    use super::{
        CUSTOM_FACE_IMAGE_IMPORT_READY_EVENT, CUSTOM_FACE_IMAGE_PIXELIZER_INNER_SIZE,
        CUSTOM_FACE_IMAGE_PIXELIZER_LABEL, CUSTOM_FACE_IMAGE_PIXELIZER_MIN_INNER_SIZE,
        CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT, CUSTOM_FACE_IMAGE_PIXELIZER_STATE_EVENT,
    };

    #[test]
    fn pixelizer_window_label_and_event_are_stable() {
        assert_eq!(
            "custom-face-image-pixelizer",
            CUSTOM_FACE_IMAGE_PIXELIZER_LABEL
        );
        assert_eq!(
            "cc-notice://custom-face-image-import-ready",
            CUSTOM_FACE_IMAGE_IMPORT_READY_EVENT
        );
        assert_eq!(
            "cc-notice://custom-face-image-pixelizer-open-request",
            CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT
        );
        assert_eq!(
            "cc-notice://custom-face-image-pixelizer-state-changed",
            CUSTOM_FACE_IMAGE_PIXELIZER_STATE_EVENT
        );
    }

    #[test]
    fn pixelizer_capability_allows_required_window_permissions() {
        let capability: serde_json::Value = serde_json::from_str(include_str!(
            "../../capabilities/custom-face-image-pixelizer.json"
        ))
        .expect("custom face image pixelizer capability must be valid JSON");
        let permissions = capability["permissions"]
            .as_array()
            .expect("permissions must be an array");

        assert_eq!(capability["windows"][0], CUSTOM_FACE_IMAGE_PIXELIZER_LABEL);
        assert!(permissions.contains(&serde_json::json!("core:default")));
        assert!(permissions.contains(&serde_json::json!("dialog:allow-open")));
    }

    #[test]
    fn pixelizer_window_size_defaults_leave_room_for_text_tools() {
        assert_eq!((1920.0, 1080.0), CUSTOM_FACE_IMAGE_PIXELIZER_INNER_SIZE);
        assert_eq!((1440.0, 900.0), CUSTOM_FACE_IMAGE_PIXELIZER_MIN_INNER_SIZE);
    }
}
