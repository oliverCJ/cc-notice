use std::fs;
use std::path::{Path, PathBuf};

use crate::core::app_config::AppConfig;
use crate::infrastructure::app_paths;
use crate::infrastructure::file_config;

#[derive(Debug, Clone)]
pub struct AppConfigService {
    config: AppConfig,
    settings_path: Option<PathBuf>,
}

impl Default for AppConfigService {
    fn default() -> Self {
        Self {
            config: AppConfig::default(),
            settings_path: None,
        }
    }
}

impl AppConfigService {
    pub fn from_user_home() -> Result<Self, String> {
        Self::from_settings_path(app_paths::settings_file_path()?)
    }

    pub fn from_settings_path(settings_path: PathBuf) -> Result<Self, String> {
        if !settings_path.exists() {
            return Ok(Self {
                config: AppConfig::default(),
                settings_path: Some(settings_path),
            });
        }

        let content = file_config::read_to_string(&settings_path)?;
        let mut config =
            serde_json::from_str::<AppConfig>(&content).map_err(|error| error.to_string())?;
        config.sanitize();
        config.validate()?;
        Ok(Self {
            config,
            settings_path: Some(settings_path),
        })
    }

    pub fn settings_path_in_home(home: &Path) -> PathBuf {
        app_paths::app_home_dir_for_user(home).join("settings.json")
    }

    pub fn config(&self) -> AppConfig {
        self.config.clone()
    }

    pub fn save_config(&mut self, config: AppConfig) -> Result<AppConfig, String> {
        config.validate()?;
        if let Some(settings_path) = &self.settings_path {
            if let Some(parent) = settings_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let content =
                serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
            file_config::write_string(settings_path, &content)?;
        }
        self.config = config;
        tracing::info!("app config saved");
        Ok(self.config.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::app_config::{LocalHookServerConfig, UiConfig};

    #[test]
    fn returns_default_config() {
        let service = AppConfigService::default();

        assert_eq!(17321, service.config().local_hook_server.port);
        assert_eq!("zh-CN", service.config().ui.language);
    }

    #[test]
    fn saves_valid_config() {
        let mut service = AppConfigService::default();
        let config = AppConfig {
            local_hook_server: LocalHookServerConfig { port: 18080 },
            ui: UiConfig {
                language: "en-US".to_string(),
                theme_mode: Default::default(),
            },
            ..AppConfig::default()
        };

        service
            .save_config(config)
            .expect("valid config should be saved");

        assert_eq!(18080, service.config().local_hook_server.port);
        assert_eq!("en-US", service.config().ui.language);
    }

    #[test]
    fn rejects_invalid_config_without_changing_current_config() {
        let mut service = AppConfigService::default();
        let config = AppConfig {
            local_hook_server: LocalHookServerConfig { port: 80 },
            ui: UiConfig {
                language: "zh-CN".to_string(),
                theme_mode: Default::default(),
            },
            ..AppConfig::default()
        };

        let error = service
            .save_config(config)
            .expect_err("invalid config should fail");

        assert_eq!(
            "local hook server port must be between 1024 and 65535",
            error
        );
        assert_eq!(17321, service.config().local_hook_server.port);
    }

    #[test]
    fn settings_path_uses_hidden_app_directory_under_home() {
        let path = AppConfigService::settings_path_in_home(Path::new("/Users/alice"));

        assert_eq!(Path::new("/Users/alice/.cc-notice/settings.json"), path);
    }

    #[test]
    fn save_and_load_config_roundtrip_from_settings_file() {
        let dir =
            std::env::temp_dir().join(format!("cc-notice-settings-test-{}", std::process::id()));
        let settings_path = dir.join(".cc-notice").join("settings.json");
        let config = AppConfig {
            local_hook_server: LocalHookServerConfig { port: 18080 },
            ui: UiConfig {
                language: "en-US".to_string(),
                theme_mode: Default::default(),
            },
            ..AppConfig::default()
        };

        let mut service = AppConfigService::from_settings_path(settings_path.clone())
            .expect("missing settings should load defaults");
        service
            .save_config(config)
            .expect("valid config should be persisted");
        let loaded_service = AppConfigService::from_settings_path(settings_path)
            .expect("saved settings should load");

        assert_eq!(18080, loaded_service.config().local_hook_server.port);
        assert_eq!("en-US", loaded_service.config().ui.language);
    }

    #[test]
    fn loads_legacy_desktop_notice_instances_without_dropping_them() {
        let dir = std::env::temp_dir().join(format!(
            "cc-notice-legacy-desktop-notice-test-{}",
            std::process::id()
        ));
        let settings_path = dir.join(".cc-notice").join("settings.json");
        std::fs::create_dir_all(settings_path.parent().expect("settings parent"))
            .expect("settings dir should be created");
        std::fs::write(
            &settings_path,
            r##"{
              "localHookServer":{"port":17321},
              "ui":{"language":"zh-CN","themeMode":"system"},
              "window":{"closeBehavior":"hide-to-tray","startupMode":"normal"},
              "activeProfileId":"daily-coding",
              "hookEventSelections":{"bySource":{}},
              "hookConfigTargets":[],
              "desktopNoticeInstances":[
                {
                  "id":"desktop-notice-legacy",
                  "name":"旧灯条",
                  "variant":"lightbar",
                  "enabled":true,
                  "showOnStartup":false,
                  "alwaysOnTop":true,
                  "presetPosition":"custom",
                  "direction":"horizontal",
                  "size":{"width":1895,"height":70},
                  "opacityPercent":100,
                  "cornerRadiusPercent":50,
                  "idleBehavior":"hidden",
                  "boundsOverride":{
                    "x":738,
                    "y":1390,
                    "width":1895,
                    "height":50,
                    "sourceWorkArea":{"x":0,"y":25,"width":3440,"height":1415}
                  }
                }
              ]
            }"##,
        )
        .expect("legacy settings should be written");

        let service = AppConfigService::from_settings_path(settings_path)
            .expect("legacy desktop notice settings should load");

        let config = service.config();
        assert_eq!(1, config.desktop_notice_instances.len());
        let instance = &config.desktop_notice_instances[0];
        assert_eq!("desktop-notice-legacy", instance.id);
        assert!(instance.custom_lightbar.is_some());
    }

    #[test]
    fn loads_old_settings_without_hook_fields_with_defaults() {
        let dir = std::env::temp_dir().join(format!(
            "cc-notice-old-settings-test-{}",
            std::process::id()
        ));
        let settings_path = dir.join(".cc-notice").join("settings.json");
        std::fs::create_dir_all(settings_path.parent().expect("settings parent"))
            .expect("settings dir should be created");
        std::fs::write(
            &settings_path,
            r#"{"localHookServer":{"port":17321},"ui":{"language":"zh-CN"}}"#,
        )
        .expect("old settings should be written");

        let service = AppConfigService::from_settings_path(settings_path)
            .expect("old settings should load with defaults");

        assert!(service
            .config()
            .hook_event_selections
            .events_for_source("codex")
            .contains(&"PermissionRequest".to_string()));
        assert_eq!("daily-coding", service.config().active_profile_id);
    }

    #[test]
    fn sanitizes_unknown_events_from_saved_settings() {
        let dir = std::env::temp_dir().join(format!(
            "cc-notice-sanitize-settings-test-{}",
            std::process::id()
        ));
        let settings_path = dir.join(".cc-notice").join("settings.json");
        std::fs::create_dir_all(settings_path.parent().expect("settings parent"))
            .expect("settings dir should be created");
        std::fs::write(
            &settings_path,
            r#"{
              "localHookServer":{"port":17321},
              "ui":{"language":"zh-CN"},
              "hookEventSelections":{"codex":["SessionStart","Setup"],"claudeCode":["StopFailure"]},
              "hookConfigTargets":[]
            }"#,
        )
        .expect("settings should be written");

        let service = AppConfigService::from_settings_path(settings_path)
            .expect("settings should load after sanitizing");

        assert_eq!(
            vec!["SessionStart".to_string()],
            service
                .config()
                .hook_event_selections
                .events_for_source("codex")
        );
    }
}
