use crate::startup::app_appearance::AppAppearanceMode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TrayStatusSnapshot {
    pub(crate) language: String,
    pub(crate) hook_server_running: bool,
    pub(crate) hook_server_port: u16,
    pub(crate) connected_device_count: usize,
    pub(crate) active_profile_name: String,
    pub(crate) appearance_mode: AppAppearanceMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TrayMenuAction {
    ShowMainWindow,
    OpenSettings,
    OpenLogDirectory,
    SwitchToLightweightMode,
    SwitchToNormalMode,
    DisconnectAllDevices,
    DisconnectAndExit,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum TrayMenuEntry {
    Title(String),
    Status(String),
    Action {
        id: &'static str,
        label: String,
        action: TrayMenuAction,
    },
    Separator,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TrayMenuModel {
    pub(crate) entries: Vec<TrayMenuEntry>,
}

#[cfg(test)]
mod tests {
    use super::{TrayMenuAction, TrayMenuEntry};
    use crate::startup::app_appearance::AppAppearanceMode;
    use crate::startup::tray::text::tray_menu_model;

    #[test]
    fn chinese_menu_model_contains_status_and_actions() {
        let model = tray_menu_model(&super::TrayStatusSnapshot {
            language: "zh-CN".to_string(),
            hook_server_running: true,
            hook_server_port: 53919,
            connected_device_count: 1,
            active_profile_name: "开发调试方案".to_string(),
            appearance_mode: AppAppearanceMode::Lightweight,
        });

        assert!(model
            .entries
            .contains(&TrayMenuEntry::Title("CC Notice".to_string())));
        assert!(model.entries.contains(&TrayMenuEntry::Status(
            "本地 Hook 服务：运行中 :53919".to_string()
        )));
        assert!(model
            .entries
            .contains(&TrayMenuEntry::Status("设备：1 已连接".to_string())));
        assert!(model
            .entries
            .contains(&TrayMenuEntry::Status("当前配置：开发调试方案".to_string())));
        assert!(model.entries.iter().any(|entry| matches!(
            entry,
            TrayMenuEntry::Action {
                label,
                action: TrayMenuAction::OpenSettings,
                ..
            } if label == "打开设置"
        )));
        assert!(model
            .entries
            .contains(&TrayMenuEntry::Status("当前模式：轻量模式".to_string())));
        assert!(model.entries.iter().any(|entry| matches!(
            entry,
            TrayMenuEntry::Action {
                label,
                action: TrayMenuAction::SwitchToNormalMode,
                ..
            } if label == "切换到普通模式"
        )));
    }

    #[test]
    fn english_menu_model_contains_status_and_actions() {
        let model = tray_menu_model(&super::TrayStatusSnapshot {
            language: "en-US".to_string(),
            hook_server_running: false,
            hook_server_port: 53919,
            connected_device_count: 2,
            active_profile_name: "Daily Coding".to_string(),
            appearance_mode: AppAppearanceMode::Normal,
        });

        assert!(model.entries.contains(&TrayMenuEntry::Status(
            "Local Hook Server: stopped :53919".to_string()
        )));
        assert!(model
            .entries
            .contains(&TrayMenuEntry::Status("Devices: 2 connected".to_string())));
        assert!(model.entries.contains(&TrayMenuEntry::Status(
            "Active Profile: Daily Coding".to_string()
        )));
        assert!(model
            .entries
            .contains(&TrayMenuEntry::Status("Mode: Normal".to_string())));
        assert!(model.entries.iter().any(|entry| matches!(
            entry,
            TrayMenuEntry::Action {
                label,
                action: TrayMenuAction::SwitchToLightweightMode,
                ..
            } if label == "Switch to Lightweight Mode"
        )));
    }
}
