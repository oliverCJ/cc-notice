use tauri::AppHandle;

use crate::core::device::{DeviceCandidateResource, DeviceCommandResult, DeviceRuntimeState};
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;
use crate::startup::tray;
use crate::AppState;

mod candidate_match;
mod channels;
mod connection;
mod defaults;
mod discovery;
mod firmware_lookup;
mod identity;
mod input;
mod reference_validation;
pub mod requests;
mod runtime;
mod transport_monitor;

pub(crate) use channels::{
    send_device_extension_action_impl, send_device_test_action_impl, update_device_channels_impl,
};
#[cfg(test)]
pub(crate) use connection::connect_device_impl;
pub(crate) use connection::{
    auto_connect_registered_devices_impl, cancel_device_operation_impl, check_device_firmware_impl,
    connect_device_with_app_impl, disconnect_device_impl, remove_registered_device_impl,
};
#[cfg(test)]
pub use defaults::DEFAULT_RP2040_DEVICE_ID;
pub(crate) use discovery::{
    identify_device_candidate_impl, register_identified_device_impl, scan_device_candidates_impl,
    scan_device_transports_impl,
};
pub(crate) use identity::reset_device_identity_impl;
pub(crate) use input::{device_input_bindings_impl, save_device_input_bindings_impl};
pub use requests::{
    ConnectDeviceRequest, IdentifyDeviceCandidateRequest, RegisterIdentifiedDeviceRequest,
    SendDeviceExtensionActionRequest, SendDeviceTestActionRequest, UpdateDeviceChannelsRequest,
};
pub(crate) use runtime::{
    device_runtime_state_impl, device_runtime_states_impl, disconnect_all_devices_impl,
    ping_connected_devices_impl,
};
pub(crate) use transport_monitor::{
    clear_device_transport_monitor_events_impl, close_device_transport_monitor_session_impl,
    close_device_transport_monitor_window_impl, device_transport_monitor_snapshot_impl,
    open_device_transport_monitor_window_impl,
};

#[tauri::command]
pub fn device_runtime_states(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DeviceRuntimeState>, String> {
    device_runtime_states_impl(&state)
}

#[tauri::command]
pub fn device_runtime_state(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    device_runtime_state_impl(&state, device_id)
}

#[tauri::command]
pub fn scan_device_transports() -> Result<Vec<DevicePortDescriptor>, String> {
    scan_device_transports_impl()
}

#[tauri::command]
pub fn scan_device_candidates(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DeviceCandidateResource>, String> {
    scan_device_candidates_impl(&state)
}

#[tauri::command]
pub fn identify_device_candidate(
    state: tauri::State<'_, AppState>,
    request: IdentifyDeviceCandidateRequest,
) -> Result<DeviceCandidateResource, String> {
    identify_device_candidate_impl(&state, request)
}

#[tauri::command]
pub fn register_identified_device(
    state: tauri::State<'_, AppState>,
    request: RegisterIdentifiedDeviceRequest,
) -> Result<DeviceRuntimeState, String> {
    register_identified_device_impl(&state, request)
}

#[tauri::command]
pub fn connect_device(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: ConnectDeviceRequest,
) -> Result<DeviceRuntimeState, String> {
    let result = connect_device_with_app_impl(&app, &state, request)?;
    tray::refresh_tray_menu_after_state_change(&app, "device connected");
    Ok(result)
}

#[tauri::command]
pub fn auto_connect_registered_devices(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DeviceRuntimeState>, String> {
    let result = auto_connect_registered_devices_impl(&app, &state)?;
    tray::refresh_tray_menu_after_state_change(&app, "registered devices auto connected");
    Ok(result)
}

#[tauri::command]
pub fn cancel_device_operation(
    state: tauri::State<'_, AppState>,
    device_id: String,
    operation_id: u64,
) -> Result<DeviceRuntimeState, String> {
    cancel_device_operation_impl(&state, device_id, operation_id)
}

#[tauri::command]
pub fn check_device_firmware(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    check_device_firmware_impl(&state, device_id)
}

#[tauri::command]
pub fn disconnect_device(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    let result = disconnect_device_impl(&state, device_id)?;
    tray::refresh_tray_menu_after_state_change(&app, "device disconnected");
    Ok(result)
}

#[tauri::command]
pub fn disconnect_all_devices(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DeviceRuntimeState>, String> {
    let result = disconnect_all_devices_impl(&state)?;
    tray::refresh_tray_menu_after_state_change(&app, "all devices disconnected");
    Ok(result)
}

#[tauri::command]
pub fn remove_registered_device(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<Vec<DeviceRuntimeState>, String> {
    let result = remove_registered_device_impl(&state, device_id)?;
    tray::refresh_tray_menu_after_state_change(&app, "registered device removed");
    Ok(result)
}

#[tauri::command]
pub fn reset_device_identity(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    reset_device_identity_impl(&state, device_id)
}

#[tauri::command]
pub fn ping_connected_devices(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DeviceRuntimeState>, String> {
    ping_connected_devices_impl(&app, &state)
}

#[tauri::command]
pub async fn open_device_transport_monitor_window(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<crate::core::device_transport_monitor::DeviceTransportMonitorSnapshot, String> {
    open_device_transport_monitor_window_impl(&app, &state, device_id).await
}

#[tauri::command]
pub fn device_transport_monitor_snapshot(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<crate::core::device_transport_monitor::DeviceTransportMonitorSnapshot, String> {
    device_transport_monitor_snapshot_impl(&state, device_id)
}

#[tauri::command]
pub fn clear_device_transport_monitor_events(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<crate::core::device_transport_monitor::DeviceTransportMonitorSnapshot, String> {
    clear_device_transport_monitor_events_impl(&state, device_id)
}

#[tauri::command]
pub fn close_device_transport_monitor_session(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<(), String> {
    close_device_transport_monitor_session_impl(&state, device_id)
}

#[tauri::command]
pub async fn close_device_transport_monitor_window(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<(), String> {
    close_device_transport_monitor_window_impl(&app, &state, device_id).await
}

#[tauri::command]
pub fn send_device_test_action(
    state: tauri::State<'_, AppState>,
    request: SendDeviceTestActionRequest,
) -> Result<DeviceCommandResult, String> {
    send_device_test_action_impl(&state, request)
}

#[tauri::command]
pub fn send_device_extension_action(
    state: tauri::State<'_, AppState>,
    request: SendDeviceExtensionActionRequest,
) -> Result<DeviceCommandResult, String> {
    send_device_extension_action_impl(&state, request)
}

#[tauri::command]
pub fn update_device_channels(
    state: tauri::State<'_, AppState>,
    request: UpdateDeviceChannelsRequest,
) -> Result<DeviceRuntimeState, String> {
    update_device_channels_impl(&state, request.device_id, request.channels)
}

#[tauri::command]
pub fn device_input_bindings(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<crate::core::app_config::DeviceInputBinding>, String> {
    device_input_bindings_impl(&state)
}

#[tauri::command]
pub fn save_device_input_bindings(
    state: tauri::State<'_, AppState>,
    bindings: Vec<crate::core::app_config::DeviceInputBinding>,
) -> Result<Vec<crate::core::app_config::DeviceInputBinding>, String> {
    save_device_input_bindings_impl(&state, bindings)
}

#[cfg(test)]
mod tests;
