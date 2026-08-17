use std::sync::{Arc, Mutex};

use crate::app_services::device_output_dispatcher::DeviceOutputDispatcher;
use crate::app_services::device_runtime_display_coordinator::DeviceRuntimeDisplayCoordinator;
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::app_services::inbound_event_service::{
    InboundEventOrigin, InboundEventService, SubmitRelayEventEnvelope, SubmitRelayEventRequest,
    SubmitRelayEventResult,
};
use crate::app_services::output_executor::{OutputExecutionReport, OutputExecutor};
use crate::app_services::output_plan_service::{OutputPlanService, OutputTemplateContext};
use crate::app_services::runtime_monitor::{
    RuntimeEventRecord, RuntimeMonitorService, RuntimeMonitorSnapshot, RuntimeOutputRecord,
    RuntimeRecordOutcome,
};
use crate::core::device::DeviceCommandResult;
use crate::core::profiles::{HardwareOutputType, NoticeProfile};

pub struct RelayEventPipelineService;

impl RelayEventPipelineService {
    pub fn submit(
        inbound_service: &mut InboundEventService,
        output_executor: &mut dyn OutputExecutor,
        device_registry: &mut DeviceRuntimeRegistry,
        runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        envelope: SubmitRelayEventEnvelope,
    ) -> Result<SubmitRelayEventResult, String> {
        let request = envelope.request;
        let origin = envelope.origin;
        let monitor_request = request.clone();
        let mut runtime_monitor = runtime_monitor;

        match inbound_service.submit_relay_event(request) {
            Ok(mut result) => {
                if origin.counts_for_runtime_monitor() {
                    if let Some(monitor) = runtime_monitor.as_mut() {
                        record_runtime_event(
                            &mut **monitor,
                            &monitor_request,
                            Some(result.internal_event.clone()),
                            RuntimeRecordOutcome::Success,
                        );
                    }
                }

                Self::dispatch_outputs_for_accepted_result(
                    inbound_service,
                    output_executor,
                    device_registry,
                    runtime_monitor,
                    origin,
                    &monitor_request,
                    &mut result,
                );
                Ok(result)
            }
            Err(error) => {
                if origin.counts_for_runtime_monitor() {
                    if let Some(monitor) = runtime_monitor.as_mut() {
                        record_runtime_event(
                            &mut **monitor,
                            &monitor_request,
                            None,
                            RuntimeRecordOutcome::Failure,
                        );
                    }
                }
                Err(error)
            }
        }
    }

    pub fn dispatch_outputs_for_accepted_result(
        inbound_service: &mut InboundEventService,
        output_executor: &mut dyn OutputExecutor,
        device_registry: &mut DeviceRuntimeRegistry,
        runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        origin: InboundEventOrigin,
        request: &SubmitRelayEventRequest,
        result: &mut SubmitRelayEventResult,
    ) {
        let active_profile = inbound_service.profile_snapshot();
        let device_results = Self::dispatch_outputs_for_accepted_result_with_profile(
            &active_profile,
            output_executor,
            device_registry,
            runtime_monitor,
            origin,
            request,
            result,
        );
        inbound_service.attach_device_results_to_debug_log(&result.debug_entry_id, device_results);
    }

    pub fn dispatch_outputs_for_accepted_result_with_profile(
        active_profile: &NoticeProfile,
        output_executor: &mut dyn OutputExecutor,
        device_registry: &mut DeviceRuntimeRegistry,
        mut runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        origin: InboundEventOrigin,
        request: &SubmitRelayEventRequest,
        result: &mut SubmitRelayEventResult,
    ) -> Vec<DeviceCommandResult> {
        let mut output_report = output_executor.execute_with_report(result);
        let template_context =
            OutputTemplateContext::from_relay_request(request, &result.internal_event);
        let device_board_ids = device_registry.registered_device_board_ids();
        let plan = OutputPlanService::build_plan_with_context_and_device_boards(
            active_profile,
            &result.internal_event,
            &template_context,
            &device_board_ids,
        );
        let device_results = DeviceOutputDispatcher::dispatch(&plan, device_registry);
        output_report.extend(device_results_to_output_report(&device_results));
        log_device_failures(&device_results);
        result.device_results = device_results;

        if origin.counts_for_runtime_monitor() {
            if let Some(monitor) = runtime_monitor.as_mut() {
                record_runtime_outputs(&mut **monitor, result, &output_report);
                refresh_runtime_display_devices(&mut **monitor, device_registry);
            }
        }
        result.device_results.clone()
    }

    pub fn dispatch_outputs_for_accepted_result_with_profile_and_shared_registry(
        active_profile: &NoticeProfile,
        output_executor: &mut dyn OutputExecutor,
        device_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
        mut runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        origin: InboundEventOrigin,
        request: &SubmitRelayEventRequest,
        result: &mut SubmitRelayEventResult,
    ) -> Result<Vec<DeviceCommandResult>, String> {
        let mut output_report = output_executor.execute_with_report(result);
        let template_context =
            OutputTemplateContext::from_relay_request(request, &result.internal_event);
        let device_board_ids = device_registry
            .lock()
            .map_err(|error| error.to_string())?
            .registered_device_board_ids();
        let plan = OutputPlanService::build_plan_with_context_and_device_boards(
            active_profile,
            &result.internal_event,
            &template_context,
            &device_board_ids,
        );
        let device_results = DeviceOutputDispatcher::dispatch_with_shared_registry(
            &plan,
            Arc::clone(&device_registry),
        );
        output_report.extend(device_results_to_output_report(&device_results));
        log_device_failures(&device_results);
        result.device_results = device_results.clone();

        if origin.counts_for_runtime_monitor() {
            if let Some(monitor) = runtime_monitor.as_mut() {
                record_runtime_outputs(&mut **monitor, result, &output_report);
                refresh_runtime_display_devices_with_shared_registry(
                    &mut **monitor,
                    device_registry,
                );
            }
        }
        Ok(result.device_results.clone())
    }

    pub fn execute_software_outputs_for_result(
        output_executor: &mut dyn OutputExecutor,
        mut runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        origin: InboundEventOrigin,
        result: &SubmitRelayEventResult,
        include_output: impl Fn(HardwareOutputType) -> bool,
    ) {
        let mut filtered = result.clone();
        filtered
            .outputs
            .retain(|output| include_output(output.output_type));
        if filtered.outputs.is_empty() {
            return;
        }
        let output_report = output_executor.execute_with_report(&filtered);
        if origin.counts_for_runtime_monitor() {
            if let Some(monitor) = runtime_monitor.as_mut() {
                record_runtime_outputs(&mut **monitor, &filtered, &output_report);
            }
        }
    }

    pub fn dispatch_device_outputs_for_result_with_shared_registry(
        active_profile: &NoticeProfile,
        device_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
        mut runtime_monitor: Option<&mut dyn RuntimeMonitorRecorder>,
        origin: InboundEventOrigin,
        request: &SubmitRelayEventRequest,
        result: &mut SubmitRelayEventResult,
    ) -> Vec<DeviceCommandResult> {
        let template_context =
            OutputTemplateContext::from_relay_request(request, &result.internal_event);
        let device_board_ids = match device_registry.lock() {
            Ok(registry) => registry.registered_device_board_ids(),
            Err(error) => {
                tracing::warn!("device registry lock failed for device output planning: {error}");
                return Vec::new();
            }
        };
        let plan = OutputPlanService::build_plan_with_context_and_device_boards(
            active_profile,
            &result.internal_event,
            &template_context,
            &device_board_ids,
        );
        let device_results = DeviceOutputDispatcher::dispatch_with_shared_registry(
            &plan,
            Arc::clone(&device_registry),
        );
        log_device_failures(&device_results);
        result.device_results = device_results.clone();

        if origin.counts_for_runtime_monitor() {
            if let Some(monitor) = runtime_monitor.as_mut() {
                let output_report = device_results_to_output_report(&device_results);
                record_runtime_outputs(&mut **monitor, result, &output_report);
                refresh_runtime_display_devices_with_shared_registry(
                    &mut **monitor,
                    device_registry,
                );
            }
        }
        device_results
    }
}

pub trait RuntimeMonitorRecorder {
    fn record_inbound_event(&mut self, record: RuntimeEventRecord);

    fn record_output(&mut self, record: RuntimeOutputRecord);

    fn snapshot(&self) -> Option<RuntimeMonitorSnapshot>;
}

impl RuntimeMonitorRecorder for RuntimeMonitorService {
    fn record_inbound_event(&mut self, record: RuntimeEventRecord) {
        RuntimeMonitorService::record_inbound_event(self, record);
    }

    fn record_output(&mut self, record: RuntimeOutputRecord) {
        RuntimeMonitorService::record_output(self, record);
    }

    fn snapshot(&self) -> Option<RuntimeMonitorSnapshot> {
        Some(RuntimeMonitorService::snapshot(self))
    }
}

pub struct SharedRuntimeMonitorRecorder {
    runtime_monitor: Arc<Mutex<RuntimeMonitorService>>,
}

impl SharedRuntimeMonitorRecorder {
    pub fn new(runtime_monitor: Arc<Mutex<RuntimeMonitorService>>) -> Self {
        Self { runtime_monitor }
    }
}

impl RuntimeMonitorRecorder for SharedRuntimeMonitorRecorder {
    fn record_inbound_event(&mut self, record: RuntimeEventRecord) {
        match self.runtime_monitor.lock() {
            Ok(mut monitor) => monitor.record_inbound_event(record),
            Err(error) => tracing::warn!("runtime monitor lock failed for event record: {error}"),
        }
    }

    fn record_output(&mut self, record: RuntimeOutputRecord) {
        match self.runtime_monitor.lock() {
            Ok(mut monitor) => monitor.record_output(record),
            Err(error) => tracing::warn!("runtime monitor lock failed for output record: {error}"),
        }
    }

    fn snapshot(&self) -> Option<RuntimeMonitorSnapshot> {
        match self.runtime_monitor.lock() {
            Ok(monitor) => Some(monitor.snapshot()),
            Err(error) => {
                tracing::warn!("runtime monitor lock failed for display snapshot: {error}");
                None
            }
        }
    }
}

fn device_results_to_output_report(results: &[DeviceCommandResult]) -> OutputExecutionReport {
    let mut report = OutputExecutionReport::default();
    for result in results {
        report.push(
            hardware_output_type_for_device_result(result),
            format!("{}/{}", result.device_id, result.channel_id),
            result.status == "sent",
        );
    }
    report
}

fn hardware_output_type_for_device_result(result: &DeviceCommandResult) -> HardwareOutputType {
    match result.output_type {
        crate::core::device::DeviceCommandOutputType::DeviceChannel => {
            HardwareOutputType::DeviceChannel
        }
        crate::core::device::DeviceCommandOutputType::Display => HardwareOutputType::Display,
        crate::core::device::DeviceCommandOutputType::Buzzer => HardwareOutputType::Buzzer,
        crate::core::device::DeviceCommandOutputType::DeviceControl => {
            HardwareOutputType::DeviceChannel
        }
    }
}

fn log_device_failures(results: &[DeviceCommandResult]) {
    for result in results {
        if result.status == "sent" {
            continue;
        }
        tracing::warn!(
            "device output did not send: device_id={}, channel_id={}, status={}, error={}",
            result.device_id,
            result.channel_id,
            result.status,
            result.error.clone().unwrap_or_default()
        );
    }
}

pub fn record_runtime_event(
    runtime_monitor: &mut dyn RuntimeMonitorRecorder,
    request: &SubmitRelayEventRequest,
    internal_event: Option<String>,
    outcome: RuntimeRecordOutcome,
) {
    runtime_monitor.record_inbound_event(RuntimeEventRecord {
        source: request.source.clone(),
        event: request.event.clone(),
        internal_event,
        outcome,
        occurred_at: request.occurred_at.clone(),
    });
}

pub fn record_runtime_outputs(
    runtime_monitor: &mut dyn RuntimeMonitorRecorder,
    result: &SubmitRelayEventResult,
    output_report: &OutputExecutionReport,
) {
    for item in &output_report.items {
        runtime_monitor.record_output(RuntimeOutputRecord {
            output_type: output_type_label(item.output_type).to_string(),
            outcome: if item.success {
                RuntimeRecordOutcome::Success
            } else {
                RuntimeRecordOutcome::Failure
            },
            occurred_at: result.event.occurred_at.clone(),
        });
    }
}

fn refresh_runtime_display_devices(
    runtime_monitor: &mut dyn RuntimeMonitorRecorder,
    device_registry: &mut DeviceRuntimeRegistry,
) {
    let Some(snapshot) = runtime_monitor.snapshot() else {
        return;
    };
    let states = device_registry.states();
    let results = DeviceRuntimeDisplayCoordinator::runtime_actions(&snapshot, &states)
        .iter()
        .map(|action| device_registry.send_extension_action(action))
        .collect::<Vec<_>>();
    log_device_failures(&results);
}

fn refresh_runtime_display_devices_with_shared_registry(
    runtime_monitor: &mut dyn RuntimeMonitorRecorder,
    device_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
) {
    let Some(snapshot) = runtime_monitor.snapshot() else {
        return;
    };
    let states = match device_registry.lock() {
        Ok(registry) => registry.states(),
        Err(error) => {
            tracing::warn!("device registry lock failed for runtime display refresh: {error}");
            return;
        }
    };
    let actions = DeviceRuntimeDisplayCoordinator::runtime_actions(&snapshot, &states);
    let results = DeviceOutputDispatcher::dispatch_extension_actions_with_shared_registry(
        &actions,
        device_registry,
    );
    log_device_failures(&results);
}

pub fn output_type_label(output_type: HardwareOutputType) -> &'static str {
    match output_type {
        HardwareOutputType::DeviceChannel => "device-channel",
        HardwareOutputType::Display => "display",
        HardwareOutputType::Buzzer => "buzzer",
        HardwareOutputType::SystemNotification => "system-notification",
        HardwareOutputType::Webhook => "webhook",
        HardwareOutputType::Sound => "sound",
        HardwareOutputType::DesktopNotice => "desktop-notice",
        HardwareOutputType::Custom => "custom",
    }
}

#[cfg(test)]
#[path = "relay_event_pipeline_service_tests.rs"]
mod tests;
