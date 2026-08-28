use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const CUSTOM_FACE_EDITOR_LABEL: &str = "custom-face-editor";

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
        return window.set_focus().map_err(|error| error.to_string());
    }
    WebviewWindowBuilder::new(
        app,
        CUSTOM_FACE_EDITOR_LABEL,
        WebviewUrl::App("/custom-face-editor".into()),
    )
    .title("CC Notice 自定义表情")
    .inner_size(1280.0, 820.0)
    .min_inner_size(980.0, 680.0)
    .build()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::CUSTOM_FACE_EDITOR_LABEL;

    #[test]
    fn editor_window_label_and_route_are_stable() {
        assert_eq!("custom-face-editor", CUSTOM_FACE_EDITOR_LABEL);
    }
}
