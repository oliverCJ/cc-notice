use std::sync::atomic::{AtomicU8, Ordering};

use tauri::{AppHandle, Manager, Runtime};

use crate::core::app_config::{AppConfig, WindowStartupMode};

const MAIN_WINDOW_LABEL: &str = "main";
const NORMAL_MODE: u8 = 0;
const LIGHTWEIGHT_MODE: u8 = 1;
pub(crate) const LAUNCH_AT_LOGIN_ARG: &str = "--launch-at-login";

static CURRENT_MODE: AtomicU8 = AtomicU8::new(NORMAL_MODE);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AppAppearanceMode {
    Normal,
    Lightweight,
}

pub(crate) fn current_mode() -> AppAppearanceMode {
    mode_from_raw(CURRENT_MODE.load(Ordering::SeqCst))
}

pub(crate) fn mode_for_startup(startup_mode: WindowStartupMode) -> AppAppearanceMode {
    match startup_mode {
        WindowStartupMode::Normal => AppAppearanceMode::Normal,
        WindowStartupMode::Lightweight => AppAppearanceMode::Lightweight,
    }
}

pub(crate) fn is_launch_at_login(args: impl IntoIterator<Item = String>) -> bool {
    args.into_iter().any(|arg| arg == LAUNCH_AT_LOGIN_ARG)
}

pub(crate) fn mode_for_launch_context(
    config: &AppConfig,
    launched_at_login: bool,
    tray_available: bool,
) -> AppAppearanceMode {
    if launched_at_login && config.window.hide_window_on_login_launch {
        if tray_available {
            return AppAppearanceMode::Lightweight;
        }
        tracing::warn!("login launch hide-window mode skipped because tray is unavailable");
        return AppAppearanceMode::Normal;
    }

    if tray_available {
        mode_for_startup(config.window.startup_mode)
    } else {
        if matches!(config.window.startup_mode, WindowStartupMode::Lightweight) {
            tracing::warn!("lightweight startup mode skipped because tray is unavailable");
        }
        AppAppearanceMode::Normal
    }
}

pub(crate) fn apply_launch_context<R: Runtime>(
    app: &AppHandle<R>,
    config: &AppConfig,
    launched_at_login: bool,
    tray_available: bool,
) {
    let mode = mode_for_launch_context(config, launched_at_login, tray_available);
    set_current_mode(app, mode);
}

pub(crate) fn set_current_mode<R: Runtime>(app: &AppHandle<R>, mode: AppAppearanceMode) {
    CURRENT_MODE.store(raw_from_mode(mode), Ordering::SeqCst);
    apply_platform_dock_visibility(app, mode);
    apply_window_visibility(app, mode);
}

fn apply_window_visibility<R: Runtime>(app: &AppHandle<R>, mode: AppAppearanceMode) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        tracing::warn!("main window not found while applying app appearance mode");
        return;
    };

    match mode {
        AppAppearanceMode::Normal => {
            if let Err(error) = window.show() {
                tracing::warn!("failed to show main window for normal mode: {error}");
            }
            if let Err(error) = window.set_focus() {
                tracing::warn!("failed to focus main window for normal mode: {error}");
            }
        }
        AppAppearanceMode::Lightweight => {
            if let Err(error) = window.hide() {
                tracing::warn!("failed to hide main window for lightweight mode: {error}");
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn apply_platform_dock_visibility<R: Runtime>(app: &AppHandle<R>, mode: AppAppearanceMode) {
    let visible = matches!(mode, AppAppearanceMode::Normal);
    if let Err(error) = app.set_dock_visibility(visible) {
        tracing::warn!("failed to apply macOS Dock visibility: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_platform_dock_visibility<R: Runtime>(_app: &AppHandle<R>, mode: AppAppearanceMode) {
    tracing::info!("app appearance mode set to {mode:?}; Dock policy is macOS-only");
}

fn raw_from_mode(mode: AppAppearanceMode) -> u8 {
    match mode {
        AppAppearanceMode::Normal => NORMAL_MODE,
        AppAppearanceMode::Lightweight => LIGHTWEIGHT_MODE,
    }
}

fn mode_from_raw(raw: u8) -> AppAppearanceMode {
    match raw {
        LIGHTWEIGHT_MODE => AppAppearanceMode::Lightweight,
        _ => AppAppearanceMode::Normal,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        is_launch_at_login, mode_for_launch_context, mode_for_startup, AppAppearanceMode,
        LAUNCH_AT_LOGIN_ARG,
    };
    use crate::core::app_config::{
        AppConfig, WindowCloseBehavior, WindowConfig, WindowStartupMode,
    };

    #[test]
    fn startup_mode_maps_to_runtime_appearance_mode() {
        assert_eq!(
            AppAppearanceMode::Normal,
            mode_for_startup(WindowStartupMode::Normal)
        );
        assert_eq!(
            AppAppearanceMode::Lightweight,
            mode_for_startup(WindowStartupMode::Lightweight)
        );
    }

    #[test]
    fn runtime_appearance_mode_is_separate_from_persisted_config() {
        let config = AppConfig::default();
        let mode = mode_for_startup(WindowStartupMode::Lightweight);

        assert_eq!(AppAppearanceMode::Lightweight, mode);
        assert_eq!(WindowStartupMode::Normal, config.window.startup_mode);
    }

    #[test]
    fn login_launch_hides_window_when_configured_and_tray_available() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::HideToTray,
                startup_mode: WindowStartupMode::Normal,
                launch_at_login: true,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        assert_eq!(
            AppAppearanceMode::Lightweight,
            mode_for_launch_context(&config, true, true)
        );
    }

    #[test]
    fn login_launch_shows_window_when_tray_unavailable() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::HideToTray,
                startup_mode: WindowStartupMode::Lightweight,
                launch_at_login: true,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        assert_eq!(
            AppAppearanceMode::Normal,
            mode_for_launch_context(&config, true, false)
        );
    }

    #[test]
    fn manual_launch_uses_persisted_startup_mode() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::HideToTray,
                startup_mode: WindowStartupMode::Lightweight,
                launch_at_login: true,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        assert_eq!(
            AppAppearanceMode::Lightweight,
            mode_for_launch_context(&config, false, true)
        );
    }

    #[test]
    fn launch_at_login_flag_uses_stable_argument() {
        assert!(is_launch_at_login(vec![
            "cc-notice".to_string(),
            LAUNCH_AT_LOGIN_ARG.to_string(),
        ]));
        assert!(!is_launch_at_login(vec!["cc-notice".to_string()]));
    }
}
