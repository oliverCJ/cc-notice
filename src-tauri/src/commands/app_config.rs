use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

use crate::app_services::hook_event_service::{HookEventFrontendState, HookEventService};
use crate::app_services::profile_service::ProfileFrontendState;
use crate::core::app_config::AppConfig;
use crate::core::device::DeviceRuntimeState;
use crate::core::profiles::NoticeProfile;
use crate::startup::tray;
use crate::utils::profile_utils::hook_events_from_selections;
use crate::{infrastructure, AppState};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigSaveResult {
    pub config: AppConfig,
    /// 标记是否需要重启应用以使配置生效
    #[serde(default)]
    pub restart_required: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ResetConfigurationScope {
    AppSettings,
    HookSettings,
    ProfileMappings,
    Devices,
    All,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetConfigurationResult {
    pub config: AppConfig,
    pub profile_state: ProfileFrontendState,
    pub hook_event_state: HookEventFrontendState,
    pub device_states: Vec<DeviceRuntimeState>,
}

#[tauri::command]
pub fn get_app_config(state: tauri::State<'_, AppState>) -> Result<AppConfig, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(service.config())
}

#[tauri::command]
pub fn save_app_config(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    config: AppConfig,
) -> Result<AppConfigSaveResult, String> {
    config.validate()?;
    let (port_changed, old_port, new_port, previous_launch_at_login, next_launch_at_login) = {
        let service = state
            .app_config_service
            .lock()
            .map_err(|error| error.to_string())?;

        let previous_config = service.config();
        let old_port = previous_config.local_hook_server.port;
        let new_port = config.local_hook_server.port;
        let port_changed = old_port != new_port;
        (
            port_changed,
            old_port,
            new_port,
            previous_config.window.launch_at_login,
            config.window.launch_at_login,
        )
    };

    let launch_at_login_changed = previous_launch_at_login != next_launch_at_login;
    if launch_at_login_changed {
        sync_launch_at_login(&app, next_launch_at_login)?;
    }

    // 托盘刷新会读取 AppConfig 快照，必须在刷新前释放配置锁，避免同线程自锁。
    let saved_config = {
        let mut service = state
            .app_config_service
            .lock()
            .map_err(|error| error.to_string())?;
        // 保存配置时只标记需要重启，不在命令层重启本地服务。
        match service.save_config(config) {
            Ok(saved_config) => saved_config,
            Err(error) => {
                if launch_at_login_changed {
                    rollback_launch_at_login_after_failed_save(
                        &app,
                        previous_launch_at_login,
                        &error,
                    );
                }
                return Err(error);
            }
        }
    };

    if port_changed {
        tracing::warn!(
            "local hook server port changed from {} to {}, restart required",
            old_port,
            new_port
        );
    }

    let result = AppConfigSaveResult {
        config: saved_config,
        restart_required: port_changed,
    };
    tray::refresh_tray_menu_after_state_change(&app, "app config saved");
    Ok(result)
}

fn rollback_launch_at_login_after_failed_save<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    previous_launch_at_login: bool,
    save_error: &str,
) {
    if let Err(rollback_error) = sync_launch_at_login(app, previous_launch_at_login) {
        tracing::warn!(
            "failed to rollback launch-at-login after config save failure: save_error={save_error}, rollback_error={rollback_error}"
        );
    }
}

fn sync_launch_at_login<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    launch_at_login: bool,
) -> Result<(), String> {
    let autostart = app.autolaunch();
    let result = if launch_at_login {
        autostart.enable()
    } else {
        autostart.disable()
    };

    result.map_err(|error| {
        tracing::warn!("failed to sync launch-at-login setting: {error}");
        "autostart_sync_failed".to_string()
    })
}

#[tauri::command]
pub fn reset_configuration(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    scope: ResetConfigurationScope,
) -> Result<ResetConfigurationResult, String> {
    let previous_launch_at_login = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?
        .config()
        .window
        .launch_at_login;
    let next_launch_at_login = launch_at_login_after_reset(previous_launch_at_login, &scope);
    let launch_at_login_changed = previous_launch_at_login != next_launch_at_login;

    if launch_at_login_changed {
        sync_launch_at_login(&app, next_launch_at_login)?;
    }

    let result = match reset_configuration_impl(&state, scope) {
        Ok(result) => result,
        Err(error) => {
            if launch_at_login_changed {
                rollback_launch_at_login_after_failed_save(&app, previous_launch_at_login, &error);
            }
            return Err(error);
        }
    };
    tray::refresh_tray_menu_after_state_change(&app, "configuration reset");
    Ok(result)
}

fn launch_at_login_after_reset(
    previous_launch_at_login: bool,
    scope: &ResetConfigurationScope,
) -> bool {
    match scope {
        ResetConfigurationScope::AppSettings | ResetConfigurationScope::All => {
            AppConfig::default().window.launch_at_login
        }
        ResetConfigurationScope::HookSettings
        | ResetConfigurationScope::ProfileMappings
        | ResetConfigurationScope::Devices => previous_launch_at_login,
    }
}

pub(crate) fn reset_configuration_impl(
    state: &AppState,
    scope: ResetConfigurationScope,
) -> Result<ResetConfigurationResult, String> {
    let home = user_home_from_env(std::env::var("HOME").ok())?;
    let mut config_service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut profile_service = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?;

    let mut config = config_service.config();
    let mut profile = profile_service.active_profile();
    let default_config = AppConfig::default();
    let default_profile = NoticeProfile::daily_coding();

    match scope {
        ResetConfigurationScope::AppSettings => {
            config.local_hook_server = default_config.local_hook_server.clone();
            config.ui = default_config.ui.clone();
            config.window = default_config.window.clone();
            config.arduino_cli_path = default_config.arduino_cli_path.clone();
            config = config_service.save_config(config)?;
        }
        ResetConfigurationScope::HookSettings => {
            config.hook_event_selections = default_config.hook_event_selections.clone();
            config.hook_config_targets = default_config.hook_config_targets.clone();
            config = config_service.save_config(config)?;
        }
        ResetConfigurationScope::ProfileMappings => {
            reset_profile_mappings(&mut profile, &default_profile);
            profile_service.save_profile(profile)?;
        }
        ResetConfigurationScope::Devices => {
            config.devices = default_config.devices.clone();
            config = config_service.save_config(config)?;
            replace_runtime_devices(state, config.devices.clone())?;
        }
        ResetConfigurationScope::All => {
            config = config_service.save_config(default_config)?;
            profile_service.reset_all_to_default()?;
            replace_runtime_devices(state, config.devices.clone())?;
        }
    }

    let profile_state = profile_service.state();
    let active_profile = profile_service.active_profile();
    drop(profile_service);
    drop(config_service);

    let mut inbound_service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    inbound_service.set_profile(active_profile.clone());
    inbound_service
        .set_enabled_hook_events(hook_events_from_selections(&config.hook_event_selections));
    drop(inbound_service);

    let device_states = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .states();
    let hook_event_state = HookEventService::state_for_config(&config, &home)?;

    tracing::info!("configuration reset completed");
    Ok(ResetConfigurationResult {
        config,
        profile_state,
        hook_event_state,
        device_states,
    })
}

fn reset_profile_mappings(profile: &mut NoticeProfile, default_profile: &NoticeProfile) {
    profile.ai_event_mappings = default_profile.ai_event_mappings.clone();
    profile.hardware_rules = default_profile.hardware_rules.clone();
    profile.device = default_profile.device.clone();
}

fn replace_runtime_devices(
    state: &AppState,
    devices: Vec<crate::core::device::DeviceInstance>,
) -> Result<(), String> {
    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.replace_devices(devices);
    Ok(())
}

#[tauri::command]
pub fn rotate_hook_auth_token(state: tauri::State<'_, AppState>) -> Result<(), String> {
    rotate_hook_auth_token_impl(&state)
}

pub(crate) fn rotate_hook_auth_token_impl(state: &AppState) -> Result<(), String> {
    let app_home = infrastructure::app_paths::app_home_dir()?;
    let next_token = infrastructure::auth_token::generate_token();
    let mut current_token = state
        .hook_auth_token
        .lock()
        .map_err(|error| error.to_string())?;
    let previous_token = current_token.clone();
    *current_token = next_token.clone();
    if let Err(error) = infrastructure::auth_token::write_token(&app_home, &next_token) {
        *current_token = previous_token;
        return Err(error);
    }
    tracing::info!("hook auth token rotated");
    Ok(())
}

pub(crate) fn user_home_from_env(home: Option<String>) -> Result<std::path::PathBuf, String> {
    if let Some(home) = home.filter(|value| !value.trim().is_empty()) {
        return Ok(std::path::PathBuf::from(home));
    }
    infrastructure::app_paths::user_home_dir()
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use crate::app_services::app_config_service::AppConfigService;
    use crate::app_services::custom_internal_event_service::CustomInternalEventService;
    use crate::app_services::desktop_notice_service::DesktopNoticeService;
    use crate::app_services::device_input_service::DeviceInputService;
    use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
    use crate::app_services::device_transport_monitor_service::DeviceTransportMonitorService;
    use crate::app_services::inbound_event_service::InboundEventService;
    use crate::app_services::local_hook_server_service::LocalHookServerService;
    use crate::app_services::output_executor::NativeOutputExecutor;
    use crate::app_services::profile_service::ProfileService;
    use crate::app_services::runtime_monitor::RuntimeMonitorService;
    use crate::core::app_config::{
        AppConfig, HookConfigTarget, HookConfigTargetScope, LocalHookServerConfig, UiConfig,
    };
    use crate::core::device::{DeviceInstance, DeviceTransportConfig};
    use crate::core::profiles::{AiEventMapping, HardwareRule, NoticeProfile};
    use crate::infrastructure;
    use crate::test_support::{
        home_env_lock, minimal_app_state_for_root, test_hook_auth_token, test_tool_bin_service,
        unique_temp_root,
    };
    use crate::AppState;

    use super::{
        launch_at_login_after_reset, reset_configuration_impl, rotate_hook_auth_token_impl,
        user_home_from_env, ResetConfigurationScope,
    };

    #[test]
    fn user_home_error_message_is_readable_when_home_missing() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let old_home = std::env::var_os("HOME");
        let old_userprofile = std::env::var_os("USERPROFILE");
        let old_homedrive = std::env::var_os("HOMEDRIVE");
        let old_homepath = std::env::var_os("HOMEPATH");
        std::env::remove_var("HOME");
        std::env::remove_var("USERPROFILE");
        std::env::remove_var("HOMEDRIVE");
        std::env::remove_var("HOMEPATH");

        let error = user_home_from_env(None).expect_err("missing home should fail");

        assert_eq!("user home directory is not available", error);
        restore_env("HOME", old_home);
        restore_env("USERPROFILE", old_userprofile);
        restore_env("HOMEDRIVE", old_homedrive);
        restore_env("HOMEPATH", old_homepath);
    }

    #[test]
    fn user_home_from_env_uses_home_path() {
        let home =
            user_home_from_env(Some("/Users/alice".to_string())).expect("home should resolve");

        assert_eq!(std::path::Path::new("/Users/alice"), home.as_path());
    }

    #[test]
    fn user_home_from_env_ignores_empty_home_and_uses_userprofile() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let old_home = std::env::var_os("HOME");
        let old_userprofile = std::env::var_os("USERPROFILE");
        let old_homedrive = std::env::var_os("HOMEDRIVE");
        let old_homepath = std::env::var_os("HOMEPATH");
        std::env::set_var("HOME", "");
        std::env::set_var("USERPROFILE", "C:\\Users\\alice");
        std::env::remove_var("HOMEDRIVE");
        std::env::remove_var("HOMEPATH");

        let home = user_home_from_env(std::env::var("HOME").ok()).expect("home should resolve");

        assert_eq!(std::path::Path::new("C:\\Users\\alice"), home.as_path());
        restore_env("HOME", old_home);
        restore_env("USERPROFILE", old_userprofile);
        restore_env("HOMEDRIVE", old_homedrive);
        restore_env("HOMEPATH", old_homepath);
    }

    #[test]
    fn app_settings_and_all_reset_disable_launch_at_login() {
        assert!(!launch_at_login_after_reset(
            true,
            &ResetConfigurationScope::AppSettings
        ));
        assert!(!launch_at_login_after_reset(
            true,
            &ResetConfigurationScope::All
        ));
    }

    #[test]
    fn non_app_settings_reset_keeps_launch_at_login() {
        assert!(launch_at_login_after_reset(
            true,
            &ResetConfigurationScope::HookSettings
        ));
        assert!(launch_at_login_after_reset(
            true,
            &ResetConfigurationScope::ProfileMappings
        ));
        assert!(launch_at_login_after_reset(
            true,
            &ResetConfigurationScope::Devices
        ));
    }

    fn restore_env(name: &str, value: Option<std::ffi::OsString>) {
        if let Some(value) = value {
            std::env::set_var(name, value);
        } else {
            std::env::remove_var(name);
        }
    }

    #[test]
    fn rotate_hook_auth_token_updates_file_and_runtime_state() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let root = unique_temp_root("cc-notice-rotate-token");
        let app_home = root.join(".cc-notice");
        std::fs::create_dir_all(&app_home).expect("app home should exist");
        infrastructure::auth_token::write_token(&app_home, "123e4567-e89b-12d3-a456-426614174000")
            .expect("old token should be written");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &root);
        let state = minimal_app_state_for_root(&root);
        *state.hook_auth_token.lock().expect("auth token lock") =
            "123e4567-e89b-12d3-a456-426614174000".to_string();

        rotate_hook_auth_token_impl(&state).expect("token should rotate");

        let stored = infrastructure::auth_token::read_token(&app_home)
            .expect("new token should be readable");
        let runtime = state
            .hook_auth_token
            .lock()
            .expect("auth token lock")
            .clone();
        assert_eq!(stored, runtime);
        assert_ne!("123e4567-e89b-12d3-a456-426614174000", stored);

        restore_home(old_home);
    }

    #[test]
    fn rotate_hook_auth_token_keeps_runtime_token_when_file_write_fails() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let root = unique_temp_root("cc-notice-rotate-token-fail");
        let app_home = root.join(".cc-notice");
        std::fs::create_dir_all(&app_home).expect("app home should exist");
        infrastructure::auth_token::write_token(&app_home, "123e4567-e89b-12d3-a456-426614174000")
            .expect("old token should be written");
        let token_path = infrastructure::auth_token::token_file_path(&app_home);
        std::fs::remove_file(&token_path).expect("token file should be removable");
        std::fs::create_dir_all(&token_path).expect("directory blocks token file write");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &root);
        let state = minimal_app_state_for_root(&root);
        *state.hook_auth_token.lock().expect("auth token lock") =
            "123e4567-e89b-12d3-a456-426614174000".to_string();

        let error = rotate_hook_auth_token_impl(&state).expect_err("file write should fail");

        let runtime = state
            .hook_auth_token
            .lock()
            .expect("auth token lock")
            .clone();
        assert_eq!("123e4567-e89b-12d3-a456-426614174000", runtime);
        assert!(error.contains("failed to write token file"));

        restore_home(old_home);
    }

    #[test]
    fn rotate_hook_auth_token_does_not_write_file_when_runtime_lock_fails() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let root = unique_temp_root("cc-notice-rotate-token-lock-fail");
        let app_home = root.join(".cc-notice");
        std::fs::create_dir_all(&app_home).expect("app home should exist");
        infrastructure::auth_token::write_token(&app_home, "123e4567-e89b-12d3-a456-426614174000")
            .expect("old token should be written");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &root);
        let state = minimal_app_state_for_root(&root);
        let token_state = Arc::clone(&state.hook_auth_token);
        let _ = std::panic::catch_unwind(move || {
            let _guard = token_state.lock().expect("auth token lock");
            panic!("poison hook auth token lock");
        });

        let error = rotate_hook_auth_token_impl(&state).expect_err("lock failure should fail");

        let stored =
            infrastructure::auth_token::read_token(&app_home).expect("old token should remain");
        assert_eq!("123e4567-e89b-12d3-a456-426614174000", stored);
        assert!(error.contains("poisoned") || error.contains("lock"));

        restore_home(old_home);
    }

    #[test]
    fn save_app_config_marks_restart_required_when_port_changes() {
        let root = unique_temp_root("cc-notice-port-change");
        let settings_path = root.join(".cc-notice").join("settings.json");
        let app_config_service =
            AppConfigService::from_settings_path(settings_path).expect("settings service");

        let initial_port = 17321;
        {
            let mut service = app_config_service.clone();
            let mut config = AppConfig::default();
            config.local_hook_server.port = initial_port;
            service
                .save_config(config)
                .expect("initial config should save");
        }

        let state = AppState {
            inbound_event_service: Arc::new(std::sync::Mutex::new(InboundEventService::default())),
            app_config_service: std::sync::Mutex::new(app_config_service),
            profile_service: std::sync::Mutex::new(
                ProfileService::from_config_root(root.join(".cc-notice")).expect("profile service"),
            ),
            custom_internal_event_service: std::sync::Mutex::new(
                CustomInternalEventService::from_config_root(root.join(".cc-notice"))
                    .expect("custom internal event service"),
            ),
            local_hook_server_status: Arc::new(std::sync::Mutex::new(
                LocalHookServerService::status_for_port(initial_port, false, None),
            )),
            hook_auth_token: test_hook_auth_token(),
            tool_bin_service: std::sync::Mutex::new(test_tool_bin_service(&root)),
            output_executor: Arc::new(std::sync::Mutex::new(NativeOutputExecutor::default())),
            device_input_service: Arc::new(std::sync::Mutex::new(DeviceInputService::new(
                Vec::new(),
            ))),
            device_runtime_registry: Arc::new(std::sync::Mutex::new(DeviceRuntimeRegistry::new(
                Vec::new(),
            ))),
            device_transport_monitor_service: Arc::new(std::sync::Mutex::new(
                DeviceTransportMonitorService::default(),
            )),
            desktop_notice_service: std::sync::Mutex::new(DesktopNoticeService::default()),
            runtime_monitor_service: Arc::new(std::sync::Mutex::new(
                RuntimeMonitorService::default(),
            )),
        };

        let new_config = AppConfig {
            local_hook_server: LocalHookServerConfig { port: 18000 },
            ui: UiConfig {
                language: "zh-CN".to_string(),
                theme_mode: Default::default(),
            },
            ..AppConfig::default()
        };

        let mut service = state.app_config_service.lock().expect("config lock");
        let old_port = service.config().local_hook_server.port;
        let saved_config = service.save_config(new_config).expect("config should save");

        assert_ne!(old_port, saved_config.local_hook_server.port);
        assert_eq!(18000, saved_config.local_hook_server.port);
    }

    #[test]
    fn reset_configuration_devices_clears_all_registered_devices() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let root = unique_temp_root("cc-notice-reset-devices");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &root);
        let state = minimal_app_state_for_root(&root);
        {
            let mut config_service = state.app_config_service.lock().expect("config lock");
            let mut config = AppConfig::default();
            config.devices.push(DeviceInstance {
                id: "test-pico".to_string(),
                label: "Test Pico".to_string(),
                board_id: "rp2040-pico".to_string(),
                device_uid: Some("rp2040-pico:aabbccddeeff0011".to_string()),
                transport: DeviceTransportConfig::serial("/dev/cu.usbmodem1", 115200),
                channels: vec![],
                enabled: true,
            });
            config_service
                .save_config(config)
                .expect("config with device should save");
        }

        let result = reset_configuration_impl(&state, ResetConfigurationScope::Devices)
            .expect("devices should reset");

        assert!(result.config.devices.is_empty());
        assert!(result.device_states.is_empty());

        restore_home(old_home);
    }

    #[test]
    fn reset_configuration_hook_settings_restores_targets_and_hook_events_only() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let root = unique_temp_root("cc-notice-reset-hook-settings");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &root);
        let state = minimal_app_state_for_root(&root);
        {
            let mut config_service = state.app_config_service.lock().expect("config lock");
            let mut config = AppConfig::default();
            config.hook_config_targets.push(HookConfigTarget {
                id: "project-codex-extra".to_string(),
                scope: HookConfigTargetScope::Project,
                source: "codex".to_string(),
                label: "extra".to_string(),
                project_path: Some(root.join("project").to_string_lossy().to_string()),
                enabled: true,
            });
            config_service
                .save_config(config)
                .expect("custom config should save");
        }
        {
            let mut profile_service = state.profile_service.lock().expect("profile lock");
            let mut profile = profile_service.active_profile();
            profile.enabled_hook_events.clear();
            profile.ai_event_mappings.clear();
            profile_service
                .save_profile(profile)
                .expect("custom profile should save");
        }

        let result = reset_configuration_impl(&state, ResetConfigurationScope::HookSettings)
            .expect("hook settings should reset");

        assert_eq!(2, result.config.hook_config_targets.len());
        assert!(result
            .profile_state
            .active_profile
            .enabled_hook_events
            .is_empty());
        assert!(result
            .profile_state
            .active_profile
            .ai_event_mappings
            .is_empty());

        restore_home(old_home);
    }

    #[test]
    fn reset_configuration_profile_mappings_restores_mappings_without_hook_events() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let root = unique_temp_root("cc-notice-reset-profile-mappings");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &root);
        let state = minimal_app_state_for_root(&root);
        {
            let mut profile_service = state.profile_service.lock().expect("profile lock");
            let mut profile = profile_service.active_profile();
            profile.enabled_hook_events.truncate(1);
            profile.ai_event_mappings.clear();
            profile.hardware_rules.clear();
            profile_service
                .save_profile(profile)
                .expect("custom profile should save");
        }

        let result = reset_configuration_impl(&state, ResetConfigurationScope::ProfileMappings)
            .expect("profile mappings should reset");

        assert!(result
            .profile_state
            .active_profile
            .enabled_hook_events
            .is_empty());
        assert!(!result
            .profile_state
            .active_profile
            .ai_event_mappings
            .is_empty());
        assert!(!result
            .profile_state
            .active_profile
            .hardware_rules
            .is_empty());

        restore_home(old_home);
    }

    #[test]
    fn reset_configuration_all_restores_default_settings_profile_and_devices() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let root = unique_temp_root("cc-notice-reset-all");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &root);
        let state = minimal_app_state_for_root(&root);
        {
            let mut config_service = state.app_config_service.lock().expect("config lock");
            let mut config = AppConfig::default();
            config.local_hook_server.port = 18000;
            config.ui.language = "en-US".to_string();
            config.hook_config_targets.clear();
            config_service
                .save_config(config)
                .expect("custom config should save");
        }
        {
            let mut profile_service = state.profile_service.lock().expect("profile lock");
            let mut profile = NoticeProfile::daily_coding();
            profile.id = "focus-mode".to_string();
            profile.name = "Focus Mode".to_string();
            profile.ai_event_mappings = Vec::<AiEventMapping>::new();
            profile.hardware_rules = Vec::<HardwareRule>::new();
            profile_service
                .save_profile(profile)
                .expect("custom profile should save");
            profile_service
                .activate_profile("focus-mode")
                .expect("custom profile should activate");
        }

        let result = reset_configuration_impl(&state, ResetConfigurationScope::All)
            .expect("all config should reset");

        assert_eq!(17321, result.config.local_hook_server.port);
        assert_eq!("zh-CN", result.config.ui.language);
        assert_eq!("daily-coding", result.profile_state.active_profile_id);
        assert_eq!(1, result.profile_state.profiles.len());
        assert!(result.config.devices.is_empty());
        assert_eq!(2, result.config.hook_config_targets.len());

        restore_home(old_home);
    }

    fn restore_home(old_home: Option<std::ffi::OsString>) {
        if let Some(home) = old_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }
    }
}
