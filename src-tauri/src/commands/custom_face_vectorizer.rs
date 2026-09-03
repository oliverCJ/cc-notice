use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::app_services::custom_face_vectorizer::{
    vectorize_custom_face_image as vectorize_image, write_vectorized_svg_temp_file,
    CustomFaceVectorizeRequest, CustomFaceVectorizeResult,
};
use crate::infrastructure::app_paths;

pub const CUSTOM_FACE_IMAGE_VECTORIZER_LABEL: &str = "custom-face-image-vectorizer";
pub const CUSTOM_FACE_OPEN_SVG_PATH_EVENT: &str = "cc-notice://custom-face-open-svg-path";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorizedSvgTempFileResult {
    pub path: String,
}

#[tauri::command]
pub async fn open_custom_face_image_vectorizer(app: AppHandle) -> Result<(), String> {
    open_or_focus(&app)
}

#[tauri::command]
pub async fn close_custom_face_image_vectorizer(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(CUSTOM_FACE_IMAGE_VECTORIZER_LABEL) else {
        return Ok(());
    };
    window.destroy().map_err(|error| error.to_string())
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
pub async fn write_custom_face_vectorized_svg_temp_file(
    svg: String,
) -> Result<VectorizedSvgTempFileResult, String> {
    let app_home = app_paths::app_home_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        write_vectorized_svg_temp_file(&app_home, &svg).map(|path| VectorizedSvgTempFileResult {
            path: path.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

fn open_or_focus(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(CUSTOM_FACE_IMAGE_VECTORIZER_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(
        app,
        CUSTOM_FACE_IMAGE_VECTORIZER_LABEL,
        WebviewUrl::App("/custom-face-image-vectorizer".into()),
    )
    .title("CC Notice 图片转 SVG")
    .inner_size(1180.0, 760.0)
    .min_inner_size(900.0, 620.0)
    .build()
    .map_err(|error| error.to_string())?;
    tracing::info!("custom face image vectorizer window opened");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{CUSTOM_FACE_IMAGE_VECTORIZER_LABEL, CUSTOM_FACE_OPEN_SVG_PATH_EVENT};

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
}
