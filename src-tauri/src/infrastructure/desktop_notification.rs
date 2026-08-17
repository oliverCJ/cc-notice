#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DesktopNotificationRequest {
    pub title: String,
    pub body: String,
    pub sound: Option<String>,
}

pub trait DesktopNotificationSender: Send + Sync {
    fn send_notification(&self, request: DesktopNotificationRequest) -> Result<(), String>;
}

#[derive(Debug, Default)]
pub struct NoopDesktopNotificationSender;

impl DesktopNotificationSender for NoopDesktopNotificationSender {
    fn send_notification(&self, request: DesktopNotificationRequest) -> Result<(), String> {
        tracing::info!(
            "desktop notification prepared: title_chars={}, body_chars={}, sound={}",
            request.title.chars().count(),
            request.body.chars().count(),
            request.sound.as_deref().unwrap_or("default")
        );
        Ok(())
    }
}

#[derive(Clone)]
pub struct TauriDesktopNotificationSender {
    app: tauri::AppHandle,
}

impl TauriDesktopNotificationSender {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }
}

impl DesktopNotificationSender for TauriDesktopNotificationSender {
    fn send_notification(&self, request: DesktopNotificationRequest) -> Result<(), String> {
        send_tauri_notification(&self.app, request)
    }
}

fn send_tauri_notification(
    app: &tauri::AppHandle,
    request: DesktopNotificationRequest,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    if let Some(sound) = request
        .sound
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        tracing::info!(
            "desktop notification sound requested: sound={}, handled_by=platform_default",
            sound
        );
    }

    app.notification()
        .builder()
        .title(request.title)
        .body(request.body)
        .show()
        .map_err(|error| format!("failed to send desktop notification: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        DesktopNotificationRequest, DesktopNotificationSender, NoopDesktopNotificationSender,
    };

    #[test]
    fn noop_desktop_notification_sender_accepts_request() {
        let sender = NoopDesktopNotificationSender;

        sender
            .send_notification(DesktopNotificationRequest {
                title: "CC Notice".to_string(),
                body: "agent.completed".to_string(),
                sound: Some("default".to_string()),
            })
            .expect("noop sender should accept notification request");
    }
}
