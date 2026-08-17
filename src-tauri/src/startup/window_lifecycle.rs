use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, TryLockError};

use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};

use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::core::app_config::{AppConfig, WindowCloseBehavior};
use crate::AppState;

static EXIT_DISCONNECT_CLAIMED: AtomicBool = AtomicBool::new(false);
const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WindowCloseAction {
    HideToTray,
    ExitAfterDisconnect,
}

pub(crate) fn close_action_for_config(config: &AppConfig) -> WindowCloseAction {
    close_action_for_config_and_tray(config, crate::startup::tray::is_tray_available())
}

pub(crate) fn close_action_for_config_and_tray(
    config: &AppConfig,
    tray_available: bool,
) -> WindowCloseAction {
    match config.window.close_behavior {
        WindowCloseBehavior::HideToTray if tray_available => WindowCloseAction::HideToTray,
        WindowCloseBehavior::Exit => WindowCloseAction::ExitAfterDisconnect,
        WindowCloseBehavior::HideToTray => WindowCloseAction::ExitAfterDisconnect,
    }
}

#[cfg(test)]
fn close_action_for_window_label_and_config(
    label: &str,
    config: &AppConfig,
    tray_available: bool,
) -> Option<WindowCloseAction> {
    if label != MAIN_WINDOW_LABEL {
        return None;
    }
    Some(close_action_for_config_and_tray(config, tray_available))
}

pub(crate) fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() != MAIN_WINDOW_LABEL {
            return;
        }

        let action = match window.try_state::<AppState>() {
            Some(state) => app_state_close_action(&state),
            None => {
                tracing::warn!("window close requested before app state is available; exiting");
                WindowCloseAction::ExitAfterDisconnect
            }
        };

        match action {
            WindowCloseAction::HideToTray => {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    tracing::warn!("failed to hide main window to tray: {error}");
                }
            }
            WindowCloseAction::ExitAfterDisconnect => {
                if let Some(state) = window.try_state::<AppState>() {
                    disconnect_all_devices_once(&state.device_runtime_registry, "window close");
                }
            }
        }
    }
}

pub(crate) fn disconnect_all_devices_and_exit<R: Runtime>(app: &AppHandle<R>, reason: &str) {
    match app.try_state::<AppState>() {
        Some(state) => {
            try_disconnect_all_devices_once(&state.device_runtime_registry, reason);
        }
        None => tracing::warn!("app exit requested before app state is available"),
    }
    app.exit(0);
}

pub(crate) fn disconnect_all_devices_for_app_handle<R: Runtime>(app: &AppHandle<R>, reason: &str) {
    match app.try_state::<AppState>() {
        Some(state) => disconnect_all_devices_once(&state.device_runtime_registry, reason),
        None => tracing::warn!("app exit requested before app state is available"),
    }
}

#[cfg(not(windows))]
pub(crate) fn disconnect_all_devices_for_shutdown_signal<R: Runtime>(
    app: &AppHandle<R>,
    reason: &str,
) {
    if !claim_exit_disconnect() {
        tracing::info!("device disconnect already handled before {reason}");
        return;
    }

    match app.try_state::<AppState>() {
        Some(state) => match state.device_runtime_registry.try_lock() {
            Ok(mut registry) => {
                registry.disconnect_all();
                tracing::info!("all devices disconnected before {reason}");
            }
            Err(error) => {
                tracing::warn!(
                    "skipped device disconnect before {reason} because registry is busy: {error}"
                );
            }
        },
        None => tracing::warn!("shutdown signal received before app state is available"),
    }
}

fn app_state_close_action(state: &tauri::State<'_, AppState>) -> WindowCloseAction {
    match state.app_config_service.lock() {
        Ok(service) => close_action_for_config(&service.config()),
        Err(error) => {
            tracing::warn!("failed to read app config during window close: {error}");
            WindowCloseAction::ExitAfterDisconnect
        }
    }
}

pub(crate) fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    crate::startup::app_appearance::set_current_mode(
        app,
        crate::startup::app_appearance::AppAppearanceMode::Normal,
    );
}

fn claim_exit_disconnect() -> bool {
    !EXIT_DISCONNECT_CLAIMED.swap(true, Ordering::SeqCst)
}

pub(crate) fn reset_exit_disconnect_guard() {
    EXIT_DISCONNECT_CLAIMED.store(false, Ordering::SeqCst);
}

fn disconnect_all_devices_once(registry: &Arc<Mutex<DeviceRuntimeRegistry>>, reason: &str) {
    if !claim_exit_disconnect() {
        tracing::info!("device disconnect already handled before {reason}");
        return;
    }

    disconnect_all_devices(registry, reason);
}

fn try_disconnect_all_devices_once(
    registry: &Arc<Mutex<DeviceRuntimeRegistry>>,
    reason: &str,
) -> bool {
    if !claim_exit_disconnect() {
        tracing::info!("device disconnect already handled before {reason}");
        return false;
    }

    match registry.try_lock() {
        Ok(mut registry) => {
            registry.disconnect_all();
            tracing::info!("all devices disconnected before {reason}");
            true
        }
        Err(TryLockError::WouldBlock) => {
            tracing::warn!(
                "skipped device disconnect before {reason} because registry is busy; exit will continue"
            );
            false
        }
        Err(TryLockError::Poisoned(error)) => {
            tracing::warn!("failed to lock device registry before {reason}: {error}");
            false
        }
    }
}

fn disconnect_all_devices(registry: &Arc<Mutex<DeviceRuntimeRegistry>>, reason: &str) {
    match registry.lock() {
        Ok(mut registry) => {
            registry.disconnect_all();
            tracing::info!("all devices disconnected before {reason}");
        }
        Err(error) => {
            tracing::warn!("failed to lock device registry before {reason}: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        close_action_for_config_and_tray, close_action_for_window_label_and_config,
        WindowCloseAction,
    };
    use crate::core::app_config::{
        AppConfig, WindowCloseBehavior, WindowConfig, WindowStartupMode,
    };

    #[test]
    fn close_action_hides_to_tray_when_configured() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::HideToTray,
                startup_mode: WindowStartupMode::Normal,
                launch_at_login: false,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        assert_eq!(
            WindowCloseAction::HideToTray,
            close_action_for_config_and_tray(&config, true)
        );
    }

    #[test]
    fn close_action_ignores_device_monitor_child_windows() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::HideToTray,
                startup_mode: WindowStartupMode::Normal,
                launch_at_login: false,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        assert_eq!(
            None,
            close_action_for_window_label_and_config("device-monitor:desk-pico", &config, true)
        );
    }

    #[test]
    fn close_action_exits_when_tray_is_unavailable_even_if_hide_to_tray_is_configured() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::HideToTray,
                startup_mode: WindowStartupMode::Normal,
                launch_at_login: false,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        assert_eq!(
            WindowCloseAction::ExitAfterDisconnect,
            close_action_for_config_and_tray(&config, false)
        );
    }

    #[test]
    fn close_action_exits_after_disconnect_when_configured() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::Exit,
                startup_mode: WindowStartupMode::Normal,
                launch_at_login: false,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        assert_eq!(
            WindowCloseAction::ExitAfterDisconnect,
            close_action_for_config_and_tray(&config, true)
        );
    }

    #[test]
    fn exit_disconnect_guard_allows_only_one_disconnect_attempt() {
        super::reset_exit_disconnect_guard();

        assert!(super::claim_exit_disconnect());
        assert!(!super::claim_exit_disconnect());

        super::reset_exit_disconnect_guard();
    }

    #[test]
    fn forced_exit_disconnect_does_not_block_when_registry_is_busy() {
        super::reset_exit_disconnect_guard();
        let registry = std::sync::Arc::new(std::sync::Mutex::new(
            crate::app_services::device_runtime_registry::DeviceRuntimeRegistry::new(Vec::new()),
        ));
        let _held_lock = registry
            .lock()
            .expect("registry lock should be held by test");

        assert!(!super::try_disconnect_all_devices_once(
            &registry,
            "tray exit"
        ));

        super::reset_exit_disconnect_guard();
    }
}
