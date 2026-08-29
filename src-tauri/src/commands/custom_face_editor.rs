use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

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
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn close_custom_face_editor(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(CUSTOM_FACE_EDITOR_LABEL) else {
        return Ok(());
    };
    window.destroy().map_err(|error| error.to_string())
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
    window.on_window_event(move |event| {
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

#[cfg(test)]
mod tests {
    use super::{CUSTOM_FACE_EDITOR_LABEL, CUSTOM_FACE_EDITOR_STATE_EVENT};

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
}
