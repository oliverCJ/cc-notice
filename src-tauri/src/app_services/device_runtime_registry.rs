use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{Arc, Mutex};

use crate::app_services::device_input_service::DeviceInputService;
use crate::app_services::device_io_worker::DeviceTransportMonitorRecorder;
use crate::app_services::device_io_worker::{DeviceIoCommandResult, DeviceIoError};
use crate::app_services::device_runtime_event_service::DeviceRuntimeEventService;
use crate::app_services::device_runtime_service::{
    DeviceInputEventCallback, DeviceRuntimeService, PreparedDeviceCommand, PreparedDeviceInfoQuery,
};
use crate::core::device::{
    DeviceChannel, DeviceChannelAction, DeviceCommandOutputType, DeviceCommandResult,
    DeviceConnectionStatus, DeviceExtensionAction, DeviceExtensionActionType, DeviceInstance,
    DeviceOperationKind, DeviceOperationSummary, DeviceRuntimeErrorCode, DeviceRuntimeState,
    DeviceTransportConfig,
};
use crate::core::firmware::FirmwareArtifact;
use crate::infrastructure::transports::transport::DeviceTransport;

pub struct DeviceRuntimeRegistry {
    services: BTreeMap<String, DeviceRuntimeService>,
    device_input_service: Arc<Mutex<DeviceInputService>>,
}

impl DeviceRuntimeRegistry {
    pub fn new(devices: Vec<DeviceInstance>) -> Self {
        Self::with_device_input_service(
            devices,
            Arc::new(Mutex::new(DeviceInputService::new(Vec::new()))),
        )
    }

    pub fn with_device_input_service(
        devices: Vec<DeviceInstance>,
        device_input_service: Arc<Mutex<DeviceInputService>>,
    ) -> Self {
        Self {
            services: devices
                .into_iter()
                .map(|device| (device.id.clone(), DeviceRuntimeService::new(device)))
                .collect(),
            device_input_service,
        }
    }

    pub fn register_device(&mut self, device: DeviceInstance) {
        self.services
            .insert(device.id.clone(), DeviceRuntimeService::new(device));
    }

    pub fn register_device_if_absent(&mut self, device: DeviceInstance) {
        self.services
            .entry(device.id.clone())
            .or_insert_with(|| DeviceRuntimeService::new(device));
    }

    pub fn remove_device(&mut self, device_id: &str) -> Result<(), String> {
        match self.services.remove(device_id) {
            Some(mut service) => {
                service.disconnect();
                Ok(())
            }
            None => Err(format!("device is not registered: {device_id}")),
        }
    }

    pub fn replace_devices(&mut self, devices: Vec<DeviceInstance>) {
        self.services = devices
            .into_iter()
            .map(|device| (device.id.clone(), DeviceRuntimeService::new(device)))
            .collect();
    }

    pub fn replace_device_channels(
        &mut self,
        device_id: &str,
        channels: Vec<DeviceChannel>,
    ) -> Result<(), String> {
        match self.services.get_mut(device_id) {
            Some(service) => {
                service.replace_channels(channels);
                Ok(())
            }
            None => Err(format!("device is not registered: {device_id}")),
        }
    }

    pub fn prepare_gpio_input_config_commands(
        &self,
        device_id: &str,
        disabled_channel_ids: &[String],
    ) -> Result<Vec<PreparedDeviceCommand>, String> {
        match self.services.get(device_id) {
            Some(service) => Ok(service.prepare_gpio_input_config_commands(disabled_channel_ids)),
            None => Err(format!("device is not registered: {device_id}")),
        }
    }

    pub fn complete_gpio_input_config_command(
        &mut self,
        device_id: &str,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> Result<(), String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.complete_gpio_input_config_command(session_id, result)
    }

    pub fn begin_operation(
        &mut self,
        device_id: &str,
        kind: DeviceOperationKind,
        deadline_ms: u64,
        cancellable: bool,
    ) -> Result<DeviceOperationSummary, String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.begin_operation(kind, deadline_ms, cancellable)
    }

    pub fn replace_runtime_transport(
        &mut self,
        device_id: &str,
        transport: DeviceTransportConfig,
    ) -> Result<(), String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.replace_runtime_transport(transport);
        Ok(())
    }

    pub fn cancel_operation(
        &mut self,
        device_id: &str,
        operation_id: u64,
    ) -> Result<DeviceRuntimeState, String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.cancel_operation(operation_id)?;
        Ok(service.state())
    }

    pub fn clear_operation_if_current(&mut self, device_id: &str, operation_id: u64) -> bool {
        self.services
            .get_mut(device_id)
            .map(|service| service.clear_operation(operation_id))
            .unwrap_or(false)
    }

    pub fn operation_matches(&self, device_id: &str, operation_id: u64) -> bool {
        self.services
            .get(device_id)
            .map(|service| service.operation_matches(operation_id))
            .unwrap_or(false)
    }

    pub fn auto_reconnect_blocked_device_ids(&mut self) -> HashSet<String> {
        self.services
            .values_mut()
            .filter_map(|service| {
                service
                    .auto_reconnect_blocked()
                    .then(|| service.device_id().to_string())
            })
            .collect()
    }

    pub fn complete_connect_operation(
        &mut self,
        device_id: &str,
        operation_id: u64,
        transport_config: DeviceTransportConfig,
        transport: Box<dyn DeviceTransport>,
        state_patch: DeviceRuntimeState,
        input_callback: Option<DeviceInputEventCallback>,
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    ) -> Result<DeviceRuntimeState, String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.complete_connect_operation(
            operation_id,
            transport_config,
            transport,
            state_patch,
            input_callback,
            monitor_recorder,
        )?;
        Ok(service.state())
    }

    pub fn fail_operation_if_current(
        &mut self,
        device_id: &str,
        operation_id: u64,
        error: String,
    ) -> Result<DeviceRuntimeState, String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.fail_operation_if_current(operation_id, error)?;
        Ok(service.state())
    }

    pub fn connect_with_transport(
        &mut self,
        device_id: &str,
        transport: Box<dyn DeviceTransport>,
    ) -> Result<(), String> {
        match self.services.get_mut(device_id) {
            Some(service) => {
                service.connect_with_transport(transport);
                Ok(())
            }
            None => Err(format!("device is not registered: {device_id}")),
        }
    }

    pub fn connect_with_transport_config(
        &mut self,
        device_id: &str,
        transport_config: DeviceTransportConfig,
        transport: Box<dyn DeviceTransport>,
    ) -> Result<(), String> {
        match self.services.get_mut(device_id) {
            Some(service) => {
                service.connect_with_transport_config(transport_config, transport);
                Ok(())
            }
            None => Err(format!("device is not registered: {device_id}")),
        }
    }

    pub fn update_monitor_recorder(
        &mut self,
        device_id: &str,
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    ) -> Result<(), String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.update_monitor_recorder(monitor_recorder)
    }

    pub fn disconnect(&mut self, device_id: &str) {
        if let Some(service) = self.services.get_mut(device_id) {
            service.disconnect();
        }
    }

    pub fn disconnect_manually(&mut self, device_id: &str) -> Result<(), String> {
        match self.services.get_mut(device_id) {
            Some(service) => {
                service.disconnect_with_reconnect_suppression(true);
                Ok(())
            }
            None => Err(format!("device is not registered: {device_id}")),
        }
    }

    pub fn disconnect_all(&mut self) {
        for service in self.services.values_mut() {
            service.disconnect();
        }
    }

    pub fn disconnect_all_manually(&mut self) {
        for service in self.services.values_mut() {
            service.disconnect_with_reconnect_suppression(true);
        }
    }

    pub fn registered_devices(&self) -> Vec<DeviceInstance> {
        self.services
            .values()
            .map(DeviceRuntimeService::device)
            .collect()
    }

    pub fn registered_device_board_ids(&self) -> HashMap<String, String> {
        self.services
            .values()
            .map(DeviceRuntimeService::device)
            .map(|device| (device.id, device.board_id))
            .collect()
    }

    pub fn manual_reconnect_suppressed_device_ids(&self) -> HashSet<String> {
        self.services
            .values()
            .map(DeviceRuntimeService::state)
            .filter(|state| state.manual_reconnect_suppressed)
            .filter_map(|state| state.device_id)
            .collect()
    }

    pub fn connected_device_ids(&self) -> HashSet<String> {
        self.services
            .values()
            .map(DeviceRuntimeService::state)
            .filter(|state| state.status == DeviceConnectionStatus::Connected)
            .filter_map(|state| state.device_id)
            .collect()
    }

    pub fn connected_device_count(&self) -> usize {
        self.services
            .values()
            .map(DeviceRuntimeService::state)
            .filter(|state| state.status == DeviceConnectionStatus::Connected)
            .count()
    }

    pub fn input_event_callback(&self, app: Option<tauri::AppHandle>) -> DeviceInputEventCallback {
        let device_input_service = Arc::clone(&self.device_input_service);
        Arc::new(move |event| {
            let result = device_input_service
                .lock()
                .map_err(|error| error.to_string())
                .and_then(|mut service| service.handle_event(event.clone()));
            if let Err(error) = result {
                tracing::warn!(?event, error, "failed to handle device input event");
            }
            if let Some(app) = &app {
                if let Err(error) = DeviceRuntimeEventService::emit_device_input_event(app, &event)
                {
                    tracing::warn!(
                        device_id = %event.device_id,
                        channel_id = %event.channel_id,
                        error,
                        "failed to emit device input event"
                    );
                }
            }
        })
    }

    pub fn states(&self) -> Vec<DeviceRuntimeState> {
        self.services
            .values()
            .map(DeviceRuntimeService::state)
            .collect()
    }

    pub fn state(&self, device_id: &str) -> Option<DeviceRuntimeState> {
        self.services
            .get(device_id)
            .map(DeviceRuntimeService::state)
    }

    /// Test-only synchronous helper. Production flows must use prepare/complete.
    #[cfg(test)]
    pub(super) fn send_action(&mut self, action: &DeviceChannelAction) -> DeviceCommandResult {
        let result = match self.services.get_mut(&action.device_id) {
            Some(service) => service.send_action(action),
            None => DeviceCommandResult {
                device_id: action.device_id.clone(),
                channel_id: action.channel_id.clone(),
                output_type: DeviceCommandOutputType::DeviceChannel,
                status: "skipped".to_string(),
                ack: None,
                error_code: Some(DeviceRuntimeErrorCode::DeviceNotRegistered),
                error: Some("device is not registered".to_string()),
            },
        };
        self.drain_and_handle_input_events(&action.device_id);
        result
    }

    pub fn prepare_action_command(
        &mut self,
        action: &DeviceChannelAction,
    ) -> Result<PreparedDeviceCommand, DeviceCommandResult> {
        match self.services.get_mut(&action.device_id) {
            Some(service) => service.prepare_action_command(action),
            None => Err(DeviceCommandResult {
                device_id: action.device_id.clone(),
                channel_id: action.channel_id.clone(),
                output_type: DeviceCommandOutputType::DeviceChannel,
                status: "skipped".to_string(),
                ack: None,
                error_code: Some(DeviceRuntimeErrorCode::DeviceNotRegistered),
                error: Some("device is not registered".to_string()),
            }),
        }
    }

    pub fn complete_action_command(
        &mut self,
        action: &DeviceChannelAction,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> DeviceCommandResult {
        let result = match self.services.get_mut(&action.device_id) {
            Some(service) => service.complete_action_command(action, session_id, result),
            None => DeviceCommandResult {
                device_id: action.device_id.clone(),
                channel_id: action.channel_id.clone(),
                output_type: DeviceCommandOutputType::DeviceChannel,
                status: "skipped".to_string(),
                ack: None,
                error_code: Some(DeviceRuntimeErrorCode::DeviceNotRegistered),
                error: Some("device is not registered".to_string()),
            },
        };
        self.drain_and_handle_input_events(&action.device_id);
        result
    }

    /// Sends synchronously and waits for the device ACK before returning.
    /// Do not call this while holding the shared runtime registry mutex in UI or hook paths.
    /// Prefer prepare_* -> worker send outside the lock -> complete_* for production flows.
    pub(super) fn send_extension_action(
        &mut self,
        action: &DeviceExtensionAction,
    ) -> DeviceCommandResult {
        let result = match self.services.get_mut(&action.device_id) {
            Some(service) => service.send_extension_action(action),
            None => DeviceCommandResult {
                device_id: action.device_id.clone(),
                channel_id: extension_action_channel_id(action.action).to_string(),
                output_type: extension_action_output_type(action.action),
                status: "skipped".to_string(),
                ack: None,
                error_code: Some(DeviceRuntimeErrorCode::DeviceNotRegistered),
                error: Some("device is not registered".to_string()),
            },
        };
        self.drain_and_handle_input_events(&action.device_id);
        result
    }

    pub fn prepare_extension_command(
        &mut self,
        action: &DeviceExtensionAction,
    ) -> Result<PreparedDeviceCommand, DeviceCommandResult> {
        match self.services.get_mut(&action.device_id) {
            Some(service) => service.prepare_extension_command(action),
            None => Err(DeviceCommandResult {
                device_id: action.device_id.clone(),
                channel_id: extension_action_channel_id(action.action).to_string(),
                output_type: extension_action_output_type(action.action),
                status: "skipped".to_string(),
                ack: None,
                error_code: Some(DeviceRuntimeErrorCode::DeviceNotRegistered),
                error: Some("device is not registered".to_string()),
            }),
        }
    }

    pub fn complete_extension_command(
        &mut self,
        action: &DeviceExtensionAction,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> (DeviceCommandResult, Option<DeviceExtensionAction>) {
        let result = match self.services.get_mut(&action.device_id) {
            Some(service) => service.complete_extension_command(action, session_id, result),
            None => (
                DeviceCommandResult {
                    device_id: action.device_id.clone(),
                    channel_id: extension_action_channel_id(action.action).to_string(),
                    output_type: extension_action_output_type(action.action),
                    status: "skipped".to_string(),
                    ack: None,
                    error_code: Some(DeviceRuntimeErrorCode::DeviceNotRegistered),
                    error: Some("device is not registered".to_string()),
                },
                None,
            ),
        };
        self.drain_and_handle_input_events(&action.device_id);
        result
    }

    pub fn query_device_info(
        &mut self,
        device_id: &str,
        artifact: &FirmwareArtifact,
    ) -> Result<DeviceRuntimeState, String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.query_device_info(artifact)?;
        Ok(service.state())
    }

    pub fn prepare_device_info_query(
        &self,
        device_id: &str,
    ) -> Result<PreparedDeviceInfoQuery, String> {
        let service = self
            .services
            .get(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.prepare_device_info_query()
    }

    pub fn complete_device_info_query(
        &mut self,
        device_id: &str,
        session_id: u64,
        artifact: &FirmwareArtifact,
        result: Result<Option<String>, DeviceIoError>,
    ) -> Result<DeviceRuntimeState, String> {
        let state = {
            let service = self
                .services
                .get_mut(device_id)
                .ok_or_else(|| format!("device is not registered: {device_id}"))?;
            service.complete_device_info_query(session_id, artifact, result)?;
            service.state()
        };
        self.drain_and_handle_input_events(device_id);
        Ok(state)
    }

    pub fn prepare_set_device_uid_command(
        &self,
        device_id: &str,
        device_uid: &str,
    ) -> Result<PreparedDeviceCommand, String> {
        let service = self
            .services
            .get(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.prepare_set_device_uid_command(device_uid)
    }

    pub fn complete_set_device_uid_command(
        &mut self,
        device_id: &str,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> Result<DeviceRuntimeState, String> {
        let state = {
            let service = self
                .services
                .get_mut(device_id)
                .ok_or_else(|| format!("device is not registered: {device_id}"))?;
            service.complete_set_device_uid_command(session_id, result)?;
            service.state()
        };
        self.drain_and_handle_input_events(device_id);
        Ok(state)
    }

    pub fn reset_device_uid(&mut self, device_id: &str, device_uid: &str) -> Result<(), String> {
        let service = self
            .services
            .get_mut(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.reset_device_uid(device_uid)
    }

    pub fn ping(&mut self, device_id: &str) -> Result<DeviceRuntimeState, String> {
        let state = {
            let service = self
                .services
                .get_mut(device_id)
                .ok_or_else(|| format!("device is not registered: {device_id}"))?;
            service.ping()?;
            service.state()
        };
        self.drain_and_handle_input_events(device_id);
        Ok(state)
    }

    pub fn prepare_ping_command(&self, device_id: &str) -> Result<PreparedDeviceCommand, String> {
        let service = self
            .services
            .get(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        service.prepare_ping_command()
    }

    pub fn complete_ping_command(
        &mut self,
        device_id: &str,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> Result<DeviceRuntimeState, String> {
        let state = {
            let service = self
                .services
                .get_mut(device_id)
                .ok_or_else(|| format!("device is not registered: {device_id}"))?;
            service.complete_ping_command(session_id, result)?;
            service.state()
        };
        self.drain_and_handle_input_events(device_id);
        Ok(state)
    }

    pub fn prepare_connected_ping_commands(&self) -> Vec<(String, PreparedDeviceCommand)> {
        self.services
            .values()
            .filter_map(|service| {
                let state = service.state();
                if state.status != DeviceConnectionStatus::Connected
                    || state.active_operation.is_some()
                {
                    return None;
                }
                let device_id = state.device_id?;
                let command = service.prepare_ping_command().ok()?;
                Some((device_id, command))
            })
            .collect()
    }

    /// Test-only synchronous helper. Production flows must use prepare/complete.
    #[cfg(test)]
    pub(super) fn ping_connected_devices(&mut self) -> Vec<DeviceRuntimeState> {
        let mut pinged_device_ids = Vec::new();
        for service in self.services.values_mut() {
            let state = service.state();
            if state.status == DeviceConnectionStatus::Connected && state.active_operation.is_none()
            {
                let _ = service.ping();
                if let Some(device_id) = state.device_id {
                    pinged_device_ids.push(device_id);
                }
            }
        }
        for device_id in pinged_device_ids {
            self.drain_and_handle_input_events(&device_id);
        }
        self.states()
    }

    pub fn sent_lines(&self, device_id: &str) -> Vec<String> {
        self.services
            .get(device_id)
            .map(DeviceRuntimeService::sent_lines)
            .unwrap_or_default()
    }

    fn drain_and_handle_input_events(&mut self, device_id: &str) {
        let Some(service) = self.services.get_mut(device_id) else {
            return;
        };
        let events = service.drain_input_events();
        for event in events {
            let result = self
                .device_input_service
                .lock()
                .map_err(|error| error.to_string())
                .and_then(|mut service| service.handle_event(event.clone()));
            if let Err(error) = result {
                tracing::warn!(?event, error, "failed to handle device input event");
            }
        }
    }
}

fn extension_action_channel_id(action: DeviceExtensionActionType) -> &'static str {
    match action {
        DeviceExtensionActionType::DisplayStatus
        | DeviceExtensionActionType::DisplayCard
        | DeviceExtensionActionType::DisplayLines
        | DeviceExtensionActionType::DisplayRuntime
        | DeviceExtensionActionType::DisplayClear => "display",
        DeviceExtensionActionType::BuzzerPattern => "buzzer",
        DeviceExtensionActionType::DeviceControl => "device",
    }
}

fn extension_action_output_type(action: DeviceExtensionActionType) -> DeviceCommandOutputType {
    match action {
        DeviceExtensionActionType::DisplayStatus
        | DeviceExtensionActionType::DisplayCard
        | DeviceExtensionActionType::DisplayLines
        | DeviceExtensionActionType::DisplayRuntime
        | DeviceExtensionActionType::DisplayClear => DeviceCommandOutputType::Display,
        DeviceExtensionActionType::BuzzerPattern => DeviceCommandOutputType::Buzzer,
        DeviceExtensionActionType::DeviceControl => DeviceCommandOutputType::DeviceControl,
    }
}

#[cfg(test)]
#[path = "device_runtime_registry_tests.rs"]
mod tests;
