use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

use crate::app_services::custom_internal_event_service::{
    CreateCustomInternalEventRequest, UpdateCustomInternalEventRequest,
};
use crate::app_services::profile_package_service::{
    ProfilePackageImportPreview, ProfilePackageImportRequest, ProfilePackageService,
};
use crate::app_services::profile_service::ProfileFrontendState;
use crate::core::app_config::{AppConfig, HookEventSelections};
use crate::core::desktop_notice::DesktopNoticeInstance;
use crate::core::internal_events::{builtin_internal_event_catalog, builtin_internal_event_ids};
use crate::core::profiles::{
    EnabledHookEvent, InternalEventDefinition, NoticeProfile, ProfileTemplate,
};
use crate::infrastructure::file_config;
use crate::infrastructure::time_utils::current_local_rfc3339_timestamp;
use crate::startup::tray;
use crate::utils::profile_utils::{generate_profile_id, hook_events_from_selections};
use crate::AppState;

#[tauri::command]
pub fn profile_state(state: tauri::State<'_, AppState>) -> Result<ProfileFrontendState, String> {
    let service = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(service.state())
}

#[tauri::command]
pub fn save_profile(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    profile: NoticeProfile,
) -> Result<ProfileFrontendState, String> {
    let result = save_profile_impl(&state, profile)?;
    tray::refresh_tray_menu_after_state_change(&app, "profile saved");
    Ok(result)
}

pub(crate) fn save_profile_impl(
    state: &AppState,
    profile: NoticeProfile,
) -> Result<ProfileFrontendState, String> {
    let saved_profile_id = profile.id.clone();

    // 同时锁住两个服务，确保 Profile 保存和入站事件状态更新一致。
    let mut profile_service = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut inbound_service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;

    let valid_event_ids = valid_internal_event_ids_or_builtin(state)?;
    let next_state =
        profile_service.save_profile_with_internal_events(profile, &valid_event_ids)?;

    if saved_profile_id != next_state.active_profile_id {
        drop(inbound_service);
        drop(profile_service);
        return Ok(next_state);
    }

    inbound_service.set_profile(next_state.active_profile.clone());
    drop(inbound_service);
    drop(profile_service);

    Ok(next_state)
}

#[tauri::command]
pub fn create_profile(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    profile_name: String,
    template: Option<ProfileTemplate>,
) -> Result<ProfileFrontendState, String> {
    create_profile_impl(&state, profile_id, profile_name, template)
}

pub(crate) fn create_profile_impl(
    state: &AppState,
    profile_id: String,
    profile_name: String,
    template: Option<ProfileTemplate>,
) -> Result<ProfileFrontendState, String> {
    let mut service = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?;

    let generated_id = if profile_id.trim().is_empty() {
        generate_profile_id(&profile_name)
    } else {
        profile_id
    };

    service.create_profile(&generated_id, &profile_name, template)
}

#[tauri::command]
pub fn duplicate_profile(
    state: tauri::State<'_, AppState>,
    source_profile_id: String,
    profile_id: String,
    profile_name: String,
) -> Result<ProfileFrontendState, String> {
    let mut service = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?;

    let generated_id = if profile_id.trim().is_empty() {
        generate_profile_id(&profile_name)
    } else {
        profile_id
    };

    service.duplicate_profile(&source_profile_id, &generated_id, &profile_name)
}

#[tauri::command]
pub fn activate_profile(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    profile_id: String,
) -> Result<ProfileFrontendState, String> {
    let result = activate_profile_impl(&state, profile_id)?;
    tray::refresh_tray_menu_after_state_change(&app, "profile activated");
    Ok(result)
}

pub(crate) fn activate_profile_impl(
    state: &AppState,
    profile_id: String,
) -> Result<ProfileFrontendState, String> {
    tracing::info!("activating profile: {}", profile_id);

    let mut profile_service = state.profile_service.lock().map_err(|error| {
        let msg = format!("failed to lock profile service: {error}");
        tracing::error!("{}", msg);
        msg
    })?;

    let valid_event_ids = valid_internal_event_ids_or_builtin(state)?;

    let next_state = profile_service
        .activate_profile_with_internal_events(&profile_id, &valid_event_ids)
        .map_err(|error| {
            tracing::error!("failed to activate profile: {}", error);
            error
        })?;
    drop(profile_service);
    tracing::debug!("profile service unlocked");

    let mut app_config_service = state.app_config_service.lock().map_err(|error| {
        let msg = format!("failed to lock app config service: {error}");
        tracing::error!("{}", msg);
        msg
    })?;
    let mut config = app_config_service.config();
    config.active_profile_id = next_state.active_profile_id.clone();
    app_config_service.save_config(config).map_err(|error| {
        tracing::error!("failed to save app config: {}", error);
        error
    })?;
    drop(app_config_service);
    tracing::debug!("app config service unlocked");

    let mut inbound_service = state.inbound_event_service.lock().map_err(|error| {
        let msg = format!("failed to lock inbound service: {error}");
        tracing::error!("{}", msg);
        msg
    })?;
    inbound_service.set_profile(next_state.active_profile.clone());
    drop(inbound_service);
    tracing::debug!("inbound service unlocked");

    tracing::info!("profile activated successfully: {}", profile_id);
    Ok(next_state)
}

#[tauri::command]
pub fn delete_profile(
    state: tauri::State<'_, AppState>,
    profile_id: String,
) -> Result<ProfileFrontendState, String> {
    let mut service = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?;
    service.delete_profile(&profile_id)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageImportResult {
    pub profile_state: ProfileFrontendState,
    pub hook_event_selections: HookEventSelections,
    pub desktop_notice_instances: Vec<DesktopNoticeInstance>,
}

#[tauri::command]
pub fn export_profile_package(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let service = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?;
    let active_profile = service.active_profile();
    drop(service);
    let desktop_notice_instances = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?
        .config()
        .desktop_notice_instances;
    let device_board_ids = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .registered_device_board_ids();
    let package =
        ProfilePackageService::export_package_with_device_board_ids_and_desktop_notice_instances(
            &active_profile,
            &current_local_rfc3339_timestamp(),
            &device_board_ids,
            &desktop_notice_instances,
        );

    let content = serde_json::to_string_pretty(&package).map_err(|error| error.to_string())?;
    file_config::write_string(Path::new(&path), &content)
}

#[tauri::command]
pub fn preview_profile_package_import(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<ProfilePackageImportPreview, String> {
    let content = file_config::read_to_string(Path::new(&path))?;
    let package = ProfilePackageService::parse_package(&content)?;
    let existing_names = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?
        .list_profiles()?
        .into_iter()
        .map(|profile| profile.name)
        .collect::<Vec<_>>();
    let device_states = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .states();

    Ok(ProfilePackageService::preview_import(
        &package,
        &existing_names,
        &device_states,
    ))
}

#[tauri::command]
pub fn import_profile_package(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: ProfilePackageImportRequest,
) -> Result<ProfilePackageImportResult, String> {
    let content = file_config::read_to_string(Path::new(&request.package_path))?;
    let package = ProfilePackageService::parse_package(&content)?;
    let existing_names = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?
        .list_profiles()?
        .into_iter()
        .map(|profile| profile.name)
        .collect::<Vec<_>>();
    let device_states = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .states();
    let existing_desktop_notice_instances = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?
        .config()
        .desktop_notice_instances;
    let imported_name =
        ProfilePackageService::preview_import(&package, &existing_names, &device_states)
            .imported_profile_name;
    let valid_event_ids = valid_internal_event_ids_or_builtin(&state)?;
    let imported_package =
        ProfilePackageService::build_imported_profile_package_with_desktop_notice_instances(
            &package,
            &imported_name,
            &request.bindings,
            &device_states,
            &valid_event_ids,
            &existing_desktop_notice_instances,
        )?;
    let imported_profile = imported_package.profile;
    let imported_profile_id = imported_profile.id.clone();
    let mut next_state = save_profile_impl(&state, imported_profile)?;
    let imported_app_config = match apply_imported_profile_package_app_config_changes(
        &state,
        &package.profile.enabled_hook_events,
        imported_package.desktop_notice_instances,
    ) {
        Ok(changes) => changes,
        Err(error) => {
            rollback_imported_profile(&state, &imported_profile_id);
            return Err(error);
        }
    };

    if request.activate {
        next_state = activate_profile_impl(&state, imported_profile_id)?;
        tray::refresh_tray_menu_after_state_change(&app, "profile package imported and activated");
    }

    Ok(ProfilePackageImportResult {
        profile_state: next_state,
        hook_event_selections: imported_app_config.hook_event_selections,
        desktop_notice_instances: imported_app_config.desktop_notice_instances,
    })
}

#[tauri::command]
pub fn internal_event_catalog_command(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<InternalEventDefinition>, String> {
    internal_event_catalog_impl(&state)
}

pub(crate) fn internal_event_catalog_impl(
    state: &AppState,
) -> Result<Vec<InternalEventDefinition>, String> {
    let service = state
        .custom_internal_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    match service.merged_catalog() {
        Ok(events) => Ok(events),
        Err(error) => {
            tracing::warn!(
                "failed to load custom internal event catalog, using builtin catalog only: {error}"
            );
            Ok(builtin_internal_event_catalog())
        }
    }
}

#[tauri::command]
pub fn create_custom_internal_event(
    state: tauri::State<'_, AppState>,
    request: CreateCustomInternalEventRequest,
) -> Result<Vec<InternalEventDefinition>, String> {
    let mut service = state
        .custom_internal_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    service.create_custom_event(request)?;
    service.merged_catalog()
}

#[tauri::command]
pub fn update_custom_internal_event(
    state: tauri::State<'_, AppState>,
    request: UpdateCustomInternalEventRequest,
) -> Result<Vec<InternalEventDefinition>, String> {
    let mut service = state
        .custom_internal_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    service.update_custom_event(request)?;
    service.merged_catalog()
}

#[tauri::command]
pub fn delete_custom_internal_event(
    state: tauri::State<'_, AppState>,
    event_id: String,
) -> Result<Vec<InternalEventDefinition>, String> {
    let mut service = state
        .custom_internal_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    service.delete_custom_event(&event_id)?;
    service.merged_catalog()
}

fn valid_internal_event_ids_or_builtin(
    state: &AppState,
) -> Result<std::collections::HashSet<String>, String> {
    let service = state
        .custom_internal_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    match service.valid_event_ids() {
        Ok(event_ids) => Ok(event_ids),
        Err(error) => {
            tracing::warn!(
                "failed to load custom internal event ids, using builtin catalog only: {error}"
            );
            Ok(builtin_internal_event_ids())
        }
    }
}

struct ImportedProfilePackageAppConfigChanges {
    hook_event_selections: HookEventSelections,
    desktop_notice_instances: Vec<DesktopNoticeInstance>,
}

fn apply_imported_profile_package_app_config_changes(
    state: &AppState,
    imported_events: &[EnabledHookEvent],
    imported_instances: Vec<DesktopNoticeInstance>,
) -> Result<ImportedProfilePackageAppConfigChanges, String> {
    let mut app_config_service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = app_config_service.config();
    apply_imported_profile_package_config_changes(&mut config, imported_events, imported_instances);
    let saved = app_config_service.save_config(config)?;
    drop(app_config_service);

    let mut inbound_service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    inbound_service
        .set_enabled_hook_events(hook_events_from_selections(&saved.hook_event_selections));

    Ok(ImportedProfilePackageAppConfigChanges {
        hook_event_selections: saved.hook_event_selections,
        desktop_notice_instances: saved.desktop_notice_instances,
    })
}

fn apply_imported_profile_package_config_changes(
    config: &mut AppConfig,
    imported_events: &[EnabledHookEvent],
    imported_instances: Vec<DesktopNoticeInstance>,
) {
    let mut selections = config.hook_event_selections.clone();
    for event in imported_events {
        let mut events = selections.events_for_source(&event.source);
        if !events.iter().any(|current| current == &event.event) {
            events.push(event.event.clone());
        }
        selections.set_events_for_source(&event.source, events);
    }
    config.hook_event_selections = selections;
    config.desktop_notice_instances.extend(imported_instances);
}

fn rollback_imported_profile(state: &AppState, imported_profile_id: &str) {
    let result = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())
        .and_then(|mut service| service.delete_profile(imported_profile_id).map(|_| ()));
    if let Err(error) = result {
        tracing::warn!(
            profile_id = imported_profile_id,
            error,
            "failed to rollback imported profile after hook selection sync failure"
        );
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileTemplateInfo {
    pub id: ProfileTemplate,
    pub name: String,
    pub description: String,
    pub recommended: bool,
}

#[tauri::command]
pub fn profile_template_list() -> Vec<ProfileTemplateInfo> {
    ProfileTemplate::all()
        .into_iter()
        .map(|template| ProfileTemplateInfo {
            name: template.name().to_string(),
            description: template.description().to_string(),
            recommended: template.is_recommended(),
            id: template,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use crate::app_services::app_config_service::AppConfigService;
    use crate::app_services::custom_internal_event_service::{
        CreateCustomInternalEventRequest, CustomInternalEventService,
    };
    use crate::app_services::desktop_notice_service::DesktopNoticeService;
    use crate::app_services::device_input_service::DeviceInputService;
    use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
    use crate::app_services::device_transport_monitor_service::DeviceTransportMonitorService;
    use crate::app_services::inbound_event_service::InboundEventService;
    use crate::app_services::local_hook_server_service::LocalHookServerService;
    use crate::app_services::output_executor::NativeOutputExecutor;
    use crate::app_services::profile_service::ProfileService;
    use crate::app_services::runtime_monitor::RuntimeMonitorService;
    use crate::core::app_config::{AppConfig, LocalHookServerConfig, UiConfig};
    use crate::core::desktop_notice::DesktopNoticeInstance;
    use crate::core::profiles::EnabledHookEvent;
    use crate::core::profiles::NoticeProfile;
    use crate::test_support::{
        minimal_app_state_for_root, test_hook_auth_token, test_tool_bin_service, unique_temp_root,
    };
    use crate::AppState;

    use super::{
        activate_profile_impl, apply_imported_profile_package_config_changes, create_profile_impl,
        internal_event_catalog_impl,
    };

    #[test]
    fn activate_profile_command_persists_active_profile_id_in_settings() {
        let root = unique_temp_root("cc-notice-activate-command");
        let settings_path = root.join(".cc-notice").join("settings.json");
        let mut app_config_service =
            AppConfigService::from_settings_path(settings_path.clone()).expect("settings service");
        app_config_service
            .save_config(AppConfig {
                local_hook_server: LocalHookServerConfig { port: 17321 },
                ui: UiConfig {
                    language: "zh-CN".to_string(),
                    theme_mode: Default::default(),
                },
                active_profile_id: "daily-coding".to_string(),
                ..AppConfig::default()
            })
            .expect("initial settings should save");

        let mut profile_service = ProfileService::from_config_root(root.join(".cc-notice"))
            .expect("profile service should load");
        let mut profile = NoticeProfile::daily_coding();
        profile.id = "focus-mode".to_string();
        profile.name = "专注模式".to_string();
        profile_service
            .save_profile(profile)
            .expect("profile should save");
        let state = AppState {
            inbound_event_service: Arc::new(Mutex::new(InboundEventService::default())),
            app_config_service: Mutex::new(app_config_service),
            profile_service: Mutex::new(profile_service),
            custom_internal_event_service: Mutex::new(
                CustomInternalEventService::from_config_root(root.join(".cc-notice"))
                    .expect("custom event service should load"),
            ),
            local_hook_server_status: Arc::new(Mutex::new(
                LocalHookServerService::status_for_port(17321, false, None),
            )),
            hook_auth_token: test_hook_auth_token(),
            tool_bin_service: Mutex::new(test_tool_bin_service(&root)),
            output_executor: Arc::new(Mutex::new(NativeOutputExecutor::default())),
            device_input_service: Arc::new(Mutex::new(DeviceInputService::new(Vec::new()))),
            device_runtime_registry: Arc::new(Mutex::new(DeviceRuntimeRegistry::new(Vec::new()))),
            device_transport_monitor_service: Arc::new(Mutex::new(
                DeviceTransportMonitorService::default(),
            )),
            desktop_notice_service: Mutex::new(DesktopNoticeService::default()),
            runtime_monitor_service: Arc::new(Mutex::new(RuntimeMonitorService::default())),
        };

        let next_state = activate_profile_impl(&state, "focus-mode".to_string())
            .expect("profile should activate");
        let loaded = AppConfigService::from_settings_path(settings_path)
            .expect("settings should reload after activation");

        assert_eq!("focus-mode", next_state.active_profile_id);
        assert_eq!("focus-mode", loaded.config().active_profile_id);
    }

    #[test]
    fn create_profile_auto_generates_id_when_empty() {
        let root = unique_temp_root("cc-notice-auto-id");
        let profile_service = ProfileService::from_config_root(root.join(".cc-notice"))
            .expect("profile service should load");
        let state = AppState {
            inbound_event_service: Arc::new(Mutex::new(InboundEventService::default())),
            app_config_service: Mutex::new(AppConfigService::default()),
            profile_service: Mutex::new(profile_service),
            custom_internal_event_service: Mutex::new(
                CustomInternalEventService::from_config_root(root.join(".cc-notice"))
                    .expect("custom event service should load"),
            ),
            local_hook_server_status: Arc::new(Mutex::new(
                LocalHookServerService::status_for_port(17321, false, None),
            )),
            hook_auth_token: test_hook_auth_token(),
            tool_bin_service: Mutex::new(test_tool_bin_service(&root)),
            output_executor: Arc::new(Mutex::new(NativeOutputExecutor::default())),
            device_input_service: Arc::new(Mutex::new(DeviceInputService::new(Vec::new()))),
            device_runtime_registry: Arc::new(Mutex::new(DeviceRuntimeRegistry::new(Vec::new()))),
            device_transport_monitor_service: Arc::new(Mutex::new(
                DeviceTransportMonitorService::default(),
            )),
            desktop_notice_service: Mutex::new(DesktopNoticeService::default()),
            runtime_monitor_service: Arc::new(Mutex::new(RuntimeMonitorService::default())),
        };

        let result = create_profile_impl(&state, "".to_string(), "测试配置".to_string(), None)
            .expect("should create profile with auto-generated id");

        let created_profile = result
            .profiles
            .iter()
            .find(|profile| profile.name == "测试配置")
            .expect("created profile should be listed");
        assert!(!created_profile.id.is_empty());
        assert!(!created_profile.active);
    }

    #[test]
    fn internal_event_catalog_command_returns_custom_events() {
        let root = unique_temp_root("cc-notice-custom-catalog-command");
        let mut custom_internal_event_service =
            CustomInternalEventService::from_config_root(root.join(".cc-notice"))
                .expect("custom event service should load");
        custom_internal_event_service
            .create_custom_event(CreateCustomInternalEventRequest {
                id_prefix: "review.started".to_string(),
                title: "评审开始".to_string(),
                description: "开始 review".to_string(),
                scenario: "用户提交 review 请求".to_string(),
            })
            .expect("custom event should be created");
        let valid_event_ids = custom_internal_event_service
            .valid_event_ids()
            .expect("valid event ids should load");
        let profile_service = ProfileService::from_config_root_with_active_id_and_internal_events(
            root.join(".cc-notice"),
            "daily-coding".to_string(),
            &valid_event_ids,
        )
        .expect("profile service should load");
        let state = AppState {
            inbound_event_service: Arc::new(Mutex::new(InboundEventService::default())),
            app_config_service: Mutex::new(AppConfigService::default()),
            profile_service: Mutex::new(profile_service),
            custom_internal_event_service: Mutex::new(custom_internal_event_service),
            local_hook_server_status: Arc::new(Mutex::new(
                LocalHookServerService::status_for_port(17321, false, None),
            )),
            hook_auth_token: test_hook_auth_token(),
            tool_bin_service: Mutex::new(test_tool_bin_service(&root)),
            output_executor: Arc::new(Mutex::new(NativeOutputExecutor::default())),
            device_input_service: Arc::new(Mutex::new(DeviceInputService::new(Vec::new()))),
            device_runtime_registry: Arc::new(Mutex::new(DeviceRuntimeRegistry::new(Vec::new()))),
            device_transport_monitor_service: Arc::new(Mutex::new(
                DeviceTransportMonitorService::default(),
            )),
            desktop_notice_service: Mutex::new(DesktopNoticeService::default()),
            runtime_monitor_service: Arc::new(Mutex::new(RuntimeMonitorService::default())),
        };

        let events = internal_event_catalog_impl(&state).expect("catalog should load");

        assert!(events
            .iter()
            .any(|event| event.id == "review.started.userDefined"));
    }

    #[test]
    fn internal_event_catalog_command_falls_back_to_builtin_when_custom_store_is_corrupt() {
        let root = unique_temp_root("cc-notice-custom-catalog-corrupt");
        let state = minimal_app_state_for_root(&root);
        let custom_events_path = root
            .join(".cc-notice")
            .join("events")
            .join("custom-events.json");
        std::fs::write(&custom_events_path, "{ invalid json")
            .expect("corrupt custom event store should be written");

        let events = internal_event_catalog_impl(&state).expect("catalog should recover");

        assert!(events.iter().any(|event| event.id == "agent.started"));
        assert!(!events.iter().any(|event| !event.built_in));
    }

    #[test]
    fn imported_profile_package_app_config_changes_merge_hook_selection_and_desktop_notices() {
        let mut config = AppConfig::default();
        config
            .hook_event_selections
            .set_events_for_source("codex", vec!["stop".to_string()]);
        let imported_instance =
            DesktopNoticeInstance::new_custom_lightbar("desktop-notice-import-a1b2c3", "导入灯条");

        apply_imported_profile_package_config_changes(
            &mut config,
            &[EnabledHookEvent {
                source: "codex".to_string(),
                event: "notification".to_string(),
            }],
            vec![imported_instance],
        );

        assert_eq!(
            vec!["stop".to_string(), "notification".to_string()],
            config.hook_event_selections.events_for_source("codex")
        );
        assert_eq!(1, config.desktop_notice_instances.len());
        assert_eq!(
            "desktop-notice-import-a1b2c3",
            config.desktop_notice_instances[0].id
        );
    }

    #[test]
    fn profile_template_list_returns_yaml_metadata_in_contract_order() {
        let templates = super::profile_template_list();

        assert_eq!(3, templates.len());
        assert_eq!(
            crate::core::profiles::ProfileTemplate::Basic,
            templates[0].id
        );
        assert_eq!("基础映射方案", templates[0].name);
        assert_eq!(
            "预设常用 AI Hook 到内部事件的映射和基础输出规则，不启用任何 Hook。",
            templates[0].description
        );
        assert!(templates[0].recommended);
        assert_eq!(
            crate::core::profiles::ProfileTemplate::Blank,
            templates[2].id
        );
        assert_eq!("空白方案", templates[2].name);
        assert!(!templates[2].recommended);
    }
}
