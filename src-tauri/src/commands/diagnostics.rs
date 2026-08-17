use crate::app_services::diagnostics_service::{DiagnosticsInput, DiagnosticsService};
use crate::app_services::hook_event_service::HookEventService;
use crate::core::diagnostics::DiagnosticsSnapshot;
use crate::infrastructure::app_paths;
use crate::infrastructure::time_utils::current_local_rfc3339_timestamp;
use crate::AppState;

#[tauri::command]
pub fn diagnostics_snapshot(
    state: tauri::State<'_, AppState>,
) -> Result<DiagnosticsSnapshot, String> {
    diagnostics_snapshot_impl(&state)
}

pub(crate) fn diagnostics_snapshot_impl(state: &AppState) -> Result<DiagnosticsSnapshot, String> {
    let checked_at = current_local_rfc3339_timestamp();
    let hook_status = state
        .local_hook_server_status
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let config = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?
        .config();
    let profile = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?
        .active_profile();
    let home = app_paths::user_home_dir()?;
    let hook_state = HookEventService::state_for_config(&config, &home)?;
    let relay_status = state
        .tool_bin_service
        .lock()
        .map_err(|error| error.to_string())?
        .relay_installation_status();
    let device_states = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .states();
    let runtime_snapshot = state
        .runtime_monitor_service
        .lock()
        .map_err(|error| error.to_string())?
        .snapshot();
    Ok(DiagnosticsService::snapshot(DiagnosticsInput {
        checked_at,
        hook_server_running: hook_status.running,
        hook_server_error: hook_status.error,
        relay_source_exists: relay_status.source_exists,
        relay_installed_exists: relay_status.installed_exists,
        relay_content_matches: relay_status.content_matches,
        hook_targets: hook_state.targets,
        profile,
        device_states,
        runtime_snapshot,
    }))
}

#[cfg(test)]
mod tests {
    use crate::core::diagnostics::DiagnosticActionKind;
    use crate::test_support::{minimal_app_state_for_root, unique_temp_root};

    use super::diagnostics_snapshot_impl;

    #[test]
    fn diagnostics_snapshot_impl_returns_structured_snapshot() {
        let root = unique_temp_root("cc-notice-diagnostics-command");
        let state = minimal_app_state_for_root(&root);

        let snapshot = diagnostics_snapshot_impl(&state).expect("snapshot should build");

        assert!(!snapshot.sections.is_empty());
        assert!(snapshot
            .quick_actions
            .iter()
            .any(|action| action.kind == DiagnosticActionKind::RefreshDiagnostics));
    }
}
