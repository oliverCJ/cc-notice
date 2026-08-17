use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::async_runtime::JoinHandle;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

use crate::app_services::custom_mascot_service::{resolve_custom_mascot_pack, CustomMascotPack};
use crate::app_services::output_executor::DesktopNoticeOutputRequest;
use crate::core::desktop_notice::{
    CustomLightbarSettings, DesktopMascotPlayMode, DesktopMascotState, DesktopNoticeAppearance,
    DesktopNoticeBounds, DesktopNoticeConfigError, DesktopNoticeDefaultState,
    DesktopNoticeDefaultStateConfig, DesktopNoticeDirection, DesktopNoticeEdge,
    DesktopNoticeErrorCode, DesktopNoticeIdleBehavior, DesktopNoticeInstance,
    DesktopNoticePresetPosition, DesktopNoticeRestoreBehavior, DesktopNoticeRuleEffect,
    DesktopNoticeSize, DesktopNoticeVariant, DesktopNoticeWorkArea, EdgeLightbarSettings,
    MascotSettings,
};

const DESKTOP_NOTICE_WINDOW_PREFIX: &str = "desktop-notice:";
const DESKTOP_NOTICE_ROUTE_PREFIX: &str = "/?desktopNoticeInstanceId=";
const DESKTOP_MASCOT_STARTUP_GREETING_DURATION_MS: u64 = 2200;
const DESKTOP_MASCOT_PREVIEW_BUBBLE_TEXT: &str = "预览气泡";
pub const DESKTOP_NOTICE_PREVIEW_UPDATED_EVENT: &str = "cc-notice://desktop-notice-preview-updated";

#[derive(Debug, Clone, Default)]
pub struct DesktopNoticeService {
    restore_tokens: Arc<Mutex<HashMap<String, u64>>>,
    restore_tasks: Arc<Mutex<HashMap<String, JoinHandle<()>>>>,
    window_payloads: Arc<Mutex<HashMap<String, DesktopNoticeWindowPayload>>>,
    next_restore_token: Arc<AtomicU64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeWindowPayload {
    pub instance_id: String,
    pub name: String,
    pub variant: DesktopNoticeVariant,
    pub direction: DesktopNoticeDirection,
    pub default_state: DesktopNoticeDefaultState,
    pub size: DesktopNoticeSize,
    pub opacity_percent: u8,
    pub corner_radius_percent: u8,
    pub idle_behavior: DesktopNoticeIdleBehavior,
    pub default_state_config: crate::core::desktop_notice::DesktopNoticeDefaultStateConfig,
    pub appearance: DesktopNoticeAppearance,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effect: Option<crate::core::desktop_notice::DesktopNoticeRuleEffect>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge: Option<DesktopNoticeEdge>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub animation_period_ms: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breathing_period_ms: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity_override_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brightness_override_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_lightbar: Option<CustomLightbarSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge_lightbar: Option<EdgeLightbarSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mascot: Option<MascotSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_mascot_pack: Option<CustomMascotPack>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mascot_state: Option<DesktopMascotState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mascot_action_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mascot_play_mode: Option<DesktopMascotPlayMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mascot_playback_window_ms: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mascot_bubble_text: Option<String>,
    #[serde(default)]
    pub preview_mode: bool,
}

impl DesktopNoticeService {
    pub fn open_startup_instances(&self, app: &AppHandle, instances: &[DesktopNoticeInstance]) {
        for instance in instances {
            if !should_show_on_startup(instance) {
                continue;
            }
            if let Err(error) = self.open_startup_window(app, instance) {
                tracing::warn!(
                    instance_id = instance.id,
                    error,
                    "failed to open startup desktop notice window"
                );
            }
        }
    }

    fn open_startup_window(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
    ) -> Result<DesktopNoticeWindowPayload, String> {
        let payload = Self::startup_idle_payload(instance);
        self.open_or_update_window(app, instance, &payload, false)?;
        if instance.variant == DesktopNoticeVariant::Mascot {
            self.schedule_startup_mascot_idle_restore(app, instance);
        }
        Ok(payload)
    }

    pub fn open_preview(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
    ) -> Result<DesktopNoticeWindowPayload, String> {
        let payload = Self::payload_for_instance(instance, true);
        self.open_or_update_window(app, instance, &payload, true)?;
        Ok(payload)
    }

    pub fn apply_rule_effect(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
        request: DesktopNoticeOutputRequest,
    ) -> Result<(), String> {
        let payload = DesktopNoticeWindowPayload {
            appearance: DesktopNoticeAppearance {
                color_mode: request.color_mode,
                colors: request.colors.clone(),
            },
            effect: Some(request.effect),
            edge: request.edge,
            duration_ms: Some(request.duration_ms),
            animation_period_ms: request.animation_period_ms,
            breathing_period_ms: request.breathing_period_ms,
            opacity_override_percent: request.opacity_percent,
            brightness_override_percent: request.brightness_percent,
            mascot_state: request.mascot_state,
            mascot_action_id: request.mascot_action_id.clone(),
            mascot_play_mode: request.mascot_play_mode,
            mascot_playback_window_ms: request.mascot_playback_window_ms,
            mascot_bubble_text: request.mascot_bubble_text.clone(),
            ..Self::payload_for_instance(instance, false)
        };
        self.open_or_update_window(app, instance, &payload, false)?;
        self.schedule_end_behavior(app, instance, request);
        Ok(())
    }

    pub fn preview_rule_effect(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
        request: DesktopNoticeOutputRequest,
    ) -> Result<(), String> {
        let payload = DesktopNoticeWindowPayload {
            appearance: DesktopNoticeAppearance {
                color_mode: request.color_mode,
                colors: request.colors.clone(),
            },
            effect: Some(request.effect),
            edge: request.edge,
            duration_ms: Some(request.duration_ms),
            animation_period_ms: request.animation_period_ms,
            breathing_period_ms: request.breathing_period_ms,
            opacity_override_percent: request.opacity_percent,
            brightness_override_percent: request.brightness_percent,
            mascot_state: request.mascot_state,
            mascot_action_id: request.mascot_action_id.clone(),
            mascot_play_mode: request.mascot_play_mode,
            mascot_playback_window_ms: request.mascot_playback_window_ms,
            mascot_bubble_text: request.mascot_bubble_text.clone(),
            preview_mode: true,
            ..Self::payload_for_instance(instance, true)
        };
        self.open_or_update_window(app, instance, &payload, true)?;
        self.schedule_end_behavior(app, instance, request);
        Ok(())
    }

    fn open_or_update_window(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
        payload: &DesktopNoticeWindowPayload,
        focus: bool,
    ) -> Result<(), String> {
        self.store_window_payload(&instance.id, payload.clone());
        let label = desktop_notice_window_label(&instance.id);
        if let Some(window) = app.get_webview_window(&label) {
            apply_window_state(app, &window, instance).map_err(|error| {
                tracing::warn!(
                    instance_id = instance.id,
                    error = %error,
                    "failed to update desktop notice preview window state"
                );
                error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
            })?;
            if let Err(error) = window.show() {
                tracing::warn!(
                    instance_id = instance.id,
                    error = %error,
                    "failed to show desktop notice preview window"
                );
                return Err(error_code(DesktopNoticeErrorCode::WindowUpdateFailed));
            }
            if window_should_focus(instance, focus) {
                if let Err(error) = window.set_focus() {
                    tracing::warn!(
                        instance_id = instance.id,
                        error = %error,
                        "failed to focus desktop notice preview window"
                    );
                }
            }
            emit_preview_payload(app, &label, payload);
            return Ok(());
        }

        let route = desktop_notice_window_route(&instance.id);
        let initial_size = initial_window_size(app, instance);
        let bootstrap_script = desktop_notice_bootstrap_script(payload)?;
        let builder = WebviewWindowBuilder::new(app, label.clone(), WebviewUrl::App(route.into()))
            .title(format!("CC Notice - {}", instance.name))
            .initialization_script(bootstrap_script)
            .decorations(false)
            .transparent(true)
            .background_color(tauri::utils::config::Color(0, 0, 0, 0))
            .always_on_top(instance.always_on_top)
            .shadow(false)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .inner_size(initial_size.width as f64, initial_size.height as f64)
            .min_inner_size(10.0, 10.0);

        let window = builder.build().map_err(|error| {
            tracing::warn!(
                instance_id = instance.id,
                error = %error,
                "failed to create desktop notice preview window"
            );
            error_code(DesktopNoticeErrorCode::WindowCreateFailed)
        })?;
        apply_window_state(app, &window, instance).map_err(|error| {
            tracing::warn!(
                instance_id = instance.id,
                error = %error,
                "failed to apply desktop notice preview window bounds"
            );
            if let Err(destroy_error) = window.destroy() {
                tracing::warn!(
                    instance_id = instance.id,
                    error = %destroy_error,
                    "failed to destroy desktop notice preview window after state apply failure"
                );
            }
            error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
        })?;
        if let Err(error) = window.show() {
            tracing::warn!(
                instance_id = instance.id,
                error = %error,
                "failed to show desktop notice preview window after state apply"
            );
            if let Err(destroy_error) = window.destroy() {
                tracing::warn!(
                    instance_id = instance.id,
                    error = %destroy_error,
                    "failed to destroy desktop notice preview window after show failure"
                );
            }
            return Err(error_code(DesktopNoticeErrorCode::WindowUpdateFailed));
        }
        if window_should_focus(instance, focus) {
            if let Err(error) = window.set_focus() {
                tracing::warn!(
                    instance_id = instance.id,
                    error = %error,
                    "failed to focus desktop notice preview window"
                );
            }
        }
        emit_preview_payload(app, &label, payload);
        Ok(())
    }

    pub fn hide_preview(&self, app: &AppHandle, instance_id: &str) -> Result<(), String> {
        let label = desktop_notice_window_label(instance_id);
        if let Some(window) = app.get_webview_window(&label) {
            window.hide().map_err(|error| {
                tracing::warn!(
                    instance_id,
                    error = %error,
                    "failed to hide desktop notice preview window"
                );
                error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
            })?;
        }
        self.clear_window_payload(instance_id);
        Ok(())
    }

    pub fn update_preview_if_open(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
    ) -> Result<(), String> {
        let label = desktop_notice_window_label(&instance.id);
        let Some(window) = app.get_webview_window(&label) else {
            return Ok(());
        };
        apply_window_state(app, &window, instance).map_err(|error| {
            tracing::warn!(
                instance_id = instance.id,
                error = %error,
                "failed to update open desktop notice preview window"
            );
            error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
        })?;
        emit_preview_payload(app, &label, &Self::payload_for_instance(instance, true));
        Ok(())
    }

    pub fn destroy_preview(&self, app: &AppHandle, instance_id: &str) -> Result<(), String> {
        let label = desktop_notice_window_label(instance_id);
        if let Some(window) = app.get_webview_window(&label) {
            window.destroy().map_err(|error| {
                tracing::warn!(
                    instance_id,
                    error = %error,
                    "failed to destroy desktop notice preview window"
                );
                error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
            })?;
        }
        self.clear_window_payload(instance_id);
        Ok(())
    }

    pub fn current_window_bounds(
        &self,
        app: &AppHandle,
        instance_id: &str,
    ) -> Result<DesktopNoticeBounds, String> {
        let label = desktop_notice_window_label(instance_id);
        let window = app
            .get_webview_window(&label)
            .ok_or_else(|| error_code(DesktopNoticeErrorCode::TargetNotFound))?;
        let position = window.outer_position().map_err(|error| {
            tracing::warn!(
                instance_id,
                error = %error,
                "failed to read desktop notice window position"
            );
            error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
        })?;
        let size = window.inner_size().map_err(|error| {
            tracing::warn!(
                instance_id,
                error = %error,
                "failed to read desktop notice window size"
            );
            error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
        })?;
        let bounds = DesktopNoticeBounds {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            source_work_area: None,
        };
        let Some(monitor) = app.primary_monitor().ok().flatten() else {
            return Ok(bounds);
        };
        let work_area = monitor.work_area();
        let current_work_area = WorkArea {
            x: work_area.position.x,
            y: work_area.position.y,
            width: work_area.size.width,
            height: work_area.size.height,
        };
        let mut clamped_bounds = clamp_bounds_to_work_area(bounds, current_work_area);
        clamped_bounds.source_work_area = Some(current_work_area.into());
        Ok(clamped_bounds)
    }

    pub fn payload_for_instance(
        instance: &DesktopNoticeInstance,
        preview_mode: bool,
    ) -> DesktopNoticeWindowPayload {
        DesktopNoticeWindowPayload {
            instance_id: instance.id.clone(),
            name: instance.name.clone(),
            variant: instance.variant,
            direction: instance_direction(instance),
            default_state: DesktopNoticeDefaultState::Hidden,
            size: instance_window_size(instance),
            opacity_percent: instance_opacity_percent(instance),
            corner_radius_percent: instance_corner_radius_percent(instance),
            idle_behavior: instance.idle_behavior,
            default_state_config: dim_state_config(),
            appearance: neutral_placeholder_appearance(),
            effect: None,
            edge: None,
            duration_ms: None,
            animation_period_ms: None,
            breathing_period_ms: None,
            opacity_override_percent: None,
            brightness_override_percent: None,
            custom_lightbar: instance.custom_lightbar,
            edge_lightbar: instance.edge_lightbar.clone(),
            mascot: instance.mascot.clone(),
            resolved_mascot_pack: resolved_mascot_pack(instance),
            mascot_state: instance.mascot.as_ref().map(|settings| settings.idle_state),
            mascot_action_id: None,
            mascot_play_mode: None,
            mascot_playback_window_ms: None,
            mascot_bubble_text: preview_mascot_bubble_text(instance, preview_mode),
            preview_mode,
        }
    }

    pub fn window_payload_for_instance(
        &self,
        instance: &DesktopNoticeInstance,
        preview_mode: bool,
    ) -> DesktopNoticeWindowPayload {
        self.window_payloads
            .lock()
            .ok()
            .and_then(|payloads| payloads.get(&instance.id).cloned())
            .unwrap_or_else(|| Self::payload_for_instance(instance, preview_mode))
    }

    fn store_window_payload(&self, instance_id: &str, payload: DesktopNoticeWindowPayload) {
        if let Ok(mut payloads) = self.window_payloads.lock() {
            payloads.insert(instance_id.to_string(), payload);
        }
    }

    fn clear_window_payload(&self, instance_id: &str) {
        if let Ok(mut payloads) = self.window_payloads.lock() {
            payloads.remove(instance_id);
        }
    }

    fn schedule_end_behavior(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
        request: DesktopNoticeOutputRequest,
    ) {
        let token = self.next_restore_token.fetch_add(1, Ordering::Relaxed) + 1;
        if let Ok(mut restore_tokens) = self.restore_tokens.lock() {
            restore_tokens.insert(instance.id.clone(), token);
        }
        let app = app.clone();
        let instance = instance.clone();
        let duration_ms = request.duration_ms;
        let restore_tokens = Arc::clone(&self.restore_tokens);
        let restore_tasks = Arc::clone(&self.restore_tasks);
        let window_payloads = Arc::clone(&self.window_payloads);
        let task_instance_id = instance.id.clone();
        let task = tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(u64::from(duration_ms))).await;
            let should_restore = restore_tokens
                .lock()
                .map(|tokens| tokens.get(&instance.id).copied() == Some(token))
                .unwrap_or(false);
            if !should_restore {
                return;
            }
            let service = DesktopNoticeService {
                restore_tokens: Arc::clone(&restore_tokens),
                restore_tasks: Arc::clone(&restore_tasks),
                window_payloads: Arc::clone(&window_payloads),
                next_restore_token: Arc::new(AtomicU64::new(token)),
            };
            if let Err(error) = service.apply_end_behavior(&app, &instance, &request) {
                tracing::warn!(
                    instance_id = instance.id,
                    error,
                    "failed to apply desktop notice end behavior"
                );
            }
            let should_remove_task = restore_tokens
                .lock()
                .map(|mut tokens| {
                    if tokens.get(&instance.id).copied() == Some(token) {
                        tokens.remove(&instance.id);
                        true
                    } else {
                        false
                    }
                })
                .unwrap_or(false);
            if should_remove_task {
                if let Ok(mut tasks) = restore_tasks.lock() {
                    tasks.remove(&instance.id);
                }
            }
        });
        if let Ok(mut tasks) = self.restore_tasks.lock() {
            if let Some(previous_task) = tasks.insert(task_instance_id, task) {
                previous_task.abort();
            }
        }
    }

    fn schedule_startup_mascot_idle_restore(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
    ) {
        let token = self.next_restore_token.fetch_add(1, Ordering::Relaxed) + 1;
        if let Ok(mut restore_tokens) = self.restore_tokens.lock() {
            restore_tokens.insert(instance.id.clone(), token);
        }
        let app = app.clone();
        let instance = instance.clone();
        let restore_tokens = Arc::clone(&self.restore_tokens);
        let restore_tasks = Arc::clone(&self.restore_tasks);
        let window_payloads = Arc::clone(&self.window_payloads);
        let task_instance_id = instance.id.clone();
        let task = tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(
                DESKTOP_MASCOT_STARTUP_GREETING_DURATION_MS,
            ))
            .await;
            let should_restore = restore_tokens
                .lock()
                .map(|tokens| tokens.get(&instance.id).copied() == Some(token))
                .unwrap_or(false);
            if !should_restore {
                return;
            }
            let service = DesktopNoticeService {
                restore_tokens: Arc::clone(&restore_tokens),
                restore_tasks: Arc::clone(&restore_tasks),
                window_payloads: Arc::clone(&window_payloads),
                next_restore_token: Arc::new(AtomicU64::new(token)),
            };
            if let Err(error) = service.open_or_update_window(
                &app,
                &instance,
                &Self::payload_for_instance(&instance, false),
                false,
            ) {
                tracing::warn!(
                    instance_id = instance.id,
                    error,
                    "failed to restore startup desktop mascot idle payload"
                );
            }
            let should_remove_task = restore_tokens
                .lock()
                .map(|mut tokens| {
                    if tokens.get(&instance.id).copied() == Some(token) {
                        tokens.remove(&instance.id);
                        true
                    } else {
                        false
                    }
                })
                .unwrap_or(false);
            if should_remove_task {
                if let Ok(mut tasks) = restore_tasks.lock() {
                    tasks.remove(&instance.id);
                }
            }
        });
        if let Ok(mut tasks) = self.restore_tasks.lock() {
            if let Some(previous_task) = tasks.insert(task_instance_id, task) {
                previous_task.abort();
            }
        }
    }

    fn apply_end_behavior(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
        request: &DesktopNoticeOutputRequest,
    ) -> Result<(), String> {
        match normalize_restore_behavior(request.restore_behavior) {
            DesktopNoticeRestoreBehavior::UseInstanceIdle => {
                self.apply_idle_behavior(app, instance, request)
            }
            DesktopNoticeRestoreBehavior::Hide => self.hide_preview(app, &instance.id),
            DesktopNoticeRestoreBehavior::KeepLast => self.open_or_update_window(
                app,
                instance,
                &Self::keep_last_payload(instance, request),
                false,
            ),
            DesktopNoticeRestoreBehavior::DimPlaceholder => self.open_or_update_window(
                app,
                instance,
                &Self::dim_placeholder_payload(instance),
                false,
            ),
            DesktopNoticeRestoreBehavior::RestoreDefault => {
                self.apply_idle_behavior(app, instance, request)
            }
        }
    }

    fn apply_idle_behavior(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
        request: &DesktopNoticeOutputRequest,
    ) -> Result<(), String> {
        match instance.idle_behavior {
            DesktopNoticeIdleBehavior::Hidden => self.apply_hidden_idle_behavior(app, instance),
            DesktopNoticeIdleBehavior::DimPlaceholder => self.open_or_update_window(
                app,
                instance,
                &Self::dim_placeholder_payload(instance),
                false,
            ),
            DesktopNoticeIdleBehavior::KeepLast => self.open_or_update_window(
                app,
                instance,
                &Self::keep_last_payload(instance, request),
                false,
            ),
        }
    }

    fn apply_hidden_idle_behavior(
        &self,
        app: &AppHandle,
        instance: &DesktopNoticeInstance,
    ) -> Result<(), String> {
        let payload = Self::payload_for_instance(instance, false);
        self.store_window_payload(&instance.id, payload.clone());
        let label = desktop_notice_window_label(&instance.id);
        emit_preview_payload(app, &label, &payload);
        if let Some(window) = app.get_webview_window(&label) {
            window.hide().map_err(|error| {
                tracing::warn!(
                    instance_id = instance.id,
                    error = %error,
                    "failed to hide desktop notice window for hidden idle behavior"
                );
                error_code(DesktopNoticeErrorCode::WindowUpdateFailed)
            })?;
        }
        Ok(())
    }

    fn keep_last_payload(
        instance: &DesktopNoticeInstance,
        request: &DesktopNoticeOutputRequest,
    ) -> DesktopNoticeWindowPayload {
        DesktopNoticeWindowPayload {
            appearance: DesktopNoticeAppearance {
                color_mode: request.color_mode,
                colors: request.colors.clone(),
            },
            default_state: DesktopNoticeDefaultState::Solid,
            default_state_config: visible_state_config(),
            effect: Some(DesktopNoticeRuleEffect::Solid),
            edge: None,
            duration_ms: None,
            animation_period_ms: None,
            breathing_period_ms: None,
            opacity_override_percent: request.opacity_percent,
            brightness_override_percent: request.brightness_percent,
            mascot_state: request.mascot_state,
            mascot_action_id: request.mascot_action_id.clone(),
            mascot_play_mode: request.mascot_play_mode,
            mascot_playback_window_ms: request.mascot_playback_window_ms,
            mascot_bubble_text: request.mascot_bubble_text.clone(),
            ..Self::payload_for_instance(instance, false)
        }
    }

    fn dim_placeholder_payload(instance: &DesktopNoticeInstance) -> DesktopNoticeWindowPayload {
        DesktopNoticeWindowPayload {
            default_state: DesktopNoticeDefaultState::Solid,
            default_state_config: dim_state_config(),
            appearance: neutral_placeholder_appearance(),
            effect: Some(DesktopNoticeRuleEffect::Solid),
            edge: None,
            duration_ms: None,
            animation_period_ms: None,
            breathing_period_ms: None,
            ..Self::payload_for_instance(instance, false)
        }
    }

    fn startup_idle_payload(instance: &DesktopNoticeInstance) -> DesktopNoticeWindowPayload {
        if instance.variant == DesktopNoticeVariant::Mascot {
            return DesktopNoticeWindowPayload {
                mascot_state: Some(DesktopMascotState::TaskReceived),
                mascot_action_id: Some("task-received.wave".to_string()),
                mascot_play_mode: Some(DesktopMascotPlayMode::OnceThenIdle),
                ..Self::payload_for_instance(instance, false)
            };
        }
        match instance.idle_behavior {
            DesktopNoticeIdleBehavior::Hidden => Self::payload_for_instance(instance, false),
            DesktopNoticeIdleBehavior::DimPlaceholder | DesktopNoticeIdleBehavior::KeepLast => {
                Self::dim_placeholder_payload(instance)
            }
        }
    }
}

fn should_show_on_startup(instance: &DesktopNoticeInstance) -> bool {
    instance.enabled
        && instance.show_on_startup
        && instance.idle_behavior != DesktopNoticeIdleBehavior::Hidden
}

fn preview_mascot_bubble_text(
    instance: &DesktopNoticeInstance,
    preview_mode: bool,
) -> Option<String> {
    if preview_mode
        && instance.variant == DesktopNoticeVariant::Mascot
        && instance
            .mascot
            .as_ref()
            .is_some_and(|settings| settings.bubble_enabled)
    {
        return Some(DESKTOP_MASCOT_PREVIEW_BUBBLE_TEXT.to_string());
    }
    None
}

fn resolved_mascot_pack(instance: &DesktopNoticeInstance) -> Option<CustomMascotPack> {
    let settings = instance.mascot.as_ref()?;
    if matches!(
        settings.asset_pack_id.as_str(),
        crate::core::desktop_notice::G7_DESKTOP_MASCOT_ASSET_PACK_ID
            | crate::core::desktop_notice::WARM_BUDDY_DESKTOP_MASCOT_ASSET_PACK_ID
    ) {
        return None;
    }
    resolve_custom_mascot_pack(&settings.asset_pack_id)
}

fn normalize_restore_behavior(
    behavior: DesktopNoticeRestoreBehavior,
) -> DesktopNoticeRestoreBehavior {
    match behavior {
        DesktopNoticeRestoreBehavior::RestoreDefault => {
            DesktopNoticeRestoreBehavior::UseInstanceIdle
        }
        value => value,
    }
}

fn neutral_placeholder_appearance() -> DesktopNoticeAppearance {
    DesktopNoticeAppearance {
        color_mode: crate::core::desktop_notice::DesktopNoticeColorMode::Solid,
        colors: vec![crate::core::desktop_notice::DesktopNoticeColorStop {
            color: "#94A3B8".to_string(),
            position: 0,
        }],
    }
}

fn visible_state_config() -> DesktopNoticeDefaultStateConfig {
    DesktopNoticeDefaultStateConfig {
        brightness_percent: 100,
        breathing_period_ms: 1600,
    }
}

fn dim_state_config() -> DesktopNoticeDefaultStateConfig {
    DesktopNoticeDefaultStateConfig {
        brightness_percent: 35,
        breathing_period_ms: 1600,
    }
}

fn emit_preview_payload(app: &AppHandle, label: &str, payload: &DesktopNoticeWindowPayload) {
    if let Err(error) = app.emit_to(label, DESKTOP_NOTICE_PREVIEW_UPDATED_EVENT, payload) {
        tracing::debug!(
            label,
            error = %error,
            "desktop notice preview payload emit skipped"
        );
    }
}

fn desktop_notice_bootstrap_script(payload: &DesktopNoticeWindowPayload) -> Result<String, String> {
    let json = serde_json::to_string(payload).map_err(|error| error.to_string())?;
    Ok(format!(
        "window.__CC_NOTICE_DESKTOP_NOTICE_PAYLOAD__ = {json};"
    ))
}

fn apply_window_state<R: tauri::Runtime>(
    app: &AppHandle<R>,
    window: &tauri::WebviewWindow<R>,
    instance: &DesktopNoticeInstance,
) -> Result<(), tauri::Error> {
    window.set_title(&format!("CC Notice - {}", instance.name))?;
    window.set_background_color(Some(tauri::utils::config::Color(0, 0, 0, 0)))?;
    window.set_always_on_top(instance.always_on_top)?;
    window.set_ignore_cursor_events(window_should_ignore_cursor_events(instance))?;
    window.set_shadow(false)?;
    window.set_size(initial_window_size(app, instance))?;
    if let Some(position) = initial_window_position(app, instance) {
        window.set_position(position)?;
    }
    Ok(())
}

fn window_should_ignore_cursor_events(instance: &DesktopNoticeInstance) -> bool {
    instance.variant == DesktopNoticeVariant::EdgeLightbar
}

fn window_should_focus(instance: &DesktopNoticeInstance, requested: bool) -> bool {
    requested && !window_should_ignore_cursor_events(instance)
}

fn initial_window_size<R: tauri::Runtime>(
    app: &AppHandle<R>,
    instance: &DesktopNoticeInstance,
) -> PhysicalSize<u32> {
    if let Some(work_area) = primary_work_area(app) {
        return window_size_for_instance(instance, work_area);
    }
    let size = instance_window_size(instance);
    PhysicalSize::new(size.width, size.height)
}

fn initial_window_position<R: tauri::Runtime>(
    app: &AppHandle<R>,
    instance: &DesktopNoticeInstance,
) -> Option<PhysicalPosition<i32>> {
    if instance.variant == DesktopNoticeVariant::EdgeLightbar {
        let work_area = primary_work_area(app)?;
        return Some(PhysicalPosition::new(work_area.x, work_area.y));
    }
    let (size, preset_position, bounds_override) = instance_position_config(instance);
    if let Some(bounds) = bounds_override {
        let monitor = app.primary_monitor().ok().flatten()?;
        let work_area = monitor.work_area();
        let clamped_bounds = adapt_bounds_to_work_area(
            bounds,
            WorkArea {
                x: work_area.position.x,
                y: work_area.position.y,
                width: work_area.size.width,
                height: work_area.size.height,
            },
        );
        return Some(PhysicalPosition::new(clamped_bounds.x, clamped_bounds.y));
    }
    let monitor = app.primary_monitor().ok().flatten()?;
    let work_area = monitor.work_area();
    Some(position_for_preset(
        WorkArea {
            x: work_area.position.x,
            y: work_area.position.y,
            width: work_area.size.width,
            height: work_area.size.height,
        },
        size,
        preset_position,
    ))
}

fn primary_work_area<R: tauri::Runtime>(app: &AppHandle<R>) -> Option<WorkArea> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let work_area = monitor.work_area();
    Some(WorkArea {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    })
}

fn window_size_for_instance(
    instance: &DesktopNoticeInstance,
    work_area: WorkArea,
) -> PhysicalSize<u32> {
    if instance.variant == DesktopNoticeVariant::EdgeLightbar {
        return PhysicalSize::new(work_area.width, work_area.height);
    }
    let size = instance_window_size(instance);
    PhysicalSize::new(size.width, size.height)
}

fn custom_lightbar_settings(instance: &DesktopNoticeInstance) -> CustomLightbarSettings {
    instance.custom_lightbar.unwrap_or_default()
}

fn mascot_settings(instance: &DesktopNoticeInstance) -> MascotSettings {
    instance.mascot.clone().unwrap_or_default()
}

fn instance_window_size(instance: &DesktopNoticeInstance) -> DesktopNoticeSize {
    match instance.variant {
        DesktopNoticeVariant::EdgeLightbar => custom_lightbar_settings(instance).size,
        DesktopNoticeVariant::Mascot => mascot_settings(instance).stage_size,
        DesktopNoticeVariant::CustomLightbar => custom_lightbar_settings(instance).size,
    }
}

fn instance_direction(instance: &DesktopNoticeInstance) -> DesktopNoticeDirection {
    match instance.variant {
        DesktopNoticeVariant::Mascot => DesktopNoticeDirection::Horizontal,
        DesktopNoticeVariant::CustomLightbar | DesktopNoticeVariant::EdgeLightbar => {
            custom_lightbar_settings(instance).direction
        }
    }
}

fn instance_opacity_percent(instance: &DesktopNoticeInstance) -> u8 {
    match instance.variant {
        DesktopNoticeVariant::EdgeLightbar => instance
            .edge_lightbar
            .as_ref()
            .map(|settings| settings.opacity_percent)
            .unwrap_or(100),
        DesktopNoticeVariant::Mascot => 100,
        DesktopNoticeVariant::CustomLightbar => custom_lightbar_settings(instance).opacity_percent,
    }
}

fn instance_corner_radius_percent(instance: &DesktopNoticeInstance) -> u8 {
    match instance.variant {
        DesktopNoticeVariant::EdgeLightbar => 0,
        DesktopNoticeVariant::Mascot => 0,
        DesktopNoticeVariant::CustomLightbar => {
            custom_lightbar_settings(instance).corner_radius_percent
        }
    }
}

fn instance_position_config(
    instance: &DesktopNoticeInstance,
) -> (
    DesktopNoticeSize,
    DesktopNoticePresetPosition,
    Option<DesktopNoticeBounds>,
) {
    match instance.variant {
        DesktopNoticeVariant::Mascot => {
            let settings = mascot_settings(instance);
            (
                settings.stage_size,
                settings.preset_position,
                settings.bounds_override,
            )
        }
        DesktopNoticeVariant::CustomLightbar | DesktopNoticeVariant::EdgeLightbar => {
            let settings = custom_lightbar_settings(instance);
            (
                settings.size,
                settings.preset_position,
                settings.bounds_override,
            )
        }
    }
}

fn clamp_bounds_to_work_area(
    bounds: DesktopNoticeBounds,
    work_area: WorkArea,
) -> DesktopNoticeBounds {
    let min_x = work_area.x;
    let min_y = work_area.y;
    let max_x = work_area.x + (work_area.width as i32 - bounds.width as i32).max(0);
    let max_y = work_area.y + (work_area.height as i32 - bounds.height as i32).max(0);
    DesktopNoticeBounds {
        x: bounds.x.clamp(min_x, max_x),
        y: bounds.y.clamp(min_y, max_y),
        width: bounds.width.min(work_area.width),
        height: bounds.height.min(work_area.height),
        source_work_area: bounds.source_work_area,
    }
}

fn adapt_bounds_to_work_area(
    bounds: DesktopNoticeBounds,
    work_area: WorkArea,
) -> DesktopNoticeBounds {
    let Some(source_work_area) = bounds.source_work_area else {
        return clamp_bounds_to_work_area(bounds, work_area);
    };
    if source_work_area.width == 0 || source_work_area.height == 0 {
        return clamp_bounds_to_work_area(bounds, work_area);
    }

    let relative_x = (bounds.x - source_work_area.x) as f64 / source_work_area.width as f64;
    let relative_y = (bounds.y - source_work_area.y) as f64 / source_work_area.height as f64;
    clamp_bounds_to_work_area(
        DesktopNoticeBounds {
            x: work_area.x + (relative_x * work_area.width as f64).round() as i32,
            y: work_area.y + (relative_y * work_area.height as f64).round() as i32,
            width: bounds.width.min(work_area.width),
            height: bounds.height.min(work_area.height),
            source_work_area: bounds.source_work_area,
        },
        work_area,
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WorkArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl From<WorkArea> for DesktopNoticeWorkArea {
    fn from(value: WorkArea) -> Self {
        Self {
            x: value.x,
            y: value.y,
            width: value.width,
            height: value.height,
        }
    }
}

fn position_for_preset(
    work_area: WorkArea,
    notice_size: DesktopNoticeSize,
    preset_position: DesktopNoticePresetPosition,
) -> PhysicalPosition<i32> {
    const EDGE_MARGIN: i32 = 24;
    let left = work_area.x;
    let top = work_area.y;
    let width = work_area.width as i32;
    let height = work_area.height as i32;
    let notice_width = notice_size.width as i32;
    let notice_height = notice_size.height as i32;
    let centered_x = left + ((width - notice_width).max(0) / 2);
    let centered_y = top + ((height - notice_height).max(0) / 2);
    let right_x = left + (width - notice_width - EDGE_MARGIN).max(0);
    let bottom_y = top + (height - notice_height - EDGE_MARGIN).max(0);
    let edge_left = left + EDGE_MARGIN.min(width.max(0));
    let edge_top = top + EDGE_MARGIN.min(height.max(0));

    match preset_position {
        DesktopNoticePresetPosition::TopCenter => PhysicalPosition::new(centered_x, edge_top),
        DesktopNoticePresetPosition::BottomCenter => PhysicalPosition::new(centered_x, bottom_y),
        DesktopNoticePresetPosition::LeftCenter => PhysicalPosition::new(edge_left, centered_y),
        DesktopNoticePresetPosition::RightCenter => PhysicalPosition::new(right_x, centered_y),
        DesktopNoticePresetPosition::TopLeft => PhysicalPosition::new(edge_left, edge_top),
        DesktopNoticePresetPosition::TopRight => PhysicalPosition::new(right_x, edge_top),
        DesktopNoticePresetPosition::BottomLeft => PhysicalPosition::new(edge_left, bottom_y),
        DesktopNoticePresetPosition::BottomRight => PhysicalPosition::new(right_x, bottom_y),
        DesktopNoticePresetPosition::Center => PhysicalPosition::new(centered_x, centered_y),
        DesktopNoticePresetPosition::Custom => PhysicalPosition::new(centered_x, centered_y),
    }
}

fn error_code(code: DesktopNoticeErrorCode) -> String {
    DesktopNoticeConfigError {
        code,
        detail: String::new(),
    }
    .code_string()
}

pub(crate) fn desktop_notice_window_label(instance_id: &str) -> String {
    format!(
        "{DESKTOP_NOTICE_WINDOW_PREFIX}{}",
        encode_window_label_fragment(instance_id)
    )
}

pub(crate) fn desktop_notice_window_route(instance_id: &str) -> String {
    format!(
        "{DESKTOP_NOTICE_ROUTE_PREFIX}{}",
        percent_encode_query_value(instance_id)
    )
}

fn encode_window_label_fragment(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("_{byte:02X}")),
        }
    }
    encoded
}

fn percent_encode_query_value(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::desktop_notice::DesktopNoticeInstance;

    #[test]
    fn desktop_notice_window_label_encodes_instance_id() {
        assert_eq!(
            "desktop-notice:lightbar_3Amain_2Ftop",
            desktop_notice_window_label("lightbar:main/top")
        );
    }

    #[test]
    fn desktop_notice_window_route_encodes_query_value() {
        assert_eq!(
            "/?desktopNoticeInstanceId=lightbar%3Amain%2Ftop",
            desktop_notice_window_route("lightbar:main/top")
        );
    }

    #[test]
    fn payload_uses_neutral_placeholder_appearance() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "顶部提示");
        let settings = instance
            .custom_lightbar
            .as_mut()
            .expect("custom lightbar settings should exist");
        settings.size.width = 640;
        settings.size.height = 28;
        settings.opacity_percent = 75;

        let payload = DesktopNoticeService::payload_for_instance(&instance, true);

        assert_eq!("desk-1", payload.instance_id);
        assert_eq!("顶部提示", payload.name);
        assert_eq!(
            crate::core::desktop_notice::DesktopNoticeDirection::Horizontal,
            payload.direction
        );
        assert_eq!(640, payload.size.width);
        assert_eq!(28, payload.size.height);
        assert_eq!(75, payload.opacity_percent);
        assert_eq!(neutral_placeholder_appearance(), payload.appearance);
        assert_eq!(None, payload.effect);
    }

    #[test]
    fn mascot_preview_payload_contains_sample_bubble_text() {
        let instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");

        let preview_payload = DesktopNoticeService::payload_for_instance(&instance, true);
        let runtime_payload = DesktopNoticeService::payload_for_instance(&instance, false);

        assert_eq!(
            Some("预览气泡".to_string()),
            preview_payload.mascot_bubble_text
        );
        assert_eq!(None, runtime_payload.mascot_bubble_text);
    }

    #[test]
    fn stores_rule_preview_payload_for_initial_window_load() {
        let service = DesktopNoticeService::default();
        let instance = DesktopNoticeInstance::new_custom_lightbar("desk-1", "顶部提示");
        let request = DesktopNoticeOutputRequest {
            rule_id: "rule-preview".to_string(),
            target_id: "desk-1".to_string(),
            effect: DesktopNoticeRuleEffect::EdgeBreathing,
            color_mode: crate::core::desktop_notice::DesktopNoticeColorMode::Solid,
            colors: vec![crate::core::desktop_notice::DesktopNoticeColorStop {
                color: "#EF4444".to_string(),
                position: 0,
            }],
            duration_ms: 2600,
            animation_period_ms: Some(2400),
            breathing_period_ms: Some(1600),
            opacity_percent: Some(90),
            brightness_percent: Some(100),
            restore_behavior: DesktopNoticeRestoreBehavior::UseInstanceIdle,
            edge: Some(DesktopNoticeEdge::Bottom),
            mascot_state: None,
            mascot_action_id: None,
            mascot_play_mode: None,
            mascot_playback_window_ms: None,
            mascot_bubble_text: None,
        };
        let payload = DesktopNoticeWindowPayload {
            appearance: DesktopNoticeAppearance {
                color_mode: request.color_mode,
                colors: request.colors.clone(),
            },
            effect: Some(request.effect),
            edge: request.edge,
            duration_ms: Some(request.duration_ms),
            animation_period_ms: request.animation_period_ms,
            breathing_period_ms: request.breathing_period_ms,
            opacity_override_percent: request.opacity_percent,
            brightness_override_percent: request.brightness_percent,
            preview_mode: true,
            ..DesktopNoticeService::payload_for_instance(&instance, true)
        };

        service.store_window_payload(&instance.id, payload);
        let loaded = service.window_payload_for_instance(&instance, true);

        assert_eq!(Some(DesktopNoticeRuleEffect::EdgeBreathing), loaded.effect);
        assert_eq!(Some(DesktopNoticeEdge::Bottom), loaded.edge);
        assert_eq!("#EF4444", loaded.appearance.colors[0].color);
    }

    #[test]
    fn bootstrap_script_contains_serialized_payload() {
        let instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");
        let payload = DesktopNoticeService::payload_for_instance(&instance, true);

        let script = desktop_notice_bootstrap_script(&payload).expect("script should serialize");

        assert!(script.starts_with("window.__CC_NOTICE_DESKTOP_NOTICE_PAYLOAD__ = "));
        assert!(script.contains("\"instanceId\":\"mascot-1\""));
        assert!(script.contains("\"previewMode\":true"));
    }

    #[test]
    fn clearing_window_payload_discards_stale_rule_preview_payload() {
        let service = DesktopNoticeService::default();
        let instance = DesktopNoticeInstance::new_custom_lightbar("desk-1", "顶部提示");
        let mut payload = DesktopNoticeService::payload_for_instance(&instance, true);
        payload.effect = Some(DesktopNoticeRuleEffect::EdgeBreathing);
        payload.preview_mode = true;

        service.store_window_payload(&instance.id, payload);
        service.clear_window_payload(&instance.id);
        let loaded = service.window_payload_for_instance(&instance, false);

        assert_eq!(None, loaded.effect);
        assert!(!loaded.preview_mode);
    }

    #[test]
    fn cloned_service_shares_window_payloads() {
        let service = DesktopNoticeService::default();
        let cloned_service = service.clone();
        let instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");
        let payload = DesktopNoticeService::payload_for_instance(&instance, true);

        service.store_window_payload(&instance.id, payload);
        let loaded = cloned_service.window_payload_for_instance(&instance, false);

        assert!(loaded.preview_mode);
        assert_eq!("mascot-1", loaded.instance_id);
    }

    #[test]
    fn payload_for_edge_lightbar_uses_edge_settings() {
        let instance = DesktopNoticeInstance::new_edge_lightbar("edge-1", "屏幕边缘");

        let payload = DesktopNoticeService::payload_for_instance(&instance, true);

        assert_eq!(
            crate::core::desktop_notice::DesktopNoticeVariant::EdgeLightbar,
            payload.variant
        );
        assert!(payload.edge_lightbar.is_some());
        assert!(payload.custom_lightbar.is_none());
    }

    #[test]
    fn payload_for_mascot_uses_stage_size_and_mascot_settings() {
        let instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");

        let payload = DesktopNoticeService::payload_for_instance(&instance, true);

        assert_eq!(
            crate::core::desktop_notice::DesktopNoticeVariant::Mascot,
            payload.variant
        );
        assert_eq!(
            crate::core::desktop_notice::DesktopNoticeSize {
                width: 260,
                height: 260,
            },
            payload.size
        );
        assert_eq!(
            Some(crate::core::desktop_notice::DesktopMascotState::Idle),
            payload.mascot_state
        );
        assert!(payload.mascot.is_some());
        assert!(payload.custom_lightbar.is_none());
        assert!(payload.edge_lightbar.is_none());
        assert!(payload.preview_mode);
    }

    #[test]
    fn edge_lightbar_window_size_uses_work_area() {
        let size = window_size_for_instance(
            &DesktopNoticeInstance::new_edge_lightbar("edge-1", "屏幕边缘"),
            WorkArea {
                x: 0,
                y: 0,
                width: 1440,
                height: 900,
            },
        );

        assert_eq!(PhysicalSize::new(1440, 900), size);
    }

    #[test]
    fn edge_lightbar_window_ignores_cursor_events() {
        assert!(window_should_ignore_cursor_events(
            &DesktopNoticeInstance::new_edge_lightbar("edge-1", "屏幕边缘")
        ));
        assert!(!window_should_ignore_cursor_events(
            &DesktopNoticeInstance::new_custom_lightbar("custom-1", "自定义灯条")
        ));
        assert!(!window_should_ignore_cursor_events(
            &DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵")
        ));
    }

    #[test]
    fn preset_position_uses_work_area() {
        let position = position_for_preset(
            WorkArea {
                x: 10,
                y: 20,
                width: 1000,
                height: 800,
            },
            crate::core::desktop_notice::DesktopNoticeSize {
                width: 400,
                height: 40,
            },
            crate::core::desktop_notice::DesktopNoticePresetPosition::BottomRight,
        );

        assert_eq!(PhysicalPosition::new(586, 756), position);
    }

    #[test]
    fn clamp_bounds_keeps_notice_inside_work_area() {
        let bounds = clamp_bounds_to_work_area(
            DesktopNoticeBounds {
                x: -100,
                y: 900,
                width: 300,
                height: 80,
                source_work_area: None,
            },
            WorkArea {
                x: 10,
                y: 20,
                width: 1000,
                height: 800,
            },
        );

        assert_eq!(
            DesktopNoticeBounds {
                x: 10,
                y: 740,
                width: 300,
                height: 80,
                source_work_area: None,
            },
            bounds
        );
    }

    #[test]
    fn adapt_bounds_scales_custom_position_between_work_areas() {
        let bounds = DesktopNoticeBounds {
            x: 980,
            y: 540,
            width: 640,
            height: 40,
            source_work_area: Some(crate::core::desktop_notice::DesktopNoticeWorkArea {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            }),
        };

        let adapted = adapt_bounds_to_work_area(
            bounds,
            WorkArea {
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
            },
        );

        assert_eq!(
            DesktopNoticeBounds {
                x: 640,
                y: 360,
                width: 640,
                height: 40,
                source_work_area: bounds.source_work_area,
            },
            adapted
        );
    }

    #[test]
    fn adapt_bounds_clamps_size_to_current_work_area() {
        let bounds = DesktopNoticeBounds {
            x: 100,
            y: 80,
            width: 1600,
            height: 900,
            source_work_area: Some(crate::core::desktop_notice::DesktopNoticeWorkArea {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            }),
        };

        let adapted = adapt_bounds_to_work_area(
            bounds,
            WorkArea {
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
            },
        );

        assert_eq!(
            DesktopNoticeBounds {
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
                source_work_area: bounds.source_work_area,
            },
            adapted
        );
    }

    #[test]
    fn startup_instances_skip_hidden_default_state() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "顶部提示");
        instance.show_on_startup = true;
        instance.idle_behavior = DesktopNoticeIdleBehavior::Hidden;

        assert!(!should_show_on_startup(&instance));

        instance.idle_behavior = DesktopNoticeIdleBehavior::DimPlaceholder;

        assert!(should_show_on_startup(&instance));
    }

    #[test]
    fn startup_idle_payload_is_runtime_state_not_preview() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "顶部提示");
        instance.idle_behavior =
            crate::core::desktop_notice::DesktopNoticeIdleBehavior::DimPlaceholder;

        let payload = DesktopNoticeService::startup_idle_payload(&instance);

        assert!(!payload.preview_mode);
        assert_eq!(instance.id, payload.instance_id);
        assert_eq!(DesktopNoticeDefaultState::Solid, payload.default_state);
        assert_eq!(Some(DesktopNoticeRuleEffect::Solid), payload.effect);
    }

    #[test]
    fn startup_idle_payload_preserves_hidden_runtime_idle() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "顶部提示");
        instance.idle_behavior = crate::core::desktop_notice::DesktopNoticeIdleBehavior::Hidden;

        let payload = DesktopNoticeService::startup_idle_payload(&instance);

        assert!(!payload.preview_mode);
        assert_eq!(DesktopNoticeDefaultState::Hidden, payload.default_state);
        assert_eq!(None, payload.effect);
    }

    #[test]
    fn startup_mascot_payload_uses_greeting_action() {
        let mut instance = DesktopNoticeInstance::new_mascot("mascot-1", "G7 精灵");
        instance.idle_behavior =
            crate::core::desktop_notice::DesktopNoticeIdleBehavior::DimPlaceholder;

        let payload = DesktopNoticeService::startup_idle_payload(&instance);

        assert!(!payload.preview_mode);
        assert_eq!(DesktopNoticeVariant::Mascot, payload.variant);
        assert_eq!(Some(DesktopMascotState::TaskReceived), payload.mascot_state);
        assert_eq!(
            Some("task-received.wave"),
            payload.mascot_action_id.as_deref()
        );
    }
}
