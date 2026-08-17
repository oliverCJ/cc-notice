use std::io::{Cursor, Read};
use std::sync::mpsc::{self, SyncSender, TrySendError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tiny_http::{Header, Request, Response, Server};

use crate::app_services::device_runtime_event_service::DeviceRuntimeEventService;
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::app_services::inbound_event_service::{
    InboundEventOrigin, InboundEventService, SubmitRelayEventRequest, SubmitRelayEventResult,
};
use crate::app_services::output_executor::{
    NativeLocalOutputExecutor, NativeOutputExecutor, NativeWebhookExecutor, NoopOutputExecutor,
    OutputExecutor,
};
use crate::app_services::relay_event_pipeline_service::{
    record_runtime_event, RelayEventPipelineService, RuntimeMonitorRecorder,
    SharedRuntimeMonitorRecorder,
};
use crate::app_services::runtime_monitor::RuntimeMonitorService;
use crate::core::app_config::DEFAULT_LOCAL_HOOK_PORT;
use crate::core::profiles::NoticeProfile;
use crate::infrastructure::time_utils::current_local_rfc3339_timestamp;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHookServerStatus {
    pub running: bool,
    pub port: u16,
    pub bind_address: String,
    pub event_url: String,
    pub health_url: String,
    pub error: Option<String>,
}

pub struct LocalHookServerService;

pub type SharedHookAuthToken = Arc<Mutex<String>>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalHookHttpResponse {
    pub status_code: u16,
    pub body: String,
}

struct PreparedAsyncHookEvent {
    response: LocalHookHttpResponse,
    work: Option<AsyncHookPipelineWork>,
    debug_entry_id: Option<String>,
}

#[derive(Clone)]
struct AsyncHookPipelineWork {
    request: SubmitRelayEventRequest,
    origin: InboundEventOrigin,
    result: SubmitRelayEventResult,
    profile: NoticeProfile,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AsyncHookOutputKind {
    Device,
    Webhook,
    Local,
}

struct AsyncHookOutputWork {
    kind: AsyncHookOutputKind,
    pipeline: AsyncHookPipelineWork,
}

impl AsyncHookOutputWork {
    fn run(
        self,
        inbound_service: Arc<Mutex<InboundEventService>>,
        webhook_executor: Arc<Mutex<NativeWebhookExecutor>>,
        local_output_executor: Arc<Mutex<NativeLocalOutputExecutor>>,
        device_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
        runtime_monitor: Arc<Mutex<RuntimeMonitorService>>,
        app: tauri::AppHandle,
    ) {
        let processing_started = Instant::now();
        let request = self.pipeline.request;
        let origin = self.pipeline.origin;
        let mut result = self.pipeline.result;
        let profile = self.pipeline.profile;
        let debug_entry_id = result.debug_entry_id.clone();
        let mut monitor_recorder = SharedRuntimeMonitorRecorder::new(Arc::clone(&runtime_monitor));
        let processing_result = match self.kind {
            AsyncHookOutputKind::Device => {
                let device_results =
                    RelayEventPipelineService::dispatch_device_outputs_for_result_with_shared_registry(
                        &profile,
                        Arc::clone(&device_registry),
                        Some(&mut monitor_recorder),
                        origin,
                        &request,
                        &mut result,
                    );
                if let Ok(mut service) = inbound_service.lock() {
                    service.attach_device_results_to_debug_log(&debug_entry_id, device_results);
                    service.mark_debug_log_output_processing_timing(
                        &debug_entry_id,
                        output_kind_label(self.kind),
                        processing_started.elapsed().as_millis() as u64,
                    );
                }
                Ok(())
            }
            AsyncHookOutputKind::Webhook => match webhook_executor.lock() {
                Ok(mut executor) => {
                    RelayEventPipelineService::execute_software_outputs_for_result(
                        &mut *executor,
                        Some(&mut monitor_recorder),
                        origin,
                        &result,
                        |output_type| {
                            output_type == crate::core::profiles::HardwareOutputType::Webhook
                        },
                    );
                    if let Ok(mut service) = inbound_service.lock() {
                        service.mark_debug_log_output_processing_timing(
                            &debug_entry_id,
                            output_kind_label(self.kind),
                            processing_started.elapsed().as_millis() as u64,
                        );
                    }
                    Ok(())
                }
                Err(error) => Err(error.to_string()),
            },
            AsyncHookOutputKind::Local => match local_output_executor.lock() {
                Ok(mut executor) => {
                    RelayEventPipelineService::execute_software_outputs_for_result(
                        &mut *executor,
                        Some(&mut monitor_recorder),
                        origin,
                        &result,
                        |output_type| {
                            matches!(
                                output_type,
                                crate::core::profiles::HardwareOutputType::SystemNotification
                                    | crate::core::profiles::HardwareOutputType::Sound
                                    | crate::core::profiles::HardwareOutputType::DesktopNotice
                            )
                        },
                    );
                    if let Ok(mut service) = inbound_service.lock() {
                        service.mark_debug_log_output_processing_timing(
                            &debug_entry_id,
                            output_kind_label(self.kind),
                            processing_started.elapsed().as_millis() as u64,
                        );
                    }
                    Ok(())
                }
                Err(error) => Err(error.to_string()),
            },
        };

        if let Err(error) = processing_result {
            tracing::warn!("async hook pipeline failed: {error}");
            if let Ok(mut service) = inbound_service.lock() {
                service.mark_debug_log_processing_failure(
                    &debug_entry_id,
                    processing_started.elapsed().as_millis() as u64,
                    error,
                );
            }
        }
        if let Err(error) = DeviceRuntimeEventService::emit_hook_device_output_update(&app, &result)
        {
            tracing::warn!("failed to emit device runtime update after hook event: {error}");
        }
    }
}

impl AsyncHookPipelineWork {
    fn debug_entry_id(&self) -> &str {
        &self.result.debug_entry_id
    }
}

struct QueuedAsyncHookPipelineWork {
    work: AsyncHookPipelineWork,
    enqueued_at: Instant,
}

impl QueuedAsyncHookPipelineWork {
    fn is_expired(&self, ttl: Duration) -> bool {
        self.enqueued_at.elapsed() > ttl
    }
}

struct QueuedAsyncHookOutputWork {
    work: AsyncHookOutputWork,
    enqueued_at: Instant,
}

impl QueuedAsyncHookOutputWork {
    fn is_expired(&self, ttl: Duration) -> bool {
        self.enqueued_at.elapsed() > ttl
    }
}

#[derive(Clone)]
struct AsyncHookOutputQueues {
    device: SyncSender<QueuedAsyncHookOutputWork>,
    webhook: SyncSender<QueuedAsyncHookOutputWork>,
    local: SyncSender<QueuedAsyncHookOutputWork>,
    ttl: Duration,
}

impl AsyncHookOutputQueues {
    fn start(
        capacity: usize,
        ttl: Duration,
        inbound_service: Arc<Mutex<InboundEventService>>,
        webhook_executor: Arc<Mutex<NativeWebhookExecutor>>,
        local_output_executor: Arc<Mutex<NativeLocalOutputExecutor>>,
        device_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
        runtime_monitor: Arc<Mutex<RuntimeMonitorService>>,
        app: tauri::AppHandle,
    ) -> Self {
        let device = start_output_worker(
            AsyncHookOutputKind::Device,
            capacity,
            ttl,
            Arc::clone(&inbound_service),
            Arc::clone(&webhook_executor),
            Arc::clone(&local_output_executor),
            Arc::clone(&device_registry),
            Arc::clone(&runtime_monitor),
            app.clone(),
        );
        let webhook = start_output_worker(
            AsyncHookOutputKind::Webhook,
            capacity,
            ttl,
            Arc::clone(&inbound_service),
            Arc::clone(&webhook_executor),
            Arc::clone(&local_output_executor),
            Arc::clone(&device_registry),
            Arc::clone(&runtime_monitor),
            app.clone(),
        );
        let local = start_output_worker(
            AsyncHookOutputKind::Local,
            capacity,
            ttl,
            inbound_service,
            webhook_executor,
            local_output_executor,
            device_registry,
            runtime_monitor,
            app,
        );
        Self {
            device,
            webhook,
            local,
            ttl,
        }
    }

    fn enqueue_all(&self, work: AsyncHookPipelineWork) -> Vec<&'static str> {
        let mut dropped = Vec::new();
        let required_kinds = required_output_kinds_for_result(&work.result);
        for (index, kind) in required_kinds.iter().copied().enumerate() {
            let pipeline = if index + 1 == required_kinds.len() {
                work.clone()
            } else {
                work.clone()
            };
            if let Err(kind) = self.enqueue(kind, pipeline) {
                dropped.push(kind);
            }
        }
        dropped
    }

    fn enqueue(
        &self,
        kind: AsyncHookOutputKind,
        pipeline: AsyncHookPipelineWork,
    ) -> Result<(), &'static str> {
        let debug_entry_id = pipeline.debug_entry_id().to_string();
        let queued = QueuedAsyncHookOutputWork {
            work: AsyncHookOutputWork { kind, pipeline },
            enqueued_at: Instant::now(),
        };
        let result = match kind {
            AsyncHookOutputKind::Device => self.device.try_send(queued),
            AsyncHookOutputKind::Webhook => self.webhook.try_send(queued),
            AsyncHookOutputKind::Local => self.local.try_send(queued),
        };
        if let Err(error) = result {
            let output_label = output_kind_label(kind);
            tracing::warn!(
                output_kind = output_label,
                ttl_ms = self.ttl.as_millis() as u64,
                "async hook output queue is full; dropping output task"
            );
            drop(error);
            // Debug drop is recorded by the inbound queue caller because this helper has no service lock.
            tracing::debug!(
                debug_entry_id,
                output_kind = output_label,
                "hook output task dropped"
            );
            Err(output_label)
        } else {
            Ok(())
        }
    }
}

fn start_output_worker(
    kind: AsyncHookOutputKind,
    capacity: usize,
    ttl: Duration,
    inbound_service: Arc<Mutex<InboundEventService>>,
    webhook_executor: Arc<Mutex<NativeWebhookExecutor>>,
    local_output_executor: Arc<Mutex<NativeLocalOutputExecutor>>,
    device_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    runtime_monitor: Arc<Mutex<RuntimeMonitorService>>,
    app: tauri::AppHandle,
) -> SyncSender<QueuedAsyncHookOutputWork> {
    let (sender, receiver) = mpsc::sync_channel::<QueuedAsyncHookOutputWork>(capacity);
    thread::spawn(move || {
        while let Ok(queued) = receiver.recv() {
            if queued.is_expired(ttl) {
                let debug_entry_id = queued.work.pipeline.debug_entry_id().to_string();
                tracing::warn!(
                    output_kind = output_kind_label(kind),
                    "async hook output work expired before processing"
                );
                if let Ok(mut service) = inbound_service.lock() {
                    service.mark_debug_log_output_processing_dropped(
                        &debug_entry_id,
                        output_kind_label(kind),
                        "expired",
                        format!(
                            "{} output processing expired before execution",
                            output_kind_label(kind)
                        ),
                    );
                }
                continue;
            }
            queued.work.run(
                Arc::clone(&inbound_service),
                Arc::clone(&webhook_executor),
                Arc::clone(&local_output_executor),
                Arc::clone(&device_registry),
                Arc::clone(&runtime_monitor),
                app.clone(),
            );
        }
    });
    sender
}

fn output_kind_label(kind: AsyncHookOutputKind) -> &'static str {
    match kind {
        AsyncHookOutputKind::Device => "device",
        AsyncHookOutputKind::Webhook => "webhook",
        AsyncHookOutputKind::Local => "local",
    }
}

fn required_output_kinds_for_result(result: &SubmitRelayEventResult) -> Vec<AsyncHookOutputKind> {
    let mut has_device = false;
    let mut has_webhook = false;
    let mut has_local = false;
    for output in &result.outputs {
        match output.output_type {
            crate::core::profiles::HardwareOutputType::DeviceChannel
            | crate::core::profiles::HardwareOutputType::Display
            | crate::core::profiles::HardwareOutputType::Buzzer => has_device = true,
            crate::core::profiles::HardwareOutputType::Webhook => has_webhook = true,
            crate::core::profiles::HardwareOutputType::SystemNotification
            | crate::core::profiles::HardwareOutputType::Sound
            | crate::core::profiles::HardwareOutputType::DesktopNotice => has_local = true,
            crate::core::profiles::HardwareOutputType::Custom => {
                tracing::warn!("custom output is not supported by async hook output queues");
            }
        }
    }

    let mut kinds = Vec::new();
    if has_device {
        kinds.push(AsyncHookOutputKind::Device);
    }
    if has_webhook {
        kinds.push(AsyncHookOutputKind::Webhook);
    }
    if has_local {
        kinds.push(AsyncHookOutputKind::Local);
    }
    kinds
}

struct AsyncHookWorkQueue {
    sender: SyncSender<QueuedAsyncHookPipelineWork>,
    ttl: Duration,
}

impl AsyncHookWorkQueue {
    fn start(
        capacity: usize,
        ttl: Duration,
        inbound_service: Arc<Mutex<InboundEventService>>,
        runtime_monitor: Arc<Mutex<RuntimeMonitorService>>,
        output_queues: AsyncHookOutputQueues,
    ) -> Self {
        let (sender, receiver) = mpsc::sync_channel::<QueuedAsyncHookPipelineWork>(capacity);
        thread::spawn(move || {
            while let Ok(queued) = receiver.recv() {
                if queued.is_expired(ttl) {
                    let debug_entry_id = queued.work.debug_entry_id().to_string();
                    tracing::warn!("async hook pipeline work expired before processing");
                    if let Ok(mut service) = inbound_service.lock() {
                        service.mark_debug_log_processing_dropped(
                            &debug_entry_id,
                            "expired",
                            "async hook processing expired before execution".to_string(),
                        );
                    }
                    continue;
                }
                let queue_delay_ms = queued.enqueued_at.elapsed().as_millis() as u64;
                let debug_entry_id = queued.work.debug_entry_id().to_string();
                if let Ok(mut service) = inbound_service.lock() {
                    service.mark_debug_log_queue_delay(&debug_entry_id, queue_delay_ms);
                }
                if queued.work.origin.counts_for_runtime_monitor() {
                    let mut monitor_recorder =
                        SharedRuntimeMonitorRecorder::new(Arc::clone(&runtime_monitor));
                    record_runtime_event(
                        &mut monitor_recorder,
                        &queued.work.request,
                        Some(queued.work.result.internal_event.clone()),
                        crate::app_services::runtime_monitor::RuntimeRecordOutcome::Success,
                    );
                }
                let debug_entry_id = queued.work.debug_entry_id().to_string();
                let dropped = output_queues.enqueue_all(queued.work);
                if !dropped.is_empty() {
                    if let Ok(mut service) = inbound_service.lock() {
                        for output_kind in dropped {
                            service.mark_debug_log_output_processing_dropped(
                                &debug_entry_id,
                                output_kind,
                                "dropped",
                                "async hook output queue is full".to_string(),
                            );
                        }
                    }
                }
            }
        });
        Self { sender, ttl }
    }

    fn enqueue(&self, work: AsyncHookPipelineWork) -> Result<(), AsyncHookPipelineWork> {
        self.sender
            .try_send(QueuedAsyncHookPipelineWork {
                work,
                enqueued_at: Instant::now(),
            })
            .map_err(|error| match error {
                TrySendError::Full(queued) | TrySendError::Disconnected(queued) => queued.work,
            })
    }

    fn ttl(&self) -> Duration {
        self.ttl
    }
}

const ASYNC_HOOK_WORK_QUEUE_CAPACITY: usize = 64;
const ASYNC_HOOK_WORK_TTL: Duration = Duration::from_secs(10);
const MAX_HOOK_BODY_BYTES: u64 = 1024 * 1024;

impl LocalHookServerService {
    pub fn start(
        app: tauri::AppHandle,
        port: u16,
        inbound_service: Arc<Mutex<InboundEventService>>,
        status: Arc<Mutex<LocalHookServerStatus>>,
        auth_token: SharedHookAuthToken,
        _output_executor: Arc<Mutex<NativeOutputExecutor>>,
        device_runtime_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
        runtime_monitor: Arc<Mutex<RuntimeMonitorService>>,
    ) {
        let bind_address = format!("127.0.0.1:{port}");
        thread::spawn(move || {
            let started = Instant::now();
            let server = match Server::http(&bind_address) {
                Ok(server) => {
                    let elapsed_ms = started.elapsed().as_millis() as u64;
                    if let Ok(mut current_status) = status.lock() {
                        *current_status = Self::status_for_port(port, true, None);
                    }
                    crate::startup::tray::refresh_tray_menu_after_state_change(
                        &app,
                        "local hook server started",
                    );
                    tracing::info!(
                        bind_address,
                        elapsed_ms,
                        "local hook server started with auth token"
                    );
                    server
                }
                Err(error) => {
                    let elapsed_ms = started.elapsed().as_millis() as u64;
                    if let Ok(mut current_status) = status.lock() {
                        *current_status =
                            Self::status_for_port(port, false, Some(error.to_string()));
                    }
                    crate::startup::tray::refresh_tray_menu_after_state_change(
                        &app,
                        "local hook server failed",
                    );
                    tracing::warn!(
                        bind_address,
                        elapsed_ms,
                        "local hook server failed to start: {error}"
                    );
                    return;
                }
            };
            let webhook_executor = Arc::new(Mutex::new(NativeWebhookExecutor::default()));
            let local_output_executor = Arc::new(Mutex::new(
                NativeLocalOutputExecutor::from_app_handle(app.clone()),
            ));
            let output_queues = AsyncHookOutputQueues::start(
                ASYNC_HOOK_WORK_QUEUE_CAPACITY,
                ASYNC_HOOK_WORK_TTL,
                Arc::clone(&inbound_service),
                webhook_executor,
                local_output_executor,
                Arc::clone(&device_runtime_registry),
                Arc::clone(&runtime_monitor),
                app.clone(),
            );
            let work_queue = AsyncHookWorkQueue::start(
                ASYNC_HOOK_WORK_QUEUE_CAPACITY,
                ASYNC_HOOK_WORK_TTL,
                Arc::clone(&inbound_service),
                Arc::clone(&runtime_monitor),
                output_queues,
            );

            for mut request in server.incoming_requests() {
                let request_received_at = current_local_rfc3339_timestamp();
                let (body, http_read_elapsed_ms) = match read_limited_request_body(&mut request) {
                    Ok((body, elapsed_ms)) => (body, elapsed_ms),
                    Err(response) => {
                        let _ = request.respond(to_tiny_response(response));
                        continue;
                    }
                };

                let current_status =
                    status
                        .lock()
                        .map(|value| value.clone())
                        .unwrap_or_else(|error| {
                            Self::status_for_port(port, false, Some(error.to_string()))
                        });

                let prepare_started = Instant::now();
                let prepared = match inbound_service.lock() {
                    Ok(mut service) => Self::prepare_request_with_auth_and_async_work(
                        request.method().as_str(),
                        request.url(),
                        &body,
                        provided_token_from_request(&request),
                        Arc::clone(&auth_token),
                        &mut service,
                        &current_status,
                        request_received_at,
                    ),
                    Err(error) => PreparedAsyncHookEvent {
                        response: error_response(500, error.to_string()),
                        work: None,
                        debug_entry_id: None,
                    },
                };
                let prepare_elapsed_ms = prepare_started.elapsed().as_millis() as u64;

                let work = prepared.work;
                let debug_entry_id = prepared.debug_entry_id;
                let mut response = prepared.response;
                if let Some(work) = work {
                    let work_debug_entry_id = work.debug_entry_id().to_string();
                    if let Err(work) = work_queue.enqueue(work) {
                        tracing::warn!(
                            ttl_ms = work_queue.ttl().as_millis() as u64,
                            "async hook work queue is full; dropping hook processing task"
                        );
                        if let Ok(mut service) = inbound_service.lock() {
                            service.mark_debug_log_processing_dropped(
                                &work_debug_entry_id,
                                "dropped",
                                "async hook processing queue is full".to_string(),
                            );
                        }
                        drop(work);
                        response =
                            error_response(503, "async hook processing queue is full".to_string());
                    }
                }
                let respond_started = Instant::now();
                let response_result = request.respond(to_tiny_response(response));
                let response_elapsed_ms = respond_started.elapsed().as_millis() as u64;
                if let Some(debug_entry_id) = debug_entry_id.as_deref() {
                    if let Ok(mut service) = inbound_service.lock() {
                        service.mark_debug_log_http_timing(
                            debug_entry_id,
                            http_read_elapsed_ms,
                            prepare_elapsed_ms,
                        );
                        service.mark_debug_log_response_timing(
                            debug_entry_id,
                            response_elapsed_ms,
                            "queued",
                        );
                    }
                }

                if let Err(error) = response_result {
                    tracing::warn!("failed to respond to hook request: {error}");
                }
            }
        });
    }

    pub fn status_for_port(
        port: u16,
        running: bool,
        error: Option<String>,
    ) -> LocalHookServerStatus {
        let bind_address = format!("127.0.0.1:{port}");
        LocalHookServerStatus {
            running,
            port,
            bind_address: bind_address.clone(),
            event_url: format!("http://{bind_address}/api/v1/events"),
            health_url: format!("http://{bind_address}/health"),
            error,
        }
    }

    pub fn default_status() -> LocalHookServerStatus {
        Self::status_for_port(DEFAULT_LOCAL_HOOK_PORT, false, None)
    }

    pub fn handle_request(
        method: &str,
        path: &str,
        body: &str,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
    ) -> LocalHookHttpResponse {
        let mut executor = NoopOutputExecutor;
        let mut registry = DeviceRuntimeRegistry::new(Vec::new());
        Self::handle_authorized_request(
            method,
            path,
            body,
            inbound_service,
            status,
            &mut executor,
            &mut registry,
            None,
            None,
        )
    }

    pub fn handle_request_with_executor(
        method: &str,
        path: &str,
        body: &str,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
        output_executor: &mut dyn OutputExecutor,
    ) -> LocalHookHttpResponse {
        let mut registry = DeviceRuntimeRegistry::new(Vec::new());
        Self::handle_authorized_request(
            method,
            path,
            body,
            inbound_service,
            status,
            output_executor,
            &mut registry,
            None,
            None,
        )
    }

    pub fn handle_request_with_executor_and_monitor(
        method: &str,
        path: &str,
        body: &str,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
        output_executor: &mut dyn OutputExecutor,
        runtime_monitor: Arc<Mutex<RuntimeMonitorService>>,
    ) -> LocalHookHttpResponse {
        let mut registry = DeviceRuntimeRegistry::new(Vec::new());
        let mut monitor_recorder = SharedRuntimeMonitorRecorder::new(runtime_monitor);
        Self::handle_authorized_request(
            method,
            path,
            body,
            inbound_service,
            status,
            output_executor,
            &mut registry,
            Some(&mut monitor_recorder),
            None,
        )
    }

    pub fn handle_request_with_auth(
        method: &str,
        path: &str,
        body: &str,
        provided_token: Option<&str>,
        expected_token: SharedHookAuthToken,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
    ) -> LocalHookHttpResponse {
        let mut executor = NoopOutputExecutor;
        let mut registry = DeviceRuntimeRegistry::new(Vec::new());
        Self::handle_request_with_auth_and_executor(
            method,
            path,
            body,
            provided_token,
            expected_token,
            inbound_service,
            status,
            &mut executor,
            &mut registry,
            None,
            None,
        )
    }

    fn handle_request_with_auth_and_executor(
        method: &str,
        path: &str,
        body: &str,
        provided_token: Option<&str>,
        expected_token: SharedHookAuthToken,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
        output_executor: &mut dyn OutputExecutor,
        device_registry: &mut DeviceRuntimeRegistry,
        runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        device_runtime_event_sink: Option<&dyn Fn(&SubmitRelayEventResult)>,
    ) -> LocalHookHttpResponse {
        if path == "/health" {
            return Self::handle_authorized_request(
                method,
                path,
                body,
                inbound_service,
                status,
                output_executor,
                device_registry,
                runtime_monitor,
                device_runtime_event_sink,
            );
        }

        let expected_token = match expected_token.lock() {
            Ok(token) => token.clone(),
            Err(error) => {
                tracing::warn!("auth token lock failed: {error}");
                return error_response(500, "auth token unavailable".to_string());
            }
        };

        if !crate::infrastructure::auth_token::verify_token(provided_token, &expected_token) {
            tracing::warn!("unauthorized request rejected: invalid or missing token");
            return error_response(
                401,
                "Unauthorized: invalid or missing auth token".to_string(),
            );
        }

        Self::handle_authorized_request(
            method,
            path,
            body,
            inbound_service,
            status,
            output_executor,
            device_registry,
            runtime_monitor,
            device_runtime_event_sink,
        )
    }

    fn prepare_request_with_auth_and_async_work(
        method: &str,
        path: &str,
        body: &str,
        provided_token: Option<&str>,
        expected_token: SharedHookAuthToken,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
        request_received_at: String,
    ) -> PreparedAsyncHookEvent {
        if path == "/health" {
            let mut executor = NoopOutputExecutor;
            let mut registry = DeviceRuntimeRegistry::new(Vec::new());
            return PreparedAsyncHookEvent {
                response: Self::handle_authorized_request(
                    method,
                    path,
                    body,
                    inbound_service,
                    status,
                    &mut executor,
                    &mut registry,
                    None,
                    None,
                ),
                work: None,
                debug_entry_id: None,
            };
        }

        let response = Self::verify_auth_token(provided_token, expected_token)
            .err()
            .map(|error| error_response(error.0, error.1));
        if let Some(response) = response {
            return PreparedAsyncHookEvent {
                response,
                work: None,
                debug_entry_id: None,
            };
        }

        Self::prepare_authorized_async_event(
            method,
            path,
            body,
            inbound_service,
            status,
            request_received_at,
        )
    }

    fn verify_auth_token(
        provided_token: Option<&str>,
        expected_token: SharedHookAuthToken,
    ) -> Result<(), (u16, String)> {
        let expected_token = match expected_token.lock() {
            Ok(token) => token.clone(),
            Err(error) => {
                tracing::warn!("auth token lock failed: {error}");
                return Err((500, "auth token unavailable".to_string()));
            }
        };

        if !crate::infrastructure::auth_token::verify_token(provided_token, &expected_token) {
            tracing::warn!("unauthorized request rejected: invalid or missing token");
            return Err((
                401,
                "Unauthorized: invalid or missing auth token".to_string(),
            ));
        }

        Ok(())
    }

    fn prepare_authorized_async_event(
        method: &str,
        path: &str,
        body: &str,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
        request_received_at: String,
    ) -> PreparedAsyncHookEvent {
        match (method, path) {
            ("GET", "/health") => PreparedAsyncHookEvent {
                response: json_response(200, status),
                work: None,
                debug_entry_id: None,
            },
            ("POST", "/api/v1/events") => {
                let request = match serde_json::from_str::<SubmitRelayEventRequest>(body) {
                    Ok(request) => request,
                    Err(error) => {
                        return PreparedAsyncHookEvent {
                            response: error_response(400, format!("invalid json: {error}")),
                            work: None,
                            debug_entry_id: None,
                        };
                    }
                };

                let origin = InboundEventOrigin::RealHook;
                let result = match inbound_service
                    .submit_relay_event_received_at(request.clone(), request_received_at)
                {
                    Ok(result) => result,
                    Err(error) => {
                        return PreparedAsyncHookEvent {
                            response: error_response(400, error),
                            work: None,
                            debug_entry_id: None,
                        };
                    }
                };
                let profile = inbound_service.profile_snapshot();
                let debug_entry_id = result.debug_entry_id.clone();

                PreparedAsyncHookEvent {
                    response: json_response(200, &result),
                    work: Some(AsyncHookPipelineWork {
                        request,
                        origin,
                        result,
                        profile,
                    }),
                    debug_entry_id: Some(debug_entry_id),
                }
            }
            _ => PreparedAsyncHookEvent {
                response: error_response(404, "not found".to_string()),
                work: None,
                debug_entry_id: None,
            },
        }
    }

    fn handle_authorized_request(
        method: &str,
        path: &str,
        body: &str,
        inbound_service: &mut InboundEventService,
        status: &LocalHookServerStatus,
        output_executor: &mut dyn OutputExecutor,
        device_registry: &mut DeviceRuntimeRegistry,
        runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        device_runtime_event_sink: Option<&dyn Fn(&SubmitRelayEventResult)>,
    ) -> LocalHookHttpResponse {
        match (method, path) {
            ("GET", "/health") => json_response(200, status),
            ("POST", "/api/v1/events") => {
                let request = match serde_json::from_str::<SubmitRelayEventRequest>(body) {
                    Ok(request) => request,
                    Err(error) => {
                        return error_response(400, format!("invalid json: {error}"));
                    }
                };

                let envelope = request.with_origin(InboundEventOrigin::RealHook);
                let result = RelayEventPipelineService::submit(
                    inbound_service,
                    output_executor,
                    device_registry,
                    runtime_monitor,
                    envelope,
                );

                match result {
                    Ok(result) => {
                        if let Some(sink) = device_runtime_event_sink {
                            sink(&result);
                        }
                        json_response(200, &result)
                    }
                    Err(error) => error_response(400, error),
                }
            }
            _ => error_response(404, "not found".to_string()),
        }
    }
}

fn provided_token_from_request(request: &Request) -> Option<&str> {
    request
        .headers()
        .iter()
        .find(|header| header.field.as_str().to_ascii_lowercase() == "x-cc-notice-token")
        .map(|header| header.value.as_str())
}

fn read_limited_request_body(
    request: &mut Request,
) -> Result<(String, u64), LocalHookHttpResponse> {
    let started = Instant::now();
    let mut body = String::new();
    let read_result = request
        .as_reader()
        .take(MAX_HOOK_BODY_BYTES + 1)
        .read_to_string(&mut body);
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if let Err(error) = read_result {
        return Err(error_response(
            400,
            format!("failed to read request body: {error}"),
        ));
    }
    if body.len() as u64 > MAX_HOOK_BODY_BYTES {
        tracing::warn!(
            body_bytes = body.len(),
            max_body_bytes = MAX_HOOK_BODY_BYTES,
            "hook request body rejected because it is too large"
        );
        return Err(error_response(
            413,
            format!("request body exceeds {} bytes", MAX_HOOK_BODY_BYTES),
        ));
    }
    Ok((body, elapsed_ms))
}

fn json_response<T: Serialize>(status_code: u16, value: &T) -> LocalHookHttpResponse {
    let body = serde_json::to_string(value)
        .unwrap_or_else(|error| format!(r#"{{"error":"failed to serialize response: {error}"}}"#));
    LocalHookHttpResponse { status_code, body }
}

fn error_response(status_code: u16, error: String) -> LocalHookHttpResponse {
    json_response(status_code, &serde_json::json!({ "error": error }))
}

fn to_tiny_response(response: LocalHookHttpResponse) -> Response<Cursor<Vec<u8>>> {
    let content_type = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..])
        .expect("static content type header should be valid");
    Response::from_string(response.body)
        .with_status_code(response.status_code)
        .with_header(content_type)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_services::inbound_event_service::SubmitRelayEventResult;
    use crate::app_services::output_executor::OutputExecutor;
    use crate::core::hook_relay::{build_submit_request_body, RelayCliOptions};
    use crate::core::profiles::{HardwareOutput, HardwareOutputType, HardwareRule, NoticeProfile};

    #[derive(Default)]
    struct RecordingOutputExecutor {
        notifications: std::sync::Mutex<Vec<(String, String)>>,
    }

    impl OutputExecutor for RecordingOutputExecutor {
        fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
            let mut notifications = self
                .notifications
                .lock()
                .map_err(|error| error.to_string())?;
            for output in &result.outputs {
                if output.output_type == HardwareOutputType::SystemNotification {
                    notifications.push((
                        output.notification_title.clone().unwrap_or_default(),
                        output.notification_body.clone().unwrap_or_default(),
                    ));
                }
            }
            Ok(())
        }
    }

    fn current_occurred_at() -> String {
        time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Rfc3339)
            .expect("current time should format as RFC3339")
    }

    fn codex_permission_request_body() -> String {
        serde_json::json!({
            "source": "codex",
            "event": "PermissionRequest",
            "payload": "{}",
            "occurredAt": current_occurred_at(),
        })
        .to_string()
    }

    fn system_notification_rule_for_test() -> HardwareRule {
        HardwareRule {
            id: "agent-started-notification-http-test".to_string(),
            internal_event: "agent.started".to_string(),
            output: HardwareOutput {
                output_type: HardwareOutputType::SystemNotification,
                channel_actions: Vec::new(),
                duration_ms: None,
                text: None,
                notification_level: Some("info".to_string()),
                notification_title: Some("{{source}} · {{internalEvent}}".to_string()),
                notification_body: Some("{{model}}".to_string()),
                notification_title_max_chars: Some(80),
                notification_body_max_chars: Some(300),
                notification_throttle_seconds: Some(30),
                notification_sound: None,
                webhook_method: None,
                webhook_url: None,
                webhook_headers: None,
                webhook_body: None,
                webhook_body_max_chars: None,
                sound_file_path: None,
                sound_volume_percent: None,
                sound_max_duration_ms: None,
                sound_throttle_seconds: None,
                display_device_id: None,
                display_template_id: None,
                display_accent: None,
                display_icon: None,
                display_lines_template: None,
                display_status: None,
                display_title_template: None,
                display_message_template: None,
                display_title_max_chars: None,
                display_message_max_chars: None,
                display_expire_behavior: None,
                desktop_notice_targets: Vec::new(),
            },
            priority: 90,
            enabled: true,
        }
    }

    #[test]
    fn status_builds_local_urls() {
        let status = LocalHookServerService::status_for_port(DEFAULT_LOCAL_HOOK_PORT, true, None);

        assert!(status.running);
        assert_eq!(17321, status.port);
        assert_eq!("127.0.0.1:17321", status.bind_address);
        assert_eq!("http://127.0.0.1:17321/api/v1/events", status.event_url);
        assert_eq!("http://127.0.0.1:17321/health", status.health_url);
    }

    #[test]
    fn handles_health_request() {
        let status = LocalHookServerService::status_for_port(17321, true, None);

        let response = LocalHookServerService::handle_request(
            "GET",
            "/health",
            "",
            &mut InboundEventService::default(),
            &status,
        );

        assert_eq!(200, response.status_code);
        assert!(response.body.contains("\"running\":true"));
    }

    #[test]
    fn output_kinds_are_required_only_when_matching_outputs_exist() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut inbound_service = InboundEventService::default();
        let mut profile = NoticeProfile::daily_coding();
        profile.hardware_rules = vec![system_notification_rule_for_test()];
        inbound_service.set_profile(profile);

        let prepared = LocalHookServerService::prepare_authorized_async_event(
            "POST",
            "/api/v1/events",
            &serde_json::json!({
                "source": "codex",
                "event": "UserPromptSubmit",
                "payload": "{}",
                "occurredAt": current_occurred_at(),
            })
            .to_string(),
            &mut inbound_service,
            &status,
            current_occurred_at(),
        );
        let work = prepared
            .work
            .expect("accepted event should produce async work");

        assert_eq!(
            vec![AsyncHookOutputKind::Local],
            required_output_kinds_for_result(&work.result)
        );
    }

    #[test]
    fn output_processing_drop_does_not_overwrite_event_result() {
        let mut inbound_service = InboundEventService::default();
        let request = SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "UserPromptSubmit".to_string(),
            payload: "{}".to_string(),
            raw_payload: None,
            occurred_at: current_occurred_at(),
        };
        let result = inbound_service
            .submit_relay_event(request)
            .expect("event should be accepted");

        inbound_service.mark_debug_log_output_processing_dropped(
            &result.debug_entry_id,
            "webhook",
            "dropped",
            "webhook output queue is full".to_string(),
        );

        let entry = inbound_service
            .debug_log_entries()
            .first()
            .expect("debug entry should exist");
        assert_eq!("accepted", entry.result);
        assert!(entry
            .error
            .as_deref()
            .expect("output drop should be visible")
            .contains("webhook output queue is full"));
    }

    #[test]
    fn posts_event_into_inbound_service() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut inbound_service = InboundEventService::default();
        let body = codex_permission_request_body();

        let response = LocalHookServerService::handle_request(
            "POST",
            "/api/v1/events",
            &body,
            &mut inbound_service,
            &status,
        );

        assert_eq!(200, response.status_code);
        assert_eq!("accepted", inbound_service.debug_log_entries()[0].result);
    }

    #[test]
    fn posts_debug_raw_payload_into_inbound_service() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut inbound_service = InboundEventService::default();
        let raw_payload = r#"{"prompt":"debug raw"}"#;
        let body = serde_json::json!({
            "source": "codex",
            "event": "SessionStart",
            "payload": "{\"captured\":false}",
            "rawPayload": raw_payload,
            "occurredAt": current_occurred_at(),
        })
        .to_string();

        let response = LocalHookServerService::handle_request(
            "POST",
            "/api/v1/events",
            &body,
            &mut inbound_service,
            &status,
        );

        assert_eq!(200, response.status_code);
        assert_eq!(
            Some(raw_payload.to_string()),
            inbound_service.debug_log_entries()[0].raw_payload
        );
    }

    #[test]
    fn http_event_executes_system_notification_outputs() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut profile = NoticeProfile::daily_coding();
        profile.hardware_rules = vec![system_notification_rule_for_test()];
        let mut inbound_service = InboundEventService::with_profile(profile);
        let mut executor = RecordingOutputExecutor::default();
        let body = serde_json::json!({
            "source": "codex",
            "event": "UserPromptSubmit",
            "payload": "{\"model\":\"gpt-5.5\"}",
            "occurredAt": current_occurred_at(),
        })
        .to_string();

        let response = LocalHookServerService::handle_request_with_executor(
            "POST",
            "/api/v1/events",
            &body,
            &mut inbound_service,
            &status,
            &mut executor,
        );

        assert_eq!(200, response.status_code);
        let notifications = executor.notifications.lock().expect("notifications lock");
        assert!(notifications.iter().any(|notification| {
            notification.0 == "codex · agent.started" && notification.1 == "gpt-5.5"
        }));
    }

    #[test]
    fn async_event_response_preparation_does_not_run_outputs() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut profile = NoticeProfile::daily_coding();
        profile.hardware_rules = vec![system_notification_rule_for_test()];
        let mut inbound_service = InboundEventService::with_profile(profile);
        let body = serde_json::json!({
            "source": "codex",
            "event": "UserPromptSubmit",
            "payload": "{\"model\":\"gpt-5.5\"}",
            "occurredAt": current_occurred_at(),
        })
        .to_string();

        let prepared = LocalHookServerService::prepare_authorized_async_event(
            "POST",
            "/api/v1/events",
            &body,
            &mut inbound_service,
            &status,
            current_local_rfc3339_timestamp(),
        );

        assert_eq!(200, prepared.response.status_code);
        assert!(prepared.work.is_some());
        let entry = inbound_service
            .debug_log_entries()
            .first()
            .expect("debug log should be recorded");
        assert_eq!("accepted", entry.result);
        assert_eq!(None, entry.processing_mode);
        assert_eq!(None, entry.response_elapsed_ms);
        assert_eq!(None, entry.processing_elapsed_ms);
        assert_eq!(None, entry.processing_completed_at);
        assert!(entry.device_results.is_empty());
    }

    #[test]
    fn claude_code_session_start_relay_body_executes_default_system_notification() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut inbound_service = InboundEventService::default();
        let mut executor = RecordingOutputExecutor::default();
        let options = RelayCliOptions {
            source: "claude-code".to_string(),
            event: "SessionStart".to_string(),
            endpoint: None,
            port: None,
            payload: None,
            occurred_at: Some(current_occurred_at()),
            debug: false,
        };
        let raw_payload = r#"{
            "hook_event_name":"SessionStart",
            "session_id":"claude-session",
            "cwd":"/workspace/claude",
            "model":"claude-sonnet",
            "permission_mode":"acceptEdits"
        }"#;
        let body = build_submit_request_body(&options, raw_payload)
            .expect("claude relay body should build")
            .expect("claude event should be forwarded");

        let response = LocalHookServerService::handle_request_with_executor(
            "POST",
            "/api/v1/events",
            &body,
            &mut inbound_service,
            &status,
            &mut executor,
        );

        assert_eq!(200, response.status_code);
        let entry = inbound_service
            .debug_log_entries()
            .first()
            .expect("debug log entry should be recorded");
        assert_eq!("accepted", entry.result);
        assert_eq!(Some("agent.started".to_string()), entry.internal_event);
        let notifications = executor.notifications.lock().expect("notifications lock");
        assert!(notifications.iter().any(|notification| {
            notification.0 == "claude-code 开始处理任务"
                && notification.1 == "模型：claude-sonnet，事件：SessionStart"
        }));
    }

    #[test]
    fn health_request_does_not_require_auth_token() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let auth_token = Arc::new(Mutex::new("expected-token".to_string()));

        let response = LocalHookServerService::handle_request_with_auth(
            "GET",
            "/health",
            "",
            None,
            auth_token,
            &mut InboundEventService::default(),
            &status,
        );

        assert_eq!(200, response.status_code);
        assert!(response.body.contains("\"running\":true"));
    }

    #[test]
    fn event_request_rejects_missing_auth_token() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let body = codex_permission_request_body();
        let auth_token = Arc::new(Mutex::new("expected-token".to_string()));

        let response = LocalHookServerService::handle_request_with_auth(
            "POST",
            "/api/v1/events",
            &body,
            None,
            auth_token,
            &mut InboundEventService::default(),
            &status,
        );

        assert_eq!(401, response.status_code);
    }

    #[test]
    fn event_request_accepts_matching_auth_token() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut inbound_service = InboundEventService::default();
        let body = codex_permission_request_body();
        let auth_token = Arc::new(Mutex::new("expected-token".to_string()));

        let response = LocalHookServerService::handle_request_with_auth(
            "POST",
            "/api/v1/events",
            &body,
            Some("expected-token"),
            auth_token,
            &mut inbound_service,
            &status,
        );

        assert_eq!(200, response.status_code);
        assert_eq!("accepted", inbound_service.debug_log_entries()[0].result);
    }

    #[test]
    fn event_request_uses_updated_shared_auth_token() {
        let status = LocalHookServerService::status_for_port(17321, true, None);
        let mut inbound_service = InboundEventService::default();
        let body = codex_permission_request_body();
        let auth_token = Arc::new(Mutex::new("old-token".to_string()));

        *auth_token.lock().expect("auth token lock") = "new-token".to_string();

        let response = LocalHookServerService::handle_request_with_auth(
            "POST",
            "/api/v1/events",
            &body,
            Some("new-token"),
            auth_token,
            &mut inbound_service,
            &status,
        );

        assert_eq!(200, response.status_code);
        assert_eq!("accepted", inbound_service.debug_log_entries()[0].result);
    }

    #[test]
    fn rejects_invalid_json() {
        let status = LocalHookServerService::status_for_port(17321, true, None);

        let response = LocalHookServerService::handle_request(
            "POST",
            "/api/v1/events",
            "{",
            &mut InboundEventService::default(),
            &status,
        );

        assert_eq!(400, response.status_code);
        assert!(response.body.contains("invalid json"));
    }

    #[test]
    fn rejects_unknown_path() {
        let status = LocalHookServerService::status_for_port(17321, true, None);

        let response = LocalHookServerService::handle_request(
            "GET",
            "/unknown",
            "",
            &mut InboundEventService::default(),
            &status,
        );

        assert_eq!(404, response.status_code);
    }

    #[test]
    fn failed_status_keeps_urls_and_error() {
        let status = LocalHookServerService::status_for_port(
            17321,
            false,
            Some("address already in use".to_string()),
        );

        assert!(!status.running);
        assert_eq!("http://127.0.0.1:17321/api/v1/events", status.event_url);
        assert_eq!(Some("address already in use".to_string()), status.error);
    }
}
