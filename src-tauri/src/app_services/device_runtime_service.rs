use crate::app_services::device_operation::{next_operation_id, CANCELLED_RECONNECT_COOLDOWN_MS};
use crate::core::device::{
    DeviceChannel, DeviceChannelAction, DeviceCommandOutputType, DeviceCommandResult,
    DeviceConnectionStatus, DeviceExtensionAction, DeviceExtensionActionType, DeviceFirmwareInfo,
    DeviceFirmwareStatus, DeviceHeartbeatStatus, DeviceInputEvent, DeviceInputEventAction,
    DeviceInputKind, DeviceInstance, DeviceOperationKind, DeviceOperationSummary,
    DeviceRuntimeErrorCode, DeviceRuntimeState, DeviceTransportConfig,
};
use crate::core::firmware::FirmwareArtifact;
use crate::core::protocol::{DeviceInfoAck, DeviceInputEventAck, ProtocolAck, ProtocolCommandV2};
use crate::infrastructure::transports::transport::DeviceTransport;

use super::device_info_probe::firmware_info_from_ack;
pub use super::device_io_worker::DeviceInputEventCallback;
use super::device_io_worker::{
    DeviceIoCommandResult, DeviceIoError, DeviceIoErrorCode, DeviceIoWorkerHandle,
    DeviceTransportMonitorRecorder,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceCommandSideEffects {
    pub ack: Option<String>,
    pub input_events: Vec<DeviceInputEvent>,
}

pub struct DeviceRuntimeService {
    device: DeviceInstance,
    state: DeviceRuntimeState,
    io_worker: Option<DeviceIoWorkerHandle>,
    io_session_id: u64,
    pending_input_events: Vec<DeviceInputEvent>,
}

pub struct PreparedDeviceCommand {
    pub worker: DeviceIoWorkerHandle,
    pub command: ProtocolCommandV2,
    pub session_id: u64,
}

pub struct PreparedDeviceInfoQuery {
    pub worker: DeviceIoWorkerHandle,
    pub session_id: u64,
}

impl DeviceRuntimeService {
    pub fn new(device: DeviceInstance) -> Self {
        let state = DeviceRuntimeState {
            device_id: Some(device.id.clone()),
            device_uid: device.device_uid.clone(),
            status: DeviceConnectionStatus::Disconnected,
            board_id: Some(device.board_id.clone()),
            transport: Some(device.transport.clone()),
            channels: device.channels.clone(),
            firmware_info: None,
            bundled_firmware_version: None,
            firmware_status: DeviceFirmwareStatus::Unknown,
            firmware_check_error: None,
            heartbeat_status: DeviceHeartbeatStatus::Unknown,
            last_heartbeat_at: None,
            heartbeat_failure_count: 0,
            manual_reconnect_suppressed: false,
            matched_resource_id: None,
            last_discovered_at: None,
            active_operation: None,
            auto_reconnect_blocked_until: None,
            last_ack: None,
            last_error_code: None,
            last_error: None,
            last_sent_at: None,
        };
        Self {
            device,
            state,
            io_worker: None,
            io_session_id: 0,
            pending_input_events: Vec::new(),
        }
    }

    pub fn device_id(&self) -> &str {
        &self.device.id
    }

    pub fn state(&self) -> DeviceRuntimeState {
        let mut state = self.state.clone();
        if state.status == DeviceConnectionStatus::Connected
            && self
                .io_worker
                .as_ref()
                .map(|worker| !worker.is_running())
                .unwrap_or(false)
        {
            state.status = DeviceConnectionStatus::Disconnected;
            state.heartbeat_status = DeviceHeartbeatStatus::Lost;
            state.last_error_code = Some(DeviceRuntimeErrorCode::DeviceIoWorkerStopped);
            state.last_error = Some(DeviceIoError::worker_stopped().message);
        }
        state
    }

    pub fn device(&self) -> DeviceInstance {
        self.device.clone()
    }

    pub fn replace_channels(&mut self, channels: Vec<DeviceChannel>) {
        self.device.channels = channels.clone();
        self.state.channels = channels;
        if let Some(worker) = &self.io_worker {
            worker.update_input_channels(self.input_channel_by_control());
        }
        self.clear_last_error();
    }

    pub fn prepare_gpio_input_config_commands(
        &self,
        disabled_channel_ids: &[String],
    ) -> Vec<PreparedDeviceCommand> {
        if self.state.status != DeviceConnectionStatus::Connected {
            return Vec::new();
        }
        let Some(worker) = self.io_worker.clone() else {
            return Vec::new();
        };
        let mut commands = Vec::new();
        for channel in &self.device.channels {
            let Some(input) = &channel.input else {
                continue;
            };
            if input.input_kind != DeviceInputKind::Gpio {
                continue;
            }
            commands.push(PreparedDeviceCommand {
                worker: worker.clone(),
                command: ProtocolCommandV2::configure_gpio_input(channel.id.clone(), true),
                session_id: self.io_session_id,
            });
        }
        for channel_id in disabled_channel_ids {
            commands.push(PreparedDeviceCommand {
                worker: worker.clone(),
                command: ProtocolCommandV2::configure_gpio_input(channel_id.clone(), false),
                session_id: self.io_session_id,
            });
        }
        commands
    }

    pub fn drain_input_events(&mut self) -> Vec<DeviceInputEvent> {
        std::mem::take(&mut self.pending_input_events)
    }

    pub fn replace_runtime_transport(&mut self, transport: DeviceTransportConfig) {
        self.device.transport = transport.clone();
        self.state.transport = Some(transport);
        self.state.last_discovered_at = Some(current_local_timestamp());
    }

    pub fn begin_operation(
        &mut self,
        kind: DeviceOperationKind,
        deadline_ms: u64,
        cancellable: bool,
    ) -> Result<DeviceOperationSummary, String> {
        if let Some(operation) = &self.state.active_operation {
            return Err(format!(
                "device operation already running: {}",
                operation.operation_id
            ));
        }
        let operation = DeviceOperationSummary {
            operation_id: next_operation_id(),
            kind,
            started_at: current_local_timestamp(),
            deadline_ms,
            cancellable,
        };
        if matches!(
            kind,
            DeviceOperationKind::ManualConnect | DeviceOperationKind::AutoConnect
        ) {
            self.state.status = DeviceConnectionStatus::Connecting;
        }
        self.state.active_operation = Some(operation.clone());
        self.clear_last_error();
        Ok(operation)
    }

    pub fn operation_matches(&self, operation_id: u64) -> bool {
        self.state
            .active_operation
            .as_ref()
            .map(|operation| operation.operation_id == operation_id)
            .unwrap_or(false)
    }

    pub fn clear_operation(&mut self, operation_id: u64) -> bool {
        if !self.operation_matches(operation_id) {
            return false;
        }
        self.state.active_operation = None;
        true
    }

    pub fn cancel_operation(&mut self, operation_id: u64) -> Result<(), String> {
        let Some(operation) = self.state.active_operation.clone() else {
            return Err("device operation is not running".to_string());
        };
        if operation.operation_id != operation_id {
            return Err("device operation has already changed".to_string());
        }
        if !operation.cancellable {
            return Err("device operation is not cancellable".to_string());
        }
        self.stop_io_worker();
        self.state.status = DeviceConnectionStatus::Disconnected;
        self.state.active_operation = None;
        self.state.last_ack = None;
        self.state.last_sent_at = None;
        self.set_last_error(
            DeviceRuntimeErrorCode::DeviceOperationCancelled,
            "operation_cancelled",
        );
        self.state.auto_reconnect_blocked_until =
            Some(timestamp_after_millis(CANCELLED_RECONNECT_COOLDOWN_MS));
        Ok(())
    }

    pub fn auto_reconnect_blocked(&mut self) -> bool {
        let Some(blocked_until) = self.state.auto_reconnect_blocked_until.as_deref() else {
            return false;
        };
        if timestamp_is_after_now(blocked_until) {
            return true;
        }
        self.state.auto_reconnect_blocked_until = None;
        false
    }

    pub fn complete_connect_operation(
        &mut self,
        operation_id: u64,
        transport_config: DeviceTransportConfig,
        transport: Box<dyn DeviceTransport>,
        state_patch: DeviceRuntimeState,
        input_callback: Option<DeviceInputEventCallback>,
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    ) -> Result<(), String> {
        if !self.operation_matches(operation_id) {
            return Err("device operation has already changed".to_string());
        }
        self.connect_with_transport_config_and_input_callback(
            transport_config,
            transport,
            input_callback,
            monitor_recorder,
        );
        self.state.active_operation = None;
        self.state.device_uid = state_patch
            .device_uid
            .or_else(|| self.state.device_uid.clone());
        self.state.board_id = state_patch.board_id.or_else(|| self.state.board_id.clone());
        self.state.firmware_info = state_patch.firmware_info;
        self.state.bundled_firmware_version = state_patch.bundled_firmware_version;
        self.state.firmware_status = state_patch.firmware_status;
        self.state.firmware_check_error = state_patch.firmware_check_error;
        self.state.last_ack = state_patch.last_ack;
        self.clear_last_error();
        Ok(())
    }

    pub fn fail_operation_if_current(
        &mut self,
        operation_id: u64,
        error: String,
    ) -> Result<(), String> {
        if !self.operation_matches(operation_id) {
            return Err("device operation has already changed".to_string());
        }
        self.stop_io_worker();
        self.state.status = DeviceConnectionStatus::Error;
        self.state.active_operation = None;
        self.set_last_error(DeviceRuntimeErrorCode::DeviceTransportError, error);
        Ok(())
    }

    pub fn connect_with_transport(&mut self, transport: Box<dyn DeviceTransport>) {
        self.connect_with_transport_config(self.device.transport.clone(), transport);
    }

    pub fn connect_with_transport_and_input_callback(
        &mut self,
        transport: Box<dyn DeviceTransport>,
        input_callback: Option<DeviceInputEventCallback>,
    ) {
        self.connect_with_transport_config_and_input_callback(
            self.device.transport.clone(),
            transport,
            input_callback,
            None,
        );
    }

    pub fn connect_with_transport_config(
        &mut self,
        transport_config: DeviceTransportConfig,
        transport: Box<dyn DeviceTransport>,
    ) {
        self.connect_with_transport_config_and_input_callback(
            transport_config,
            transport,
            None,
            None,
        );
    }

    pub fn connect_with_transport_config_and_input_callback(
        &mut self,
        transport_config: DeviceTransportConfig,
        transport: Box<dyn DeviceTransport>,
        input_callback: Option<DeviceInputEventCallback>,
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    ) {
        self.device.transport = transport_config.clone();
        self.stop_io_worker();
        self.io_session_id = self.io_session_id.saturating_add(1);
        let transport_label = transport_label(&transport_config);
        self.io_worker = Some(DeviceIoWorkerHandle::start(
            self.device.id.clone(),
            Some(self.device.board_id.clone()),
            transport_label,
            self.input_channel_by_control(),
            transport,
            input_callback,
            monitor_recorder,
        ));
        self.state.transport = Some(transport_config);
        self.state.status = DeviceConnectionStatus::Connected;
        self.state.manual_reconnect_suppressed = false;
        self.state.matched_resource_id = self
            .state
            .transport
            .as_ref()
            .and_then(|transport| transport.serial_port.clone());
        self.state.last_discovered_at = Some(current_local_timestamp());
        self.clear_last_error();
    }

    pub fn update_monitor_recorder(
        &mut self,
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    ) -> Result<(), String> {
        let Some(worker) = self.io_worker.as_ref() else {
            return Err("device io worker is not running".to_string());
        };
        if self.state.status != DeviceConnectionStatus::Connected {
            return Err("device is not connected".to_string());
        }
        worker.update_monitor_recorder(monitor_recorder);
        Ok(())
    }

    pub fn disconnect(&mut self) {
        self.disconnect_with_reconnect_suppression(false);
    }

    pub fn disconnect_with_reconnect_suppression(&mut self, suppressed: bool) {
        self.stop_io_worker();
        self.state.status = DeviceConnectionStatus::Disconnected;
        self.state.manual_reconnect_suppressed = suppressed;
        self.state.last_ack = None;
        self.clear_last_error();
        self.state.last_sent_at = None;
    }

    #[cfg(test)]
    pub(super) fn send_action(&mut self, action: &DeviceChannelAction) -> DeviceCommandResult {
        let prepared = match self.prepare_action_command(action) {
            Ok(prepared) => prepared,
            Err(result) => return result,
        };
        let session_id = prepared.session_id;
        let result = prepared.worker.send_protocol_command(prepared.command);
        self.complete_action_command(action, session_id, result)
    }

    pub fn prepare_action_command(
        &mut self,
        action: &DeviceChannelAction,
    ) -> Result<PreparedDeviceCommand, DeviceCommandResult> {
        let Some(worker) = self.io_worker.clone() else {
            return Err(command_result(
                action,
                "skipped",
                None,
                Some(DeviceRuntimeErrorCode::DeviceNotConnected),
                Some("device is not connected"),
            ));
        };
        if self.state.status != DeviceConnectionStatus::Connected {
            return Err(command_result(
                action,
                "skipped",
                None,
                Some(DeviceRuntimeErrorCode::DeviceNotConnected),
                Some("device is not connected"),
            ));
        }
        let Some(channel) = self
            .device
            .channels
            .iter()
            .find(|channel| channel.id == action.channel_id)
        else {
            return Err(command_result(
                action,
                "failed",
                None,
                Some(DeviceRuntimeErrorCode::DeviceChannelNotConfigured),
                Some("device channel is not configured"),
            ));
        };
        if !channel.supports_action(action.action) {
            return Err(command_result(
                action,
                "failed",
                None,
                Some(DeviceRuntimeErrorCode::DeviceChannelActionUnsupported),
                Some("device channel action is not supported"),
            ));
        }
        let command = match ProtocolCommandV2::from_device_channel_action(action) {
            Ok(command) => command,
            Err(error) => {
                self.record_command_error(
                    DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                    error.clone(),
                );
                return Err(command_result(
                    action,
                    "failed",
                    None,
                    Some(DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse),
                    Some(error.as_str()),
                ));
            }
        };
        Ok(PreparedDeviceCommand {
            worker,
            command,
            session_id: self.io_session_id,
        })
    }

    pub fn complete_action_command(
        &mut self,
        action: &DeviceChannelAction,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> DeviceCommandResult {
        if !self.io_session_matches(session_id) {
            return command_result(
                action,
                "skipped",
                None,
                Some(DeviceRuntimeErrorCode::DeviceConnectionChanged),
                Some("device connection changed before command completed"),
            );
        }
        let side_effects = match self.apply_protocol_command_result(result) {
            Ok(side_effects) => side_effects,
            Err(error) => {
                if error.code == DeviceIoErrorCode::ActionTimeout {
                    self.record_command_error(
                        DeviceRuntimeErrorCode::DeviceActionTimeout,
                        error.message.clone(),
                    );
                } else {
                    self.mark_transport_error(error.clone());
                }
                return command_result(
                    action,
                    "failed",
                    None,
                    Some(runtime_error_code_from_io_error(error.code)),
                    Some(error.message.as_str()),
                );
            }
        };
        let ack = side_effects.ack.clone();
        if let Some(ack_line) = &ack {
            if let Ok(parsed_ack) = ProtocolAck::parse(ack_line) {
                if !parsed_ack.ok {
                    let code = device_action_error_code(&parsed_ack);
                    let error = device_action_error_message(parsed_ack);
                    self.record_command_error(code, error.clone());
                    return command_result(action, "failed", ack, Some(code), Some(error.as_str()));
                }
            }
        }
        command_result(action, "sent", ack, None, None)
    }

    pub(super) fn send_extension_action(
        &mut self,
        action: &DeviceExtensionAction,
    ) -> DeviceCommandResult {
        let prepared = match self.prepare_extension_command(action) {
            Ok(prepared) => prepared,
            Err(result) => return result,
        };
        let session_id = prepared.session_id;
        let result = prepared.worker.send_protocol_command(prepared.command);
        let (result, fallback) = self.complete_extension_command(action, session_id, result);
        match fallback {
            Some(fallback_action) => self.send_extension_action(&fallback_action),
            None => result,
        }
    }

    pub fn prepare_extension_command(
        &mut self,
        action: &DeviceExtensionAction,
    ) -> Result<PreparedDeviceCommand, DeviceCommandResult> {
        let Some(worker) = self.io_worker.clone() else {
            return Err(extension_command_result(
                action,
                "skipped",
                None,
                Some(DeviceRuntimeErrorCode::DeviceNotConnected),
                Some("device is not connected"),
            ));
        };
        if self.state.status != DeviceConnectionStatus::Connected {
            return Err(extension_command_result(
                action,
                "skipped",
                None,
                Some(DeviceRuntimeErrorCode::DeviceNotConnected),
                Some("device is not connected"),
            ));
        }
        let command = match ProtocolCommandV2::from_device_extension_action(action) {
            Ok(command) => command,
            Err(error) => {
                self.record_command_error(
                    DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                    error.clone(),
                );
                return Err(extension_command_result(
                    action,
                    "failed",
                    None,
                    Some(DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse),
                    Some(error.as_str()),
                ));
            }
        };
        Ok(PreparedDeviceCommand {
            worker,
            command,
            session_id: self.io_session_id,
        })
    }

    pub fn complete_extension_command(
        &mut self,
        action: &DeviceExtensionAction,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> (DeviceCommandResult, Option<DeviceExtensionAction>) {
        if !self.io_session_matches(session_id) {
            return (
                extension_command_result(
                    action,
                    "skipped",
                    None,
                    Some(DeviceRuntimeErrorCode::DeviceConnectionChanged),
                    Some("device connection changed before command completed"),
                ),
                None,
            );
        }
        let side_effects = match self.apply_protocol_command_result(result) {
            Ok(side_effects) => side_effects,
            Err(error) => {
                if error.code == DeviceIoErrorCode::ActionTimeout {
                    self.record_command_error(
                        DeviceRuntimeErrorCode::DeviceActionTimeout,
                        error.message.clone(),
                    );
                } else {
                    self.mark_transport_error(error.clone());
                }
                return (
                    extension_command_result(
                        action,
                        "failed",
                        None,
                        Some(runtime_error_code_from_io_error(error.code)),
                        Some(error.message.as_str()),
                    ),
                    None,
                );
            }
        };
        let ack = side_effects.ack.clone();
        if let Some(ack_line) = &ack {
            if let Ok(parsed_ack) = ProtocolAck::parse(ack_line) {
                if !parsed_ack.ok {
                    if is_unsupported_extension_display_primitive(&parsed_ack, action.action) {
                        if let Some(fallback_action) = display_status_fallback_action(action) {
                            tracing::warn!(
                                device_id = action.device_id,
                                unsupported_action = ?action.action,
                                fallback_action = ?fallback_action.action,
                                "device display primitive unsupported, retrying with display_status"
                            );
                            return (
                                extension_command_result(
                                    action,
                                    "failed",
                                    ack,
                                    Some(DeviceRuntimeErrorCode::DeviceProtocolUnsupportedCommand),
                                    None,
                                ),
                                Some(fallback_action),
                            );
                        }
                    }
                    let code = device_action_error_code(&parsed_ack);
                    let error = device_action_error_message(parsed_ack);
                    self.record_command_error(code, error.clone());
                    return (
                        extension_command_result(
                            action,
                            "failed",
                            ack,
                            Some(code),
                            Some(error.as_str()),
                        ),
                        None,
                    );
                }
            }
        }
        (
            extension_command_result(action, "sent", ack, None, None),
            None,
        )
    }

    pub fn query_device_info(&mut self, artifact: &FirmwareArtifact) -> Result<(), String> {
        self.state.bundled_firmware_version = Some(artifact.firmware_version.clone());
        self.state.firmware_check_error = None;

        if self.io_worker.is_none() || self.state.status != DeviceConnectionStatus::Connected {
            self.state.firmware_status = DeviceFirmwareStatus::Unknown;
            self.state.firmware_check_error = Some("device is not connected".to_string());
            return Ok(());
        }

        let ack = match self.query_device_info_line() {
            Ok(ack) => ack,
            Err(error) => {
                self.state.firmware_status = DeviceFirmwareStatus::Unknown;
                self.state.firmware_check_error = Some(error.message.clone());
                if error.code != DeviceIoErrorCode::DeviceInfoTimeout {
                    self.mark_transport_disconnected(error);
                }
                return Ok(());
            }
        };
        let Some(ack_line) = ack else {
            self.state.firmware_status = DeviceFirmwareStatus::Unknown;
            self.state.firmware_check_error = Some("device_info response timed out".to_string());
            return Ok(());
        };

        self.state.last_ack = Some(ack_line.clone());
        match DeviceInfoAck::parse(&ack_line) {
            Ok(ack) if ack.error.as_deref() == Some("unsupported_command") => {
                self.state.firmware_status = DeviceFirmwareStatus::Unsupported;
                self.state.firmware_check_error =
                    Some("device_info is not supported by current firmware".to_string());
                Ok(())
            }
            Ok(ack) => match firmware_info_from_ack(ack, &self.device.transport) {
                Ok(info) => {
                    self.apply_firmware_info(info, artifact);
                    Ok(())
                }
                Err(error) => {
                    self.state.firmware_status = DeviceFirmwareStatus::Unknown;
                    self.state.firmware_check_error = Some(error);
                    Ok(())
                }
            },
            Err(error) => {
                self.state.firmware_status = DeviceFirmwareStatus::Unknown;
                self.state.firmware_check_error = Some(error);
                Ok(())
            }
        }
    }

    pub fn prepare_device_info_query(&self) -> Result<PreparedDeviceInfoQuery, String> {
        let Some(worker) = self.io_worker.clone() else {
            return Err("device is not connected".to_string());
        };
        if self.state.status != DeviceConnectionStatus::Connected {
            return Err("device is not connected".to_string());
        }
        Ok(PreparedDeviceInfoQuery {
            worker,
            session_id: self.io_session_id,
        })
    }

    pub fn complete_device_info_query(
        &mut self,
        session_id: u64,
        artifact: &FirmwareArtifact,
        result: Result<Option<String>, DeviceIoError>,
    ) -> Result<(), String> {
        self.state.bundled_firmware_version = Some(artifact.firmware_version.clone());
        self.state.firmware_check_error = None;

        if !self.io_session_matches(session_id) {
            tracing::debug!(
                device_id = self.device.id,
                session_id,
                current_session_id = self.io_session_id,
                "discarded stale device_info query result"
            );
            return Ok(());
        }

        let ack = match result {
            Ok(ack) => ack,
            Err(error) => {
                self.state.firmware_status = DeviceFirmwareStatus::Unknown;
                self.state.firmware_check_error = Some(error.message.clone());
                if error.code != DeviceIoErrorCode::DeviceInfoTimeout {
                    self.mark_transport_disconnected(error);
                }
                return Ok(());
            }
        };
        let Some(ack_line) = ack else {
            self.state.firmware_status = DeviceFirmwareStatus::Unknown;
            self.state.firmware_check_error = Some("device_info response timed out".to_string());
            return Ok(());
        };

        self.state.last_ack = Some(ack_line.clone());
        match DeviceInfoAck::parse(&ack_line) {
            Ok(ack) if ack.error.as_deref() == Some("unsupported_command") => {
                self.state.firmware_status = DeviceFirmwareStatus::Unsupported;
                self.state.firmware_check_error =
                    Some("device_info is not supported by current firmware".to_string());
                Ok(())
            }
            Ok(ack) => match firmware_info_from_ack(ack, &self.device.transport) {
                Ok(info) => {
                    self.apply_firmware_info(info, artifact);
                    Ok(())
                }
                Err(error) => {
                    self.state.firmware_status = DeviceFirmwareStatus::Unknown;
                    self.state.firmware_check_error = Some(error);
                    Ok(())
                }
            },
            Err(error) => {
                self.state.firmware_status = DeviceFirmwareStatus::Unknown;
                self.state.firmware_check_error = Some(error);
                Ok(())
            }
        }
    }

    pub fn prepare_set_device_uid_command(
        &self,
        device_uid: &str,
    ) -> Result<PreparedDeviceCommand, String> {
        let Some(worker) = self.io_worker.clone() else {
            return Err("device is not connected".to_string());
        };
        if self.state.status != DeviceConnectionStatus::Connected {
            return Err("device is not connected".to_string());
        }
        Ok(PreparedDeviceCommand {
            worker,
            command: ProtocolCommandV2::set_device_uid(device_uid.to_string()),
            session_id: self.io_session_id,
        })
    }

    pub fn complete_set_device_uid_command(
        &mut self,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> Result<(), String> {
        if !self.io_session_matches(session_id) {
            return Err("device connection changed before set_device_uid completed".to_string());
        }
        let side_effects = match self.apply_protocol_command_result(result) {
            Ok(side_effects) => side_effects,
            Err(error) => return Err(self.record_device_io_command_error(error)),
        };
        let Some(ack_line) = side_effects.ack else {
            let error = "set_device_uid response timed out".to_string();
            self.record_command_error(DeviceRuntimeErrorCode::DeviceActionTimeout, error.clone());
            return Err(error);
        };
        self.state.last_ack = Some(ack_line.clone());
        self.state.last_sent_at = Some(current_local_timestamp());
        let ack = match ProtocolAck::parse(&ack_line) {
            Ok(ack) => ack,
            Err(error) => {
                self.record_command_error(
                    DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                    error.clone(),
                );
                return Err(error);
            }
        };
        if ack.v != 2 {
            let error = "unsupported set_device_uid response protocol version".to_string();
            self.record_command_error(
                DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                error.clone(),
            );
            return Err(error);
        }
        if !ack.ok {
            let code = device_action_error_code(&ack);
            let error = ack
                .error
                .unwrap_or_else(|| "set_device_uid failed".to_string());
            self.record_command_error(code, error.clone());
            return Err(error);
        }
        if ack.ack_type.as_deref() != Some("set_device_uid") {
            let error = "unexpected set_device_uid response type".to_string();
            self.record_command_error(
                DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                error.clone(),
            );
            return Err(error);
        }
        self.clear_last_error();
        Ok(())
    }

    pub(super) fn ping(&mut self) -> Result<(), String> {
        let prepared = self.prepare_ping_command()?;
        let session_id = prepared.session_id;
        let result = prepared.worker.send_protocol_command(prepared.command);
        self.complete_ping_command(session_id, result)
    }

    pub fn prepare_ping_command(&self) -> Result<PreparedDeviceCommand, String> {
        let Some(worker) = self.io_worker.clone() else {
            return Err("device is not connected".to_string());
        };
        if self.state.status != DeviceConnectionStatus::Connected {
            return Err("device is not connected".to_string());
        }
        Ok(PreparedDeviceCommand {
            worker,
            command: ProtocolCommandV2::ping(),
            session_id: self.io_session_id,
        })
    }

    pub fn complete_ping_command(
        &mut self,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> Result<(), String> {
        if !self.io_session_matches(session_id) {
            tracing::debug!(
                device_id = self.device.id,
                session_id,
                current_session_id = self.io_session_id,
                "discarded stale device ping result"
            );
            return Ok(());
        }
        let side_effects = match self.apply_protocol_command_result(result) {
            Ok(side_effects) => side_effects,
            Err(error) => {
                if error.code == DeviceIoErrorCode::ActionTimeout {
                    self.record_heartbeat_failure(error.message);
                } else {
                    self.record_heartbeat_transport_lost(error);
                }
                return Ok(());
            }
        };
        let ack = side_effects.ack.clone();

        match ack.as_deref() {
            Some(line) if ack_is_pong(line) => {
                self.state.heartbeat_status = DeviceHeartbeatStatus::Healthy;
                self.state.heartbeat_failure_count = 0;
                self.state.last_heartbeat_at = Some(current_local_timestamp());
                self.clear_last_error();
                Ok(())
            }
            Some(line) if ack_is_unsupported_command(line) => {
                self.state.heartbeat_status = DeviceHeartbeatStatus::Unsupported;
                Ok(())
            }
            _ => {
                self.record_heartbeat_failure("invalid pong response".to_string());
                Ok(())
            }
        }
    }

    pub fn reset_device_uid(&mut self, device_uid: &str) -> Result<(), String> {
        if self.io_worker.is_none() || self.state.status != DeviceConnectionStatus::Connected {
            return Err("device is not connected".to_string());
        }
        let side_effects = match self
            .send_protocol_command(ProtocolCommandV2::set_device_uid(device_uid.to_string()))
        {
            Ok(side_effects) => side_effects,
            Err(error) => return Err(self.record_device_io_command_error(error)),
        };
        let Some(ack_line) = side_effects.ack else {
            let error = "set_device_uid response timed out".to_string();
            self.record_command_error(DeviceRuntimeErrorCode::DeviceActionTimeout, error.clone());
            return Err(error);
        };
        self.state.last_ack = Some(ack_line.clone());
        self.state.last_sent_at = Some(current_local_timestamp());
        let ack = match ProtocolAck::parse(&ack_line) {
            Ok(ack) => ack,
            Err(error) => {
                self.record_command_error(
                    DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                    error.clone(),
                );
                return Err(error);
            }
        };
        if ack.v != 2 {
            let error = "unsupported set_device_uid response protocol version".to_string();
            self.record_command_error(
                DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                error.clone(),
            );
            return Err(error);
        }
        if !ack.ok {
            let code = device_action_error_code(&ack);
            let error = ack
                .error
                .unwrap_or_else(|| "set_device_uid failed".to_string());
            self.record_command_error(code, error.clone());
            return Err(error);
        }
        if ack.ack_type.as_deref() != Some("set_device_uid") {
            let error = "unexpected set_device_uid response type".to_string();
            self.record_command_error(
                DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                error.clone(),
            );
            return Err(error);
        }
        self.clear_last_error();
        Ok(())
    }

    pub fn complete_gpio_input_config_command(
        &mut self,
        session_id: u64,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> Result<(), String> {
        if !self.io_session_matches(session_id) {
            return Err("device connection changed before configure_input completed".to_string());
        }
        let side_effects = match self.apply_protocol_command_result(result) {
            Ok(side_effects) => side_effects,
            Err(error) => return Err(self.record_device_io_command_error(error)),
        };
        let Some(ack_line) = side_effects.ack else {
            let error = "configure_input response timed out".to_string();
            self.record_command_error(DeviceRuntimeErrorCode::DeviceActionTimeout, error.clone());
            return Err(error);
        };
        self.state.last_ack = Some(ack_line.clone());
        self.state.last_sent_at = Some(current_local_timestamp());
        let ack = match ProtocolAck::parse(&ack_line) {
            Ok(ack) => ack,
            Err(error) => {
                self.record_command_error(
                    DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                    error.clone(),
                );
                return Err(error);
            }
        };
        if !ack.ok {
            let code = device_action_error_code(&ack);
            let error = ack
                .error
                .unwrap_or_else(|| "configure_input failed".to_string());
            self.record_command_error(code, error.clone());
            return Err(error);
        }
        if ack.ack_type.as_deref() != Some("configure_input") {
            let error = "unexpected configure_input response type".to_string();
            self.record_command_error(
                DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
                error.clone(),
            );
            return Err(error);
        }
        self.clear_last_error();
        Ok(())
    }

    pub fn sent_lines(&self) -> Vec<String> {
        self.io_worker
            .as_ref()
            .map(DeviceIoWorkerHandle::sent_lines)
            .unwrap_or_default()
    }

    fn send_protocol_command(
        &mut self,
        command: ProtocolCommandV2,
    ) -> Result<DeviceCommandSideEffects, DeviceIoError> {
        if self.io_worker.is_none() || self.state.status != DeviceConnectionStatus::Connected {
            return Err(DeviceIoError::new(
                DeviceIoErrorCode::TransportDisconnected,
                "device is not connected",
            ));
        }
        tracing::debug!(
            expected_ack_type = command.expected_ack_type(),
            expected_channel = command.channel_id().unwrap_or(""),
            "sending device protocol command"
        );
        let result = self
            .io_worker
            .as_ref()
            .expect("io worker checked before send")
            .send_protocol_command(command)?;
        self.apply_protocol_command_result(Ok(result))
    }

    fn apply_protocol_command_result(
        &mut self,
        result: Result<DeviceIoCommandResult, DeviceIoError>,
    ) -> Result<DeviceCommandSideEffects, DeviceIoError> {
        let result = result?;
        self.state.status = DeviceConnectionStatus::Connected;
        self.state.last_ack = result.ack.clone();
        self.clear_last_error();
        self.state.last_sent_at = Some(current_local_timestamp());
        Ok(DeviceCommandSideEffects {
            ack: result.ack,
            input_events: Vec::new(),
        })
    }

    fn input_channel_by_control(&self) -> std::collections::BTreeMap<String, String> {
        self.device
            .channels
            .iter()
            .filter_map(|channel| {
                channel
                    .input
                    .as_ref()
                    .map(|input| (input.control.clone(), channel.id.clone()))
            })
            .collect()
    }

    fn query_device_info_line(&mut self) -> Result<Option<String>, DeviceIoError> {
        if self.io_worker.is_none() || self.state.status != DeviceConnectionStatus::Connected {
            return Err(DeviceIoError::new(
                DeviceIoErrorCode::TransportDisconnected,
                "device is not connected",
            ));
        }
        let ack = self
            .io_worker
            .as_ref()
            .expect("io worker checked before device info query")
            .query_device_info_line()?;
        self.state.status = DeviceConnectionStatus::Connected;
        self.state.last_ack = ack.clone();
        self.clear_last_error();
        self.state.last_sent_at = Some(current_local_timestamp());
        Ok(ack)
    }

    fn mark_transport_error(&mut self, error: DeviceIoError) {
        self.stop_io_worker();
        self.state.status = DeviceConnectionStatus::Error;
        self.set_last_error(runtime_error_code_from_io_error(error.code), error.message);
    }

    fn mark_transport_disconnected(&mut self, error: DeviceIoError) {
        self.stop_io_worker();
        self.state.status = DeviceConnectionStatus::Disconnected;
        self.set_last_error(runtime_error_code_from_io_error(error.code), error.message);
    }

    fn record_command_error(&mut self, code: DeviceRuntimeErrorCode, error: String) {
        self.state.status = DeviceConnectionStatus::Connected;
        self.set_last_error(code, error);
    }

    fn record_device_io_command_error(&mut self, error: DeviceIoError) -> String {
        let message = error.message.clone();
        if error.code == DeviceIoErrorCode::ActionTimeout {
            self.record_command_error(DeviceRuntimeErrorCode::DeviceActionTimeout, message.clone());
        } else {
            self.mark_transport_disconnected(error);
        }
        message
    }

    fn record_heartbeat_failure(&mut self, error: String) {
        self.state.heartbeat_failure_count = self.state.heartbeat_failure_count.saturating_add(1);
        self.set_last_error(DeviceRuntimeErrorCode::DeviceActionTimeout, error);
        if self.state.heartbeat_failure_count >= 3 {
            self.state.heartbeat_status = DeviceHeartbeatStatus::Lost;
            self.state.status = DeviceConnectionStatus::Connected;
        } else {
            self.state.heartbeat_status = DeviceHeartbeatStatus::Stale;
        }
    }

    fn record_heartbeat_transport_lost(&mut self, error: DeviceIoError) {
        self.state.heartbeat_failure_count = self.state.heartbeat_failure_count.saturating_add(1);
        self.state.heartbeat_status = DeviceHeartbeatStatus::Lost;
        self.state.status = DeviceConnectionStatus::Disconnected;
        self.set_last_error(runtime_error_code_from_io_error(error.code), error.message);
        self.stop_io_worker();
    }

    fn stop_io_worker(&mut self) {
        if let Some(worker) = self.io_worker.take() {
            worker.stop();
        }
    }

    fn io_session_matches(&self, session_id: u64) -> bool {
        self.io_worker.is_some() && self.io_session_id == session_id
    }

    fn apply_firmware_info(&mut self, info: DeviceFirmwareInfo, artifact: &FirmwareArtifact) {
        self.device.device_uid = Some(info.device_uid.clone());
        self.state.device_uid = Some(info.device_uid.clone());
        let status = if info.board_id != artifact.board_id
            || info.protocol_version != artifact.protocol_version
        {
            DeviceFirmwareStatus::Incompatible
        } else if firmware_version_is_older(&info.firmware_version, &artifact.firmware_version) {
            DeviceFirmwareStatus::UpdateAvailable
        } else {
            DeviceFirmwareStatus::UpToDate
        };
        self.state.firmware_info = Some(info);
        self.state.firmware_status = status;
        self.state.firmware_check_error = None;
    }

    fn set_last_error(&mut self, code: DeviceRuntimeErrorCode, error: impl Into<String>) {
        self.state.last_error_code = Some(code);
        self.state.last_error = Some(error.into());
    }

    fn clear_last_error(&mut self) {
        self.state.last_error_code = None;
        self.state.last_error = None;
    }
}

fn runtime_error_code_from_io_error(code: DeviceIoErrorCode) -> DeviceRuntimeErrorCode {
    match code {
        DeviceIoErrorCode::WorkerStopped => DeviceRuntimeErrorCode::DeviceIoWorkerStopped,
        DeviceIoErrorCode::ActionTimeout => DeviceRuntimeErrorCode::DeviceActionTimeout,
        DeviceIoErrorCode::DeviceInfoTimeout => DeviceRuntimeErrorCode::DeviceInfoTimeout,
        DeviceIoErrorCode::TransportBusy => DeviceRuntimeErrorCode::DeviceTransportBusy,
        DeviceIoErrorCode::TransportPermissionDenied => {
            DeviceRuntimeErrorCode::DeviceTransportPermissionDenied
        }
        DeviceIoErrorCode::TransportDisconnected => {
            DeviceRuntimeErrorCode::DeviceTransportDisconnected
        }
        DeviceIoErrorCode::TransportError => DeviceRuntimeErrorCode::DeviceTransportError,
        DeviceIoErrorCode::ProtocolInvalidResponse => {
            DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse
        }
    }
}

fn transport_label(transport: &DeviceTransportConfig) -> Option<String> {
    transport
        .serial_port
        .clone()
        .or_else(|| match (&transport.host, transport.port) {
            (Some(host), Some(port)) => Some(format!("{host}:{port}")),
            (Some(host), None) => Some(host.clone()),
            (None, Some(port)) => Some(port.to_string()),
            (None, None) => None,
        })
}

fn firmware_version_is_older(current: &str, bundled: &str) -> bool {
    let current_parts = parse_version_tuple(current);
    let bundled_parts = parse_version_tuple(bundled);
    let max_len = current_parts.len().max(bundled_parts.len());

    for index in 0..max_len {
        let current_part = current_parts.get(index).copied().unwrap_or(0);
        let bundled_part = bundled_parts.get(index).copied().unwrap_or(0);
        if current_part != bundled_part {
            return current_part < bundled_part;
        }
    }

    false
}

fn parse_version_tuple(version: &str) -> Vec<u32> {
    version
        .split('.')
        .map(|part| part.parse::<u32>().unwrap_or(0))
        .collect()
}

fn command_result(
    action: &DeviceChannelAction,
    status: &str,
    ack: Option<String>,
    error_code: Option<DeviceRuntimeErrorCode>,
    error: Option<&str>,
) -> DeviceCommandResult {
    DeviceCommandResult {
        device_id: action.device_id.clone(),
        channel_id: action.channel_id.clone(),
        output_type: DeviceCommandOutputType::DeviceChannel,
        status: status.to_string(),
        ack,
        error_code,
        error: error.map(str::to_string),
    }
}

fn extension_command_result(
    action: &DeviceExtensionAction,
    status: &str,
    ack: Option<String>,
    error_code: Option<DeviceRuntimeErrorCode>,
    error: Option<&str>,
) -> DeviceCommandResult {
    DeviceCommandResult {
        device_id: action.device_id.clone(),
        channel_id: extension_action_channel_id(action.action).to_string(),
        output_type: extension_action_output_type(action.action),
        status: status.to_string(),
        ack,
        error_code,
        error: error.map(str::to_string),
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

fn is_unsupported_extension_display_primitive(
    ack: &ProtocolAck,
    action: DeviceExtensionActionType,
) -> bool {
    matches!(
        action,
        DeviceExtensionActionType::DisplayCard | DeviceExtensionActionType::DisplayLines
    ) && ack.error.as_deref() == Some("unsupported_command")
        && ack.channel.is_none()
}

fn display_status_fallback_action(action: &DeviceExtensionAction) -> Option<DeviceExtensionAction> {
    match action.action {
        DeviceExtensionActionType::DisplayCard => Some(DeviceExtensionAction {
            device_id: action.device_id.clone(),
            channel_id: None,
            action: DeviceExtensionActionType::DisplayStatus,
            status: action.status.clone(),
            title: action.title.clone(),
            message: action.message.clone(),
            icon: None,
            lines: None,
            pattern: None,
            control: None,
            active: None,
        }),
        DeviceExtensionActionType::DisplayLines => Some(DeviceExtensionAction {
            device_id: action.device_id.clone(),
            channel_id: None,
            action: DeviceExtensionActionType::DisplayStatus,
            status: Some(
                action
                    .status
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "notice".to_string()),
            ),
            title: Some(
                action
                    .title
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "CC Notice".to_string()),
            ),
            message: Some(display_lines_fallback_message(action.lines.as_ref())?),
            icon: None,
            lines: None,
            pattern: None,
            control: None,
            active: None,
        }),
        _ => None,
    }
}

fn display_lines_fallback_message(lines: Option<&Vec<String>>) -> Option<String> {
    let message = lines?
        .iter()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" / ");
    (!message.is_empty()).then_some(message)
}

pub(crate) fn input_event_from_ack_line(
    device_id: &str,
    channel_by_control: &std::collections::BTreeMap<String, String>,
    line: &str,
) -> Option<DeviceInputEvent> {
    let raw = DeviceInputEventAck::parse(line).ok()?;
    if raw.action != "press" {
        tracing::debug!(
            control = %raw.control,
            action = %raw.action,
            "ignored unsupported device input action"
        );
        return None;
    }
    let Some(channel_id) = channel_by_control.get(raw.control.as_str()) else {
        tracing::debug!(
            control = %raw.control,
            "ignored device input event without configured channel"
        );
        return None;
    };
    Some(DeviceInputEvent {
        device_id: device_id.to_string(),
        channel_id: channel_id.clone(),
        control: raw.control,
        action: DeviceInputEventAction::Press,
        seq: raw.seq,
        received_at: current_local_timestamp(),
    })
}

fn device_action_error_message(ack: ProtocolAck) -> String {
    match (ack.error.as_deref(), ack.channel.as_deref()) {
        (Some("unsupported_command"), None) => {
            "device firmware does not support current output command; please rebuild and flash the latest firmware".to_string()
        }
        _ => ack
            .error
            .unwrap_or_else(|| "device action failed".to_string()),
    }
}

fn device_action_error_code(ack: &ProtocolAck) -> DeviceRuntimeErrorCode {
    match (ack.error.as_deref(), ack.channel.as_deref()) {
        (Some("unsupported_command"), None) => {
            DeviceRuntimeErrorCode::DeviceProtocolUnsupportedCommand
        }
        _ => DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse,
    }
}

fn ack_is_pong(line: &str) -> bool {
    ProtocolAck::parse(line).map_or(false, |ack| {
        ack.ok && ack.ack_type.as_deref() == Some("pong")
    })
}

fn ack_is_unsupported_command(line: &str) -> bool {
    ProtocolAck::parse(line).map_or(false, |ack| {
        !ack.ok && ack.error.as_deref() == Some("unsupported_command")
    })
}

fn current_local_timestamp() -> String {
    let now = time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc());
    now.format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| now.unix_timestamp().to_string())
}

fn timestamp_after_millis(millis: u64) -> String {
    let now = time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc());
    let future = now + time::Duration::milliseconds(millis as i64);
    future
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| future.unix_timestamp().to_string())
}

fn timestamp_is_after_now(value: &str) -> bool {
    let Ok(timestamp) =
        time::OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339)
    else {
        return false;
    };
    let now = time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc());
    timestamp > now
}

#[cfg(test)]
#[path = "device_runtime_service_tests.rs"]
mod tests;
