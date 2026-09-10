use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::commands::custom_face_pixelizer::{
    CUSTOM_FACE_IMAGE_PIXELIZER_LABEL, CUSTOM_FACE_IMAGE_PIXELIZER_STATE_EVENT,
};
use crate::commands::custom_face_vectorizer::{
    CUSTOM_FACE_IMAGE_VECTORIZER_LABEL, CUSTOM_FACE_IMAGE_VECTORIZER_STATE_EVENT,
};

pub const CUSTOM_FACE_EDITOR_LABEL: &str = "custom-face-editor";
pub const CUSTOM_FACE_EDITOR_STATE_EVENT: &str = "cc-notice://custom-face-editor-state-changed";

#[tauri::command]
pub async fn open_custom_face_editor(app: AppHandle) -> Result<(), String> {
    open_or_focus(&app)
}

#[tauri::command]
pub async fn focus_custom_face_editor(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(CUSTOM_FACE_EDITOR_LABEL) else {
        return Err("custom-face-editor-not-open".to_string());
    };
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    let _ = crate::commands::custom_face_vectorizer::emit_latest_vectorized_svg_temp_path(&app);
    Ok(())
}

#[tauri::command]
pub async fn close_custom_face_editor(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(CUSTOM_FACE_EDITOR_LABEL) else {
        return Ok(());
    };
    window.destroy().map_err(|error| error.to_string())
}

pub(crate) fn should_prevent_editor_close_for_child_windows(
    image_pixelizer_open: bool,
    image_vectorizer_open: bool,
) -> bool {
    image_pixelizer_open || image_vectorizer_open
}

fn open_or_focus(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(CUSTOM_FACE_EDITOR_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        emit_editor_state(app, true);
        return Ok(());
    }
    let window = WebviewWindowBuilder::new(
        app,
        CUSTOM_FACE_EDITOR_LABEL,
        WebviewUrl::App("/custom-face-editor".into()),
    )
    .title("CC Notice 自定义表情")
    .inner_size(1280.0, 820.0)
    .min_inner_size(980.0, 680.0)
    .build()
    .map_err(|error| error.to_string())?;
    let destroyed_app = app.clone();
    let close_guard_app = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            let image_pixelizer_open = close_guard_app
                .get_webview_window(CUSTOM_FACE_IMAGE_PIXELIZER_LABEL)
                .is_some();
            let image_vectorizer_open = close_guard_app
                .get_webview_window(CUSTOM_FACE_IMAGE_VECTORIZER_LABEL)
                .is_some();
            if should_prevent_editor_close_for_child_windows(
                image_pixelizer_open,
                image_vectorizer_open,
            ) {
                api.prevent_close();
                emit_child_window_state(
                    &close_guard_app,
                    image_pixelizer_open,
                    image_vectorizer_open,
                );
                tracing::warn!(
                    image_pixelizer_open,
                    image_vectorizer_open,
                    "blocked custom face editor close while child window remains open"
                );
            }
        }
        if matches!(event, WindowEvent::Destroyed) {
            emit_editor_state(&destroyed_app, false);
        }
    });
    emit_editor_state(app, true);
    Ok(())
}

fn emit_editor_state(app: &AppHandle, open: bool) {
    if let Err(error) = app.emit(CUSTOM_FACE_EDITOR_STATE_EVENT, open) {
        tracing::warn!(open, %error, "failed to emit custom face editor state");
    }
}

fn emit_child_window_state(
    app: &AppHandle,
    image_pixelizer_open: bool,
    image_vectorizer_open: bool,
) {
    if let Err(error) = app.emit(
        CUSTOM_FACE_IMAGE_PIXELIZER_STATE_EVENT,
        image_pixelizer_open,
    ) {
        tracing::warn!(image_pixelizer_open, %error, "failed to refresh custom face image pixelizer state");
    }
    if let Err(error) = app.emit(
        CUSTOM_FACE_IMAGE_VECTORIZER_STATE_EVENT,
        image_vectorizer_open,
    ) {
        tracing::warn!(image_vectorizer_open, %error, "failed to refresh custom face image vectorizer state");
    }
}

#[cfg(test)]
mod tests {
    use super::{
        should_prevent_editor_close_for_child_windows, CUSTOM_FACE_EDITOR_LABEL,
        CUSTOM_FACE_EDITOR_STATE_EVENT,
    };

    #[test]
    fn editor_window_label_and_route_are_stable() {
        assert_eq!("custom-face-editor", CUSTOM_FACE_EDITOR_LABEL);
        assert_eq!(
            "cc-notice://custom-face-editor-state-changed",
            CUSTOM_FACE_EDITOR_STATE_EVENT
        );
    }

    #[test]
    fn editor_window_capability_allows_core_window_events() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/custom-face-editor.json"))
                .expect("custom face editor capability must be valid JSON");

        assert_eq!(capability["windows"][0], CUSTOM_FACE_EDITOR_LABEL);
        assert!(capability["permissions"]
            .as_array()
            .expect("permissions must be an array")
            .iter()
            .any(|permission| permission == "core:default"));
        assert!(capability["permissions"]
            .as_array()
            .expect("permissions must be an array")
            .iter()
            .any(|permission| permission == "dialog:allow-open"));
        assert!(capability["permissions"]
            .as_array()
            .expect("permissions must be an array")
            .iter()
            .any(|permission| permission == "dialog:allow-save"));
    }

    #[test]
    fn editor_close_is_blocked_while_import_child_window_exists() {
        assert!(should_prevent_editor_close_for_child_windows(true, false));
        assert!(should_prevent_editor_close_for_child_windows(false, true));
        assert!(should_prevent_editor_close_for_child_windows(true, true));
        assert!(!should_prevent_editor_close_for_child_windows(false, false));
    }
}
