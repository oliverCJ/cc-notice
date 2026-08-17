use std::collections::BTreeMap;

use serde::{Deserialize, Deserializer, Serialize};

use crate::adapters::ai_tools::registry;
use crate::core::desktop_notice::{
    sanitize_desktop_notice_instances, validate_desktop_notice_instances, DesktopNoticeInstance,
};
use crate::core::device::{DeviceChannelDirection, DeviceInstance};
use crate::core::hook_events::{default_selected_events, is_known_hook_event};
use crate::core::keyboard_shortcut::{validate_shortcut, KeyboardShortcut};

pub const DEFAULT_LOCAL_HOOK_PORT: u16 = 17321;
pub const DEFAULT_LANGUAGE: &str = "zh-CN";
pub const DEFAULT_ACTIVE_PROFILE_ID: &str = "daily-coding";

pub fn default_active_profile_id() -> String {
    DEFAULT_ACTIVE_PROFILE_ID.to_string()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub local_hook_server: LocalHookServerConfig,
    pub ui: UiConfig,
    #[serde(default)]
    pub window: WindowConfig,
    #[serde(default)]
    pub arduino_cli_path: Option<String>,
    #[serde(default = "default_active_profile_id")]
    pub active_profile_id: String,
    #[serde(default)]
    pub hook_event_selections: HookEventSelections,
    #[serde(default = "default_hook_config_targets")]
    pub hook_config_targets: Vec<HookConfigTarget>,
    #[serde(default = "default_devices")]
    pub devices: Vec<DeviceInstance>,
    #[serde(default)]
    pub device_input_bindings: Vec<DeviceInputBinding>,
    #[serde(default)]
    pub desktop_notice_instances: Vec<DesktopNoticeInstance>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInputBinding {
    pub id: String,
    pub enabled: bool,
    pub device_id: String,
    pub channel_id: String,
    pub trigger: DeviceInputTrigger,
    pub action: DeviceInputAction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceInputTrigger {
    Press,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum DeviceInputAction {
    KeyboardShortcut { shortcut: KeyboardShortcut },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHookServerConfig {
    pub port: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiConfig {
    pub language: String,
    #[serde(default)]
    pub theme_mode: UiThemeMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UiThemeMode {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowConfig {
    pub close_behavior: WindowCloseBehavior,
    #[serde(default)]
    pub startup_mode: WindowStartupMode,
    #[serde(default)]
    pub launch_at_login: bool,
    #[serde(default = "default_hide_window_on_login_launch")]
    pub hide_window_on_login_launch: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WindowCloseBehavior {
    HideToTray,
    Exit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WindowStartupMode {
    Normal,
    Lightweight,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEventSelections {
    pub by_source: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookConfigTarget {
    pub id: String,
    pub scope: HookConfigTargetScope,
    pub source: String,
    pub label: String,
    pub project_path: Option<String>,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HookConfigTargetScope {
    Global,
    Project,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            local_hook_server: LocalHookServerConfig {
                port: DEFAULT_LOCAL_HOOK_PORT,
            },
            ui: UiConfig {
                language: DEFAULT_LANGUAGE.to_string(),
                theme_mode: UiThemeMode::System,
            },
            window: WindowConfig::default(),
            arduino_cli_path: None,
            active_profile_id: default_active_profile_id(),
            hook_event_selections: HookEventSelections::default(),
            hook_config_targets: default_hook_config_targets(),
            devices: default_devices(),
            device_input_bindings: Vec::new(),
            desktop_notice_instances: Vec::new(),
        }
    }
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            close_behavior: WindowCloseBehavior::HideToTray,
            startup_mode: WindowStartupMode::Normal,
            launch_at_login: false,
            hide_window_on_login_launch: true,
        }
    }
}

impl Default for UiThemeMode {
    fn default() -> Self {
        Self::System
    }
}

impl Default for WindowStartupMode {
    fn default() -> Self {
        Self::Normal
    }
}

fn default_hide_window_on_login_launch() -> bool {
    true
}

impl Default for HookEventSelections {
    fn default() -> Self {
        let mut by_source = BTreeMap::new();
        for tool in registry::all_ai_tools() {
            by_source.insert(
                tool.source.to_string(),
                default_selected_events(tool.source),
            );
        }
        Self { by_source }
    }
}

impl<'de> Deserialize<'de> for HookEventSelections {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct RawHookEventSelections {
            #[serde(default)]
            by_source: BTreeMap<String, Vec<String>>,
            #[serde(default)]
            codex: Vec<String>,
            #[serde(default)]
            claude_code: Vec<String>,
        }

        let raw = RawHookEventSelections::deserialize(deserializer)?;
        let mut by_source = raw.by_source;
        if !raw.codex.is_empty() {
            by_source.insert("codex".to_string(), raw.codex);
        }
        if !raw.claude_code.is_empty() {
            by_source.insert("claude-code".to_string(), raw.claude_code);
        }
        Ok(Self { by_source })
    }
}

impl HookEventSelections {
    pub fn events_for_source(&self, source: &str) -> Vec<String> {
        self.by_source.get(source).cloned().unwrap_or_default()
    }

    pub fn events_for_source_slice(&self, source: &str) -> &[String] {
        self.by_source.get(source).map(Vec::as_slice).unwrap_or(&[])
    }

    pub fn set_events_for_source(&mut self, source: &str, events: Vec<String>) {
        self.by_source.insert(source.to_string(), events);
    }
}

pub fn default_hook_config_targets() -> Vec<HookConfigTarget> {
    vec![
        HookConfigTarget {
            id: "global-codex".to_string(),
            scope: HookConfigTargetScope::Global,
            source: "codex".to_string(),
            label: "Codex 全局配置".to_string(),
            project_path: None,
            enabled: false,
        },
        HookConfigTarget {
            id: "global-claude-code".to_string(),
            scope: HookConfigTargetScope::Global,
            source: "claude-code".to_string(),
            label: "Claude Code 全局配置".to_string(),
            project_path: None,
            enabled: false,
        },
    ]
}

pub fn default_devices() -> Vec<DeviceInstance> {
    vec![]
}

impl AppConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.local_hook_server.port < 1024 {
            return Err("local hook server port must be between 1024 and 65535".to_string());
        }

        if !matches!(self.ui.language.as_str(), "zh-CN" | "en-US") {
            return Err("unsupported language".to_string());
        }

        match self.ui.theme_mode {
            UiThemeMode::System | UiThemeMode::Light | UiThemeMode::Dark => {}
        }

        match self.window.close_behavior {
            WindowCloseBehavior::HideToTray | WindowCloseBehavior::Exit => {}
        }
        match self.window.startup_mode {
            WindowStartupMode::Normal | WindowStartupMode::Lightweight => {}
        }

        if let Some(path) = &self.arduino_cli_path {
            if path.trim().is_empty() {
                return Err("arduino cli path cannot be empty".to_string());
            }
        }

        if self.active_profile_id.trim().is_empty() {
            return Err("active profile id cannot be empty".to_string());
        }

        for source in self.hook_event_selections.by_source.keys() {
            registry::ai_tool_definition(source)?;
        }
        for tool in registry::all_ai_tools() {
            self.validate_selected_events(
                tool.source,
                self.hook_event_selections
                    .events_for_source_slice(tool.source),
            )?;
        }
        for target in &self.hook_config_targets {
            registry::ai_tool_definition(&target.source)?;
            if target.scope == HookConfigTargetScope::Project && target.project_path.is_none() {
                return Err("project hook config target requires projectPath".to_string());
            }
        }
        validate_devices(&self.devices)?;
        validate_device_input_bindings(&self.device_input_bindings)?;
        validate_desktop_notice_instances(&self.desktop_notice_instances)
            .map_err(|error| error.code_string())?;

        Ok(())
    }

    pub fn sanitize(&mut self) {
        if self.active_profile_id.trim().is_empty() {
            self.active_profile_id = default_active_profile_id();
        }
        self.hook_event_selections
            .by_source
            .retain(|source, _| registry::is_supported_ai_tool(source));
        for tool in registry::all_ai_tools() {
            let mut events = self.hook_event_selections.events_for_source(tool.source);
            sanitize_selected_events(tool.source, &mut events);
            self.hook_event_selections
                .set_events_for_source(tool.source, events);
        }
        self.hook_config_targets
            .retain(|target| registry::is_supported_ai_tool(&target.source));
        ensure_global_target(&mut self.hook_config_targets, "codex", "Codex 全局配置");
        ensure_global_target(
            &mut self.hook_config_targets,
            "claude-code",
            "Claude Code 全局配置",
        );
        sanitize_devices(&mut self.devices);
        sanitize_device_input_bindings(&mut self.device_input_bindings);
        sanitize_desktop_notice_instances(&mut self.desktop_notice_instances);
    }

    fn validate_selected_events(&self, source: &str, events: &[String]) -> Result<(), String> {
        if events.is_empty() {
            return Err(format!("hook event selection for {source} cannot be empty"));
        }
        for event in events {
            if !is_known_hook_event(source, event) {
                return Err(format!("unknown hook event for {source}: {event}"));
            }
        }
        Ok(())
    }
}

fn validate_devices(devices: &[DeviceInstance]) -> Result<(), String> {
    let mut device_ids = std::collections::HashSet::new();
    for device in devices {
        if device.id.trim().is_empty() {
            return Err("device id cannot be empty".to_string());
        }
        if !device_ids.insert(device.id.as_str()) {
            return Err(format!("duplicate device id: {}", device.id));
        }
        if device.board_id.trim().is_empty() {
            return Err(format!("device {} requires board_id", device.id));
        }
        let mut channel_ids = std::collections::HashSet::new();
        for channel in &device.channels {
            if channel.id.trim().is_empty() {
                return Err(format!("device {} has empty channel id", device.id));
            }
            if !channel_ids.insert(channel.id.as_str()) {
                return Err(format!(
                    "duplicate device channel id for {}: {}",
                    device.id, channel.id
                ));
            }
            if channel.direction == DeviceChannelDirection::Output
                && channel.supported_actions.is_empty()
            {
                return Err(format!(
                    "device channel {} requires supported actions",
                    channel.id
                ));
            }
            if channel.direction == DeviceChannelDirection::Input && channel.input.is_none() {
                return Err(format!(
                    "device input channel {} requires input config",
                    channel.id
                ));
            }
        }
    }
    Ok(())
}

pub fn validate_device_input_bindings(bindings: &[DeviceInputBinding]) -> Result<(), String> {
    let mut ids = std::collections::HashSet::new();
    for binding in bindings {
        if binding.id.trim().is_empty() {
            return Err("device input binding id cannot be empty".to_string());
        }
        if !ids.insert(binding.id.as_str()) {
            return Err(format!("duplicate device input binding id: {}", binding.id));
        }
        if binding.device_id.trim().is_empty() || binding.channel_id.trim().is_empty() {
            return Err("device input binding requires device_id and channel_id".to_string());
        }
        match &binding.action {
            DeviceInputAction::KeyboardShortcut { shortcut } => validate_shortcut(shortcut)?,
        }
    }
    Ok(())
}

fn sanitize_devices(devices: &mut Vec<DeviceInstance>) {
    let mut seen = std::collections::HashSet::new();
    devices.retain(|device| !device.id.trim().is_empty() && seen.insert(device.id.clone()));
}

fn sanitize_device_input_bindings(bindings: &mut Vec<DeviceInputBinding>) {
    let mut seen = std::collections::HashSet::new();
    bindings.retain(|binding| {
        !binding.id.trim().is_empty()
            && !binding.device_id.trim().is_empty()
            && !binding.channel_id.trim().is_empty()
            && seen.insert(binding.id.clone())
    });
}

fn sanitize_selected_events(source: &str, events: &mut Vec<String>) {
    events.retain(|event| {
        let known = is_known_hook_event(source, event);
        if !known {
            tracing::warn!("ignored unknown hook event in settings: {source}/{event}");
        }
        known
    });
    if events.is_empty() {
        *events = default_selected_events(source);
    }
}

fn ensure_global_target(targets: &mut Vec<HookConfigTarget>, source: &str, label: &str) {
    let exists = targets
        .iter()
        .any(|target| target.scope == HookConfigTargetScope::Global && target.source == source);
    if !exists {
        targets.push(HookConfigTarget {
            id: format!("global-{source}"),
            scope: HookConfigTargetScope::Global,
            source: source.to_string(),
            label: label.to_string(),
            project_path: None,
            enabled: false,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_hook_port_and_chinese_language() {
        let config = AppConfig::default();

        assert_eq!(DEFAULT_LOCAL_HOOK_PORT, config.local_hook_server.port);
        assert_eq!(DEFAULT_LANGUAGE, config.ui.language);
        assert_eq!(UiThemeMode::System, config.ui.theme_mode);
    }

    #[test]
    fn default_config_hides_window_to_tray_on_close() {
        let config = AppConfig::default();

        assert_eq!(
            WindowCloseBehavior::HideToTray,
            config.window.close_behavior
        );
    }

    #[test]
    fn window_config_defaults_disable_launch_at_login_and_hide_on_login_launch() {
        let config = AppConfig::default();

        assert!(!config.window.launch_at_login);
        assert!(config.window.hide_window_on_login_launch);
    }

    #[test]
    fn default_config_uses_daily_coding_active_profile() {
        let config = AppConfig::default();

        assert_eq!("daily-coding", config.active_profile_id);
    }

    #[test]
    fn empty_device_list_is_valid_and_not_recreated_by_sanitize() {
        let mut config = AppConfig {
            devices: Vec::new(),
            ..AppConfig::default()
        };

        assert_eq!(Ok(()), config.validate());

        config.sanitize();

        assert!(config.devices.is_empty());
    }

    #[test]
    fn validates_supported_port_and_language() {
        let config = AppConfig {
            local_hook_server: LocalHookServerConfig { port: 18080 },
            ui: UiConfig {
                language: "en-US".to_string(),
                theme_mode: UiThemeMode::Dark,
            },
            ..AppConfig::default()
        };

        assert_eq!(Ok(()), config.validate());
    }

    #[test]
    fn allows_unconfigured_arduino_cli_path() {
        let config = AppConfig {
            arduino_cli_path: None,
            ..AppConfig::default()
        };

        assert_eq!(Ok(()), config.validate());
    }

    #[test]
    fn rejects_blank_arduino_cli_path() {
        let config = AppConfig {
            arduino_cli_path: Some("   ".to_string()),
            ..AppConfig::default()
        };

        assert_eq!(
            Err("arduino cli path cannot be empty".to_string()),
            config.validate()
        );
    }

    #[test]
    fn rejects_low_port() {
        let config = AppConfig {
            local_hook_server: LocalHookServerConfig { port: 80 },
            ui: UiConfig {
                language: DEFAULT_LANGUAGE.to_string(),
                theme_mode: Default::default(),
            },
            ..AppConfig::default()
        };

        assert_eq!(
            Err("local hook server port must be between 1024 and 65535".to_string()),
            config.validate()
        );
    }

    #[test]
    fn rejects_unsupported_language() {
        let config = AppConfig {
            local_hook_server: LocalHookServerConfig {
                port: DEFAULT_LOCAL_HOOK_PORT,
            },
            ui: UiConfig {
                language: "ja-JP".to_string(),
                theme_mode: Default::default(),
            },
            ..AppConfig::default()
        };

        assert_eq!(Err("unsupported language".to_string()), config.validate());
    }

    #[test]
    fn rejects_unsupported_theme_mode() {
        let result: Result<AppConfig, _> = serde_json::from_str(
            r#"{
              "localHookServer":{"port":17321},
              "ui":{"language":"zh-CN","themeMode":"auto"},
              "hookEventSelections":{"codex":["SessionStart"],"claudeCode":["StopFailure"]},
              "hookConfigTargets":[]
            }"#,
        );

        assert!(result.is_err());
    }

    #[test]
    fn rejects_empty_active_profile_id() {
        let config = AppConfig {
            active_profile_id: " ".to_string(),
            ..AppConfig::default()
        };

        assert_eq!(
            Err("active profile id cannot be empty".to_string()),
            config.validate()
        );
    }

    #[test]
    fn loads_old_settings_without_active_profile_with_default() {
        let config: AppConfig = serde_json::from_str(
            r#"{
              "localHookServer":{"port":17321},
              "ui":{"language":"zh-CN"},
              "hookEventSelections":{"codex":["SessionStart"],"claudeCode":["StopFailure"]},
              "hookConfigTargets":[]
            }"#,
        )
        .expect("old settings should deserialize");

        assert_eq!("daily-coding", config.active_profile_id);
        assert_eq!(UiThemeMode::System, config.ui.theme_mode);
        assert!(config.desktop_notice_instances.is_empty());
    }

    #[test]
    fn ui_theme_mode_serializes_as_kebab_case_contract() {
        let config = AppConfig {
            ui: UiConfig {
                language: DEFAULT_LANGUAGE.to_string(),
                theme_mode: UiThemeMode::Dark,
            },
            ..AppConfig::default()
        };

        let value = serde_json::to_value(config).expect("config should serialize");

        assert_eq!("dark", value["ui"]["themeMode"]);
    }

    #[test]
    fn loads_old_settings_without_window_config_with_default() {
        let config: AppConfig = serde_json::from_str(
            r#"{
              "localHookServer":{"port":17321},
              "ui":{"language":"zh-CN"},
              "hookEventSelections":{"codex":["SessionStart"],"claudeCode":["StopFailure"]},
              "hookConfigTargets":[]
            }"#,
        )
        .expect("old settings should deserialize");

        assert_eq!(
            WindowCloseBehavior::HideToTray,
            config.window.close_behavior
        );
    }

    #[test]
    fn loads_old_window_config_without_startup_mode_with_default() {
        let config: AppConfig = serde_json::from_str(
            r#"{
              "localHookServer":{"port":17321},
              "ui":{"language":"zh-CN"},
              "window":{"closeBehavior":"hide-to-tray"},
              "hookEventSelections":{"codex":["SessionStart"],"claudeCode":["StopFailure"]},
              "hookConfigTargets":[]
            }"#,
        )
        .expect("old window config should deserialize");

        assert_eq!(WindowStartupMode::Normal, config.window.startup_mode);
    }

    #[test]
    fn window_config_deserializes_old_config_without_login_fields() {
        let config: AppConfig = serde_json::from_str(
            r#"{
              "localHookServer":{"port":17321},
              "ui":{"language":"zh-CN"},
              "window":{"closeBehavior":"hide-to-tray","startupMode":"normal"},
              "activeProfileId":"daily-coding",
              "hookEventSelections":{"bySource":{}},
              "hookConfigTargets":[]
            }"#,
        )
        .expect("old config should deserialize");

        assert!(!config.window.launch_at_login);
        assert!(config.window.hide_window_on_login_launch);
    }

    #[test]
    fn window_close_behavior_serializes_as_kebab_case_contract() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::Exit,
                startup_mode: WindowStartupMode::Lightweight,
                launch_at_login: false,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        let value = serde_json::to_value(config).expect("config should serialize");

        assert_eq!("exit", value["window"]["closeBehavior"]);
    }

    #[test]
    fn window_startup_mode_serializes_as_kebab_case_contract() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::HideToTray,
                startup_mode: WindowStartupMode::Lightweight,
                launch_at_login: false,
                hide_window_on_login_launch: true,
            },
            ..AppConfig::default()
        };

        let value = serde_json::to_value(config).expect("config should serialize");

        assert_eq!("lightweight", value["window"]["startupMode"]);
    }

    #[test]
    fn window_config_serializes_login_startup_fields() {
        let config = AppConfig {
            window: WindowConfig {
                close_behavior: WindowCloseBehavior::Exit,
                startup_mode: WindowStartupMode::Lightweight,
                launch_at_login: true,
                hide_window_on_login_launch: false,
            },
            ..AppConfig::default()
        };

        let value = serde_json::to_value(config).expect("config should serialize");

        assert_eq!(true, value["window"]["launchAtLogin"]);
        assert_eq!(false, value["window"]["hideWindowOnLoginLaunch"]);
    }

    #[test]
    fn hook_event_selections_deserialize_source_indexed_shape() {
        let selections: HookEventSelections = serde_json::from_str(
            r#"{
              "bySource":{
                "codex":["SessionStart"],
                "claude-code":["StopFailure"]
              }
            }"#,
        )
        .expect("source indexed selections should deserialize");

        assert_eq!(
            vec!["SessionStart".to_string()],
            selections.events_for_source("codex")
        );
        assert_eq!(
            vec!["StopFailure".to_string()],
            selections.events_for_source("claude-code")
        );
    }

    #[test]
    fn hook_event_selections_deserialize_legacy_fixed_fields() {
        let selections: HookEventSelections = serde_json::from_str(
            r#"{
              "codex":["SessionStart"],
              "claudeCode":["StopFailure"]
            }"#,
        )
        .expect("legacy selections should deserialize");

        assert_eq!(
            vec!["SessionStart".to_string()],
            selections.events_for_source("codex")
        );
        assert_eq!(
            vec!["StopFailure".to_string()],
            selections.events_for_source("claude-code")
        );
    }

    #[test]
    fn default_config_contains_hook_event_defaults_and_global_targets() {
        let config = AppConfig::default();

        assert_eq!(
            vec![
                "SessionStart",
                "PreToolUse",
                "PermissionRequest",
                "PostToolUse",
                "UserPromptSubmit",
                "Stop",
            ],
            config.hook_event_selections.events_for_source("codex")
        );
        assert_eq!(
            vec![
                "SessionStart",
                "UserPromptSubmit",
                "PreToolUse",
                "PostToolUse",
                "PostToolUseFailure",
                "Notification",
                "PermissionRequest",
                "Stop",
                "StopFailure",
            ],
            config
                .hook_event_selections
                .events_for_source("claude-code")
        );
        assert!(config.hook_config_targets.iter().any(|target| target.scope
            == HookConfigTargetScope::Global
            && target.source == "codex"));
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.scope == HookConfigTargetScope::Global
                && target.source == "claude-code"));
    }

    #[test]
    fn rejects_unknown_selected_hook_event() {
        let mut config = AppConfig::default();
        let mut events = config.hook_event_selections.events_for_source("codex");
        events.push("Setup".to_string());
        config
            .hook_event_selections
            .set_events_for_source("codex", events);

        assert_eq!(
            Err("unknown hook event for codex: Setup".to_string()),
            config.validate()
        );
    }

    #[test]
    fn rejects_unknown_hook_event_selection_source() {
        let mut config = AppConfig::default();
        config
            .hook_event_selections
            .set_events_for_source("unknown-tool", vec!["SessionStart".to_string()]);

        assert_eq!(
            Err("unknown ai tool source: unknown-tool".to_string()),
            config.validate()
        );
    }

    #[test]
    fn input_binding_requires_valid_shortcut() {
        let config = AppConfig {
            device_input_bindings: vec![DeviceInputBinding {
                id: "wio-a".to_string(),
                enabled: true,
                device_id: "desk-wio".to_string(),
                channel_id: "input.button.a".to_string(),
                trigger: DeviceInputTrigger::Press,
                action: DeviceInputAction::KeyboardShortcut {
                    shortcut: KeyboardShortcut {
                        keys: vec!["A".to_string(), "B".to_string()],
                    },
                },
            }],
            ..AppConfig::default()
        };

        assert_eq!(
            Err("shortcut combo requires modifier keys and one primary key".to_string()),
            config.validate()
        );
    }

    #[test]
    fn input_binding_requires_unique_id_and_target_channel() {
        let config = AppConfig {
            device_input_bindings: vec![DeviceInputBinding {
                id: "wio-a".to_string(),
                enabled: true,
                device_id: "desk-wio".to_string(),
                channel_id: " ".to_string(),
                trigger: DeviceInputTrigger::Press,
                action: DeviceInputAction::KeyboardShortcut {
                    shortcut: KeyboardShortcut {
                        keys: vec!["Escape".to_string()],
                    },
                },
            }],
            ..AppConfig::default()
        };

        assert_eq!(
            Err("device input binding requires device_id and channel_id".to_string()),
            config.validate()
        );
    }

    #[test]
    fn sanitize_removes_unknown_hook_event_selection_source() {
        let mut config = AppConfig::default();
        config
            .hook_event_selections
            .set_events_for_source("unknown-tool", vec!["SessionStart".to_string()]);

        config.sanitize();

        assert!(config
            .hook_event_selections
            .events_for_source("unknown-tool")
            .is_empty());
    }

    #[test]
    fn rejects_project_target_without_project_path() {
        let mut config = AppConfig::default();
        config.hook_config_targets.push(HookConfigTarget {
            id: "bad-project".to_string(),
            scope: HookConfigTargetScope::Project,
            source: "codex".to_string(),
            label: "Bad Project".to_string(),
            project_path: None,
            enabled: false,
        });

        assert_eq!(
            Err("project hook config target requires projectPath".to_string()),
            config.validate()
        );
    }
}
