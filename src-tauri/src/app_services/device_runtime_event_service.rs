use std::collections::BTreeSet;

use serde::Serialize;
use tauri::{Emitter, Runtime};

use crate::app_services::inbound_event_service::SubmitRelayEventResult;
use crate::core::device::{DeviceCommandResult, DeviceInputEvent};

pub const DEVICE_RUNTIME_UPDATED_EVENT: &str = "cc-notice://device-runtime-updated";
pub const DEVICE_INPUT_EVENT: &str = "cc-notice://device-input-event";
pub const DEVICE_TRANSPORT_MONITOR_EVENT: &str = "cc-notice://device-transport-monitor-event";
const HOOK_DEVICE_OUTPUT_REASON: &str = "hook-device-output";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceRuntimeUpdatedPayload {
    pub reason: String,
    pub device_ids: Vec<String>,
}

pub struct DeviceRuntimeEventService;

impl DeviceRuntimeEventService {
    pub fn payload_from_submit_result(
        result: &SubmitRelayEventResult,
    ) -> Option<DeviceRuntimeUpdatedPayload> {
        Self::payload_from_device_results(&result.device_results)
    }

    pub fn payload_from_device_results(
        device_results: &[DeviceCommandResult],
    ) -> Option<DeviceRuntimeUpdatedPayload> {
        let device_ids = device_results
            .iter()
            .map(|result| result.device_id.trim())
            .filter(|device_id| !device_id.is_empty())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();

        if device_ids.is_empty() {
            return None;
        }

        Some(DeviceRuntimeUpdatedPayload {
            reason: HOOK_DEVICE_OUTPUT_REASON.to_string(),
            device_ids,
        })
    }

    pub fn emit_hook_device_output_update<R: Runtime>(
        app: &tauri::AppHandle<R>,
        result: &SubmitRelayEventResult,
    ) -> Result<(), String> {
        let Some(payload) = Self::payload_from_submit_result(result) else {
            return Ok(());
        };

        app.emit(DEVICE_RUNTIME_UPDATED_EVENT, payload)
            .map_err(|error| error.to_string())
    }

    pub fn emit_device_input_event<R: Runtime>(
        app: &tauri::AppHandle<R>,
        event: &DeviceInputEvent,
    ) -> Result<(), String> {
        app.emit(DEVICE_INPUT_EVENT, event)
            .map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn device_result(device_id: &str, channel_id: &str) -> DeviceCommandResult {
        DeviceCommandResult {
            device_id: device_id.to_string(),
            channel_id: channel_id.to_string(),
            output_type: crate::core::device::DeviceCommandOutputType::DeviceChannel,
            status: "sent".to_string(),
            ack: Some(r#"{"ok":true}"#.to_string()),
            error_code: None,
            error: None,
        }
    }

    #[test]
    fn payload_from_device_results_deduplicates_device_ids() {
        let payload = DeviceRuntimeEventService::payload_from_device_results(&[
            device_result("desk-pico", "pin.gp2"),
            device_result("desk-pico", "pin.gp3"),
            device_result("lab-pico", "pin.gp2"),
        ])
        .expect("device results should produce payload");

        assert_eq!("hook-device-output", payload.reason);
        assert_eq!(vec!["desk-pico", "lab-pico"], payload.device_ids);
    }

    #[test]
    fn payload_from_device_results_ignores_empty_results() {
        let payload = DeviceRuntimeEventService::payload_from_device_results(&[]);

        assert_eq!(None, payload);
    }
}
