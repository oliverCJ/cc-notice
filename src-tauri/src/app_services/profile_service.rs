use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::app_services::profile_repair::{repair_profile_content, ProfileRepairReport};
use crate::core::internal_events::builtin_internal_event_ids;
use crate::core::profiles::{NoticeProfile, ProfileTemplate, DEFAULT_PROFILE_ID};
use crate::infrastructure::app_paths;
use crate::infrastructure::file_config;
use crate::utils::time_utils::timestamp_for_backup;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub id: String,
    pub name: String,
    pub active: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFrontendState {
    pub active_profile_id: String,
    pub active_profile: NoticeProfile,
    pub profiles: Vec<ProfileSummary>,
    /// 标记 Hook 配置是否需要重新写入到 AI 工具
    /// 当 Profile 切换或 Hook 事件选择变化时为 true
    #[serde(default)]
    pub hook_config_sync_required: bool,
    /// 标记 Profile 加载期是否自动移除了无法解析或无法校验的配置片段。
    /// 前端据此提示用户重新配置失效部分。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_repair: Option<ProfileRepairReport>,
}

#[derive(Debug, Clone)]
pub struct ProfileService {
    root: PathBuf,
    active_profile_id: String,
    active_profile: NoticeProfile,
    active_profile_repair_report: Option<ProfileRepairReport>,
    valid_internal_event_ids: HashSet<String>,
}

#[derive(Debug, Clone)]
struct LoadedProfile {
    profile: NoticeProfile,
    repair_report: Option<ProfileRepairReport>,
}

impl ProfileService {
    pub fn from_user_home(active_profile_id: String) -> Result<Self, String> {
        Self::from_config_root_with_active_id(app_paths::app_home_dir()?, active_profile_id)
    }

    pub fn from_config_root(root: PathBuf) -> Result<Self, String> {
        Self::from_config_root_with_active_id(root, DEFAULT_PROFILE_ID.to_string())
    }

    pub fn from_config_root_with_active_id(
        root: PathBuf,
        active_profile_id: String,
    ) -> Result<Self, String> {
        Self::from_config_root_with_active_id_and_internal_events(
            root,
            active_profile_id,
            &builtin_internal_event_ids(),
        )
    }

    pub fn from_config_root_with_active_id_and_internal_events(
        root: PathBuf,
        active_profile_id: String,
        valid_internal_event_ids: &HashSet<String>,
    ) -> Result<Self, String> {
        fs::create_dir_all(root.join("profiles")).map_err(|error| error.to_string())?;
        ensure_default_profile(&root)?;
        let loaded_profile = load_active_or_repaired_default_profile(
            &root,
            &active_profile_id,
            valid_internal_event_ids,
        )?;

        Ok(Self {
            root,
            active_profile_id: loaded_profile.profile.id.clone(),
            active_profile: loaded_profile.profile,
            active_profile_repair_report: loaded_profile.repair_report,
            valid_internal_event_ids: valid_internal_event_ids.clone(),
        })
    }

    pub fn state(&self) -> ProfileFrontendState {
        let mut summaries = self.list_profile_summaries().unwrap_or_else(|error| {
            tracing::warn!("failed to list profile summaries: {error}");
            vec![ProfileSummary {
                id: self.active_profile.id.clone(),
                name: self.active_profile.name.clone(),
                active: true,
            }]
        });
        summaries.sort_by(|left, right| left.name.cmp(&right.name));

        ProfileFrontendState {
            active_profile_id: self.active_profile_id.clone(),
            active_profile: self.active_profile.clone(),
            profiles: summaries,
            hook_config_sync_required: false,
            profile_repair: self.active_profile_repair_report.clone(),
        }
    }

    pub fn active_profile(&self) -> NoticeProfile {
        self.active_profile.clone()
    }

    pub fn save_profile(&mut self, profile: NoticeProfile) -> Result<ProfileFrontendState, String> {
        let valid_internal_event_ids = self.valid_internal_event_ids.clone();
        self.save_profile_with_internal_events(profile, &valid_internal_event_ids)
    }

    pub fn save_profile_with_internal_events(
        &mut self,
        profile: NoticeProfile,
        valid_internal_event_ids: &HashSet<String>,
    ) -> Result<ProfileFrontendState, String> {
        profile.validate_with_internal_events(valid_internal_event_ids)?;
        self.valid_internal_event_ids = valid_internal_event_ids.clone();
        let path = profile_path(&self.root, &profile.id);
        let content = serde_json::to_string_pretty(&profile).map_err(|error| error.to_string())?;
        file_config::write_string(&path, &content)?;
        if profile.id == self.active_profile_id {
            self.active_profile = profile.clone();
            self.active_profile_repair_report = None;
        }
        tracing::info!("profile saved: {}", profile.id);
        Ok(self.state())
    }

    pub fn create_profile(
        &mut self,
        profile_id: &str,
        profile_name: &str,
        template: Option<ProfileTemplate>,
    ) -> Result<ProfileFrontendState, String> {
        let mut profile = NoticeProfile::daily_coding();
        profile.id = normalized_profile_id(profile_id)?;
        profile.name = normalized_profile_name(profile_name)?;

        // 应用模板配置
        if let Some(tpl) = template {
            tpl.apply_to_profile(&mut profile);
        }

        ensure_profile_path_available(&self.root, &profile.id)?;
        let valid_internal_event_ids = self.valid_internal_event_ids.clone();
        self.save_profile_with_internal_events(profile, &valid_internal_event_ids)
    }

    pub fn duplicate_profile(
        &mut self,
        source_profile_id: &str,
        profile_id: &str,
        profile_name: &str,
    ) -> Result<ProfileFrontendState, String> {
        let mut profile = load_profile(
            &self.root,
            source_profile_id,
            &self.valid_internal_event_ids,
        )?;
        profile.id = normalized_profile_id(profile_id)?;
        profile.name = normalized_profile_name(profile_name)?;
        ensure_profile_path_available(&self.root, &profile.id)?;
        let valid_internal_event_ids = self.valid_internal_event_ids.clone();
        self.save_profile_with_internal_events(profile, &valid_internal_event_ids)
    }

    pub fn activate_profile(&mut self, profile_id: &str) -> Result<ProfileFrontendState, String> {
        let valid_internal_event_ids = self.valid_internal_event_ids.clone();
        self.activate_profile_with_internal_events(profile_id, &valid_internal_event_ids)
    }

    pub fn activate_profile_with_internal_events(
        &mut self,
        profile_id: &str,
        valid_internal_event_ids: &HashSet<String>,
    ) -> Result<ProfileFrontendState, String> {
        let loaded_profile =
            load_profile_with_repair(&self.root, profile_id, valid_internal_event_ids)?;
        self.active_profile_id = loaded_profile.profile.id.clone();
        self.active_profile = loaded_profile.profile;
        self.active_profile_repair_report = loaded_profile.repair_report;
        self.valid_internal_event_ids = valid_internal_event_ids.clone();
        tracing::info!("profile activated: {}", self.active_profile_id);
        Ok(self.state())
    }

    pub fn delete_profile(&mut self, profile_id: &str) -> Result<ProfileFrontendState, String> {
        if profile_id == self.active_profile_id {
            return Err("cannot delete active profile".to_string());
        }
        let path = profile_path(&self.root, profile_id);
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
        tracing::info!("profile deleted: {profile_id}");
        Ok(self.state())
    }

    pub fn reset_all_to_default(&mut self) -> Result<ProfileFrontendState, String> {
        let profiles_dir = self.root.join("profiles");
        if profiles_dir.exists() {
            fs::remove_dir_all(&profiles_dir).map_err(|error| error.to_string())?;
        }
        fs::create_dir_all(&profiles_dir).map_err(|error| error.to_string())?;
        ensure_default_profile(&self.root)?;
        let profile = load_profile(
            &self.root,
            DEFAULT_PROFILE_ID,
            &self.valid_internal_event_ids,
        )?;
        self.active_profile_id = profile.id.clone();
        self.active_profile = profile;
        self.active_profile_repair_report = None;
        tracing::info!("profiles reset to default");
        Ok(self.state())
    }

    pub fn list_profiles(&self) -> Result<Vec<NoticeProfile>, String> {
        let mut profiles = Vec::new();
        for entry in fs::read_dir(self.root.join("profiles")).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            match load_profile_file(&path, &self.valid_internal_event_ids) {
                Ok(profile) => profiles.push(profile),
                Err(error) => {
                    tracing::warn!(
                        path = path.to_string_lossy().as_ref(),
                        "ignored invalid profile file: {error}"
                    );
                }
            }
        }
        Ok(profiles)
    }

    fn list_profile_summaries(&self) -> Result<Vec<ProfileSummary>, String> {
        let mut summaries = Vec::new();
        for entry in fs::read_dir(self.root.join("profiles")).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            match load_profile_summary_readonly(
                &path,
                &self.active_profile_id,
                &self.valid_internal_event_ids,
            ) {
                Ok(summary) => summaries.push(summary),
                Err(error) => {
                    tracing::warn!(
                        path = path.to_string_lossy().as_ref(),
                        "ignored unreadable profile summary: {error}"
                    );
                }
            }
        }
        if !summaries
            .iter()
            .any(|summary| summary.id == self.active_profile_id)
        {
            summaries.push(ProfileSummary {
                id: self.active_profile.id.clone(),
                name: self.active_profile.name.clone(),
                active: true,
            });
        }
        Ok(summaries)
    }
}

fn ensure_default_profile(root: &Path) -> Result<(), String> {
    let path = profile_path(root, DEFAULT_PROFILE_ID);
    if path.exists() {
        return Ok(());
    }
    write_default_profile(root)
}

fn load_active_or_repaired_default_profile(
    root: &Path,
    active_profile_id: &str,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<LoadedProfile, String> {
    match load_profile_with_repair(root, active_profile_id, valid_internal_event_ids) {
        Ok(loaded_profile) => return Ok(loaded_profile),
        Err(error) => {
            tracing::warn!("failed to load active profile {active_profile_id}: {error}");
            if active_profile_id != DEFAULT_PROFILE_ID {
                backup_unrecoverable_profile(root, active_profile_id)?;
                let mut loaded_default = load_default_or_recreate(root, valid_internal_event_ids)?;
                let mut report = ProfileRepairReport::with_unrecoverable_profile(active_profile_id);
                if let Some(default_report) = loaded_default.repair_report.take() {
                    report.removed_enabled_hook_events +=
                        default_report.removed_enabled_hook_events;
                    report.removed_ai_event_mappings += default_report.removed_ai_event_mappings;
                    report.removed_hardware_rules += default_report.removed_hardware_rules;
                    report.repaired_profile_identity |= default_report.repaired_profile_identity;
                    report.reset_device |= default_report.reset_device;
                }
                loaded_default.repair_report = Some(report);
                return Ok(loaded_default);
            }
        }
    }

    load_default_or_recreate(root, valid_internal_event_ids)
}

fn load_default_or_recreate(
    root: &Path,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<LoadedProfile, String> {
    match load_profile_with_repair(root, DEFAULT_PROFILE_ID, valid_internal_event_ids) {
        Ok(loaded_profile) => Ok(loaded_profile),
        Err(error) => {
            tracing::warn!(
                "default profile cannot be repaired, backing it up and recreating defaults: {error}"
            );
            backup_unrecoverable_profile(root, DEFAULT_PROFILE_ID)?;
            write_default_profile(root)?;
            let mut loaded_profile =
                load_profile_with_repair(root, DEFAULT_PROFILE_ID, valid_internal_event_ids)?;
            loaded_profile.repair_report = Some(ProfileRepairReport::with_unrecoverable_profile(
                DEFAULT_PROFILE_ID,
            ));
            Ok(loaded_profile)
        }
    }
}

fn backup_unrecoverable_profile(root: &Path, profile_id: &str) -> Result<(), String> {
    let path = profile_path(root, profile_id);
    if !path.exists() {
        return Ok(());
    }
    let backup_path = available_unrecoverable_profile_backup_path(&path);
    fs::rename(&path, &backup_path).map_err(|error| error.to_string())?;
    tracing::warn!(
        path = path.to_string_lossy().as_ref(),
        backup_path = backup_path.to_string_lossy().as_ref(),
        "unrecoverable default profile moved aside"
    );
    Ok(())
}

fn available_unrecoverable_profile_backup_path(path: &Path) -> PathBuf {
    let timestamp = timestamp_for_backup();
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("profile");
    let mut path_candidate = path.with_file_name(format!("{stem}.{timestamp}.invalid.json"));
    let mut suffix = 1;
    while path_candidate.exists() {
        path_candidate = path.with_file_name(format!("{stem}.{timestamp}.{suffix}.invalid.json"));
        suffix += 1;
    }
    path_candidate
}

fn write_default_profile(root: &Path) -> Result<(), String> {
    let path = profile_path(root, DEFAULT_PROFILE_ID);
    let profile = NoticeProfile::daily_coding();
    let content = serde_json::to_string_pretty(&profile).map_err(|error| error.to_string())?;
    file_config::write_string(&path, &content)
}

fn load_profile(
    root: &Path,
    profile_id: &str,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<NoticeProfile, String> {
    Ok(load_profile_with_repair(root, profile_id, valid_internal_event_ids)?.profile)
}

fn load_profile_with_repair(
    root: &Path,
    profile_id: &str,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<LoadedProfile, String> {
    let path = profile_path(root, profile_id);
    load_profile_file_with_repair(&path, valid_internal_event_ids)
}

fn load_profile_file(
    path: &Path,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<NoticeProfile, String> {
    Ok(load_profile_file_with_repair(path, valid_internal_event_ids)?.profile)
}

fn load_profile_summary_readonly(
    path: &Path,
    active_profile_id: &str,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<ProfileSummary, String> {
    let content = file_config::read_to_string(path)?;
    match parse_profile_content(&content, valid_internal_event_ids) {
        Ok(profile) => Ok(ProfileSummary {
            active: profile.id == active_profile_id,
            id: profile.id,
            name: profile.name,
        }),
        Err(_) => {
            let value = serde_json::from_str::<serde_json::Value>(&content)
                .map_err(|error| error.to_string())?;
            let object = value
                .as_object()
                .ok_or_else(|| "profile root must be a JSON object".to_string())?;
            let fallback_id = path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("profile");
            let id = object
                .get("id")
                .and_then(serde_json::Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(fallback_id)
                .to_string();
            let name = object
                .get("name")
                .and_then(serde_json::Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(&id)
                .to_string();
            Ok(ProfileSummary {
                active: id == active_profile_id,
                id,
                name,
            })
        }
    }
}

fn load_profile_file_with_repair(
    path: &Path,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<LoadedProfile, String> {
    let content = file_config::read_to_string(&path)?;
    match parse_profile_content(&content, valid_internal_event_ids) {
        Ok(profile) => Ok(LoadedProfile {
            profile,
            repair_report: None,
        }),
        Err(error) => {
            tracing::warn!(
                path = path.to_string_lossy().as_ref(),
                "profile file requires repair: {error}"
            );
            let fallback_profile_id = path.file_stem().and_then(|value| value.to_str());
            let repair_result =
                repair_profile_content(&content, fallback_profile_id, valid_internal_event_ids)
                    .map_err(|repair_error| format!("{error}; repair failed: {repair_error}"))?;
            backup_legacy_profile_file(path, &content)?;
            if repair_result.report.changed() {
                tracing::warn!(
                    repaired_profile_identity = repair_result.report.repaired_profile_identity,
                    removed_enabled_hook_events = repair_result.report.removed_enabled_hook_events,
                    removed_ai_event_mappings = repair_result.report.removed_ai_event_mappings,
                    removed_hardware_rules = repair_result.report.removed_hardware_rules,
                    reset_device = repair_result.report.reset_device,
                    "profile repaired by removing invalid configuration sections"
                );
            }
            file_config::write_string(path, &repair_result.content)?;
            let profile = parse_profile_content(&repair_result.content, valid_internal_event_ids)?;
            Ok(LoadedProfile {
                profile,
                repair_report: Some(repair_result.report),
            })
        }
    }
}

fn parse_profile_content(
    content: &str,
    valid_internal_event_ids: &HashSet<String>,
) -> Result<NoticeProfile, String> {
    let mut profile =
        serde_json::from_str::<NoticeProfile>(&content).map_err(|error| error.to_string())?;
    migrate_legacy_internal_events(&mut profile);
    profile.validate_with_internal_events(valid_internal_event_ids)?;
    Ok(profile)
}

fn backup_legacy_profile_file(path: &Path, content: &str) -> Result<(), String> {
    let backup_path = available_legacy_profile_backup_path(path);
    file_config::write_string(&backup_path, content)?;
    tracing::warn!(
        path = path.to_string_lossy().as_ref(),
        backup_path = backup_path.to_string_lossy().as_ref(),
        "legacy profile repaired and original content backed up"
    );
    Ok(())
}

fn available_legacy_profile_backup_path(path: &Path) -> PathBuf {
    let timestamp = timestamp_for_backup();
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("profile");
    let mut path_candidate = path.with_file_name(format!("{stem}.{timestamp}.legacy.bak"));
    let mut suffix = 1;
    while path_candidate.exists() {
        path_candidate = path.with_file_name(format!("{stem}.{timestamp}.{suffix}.legacy.bak"));
        suffix += 1;
    }
    path_candidate
}

fn migrate_legacy_internal_events(profile: &mut NoticeProfile) {
    for mapping in &mut profile.ai_event_mappings {
        if let Some(current_event) = migrated_internal_event(&mapping.internal_event) {
            tracing::info!(
                "migrated legacy ai mapping internal event: {} -> {}",
                mapping.internal_event,
                current_event
            );
            mapping.internal_event = current_event.to_string();
        }
    }
    for rule in &mut profile.hardware_rules {
        if let Some(current_event) = migrated_internal_event(&rule.internal_event) {
            tracing::info!(
                "migrated legacy hardware rule internal event: {} -> {}",
                rule.internal_event,
                current_event
            );
            rule.internal_event = current_event.to_string();
        }
    }
}

fn migrated_internal_event(event: &str) -> Option<&'static str> {
    match event {
        "session.started" => Some("agent.started"),
        "agent.running" => Some("agent.working"),
        _ => None,
    }
}

fn profile_path(root: &Path, profile_id: &str) -> PathBuf {
    root.join("profiles").join(format!("{profile_id}.json"))
}

fn ensure_profile_path_available(root: &Path, profile_id: &str) -> Result<(), String> {
    if profile_path(root, profile_id).exists() {
        return Err(format!("profile already exists: {profile_id}"));
    }
    Ok(())
}

fn normalized_profile_id(profile_id: &str) -> Result<String, String> {
    let id = profile_id.trim();
    if id.is_empty() {
        return Err("profile id cannot be empty".to_string());
    }
    if !id.chars().all(|character| {
        character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
    }) {
        return Err(
            "profile id can only contain lowercase letters, digits, and hyphen".to_string(),
        );
    }
    Ok(id.to_string())
}

fn normalized_profile_name(profile_name: &str) -> Result<String, String> {
    let name = profile_name.trim();
    if name.is_empty() {
        return Err("profile name cannot be empty".to_string());
    }
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("cc-notice-profile-{name}-{}", std::process::id()));
        if root.exists() {
            std::fs::remove_dir_all(&root).expect("stale temp root should be removable");
        }
        root
    }

    fn has_backup_with_suffix(path: &Path, suffix: &str) -> bool {
        let Some(parent) = path.parent() else {
            return false;
        };
        let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
            return false;
        };
        std::fs::read_dir(parent)
            .expect("profile dir should be readable")
            .filter_map(Result::ok)
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .any(|name| name.starts_with(stem) && name.ends_with(suffix))
    }

    #[test]
    fn missing_profiles_create_default_profile() {
        let root = temp_root("missing");
        let service = ProfileService::from_config_root(root).expect("service should load");

        let state = service.state();

        assert_eq!("daily-coding", state.active_profile_id);
        assert_eq!(1, state.profiles.len());
        assert_eq!("Daily Coding", state.active_profile.name);
        assert!(state.active_profile.enabled_hook_events.is_empty());
        assert!(state
            .active_profile
            .ai_event_mappings
            .iter()
            .any(|mapping| {
                mapping.source == "codex"
                    && mapping.event == "UserPromptSubmit"
                    && mapping.internal_event == "agent.started"
            }));
        assert!(state.active_profile.hardware_rules.iter().any(|rule| {
            rule.id == "agent-completed-system-notification-output"
                && rule.output.output_type
                    == crate::core::profiles::HardwareOutputType::SystemNotification
        }));
    }

    #[test]
    fn save_and_reload_profile_roundtrip() {
        let root = temp_root("roundtrip");
        let mut service =
            ProfileService::from_config_root(root.clone()).expect("service should load");
        let mut profile = NoticeProfile::daily_coding();
        profile.name = "测试方案".to_string();

        service.save_profile(profile).expect("profile should save");
        let reloaded = ProfileService::from_config_root(root).expect("service should reload");

        assert_eq!("测试方案", reloaded.state().active_profile.name);
    }

    #[test]
    fn save_profile_accepts_custom_internal_event_from_catalog() {
        let root = temp_root("custom-internal-event");
        let config_root = root.join(".cc-notice");
        let mut custom_event_service =
            crate::app_services::custom_internal_event_service::CustomInternalEventService::from_config_root(
                config_root.clone(),
            )
            .expect("custom event service should load");
        custom_event_service
            .create_custom_event(
                crate::app_services::custom_internal_event_service::CreateCustomInternalEventRequest {
                    id_prefix: "review.started".to_string(),
                    title: "评审开始".to_string(),
                    description: "开始 review".to_string(),
                    scenario: "用户提交 review 请求".to_string(),
                },
            )
            .expect("custom event should be created");
        let valid_event_ids = custom_event_service
            .valid_event_ids()
            .expect("valid event ids should load");
        let mut service = ProfileService::from_config_root_with_active_id_and_internal_events(
            config_root,
            DEFAULT_PROFILE_ID.to_string(),
            &valid_event_ids,
        )
        .expect("profile service should load");
        let mut profile = service.active_profile();
        let mapping = profile
            .ai_event_mappings
            .iter_mut()
            .find(|mapping| mapping.source == "codex" && mapping.event == "UserPromptSubmit")
            .expect("default user prompt mapping should exist");
        mapping.internal_event = "review.started.userDefined".to_string();

        service
            .save_profile_with_internal_events(profile, &valid_event_ids)
            .expect("profile with custom internal event should save");
    }

    #[test]
    fn load_profile_migrates_legacy_internal_events() {
        let root = temp_root("legacy-internal-events");
        let profiles_dir = root.join("profiles");
        std::fs::create_dir_all(&profiles_dir).expect("profiles dir should exist");
        let mut profile = NoticeProfile::daily_coding();
        profile.ai_event_mappings[0].internal_event = "session.started".to_string();
        profile.hardware_rules[1].internal_event = "agent.running".to_string();
        let content = serde_json::to_string_pretty(&profile).expect("profile should serialize");
        std::fs::write(profiles_dir.join("daily-coding.json"), content)
            .expect("legacy profile should be written");

        let service = ProfileService::from_config_root(root).expect("service should load");
        let state = service.state();

        assert!(state
            .active_profile
            .ai_event_mappings
            .iter()
            .any(|mapping| mapping.internal_event == "agent.started"));
        assert!(state
            .active_profile
            .hardware_rules
            .iter()
            .any(|rule| rule.internal_event == "agent.working"));
        assert!(state.active_profile.validate().is_ok());
    }

    #[test]
    fn invalid_device_channel_rule_is_removed_without_losing_valid_config() {
        let root = temp_root("legacy-device-channel");
        let profiles_dir = root.join("profiles");
        std::fs::create_dir_all(&profiles_dir).expect("profiles dir should exist");
        let mut value =
            serde_json::to_value(NoticeProfile::daily_coding()).expect("profile should serialize");
        value["name"] = serde_json::json!("保留的方案名称");
        value["enabledHookEvents"] = serde_json::json!([
            { "source": "codex", "event": "SessionStart" },
            { "source": "codex", "event": "UserPromptSubmit" }
        ]);
        value["aiEventMappings"] = serde_json::json!([
            {
                "id": "preserved-ai-mapping",
                "source": "codex",
                "event": "UserPromptSubmit",
                "internalEvent": "agent.started",
                "enabled": true
            }
        ]);
        value["hardwareRules"] = serde_json::json!([
            {
                "id": "agent-working-rp2040-pico-default-pin-gp1-device-channel-output",
                "internalEvent": "agent.working",
                "output": {
                    "type": "device-channel",
                    "deviceId": "rp2040-pico-default",
                    "channelId": "pin.gp1",
                    "channelAction": "activate",
                    "durationMs": 5000
                },
                "priority": 50,
                "enabled": true
            }
        ]);
        let profile_path = profiles_dir.join("daily-coding.json");
        std::fs::write(
            &profile_path,
            serde_json::to_string_pretty(&value).expect("legacy profile should serialize"),
        )
        .expect("legacy profile should be written");

        let service = ProfileService::from_config_root(root.clone()).expect("service should load");
        let state = service.state();

        assert_eq!("daily-coding", state.active_profile_id);
        assert_eq!("保留的方案名称", state.active_profile.name);
        assert_eq!(1, state.active_profile.ai_event_mappings.len());
        assert_eq!(
            "preserved-ai-mapping",
            state.active_profile.ai_event_mappings[0].id
        );
        assert!(state.active_profile.hardware_rules.iter().all(
            |rule| rule.id != "agent-working-rp2040-pico-default-pin-gp1-device-channel-output"
        ));
        assert!(state.active_profile.validate().is_ok());
        assert!(has_backup_with_suffix(&profile_path, ".legacy.bak"));
        assert!(!has_backup_with_suffix(&profile_path, ".invalid.json"));
    }

    #[test]
    fn invalid_hardware_rules_are_removed_and_valid_rules_are_kept() {
        let root = temp_root("invalid-hardware-rules");
        let profiles_dir = root.join("profiles");
        std::fs::create_dir_all(&profiles_dir).expect("profiles dir should exist");
        let mut value =
            serde_json::to_value(NoticeProfile::daily_coding()).expect("profile should serialize");
        value["hardwareRules"] = serde_json::json!([
            {
                "id": "agent-working-legacy-pin-output",
                "internalEvent": "agent.working",
                "output": {
                    "type": "device-channel",
                    "deviceId": "rp2040-pico-default",
                    "channelId": "pin.gp1",
                    "channelAction": "activate",
                    "durationMs": 5000
                },
                "priority": 50,
                "enabled": true
            },
            {
                "id": "agent-failed-notification-output",
                "internalEvent": "agent.failed",
                "output": {
                    "type": "system-notification",
                    "durationMs": null,
                    "notificationLevel": "error",
                    "notificationTitle": "{{source}} 任务异常",
                    "notificationBody": "事件：{{event}}",
                    "notificationTitleMaxChars": 80,
                    "notificationBodyMaxChars": 300,
                    "notificationThrottleSeconds": 30,
                    "notificationSound": "default"
                },
                "priority": 40,
                "enabled": true
            }
        ]);
        std::fs::write(
            profiles_dir.join("daily-coding.json"),
            serde_json::to_string_pretty(&value).expect("legacy profile should serialize"),
        )
        .expect("legacy profile should be written");

        let service = ProfileService::from_config_root(root).expect("service should load");
        let state = service.state();

        assert!(state
            .active_profile
            .hardware_rules
            .iter()
            .all(|rule| rule.id != "agent-working-legacy-pin-output"));
        assert!(state
            .active_profile
            .hardware_rules
            .iter()
            .any(|rule| rule.id == "agent-failed-notification-output"));
        assert!(state.active_profile.validate().is_ok());
    }

    #[test]
    fn removed_light_output_is_removed_without_recreating_profile() {
        let root = temp_root("legacy-light-output");
        let profiles_dir = root.join("profiles");
        std::fs::create_dir_all(&profiles_dir).expect("profiles dir should exist");
        let mut value =
            serde_json::to_value(NoticeProfile::daily_coding()).expect("profile should serialize");
        value["name"] = serde_json::json!("保留旧 light 的方案");
        value["hardwareRules"] = serde_json::json!([
            {
                "id": "agent-working-light-output",
                "internalEvent": "agent.working",
                "output": {
                    "type": "light",
                    "durationMs": 5000
                },
                "priority": 50,
                "enabled": true
            }
        ]);
        let profile_path = profiles_dir.join("daily-coding.json");
        std::fs::write(
            &profile_path,
            serde_json::to_string_pretty(&value).expect("legacy profile should serialize"),
        )
        .expect("legacy profile should be written");

        let service = ProfileService::from_config_root(root).expect("service should load");
        let state = service.state();

        assert_eq!("daily-coding", state.active_profile_id);
        assert_eq!("保留旧 light 的方案", state.active_profile.name);
        assert!(state
            .active_profile
            .hardware_rules
            .iter()
            .all(|rule| rule.id != "agent-working-light-output"));
        assert!(state.active_profile.validate().is_ok());
        assert!(has_backup_with_suffix(&profile_path, ".legacy.bak"));
        assert!(!has_backup_with_suffix(&profile_path, ".invalid.json"));
    }

    #[test]
    fn state_does_not_repair_inactive_profiles_while_listing_summaries() {
        let root = temp_root("list-does-not-repair");
        let profiles_dir = root.join("profiles");
        std::fs::create_dir_all(&profiles_dir).expect("profiles dir should exist");
        let default_profile = NoticeProfile::daily_coding();
        std::fs::write(
            profiles_dir.join("daily-coding.json"),
            serde_json::to_string_pretty(&default_profile)
                .expect("default profile should serialize"),
        )
        .expect("default profile should be written");
        let invalid_profile_path = profiles_dir.join("focus-mode.json");
        std::fs::write(
            &invalid_profile_path,
            serde_json::json!({
                "id": "focus-mode",
                "name": "Focus Mode",
                "enabledHookEvents": [],
                "aiEventMappings": [],
                "hardwareRules": [
                    {
                        "id": "legacy-light",
                        "internalEvent": "agent.working",
                        "output": { "type": "light" },
                        "priority": 50,
                        "enabled": true
                    }
                ],
                "device": { "boardId": "rp2040-pico", "transport": "serial" }
            })
            .to_string(),
        )
        .expect("invalid inactive profile should be written");

        let service = ProfileService::from_config_root(root).expect("service should load");
        let state = service.state();
        let persisted = std::fs::read_to_string(&invalid_profile_path)
            .expect("inactive profile should still exist");

        assert!(state
            .profiles
            .iter()
            .any(|profile| profile.id == "focus-mode" && profile.name == "Focus Mode"));
        assert!(persisted.contains("\"type\":\"light\""));
        assert!(!has_backup_with_suffix(
            &invalid_profile_path,
            ".legacy.bak"
        ));
    }

    #[test]
    fn unrecoverable_active_custom_profile_is_isolated_and_reported() {
        let root = temp_root("active-custom-unrecoverable");
        let profiles_dir = root.join("profiles");
        std::fs::create_dir_all(&profiles_dir).expect("profiles dir should exist");
        let default_profile = NoticeProfile::daily_coding();
        std::fs::write(
            profiles_dir.join("daily-coding.json"),
            serde_json::to_string_pretty(&default_profile)
                .expect("default profile should serialize"),
        )
        .expect("default profile should be written");
        let broken_path = profiles_dir.join("focus-mode.json");
        std::fs::write(&broken_path, "{invalid json")
            .expect("broken active profile should be written");

        let service =
            ProfileService::from_config_root_with_active_id(root.clone(), "focus-mode".to_string())
                .expect("service should fall back to default profile");
        let state = service.state();
        let repair = state.profile_repair.expect("fallback should report repair");

        assert_eq!("daily-coding", state.active_profile_id);
        assert_eq!(
            Some("focus-mode".to_string()),
            repair.isolated_unrecoverable_profile_id
        );
        assert!(!broken_path.exists());
        assert!(has_backup_with_suffix(&broken_path, ".invalid.json"));
    }

    #[test]
    fn activate_profile_switches_active_profile() {
        let root = temp_root("activate");
        let mut service = ProfileService::from_config_root(root).expect("service should load");
        let mut profile = NoticeProfile::daily_coding();
        profile.id = "focus-mode".to_string();
        profile.name = "专注模式".to_string();
        service.save_profile(profile).expect("profile should save");

        let state = service
            .activate_profile("focus-mode")
            .expect("profile should activate");

        assert_eq!("focus-mode", state.active_profile_id);
        assert_eq!("专注模式", state.active_profile.name);
    }

    #[test]
    fn create_profile_rejects_existing_profile_id() {
        let root = temp_root("create-existing");
        let mut service = ProfileService::from_config_root(root).expect("service should load");

        let error = service
            .create_profile("daily-coding", "重复方案", None)
            .expect_err("existing profile id should fail");

        assert_eq!("profile already exists: daily-coding", error);
    }

    #[test]
    fn duplicate_profile_rejects_existing_profile_id() {
        let root = temp_root("duplicate-existing");
        let mut service = ProfileService::from_config_root(root).expect("service should load");

        let error = service
            .duplicate_profile("daily-coding", "daily-coding", "重复方案")
            .expect_err("existing profile id should fail");

        assert_eq!("profile already exists: daily-coding", error);
    }

    #[test]
    fn list_profiles_skips_broken_profile_files() {
        let root = temp_root("broken-file");
        let service = ProfileService::from_config_root(root.clone()).expect("service should load");
        let broken_path = root.join("profiles").join("broken.json");
        std::fs::write(&broken_path, "{invalid json").expect("broken profile should be written");

        let state = service.state();

        assert_eq!(1, state.profiles.len());
        assert_eq!("daily-coding", state.profiles[0].id);
    }

    #[test]
    fn delete_active_profile_is_rejected() {
        let root = temp_root("delete-active");
        let mut service = ProfileService::from_config_root(root).expect("service should load");

        let error = service
            .delete_profile("daily-coding")
            .expect_err("active profile delete should fail");

        assert_eq!("cannot delete active profile".to_string(), error);
    }

    #[test]
    fn duplicate_profile_creates_inactive_copy() {
        let root = temp_root("duplicate");
        let mut service = ProfileService::from_config_root(root).expect("service should load");

        let state = service
            .duplicate_profile("daily-coding", "focus-mode", "专注模式")
            .expect("profile should duplicate");

        assert_eq!("daily-coding", state.active_profile_id);
        assert!(state
            .profiles
            .iter()
            .any(|profile| profile.id == "focus-mode" && profile.name == "专注模式"));
    }

    #[test]
    fn create_profile_from_default_adds_inactive_profile() {
        let root = temp_root("create");
        let mut service = ProfileService::from_config_root(root).expect("service should load");

        let state = service
            .create_profile("quiet-mode", "安静模式", None)
            .expect("profile should be created");

        assert_eq!("daily-coding", state.active_profile_id);
        assert!(state
            .profiles
            .iter()
            .any(|profile| profile.id == "quiet-mode" && profile.name == "安静模式"));
    }

    #[test]
    fn create_profile_with_template_applies_yaml_rules() {
        let root = temp_root("template-create");
        let mut service = ProfileService::from_config_root(root).expect("service should load");

        let state = service
            .create_profile("template-check", "模板校验", Some(ProfileTemplate::Basic))
            .expect("profile should be created");
        let profile = state.active_profile;

        assert_eq!("daily-coding", state.active_profile_id);
        assert_eq!("Daily Coding", profile.name);
        assert!(state
            .profiles
            .iter()
            .any(|item| item.id == "template-check"));

        let created = load_profile(
            &service.root,
            "template-check",
            &service.valid_internal_event_ids,
        )
        .expect("created profile should be persisted");
        assert_eq!("template-check", created.id);
        assert!(created.enabled_hook_events.is_empty());
        assert!(created.ai_event_mappings.iter().any(|mapping| {
            mapping.event == "PermissionRequest" && mapping.internal_event == "agent.waiting_input"
        }));
        assert!(created
            .hardware_rules
            .iter()
            .any(|rule| rule.id == "agent-waiting-input-system-notification-output"));
    }
}
