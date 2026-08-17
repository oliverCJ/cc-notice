use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::app_services::custom_mascot_service::{
    scan_custom_mascot_packs, CustomMascotScanResult,
};
use crate::app_services::desktop_notice_service::{
    DesktopNoticeService, DesktopNoticeWindowPayload,
};
use crate::app_services::output_executor::DesktopNoticeOutputRequest;
use crate::core::desktop_notice::{
    desktop_notice_animation_period_range, validate_desktop_notice_appearance,
    validate_desktop_notice_instances, DesktopMascotPlayMode, DesktopMascotState,
    DesktopNoticeAppearance, DesktopNoticeColorMode, DesktopNoticeColorStop,
    DesktopNoticeConfigError, DesktopNoticeEdge, DesktopNoticeErrorCode, DesktopNoticeInstance,
    DesktopNoticePresetPosition, DesktopNoticeRestoreBehavior, DesktopNoticeRuleEffect,
    DesktopNoticeVariant, DESKTOP_MASCOT_MAX_PLAYBACK_WINDOW_MS,
    DESKTOP_MASCOT_MIN_PLAYBACK_WINDOW_MS, DESKTOP_NOTICE_MAX_BRIGHTNESS_PERCENT,
    DESKTOP_NOTICE_MAX_OPACITY_PERCENT, DESKTOP_NOTICE_MAX_RULE_DURATION_MS,
    DESKTOP_NOTICE_MIN_BRIGHTNESS_PERCENT, DESKTOP_NOTICE_MIN_OPACITY_PERCENT,
    DESKTOP_NOTICE_MIN_RULE_DURATION_MS,
};
use crate::core::profiles::{HardwareOutputType, NoticeProfile};
use crate::AppState;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDesktopNoticeInstanceRequest {
    pub instance_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeInstanceRequest {
    pub instance_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeRuleEffectPreviewRequest {
    pub target_id: String,
    pub effect: DesktopNoticeRuleEffect,
    pub color_mode: DesktopNoticeColorMode,
    pub colors: Vec<DesktopNoticeColorStop>,
    pub duration_ms: u32,
    #[serde(default)]
    pub animation_period_ms: Option<u32>,
    #[serde(default)]
    pub breathing_period_ms: Option<u32>,
    #[serde(default)]
    pub opacity_percent: Option<u8>,
    #[serde(default)]
    pub brightness_percent: Option<u8>,
    pub restore_behavior: DesktopNoticeRestoreBehavior,
    #[serde(default)]
    pub edge: Option<DesktopNoticeEdge>,
    #[serde(default)]
    pub mascot_state: Option<DesktopMascotState>,
    #[serde(default)]
    pub mascot_action_id: Option<String>,
    #[serde(default)]
    pub mascot_play_mode: Option<DesktopMascotPlayMode>,
    #[serde(default)]
    pub mascot_playback_window_ms: Option<u32>,
    #[serde(default)]
    pub mascot_bubble_text: Option<String>,
}

#[tauri::command]
pub fn desktop_notice_instances(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DesktopNoticeInstance>, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(service.config().desktop_notice_instances)
}

#[tauri::command]
pub async fn desktop_mascot_asset_packs() -> Result<CustomMascotScanResult, String> {
    tauri::async_runtime::spawn_blocking(scan_custom_mascot_packs)
        .await
        .map_err(|error| format!("desktop mascot asset scan task failed: {error}"))?
}

#[tauri::command]
pub fn save_desktop_notice_instance(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    instance: DesktopNoticeInstance,
) -> Result<Vec<DesktopNoticeInstance>, String> {
    let normalized_instance = normalize_instance(instance);
    let (saved_instances, saved_instance) = {
        let mut service = state
            .app_config_service
            .lock()
            .map_err(|error| error.to_string())?;
        let mut config = service.config();
        let mut next_instances = config.desktop_notice_instances.clone();

        if let Some(existing) = next_instances
            .iter_mut()
            .find(|item| item.id == normalized_instance.id)
        {
            *existing = normalized_instance.clone();
        } else {
            next_instances.push(normalized_instance.clone());
        }

        validate_desktop_notice_instances(&next_instances).map_err(|error| error.code_string())?;
        config.desktop_notice_instances = next_instances;
        let saved_config = service.save_config(config)?;
        let saved_instance = saved_config
            .desktop_notice_instances
            .iter()
            .find(|item| item.id == normalized_instance.id)
            .cloned()
            .ok_or_else(|| stable_error_code(DesktopNoticeErrorCode::TargetNotFound))?;
        (saved_config.desktop_notice_instances, saved_instance)
    };
    let desktop_notice_service = clone_desktop_notice_service(&state)?;
    desktop_notice_service.update_preview_if_open(&app, &saved_instance)?;
    tracing::info!(
        count = saved_instances.len(),
        "desktop notice instance saved"
    );
    Ok(saved_instances)
}

#[tauri::command]
pub fn delete_desktop_notice_instance(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: DeleteDesktopNoticeInstanceRequest,
) -> Result<Vec<DesktopNoticeInstance>, String> {
    let profiles = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?
        .list_profiles()?;
    if desktop_notice_instance_is_referenced(&request.instance_id, &profiles) {
        return Err(stable_error_code(DesktopNoticeErrorCode::TargetInUse));
    }
    let saved_instances = {
        let mut service = state
            .app_config_service
            .lock()
            .map_err(|error| error.to_string())?;
        let mut config = service.config();
        let before_len = config.desktop_notice_instances.len();
        config
            .desktop_notice_instances
            .retain(|instance| instance.id != request.instance_id);
        if config.desktop_notice_instances.len() == before_len {
            return Err(stable_error_code(DesktopNoticeErrorCode::TargetNotFound));
        }
        let saved_config = service.save_config(config)?;
        saved_config.desktop_notice_instances
    };
    let desktop_notice_service = clone_desktop_notice_service(&state)?;
    if let Err(error) = desktop_notice_service.destroy_preview(&app, &request.instance_id) {
        // 配置删除已经落盘，窗口销毁失败只记录日志，避免让前端状态回滚到已删除实例。
        tracing::warn!(
            instance_id = request.instance_id,
            error,
            "desktop notice instance deleted but preview window destroy failed"
        );
    }
    tracing::info!(
        instance_id = request.instance_id,
        count = saved_instances.len(),
        "desktop notice instance deleted"
    );
    Ok(saved_instances)
}

#[tauri::command]
pub async fn preview_desktop_notice_instance(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: DesktopNoticeInstanceRequest,
) -> Result<DesktopNoticeWindowPayload, String> {
    let instance = desktop_notice_instance_by_id(&state, &request.instance_id)?;
    let desktop_notice_service = clone_desktop_notice_service(&state)?;
    run_desktop_notice_window_task("desktop notice preview", move || {
        desktop_notice_service.open_preview(&app, &instance)
    })
    .await
}

#[tauri::command]
pub async fn preview_desktop_notice_rule_effect(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: DesktopNoticeRuleEffectPreviewRequest,
) -> Result<(), String> {
    let instance = desktop_notice_instance_by_id(&state, &request.target_id)?;
    if !instance.enabled {
        return Err(stable_error_code(DesktopNoticeErrorCode::TargetDisabled));
    }
    let output_request = rule_effect_preview_request_to_output_request(request)?;
    let desktop_notice_service = clone_desktop_notice_service(&state)?;
    run_desktop_notice_window_task("desktop notice rule preview", move || {
        desktop_notice_service.preview_rule_effect(&app, &instance, output_request)
    })
    .await
}

#[tauri::command]
pub fn hide_desktop_notice_instance(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: DesktopNoticeInstanceRequest,
) -> Result<(), String> {
    let desktop_notice_service = clone_desktop_notice_service(&state)?;
    desktop_notice_service.hide_preview(&app, &request.instance_id)
}

#[tauri::command]
pub fn desktop_notice_window_payload(
    state: tauri::State<'_, AppState>,
    request: DesktopNoticeInstanceRequest,
) -> Result<DesktopNoticeWindowPayload, String> {
    let instance = desktop_notice_instance_by_id(&state, &request.instance_id)?;
    let desktop_notice_service = clone_desktop_notice_service(&state)?;
    Ok(desktop_notice_service.window_payload_for_instance(&instance, true))
}

#[tauri::command]
pub fn save_desktop_notice_window_bounds(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: DesktopNoticeInstanceRequest,
) -> Result<Vec<DesktopNoticeInstance>, String> {
    let desktop_notice_service = clone_desktop_notice_service(&state)?;
    let bounds = desktop_notice_service.current_window_bounds(&app, &request.instance_id)?;
    let mut service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = service.config();
    let instance = config
        .desktop_notice_instances
        .iter_mut()
        .find(|instance| instance.id == request.instance_id)
        .ok_or_else(|| stable_error_code(DesktopNoticeErrorCode::TargetNotFound))?;
    apply_saved_window_bounds(instance, bounds);
    validate_desktop_notice_instances(&config.desktop_notice_instances)
        .map_err(|error| error.code_string())?;
    let saved_config = service.save_config(config)?;
    Ok(saved_config.desktop_notice_instances)
}

fn normalize_instance(mut instance: DesktopNoticeInstance) -> DesktopNoticeInstance {
    instance.id = instance.id.trim().to_string();
    instance.name = instance.name.trim().to_string();
    match instance.variant {
        DesktopNoticeVariant::CustomLightbar => {
            instance.edge_lightbar = None;
            instance.mascot = None;
        }
        DesktopNoticeVariant::EdgeLightbar => {
            instance.custom_lightbar = None;
            instance.mascot = None;
        }
        DesktopNoticeVariant::Mascot => {
            instance.custom_lightbar = None;
            instance.edge_lightbar = None;
            if instance.mascot.is_none() {
                instance.mascot = Some(Default::default());
            }
        }
    }
    instance
}

fn apply_saved_window_bounds(
    instance: &mut DesktopNoticeInstance,
    bounds: crate::core::desktop_notice::DesktopNoticeBounds,
) {
    match instance.variant {
        DesktopNoticeVariant::CustomLightbar => {
            if let Some(settings) = instance.custom_lightbar.as_mut() {
                settings.size.width = bounds.width;
                settings.size.height = bounds.height;
                settings.bounds_override = Some(bounds);
                settings.preset_position = DesktopNoticePresetPosition::Custom;
            }
        }
        DesktopNoticeVariant::Mascot => {
            if let Some(settings) = instance.mascot.as_mut() {
                settings.stage_size.width = bounds.width;
                settings.stage_size.height = bounds.height;
                settings.bounds_override = Some(bounds);
                settings.preset_position = DesktopNoticePresetPosition::Custom;
            }
        }
        DesktopNoticeVariant::EdgeLightbar => {}
    }
}

fn desktop_notice_instance_by_id(
    state: &tauri::State<'_, AppState>,
    instance_id: &str,
) -> Result<DesktopNoticeInstance, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    service
        .config()
        .desktop_notice_instances
        .into_iter()
        .find(|instance| instance.id == instance_id)
        .ok_or_else(|| stable_error_code(DesktopNoticeErrorCode::TargetNotFound))
}

fn clone_desktop_notice_service(
    state: &tauri::State<'_, AppState>,
) -> Result<DesktopNoticeService, String> {
    state
        .desktop_notice_service
        .lock()
        .map_err(|error| error.to_string())
        .map(|service| service.clone())
}

async fn run_desktop_notice_window_task<T, F>(
    task_name: &'static str,
    operation: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    // Windows WebView2 在同步 command 或事件线程创建窗口会死锁，窗口操作必须移到独立线程。
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|error| {
            tracing::warn!(task_name, error = %error, "desktop notice window task join failed");
            format!("{task_name} task failed: {error}")
        })?
}

fn stable_error_code(code: DesktopNoticeErrorCode) -> String {
    DesktopNoticeConfigError {
        code,
        detail: String::new(),
    }
    .code_string()
}

fn desktop_notice_instance_is_referenced(instance_id: &str, profiles: &[NoticeProfile]) -> bool {
    profiles.iter().any(|profile| {
        profile.hardware_rules.iter().any(|rule| {
            rule.output.output_type == HardwareOutputType::DesktopNotice
                && rule
                    .output
                    .desktop_notice_targets
                    .iter()
                    .any(|target| target.target_id == instance_id)
        })
    })
}

fn rule_effect_preview_request_to_output_request(
    request: DesktopNoticeRuleEffectPreviewRequest,
) -> Result<DesktopNoticeOutputRequest, String> {
    if request.target_id.trim().is_empty() {
        return Err(stable_error_code(DesktopNoticeErrorCode::TargetNotFound));
    }
    if !(DESKTOP_NOTICE_MIN_RULE_DURATION_MS..=DESKTOP_NOTICE_MAX_RULE_DURATION_MS)
        .contains(&request.duration_ms)
    {
        return Err(stable_error_code(DesktopNoticeErrorCode::InvalidRule));
    }
    if let Some(animation_period_ms) = request.animation_period_ms.or(request.breathing_period_ms) {
        if let Some((min, max)) = desktop_notice_animation_period_range(request.effect) {
            if !(min..=max).contains(&animation_period_ms) {
                return Err(stable_error_code(DesktopNoticeErrorCode::InvalidRule));
            }
        } else if request.animation_period_ms.is_some() {
            return Err(stable_error_code(DesktopNoticeErrorCode::InvalidRule));
        }
    }
    if let Some(opacity_percent) = request.opacity_percent {
        if !(DESKTOP_NOTICE_MIN_OPACITY_PERCENT..=DESKTOP_NOTICE_MAX_OPACITY_PERCENT)
            .contains(&opacity_percent)
        {
            return Err(stable_error_code(DesktopNoticeErrorCode::InvalidRule));
        }
    }
    if let Some(brightness_percent) = request.brightness_percent {
        if !(DESKTOP_NOTICE_MIN_BRIGHTNESS_PERCENT..=DESKTOP_NOTICE_MAX_BRIGHTNESS_PERCENT)
            .contains(&brightness_percent)
        {
            return Err(stable_error_code(DesktopNoticeErrorCode::InvalidRule));
        }
    }
    if let Some(playback_window_ms) = request.mascot_playback_window_ms {
        if is_once_mascot_play_mode(request.mascot_play_mode)
            && !(DESKTOP_MASCOT_MIN_PLAYBACK_WINDOW_MS..=DESKTOP_MASCOT_MAX_PLAYBACK_WINDOW_MS)
                .contains(&playback_window_ms)
        {
            return Err(stable_error_code(DesktopNoticeErrorCode::InvalidRule));
        }
    }
    validate_desktop_notice_appearance(&DesktopNoticeAppearance {
        color_mode: request.color_mode,
        colors: request.colors.clone(),
    })
    .map_err(|error| error.code_string())?;

    Ok(DesktopNoticeOutputRequest {
        rule_id: "desktop-notice-rule-preview".to_string(),
        target_id: request.target_id,
        effect: request.effect,
        color_mode: request.color_mode,
        colors: request.colors,
        duration_ms: request.duration_ms,
        animation_period_ms: request.animation_period_ms,
        breathing_period_ms: request.breathing_period_ms,
        opacity_percent: request.opacity_percent,
        brightness_percent: request.brightness_percent,
        restore_behavior: request.restore_behavior,
        edge: request.edge,
        mascot_state: request.mascot_state,
        mascot_action_id: request.mascot_action_id,
        mascot_play_mode: request.mascot_play_mode,
        mascot_playback_window_ms: request.mascot_playback_window_ms,
        mascot_bubble_text: request.mascot_bubble_text,
    })
}

fn is_once_mascot_play_mode(play_mode: Option<DesktopMascotPlayMode>) -> bool {
    matches!(
        play_mode,
        Some(DesktopMascotPlayMode::OnceThenHold | DesktopMascotPlayMode::OnceThenIdle)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::desktop_notice::{
        DesktopNoticeBounds, DesktopNoticeColorStop, DesktopNoticeInstance,
    };
    use crate::core::profiles::{
        DesktopNoticeRuleTarget, HardwareOutput, HardwareOutputType, HardwareRule, NoticeProfile,
    };

    #[test]
    fn desktop_notice_window_task_runs_on_blocking_worker() {
        let caller_thread = std::thread::current().id();

        let worker_thread = tauri::async_runtime::block_on(run_desktop_notice_window_task(
            "test desktop notice window task",
            || Ok(std::thread::current().id()),
        ))
        .expect("desktop notice window task should finish");

        assert_ne!(caller_thread, worker_thread);
    }

    #[test]
    fn applying_saved_window_bounds_marks_position_as_custom() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "顶部提示");

        apply_saved_window_bounds(
            &mut instance,
            DesktopNoticeBounds {
                x: 120,
                y: 160,
                width: 640,
                height: 40,
                source_work_area: None,
            },
        );

        let settings = instance
            .custom_lightbar
            .expect("custom lightbar settings should exist");
        assert_eq!(
            DesktopNoticePresetPosition::Custom,
            settings.preset_position
        );
        assert_eq!(640, settings.size.width);
        assert_eq!(40, settings.size.height);
        assert_eq!(
            Some(DesktopNoticeBounds {
                x: 120,
                y: 160,
                width: 640,
                height: 40,
                source_work_area: None,
            }),
            settings.bounds_override
        );
    }

    #[test]
    fn applying_saved_window_bounds_marks_mascot_position_as_custom() {
        let mut instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");

        apply_saved_window_bounds(
            &mut instance,
            DesktopNoticeBounds {
                x: 240,
                y: 180,
                width: 320,
                height: 280,
                source_work_area: None,
            },
        );

        let settings = instance.mascot.expect("mascot settings should exist");
        assert_eq!(
            DesktopNoticePresetPosition::Custom,
            settings.preset_position
        );
        assert_eq!(
            Some(DesktopNoticeBounds {
                x: 240,
                y: 180,
                width: 320,
                height: 280,
                source_work_area: None,
            }),
            settings.bounds_override
        );
        assert_eq!(320, settings.stage_size.width);
        assert_eq!(280, settings.stage_size.height);
    }

    #[test]
    fn rule_effect_preview_request_maps_to_desktop_notice_output_request() {
        let request =
            rule_effect_preview_request_to_output_request(DesktopNoticeRuleEffectPreviewRequest {
                target_id: "notice-main".to_string(),
                effect: DesktopNoticeRuleEffect::EdgeBreathing,
                color_mode: DesktopNoticeColorMode::Solid,
                colors: vec![DesktopNoticeColorStop {
                    color: "#EF4444".to_string(),
                    position: 0,
                }],
                duration_ms: 2600,
                animation_period_ms: Some(2400),
                breathing_period_ms: Some(1600),
                opacity_percent: Some(85),
                brightness_percent: Some(95),
                restore_behavior: DesktopNoticeRestoreBehavior::UseInstanceIdle,
                edge: Some(DesktopNoticeEdge::Top),
                mascot_state: None,
                mascot_action_id: None,
                mascot_play_mode: Some(DesktopMascotPlayMode::OnceThenIdle),
                mascot_playback_window_ms: Some(2600),
                mascot_bubble_text: None,
            })
            .expect("preview request should map");

        assert_eq!("desktop-notice-rule-preview", request.rule_id);
        assert_eq!("notice-main", request.target_id);
        assert_eq!(DesktopNoticeRuleEffect::EdgeBreathing, request.effect);
        assert_eq!(Some(85), request.opacity_percent);
        assert_eq!(Some(95), request.brightness_percent);
        assert_eq!(Some(2400), request.animation_period_ms);
        assert_eq!(
            Some(DesktopMascotPlayMode::OnceThenIdle),
            request.mascot_play_mode
        );
        assert_eq!(Some(2600), request.mascot_playback_window_ms);
    }

    #[test]
    fn rule_effect_preview_request_rejects_invalid_duration() {
        let error =
            rule_effect_preview_request_to_output_request(DesktopNoticeRuleEffectPreviewRequest {
                target_id: "notice-main".to_string(),
                effect: DesktopNoticeRuleEffect::Solid,
                color_mode: DesktopNoticeColorMode::Solid,
                colors: vec![DesktopNoticeColorStop {
                    color: "#22C55E".to_string(),
                    position: 0,
                }],
                duration_ms: 0,
                animation_period_ms: None,
                breathing_period_ms: None,
                opacity_percent: None,
                brightness_percent: None,
                restore_behavior: DesktopNoticeRestoreBehavior::UseInstanceIdle,
                edge: None,
                mascot_state: None,
                mascot_action_id: None,
                mascot_play_mode: None,
                mascot_playback_window_ms: None,
                mascot_bubble_text: None,
            })
            .expect_err("invalid duration should fail");

        assert_eq!(
            stable_error_code(DesktopNoticeErrorCode::InvalidRule),
            error
        );
    }

    #[test]
    fn detects_desktop_notice_instance_referenced_by_output_rule() {
        let mut profile = NoticeProfile::daily_coding();
        profile.hardware_rules.clear();
        profile.hardware_rules.push(HardwareRule {
            id: "rule-1".to_string(),
            internal_event: "agent.completed".to_string(),
            output: HardwareOutput {
                output_type: HardwareOutputType::DesktopNotice,
                channel_actions: Vec::new(),
                duration_ms: None,
                text: None,
                notification_level: None,
                notification_title: None,
                notification_body: None,
                notification_title_max_chars: None,
                notification_body_max_chars: None,
                notification_throttle_seconds: None,
                notification_sound: None,
                webhook_method: None,
                webhook_url: None,
                webhook_headers: None,
                webhook_body: None,
                webhook_body_max_chars: None,
                sound_file_path: None,
                sound_volume_percent: None,
                sound_max_duration_ms: None,
                sound_throttle_seconds: None,
                display_device_id: None,
                display_template_id: None,
                display_accent: None,
                display_icon: None,
                display_lines_template: None,
                display_status: None,
                display_title_template: None,
                display_message_template: None,
                display_title_max_chars: None,
                display_message_max_chars: None,
                display_expire_behavior: None,
                desktop_notice_targets: vec![DesktopNoticeRuleTarget {
                    target_id: "notice-main".to_string(),
                    effect: DesktopNoticeRuleEffect::EdgeBreathing,
                    color_mode: DesktopNoticeColorMode::Solid,
                    colors: vec![DesktopNoticeColorStop {
                        color: "#22C55E".to_string(),
                        position: 0,
                    }],
                    duration_ms: 3000,
                    animation_period_ms: Some(1600),
                    breathing_period_ms: None,
                    opacity_percent: Some(100),
                    brightness_percent: Some(100),
                    restore_behavior: DesktopNoticeRestoreBehavior::UseInstanceIdle,
                    edge: Some(DesktopNoticeEdge::Bottom),
                    mascot_state: None,
                    mascot_action_id: None,
                    mascot_play_mode: None,
                    mascot_playback_window_ms: None,
                    mascot_bubble_template: None,
                }],
            },
            priority: 1,
            enabled: true,
        });

        assert!(desktop_notice_instance_is_referenced(
            "notice-main",
            &[profile]
        ));
        assert!(!desktop_notice_instance_is_referenced("unused", &[]));
    }
}
