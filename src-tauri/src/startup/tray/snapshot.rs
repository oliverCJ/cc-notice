use super::model::TrayStatusSnapshot;
use crate::app_services::local_hook_server_service::LocalHookServerService;
use crate::startup::app_appearance;
use crate::AppState;

pub(crate) fn tray_status_snapshot(state: &AppState) -> TrayStatusSnapshot {
    let (language, fallback_profile_id) = state
        .app_config_service
        .lock()
        .map(|service| {
            let config = service.config();
            (config.ui.language, config.active_profile_id)
        })
        .unwrap_or_else(|error| {
            tracing::warn!("failed to read app config for tray snapshot: {error}");
            ("zh-CN".to_string(), "unknown".to_string())
        });

    let hook_status = state
        .local_hook_server_status
        .lock()
        .map(|status| status.clone())
        .unwrap_or_else(|error| {
            tracing::warn!("failed to read hook server status for tray snapshot: {error}");
            LocalHookServerService::default_status()
        });

    let connected_device_count = state
        .device_runtime_registry
        .lock()
        .map(|registry| registry.connected_device_count())
        .unwrap_or_else(|error| {
            tracing::warn!("failed to read device registry for tray snapshot: {error}");
            0
        });

    let active_profile_name = state
        .profile_service
        .lock()
        .map(|service| service.active_profile().name)
        .unwrap_or_else(|error| {
            tracing::warn!("failed to read profile service for tray snapshot: {error}");
            fallback_profile_id
        });

    TrayStatusSnapshot {
        language,
        hook_server_running: hook_status.running,
        hook_server_port: hook_status.port,
        connected_device_count,
        active_profile_name,
        appearance_mode: app_appearance::current_mode(),
    }
}
