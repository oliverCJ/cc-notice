use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::ShellExt;

use super::model::TrayMenuAction;
use crate::app_services::device_runtime_event_service::{
    DeviceRuntimeUpdatedPayload, DEVICE_RUNTIME_UPDATED_EVENT,
};
use crate::infrastructure::logging;
use crate::startup::app_appearance::{self, AppAppearanceMode};
use crate::startup::window_lifecycle;
use crate::AppState;

pub(crate) const FRONTEND_NAVIGATION_EVENT: &str = "cc-notice://navigate";

pub(crate) fn handle_tray_action<R: Runtime>(app: &AppHandle<R>, action: TrayMenuAction) {
    let mut effects = AppTrayActionEffects { app };
    handle_tray_action_with_effects(action, &mut effects);
}

pub(crate) trait TrayActionEffects {
    fn show_main_window(&mut self);
    fn emit_settings_navigation(&mut self);
    fn open_log_directory(&mut self);
    fn switch_to_lightweight_mode(&mut self);
    fn switch_to_normal_mode(&mut self);
    fn disconnect_all_devices(&mut self);
    fn emit_device_runtime_update(&mut self, reason: &str);
    fn disconnect_and_exit(&mut self);
    fn refresh_tray_menu(&mut self);
}

pub(crate) fn handle_tray_action_with_effects(
    action: TrayMenuAction,
    effects: &mut dyn TrayActionEffects,
) {
    match action {
        TrayMenuAction::ShowMainWindow => effects.show_main_window(),
        TrayMenuAction::OpenSettings => {
            effects.show_main_window();
            effects.emit_settings_navigation();
        }
        TrayMenuAction::OpenLogDirectory => effects.open_log_directory(),
        TrayMenuAction::SwitchToLightweightMode => {
            effects.switch_to_lightweight_mode();
            effects.refresh_tray_menu();
        }
        TrayMenuAction::SwitchToNormalMode => {
            effects.switch_to_normal_mode();
            effects.refresh_tray_menu();
        }
        TrayMenuAction::DisconnectAllDevices => {
            effects.disconnect_all_devices();
            effects.emit_device_runtime_update("tray-disconnect-all-devices");
            effects.refresh_tray_menu();
        }
        TrayMenuAction::DisconnectAndExit => effects.disconnect_and_exit(),
    }
}

struct AppTrayActionEffects<'a, R: Runtime> {
    app: &'a AppHandle<R>,
}

impl<R: Runtime> TrayActionEffects for AppTrayActionEffects<'_, R> {
    fn show_main_window(&mut self) {
        window_lifecycle::show_main_window(self.app);
    }

    fn emit_settings_navigation(&mut self) {
        if let Err(error) = self.app.emit(FRONTEND_NAVIGATION_EVENT, "settings") {
            tracing::warn!("failed to emit tray navigation event: {error}");
        }
    }

    fn open_log_directory(&mut self) {
        let log_dir = logging::default_user_log_dir().unwrap_or_else(|error| {
            tracing::warn!("failed to resolve default log dir: {error}");
            logging::fallback_user_log_dir()
        });
        if let Err(error) = logging::ensure_log_dir(&log_dir) {
            tracing::warn!("failed to ensure log dir before opening it: {error}");
            return;
        }

        #[allow(deprecated)]
        if let Err(error) = self
            .app
            .shell()
            .open(log_dir.to_string_lossy().to_string(), None)
        {
            tracing::warn!("failed to open log dir from tray: {error}");
        }
    }

    fn switch_to_lightweight_mode(&mut self) {
        app_appearance::set_current_mode(self.app, AppAppearanceMode::Lightweight);
    }

    fn switch_to_normal_mode(&mut self) {
        app_appearance::set_current_mode(self.app, AppAppearanceMode::Normal);
    }

    fn disconnect_all_devices(&mut self) {
        match self.app.try_state::<AppState>() {
            Some(state) => match state.device_runtime_registry.lock() {
                Ok(mut registry) => {
                    registry.disconnect_all_manually();
                    tracing::info!("all devices disconnected from tray action");
                }
                Err(error) => tracing::warn!("failed to lock device registry from tray: {error}"),
            },
            None => tracing::warn!("app state not available while disconnecting devices from tray"),
        }
    }

    fn emit_device_runtime_update(&mut self, reason: &str) {
        if let Err(error) = self.app.emit(
            DEVICE_RUNTIME_UPDATED_EVENT,
            DeviceRuntimeUpdatedPayload {
                reason: reason.to_string(),
                device_ids: Vec::new(),
            },
        ) {
            tracing::warn!("failed to emit device runtime update from tray: {error}");
        }
    }

    fn disconnect_and_exit(&mut self) {
        window_lifecycle::disconnect_all_devices_and_exit(self.app, "tray exit");
    }

    fn refresh_tray_menu(&mut self) {
        super::refresh_tray_menu_after_state_change(self.app, "tray action");
    }
}

#[cfg(test)]
mod tests {
    use super::{handle_tray_action_with_effects, TrayActionEffects};
    use crate::startup::tray::model::TrayMenuAction;

    #[derive(Default)]
    struct FakeTrayActionEffects {
        shown: usize,
        emitted_settings: usize,
        opened_logs: usize,
        switched_lightweight: usize,
        switched_normal: usize,
        disconnected: usize,
        emitted_device_updates: Vec<String>,
        exited: usize,
        refreshed: usize,
    }

    impl TrayActionEffects for FakeTrayActionEffects {
        fn show_main_window(&mut self) {
            self.shown += 1;
        }

        fn emit_settings_navigation(&mut self) {
            self.emitted_settings += 1;
        }

        fn open_log_directory(&mut self) {
            self.opened_logs += 1;
        }

        fn switch_to_lightweight_mode(&mut self) {
            self.switched_lightweight += 1;
        }

        fn switch_to_normal_mode(&mut self) {
            self.switched_normal += 1;
        }

        fn disconnect_all_devices(&mut self) {
            self.disconnected += 1;
        }

        fn emit_device_runtime_update(&mut self, reason: &str) {
            self.emitted_device_updates.push(reason.to_string());
        }

        fn disconnect_and_exit(&mut self) {
            self.exited += 1;
        }

        fn refresh_tray_menu(&mut self) {
            self.refreshed += 1;
        }
    }

    #[test]
    fn open_settings_shows_window_and_emits_navigation_without_refreshing_status() {
        let mut effects = FakeTrayActionEffects::default();

        handle_tray_action_with_effects(TrayMenuAction::OpenSettings, &mut effects);

        assert_eq!(1, effects.shown);
        assert_eq!(1, effects.emitted_settings);
        assert_eq!(0, effects.refreshed);
    }

    #[test]
    fn disconnect_all_devices_refreshes_tray_status_without_exiting() {
        let mut effects = FakeTrayActionEffects::default();

        handle_tray_action_with_effects(TrayMenuAction::DisconnectAllDevices, &mut effects);

        assert_eq!(1, effects.disconnected);
        assert_eq!(
            vec!["tray-disconnect-all-devices"],
            effects.emitted_device_updates
        );
        assert_eq!(1, effects.refreshed);
        assert_eq!(0, effects.exited);
    }

    #[test]
    fn switching_to_lightweight_mode_refreshes_tray_without_saving_config() {
        let mut effects = FakeTrayActionEffects::default();

        handle_tray_action_with_effects(TrayMenuAction::SwitchToLightweightMode, &mut effects);

        assert_eq!(1, effects.switched_lightweight);
        assert_eq!(0, effects.switched_normal);
        assert_eq!(1, effects.refreshed);
        assert_eq!(0, effects.emitted_settings);
    }

    #[test]
    fn switching_to_normal_mode_refreshes_tray_without_saving_config() {
        let mut effects = FakeTrayActionEffects::default();

        handle_tray_action_with_effects(TrayMenuAction::SwitchToNormalMode, &mut effects);

        assert_eq!(0, effects.switched_lightweight);
        assert_eq!(1, effects.switched_normal);
        assert_eq!(1, effects.refreshed);
        assert_eq!(0, effects.emitted_settings);
    }
}
