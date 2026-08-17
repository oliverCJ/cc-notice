use crate::app_services::custom_internal_event_service::{
    CreateCustomInternalEventRequest, CustomInternalEventService,
};
use crate::infrastructure::file_config;
use crate::test_support::unique_temp_root;

#[test]
fn create_custom_event_appends_user_defined_suffix_and_persists_file() {
    let root = unique_temp_root("cc-notice-custom-events");
    let mut service =
        CustomInternalEventService::from_config_root(root.join(".cc-notice")).unwrap();

    let event = service
        .create_custom_event(CreateCustomInternalEventRequest {
            id_prefix: "review.started".to_string(),
            title: "评审开始".to_string(),
            description: "开始 review".to_string(),
            scenario: "用户提交 review 请求".to_string(),
        })
        .unwrap();

    assert_eq!("review.started.userDefined", event.id);
    assert!(!event.built_in);
    assert!(root.join(".cc-notice/events/custom-events.json").exists());
}

#[test]
fn delete_custom_event_rejects_references_from_any_profile() {
    let root = unique_temp_root("cc-notice-custom-event-references");
    write_profile_with_custom_event(&root, "work", "工作方案", "review.started.userDefined");
    let mut service =
        CustomInternalEventService::from_config_root(root.join(".cc-notice")).unwrap();
    service
        .create_custom_event(valid_create_request("review.started"))
        .unwrap();

    let error = service
        .delete_custom_event("review.started.userDefined")
        .unwrap_err();

    assert!(error.contains("工作方案"));
}

#[test]
fn create_custom_event_rejects_short_prefix() {
    let root = unique_temp_root("cc-notice-custom-event-short-prefix");
    let mut service =
        CustomInternalEventService::from_config_root(root.join(".cc-notice")).unwrap();

    let error = service
        .create_custom_event(valid_create_request("ab"))
        .unwrap_err();

    assert!(error.contains("3..=32"));
}

#[test]
fn create_custom_event_allows_agent_started_user_defined() {
    let root = unique_temp_root("cc-notice-custom-event-agent-started");
    let mut service =
        CustomInternalEventService::from_config_root(root.join(".cc-notice")).unwrap();

    let event = service
        .create_custom_event(valid_create_request("agent.started"))
        .unwrap();

    assert_eq!("agent.started.userDefined", event.id);
}

fn valid_create_request(id_prefix: &str) -> CreateCustomInternalEventRequest {
    CreateCustomInternalEventRequest {
        id_prefix: id_prefix.to_string(),
        title: "评审开始".to_string(),
        description: "开始 review".to_string(),
        scenario: "用户提交 review 请求".to_string(),
    }
}

fn write_profile_with_custom_event(
    root: &std::path::Path,
    profile_id: &str,
    profile_name: &str,
    internal_event: &str,
) {
    let profile = serde_json::json!({
        "id": profile_id,
        "name": profile_name,
        "enabledHookEvents": [
            { "source": "codex", "event": "UserPromptSubmit" }
        ],
        "aiEventMappings": [
            {
                "id": "codex-user-prompt-custom",
                "source": "codex",
                "event": "UserPromptSubmit",
                "internalEvent": internal_event,
                "enabled": true
            }
        ],
        "hardwareRules": [
            {
                "id": "custom-system-notification-output",
                "internalEvent": internal_event,
                "output": {
                    "type": "system-notification",
                    "notificationLevel": "info",
                    "notificationTitle": "自定义",
                    "notificationBody": "{{internalEvent}}",
                    "notificationTitleMaxChars": 80,
                    "notificationBodyMaxChars": 300,
                    "notificationThrottleSeconds": 30,
                    "notificationSound": "default"
                },
                "priority": 50,
                "enabled": true
            }
        ],
        "device": {
            "boardId": "rp2040-pico",
            "transport": "serial"
        }
    });
    let path = root
        .join(".cc-notice")
        .join("profiles")
        .join(format!("{profile_id}.json"));
    file_config::write_string(&path, &serde_json::to_string_pretty(&profile).unwrap()).unwrap();
}
