use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::app_services::custom_face_vectorizer::{
    vectorize_custom_face_image as vectorize_image, write_vectorized_svg_temp_file,
    CustomFaceVectorizeRequest, CustomFaceVectorizeResult, CustomFaceVectorizeSourceRequest,
    PrepareCustomFaceVectorizerSourceRequest,
};
use crate::infrastructure::app_paths;
use crate::AppState;

pub const CUSTOM_FACE_IMAGE_VECTORIZER_LABEL: &str = "custom-face-image-vectorizer";
pub const CUSTOM_FACE_OPEN_SVG_PATH_EVENT: &str = "cc-notice://custom-face-open-svg-path";
pub const CUSTOM_FACE_IMAGE_VECTORIZER_OPEN_REQUEST_EVENT: &str =
    "cc-notice://custom-face-image-vectorizer-open-request";
pub const CUSTOM_FACE_IMAGE_VECTORIZER_STATE_EVENT: &str =
    "cc-notice://custom-face-image-vectorizer-state-changed";

static LAST_VECTORIZED_SVG_TEMP_PATH: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

#[derive(Clone, Debug, serde::Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCustomFaceImageVectorizerRequest {
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorizedSvgTempFileResult {
    pub path: String,
}

#[tauri::command]
pub async fn open_custom_face_image_vectorizer(
    app: AppHandle,
    request: OpenCustomFaceImageVectorizerRequest,
) -> Result<(), String> {
    open_or_focus(&app, request)
}

#[tauri::command]
pub async fn close_custom_face_image_vectorizer(app: AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppState>() {
        state.custom_face_vectorizer_source_store.clear();
    }
    let Some(window) = app.get_webview_window(CUSTOM_FACE_IMAGE_VECTORIZER_LABEL) else {
        return Ok(());
    };
    window.destroy().map_err(|error| error.to_string())?;
    emit_vectorizer_state(&app, false);
    Ok(())
}

#[tauri::command]
pub async fn vectorize_custom_face_image(
    request: CustomFaceVectorizeRequest,
) -> Result<CustomFaceVectorizeResult, String> {
    let app_home = app_paths::app_home_dir()?;
    tauri::async_runtime::spawn_blocking(move || vectorize_image(&app_home, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn prepare_custom_face_image_vectorizer_source(
    state: State<'_, AppState>,
    request: PrepareCustomFaceVectorizerSourceRequest,
) -> Result<
    crate::app_services::custom_face_vectorizer::PrepareCustomFaceVectorizerSourceResult,
    String,
> {
    let store = state.custom_face_vectorizer_source_store.clone();
    let app_home = app_paths::app_home_dir()?;
    tauri::async_runtime::spawn_blocking(move || store.prepare_source(&app_home, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn vectorize_custom_face_image_vectorizer_source(
    state: State<'_, AppState>,
    request: CustomFaceVectorizeSourceRequest,
) -> Result<CustomFaceVectorizeResult, String> {
    let store = state.custom_face_vectorizer_source_store.clone();
    let app_home = app_paths::app_home_dir()?;
    tauri::async_runtime::spawn_blocking(move || store.vectorize_source(&app_home, request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn release_custom_face_image_vectorizer_source(
    state: State<'_, AppState>,
    source_id: String,
) -> Result<bool, String> {
    Ok(state
        .custom_face_vectorizer_source_store
        .release_source(&source_id))
}

#[tauri::command]
pub async fn write_custom_face_vectorized_svg_temp_file(
    app: AppHandle,
    svg: String,
) -> Result<VectorizedSvgTempFileResult, String> {
    if app.get_webview_window("custom-face-editor").is_none() {
        return Err("custom-face-editor-not-open".to_string());
    }
    let app_home = app_paths::app_home_dir()?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        write_vectorized_svg_temp_file(&app_home, &svg).map(|path| VectorizedSvgTempFileResult {
            path: path.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|error| error.to_string())??;
    remember_latest_vectorized_svg_temp_path(PathBuf::from(&result.path));
    Ok(result)
}

#[tauri::command]
pub async fn emit_custom_face_open_svg_path_event(
    app: AppHandle,
    path: String,
) -> Result<bool, String> {
    app.emit(CUSTOM_FACE_OPEN_SVG_PATH_EVENT, path)
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn take_latest_vectorized_svg_temp_file_path() -> Result<Option<String>, String> {
    Ok(consume_latest_vectorized_svg_temp_path().map(|path| path.to_string_lossy().to_string()))
}

fn open_or_focus(
    app: &AppHandle,
    request: OpenCustomFaceImageVectorizerRequest,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(CUSTOM_FACE_IMAGE_VECTORIZER_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        app.emit_to(
            CUSTOM_FACE_IMAGE_VECTORIZER_LABEL,
            CUSTOM_FACE_IMAGE_VECTORIZER_OPEN_REQUEST_EVENT,
            &request,
        )
        .map_err(|error| error.to_string())?;
        emit_vectorizer_state(app, true);
        return Ok(());
    }
    let url = format!(
        "/custom-face-image-vectorizer?width={}&height={}",
        request.width, request.height
    );
    let window = WebviewWindowBuilder::new(
        app,
        CUSTOM_FACE_IMAGE_VECTORIZER_LABEL,
        WebviewUrl::App(url.into()),
    )
    .title("CC Notice 图片转 SVG")
    .inner_size(1920.0, 1080.0)
    .min_inner_size(1440.0, 900.0)
    .build()
    .map_err(|error| error.to_string())?;
    let destroyed_app = app.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            emit_vectorizer_state(&destroyed_app, false);
        }
    });
    emit_vectorizer_state(app, true);
    tracing::info!("custom face image vectorizer window opened");
    Ok(())
}

pub(crate) fn emit_latest_vectorized_svg_temp_path(app: &AppHandle) -> Result<bool, String> {
    let path = peek_latest_vectorized_svg_temp_path();
    let Some(path) = path else {
        return Ok(false);
    };
    app.emit_to(
        crate::commands::custom_face_editor::CUSTOM_FACE_EDITOR_LABEL,
        CUSTOM_FACE_OPEN_SVG_PATH_EVENT,
        path.to_string_lossy().to_string(),
    )
    .map_err(|error| error.to_string())?;
    Ok(true)
}

fn remember_latest_vectorized_svg_temp_path(path: PathBuf) {
    let store = LAST_VECTORIZED_SVG_TEMP_PATH.get_or_init(|| Mutex::new(None));
    match store.lock() {
        Ok(mut slot) => {
            *slot = Some(path);
        }
        Err(error) => {
            tracing::warn!(%error, "failed to remember vectorized svg temp path");
        }
    }
}

fn consume_latest_vectorized_svg_temp_path() -> Option<PathBuf> {
    let store = LAST_VECTORIZED_SVG_TEMP_PATH.get_or_init(|| Mutex::new(None));
    match store.lock() {
        Ok(mut slot) => slot.take(),
        Err(error) => {
            tracing::warn!(%error, "failed to read vectorized svg temp path");
            None
        }
    }
}

fn peek_latest_vectorized_svg_temp_path() -> Option<PathBuf> {
    let store = LAST_VECTORIZED_SVG_TEMP_PATH.get_or_init(|| Mutex::new(None));
    match store.lock() {
        Ok(slot) => slot.clone(),
        Err(error) => {
            tracing::warn!(%error, "failed to peek vectorized svg temp path");
            None
        }
    }
}

fn emit_vectorizer_state(app: &AppHandle, open: bool) {
    if let Err(error) = app.emit(CUSTOM_FACE_IMAGE_VECTORIZER_STATE_EVENT, open) {
        tracing::warn!(open, %error, "failed to emit custom face image vectorizer state");
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{
        consume_latest_vectorized_svg_temp_path, remember_latest_vectorized_svg_temp_path,
        CUSTOM_FACE_IMAGE_VECTORIZER_LABEL, CUSTOM_FACE_IMAGE_VECTORIZER_OPEN_REQUEST_EVENT,
        CUSTOM_FACE_IMAGE_VECTORIZER_STATE_EVENT, CUSTOM_FACE_OPEN_SVG_PATH_EVENT,
    };

    #[test]
    fn vectorizer_window_label_and_event_are_stable() {
        assert_eq!(
            "custom-face-image-vectorizer",
            CUSTOM_FACE_IMAGE_VECTORIZER_LABEL
        );
        assert_eq!(
            "cc-notice://custom-face-open-svg-path",
            CUSTOM_FACE_OPEN_SVG_PATH_EVENT
        );
        assert_eq!(
            "cc-notice://custom-face-image-vectorizer-open-request",
            CUSTOM_FACE_IMAGE_VECTORIZER_OPEN_REQUEST_EVENT
        );
        assert_eq!(
            "cc-notice://custom-face-image-vectorizer-state-changed",
            CUSTOM_FACE_IMAGE_VECTORIZER_STATE_EVENT
        );
    }

    #[test]
    fn vectorizer_capability_allows_required_window_permissions() {
        let capability: serde_json::Value = serde_json::from_str(include_str!(
            "../../capabilities/custom-face-image-vectorizer.json"
        ))
        .expect("custom face image vectorizer capability must be valid JSON");
        let permissions = capability["permissions"]
            .as_array()
            .expect("permissions must be an array");

        assert_eq!(capability["windows"][0], CUSTOM_FACE_IMAGE_VECTORIZER_LABEL);
        assert!(permissions.contains(&serde_json::json!("core:default")));
        assert!(permissions.contains(&serde_json::json!("dialog:allow-open")));
        assert!(permissions.contains(&serde_json::json!("dialog:allow-save")));
    }

    #[test]
    fn pending_vectorized_svg_path_is_consumed_once() {
        let path = PathBuf::from("/private/tmp/vectorized.svg");
        remember_latest_vectorized_svg_temp_path(path.clone());
        assert_eq!(consume_latest_vectorized_svg_temp_path(), Some(path));
        assert_eq!(consume_latest_vectorized_svg_temp_path(), None);
    }
}
