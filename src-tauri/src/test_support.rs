use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::app_services::app_config_service::AppConfigService;
use crate::app_services::custom_internal_event_service::CustomInternalEventService;
use crate::app_services::desktop_notice_service::DesktopNoticeService;
use crate::app_services::device_input_service::DeviceInputService;
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::app_services::device_transport_monitor_service::DeviceTransportMonitorService;
use crate::app_services::inbound_event_service::InboundEventService;
use crate::app_services::local_hook_server_service::{LocalHookServerService, SharedHookAuthToken};
use crate::app_services::output_executor::NativeOutputExecutor;
use crate::app_services::profile_service::ProfileService;
use crate::app_services::runtime_monitor::RuntimeMonitorService;
use crate::app_services::tool_bin_service::ToolBinService;
use crate::core::app_config::{
    AppConfig, HookConfigTarget, HookConfigTargetScope, LocalHookServerConfig, UiConfig,
};
use crate::AppState;

pub(crate) fn hook_target_test_state(name: &str) -> (std::path::PathBuf, AppState) {
    let root = std::path::PathBuf::from("/private/tmp").join(format!(
        "cc-notice-hook-target-{name}-{}",
        std::process::id()
    ));
    let settings_path = root.join(".cc-notice").join("settings.json");
    let mut app_config_service =
        AppConfigService::from_settings_path(settings_path).expect("settings service");
    app_config_service
        .save_config(AppConfig {
            local_hook_server: LocalHookServerConfig { port: 17321 },
            ui: UiConfig {
                language: "zh-CN".to_string(),
                theme_mode: Default::default(),
            },
            active_profile_id: "daily-coding".to_string(),
            hook_config_targets: vec![
                HookConfigTarget {
                    id: "global-codex".to_string(),
                    scope: HookConfigTargetScope::Global,
                    source: "codex".to_string(),
                    label: "Codex 全局配置".to_string(),
                    project_path: None,
                    enabled: false,
                },
                HookConfigTarget {
                    id: "project-codex-test".to_string(),
                    scope: HookConfigTargetScope::Project,
                    source: "codex".to_string(),
                    label: "project-a".to_string(),
                    project_path: Some(root.join("project-a").to_string_lossy().to_string()),
                    enabled: false,
                },
                HookConfigTarget {
                    id: "project-claude-test".to_string(),
                    scope: HookConfigTargetScope::Project,
                    source: "claude-code".to_string(),
                    label: "project-a".to_string(),
                    project_path: Some(root.join("project-a").to_string_lossy().to_string()),
                    enabled: false,
                },
            ],
            ..AppConfig::default()
        })
        .expect("initial settings should save");
    let profile_service =
        ProfileService::from_config_root(root.join(".cc-notice")).expect("profile service");
    let custom_internal_event_service =
        CustomInternalEventService::from_config_root(root.join(".cc-notice"))
            .expect("custom internal event service");
    let state = AppState {
        inbound_event_service: Arc::new(Mutex::new(InboundEventService::default())),
        app_config_service: Mutex::new(app_config_service),
        profile_service: Mutex::new(profile_service),
        custom_internal_event_service: Mutex::new(custom_internal_event_service),
        local_hook_server_status: Arc::new(Mutex::new(LocalHookServerService::status_for_port(
            17321, false, None,
        ))),
        hook_auth_token: test_hook_auth_token(),
        output_executor: Arc::new(Mutex::new(NativeOutputExecutor::default())),
        device_input_service: Arc::new(Mutex::new(DeviceInputService::new(Vec::new()))),
        device_runtime_registry: Arc::new(Mutex::new(DeviceRuntimeRegistry::new(Vec::new()))),
        device_transport_monitor_service: Arc::new(Mutex::new(
            DeviceTransportMonitorService::default(),
        )),
        desktop_notice_service: Mutex::new(DesktopNoticeService::default()),
        runtime_monitor_service: Arc::new(Mutex::new(RuntimeMonitorService::default())),
        tool_bin_service: Mutex::new(test_tool_bin_service(&root)),
    };

    (root, state)
}

pub(crate) fn minimal_app_state_for_root(root: &std::path::Path) -> AppState {
    AppState {
        inbound_event_service: Arc::new(Mutex::new(InboundEventService::default())),
        app_config_service: Mutex::new(
            AppConfigService::from_settings_path(root.join(".cc-notice").join("settings.json"))
                .expect("config service should initialize"),
        ),
        custom_internal_event_service: Mutex::new(
            CustomInternalEventService::from_config_root(root.join(".cc-notice"))
                .expect("custom internal event service should initialize"),
        ),
        profile_service: Mutex::new(
            ProfileService::from_config_root(root.join(".cc-notice"))
                .expect("profile service should initialize"),
        ),
        local_hook_server_status: Arc::new(Mutex::new(LocalHookServerService::status_for_port(
            17321, false, None,
        ))),
        hook_auth_token: test_hook_auth_token(),
        output_executor: Arc::new(Mutex::new(NativeOutputExecutor::default())),
        device_input_service: Arc::new(Mutex::new(DeviceInputService::new(Vec::new()))),
        device_runtime_registry: Arc::new(Mutex::new(DeviceRuntimeRegistry::new(Vec::new()))),
        device_transport_monitor_service: Arc::new(Mutex::new(
            DeviceTransportMonitorService::default(),
        )),
        desktop_notice_service: Mutex::new(DesktopNoticeService::default()),
        runtime_monitor_service: Arc::new(Mutex::new(RuntimeMonitorService::default())),
        tool_bin_service: Mutex::new(test_tool_bin_service(root)),
    }
}

pub(crate) fn test_tool_bin_service(root: &std::path::Path) -> ToolBinService {
    let relay_source = root.join("relay-source").join("cc-notice-relay");
    std::fs::create_dir_all(relay_source.parent().expect("relay source parent"))
        .expect("relay source dir should exist");
    std::fs::write(&relay_source, "relay").expect("relay source should exist");
    ToolBinService::new(root.join(".cc-notice"), relay_source)
}

pub(crate) fn test_hook_auth_token() -> SharedHookAuthToken {
    Arc::new(Mutex::new(
        "123e4567-e89b-12d3-a456-426614174000".to_string(),
    ))
}

pub(crate) fn unique_temp_root(prefix: &str) -> std::path::PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}-{}-{unique}", std::process::id()))
}

pub(crate) fn home_env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}
