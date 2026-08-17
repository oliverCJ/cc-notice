use super::model::{TrayMenuAction, TrayMenuEntry, TrayMenuModel, TrayStatusSnapshot};
use crate::startup::app_appearance::AppAppearanceMode;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::sync::OnceLock;

pub(crate) const TRAY_SHOW_ID: &str = "tray-show-main-window";
pub(crate) const TRAY_OPEN_SETTINGS_ID: &str = "tray-open-settings";
pub(crate) const TRAY_OPEN_LOG_DIRECTORY_ID: &str = "tray-open-log-directory";
pub(crate) const TRAY_SWITCH_TO_LIGHTWEIGHT_ID: &str = "tray-switch-to-lightweight";
pub(crate) const TRAY_SWITCH_TO_NORMAL_ID: &str = "tray-switch-to-normal";
pub(crate) const TRAY_DISCONNECT_ALL_ID: &str = "tray-disconnect-all-devices";
pub(crate) const TRAY_EXIT_ID: &str = "tray-disconnect-and-exit";
const TRAY_MENU_TEXT_YAML: &str = include_str!("../../../templates/tray_menu_text.yaml");
const DEFAULT_LANGUAGE: &str = "zh-CN";

pub(crate) fn tray_menu_model(snapshot: &TrayStatusSnapshot) -> TrayMenuModel {
    let text = tray_text_for_language(&snapshot.language);
    let hook_status = if snapshot.hook_server_running {
        &text.hook_server_running
    } else {
        &text.hook_server_stopped
    };
    let mode_label = mode_label(&text, snapshot.appearance_mode);
    let switch_mode_action = switch_mode_action(&text, snapshot.appearance_mode);

    TrayMenuModel {
        entries: vec![
            TrayMenuEntry::Title(text.title.clone()),
            TrayMenuEntry::Status(
                text.hook_server_status
                    .replace("{status}", hook_status)
                    .replace("{port}", &snapshot.hook_server_port.to_string()),
            ),
            TrayMenuEntry::Status(
                text.devices_status
                    .replace("{count}", &snapshot.connected_device_count.to_string()),
            ),
            TrayMenuEntry::Status(
                text.active_profile_status
                    .replace("{profile}", &snapshot.active_profile_name),
            ),
            TrayMenuEntry::Status(text.mode_status.replace("{mode}", mode_label)),
            TrayMenuEntry::Separator,
            action(
                TRAY_SHOW_ID,
                &text.show_main_window,
                TrayMenuAction::ShowMainWindow,
            ),
            action(
                TRAY_OPEN_SETTINGS_ID,
                &text.open_settings,
                TrayMenuAction::OpenSettings,
            ),
            switch_mode_action,
            action(
                TRAY_OPEN_LOG_DIRECTORY_ID,
                &text.open_log_directory,
                TrayMenuAction::OpenLogDirectory,
            ),
            TrayMenuEntry::Separator,
            action(
                TRAY_DISCONNECT_ALL_ID,
                &text.disconnect_all_devices,
                TrayMenuAction::DisconnectAllDevices,
            ),
            action(
                TRAY_EXIT_ID,
                &text.disconnect_and_exit,
                TrayMenuAction::DisconnectAndExit,
            ),
        ],
    }
}

fn switch_mode_action(text: &TrayMenuText, mode: AppAppearanceMode) -> TrayMenuEntry {
    match mode {
        AppAppearanceMode::Normal => action(
            TRAY_SWITCH_TO_LIGHTWEIGHT_ID,
            &text.switch_to_lightweight,
            TrayMenuAction::SwitchToLightweightMode,
        ),
        AppAppearanceMode::Lightweight => action(
            TRAY_SWITCH_TO_NORMAL_ID,
            &text.switch_to_normal,
            TrayMenuAction::SwitchToNormalMode,
        ),
    }
}

fn mode_label(text: &TrayMenuText, mode: AppAppearanceMode) -> &str {
    match mode {
        AppAppearanceMode::Normal => &text.mode_normal,
        AppAppearanceMode::Lightweight => &text.mode_lightweight,
    }
}

fn action(id: &'static str, label: &str, action: TrayMenuAction) -> TrayMenuEntry {
    TrayMenuEntry::Action {
        id,
        label: label.to_string(),
        action,
    }
}

fn tray_text_for_language(language: &str) -> &'static TrayMenuText {
    let catalog = tray_text_catalog();
    catalog
        .languages
        .get(language)
        .or_else(|| catalog.languages.get(DEFAULT_LANGUAGE))
        .expect("bundled tray menu language pack must include zh-CN")
}

fn tray_text_catalog() -> &'static TrayTextCatalog {
    static CATALOG: OnceLock<TrayTextCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_yaml::from_str(TRAY_MENU_TEXT_YAML)
            .expect("bundled tray menu language pack should parse")
    })
}

#[derive(Debug, Deserialize)]
struct TrayTextCatalog {
    #[serde(flatten)]
    languages: BTreeMap<String, TrayMenuText>,
}

#[derive(Debug, Deserialize)]
struct TrayMenuText {
    title: String,
    hook_server_running: String,
    hook_server_stopped: String,
    hook_server_status: String,
    devices_status: String,
    active_profile_status: String,
    mode_normal: String,
    mode_lightweight: String,
    mode_status: String,
    show_main_window: String,
    open_settings: String,
    switch_to_lightweight: String,
    switch_to_normal: String,
    open_log_directory: String,
    disconnect_all_devices: String,
    disconnect_and_exit: String,
}

#[cfg(test)]
mod tests {
    use super::tray_text_catalog;

    #[test]
    fn bundled_tray_menu_language_pack_contains_supported_languages() {
        let catalog = tray_text_catalog();

        assert!(catalog.languages.contains_key("zh-CN"));
        assert!(catalog.languages.contains_key("en-US"));
    }
}
