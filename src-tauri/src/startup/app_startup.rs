use std::sync::{Arc, Mutex};
use std::time::Instant;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

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
use crate::app_services::tool_bin_service::ToolBinService;
use crate::core::internal_events::builtin_internal_event_ids;
use crate::startup::{app_appearance, shutdown_signal, tray, window_lifecycle};
use crate::utils::profile_utils::hook_events_from_selections;
use crate::{commands, infrastructure, AppState};

fn app_project_root_from_manifest() -> Result<std::path::PathBuf, String> {
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(std::path::Path::to_path_buf)
        .ok_or_else(|| "failed to resolve app project root".to_string())
}

fn init_logging() -> Result<(), String> {
    match infrastructure::logging::default_user_log_file()
        .and_then(|path| infrastructure::logging::open_log_file(&path))
    {
        Ok(file) => {
            let writer = infrastructure::logging::ConsoleAndFileWriter::new(file);
            tracing_subscriber::fmt()
                .with_writer(move || writer.clone())
                .with_timer(infrastructure::time_utils::LocalRfc3339Timer::system())
                .with_ansi(false)
                .try_init()
                .map_err(|error| format!("failed to initialize tracing subscriber: {error}"))?;
            tracing::info!("file logging initialized");
            Ok(())
        }
        Err(error) => {
            // 日志文件不可写时保留控制台日志，避免启动失败阻断用户排查。
            tracing_subscriber::fmt()
                .with_timer(infrastructure::time_utils::LocalRfc3339Timer::system())
                .try_init()
                .map_err(|e| format!("failed to initialize console logging: {e}"))?;
            eprintln!(
                "Warning: failed to open log file: {}, using console only",
                error
            );
            tracing::warn!("file logging disabled: {error}");
            Ok(())
        }
    }
}

pub(crate) fn startup_auth_token(app_home: Option<&std::path::Path>) -> String {
    let Some(app_home) = app_home else {
        tracing::warn!("app home not available, using ephemeral auth token");
        return infrastructure::auth_token::generate_token();
    };

    match infrastructure::auth_token::read_or_create_token(&app_home) {
        Ok(token) => token,
        Err(error) => {
            tracing::warn!("failed to load auth token, repairing token file: {error}");
            let token = infrastructure::auth_token::generate_token();
            if let Err(write_error) = infrastructure::auth_token::write_token(&app_home, &token) {
                tracing::warn!("failed to repair auth token, using ephemeral token: {write_error}");
            }
            token
        }
    }
}

pub fn run() {
    if let Err(error) = init_logging() {
        eprintln!("Fatal: failed to initialize logging: {}", error);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![app_appearance::LAUNCH_AT_LOGIN_ARG]),
        ))
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let startup_started = Instant::now();
            let app_config_service = AppConfigService::from_user_home().unwrap_or_else(|error| {
                tracing::warn!("failed to load app config, using defaults: {error}");
                AppConfigService::default()
            });
            let app_config = app_config_service.config();
            tracing::info!(
                elapsed_ms = startup_started.elapsed().as_millis() as u64,
                "startup phase finished: app config loaded"
            );
            let project_root = app_project_root_from_manifest().unwrap_or_else(|error| {
                tracing::warn!("failed to resolve app project root: {error}");
                std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir())
            });
            let resources_dir = app.path().resource_dir().ok();
            let app_home = infrastructure::app_paths::app_home_dir().unwrap_or_else(|error| {
                tracing::warn!("failed to resolve app home, using fallback config root: {error}");
                std::env::temp_dir().join(".cc-notice-fallback")
            });

            let auth_token = Arc::new(Mutex::new(startup_auth_token(Some(&app_home))));
            tracing::info!(
                elapsed_ms = startup_started.elapsed().as_millis() as u64,
                "startup phase finished: auth token loaded"
            );

            let tool_bin_service =
                ToolBinService::from_runtime_paths(app_home.clone(), resources_dir, project_root);
            let startup_tool_bin_service = tool_bin_service.clone();
            std::thread::spawn(move || {
                let started = Instant::now();
                if let Err(error) = startup_tool_bin_service.ensure_relay_installed() {
                    tracing::warn!("failed to install relay tool during startup: {error}");
                }
                tracing::info!(
                    elapsed_ms = started.elapsed().as_millis() as u64,
                    "startup relay tool check finished in background"
                );
            });
            tracing::info!(
                elapsed_ms = startup_started.elapsed().as_millis() as u64,
                "startup phase finished: relay tool check scheduled"
            );
            let fallback_config_root = std::env::temp_dir().join(".cc-notice-fallback");
            let user_config_root = app_home.clone();
            let custom_internal_event_service =
                CustomInternalEventService::from_config_root(user_config_root.clone())
                    .or_else(|error| {
                        tracing::warn!(
                            "failed to load custom internal event service from user home: {error}"
                        );
                        std::fs::create_dir_all(&fallback_config_root).ok();
                        CustomInternalEventService::from_config_root(fallback_config_root.clone())
                    })
                    .unwrap_or_else(|error| {
                        tracing::error!(
                            "FATAL: custom internal event service initialization failed: {error}"
                        );
                        std::process::exit(1);
                    });
            let valid_internal_event_ids = custom_internal_event_service
                .valid_event_ids()
                .unwrap_or_else(|error| {
                    tracing::warn!(
                        "failed to load custom internal events, using builtin catalog only: {error}"
                    );
                    builtin_internal_event_ids()
                });
            tracing::info!(
                elapsed_ms = startup_started.elapsed().as_millis() as u64,
                "startup phase finished: internal events loaded"
            );
            let profile_service =
                ProfileService::from_config_root_with_active_id_and_internal_events(
                    user_config_root.clone(),
                    app_config.active_profile_id.clone(),
                    &valid_internal_event_ids,
                )
                .or_else(|error| {
                    tracing::warn!("failed to load profile service from user home: {error}");
                    std::fs::create_dir_all(&fallback_config_root).ok();
                    ProfileService::from_config_root_with_active_id_and_internal_events(
                        fallback_config_root.clone(),
                        app_config.active_profile_id.clone(),
                        &valid_internal_event_ids,
                    )
                })
                .unwrap_or_else(|error| {
                    tracing::error!(
                        "FATAL: all profile service initialization methods failed: {error}"
                    );
                    tracing::error!(
                        "This should not happen. Please check file permissions and disk space."
                    );
                    std::process::exit(1);
                });
            tracing::info!(
                elapsed_ms = startup_started.elapsed().as_millis() as u64,
                "startup phase finished: profiles loaded"
            );
            let inbound_event_service = Arc::new(Mutex::new(
                InboundEventService::with_profile_and_enabled_hook_events(
                    profile_service.active_profile(),
                    hook_events_from_selections(&app_config.hook_event_selections),
                ),
            ));
            let hook_server_status = Arc::new(Mutex::new(LocalHookServerService::status_for_port(
                app_config.local_hook_server.port,
                false,
                None,
            )));
            let output_executor = Arc::new(Mutex::new(NativeOutputExecutor::from_app_handle(
                app.handle().clone(),
            )));
            let device_input_service = Arc::new(Mutex::new(DeviceInputService::new(
                app_config.device_input_bindings.clone(),
            )));
            let device_runtime_registry = Arc::new(Mutex::new(
                DeviceRuntimeRegistry::with_device_input_service(
                    app_config.devices.clone(),
                    Arc::clone(&device_input_service),
                ),
            ));
            let runtime_monitor_service = Arc::new(Mutex::new(RuntimeMonitorService::default()));
            let device_transport_monitor_service =
                Arc::new(Mutex::new(DeviceTransportMonitorService::default()));

            LocalHookServerService::start(
                app.handle().clone(),
                app_config.local_hook_server.port,
                Arc::clone(&inbound_event_service),
                Arc::clone(&hook_server_status),
                Arc::clone(&auth_token),
                Arc::clone(&output_executor),
                Arc::clone(&device_runtime_registry),
                Arc::clone(&runtime_monitor_service),
            );
            tracing::info!(
                elapsed_ms = startup_started.elapsed().as_millis() as u64,
                "startup phase finished: local hook server start scheduled"
            );

            app.manage(AppState {
                inbound_event_service,
                app_config_service: Mutex::new(app_config_service),
                profile_service: Mutex::new(profile_service),
                custom_internal_event_service: Mutex::new(custom_internal_event_service),
                local_hook_server_status: hook_server_status,
                hook_auth_token: auth_token,
                output_executor,
                device_input_service,
                device_runtime_registry,
                device_transport_monitor_service,
                desktop_notice_service: Mutex::new(DesktopNoticeService::default()),
                runtime_monitor_service,
                tool_bin_service: Mutex::new(tool_bin_service),
            });
            if let Some(state) = app.try_state::<AppState>() {
                match state.desktop_notice_service.lock() {
                    Ok(service) => {
                        let desktop_notice_service = service.clone();
                        let app_handle = app.handle().clone();
                        let startup_instances = app_config.desktop_notice_instances.clone();
                        // setup 运行在事件线程，Windows WebView2 窗口必须从独立线程创建。
                        tauri::async_runtime::spawn_blocking(move || {
                            desktop_notice_service
                                .open_startup_instances(&app_handle, &startup_instances);
                        });
                    }
                    Err(error) => {
                        tracing::warn!("failed to lock desktop notice service at startup: {error}");
                    }
                }
            } else {
                tracing::warn!("app state not available while opening startup desktop notices");
            }
            if let Err(error) = tray::setup_system_tray(app) {
                tracing::warn!("failed to initialize system tray: {error}");
            }
            let launched_at_login = app_appearance::is_launch_at_login(std::env::args());
            app_appearance::apply_launch_context(
                &app.handle().clone(),
                &app_config,
                launched_at_login,
                tray::is_tray_available(),
            );
            if let Err(error) = shutdown_signal::install(app.handle().clone()) {
                tracing::warn!("{error}");
            }
            tracing::info!(
                elapsed_ms = startup_started.elapsed().as_millis() as u64,
                "startup setup finished"
            );
            Ok(())
        })
        .on_window_event(window_lifecycle::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::debug::health_check,
            commands::debug::development_log_dir,
            commands::debug::submit_relay_event,
            commands::debug::debug_log_entries,
            commands::debug::clear_debug_log,
            commands::debug::software_notice_state,
            commands::diagnostics::diagnostics_snapshot,
            commands::desktop_notice::desktop_notice_instances,
            commands::desktop_notice::desktop_mascot_asset_packs,
            commands::desktop_notice::save_desktop_notice_instance,
            commands::desktop_notice::delete_desktop_notice_instance,
            commands::desktop_notice::preview_desktop_notice_instance,
            commands::desktop_notice::preview_desktop_notice_rule_effect,
            commands::desktop_notice::hide_desktop_notice_instance,
            commands::desktop_notice::desktop_notice_window_payload,
            commands::desktop_notice::save_desktop_notice_window_bounds,
            commands::external_link::open_external_url,
            commands::device::device_runtime_states,
            commands::device::device_runtime_state,
            commands::device::scan_device_transports,
            commands::device::scan_device_candidates,
            commands::device::identify_device_candidate,
            commands::device::register_identified_device,
            commands::device::connect_device,
            commands::device::auto_connect_registered_devices,
            commands::device::cancel_device_operation,
            commands::device::check_device_firmware,
            commands::device::disconnect_device,
            commands::device::disconnect_all_devices,
            commands::device::remove_registered_device,
            commands::device::reset_device_identity,
            commands::device::ping_connected_devices,
            commands::device::open_device_transport_monitor_window,
            commands::device::device_transport_monitor_snapshot,
            commands::device::clear_device_transport_monitor_events,
            commands::device::close_device_transport_monitor_session,
            commands::device::close_device_transport_monitor_window,
            commands::device::send_device_test_action,
            commands::device::send_device_extension_action,
            commands::device::update_device_channels,
            commands::device::device_input_bindings,
            commands::device::save_device_input_bindings,
            commands::firmware::firmware_catalog,
            commands::firmware::arduino_cli_status,
            commands::firmware::firmware_flash_status,
            commands::firmware::firmware_flash_targets,
            commands::firmware::flash_firmware,
            commands::app_config::get_app_config,
            commands::app_config::save_app_config,
            commands::app_config::reset_configuration,
            commands::profile::profile_state,
            commands::profile::save_profile,
            commands::profile::create_profile,
            commands::profile::duplicate_profile,
            commands::profile::activate_profile,
            commands::profile::delete_profile,
            commands::profile::export_profile_package,
            commands::profile::preview_profile_package_import,
            commands::profile::import_profile_package,
            commands::profile::internal_event_catalog_command,
            commands::profile::create_custom_internal_event,
            commands::profile::update_custom_internal_event,
            commands::profile::delete_custom_internal_event,
            commands::profile::profile_template_list,
            commands::hook_config::hook_event_state,
            commands::hook_config::save_hook_event_selections,
            commands::hook_config::add_hook_project_target,
            commands::hook_config::remove_hook_config_target,
            commands::hook_config::preview_hook_config_target,
            commands::hook_config::write_hook_config_target,
            commands::hook_config::preview_restore_hook_config_target,
            commands::hook_config::restore_hook_config_target,
            commands::sound::sound_assets,
            commands::sound::preview_sound,
            commands::debug::local_hook_server_status,
            commands::monitor::runtime_monitor_snapshot,
            commands::app_config::rotate_hook_auth_token
        ])
        .build(tauri::generate_context!())
        .expect("failed to build CC Notice application")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { .. } => {
                window_lifecycle::disconnect_all_devices_for_app_handle(app, "app exit");
            }
            // macOS Dock 图标点击时恢复主窗口（窗口已被隐藏到托盘时）
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                window_lifecycle::show_main_window(app);
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use crate::infrastructure;
    use crate::test_support::unique_temp_root;

    use super::startup_auth_token;

    #[test]
    fn startup_auth_token_repairs_invalid_persisted_token() {
        let root = unique_temp_root("cc-notice-startup-token");
        let app_home = root.join(".cc-notice");
        std::fs::create_dir_all(&app_home).expect("app home should exist");
        std::fs::write(
            infrastructure::auth_token::token_file_path(&app_home),
            "invalid-token",
        )
        .expect("invalid token should be written");

        let token = startup_auth_token(Some(app_home.as_path()));
        let stored = infrastructure::auth_token::read_token(&app_home)
            .expect("repaired token should be readable");

        assert_eq!(36, token.len());
        assert_eq!(token, stored);
        assert_ne!("invalid-token", stored);
    }
}
