use serde::{Deserialize, Serialize};

use crate::app_services::inbound_event::command_mapper::hardware_rule_to_notice_command;
use crate::app_services::inbound_event::debug_log::{payload_summary, push_debug_log};
use crate::app_services::inbound_event::event_mapper::notice_event_for_internal_event;
use crate::app_services::inbound_event::notice_state::software_notice_state_for_command;
use crate::app_services::inbound_event::template_renderer::{
    render_json_template, render_template, RenderLimit, TemplateRenderContext,
};
use crate::core::device::DeviceCommandResult;
use crate::core::events::NoticeEvent;
use crate::core::hook_events::{default_selected_events, is_known_hook_event};
use crate::core::profiles::{
    DesktopNoticeRuleTarget, EnabledHookEvent, HardwareOutputType, HardwareRule, NoticeProfile,
};
use crate::core::protocol::NoticeCommand;
use crate::infrastructure::time_utils::current_local_rfc3339_timestamp;
use std::sync::atomic::{AtomicU64, Ordering};

pub use crate::app_services::inbound_event::debug_log::DebugLogEntry;
pub use crate::app_services::inbound_event::notice_state::SoftwareNoticeState;

static DEBUG_ENTRY_COUNTER: AtomicU64 = AtomicU64::new(1);

fn next_debug_entry_id() -> String {
    let counter = DEBUG_ENTRY_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("debug-{counter}")
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitRelayEventRequest {
    pub source: String,
    pub event: String,
    pub payload: String,
    pub raw_payload: Option<String>,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InboundEventOrigin {
    RealHook,
    DebugTest,
}

impl InboundEventOrigin {
    pub fn counts_for_runtime_monitor(self) -> bool {
        matches!(self, Self::RealHook)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubmitRelayEventEnvelope {
    pub request: SubmitRelayEventRequest,
    pub origin: InboundEventOrigin,
}

impl SubmitRelayEventRequest {
    pub fn with_origin(self, origin: InboundEventOrigin) -> SubmitRelayEventEnvelope {
        SubmitRelayEventEnvelope {
            request: self,
            origin,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitRelayEventResult {
    pub debug_entry_id: String,
    pub event: NoticeEvent,
    pub command: NoticeCommand,
    pub internal_event: String,
    pub outputs: Vec<SubmitRelayEventOutput>,
    pub device_results: Vec<DeviceCommandResult>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitRelayEventOutput {
    #[serde(rename = "type")]
    pub output_type: HardwareOutputType,
    pub rule_id: String,
    pub command: NoticeCommand,
    pub notification_level: Option<String>,
    pub notification_title: Option<String>,
    pub notification_body: Option<String>,
    pub notification_throttle_seconds: Option<u32>,
    pub notification_sound: Option<String>,
    pub webhook_method: Option<String>,
    pub webhook_url: Option<String>,
    pub webhook_headers: Option<String>,
    pub webhook_body: Option<String>,
    pub webhook_body_max_chars: Option<u32>,
    pub sound_file_path: Option<String>,
    pub sound_volume_percent: Option<u8>,
    pub sound_max_duration_ms: Option<u32>,
    pub sound_throttle_seconds: Option<u32>,
    pub desktop_notice_targets: Vec<DesktopNoticeRuleTarget>,
}

#[derive(Debug, Clone)]
pub struct InboundEventService {
    profile: NoticeProfile,
    enabled_hook_events: Vec<EnabledHookEvent>,
    debug_log_entries: Vec<DebugLogEntry>,
    software_notice_state: SoftwareNoticeState,
}

impl Default for InboundEventService {
    fn default() -> Self {
        Self {
            profile: NoticeProfile::daily_coding(),
            enabled_hook_events: default_enabled_hook_events(),
            debug_log_entries: Vec::new(),
            software_notice_state: SoftwareNoticeState::empty(),
        }
    }
}

impl InboundEventService {
    pub fn with_profile(profile: NoticeProfile) -> Self {
        Self::with_profile_and_enabled_hook_events(profile, default_enabled_hook_events())
    }

    pub fn with_profile_and_enabled_hook_events(
        profile: NoticeProfile,
        enabled_hook_events: Vec<EnabledHookEvent>,
    ) -> Self {
        Self {
            profile,
            enabled_hook_events,
            debug_log_entries: Vec::new(),
            software_notice_state: SoftwareNoticeState::empty(),
        }
    }

    pub fn set_profile(&mut self, profile: NoticeProfile) {
        self.profile = profile;
        tracing::info!("inbound profile updated");
    }

    pub fn set_enabled_hook_events(&mut self, enabled_hook_events: Vec<EnabledHookEvent>) {
        self.enabled_hook_events = enabled_hook_events;
        tracing::info!("inbound enabled hook events updated");
    }

    pub fn profile_snapshot(&self) -> NoticeProfile {
        self.profile.clone()
    }

    pub fn submit_relay_event(
        &mut self,
        request: SubmitRelayEventRequest,
    ) -> Result<SubmitRelayEventResult, String> {
        self.submit_relay_event_received_at(request, current_local_rfc3339_timestamp())
    }

    pub fn submit_relay_event_received_at(
        &mut self,
        request: SubmitRelayEventRequest,
        request_received_at: String,
    ) -> Result<SubmitRelayEventResult, String> {
        if !is_known_hook_event(&request.source, &request.event) {
            let error = format!(
                "unknown hook event for {}/{}",
                request.source, request.event
            );
            let raw_payload = request.raw_payload.clone();
            self.push_debug_log(DebugLogEntry {
                debug_entry_id: next_debug_entry_id(),
                source: request.source,
                event: request.event,
                payload: payload_summary(&request.payload),
                raw_payload,
                result: "error".to_string(),
                internal_event: None,
                mapping_stage: Some("hookEventCatalog".to_string()),
                notice_command: None,
                outputs: Vec::new(),
                device_results: Vec::new(),
                error: Some(error.clone()),
                occurred_at: request.occurred_at,
                request_received_at: Some(request_received_at),
                http_read_elapsed_ms: None,
                prepare_elapsed_ms: None,
                queue_delay_ms: None,
                response_elapsed_ms: None,
                processing_elapsed_ms: None,
                device_processing_elapsed_ms: None,
                webhook_processing_elapsed_ms: None,
                local_processing_elapsed_ms: None,
                processing_completed_at: None,
                processing_mode: None,
            });
            tracing::warn!("relay event rejected: {error}");
            return Err(error);
        }

        if !self.is_hook_event_enabled(&request.source, &request.event) {
            let error = format!(
                "hook event is not enabled for {}/{}",
                request.source, request.event
            );
            let raw_payload = request.raw_payload.clone();
            self.push_debug_log(DebugLogEntry {
                debug_entry_id: next_debug_entry_id(),
                source: request.source,
                event: request.event,
                payload: payload_summary(&request.payload),
                raw_payload,
                result: "error".to_string(),
                internal_event: None,
                mapping_stage: Some("hookEventSelection".to_string()),
                notice_command: None,
                outputs: Vec::new(),
                device_results: Vec::new(),
                error: Some(error.clone()),
                occurred_at: request.occurred_at,
                request_received_at: Some(request_received_at),
                http_read_elapsed_ms: None,
                prepare_elapsed_ms: None,
                queue_delay_ms: None,
                response_elapsed_ms: None,
                processing_elapsed_ms: None,
                device_processing_elapsed_ms: None,
                webhook_processing_elapsed_ms: None,
                local_processing_elapsed_ms: None,
                processing_completed_at: None,
                processing_mode: None,
            });
            tracing::warn!("relay event rejected: {error}");
            return Err(error);
        }

        let internal_event = match self.profile.map_ai_event(&request.source, &request.event) {
            Some(internal_event) => internal_event,
            None => {
                let error = format!(
                    "no ai event mapping for {}/{}",
                    request.source, request.event
                );
                let raw_payload = request.raw_payload.clone();
                self.push_debug_log(DebugLogEntry {
                    debug_entry_id: next_debug_entry_id(),
                    source: request.source,
                    event: request.event,
                    payload: payload_summary(&request.payload),
                    raw_payload,
                    result: "error".to_string(),
                    internal_event: None,
                    mapping_stage: Some("aiEventMapping".to_string()),
                    notice_command: None,
                    outputs: Vec::new(),
                    device_results: Vec::new(),
                    error: Some(error.clone()),
                    occurred_at: request.occurred_at,
                    request_received_at: Some(request_received_at),
                    http_read_elapsed_ms: None,
                    prepare_elapsed_ms: None,
                    queue_delay_ms: None,
                    response_elapsed_ms: None,
                    processing_elapsed_ms: None,
                    device_processing_elapsed_ms: None,
                    webhook_processing_elapsed_ms: None,
                    local_processing_elapsed_ms: None,
                    processing_completed_at: None,
                    processing_mode: None,
                });
                tracing::warn!("relay event rejected: {error}");
                return Err(error);
            }
        };

        self.submit_profile_mapped_event(request, internal_event, request_received_at)
    }

    pub fn debug_log_entries(&self) -> &[DebugLogEntry] {
        &self.debug_log_entries
    }

    pub fn clear_debug_log(&mut self) {
        self.debug_log_entries.clear();
        tracing::info!("debug log cleared");
    }

    pub fn attach_device_results_to_debug_log(
        &mut self,
        debug_entry_id: &str,
        device_results: Vec<DeviceCommandResult>,
    ) {
        if device_results.is_empty() {
            return;
        }

        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for device results: id={debug_entry_id}");
            return;
        };

        entry.device_results = device_results;
    }

    pub fn mark_debug_log_response_timing(
        &mut self,
        debug_entry_id: &str,
        response_elapsed_ms: u64,
        processing_mode: &str,
    ) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for response timing: id={debug_entry_id}");
            return;
        };
        entry.response_elapsed_ms = Some(response_elapsed_ms);
        entry.processing_mode = Some(processing_mode.to_string());
    }

    pub fn mark_debug_log_http_timing(
        &mut self,
        debug_entry_id: &str,
        http_read_elapsed_ms: u64,
        prepare_elapsed_ms: u64,
    ) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for http timing: id={debug_entry_id}");
            return;
        };
        entry.http_read_elapsed_ms = Some(http_read_elapsed_ms);
        entry.prepare_elapsed_ms = Some(prepare_elapsed_ms);
    }

    pub fn mark_debug_log_queue_delay(&mut self, debug_entry_id: &str, queue_delay_ms: u64) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for queue delay: id={debug_entry_id}");
            return;
        };
        entry.queue_delay_ms = Some(queue_delay_ms);
    }

    pub fn mark_debug_log_processing_timing(
        &mut self,
        debug_entry_id: &str,
        processing_elapsed_ms: u64,
    ) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for processing timing: id={debug_entry_id}");
            return;
        };
        entry.processing_elapsed_ms = Some(processing_elapsed_ms);
        entry.processing_completed_at = Some(current_local_rfc3339_timestamp());
    }

    pub fn mark_debug_log_output_processing_timing(
        &mut self,
        debug_entry_id: &str,
        output_kind: &str,
        processing_elapsed_ms: u64,
    ) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for output timing: id={debug_entry_id}");
            return;
        };
        match output_kind {
            "device" => entry.device_processing_elapsed_ms = Some(processing_elapsed_ms),
            "webhook" => entry.webhook_processing_elapsed_ms = Some(processing_elapsed_ms),
            "local" => entry.local_processing_elapsed_ms = Some(processing_elapsed_ms),
            _ => tracing::warn!(output_kind, "unknown output kind for debug timing"),
        }
        entry.processing_elapsed_ms = [
            entry.device_processing_elapsed_ms,
            entry.webhook_processing_elapsed_ms,
            entry.local_processing_elapsed_ms,
        ]
        .into_iter()
        .flatten()
        .max();
        entry.processing_completed_at = Some(current_local_rfc3339_timestamp());
    }

    pub fn mark_debug_log_processing_failure(
        &mut self,
        debug_entry_id: &str,
        processing_elapsed_ms: u64,
        error: String,
    ) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for processing failure: id={debug_entry_id}");
            return;
        };
        entry.processing_elapsed_ms = Some(processing_elapsed_ms);
        entry.processing_completed_at = Some(current_local_rfc3339_timestamp());
        entry.error = Some(format!("async processing failed: {error}"));
    }

    pub fn mark_debug_log_processing_dropped(
        &mut self,
        debug_entry_id: &str,
        result: &str,
        error: String,
    ) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for processing drop: id={debug_entry_id}");
            return;
        };
        entry.result = result.to_string();
        entry.processing_elapsed_ms = Some(0);
        entry.processing_completed_at = Some(current_local_rfc3339_timestamp());
        entry.error = Some(error);
    }

    pub fn mark_debug_log_output_processing_dropped(
        &mut self,
        debug_entry_id: &str,
        output_kind: &str,
        result: &str,
        error: String,
    ) {
        let Some(entry) = self.find_debug_log_entry_mut(debug_entry_id) else {
            tracing::warn!("debug log entry not found for output drop: id={debug_entry_id}");
            return;
        };
        let output_error = format!("{output_kind} output {result}: {error}");
        entry.error = Some(match entry.error.take() {
            Some(existing) if !existing.is_empty() => format!("{existing}; {output_error}"),
            _ => output_error,
        });
        entry.processing_completed_at = Some(current_local_rfc3339_timestamp());
    }

    fn is_hook_event_enabled(&self, source: &str, event: &str) -> bool {
        self.enabled_hook_events
            .iter()
            .any(|enabled| enabled.source == source && enabled.event == event)
    }

    pub fn software_notice_state(&self) -> SoftwareNoticeState {
        self.software_notice_state.clone()
    }

    #[cfg(test)]
    fn record_manual_log(&mut self, result: &str) {
        self.push_debug_log(DebugLogEntry {
            debug_entry_id: next_debug_entry_id(),
            source: "manual".to_string(),
            event: "agent.working".to_string(),
            payload: "{}".to_string(),
            raw_payload: None,
            result: result.to_string(),
            internal_event: None,
            mapping_stage: None,
            notice_command: None,
            outputs: Vec::new(),
            device_results: Vec::new(),
            error: None,
            occurred_at: "2026-06-08T18:50:00Z".to_string(),
            request_received_at: Some(current_local_rfc3339_timestamp()),
            http_read_elapsed_ms: None,
            prepare_elapsed_ms: None,
            queue_delay_ms: None,
            response_elapsed_ms: None,
            processing_elapsed_ms: None,
            device_processing_elapsed_ms: None,
            webhook_processing_elapsed_ms: None,
            local_processing_elapsed_ms: None,
            processing_completed_at: None,
            processing_mode: None,
        });
    }

    fn push_debug_log(&mut self, entry: DebugLogEntry) {
        push_debug_log(&mut self.debug_log_entries, entry);
    }

    fn find_debug_log_entry_mut(&mut self, debug_entry_id: &str) -> Option<&mut DebugLogEntry> {
        self.debug_log_entries
            .iter_mut()
            .find(|entry| entry.debug_entry_id == debug_entry_id)
    }

    fn submit_profile_mapped_event(
        &mut self,
        request: SubmitRelayEventRequest,
        internal_event: String,
        request_received_at: String,
    ) -> Result<SubmitRelayEventResult, String> {
        let rules = self.profile.map_hardware_outputs(&internal_event);
        if rules.is_empty() {
            let error = format!("no hardware rule for internal event {internal_event}");
            let raw_payload = request.raw_payload.clone();
            self.push_debug_log(DebugLogEntry {
                debug_entry_id: next_debug_entry_id(),
                source: request.source,
                event: request.event,
                payload: payload_summary(&request.payload),
                raw_payload,
                result: "error".to_string(),
                internal_event: Some(internal_event),
                mapping_stage: Some("hardwareRule".to_string()),
                notice_command: None,
                outputs: Vec::new(),
                device_results: Vec::new(),
                error: Some(error.clone()),
                occurred_at: request.occurred_at,
                request_received_at: Some(request_received_at),
                http_read_elapsed_ms: None,
                prepare_elapsed_ms: None,
                queue_delay_ms: None,
                response_elapsed_ms: None,
                processing_elapsed_ms: None,
                device_processing_elapsed_ms: None,
                webhook_processing_elapsed_ms: None,
                local_processing_elapsed_ms: None,
                processing_completed_at: None,
                processing_mode: None,
            });
            tracing::warn!("relay event rejected: {error}");
            return Err(error);
        }
        let render_context = TemplateRenderContext {
            source: request.source.clone(),
            event: request.event.clone(),
            internal_event: internal_event.clone(),
            occurred_at: request.occurred_at.clone(),
            payload: request.payload.clone(),
            raw_payload: request.raw_payload.clone(),
        };
        let outputs = rules
            .iter()
            .map(|rule| rendered_rule_to_output(rule, &render_context))
            .collect::<Result<Vec<_>, String>>()?;
        let command = outputs
            .first()
            .map(|output| output.command.clone())
            .ok_or_else(|| format!("no hardware rule for internal event {internal_event}"))?;
        self.software_notice_state = software_notice_state_for_command(
            &command,
            internal_event.clone(),
            request.source.clone(),
        );
        let event = notice_event_for_internal_event(
            &request.source,
            &internal_event,
            request.occurred_at.clone(),
        );
        let debug_entry_id = next_debug_entry_id();
        self.push_debug_log(DebugLogEntry {
            debug_entry_id: debug_entry_id.clone(),
            source: request.source,
            event: request.event,
            payload: payload_summary(&request.payload),
            raw_payload: request.raw_payload,
            result: "accepted".to_string(),
            internal_event: Some(internal_event.clone()),
            mapping_stage: Some("hardwareRule".to_string()),
            notice_command: Some(command.clone()),
            outputs: outputs.clone(),
            device_results: Vec::new(),
            error: None,
            occurred_at: request.occurred_at,
            request_received_at: Some(request_received_at),
            http_read_elapsed_ms: None,
            prepare_elapsed_ms: None,
            queue_delay_ms: None,
            response_elapsed_ms: None,
            processing_elapsed_ms: None,
            device_processing_elapsed_ms: None,
            webhook_processing_elapsed_ms: None,
            local_processing_elapsed_ms: None,
            processing_completed_at: None,
            processing_mode: None,
        });
        tracing::info!("relay event accepted by profile mapping");

        Ok(SubmitRelayEventResult {
            debug_entry_id,
            event,
            command,
            internal_event,
            outputs,
            device_results: Vec::new(),
        })
    }
}

fn rendered_rule_to_output(
    rule: &HardwareRule,
    context: &TemplateRenderContext,
) -> Result<SubmitRelayEventOutput, String> {
    let mut rendered_rule = rule.clone();
    match rule.output.output_type {
        HardwareOutputType::SystemNotification => {
            let title_limit = rule.output.notification_title_max_chars.unwrap_or(80) as usize;
            let body_limit = rule.output.notification_body_max_chars.unwrap_or(300) as usize;
            rendered_rule.output.notification_title = render_optional_template(
                rule.output.notification_title.as_deref(),
                context,
                title_limit,
            );
            rendered_rule.output.notification_body = render_optional_template(
                rule.output.notification_body.as_deref(),
                context,
                body_limit,
            );
        }
        HardwareOutputType::Webhook => {
            rendered_rule.output.webhook_headers =
                render_optional_template(rule.output.webhook_headers.as_deref(), context, 4000);
            let body_limit = rule.output.webhook_body_max_chars.unwrap_or(8000) as usize;
            rendered_rule.output.webhook_body = render_optional_json_template(
                rule.output.webhook_body.as_deref(),
                context,
                body_limit,
                &rule.id,
            )?;
        }
        _ => {}
    }
    let command = hardware_rule_to_notice_command(&rendered_rule)?;

    Ok(SubmitRelayEventOutput {
        output_type: rendered_rule.output.output_type,
        rule_id: rendered_rule.id,
        command,
        notification_level: rendered_rule.output.notification_level,
        notification_title: rendered_rule.output.notification_title,
        notification_body: rendered_rule.output.notification_body,
        notification_throttle_seconds: rendered_rule.output.notification_throttle_seconds,
        notification_sound: rendered_rule.output.notification_sound,
        webhook_method: rendered_rule.output.webhook_method,
        webhook_url: rendered_rule.output.webhook_url,
        webhook_headers: rendered_rule.output.webhook_headers,
        webhook_body: rendered_rule.output.webhook_body,
        webhook_body_max_chars: rendered_rule.output.webhook_body_max_chars,
        sound_file_path: rendered_rule.output.sound_file_path,
        sound_volume_percent: rendered_rule.output.sound_volume_percent,
        sound_max_duration_ms: rendered_rule.output.sound_max_duration_ms,
        sound_throttle_seconds: rendered_rule.output.sound_throttle_seconds,
        desktop_notice_targets: rendered_rule.output.desktop_notice_targets,
    })
}

fn render_optional_template(
    template: Option<&str>,
    context: &TemplateRenderContext,
    max_chars: usize,
) -> Option<String> {
    template.map(|value| render_template(value, context, RenderLimit::new(max_chars)).text)
}

fn render_optional_json_template(
    template: Option<&str>,
    context: &TemplateRenderContext,
    max_chars: usize,
    rule_id: &str,
) -> Result<Option<String>, String> {
    let Some(template) = template else {
        return Ok(None);
    };
    if template.trim().is_empty() {
        return Ok(Some(template.to_string()));
    }
    let rendered = render_json_template(template, context, RenderLimit::new(max_chars)).text;
    if rendered.chars().count() > max_chars {
        return Err(format!(
            "rendered webhook body exceeds max chars for rule {rule_id}: {} > {max_chars}",
            rendered.chars().count()
        ));
    }
    serde_json::from_str::<serde_json::Value>(&rendered).map_err(|error| {
        format!("rendered webhook body is invalid JSON for rule {rule_id}: {error}")
    })?;

    Ok(Some(rendered))
}

fn default_enabled_hook_events() -> Vec<EnabledHookEvent> {
    ["codex", "claude-code"]
        .into_iter()
        .flat_map(|source| {
            default_selected_events(source)
                .into_iter()
                .map(move |event| EnabledHookEvent {
                    source: source.to_string(),
                    event,
                })
        })
        .collect()
}

#[cfg(test)]
#[path = "inbound_event_service_tests.rs"]
mod tests;
