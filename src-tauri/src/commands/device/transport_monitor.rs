use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::app_services::device_connection_operation::monitor_recorder;
use crate::app_services::device_runtime_event_service::DEVICE_TRANSPORT_MONITOR_EVENT;
use crate::app_services::device_transport_monitor_service::{
    DeviceTransportMonitorServiceError, DeviceTransportMonitorSessionStart,
};
use crate::core::device::{DeviceConnectionStatus, DeviceTransportConfig};
use crate::core::device_transport_monitor::{
    DeviceTransportMonitorCategory, DeviceTransportMonitorDirection, DeviceTransportMonitorEvent,
    DeviceTransportMonitorSnapshot, DeviceTransportMonitorStatus,
};
use crate::AppState;

const DEVICE_MONITOR_WINDOW_PREFIX: &str = "device-monitor:";
const DEVICE_MONITOR_ROUTE_PREFIX: &str = "/device-monitor?deviceId=";

pub(crate) async fn open_device_transport_monitor_window_impl(
    app: &AppHandle,
    state: &AppState,
    device_id: String,
) -> Result<DeviceTransportMonitorSnapshot, String> {
    let runtime_state = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .state(&device_id)
        .ok_or_else(|| format!("device is not registered: {device_id}"))?;
    if runtime_state.status != DeviceConnectionStatus::Connected {
        return Err("device-monitor-device-not-connected".to_string());
    }

    let board_id = runtime_state.board_id.clone();
    let transport_address = runtime_state.transport.as_ref().and_then(transport_address);
    let session_start = {
        let mut service = state
            .device_transport_monitor_service
            .lock()
            .map_err(|error| error.to_string())?;
        service
            .start_session(&device_id)
            .map_err(|error| match error {
                DeviceTransportMonitorServiceError::TooManySessions => {
                    "device-monitor-too-many-windows".to_string()
                }
            })?
    };

    if let Err(error) = attach_monitor_recorder_to_connected_worker(app, state, &device_id) {
        if let Ok(mut service) = state.device_transport_monitor_service.lock() {
            service.close_session(&device_id);
        }
        return Err(error);
    }

    let app_for_window = app.clone();
    let window_device_id = device_id.clone();
    if let Err(error) = run_device_monitor_window_task("device monitor window", move || {
        open_or_focus_monitor_window(&app_for_window, &window_device_id)
    })
    .await
    {
        if let Ok(mut service) = state.device_transport_monitor_service.lock() {
            service.close_session(&device_id);
        }
        return Err(error);
    }

    if session_start == DeviceTransportMonitorSessionStart::Resumed {
        emit_monitor_session_resumed(app, state, &device_id, board_id, transport_address);
    }

    device_transport_monitor_snapshot_impl(state, device_id)
}

pub(crate) fn device_transport_monitor_snapshot_impl(
    state: &AppState,
    device_id: String,
) -> Result<DeviceTransportMonitorSnapshot, String> {
    Ok(state
        .device_transport_monitor_service
        .lock()
        .map_err(|error| error.to_string())?
        .snapshot(&device_id))
}

pub(crate) fn clear_device_transport_monitor_events_impl(
    state: &AppState,
    device_id: String,
) -> Result<DeviceTransportMonitorSnapshot, String> {
    let mut service = state
        .device_transport_monitor_service
        .lock()
        .map_err(|error| error.to_string())?;
    service.clear_events(&device_id);
    Ok(service.snapshot(&device_id))
}

pub(crate) fn close_device_transport_monitor_session_impl(
    state: &AppState,
    device_id: String,
) -> Result<(), String> {
    state
        .device_transport_monitor_service
        .lock()
        .map_err(|error| error.to_string())?
        .close_session(&device_id);
    Ok(())
}

pub(crate) async fn close_device_transport_monitor_window_impl(
    app: &AppHandle,
    state: &AppState,
    device_id: String,
) -> Result<(), String> {
    close_device_transport_monitor_session_impl(state, device_id.clone())?;

    let label = monitor_window_label(&device_id);
    let app_for_window = app.clone();
    run_device_monitor_window_task("device monitor window close", move || {
        let Some(window) = app_for_window.get_webview_window(&label) else {
            return Ok(());
        };
        window.destroy().map_err(|error| error.to_string())
    })
    .await
}

fn attach_monitor_recorder_to_connected_worker(
    app: &AppHandle,
    state: &AppState,
    device_id: &str,
) -> Result<(), String> {
    let recorder = monitor_recorder(
        Some(std::sync::Arc::clone(
            &state.device_transport_monitor_service,
        )),
        Some(app.clone()),
    );
    state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .update_monitor_recorder(device_id, recorder)
}

fn open_or_focus_monitor_window(app: &AppHandle, device_id: &str) -> Result<(), String> {
    let label = monitor_window_label(device_id);
    if let Some(window) = app.get_webview_window(&label) {
        if let Err(error) = window.show() {
            tracing::warn!(error = %error, device_id, "failed to show device monitor window");
        }
        if let Err(error) = window.set_focus() {
            tracing::warn!(error = %error, device_id, "failed to focus device monitor window");
        }
        return Ok(());
    }

    let route = format!(
        "{DEVICE_MONITOR_ROUTE_PREFIX}{}",
        percent_encode_query_value(device_id)
    );
    WebviewWindowBuilder::new(app, label, WebviewUrl::App(route.into()))
        .title("CC Notice Device Monitor")
        .inner_size(1040.0, 720.0)
        .min_inner_size(860.0, 560.0)
        .build()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn monitor_window_label(device_id: &str) -> String {
    format!(
        "{DEVICE_MONITOR_WINDOW_PREFIX}{}",
        encode_window_label_fragment(device_id)
    )
}

fn encode_window_label_fragment(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("_{byte:02X}")),
        }
    }
    encoded
}

fn percent_encode_query_value(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn emit_monitor_session_resumed(
    app: &AppHandle,
    state: &AppState,
    device_id: &str,
    board_id: Option<String>,
    transport_address: Option<String>,
) {
    let event = DeviceTransportMonitorEvent::new(
        device_id.to_string(),
        board_id,
        DeviceTransportMonitorDirection::System,
        DeviceTransportMonitorCategory::Connection,
        DeviceTransportMonitorStatus::Ok,
    )
    .with_transport("serial", transport_address)
    .with_summary("device monitor session resumed");

    let recorded = match state.device_transport_monitor_service.lock() {
        Ok(mut service) => service.record(event.clone()),
        Err(error) => {
            tracing::warn!(
                device_id,
                error = %error,
                "failed to lock monitor service for resumed event"
            );
            false
        }
    };
    if !recorded {
        return;
    }
    if let Err(error) = app.emit(DEVICE_TRANSPORT_MONITOR_EVENT, event) {
        tracing::warn!(
            device_id,
            error = %error,
            "failed to emit monitor session resumed event"
        );
    }
}

fn transport_address(transport: &DeviceTransportConfig) -> Option<String> {
    transport
        .serial_port
        .clone()
        .or_else(|| transport.path.clone())
        .or_else(|| transport.host.clone())
        .or_else(|| transport.topic.clone())
}

async fn run_device_monitor_window_task<T, F>(
    task_name: &'static str,
    operation: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    // Windows WebView2 在同步 command 线程创建新窗口可能白屏或卡死，窗口操作必须放到独立 worker。
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|error| {
            tracing::warn!(task_name, error = %error, "device monitor window task join failed");
            format!("{task_name} task failed: {error}")
        })?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monitor_window_label_is_stable_for_device_id() {
        assert_eq!(
            "device-monitor:rp2040-pico_3Aabc",
            monitor_window_label("rp2040-pico:abc")
        );
    }

    #[test]
    fn monitor_window_label_encodes_path_separators() {
        assert_eq!(
            "device-monitor:seeed_2Fwio_20terminal",
            monitor_window_label("seeed/wio terminal")
        );
    }

    #[test]
    fn percent_encode_query_value_encodes_reserved_chars() {
        assert_eq!(
            "seeed-wio-terminal%3A0906%2Ftest",
            percent_encode_query_value("seeed-wio-terminal:0906/test")
        );
    }

    #[test]
    fn monitor_window_task_runs_on_blocking_worker() {
        let caller_thread = std::thread::current().id();

        let worker_thread = tauri::async_runtime::block_on(run_device_monitor_window_task(
            "test device monitor window task",
            || Ok(std::thread::current().id()),
        ))
        .expect("device monitor window task should finish");

        assert_ne!(caller_thread, worker_thread);
    }

    #[test]
    fn monitor_window_label_for_close_uses_encoded_device_id() {
        assert_eq!(
            "device-monitor:device_20with_2Fspace",
            monitor_window_label("device with/space")
        );
    }
}
