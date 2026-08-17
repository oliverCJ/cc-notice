use crate::app_services::runtime_monitor::RuntimeMonitorSnapshot;
use crate::AppState;

#[tauri::command]
pub fn runtime_monitor_snapshot(
    state: tauri::State<'_, AppState>,
) -> Result<RuntimeMonitorSnapshot, String> {
    let service = state
        .runtime_monitor_service
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(service.snapshot())
}
