use crate::app_services::device_runtime_event_service::DeviceRuntimeEventService;
use crate::app_services::inbound_event_service::{
    DebugLogEntry, InboundEventOrigin, SoftwareNoticeState, SubmitRelayEventRequest,
    SubmitRelayEventResult,
};
use crate::app_services::local_hook_server_service::LocalHookServerStatus;
use crate::app_services::relay_event_pipeline_service::RelayEventPipelineService;
use crate::{infrastructure, AppState};

#[tauri::command]
pub fn health_check() -> &'static str {
    tracing::info!("health_check command invoked");
    "ok"
}

#[tauri::command]
pub fn development_log_dir(project_root: String) -> String {
    let path = infrastructure::logging::development_log_dir(std::path::Path::new(&project_root));
    path.to_string_lossy().to_string()
}

#[tauri::command]
pub fn submit_relay_event(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: SubmitRelayEventRequest,
) -> Result<SubmitRelayEventResult, String> {
    let mut service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    let envelope = request.with_origin(InboundEventOrigin::DebugTest);
    let mut executor = state
        .output_executor
        .lock()
        .map_err(|error| error.to_string())?;
    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    let result = RelayEventPipelineService::submit(
        &mut service,
        &mut *executor,
        &mut registry,
        None,
        envelope,
    )?;
    if let Err(error) = DeviceRuntimeEventService::emit_hook_device_output_update(&app, &result) {
        tracing::warn!("failed to emit device runtime update after debug event: {error}");
    }

    Ok(result)
}

#[tauri::command]
pub fn debug_log_entries(state: tauri::State<'_, AppState>) -> Result<Vec<DebugLogEntry>, String> {
    let service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(service.debug_log_entries().to_vec())
}

#[tauri::command]
pub fn clear_debug_log(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    service.clear_debug_log();
    Ok(())
}

#[tauri::command]
pub fn software_notice_state(
    state: tauri::State<'_, AppState>,
) -> Result<SoftwareNoticeState, String> {
    let service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(service.software_notice_state())
}

#[tauri::command]
pub fn local_hook_server_status(
    state: tauri::State<'_, AppState>,
) -> Result<LocalHookServerStatus, String> {
    let status = state
        .local_hook_server_status
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(status.clone())
}

#[cfg(test)]
mod tests {
    use super::development_log_dir;

    #[test]
    fn development_log_dir_command_returns_user_log_dir() {
        let dir = development_log_dir("/workspace/cc_notice".to_string());

        assert!(dir.ends_with(".cc-notice/logs"));
    }
}
