use std::collections::{BTreeMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::app_services::device_runtime_service::input_event_from_ack_line;
use crate::core::device::DeviceInputEvent;
use crate::core::device_transport_monitor::{
    DeviceTransportMonitorCategory, DeviceTransportMonitorDirection, DeviceTransportMonitorEvent,
    DeviceTransportMonitorStatus,
};
use crate::core::protocol::{DeviceInfoAck, DeviceInputEventAck, ProtocolAck, ProtocolCommandV2};
use crate::infrastructure::transports::transport::DeviceTransport;

const DEVICE_INFO_MAX_ATTEMPTS: usize = 24;
const MAX_SKIPPED_LINES_PER_READ: usize = 16;
const MAX_PENDING_BACKGROUND_LINES: usize = 64;
const WORKER_IDLE_SLEEP_MS: u64 = 25;
const ACTION_RESPONSE_TIMEOUT_MS: u64 = 2_500;
const HEARTBEAT_RESPONSE_TIMEOUT_MS: u64 = 1_000;
const DEVICE_INFO_RESPONSE_TIMEOUT_MS: u64 = 12_000;

pub type DeviceInputEventCallback = Arc<dyn Fn(DeviceInputEvent) + Send + Sync + 'static>;

#[derive(Clone)]
pub struct DeviceTransportMonitorRecorder {
    is_active: Arc<dyn Fn(&str) -> bool + Send + Sync + 'static>,
    record_event: Arc<dyn Fn(DeviceTransportMonitorEvent) + Send + Sync + 'static>,
}

impl DeviceTransportMonitorRecorder {
    pub fn new(
        is_active: Arc<dyn Fn(&str) -> bool + Send + Sync + 'static>,
        record_event: Arc<dyn Fn(DeviceTransportMonitorEvent) + Send + Sync + 'static>,
    ) -> Self {
        Self {
            is_active,
            record_event,
        }
    }

    fn is_active(&self, device_id: &str) -> bool {
        (self.is_active)(device_id)
    }

    fn record(&self, event: DeviceTransportMonitorEvent) {
        (self.record_event)(event);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeviceIoErrorCode {
    WorkerStopped,
    ActionTimeout,
    DeviceInfoTimeout,
    TransportBusy,
    TransportPermissionDenied,
    TransportDisconnected,
    TransportError,
    ProtocolInvalidResponse,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceIoError {
    pub code: DeviceIoErrorCode,
    pub message: String,
}

impl DeviceIoError {
    pub fn new(code: DeviceIoErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn worker_stopped() -> Self {
        Self::new(
            DeviceIoErrorCode::WorkerStopped,
            "device io worker is not running",
        )
    }

    pub fn action_timeout() -> Self {
        Self::new(
            DeviceIoErrorCode::ActionTimeout,
            "device action response timed out",
        )
    }

    pub fn device_info_timeout() -> Self {
        Self::new(
            DeviceIoErrorCode::DeviceInfoTimeout,
            "device_info response timed out",
        )
    }

    pub fn protocol_invalid_response(message: impl Into<String>) -> Self {
        Self::new(DeviceIoErrorCode::ProtocolInvalidResponse, message)
    }

    pub fn transport(message: impl Into<String>) -> Self {
        let message = message.into();
        Self::new(classify_transport_error(&message), message)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceIoCommandResult {
    pub ack: Option<String>,
}

pub struct DeviceIoWorkerHandle {
    command_tx: mpsc::Sender<DeviceIoWorkerCommand>,
    sent_lines: Arc<Mutex<Vec<String>>>,
    running: Arc<AtomicBool>,
    stop_on_drop: bool,
}

impl DeviceIoWorkerHandle {
    pub fn start(
        device_id: String,
        board_id: Option<String>,
        transport_label: Option<String>,
        channel_by_control: BTreeMap<String, String>,
        transport: Box<dyn DeviceTransport>,
        input_callback: Option<DeviceInputEventCallback>,
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    ) -> Self {
        let (command_tx, command_rx) = mpsc::channel();
        let sent_lines = Arc::new(Mutex::new(Vec::new()));
        let running = Arc::new(AtomicBool::new(true));
        let worker_sent_lines = Arc::clone(&sent_lines);
        let worker_running = Arc::clone(&running);
        thread::spawn(move || {
            run_worker(
                device_id,
                board_id,
                transport_label,
                channel_by_control,
                transport,
                input_callback,
                monitor_recorder,
                command_rx,
                worker_sent_lines,
                worker_running,
            );
        });
        Self {
            command_tx,
            sent_lines,
            running,
            stop_on_drop: true,
        }
    }

    pub fn send_protocol_command(
        &self,
        command: ProtocolCommandV2,
    ) -> Result<DeviceIoCommandResult, DeviceIoError> {
        let expected_ack_type = command.expected_ack_type();
        let (response_tx, response_rx) = mpsc::channel();
        self.command_tx
            .send(DeviceIoWorkerCommand::SendProtocol {
                command,
                response_tx,
            })
            .map_err(|_| DeviceIoError::worker_stopped())?;
        response_rx
            .recv_timeout(Duration::from_millis(protocol_command_timeout_ms(
                expected_ack_type,
            )))
            .map_err(|_| DeviceIoError::action_timeout())?
    }

    pub fn query_device_info_line(&self) -> Result<Option<String>, DeviceIoError> {
        let (response_tx, response_rx) = mpsc::channel();
        self.command_tx
            .send(DeviceIoWorkerCommand::QueryDeviceInfo { response_tx })
            .map_err(|_| DeviceIoError::worker_stopped())?;
        response_rx
            .recv_timeout(Duration::from_millis(DEVICE_INFO_RESPONSE_TIMEOUT_MS))
            .map_err(|_| DeviceIoError::device_info_timeout())?
    }

    pub fn update_input_channels(&self, channel_by_control: BTreeMap<String, String>) {
        if self
            .command_tx
            .send(DeviceIoWorkerCommand::UpdateInputChannels { channel_by_control })
            .is_err()
        {
            tracing::debug!("device io worker already stopped before channel update");
        }
    }

    pub fn update_monitor_recorder(
        &self,
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    ) {
        if self
            .command_tx
            .send(DeviceIoWorkerCommand::UpdateMonitorRecorder { monitor_recorder })
            .is_err()
        {
            tracing::debug!("device io worker already stopped before monitor recorder update");
        }
    }

    pub fn stop(&self) {
        if self.command_tx.send(DeviceIoWorkerCommand::Stop).is_err() {
            tracing::debug!("device io worker already stopped");
        }
    }

    pub fn sent_lines(&self) -> Vec<String> {
        self.sent_lines
            .lock()
            .map(|lines| lines.clone())
            .unwrap_or_default()
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Acquire)
    }
}

impl Drop for DeviceIoWorkerHandle {
    fn drop(&mut self) {
        if self.stop_on_drop {
            let _ = self.command_tx.send(DeviceIoWorkerCommand::Stop);
        }
    }
}

impl Clone for DeviceIoWorkerHandle {
    fn clone(&self) -> Self {
        Self {
            command_tx: self.command_tx.clone(),
            sent_lines: Arc::clone(&self.sent_lines),
            running: Arc::clone(&self.running),
            stop_on_drop: false,
        }
    }
}

enum DeviceIoWorkerCommand {
    SendProtocol {
        command: ProtocolCommandV2,
        response_tx: mpsc::Sender<Result<DeviceIoCommandResult, DeviceIoError>>,
    },
    QueryDeviceInfo {
        response_tx: mpsc::Sender<Result<Option<String>, DeviceIoError>>,
    },
    UpdateInputChannels {
        channel_by_control: BTreeMap<String, String>,
    },
    UpdateMonitorRecorder {
        monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    },
    Stop,
}

fn run_worker(
    device_id: String,
    board_id: Option<String>,
    transport_label: Option<String>,
    mut channel_by_control: BTreeMap<String, String>,
    mut transport: Box<dyn DeviceTransport>,
    input_callback: Option<DeviceInputEventCallback>,
    mut monitor_recorder: Option<DeviceTransportMonitorRecorder>,
    command_rx: mpsc::Receiver<DeviceIoWorkerCommand>,
    sent_lines: Arc<Mutex<Vec<String>>>,
    running: Arc<AtomicBool>,
) {
    struct RunningGuard(Arc<AtomicBool>);
    impl Drop for RunningGuard {
        fn drop(&mut self) {
            self.0.store(false, Ordering::Release);
        }
    }
    let _running_guard = RunningGuard(running);
    let mut pending_lines = VecDeque::new();
    loop {
        let mut handled_command = false;
        while let Ok(command) = command_rx.try_recv() {
            handled_command = true;
            match command {
                DeviceIoWorkerCommand::SendProtocol {
                    command,
                    response_tx,
                } => {
                    let result = send_protocol_command(
                        transport.as_mut(),
                        &device_id,
                        &board_id,
                        &transport_label,
                        &channel_by_control,
                        command,
                        input_callback.as_ref(),
                        monitor_recorder.as_ref(),
                        &sent_lines,
                        &mut pending_lines,
                    );
                    let _ = response_tx.send(result);
                }
                DeviceIoWorkerCommand::QueryDeviceInfo { response_tx } => {
                    let result = query_device_info_line(
                        transport.as_mut(),
                        &device_id,
                        &board_id,
                        &transport_label,
                        monitor_recorder.as_ref(),
                        &sent_lines,
                        &mut pending_lines,
                    );
                    let _ = response_tx.send(result);
                }
                DeviceIoWorkerCommand::UpdateInputChannels {
                    channel_by_control: next_channels,
                } => {
                    channel_by_control = next_channels;
                }
                DeviceIoWorkerCommand::UpdateMonitorRecorder {
                    monitor_recorder: next_recorder,
                } => {
                    monitor_recorder = next_recorder;
                }
                DeviceIoWorkerCommand::Stop => {
                    if should_record_monitor_event(monitor_recorder.as_ref(), &device_id) {
                        record_monitor_event(
                            monitor_recorder.as_ref(),
                            monitor_event(
                                &device_id,
                                &board_id,
                                &transport_label,
                                DeviceTransportMonitorDirection::System,
                                DeviceTransportMonitorCategory::Connection,
                                DeviceTransportMonitorStatus::Stopped,
                                "device io worker stopped",
                            ),
                        );
                    }
                    return;
                }
            }
        }

        if !handled_command {
            thread::sleep(Duration::from_millis(WORKER_IDLE_SLEEP_MS));
            if let Ok(command) = command_rx.try_recv() {
                match command {
                    DeviceIoWorkerCommand::SendProtocol {
                        command,
                        response_tx,
                    } => {
                        let result = send_protocol_command(
                            transport.as_mut(),
                            &device_id,
                            &board_id,
                            &transport_label,
                            &channel_by_control,
                            command,
                            input_callback.as_ref(),
                            monitor_recorder.as_ref(),
                            &sent_lines,
                            &mut pending_lines,
                        );
                        let _ = response_tx.send(result);
                    }
                    DeviceIoWorkerCommand::QueryDeviceInfo { response_tx } => {
                        let result = query_device_info_line(
                            transport.as_mut(),
                            &device_id,
                            &board_id,
                            &transport_label,
                            monitor_recorder.as_ref(),
                            &sent_lines,
                            &mut pending_lines,
                        );
                        let _ = response_tx.send(result);
                    }
                    DeviceIoWorkerCommand::UpdateInputChannels {
                        channel_by_control: next_channels,
                    } => {
                        channel_by_control = next_channels;
                    }
                    DeviceIoWorkerCommand::UpdateMonitorRecorder {
                        monitor_recorder: next_recorder,
                    } => {
                        monitor_recorder = next_recorder;
                    }
                    DeviceIoWorkerCommand::Stop => {
                        if should_record_monitor_event(monitor_recorder.as_ref(), &device_id) {
                            record_monitor_event(
                                monitor_recorder.as_ref(),
                                monitor_event(
                                    &device_id,
                                    &board_id,
                                    &transport_label,
                                    DeviceTransportMonitorDirection::System,
                                    DeviceTransportMonitorCategory::Connection,
                                    DeviceTransportMonitorStatus::Stopped,
                                    "device io worker stopped",
                                ),
                            );
                        }
                        return;
                    }
                }
                continue;
            }
        }
        match transport.read_line() {
            Ok(Some(line)) => handle_background_line(
                &device_id,
                &board_id,
                &transport_label,
                &channel_by_control,
                &line,
                input_callback.as_ref(),
                monitor_recorder.as_ref(),
                &mut pending_lines,
            ),
            Ok(None) => thread::sleep(Duration::from_millis(WORKER_IDLE_SLEEP_MS)),
            Err(error) => {
                tracing::warn!(
                    device_id,
                    error,
                    "device io worker stopped after transport read failure"
                );
                if should_record_monitor_event(monitor_recorder.as_ref(), &device_id) {
                    record_monitor_event(
                        monitor_recorder.as_ref(),
                        monitor_event(
                            &device_id,
                            &board_id,
                            &transport_label,
                            DeviceTransportMonitorDirection::System,
                            DeviceTransportMonitorCategory::Error,
                            DeviceTransportMonitorStatus::Stopped,
                            "device io worker stopped after transport read failure",
                        )
                        .with_error_code("device-transport-disconnected")
                        .with_payload_preview(error),
                    );
                }
                return;
            }
        }
    }
}

fn send_protocol_command(
    transport: &mut dyn DeviceTransport,
    device_id: &str,
    board_id: &Option<String>,
    transport_label: &Option<String>,
    channel_by_control: &BTreeMap<String, String>,
    command: ProtocolCommandV2,
    input_callback: Option<&DeviceInputEventCallback>,
    monitor_recorder: Option<&DeviceTransportMonitorRecorder>,
    sent_lines: &Arc<Mutex<Vec<String>>>,
    pending_lines: &mut VecDeque<String>,
) -> Result<DeviceIoCommandResult, DeviceIoError> {
    let command_type = command.command_type().to_string();
    let expected_ack_type = command.expected_ack_type().to_string();
    let expected_channel = command.channel_id().map(ToOwned::to_owned);
    let line = command
        .to_json_line()
        .map_err(|error| DeviceIoError::protocol_invalid_response(error.to_string()))?;
    if should_record_monitor_event(monitor_recorder, device_id) {
        record_monitor_event(
            monitor_recorder,
            monitor_event(
                device_id,
                board_id,
                transport_label,
                DeviceTransportMonitorDirection::Outbound,
                monitor_command_category(
                    &expected_ack_type,
                    DeviceTransportMonitorCategory::Command,
                ),
                DeviceTransportMonitorStatus::Sent,
                format!("send {command_type}"),
            )
            .with_command(command_type.clone(), expected_channel.clone())
            .with_payload_preview(line.clone()),
        );
    }
    if let Err(error) = transport.send_line(&line) {
        let io_error = DeviceIoError::transport(error);
        if should_record_monitor_event(monitor_recorder, device_id) {
            record_monitor_event(
                monitor_recorder,
                monitor_event(
                    device_id,
                    board_id,
                    transport_label,
                    DeviceTransportMonitorDirection::Outbound,
                    DeviceTransportMonitorCategory::Error,
                    DeviceTransportMonitorStatus::Error,
                    format!("send {command_type} failed"),
                )
                .with_command(command_type.clone(), expected_channel.clone())
                .with_error_code(device_io_error_code_label(io_error.code))
                .with_payload_preview(io_error.message.clone()),
            );
        }
        return Err(io_error);
    }
    remember_sent_line(sent_lines, &line);
    let ack = match read_protocol_ack_line_for_command(
        transport,
        pending_lines,
        &expected_ack_type,
        expected_channel.as_deref(),
        &mut |line| {
            dispatch_input_event(
                device_id,
                board_id,
                transport_label,
                channel_by_control,
                line,
                input_callback,
                monitor_recorder,
            )
        },
    ) {
        Ok(ack) => ack,
        Err(error) => {
            if should_record_monitor_event(monitor_recorder, device_id) {
                record_monitor_event(
                    monitor_recorder,
                    monitor_event(
                        device_id,
                        board_id,
                        transport_label,
                        DeviceTransportMonitorDirection::Inbound,
                        DeviceTransportMonitorCategory::Error,
                        DeviceTransportMonitorStatus::Stopped,
                        format!("read {expected_ack_type} failed"),
                    )
                    .with_command(expected_ack_type, expected_channel)
                    .with_error_code(device_io_error_code_label(error.code))
                    .with_payload_preview(error.message.clone()),
                );
            }
            return Err(error);
        }
    };
    if ack.is_none() {
        if should_record_monitor_event(monitor_recorder, device_id) {
            record_monitor_event(
                monitor_recorder,
                monitor_event(
                    device_id,
                    board_id,
                    transport_label,
                    DeviceTransportMonitorDirection::Inbound,
                    monitor_command_category(
                        &expected_ack_type,
                        DeviceTransportMonitorCategory::Heartbeat,
                    ),
                    DeviceTransportMonitorStatus::Timeout,
                    format!("wait {expected_ack_type} timed out"),
                )
                .with_command(expected_ack_type, expected_channel)
                .with_error_code("device-action-timeout"),
            );
        }
        return Err(DeviceIoError::action_timeout());
    }
    if let Some(ack_line) = &ack {
        if should_record_monitor_event(monitor_recorder, device_id) {
            record_monitor_event(
                monitor_recorder,
                monitor_event(
                    device_id,
                    board_id,
                    transport_label,
                    DeviceTransportMonitorDirection::Inbound,
                    monitor_command_category(
                        &expected_ack_type,
                        DeviceTransportMonitorCategory::Ack,
                    ),
                    DeviceTransportMonitorStatus::Ok,
                    "received protocol ack",
                )
                .with_command(expected_ack_type, expected_channel)
                .with_payload_preview(ack_line.clone()),
            );
        }
    }
    Ok(DeviceIoCommandResult { ack })
}

fn query_device_info_line(
    transport: &mut dyn DeviceTransport,
    device_id: &str,
    board_id: &Option<String>,
    transport_label: &Option<String>,
    monitor_recorder: Option<&DeviceTransportMonitorRecorder>,
    sent_lines: &Arc<Mutex<Vec<String>>>,
    pending_lines: &mut VecDeque<String>,
) -> Result<Option<String>, DeviceIoError> {
    let command = ProtocolCommandV2::device_info();
    let command_type = command.command_type().to_string();
    let line = command
        .to_json_line()
        .map_err(|error| DeviceIoError::protocol_invalid_response(error.to_string()))?;
    for attempt in 0..DEVICE_INFO_MAX_ATTEMPTS {
        if should_record_monitor_event(monitor_recorder, device_id) {
            record_monitor_event(
                monitor_recorder,
                monitor_event(
                    device_id,
                    board_id,
                    transport_label,
                    DeviceTransportMonitorDirection::Outbound,
                    DeviceTransportMonitorCategory::Command,
                    DeviceTransportMonitorStatus::Sent,
                    format!("send {command_type}"),
                )
                .with_command(command_type.clone(), None)
                .with_payload_preview(line.clone()),
            );
        }
        if let Err(error) = transport.send_line(&line) {
            let io_error = DeviceIoError::transport(error);
            if should_record_monitor_event(monitor_recorder, device_id) {
                record_monitor_event(
                    monitor_recorder,
                    monitor_event(
                        device_id,
                        board_id,
                        transport_label,
                        DeviceTransportMonitorDirection::Outbound,
                        DeviceTransportMonitorCategory::Error,
                        DeviceTransportMonitorStatus::Error,
                        format!("send {command_type} failed"),
                    )
                    .with_command(command_type.clone(), None)
                    .with_error_code(device_io_error_code_label(io_error.code))
                    .with_payload_preview(io_error.message.clone()),
                );
            }
            return Err(io_error);
        }
        remember_sent_line(sent_lines, &line);
        match read_device_info_ack_line(transport, pending_lines) {
            Ok(Some(ack_line)) => {
                if should_record_monitor_event(monitor_recorder, device_id) {
                    record_monitor_event(
                        monitor_recorder,
                        monitor_event(
                            device_id,
                            board_id,
                            transport_label,
                            DeviceTransportMonitorDirection::Inbound,
                            DeviceTransportMonitorCategory::Ack,
                            DeviceTransportMonitorStatus::Ok,
                            "received device_info ack",
                        )
                        .with_command(command_type.clone(), None)
                        .with_payload_preview(ack_line.clone()),
                    );
                }
                return Ok(Some(ack_line));
            }
            Ok(None) => {}
            Err(error) => {
                if should_record_monitor_event(monitor_recorder, device_id) {
                    record_monitor_event(
                        monitor_recorder,
                        monitor_event(
                            device_id,
                            board_id,
                            transport_label,
                            DeviceTransportMonitorDirection::Inbound,
                            DeviceTransportMonitorCategory::Error,
                            DeviceTransportMonitorStatus::Stopped,
                            "read device_info failed",
                        )
                        .with_command(command_type, None)
                        .with_error_code(device_io_error_code_label(error.code))
                        .with_payload_preview(error.message.clone()),
                    );
                }
                return Err(error);
            }
        }
        tracing::debug!(
            attempt = attempt + 1,
            max_attempts = DEVICE_INFO_MAX_ATTEMPTS,
            "device_info response not ready, retrying from io worker"
        );
    }
    if should_record_monitor_event(monitor_recorder, device_id) {
        record_monitor_event(
            monitor_recorder,
            monitor_event(
                device_id,
                board_id,
                transport_label,
                DeviceTransportMonitorDirection::Inbound,
                DeviceTransportMonitorCategory::Ack,
                DeviceTransportMonitorStatus::Timeout,
                "wait device_info timed out",
            )
            .with_command(command_type, None)
            .with_error_code("device-info-timeout"),
        );
    }
    Ok(None)
}

fn handle_background_line(
    device_id: &str,
    board_id: &Option<String>,
    transport_label: &Option<String>,
    channel_by_control: &BTreeMap<String, String>,
    line: &str,
    input_callback: Option<&DeviceInputEventCallback>,
    monitor_recorder: Option<&DeviceTransportMonitorRecorder>,
    pending_lines: &mut VecDeque<String>,
) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        push_pending_background_line(pending_lines, line);
        return;
    }
    let Some(json_start) = trimmed.find('{') else {
        push_pending_background_line(pending_lines, line);
        return;
    };
    let candidate = &trimmed[json_start..];
    if DeviceInputEventAck::parse(candidate).is_ok() {
        dispatch_input_event(
            device_id,
            board_id,
            transport_label,
            channel_by_control,
            candidate,
            input_callback,
            monitor_recorder,
        );
        return;
    }
    push_pending_background_line(pending_lines, line);
}

fn dispatch_input_event(
    device_id: &str,
    board_id: &Option<String>,
    transport_label: &Option<String>,
    channel_by_control: &BTreeMap<String, String>,
    line: &str,
    input_callback: Option<&DeviceInputEventCallback>,
    monitor_recorder: Option<&DeviceTransportMonitorRecorder>,
) {
    let Some(event) = input_event_from_ack_line(device_id, channel_by_control, line) else {
        return;
    };
    tracing::debug!(
        device_id = %event.device_id,
        channel_id = %event.channel_id,
        control = %event.control,
        seq = event.seq,
        "device io worker dispatched input event"
    );
    if should_record_monitor_event(monitor_recorder, device_id) {
        record_monitor_event(
            monitor_recorder,
            monitor_event(
                device_id,
                board_id,
                transport_label,
                DeviceTransportMonitorDirection::Inbound,
                DeviceTransportMonitorCategory::InputEvent,
                DeviceTransportMonitorStatus::Ok,
                format!(
                    "input {} {}",
                    event.control,
                    device_input_event_action_label(event.action)
                ),
            )
            .with_control(event.control.clone(), Some(event.channel_id.clone()))
            .with_payload_preview(line.to_string()),
        );
    }
    if let Some(callback) = input_callback {
        callback(event);
    }
}

fn record_monitor_event(
    recorder: Option<&DeviceTransportMonitorRecorder>,
    event: DeviceTransportMonitorEvent,
) {
    if let Some(recorder) = recorder {
        recorder.record(event);
    }
}

fn should_record_monitor_event(
    recorder: Option<&DeviceTransportMonitorRecorder>,
    device_id: &str,
) -> bool {
    recorder
        .map(|recorder| recorder.is_active(device_id))
        .unwrap_or(false)
}

fn monitor_event(
    device_id: &str,
    board_id: &Option<String>,
    transport_label: &Option<String>,
    direction: DeviceTransportMonitorDirection,
    category: DeviceTransportMonitorCategory,
    status: DeviceTransportMonitorStatus,
    summary: impl Into<String>,
) -> DeviceTransportMonitorEvent {
    DeviceTransportMonitorEvent::new(
        device_id.to_string(),
        board_id.clone(),
        direction,
        category,
        status,
    )
    .with_transport("serial", transport_label.clone())
    .with_summary(summary)
}

fn monitor_command_category(
    expected_ack_type: &str,
    default_category: DeviceTransportMonitorCategory,
) -> DeviceTransportMonitorCategory {
    if expected_ack_type == "pong" {
        return DeviceTransportMonitorCategory::Heartbeat;
    }
    default_category
}

fn device_io_error_code_label(code: DeviceIoErrorCode) -> &'static str {
    match code {
        DeviceIoErrorCode::WorkerStopped => "device-io-worker-stopped",
        DeviceIoErrorCode::ActionTimeout => "device-action-timeout",
        DeviceIoErrorCode::DeviceInfoTimeout => "device-info-timeout",
        DeviceIoErrorCode::TransportBusy => "device-transport-busy",
        DeviceIoErrorCode::TransportPermissionDenied => "device-transport-permission-denied",
        DeviceIoErrorCode::TransportDisconnected => "device-transport-disconnected",
        DeviceIoErrorCode::TransportError => "device-transport-error",
        DeviceIoErrorCode::ProtocolInvalidResponse => "device-protocol-invalid-response",
    }
}

fn device_input_event_action_label(
    action: crate::core::device::DeviceInputEventAction,
) -> &'static str {
    match action {
        crate::core::device::DeviceInputEventAction::Press => "press",
    }
}

fn remember_sent_line(sent_lines: &Arc<Mutex<Vec<String>>>, line: &str) {
    match sent_lines.lock() {
        Ok(mut lines) => lines.push(line.to_string()),
        Err(error) => tracing::warn!(error = %error, "failed to record device sent line"),
    }
}

fn push_pending_background_line(pending_lines: &mut VecDeque<String>, line: &str) {
    pending_lines.push_back(line.to_string());
    while pending_lines.len() > MAX_PENDING_BACKGROUND_LINES {
        pending_lines.pop_front();
    }
}

fn read_protocol_ack_line_for_command<F>(
    transport: &mut dyn DeviceTransport,
    pending_lines: &mut VecDeque<String>,
    expected_type: &str,
    expected_channel: Option<&str>,
    input_handler: &mut F,
) -> Result<Option<String>, DeviceIoError>
where
    F: FnMut(&str),
{
    let mut skipped = 0;
    let mut fallback_ack = None;
    loop {
        let Some(line) = next_worker_line(transport, pending_lines)? else {
            return Ok(fallback_ack);
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            skipped += 1;
            if skipped >= MAX_SKIPPED_LINES_PER_READ {
                return Ok(fallback_ack);
            }
            continue;
        }
        let Some(json_start) = trimmed.find('{') else {
            skipped += 1;
            if skipped >= MAX_SKIPPED_LINES_PER_READ {
                return Ok(fallback_ack);
            }
            continue;
        };
        let line = &trimmed[json_start..];
        if DeviceInputEventAck::parse(line).is_ok() {
            input_handler(line);
            tracing::debug!(
                input_event = line,
                "dispatched device input event while waiting worker ack"
            );
            continue;
        }
        if let Ok(ack) = ProtocolAck::parse(line) {
            if ack.error.as_deref() == Some("empty_command") {
                continue;
            }
            if !ack.ok {
                if expected_channel.is_some()
                    && ack.channel.is_some()
                    && ack.channel.as_deref() != expected_channel
                {
                    continue;
                }
                if expected_channel.is_some() && ack.channel.is_none() && ack.ack_type.is_none() {
                    fallback_ack.get_or_insert_with(|| line.to_string());
                    continue;
                }
                return Ok(Some(line.to_string()));
            }
            if expected_channel.is_some() {
                if ack.ack_type.as_deref() == Some(expected_type)
                    && ack.channel.as_deref() == expected_channel
                {
                    return Ok(Some(line.to_string()));
                }
                continue;
            }
            if ack.ack_type.as_deref() == Some(expected_type) {
                return Ok(Some(line.to_string()));
            }
            continue;
        }
        if legacy_ok_ack(line) {
            fallback_ack.get_or_insert_with(|| line.to_string());
            continue;
        }
        skipped += 1;
        if skipped >= MAX_SKIPPED_LINES_PER_READ {
            return Ok(fallback_ack);
        }
    }
}

fn read_device_info_ack_line(
    transport: &mut dyn DeviceTransport,
    pending_lines: &mut VecDeque<String>,
) -> Result<Option<String>, DeviceIoError> {
    read_json_line_matching(transport, pending_lines, |line| {
        DeviceInfoAck::parse(line).map_or(false, |ack| {
            if ack.error.as_deref() == Some("empty_command") {
                return false;
            }
            !ack.ok || ack.ack_type.as_deref() == Some("device_info")
        })
    })
}

fn read_json_line_matching<F>(
    transport: &mut dyn DeviceTransport,
    pending_lines: &mut VecDeque<String>,
    mut matches: F,
) -> Result<Option<String>, DeviceIoError>
where
    F: FnMut(&str) -> bool,
{
    let mut skipped = 0;
    loop {
        let Some(line) = next_worker_line(transport, pending_lines)? else {
            return Ok(None);
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            skipped += 1;
            if skipped >= MAX_SKIPPED_LINES_PER_READ {
                return Ok(None);
            }
            continue;
        }
        if let Some(json_start) = trimmed.find('{') {
            let candidate = &trimmed[json_start..];
            if matches(candidate) {
                return Ok(Some(candidate.to_string()));
            }
        }
        skipped += 1;
        if skipped >= MAX_SKIPPED_LINES_PER_READ {
            return Ok(None);
        }
    }
}

fn next_worker_line(
    transport: &mut dyn DeviceTransport,
    pending_lines: &mut VecDeque<String>,
) -> Result<Option<String>, DeviceIoError> {
    if let Some(line) = pending_lines.pop_front() {
        return Ok(Some(line));
    }
    transport.read_line().map_err(DeviceIoError::transport)
}

fn legacy_ok_ack(line: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(line)
        .ok()
        .and_then(|value| value.get("ok").and_then(serde_json::Value::as_bool))
        == Some(true)
}

fn protocol_command_timeout_ms(expected_ack_type: &str) -> u64 {
    match expected_ack_type {
        "pong" => HEARTBEAT_RESPONSE_TIMEOUT_MS,
        _ => ACTION_RESPONSE_TIMEOUT_MS,
    }
}

fn classify_transport_error(error: &str) -> DeviceIoErrorCode {
    let normalized = error.to_ascii_lowercase();
    if normalized.contains("resource busy") || normalized.contains("device or resource busy") {
        return DeviceIoErrorCode::TransportBusy;
    }
    if normalized.contains("access denied") || normalized.contains("permission denied") {
        return DeviceIoErrorCode::TransportPermissionDenied;
    }
    if normalized.contains("broken pipe")
        || normalized.contains("input/output error")
        || normalized.contains("no such file or directory")
        || normalized.contains("device not configured")
    {
        return DeviceIoErrorCode::TransportDisconnected;
    }
    DeviceIoErrorCode::TransportError
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::transports::mock::MockDeviceTransport;

    #[test]
    fn worker_records_events_after_runtime_monitor_recorder_update() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"pong"}"#.to_string(),
            r#"{"ok":true,"v":2,"type":"pong"}"#.to_string(),
        ]);
        let worker = DeviceIoWorkerHandle::start(
            "desk-pico".to_string(),
            Some("rp2040-pico".to_string()),
            Some("/dev/test".to_string()),
            BTreeMap::new(),
            Box::new(transport),
            None,
            None,
        );

        worker
            .send_protocol_command(ProtocolCommandV2::ping())
            .expect("first ping should work without monitor recorder");

        let recorded_events = Arc::new(Mutex::new(Vec::<DeviceTransportMonitorEvent>::new()));
        let recorder_events = Arc::clone(&recorded_events);
        worker.update_monitor_recorder(Some(DeviceTransportMonitorRecorder::new(
            Arc::new(|_| true),
            Arc::new(move |event| {
                recorder_events
                    .lock()
                    .expect("recorded events lock should not be poisoned")
                    .push(event);
            }),
        )));

        worker
            .send_protocol_command(ProtocolCommandV2::ping())
            .expect("second ping should work with monitor recorder");

        let events = recorded_events
            .lock()
            .expect("recorded events lock should not be poisoned");
        assert_eq!(2, events.len());
        assert_eq!(
            DeviceTransportMonitorDirection::Outbound,
            events[0].direction
        );
        assert_eq!(
            DeviceTransportMonitorCategory::Heartbeat,
            events[0].category
        );
        assert_eq!(DeviceTransportMonitorStatus::Sent, events[0].status);
        assert_eq!(
            DeviceTransportMonitorDirection::Inbound,
            events[1].direction
        );
        assert_eq!(
            DeviceTransportMonitorCategory::Heartbeat,
            events[1].category
        );

        worker.stop();
    }

    #[test]
    fn worker_records_device_info_query_events() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.1","protocol_version":2}"#.to_string(),
        ]);
        let recorded_events = Arc::new(Mutex::new(Vec::<DeviceTransportMonitorEvent>::new()));
        let recorder_events = Arc::clone(&recorded_events);
        let worker = DeviceIoWorkerHandle::start(
            "desk-pico".to_string(),
            Some("rp2040-pico".to_string()),
            Some("/dev/test".to_string()),
            BTreeMap::new(),
            Box::new(transport),
            None,
            Some(DeviceTransportMonitorRecorder::new(
                Arc::new(|_| true),
                Arc::new(move |event| {
                    recorder_events
                        .lock()
                        .expect("recorded events lock should not be poisoned")
                        .push(event);
                }),
            )),
        );

        let ack = worker
            .query_device_info_line()
            .expect("device_info query should succeed")
            .expect("device_info ack should be returned");

        assert!(ack.contains(r#""type":"device_info""#));
        let events = recorded_events
            .lock()
            .expect("recorded events lock should not be poisoned");
        assert_eq!(2, events.len());
        assert_eq!(
            DeviceTransportMonitorDirection::Outbound,
            events[0].direction
        );
        assert_eq!("device_info", events[0].command_type.as_deref().unwrap());
        assert_eq!(DeviceTransportMonitorStatus::Sent, events[0].status);
        assert_eq!(
            DeviceTransportMonitorDirection::Inbound,
            events[1].direction
        );
        assert_eq!("device_info", events[1].command_type.as_deref().unwrap());
        assert_eq!(DeviceTransportMonitorStatus::Ok, events[1].status);

        worker.stop();
    }
}
