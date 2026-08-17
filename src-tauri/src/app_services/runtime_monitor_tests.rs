use std::sync::{Arc, Mutex};
use time::{OffsetDateTime, UtcOffset};

use crate::app_services::inbound_event_service::{
    InboundEventOrigin, InboundEventService, SubmitRelayEventRequest,
};
use crate::app_services::local_hook_server_service::{
    LocalHookServerService, LocalHookServerStatus,
};
use crate::app_services::output_executor::{
    NoopOutputExecutor, OutputExecutionReport, OutputExecutor,
};
use crate::app_services::runtime_monitor::buckets::{bucket_start_for_offset, trim_old_buckets};
use crate::app_services::runtime_monitor::{
    RuntimeEventRecord, RuntimeMonitorService, RuntimeOutputRecord, RuntimeRecordOutcome,
};
use crate::core::app_config::DEFAULT_LOCAL_HOOK_PORT;
use crate::core::profiles::{HardwareOutput, HardwareOutputType, HardwareRule, NoticeProfile};

#[test]
fn bucket_start_rounds_down_to_minute() {
    let occurred_at = OffsetDateTime::parse(
        "2026-06-18T10:12:45Z",
        &time::format_description::well_known::Rfc3339,
    )
    .expect("test timestamp should parse");

    let bucket = bucket_start_for_offset(occurred_at, UtcOffset::UTC);

    assert_eq!("2026-06-18T10:12:00Z", bucket);
}

#[test]
fn bucket_start_uses_configured_local_offset() {
    let occurred_at = OffsetDateTime::parse(
        "2026-06-18T10:12:45Z",
        &time::format_description::well_known::Rfc3339,
    )
    .expect("test timestamp should parse");

    let bucket = bucket_start_for_offset(
        occurred_at,
        UtcOffset::from_hms(8, 0, 0).expect("valid offset"),
    );

    assert_eq!("2026-06-18T18:12:00+08:00", bucket);
}

#[test]
fn trim_old_buckets_keeps_latest_240_keys() {
    let buckets = (0..250)
        .map(|index| format!("2026-06-18T{:02}:{:02}:00Z", 10 + (index / 60), index % 60))
        .collect::<Vec<_>>();

    let trimmed = trim_old_buckets(buckets, 240);

    assert_eq!(240, trimmed.len());
    assert_eq!("2026-06-18T10:10:00Z", trimmed[0]);
    assert_eq!("2026-06-18T14:09:00Z", trimmed[239]);
}

#[test]
fn runtime_monitor_records_event_success_and_failure_buckets() {
    let mut service = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00Z");

    service.record_inbound_event(RuntimeEventRecord {
        source: "codex".to_string(),
        event: "Stop".to_string(),
        internal_event: Some("agent.completed".to_string()),
        outcome: RuntimeRecordOutcome::Success,
        occurred_at: "2026-06-18T10:12:10Z".to_string(),
    });
    service.record_inbound_event(RuntimeEventRecord {
        source: "codex".to_string(),
        event: "Stop".to_string(),
        internal_event: None,
        outcome: RuntimeRecordOutcome::Failure,
        occurred_at: "2026-06-18T10:12:50Z".to_string(),
    });

    let snapshot = service.snapshot_at("2026-06-18T10:13:00Z");

    assert_eq!(2, snapshot.total_events);
    assert_eq!(1, snapshot.total_failures);
    assert_eq!("codex", snapshot.events_by_source[0].key);
    assert_eq!(2, snapshot.events_by_source[0].count);
    assert_eq!(1, snapshot.event_series.len());
    assert_eq!(2, snapshot.event_series[0].total_count);
    assert_eq!(1, snapshot.event_series[0].success_count);
    assert_eq!(1, snapshot.event_series[0].failure_count);
    assert_eq!("error", snapshot.last_event.unwrap().result);
}

#[test]
fn runtime_monitor_snapshot_serializes_runtime_error_count_contract() {
    let mut service = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00Z");
    service.record_inbound_event(RuntimeEventRecord {
        source: "codex".to_string(),
        event: "UnknownEvent".to_string(),
        internal_event: None,
        outcome: RuntimeRecordOutcome::Failure,
        occurred_at: "2026-06-18T10:12:10Z".to_string(),
    });

    let value = serde_json::to_value(service.snapshot_at("2026-06-18T10:13:00Z"))
        .expect("snapshot should serialize");

    assert_eq!(
        Some(serde_json::json!(1)),
        value.get("runtimeErrorCount").cloned()
    );
    assert!(value.get("recentErrorCount").is_none());
}

#[test]
fn runtime_monitor_records_output_success_and_failure_buckets() {
    let mut service = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00Z");

    service.record_output(RuntimeOutputRecord {
        output_type: "webhook".to_string(),
        outcome: RuntimeRecordOutcome::Success,
        occurred_at: "2026-06-18T10:20:05Z".to_string(),
    });
    service.record_output(RuntimeOutputRecord {
        output_type: "webhook".to_string(),
        outcome: RuntimeRecordOutcome::Failure,
        occurred_at: "2026-06-18T10:20:45Z".to_string(),
    });

    let snapshot = service.snapshot_at("2026-06-18T10:21:00Z");

    assert_eq!(2, snapshot.total_outputs);
    assert_eq!(1, snapshot.total_failures);
    assert_eq!("webhook", snapshot.output_attempts_by_type[0].key);
    assert_eq!(2, snapshot.output_attempts_by_type[0].count);
    assert_eq!("webhook", snapshot.output_failures_by_type[0].key);
    assert_eq!(1, snapshot.output_failures_by_type[0].count);
    assert_eq!(1, snapshot.output_series.len());
    assert_eq!(2, snapshot.output_series[0].total_count);
    assert_eq!(1, snapshot.output_series[0].success_count);
    assert_eq!(1, snapshot.output_series[0].failure_count);
}

#[test]
fn inbound_origin_marks_debug_test_as_not_runtime_statistic() {
    assert!(InboundEventOrigin::RealHook.counts_for_runtime_monitor());
    assert!(!InboundEventOrigin::DebugTest.counts_for_runtime_monitor());
}

#[test]
fn submit_request_can_be_wrapped_with_origin_without_changing_payload() {
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "Stop".to_string(),
        payload: "{}".to_string(),
        raw_payload: None,
        occurred_at: "2026-06-18T10:00:00Z".to_string(),
    };

    let submitted = request.clone().with_origin(InboundEventOrigin::RealHook);

    assert_eq!(request, submitted.request);
    assert_eq!(InboundEventOrigin::RealHook, submitted.origin);
}

#[test]
fn local_hook_real_event_records_runtime_monitor_statistic() {
    let mut inbound = InboundEventService::with_profile(NoticeProfile::daily_coding());
    let mut executor = NoopOutputExecutor;
    let monitor = Arc::new(Mutex::new(RuntimeMonitorService::new_for_tests(
        "2026-06-18T10:00:00Z",
    )));
    let status = LocalHookServerStatus {
        running: true,
        port: DEFAULT_LOCAL_HOOK_PORT,
        bind_address: "127.0.0.1:17321".to_string(),
        event_url: "http://127.0.0.1:17321/api/v1/events".to_string(),
        health_url: "http://127.0.0.1:17321/health".to_string(),
        error: None,
    };
    let body = serde_json::json!({
        "source": "codex",
        "event": "UserPromptSubmit",
        "payload": "{}",
        "occurredAt": "2026-06-18T10:12:00Z"
    })
    .to_string();

    let response = LocalHookServerService::handle_request_with_executor_and_monitor(
        "POST",
        "/api/v1/events",
        &body,
        &mut inbound,
        &status,
        &mut executor,
        Arc::clone(&monitor),
    );

    assert_eq!(200, response.status_code);
    let snapshot = monitor.lock().expect("monitor lock should work").snapshot();
    assert_eq!(1, snapshot.total_events);
    assert_eq!(0, snapshot.total_failures);
}

#[derive(Default)]
struct MixedResultOutputExecutor;

impl OutputExecutor for MixedResultOutputExecutor {
    fn execute(
        &mut self,
        _result: &crate::app_services::inbound_event_service::SubmitRelayEventResult,
    ) -> Result<(), String> {
        Ok(())
    }

    fn execute_with_report(
        &mut self,
        result: &crate::app_services::inbound_event_service::SubmitRelayEventResult,
    ) -> OutputExecutionReport {
        OutputExecutionReport::from_outputs(result, |output| {
            output.output_type != HardwareOutputType::Webhook
        })
    }
}

struct MonitorLockProbeOutputExecutor {
    monitor: Arc<Mutex<RuntimeMonitorService>>,
    lock_available_during_execute: Arc<Mutex<Option<bool>>>,
}

impl OutputExecutor for MonitorLockProbeOutputExecutor {
    fn execute(
        &mut self,
        _result: &crate::app_services::inbound_event_service::SubmitRelayEventResult,
    ) -> Result<(), String> {
        Ok(())
    }

    fn execute_with_report(
        &mut self,
        result: &crate::app_services::inbound_event_service::SubmitRelayEventResult,
    ) -> OutputExecutionReport {
        let available = self.monitor.try_lock().is_ok();
        *self
            .lock_available_during_execute
            .lock()
            .expect("probe lock should work") = Some(available);
        OutputExecutionReport::from_outputs(result, |_| true)
    }
}

#[test]
fn local_hook_does_not_hold_runtime_monitor_lock_during_output_execution() {
    let mut inbound = InboundEventService::with_profile(NoticeProfile::daily_coding());
    let monitor = Arc::new(Mutex::new(RuntimeMonitorService::new_for_tests(
        "2026-06-18T10:00:00Z",
    )));
    let lock_available_during_execute = Arc::new(Mutex::new(None));
    let mut executor = MonitorLockProbeOutputExecutor {
        monitor: Arc::clone(&monitor),
        lock_available_during_execute: Arc::clone(&lock_available_during_execute),
    };
    let status = LocalHookServerStatus {
        running: true,
        port: DEFAULT_LOCAL_HOOK_PORT,
        bind_address: "127.0.0.1:17321".to_string(),
        event_url: "http://127.0.0.1:17321/api/v1/events".to_string(),
        health_url: "http://127.0.0.1:17321/health".to_string(),
        error: None,
    };
    let body = serde_json::json!({
        "source": "codex",
        "event": "UserPromptSubmit",
        "payload": "{}",
        "occurredAt": "2026-06-18T10:12:00Z"
    })
    .to_string();

    let response = LocalHookServerService::handle_request_with_executor_and_monitor(
        "POST",
        "/api/v1/events",
        &body,
        &mut inbound,
        &status,
        &mut executor,
        Arc::clone(&monitor),
    );

    assert_eq!(200, response.status_code);
    assert_eq!(
        Some(true),
        *lock_available_during_execute
            .lock()
            .expect("probe lock should work")
    );
}

#[test]
fn local_hook_records_output_result_per_output_type() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules = vec![
        output_rule_for_test(
            "agent-started-notification-runtime-test",
            HardwareOutputType::SystemNotification,
        ),
        output_rule_for_test(
            "agent-started-webhook-runtime-test",
            HardwareOutputType::Webhook,
        ),
    ];
    let mut inbound = InboundEventService::with_profile(profile);
    let mut executor = MixedResultOutputExecutor;
    let monitor = Arc::new(Mutex::new(RuntimeMonitorService::new_for_tests(
        "2026-06-18T10:00:00Z",
    )));
    let status = LocalHookServerStatus {
        running: true,
        port: DEFAULT_LOCAL_HOOK_PORT,
        bind_address: "127.0.0.1:17321".to_string(),
        event_url: "http://127.0.0.1:17321/api/v1/events".to_string(),
        health_url: "http://127.0.0.1:17321/health".to_string(),
        error: None,
    };
    let body = serde_json::json!({
        "source": "codex",
        "event": "UserPromptSubmit",
        "payload": "{}",
        "occurredAt": "2026-06-18T10:12:00Z"
    })
    .to_string();

    let response = LocalHookServerService::handle_request_with_executor_and_monitor(
        "POST",
        "/api/v1/events",
        &body,
        &mut inbound,
        &status,
        &mut executor,
        Arc::clone(&monitor),
    );

    assert_eq!(200, response.status_code);
    let snapshot = monitor.lock().expect("monitor lock should work").snapshot();
    assert_eq!(2, snapshot.total_outputs);
    assert_eq!(1, snapshot.total_failures);
    assert!(snapshot.output_series.iter().any(|bucket| {
        bucket.output_type == "system-notification"
            && bucket.success_count == 1
            && bucket.failure_count == 0
    }));
    assert!(snapshot.output_series.iter().any(|bucket| {
        bucket.output_type == "webhook" && bucket.success_count == 0 && bucket.failure_count == 1
    }));
}

fn output_rule_for_test(id: &str, output_type: HardwareOutputType) -> HardwareRule {
    HardwareRule {
        id: id.to_string(),
        internal_event: "agent.started".to_string(),
        output: HardwareOutput {
            output_type,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: Some("info".to_string()),
            notification_title: Some("{{source}}".to_string()),
            notification_body: Some("{{event}}".to_string()),
            notification_title_max_chars: Some(80),
            notification_body_max_chars: Some(300),
            notification_throttle_seconds: Some(0),
            notification_sound: None,
            webhook_method: Some("POST".to_string()),
            webhook_url: Some("https://example.test/hooks".to_string()),
            webhook_headers: None,
            webhook_body: Some(r#"{"event":"{{event}}"}"#.to_string()),
            webhook_body_max_chars: Some(8000),
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
