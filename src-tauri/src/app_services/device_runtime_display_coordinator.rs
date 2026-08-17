use crate::adapters::boards::BoardCatalogRegistry;
use crate::app_services::runtime_monitor::RuntimeMonitorSnapshot;
use crate::core::device::{
    DeviceConnectionStatus, DeviceDisplayCapabilities, DeviceDisplaySizeClass,
    DeviceExtensionAction, DeviceExtensionActionType, DeviceRuntimeState,
};

pub struct DeviceRuntimeDisplayCoordinator;

impl DeviceRuntimeDisplayCoordinator {
    pub fn runtime_actions(
        snapshot: &RuntimeMonitorSnapshot,
        states: &[DeviceRuntimeState],
    ) -> Vec<DeviceExtensionAction> {
        states
            .iter()
            .filter(|state| state.status == DeviceConnectionStatus::Connected)
            .filter_map(|state| {
                let display = runtime_display_capabilities(state.board_id.as_deref()?)?;
                Some(DeviceExtensionAction {
                    device_id: state.device_id.clone()?,
                    channel_id: None,
                    action: DeviceExtensionActionType::DisplayRuntime,
                    status: Some(runtime_status(snapshot).to_string()),
                    title: Some(runtime_title(snapshot).to_string()),
                    message: Some(runtime_message(snapshot, &display)),
                    icon: None,
                    lines: Some(runtime_lines(snapshot)),
                    pattern: None,
                    control: None,
                    active: None,
                })
            })
            .collect()
    }
}

fn runtime_display_capabilities(board_id: &str) -> Option<DeviceDisplayCapabilities> {
    BoardCatalogRegistry::bundled()
        .ok()
        .and_then(|registry| {
            registry
                .board(board_id)
                .and_then(|board| board.device_extensions()?.display.clone())
        })
        .filter(|display| display.runtime)
}

fn runtime_status(snapshot: &RuntimeMonitorSnapshot) -> &'static str {
    if latest_runtime_result(snapshot) == Some("error") {
        return "error";
    }
    match snapshot
        .last_event
        .as_ref()
        .and_then(|event| event.internal_event.as_deref())
        .unwrap_or_default()
    {
        "agent.running" | "agent.working" | "agent.started" => "working",
        "permission.required" | "notification" => "notice",
        "agent.failed" => "error",
        "agent.completed" => "success",
        _ if snapshot.total_events == 0 && snapshot.total_outputs == 0 => "idle",
        _ => "success",
    }
}

fn latest_runtime_result(snapshot: &RuntimeMonitorSnapshot) -> Option<&str> {
    match (&snapshot.last_event, &snapshot.last_output) {
        (Some(event), Some(output)) => {
            if event.occurred_at >= output.occurred_at {
                Some(event.result.as_str())
            } else {
                Some(output.result.as_str())
            }
        }
        (Some(event), None) => Some(event.result.as_str()),
        (None, Some(output)) => Some(output.result.as_str()),
        (None, None) => None,
    }
}

fn runtime_title(snapshot: &RuntimeMonitorSnapshot) -> &'static str {
    match runtime_status(snapshot) {
        "working" => "Working",
        "error" => "Error",
        "notice" => "Notice",
        "success" => "Ready",
        _ => "Ready",
    }
}

fn runtime_message(
    snapshot: &RuntimeMonitorSnapshot,
    display: &DeviceDisplayCapabilities,
) -> String {
    if display.size_class == DeviceDisplaySizeClass::Compact {
        return format!("E/O {}/{}", snapshot.total_events, snapshot.total_outputs);
    }

    format!(
        "Events {} / Outputs {}",
        snapshot.total_events, snapshot.total_outputs
    )
}

fn runtime_lines(snapshot: &RuntimeMonitorSnapshot) -> Vec<String> {
    vec![
        last_event_line(snapshot),
        format!(
            "OK {} / Errors {}",
            success_count(snapshot),
            snapshot.runtime_error_count
        ),
    ]
}

fn last_event_line(snapshot: &RuntimeMonitorSnapshot) -> String {
    snapshot
        .last_event
        .as_ref()
        .map(|event| {
            truncate_ascii_display_line(&format!("Last {} {}", event.source, event.event), 24)
        })
        .unwrap_or_else(|| "Last none".to_string())
}

fn success_count(snapshot: &RuntimeMonitorSnapshot) -> u64 {
    snapshot
        .events_by_result
        .iter()
        .find(|item| item.key == "success")
        .map(|item| item.count)
        .unwrap_or(0)
}

fn truncate_ascii_display_line(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii() && !character.is_ascii_control() {
                character
            } else {
                '?'
            }
        })
        .take(max_chars)
        .collect()
}

#[cfg(test)]
#[path = "device_runtime_display_coordinator_tests.rs"]
mod tests;
