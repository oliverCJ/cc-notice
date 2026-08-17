use crate::app_services::hook_config_target_service::HookConfigTargetService;
use crate::app_services::hook_config_writer_service::{
    HookConfigWritePreview, HookConfigWriteResult, HookConfigWriterService,
};
use crate::app_services::hook_event_service::{HookEventFrontendState, HookEventService};
use crate::commands::app_config::user_home_from_env;
use crate::core::app_config::{
    AppConfig, HookConfigTarget, HookConfigTargetScope, HookEventSelections,
};
use crate::utils::profile_utils::hook_events_from_selections;
use crate::utils::time_utils::timestamp_for_backup;
use crate::AppState;

#[tauri::command]
pub fn hook_event_state(
    state: tauri::State<'_, AppState>,
) -> Result<HookEventFrontendState, String> {
    let config_service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let home = user_home_from_env(std::env::var("HOME").ok())?;
    HookEventService::state_for_config(&config_service.config(), &home)
}

#[tauri::command]
pub fn save_hook_event_selections(
    state: tauri::State<'_, AppState>,
    selections: HookEventSelections,
) -> Result<HookEventSelections, String> {
    let mut service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = service.config();
    config.hook_event_selections = selections;
    let saved = service.save_config(config)?;
    drop(service);

    let mut inbound_service = state
        .inbound_event_service
        .lock()
        .map_err(|error| error.to_string())?;
    inbound_service
        .set_enabled_hook_events(hook_events_from_selections(&saved.hook_event_selections));

    Ok(saved.hook_event_selections)
}

#[tauri::command]
pub fn add_hook_project_target(
    state: tauri::State<'_, AppState>,
    source: String,
    project_path: String,
) -> Result<HookEventFrontendState, String> {
    tracing::info!(
        source = source.as_str(),
        "add_hook_project_target command invoked"
    );
    let home = user_home_from_env(std::env::var("HOME").ok())?;
    let mut service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    let updated = HookConfigTargetService::add_project_target(config, &source, &project_path)?;
    let saved = service.save_config(updated)?;
    HookEventService::state_for_config(&saved, &home)
}

#[tauri::command]
pub fn remove_hook_config_target(
    state: tauri::State<'_, AppState>,
    target_id: String,
) -> Result<HookEventFrontendState, String> {
    tracing::info!(
        target_id = target_id.as_str(),
        "remove_hook_config_target command invoked"
    );
    let home = user_home_from_env(std::env::var("HOME").ok())?;
    let mut service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    let updated = HookConfigTargetService::remove_target(config, &target_id)?;
    let saved = service.save_config(updated)?;
    HookEventService::state_for_config(&saved, &home)
}

#[tauri::command]
pub fn preview_hook_config_target(
    state: tauri::State<'_, AppState>,
    target_id: String,
    debug: Option<bool>,
) -> Result<HookConfigWritePreview, String> {
    preview_hook_config_target_impl(&state, target_id, debug.unwrap_or(false))
}

pub(crate) fn preview_hook_config_target_impl(
    state: &AppState,
    target_id: String,
    debug: bool,
) -> Result<HookConfigWritePreview, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    let target = find_hook_config_target(&config, &target_id)?;
    let selections = config.hook_event_selections.clone();
    drop(service);
    let home_path = user_home_from_env(std::env::var("HOME").ok())?;
    let relay_path = state
        .tool_bin_service
        .lock()
        .map_err(|error| error.to_string())?
        .ensure_relay_installed()?;

    HookConfigWriterService::preview_target_with_options(
        &target,
        &selections,
        &home_path,
        &relay_path,
        debug,
    )
}

#[tauri::command]
pub fn write_hook_config_target(
    state: tauri::State<'_, AppState>,
    target_id: String,
    debug: Option<bool>,
) -> Result<HookConfigWriteResult, String> {
    write_hook_config_target_impl(&state, target_id, debug.unwrap_or(false))
}

pub(crate) fn write_hook_config_target_impl(
    state: &AppState,
    target_id: String,
    debug: bool,
) -> Result<HookConfigWriteResult, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    let target = find_hook_config_target(&config, &target_id)?;
    let selections = config.hook_event_selections.clone();
    drop(service);
    let home_path = user_home_from_env(std::env::var("HOME").ok())?;
    let timestamp = timestamp_for_backup();
    let relay_path = state
        .tool_bin_service
        .lock()
        .map_err(|error| error.to_string())?
        .ensure_relay_installed()?;

    restore_conflicting_enabled_targets(state, &config, &target, &home_path, &timestamp)?;
    let result = HookConfigWriterService::write_target_with_options(
        &target,
        &selections,
        &home_path,
        &timestamp,
        &relay_path,
        debug,
    )?;
    set_hook_target_enabled(state, &target_id, true)?;
    Ok(result)
}

#[tauri::command]
pub fn preview_restore_hook_config_target(
    state: tauri::State<'_, AppState>,
    target_id: String,
) -> Result<HookConfigWritePreview, String> {
    preview_restore_hook_config_target_impl(&state, target_id)
}

pub(crate) fn preview_restore_hook_config_target_impl(
    state: &AppState,
    target_id: String,
) -> Result<HookConfigWritePreview, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    let target = find_hook_config_target(&config, &target_id)?;
    drop(service);
    let home = user_home_from_env(std::env::var("HOME").ok())?;
    HookConfigWriterService::preview_restore_target(&target, &home)
}

#[tauri::command]
pub fn restore_hook_config_target(
    state: tauri::State<'_, AppState>,
    target_id: String,
) -> Result<HookConfigWriteResult, String> {
    restore_hook_config_target_impl(&state, target_id)
}

pub(crate) fn restore_hook_config_target_impl(
    state: &AppState,
    target_id: String,
) -> Result<HookConfigWriteResult, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    let target = find_hook_config_target(&config, &target_id)?;
    drop(service);
    let home = user_home_from_env(std::env::var("HOME").ok())?;
    let timestamp = timestamp_for_backup();
    let result = HookConfigWriterService::restore_target(&target, &home, &timestamp)?;
    set_hook_target_enabled(state, &target_id, false)?;
    Ok(result)
}

fn find_hook_config_target(
    config: &AppConfig,
    target_id: &str,
) -> Result<HookConfigTarget, String> {
    config
        .hook_config_targets
        .iter()
        .find(|target| target.id == target_id)
        .cloned()
        .ok_or_else(|| format!("hook config target not found: {target_id}"))
}

fn set_hook_target_enabled(
    state: &AppState,
    target_id: &str,
    enabled: bool,
) -> Result<AppConfig, String> {
    let mut service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    let updated = HookConfigTargetService::apply_enablement(config, target_id, enabled)?;
    service.save_config(updated)
}

fn restore_conflicting_enabled_targets(
    state: &AppState,
    config: &AppConfig,
    target: &HookConfigTarget,
    home: &std::path::Path,
    timestamp: &str,
) -> Result<(), String> {
    for conflicting_target in config.hook_config_targets.iter().filter(|candidate| {
        candidate.enabled
            && candidate.id != target.id
            && candidate.source == target.source
            && match target.scope {
                HookConfigTargetScope::Global => candidate.scope == HookConfigTargetScope::Project,
                HookConfigTargetScope::Project => candidate.scope == HookConfigTargetScope::Global,
            }
    }) {
        HookConfigWriterService::restore_target(conflicting_target, home, timestamp)?;
        set_hook_target_enabled(state, &conflicting_target.id, false)?;
        tracing::info!(
            target_id = conflicting_target.id.as_str(),
            source = conflicting_target.source.as_str(),
            "conflicting hook target restored before enabling target"
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::test_support::{home_env_lock, hook_target_test_state};

    use super::{
        preview_hook_config_target_impl, preview_restore_hook_config_target_impl,
        restore_hook_config_target_impl, write_hook_config_target_impl,
    };

    #[test]
    fn preview_hook_config_target_returns_only_requested_target() {
        let (_root, state) = hook_target_test_state("preview-single");

        let preview = preview_hook_config_target_impl(&state, "global-codex".to_string(), false)
            .expect("target should preview");

        assert_eq!("global-codex", preview.target_id);
        assert_eq!("codex", preview.source);
        assert!(preview.config_path.ends_with(".codex/hooks.json"));
    }

    #[test]
    fn preview_hook_config_target_uses_installed_relay_path() {
        let (root, state) = hook_target_test_state("preview-relay-path");

        let preview = preview_hook_config_target_impl(&state, "global-codex".to_string(), false)
            .expect("target should preview");

        assert!(preview.preview_json.contains(&format!(
            "{} --source codex --event SessionStart",
            root.join(".cc-notice/bin/cc-notice-relay")
                .to_string_lossy()
        )));
    }

    #[test]
    fn preview_hook_config_target_uses_userprofile_when_home_missing() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let (root, state) = hook_target_test_state("preview-userprofile-home");
        let old_home = std::env::var_os("HOME");
        let old_userprofile = std::env::var_os("USERPROFILE");
        std::env::remove_var("HOME");
        std::env::set_var("USERPROFILE", &root);

        let preview = preview_hook_config_target_impl(&state, "global-codex".to_string(), false)
            .expect("target should preview from USERPROFILE");

        assert!(preview.config_path.ends_with(".codex/hooks.json"));
        restore_env("HOME", old_home);
        restore_env("USERPROFILE", old_userprofile);
    }

    #[test]
    fn preview_hook_config_target_passes_debug_option() {
        let (_root, state) = hook_target_test_state("preview-debug-option");

        let preview = preview_hook_config_target_impl(&state, "global-codex".to_string(), true)
            .expect("target should preview");

        assert!(preview.preview_json.contains("--debug"));
    }

    #[test]
    fn preview_restore_hook_config_target_returns_requested_target() {
        let (_root, state) = hook_target_test_state("preview-restore-single");

        let preview = preview_restore_hook_config_target_impl(&state, "global-codex".to_string())
            .expect("target should preview restore");

        assert_eq!("global-codex", preview.target_id);
        assert_eq!("codex", preview.source);
        assert!(preview.config_path.ends_with(".codex/hooks.json"));
    }

    #[test]
    fn preview_hook_config_target_rejects_unknown_target() {
        let (_root, state) = hook_target_test_state("preview-missing");

        assert_eq!(
            Err("hook config target not found: missing-target".to_string()),
            preview_hook_config_target_impl(&state, "missing-target".to_string(), false)
        );
    }

    #[test]
    fn write_hook_config_target_writes_only_requested_target() {
        let (root, state) = hook_target_test_state("write-single");

        let result = write_hook_config_target_impl(&state, "project-codex-test".to_string(), false)
            .expect("target should write");

        assert_eq!("project-codex-test", result.target_id);
        assert!(root
            .join("project-a")
            .join(".codex")
            .join("hooks.json")
            .exists());
        assert!(!root.join(".claude").join("settings.json").exists());
    }

    #[test]
    fn write_hook_config_target_marks_target_enabled_and_disables_conflicting_global() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let (_root, state) = hook_target_test_state("write-enables-project");
        let old_home = set_home_to_test_root(&_root);
        {
            let mut service = state.app_config_service.lock().unwrap();
            let mut config = service.config();
            let global = config
                .hook_config_targets
                .iter_mut()
                .find(|target| target.id == "global-codex")
                .expect("global target should exist");
            global.enabled = true;
            service
                .save_config(config)
                .expect("config state should be saved");
        }

        let result = write_hook_config_target_impl(&state, "project-codex-test".to_string(), false)
            .expect("project target should write");

        assert_eq!("project-codex-test", result.target_id);
        let config = state.app_config_service.lock().unwrap().config();
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "project-codex-test" && target.enabled));
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-codex" && !target.enabled));
        restore_home(old_home);
    }

    #[test]
    fn write_global_target_restores_conflicting_enabled_project_file() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let (root, state) = hook_target_test_state("write-global-restores-project");
        let old_home = set_home_to_test_root(&root);
        write_hook_config_target_impl(&state, "project-codex-test".to_string(), false)
            .expect("project target should write");
        let project_config = root.join("project-a").join(".codex").join("hooks.json");
        let before_restore =
            std::fs::read_to_string(&project_config).expect("project config should exist");
        assert!(before_restore.contains("cc-notice-relay"));

        write_hook_config_target_impl(&state, "global-codex".to_string(), false)
            .expect("global target should write");

        let after_restore =
            std::fs::read_to_string(&project_config).expect("project config should still exist");
        assert!(!after_restore.contains("cc-notice-relay"));
        let config = state.app_config_service.lock().unwrap().config();
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-codex" && target.enabled));
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "project-codex-test" && !target.enabled));
        restore_home(old_home);
    }

    #[test]
    fn write_project_target_restores_conflicting_enabled_global_file() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let (root, state) = hook_target_test_state("write-project-restores-global");
        let old_home = set_home_to_test_root(&root);
        write_hook_config_target_impl(&state, "global-codex".to_string(), false)
            .expect("global target should write");
        let global_config = root.join(".codex").join("hooks.json");
        let before_restore =
            std::fs::read_to_string(&global_config).expect("global config should exist");
        assert!(before_restore.contains("cc-notice-relay"));

        write_hook_config_target_impl(&state, "project-codex-test".to_string(), false)
            .expect("project target should write");

        let after_restore =
            std::fs::read_to_string(&global_config).expect("global config should still exist");
        assert!(!after_restore.contains("cc-notice-relay"));
        let config = state.app_config_service.lock().unwrap().config();
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "project-codex-test" && target.enabled));
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-codex" && !target.enabled));
        restore_home(old_home);
    }

    #[test]
    fn write_target_failure_keeps_restored_conflicting_target_disabled() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let (root, state) = hook_target_test_state("write-failure-disables-restored-conflict");
        let old_home = set_home_to_test_root(&root);
        write_hook_config_target_impl(&state, "project-codex-test".to_string(), false)
            .expect("project target should write");
        let global_config = root.join(".codex").join("hooks.json");
        std::fs::create_dir_all(global_config.parent().expect("global config parent"))
            .expect("global config dir should exist");
        std::fs::write(&global_config, "{ invalid json")
            .expect("global config should be corrupted for this test");

        let error = write_hook_config_target_impl(&state, "global-codex".to_string(), false)
            .expect_err("global write should fail when current config is invalid json");

        assert!(error.contains("failed to parse hook config json"));
        let config = state.app_config_service.lock().unwrap().config();
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "project-codex-test" && !target.enabled));
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-codex" && !target.enabled));
        restore_home(old_home);
    }

    #[test]
    fn write_target_failure_disables_already_restored_conflicts() {
        let _home_guard = home_env_lock().lock().expect("home env lock");
        let (root, state) = hook_target_test_state("write-failure-disables-partial-conflict");
        let old_home = set_home_to_test_root(&root);
        {
            let mut service = state.app_config_service.lock().unwrap();
            let mut config = service.config();
            let mut second_project = config
                .hook_config_targets
                .iter()
                .find(|target| target.id == "project-codex-test")
                .expect("project target should exist")
                .clone();
            second_project.id = "project-codex-broken".to_string();
            second_project.label = "project-b".to_string();
            second_project.project_path =
                Some(root.join("project-b").to_string_lossy().to_string());
            config.hook_config_targets.push(second_project);
            service
                .save_config(config)
                .expect("config state should be saved");
        }
        write_hook_config_target_impl(&state, "project-codex-test".to_string(), false)
            .expect("first project target should write");
        write_hook_config_target_impl(&state, "project-codex-broken".to_string(), false)
            .expect("second project target should write");
        let broken_config = root.join("project-b").join(".codex").join("hooks.json");
        std::fs::write(&broken_config, "{ invalid json")
            .expect("second project config should be corrupted for this test");

        let error = write_hook_config_target_impl(&state, "global-codex".to_string(), false)
            .expect_err("global write should fail while restoring second conflict");

        assert!(error.contains("failed to parse hook config json"));
        let config = state.app_config_service.lock().unwrap().config();
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "project-codex-test" && !target.enabled));
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "project-codex-broken" && target.enabled));
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-codex" && !target.enabled));
        restore_home(old_home);
    }

    #[test]
    fn restore_hook_config_target_marks_target_disabled() {
        let (_root, state) = hook_target_test_state("restore-disables-target");
        write_hook_config_target_impl(&state, "project-codex-test".to_string(), false)
            .expect("project target should write");

        let result = restore_hook_config_target_impl(&state, "project-codex-test".to_string())
            .expect("project target should restore");

        assert_eq!("project-codex-test", result.target_id);
        let config = state.app_config_service.lock().unwrap().config();
        assert!(config
            .hook_config_targets
            .iter()
            .any(|target| target.id == "project-codex-test" && !target.enabled));
    }

    fn set_home_to_test_root(root: &std::path::Path) -> Option<std::ffi::OsString> {
        let old_home = std::env::var_os("HOME");
        std::env::set_var("HOME", root);
        old_home
    }

    fn restore_home(old_home: Option<std::ffi::OsString>) {
        if let Some(home) = old_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }
    }

    fn restore_env(name: &str, value: Option<std::ffi::OsString>) {
        if let Some(value) = value {
            std::env::set_var(name, value);
        } else {
            std::env::remove_var(name);
        }
    }
}
