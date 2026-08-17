use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Once;
use std::time::{Duration, Instant};

use tauri::Manager;

use crate::app_services::inbound_event_service::SubmitRelayEventResult;
use crate::app_services::sound_asset_service::SoundAssetService;
use crate::core::desktop_notice::{
    DesktopMascotPlayMode, DesktopMascotState, DesktopNoticeColorMode, DesktopNoticeColorStop,
    DesktopNoticeConfigError, DesktopNoticeEdge, DesktopNoticeErrorCode,
    DesktopNoticeRestoreBehavior, DesktopNoticeRuleEffect,
};
use crate::core::profiles::HardwareOutputType;
use crate::infrastructure::desktop_notification::{
    DesktopNotificationRequest, DesktopNotificationSender, NoopDesktopNotificationSender,
    TauriDesktopNotificationSender,
};
use crate::infrastructure::path_text::user_facing_path_text;

pub trait OutputExecutor: Send + Sync {
    /// Runs output dispatch for a hook event. Implementations must avoid long blocking work because
    /// the local hook HTTP handler waits for this method before responding to the relay script.
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String>;

    /// Returns per-output dispatch status for runtime monitoring while following the same
    /// non-blocking contract as `execute`.
    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        let success = self.execute(result).is_ok();
        OutputExecutionReport::from_outputs(result, |_| success)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutputExecutionItem {
    pub output_type: HardwareOutputType,
    pub rule_id: String,
    pub success: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OutputExecutionReport {
    pub items: Vec<OutputExecutionItem>,
}

impl OutputExecutionReport {
    pub fn from_outputs<F>(result: &SubmitRelayEventResult, mut success_for_output: F) -> Self
    where
        F: FnMut(&crate::app_services::inbound_event_service::SubmitRelayEventOutput) -> bool,
    {
        Self {
            items: result
                .outputs
                .iter()
                .map(|output| OutputExecutionItem {
                    output_type: output.output_type,
                    rule_id: output.rule_id.clone(),
                    success: success_for_output(output),
                })
                .collect(),
        }
    }

    pub fn push(&mut self, output_type: HardwareOutputType, rule_id: String, success: bool) {
        self.items.push(OutputExecutionItem {
            output_type,
            rule_id,
            success,
        });
    }

    pub fn extend(&mut self, other: OutputExecutionReport) {
        self.items.extend(other.items);
    }

    pub fn has_failures(&self) -> bool {
        self.items.iter().any(|item| !item.success)
    }
}

#[derive(Debug, Default)]
pub struct NoopOutputExecutor;

impl OutputExecutor for NoopOutputExecutor {
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
        for output in &result.outputs {
            if output.output_type == HardwareOutputType::SystemNotification {
                tracing::info!(
                    "system notification output prepared: rule_id={}, title_present={}, body_present={}",
                    output.rule_id,
                    output
                        .notification_title
                        .as_ref()
                        .is_some_and(|value| !value.is_empty()),
                    output
                        .notification_body
                        .as_ref()
                        .is_some_and(|value| !value.is_empty())
                );
            }
        }
        Ok(())
    }
}

pub trait NotificationSender: Send + Sync {
    fn send(&self, title: &str, body: &str, sound: Option<&str>) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookRequest {
    pub rule_id: String,
    pub method: String,
    pub url: String,
    pub headers_json: Option<String>,
    pub body: Option<String>,
}

pub trait WebhookSender: Send + Sync + 'static {
    fn send(&self, request: WebhookRequest) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SoundRequest {
    pub rule_id: String,
    pub file_path: String,
    pub volume_percent: u8,
    pub max_duration_ms: u32,
}

pub trait SoundSender: Send + Sync + 'static {
    fn play(&self, request: SoundRequest) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DesktopNoticeOutputRequest {
    pub rule_id: String,
    pub target_id: String,
    pub effect: DesktopNoticeRuleEffect,
    pub color_mode: DesktopNoticeColorMode,
    pub colors: Vec<DesktopNoticeColorStop>,
    pub duration_ms: u32,
    pub animation_period_ms: Option<u32>,
    pub breathing_period_ms: Option<u32>,
    pub opacity_percent: Option<u8>,
    pub brightness_percent: Option<u8>,
    pub restore_behavior: DesktopNoticeRestoreBehavior,
    pub edge: Option<DesktopNoticeEdge>,
    pub mascot_state: Option<DesktopMascotState>,
    pub mascot_action_id: Option<String>,
    pub mascot_play_mode: Option<DesktopMascotPlayMode>,
    pub mascot_playback_window_ms: Option<u32>,
    pub mascot_bubble_text: Option<String>,
}

pub trait DesktopNoticeSender: Send + Sync + 'static {
    fn apply(&self, request: DesktopNoticeOutputRequest) -> Result<(), String>;
}

pub fn preview_sound_with_sender<S: SoundSender>(
    sender: &S,
    file_path: String,
    volume_percent: u8,
    max_duration_ms: u32,
) -> Result<(), String> {
    if file_path.trim().is_empty() {
        return Err("sound preview requires file_path".to_string());
    }
    sender.play(SoundRequest {
        rule_id: "sound-preview".to_string(),
        file_path,
        volume_percent: volume_percent.min(100),
        max_duration_ms,
    })
}

pub struct NativeNotificationSender {
    sender: Box<dyn DesktopNotificationSender>,
}

impl NativeNotificationSender {
    pub fn new(sender: Box<dyn DesktopNotificationSender>) -> Self {
        Self { sender }
    }

    pub fn from_app_handle(app: tauri::AppHandle) -> Self {
        Self::new(Box::new(TauriDesktopNotificationSender::new(app)))
    }
}

impl Default for NativeNotificationSender {
    fn default() -> Self {
        Self::new(Box::new(NoopDesktopNotificationSender))
    }
}

impl NotificationSender for NativeNotificationSender {
    fn send(&self, title: &str, body: &str, sound: Option<&str>) -> Result<(), String> {
        self.sender.send_notification(DesktopNotificationRequest {
            title: title.to_string(),
            body: body.to_string(),
            sound: sound.map(str::to_string),
        })
    }
}

#[derive(Debug)]
pub struct ThrottledNotificationExecutor<S> {
    sender: S,
    last_sent_at: HashMap<String, Instant>,
}

impl<S> ThrottledNotificationExecutor<S> {
    pub fn new(sender: S) -> Self {
        Self {
            sender,
            last_sent_at: HashMap::new(),
        }
    }

    #[cfg(test)]
    fn sender(&self) -> &S {
        &self.sender
    }
}

impl<S: Default> Default for ThrottledNotificationExecutor<S> {
    fn default() -> Self {
        Self::new(S::default())
    }
}

impl<S: NotificationSender> OutputExecutor for ThrottledNotificationExecutor<S> {
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
        let report = self.execute_with_report(result);
        if report.has_failures() {
            return Err("one or more system notification outputs failed".to_string());
        }
        Ok(())
    }

    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        let mut report = OutputExecutionReport::default();
        for output in &result.outputs {
            if output.output_type != HardwareOutputType::SystemNotification {
                continue;
            }
            let throttle_seconds = output.notification_throttle_seconds.unwrap_or(30);
            let throttle_key = notification_throttle_key(result, &output.rule_id);
            if self.should_throttle(&throttle_key, throttle_seconds) {
                tracing::info!(
                    "system notification throttled: key={}, throttle_seconds={}",
                    throttle_key,
                    throttle_seconds
                );
                report.push(output.output_type, output.rule_id.clone(), true);
                continue;
            }
            let title = output
                .notification_title
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("CC Notice");
            let body = output
                .notification_body
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("AI 事件已触发");
            tracing::info!(
                "system notification sending: rule_id={}, title_chars={}, body_chars={}, sound={}",
                output.rule_id,
                title.chars().count(),
                body.chars().count(),
                output.notification_sound.as_deref().unwrap_or("default")
            );
            match self
                .sender
                .send(title, body, output.notification_sound.as_deref())
            {
                Ok(()) => {
                    tracing::info!("system notification sent: rule_id={}", output.rule_id);
                    self.last_sent_at.insert(throttle_key, Instant::now());
                    report.push(output.output_type, output.rule_id.clone(), true);
                }
                Err(error) => {
                    tracing::warn!(
                        "system notification output failed: rule_id={}, error={}",
                        output.rule_id,
                        error
                    );
                    report.push(output.output_type, output.rule_id.clone(), false);
                }
            }
        }
        report
    }
}

impl<S> ThrottledNotificationExecutor<S> {
    fn should_throttle(&self, key: &str, throttle_seconds: u32) -> bool {
        if throttle_seconds == 0 {
            return false;
        }
        self.last_sent_at.get(key).is_some_and(|sent_at| {
            sent_at.elapsed() < Duration::from_secs(u64::from(throttle_seconds))
        })
    }
}

pub type NativeNotificationExecutor = ThrottledNotificationExecutor<NativeNotificationSender>;
pub type NativeWebhookExecutor = WebhookOutputExecutor<AsyncReqwestWebhookSender>;
pub type NativeSoundExecutor = SoundOutputExecutor<NativeSoundSender>;
pub type NativeDesktopNoticeExecutor = DesktopNoticeOutputExecutor<NativeDesktopNoticeSender>;
pub type NativeLocalOutputExecutor = LocalOutputExecutor<
    NativeNotificationExecutor,
    NativeSoundExecutor,
    NativeDesktopNoticeExecutor,
>;

pub struct CombinedOutputExecutor<N, W, S, D> {
    notification_executor: N,
    webhook_executor: W,
    sound_executor: S,
    desktop_notice_executor: D,
}

impl<N, W, S, D> CombinedOutputExecutor<N, W, S, D> {
    pub fn new(
        notification_executor: N,
        webhook_executor: W,
        sound_executor: S,
        desktop_notice_executor: D,
    ) -> Self {
        Self {
            notification_executor,
            webhook_executor,
            sound_executor,
            desktop_notice_executor,
        }
    }
}

impl NativeOutputExecutor {
    pub fn from_app_handle(app: tauri::AppHandle) -> Self {
        let resource_dir = app.path().resource_dir().ok();
        CombinedOutputExecutor::new(
            ThrottledNotificationExecutor::new(NativeNotificationSender::from_app_handle(
                app.clone(),
            )),
            NativeWebhookExecutor::default(),
            NativeSoundExecutor::new(NativeSoundSender::from_runtime_paths(resource_dir)),
            NativeDesktopNoticeExecutor::new(NativeDesktopNoticeSender::from_app_handle(app)),
        )
    }
}

impl<N: Default, W: Default, S: Default, D: Default> Default
    for CombinedOutputExecutor<N, W, S, D>
{
    fn default() -> Self {
        Self::new(N::default(), W::default(), S::default(), D::default())
    }
}

impl<N: OutputExecutor, W: OutputExecutor, S: OutputExecutor, D: OutputExecutor> OutputExecutor
    for CombinedOutputExecutor<N, W, S, D>
{
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
        let _ = self.execute_with_report(result);
        Ok(())
    }

    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        let mut report = OutputExecutionReport::default();
        report.extend(self.notification_executor.execute_with_report(result));
        report.extend(self.webhook_executor.execute_with_report(result));
        report.extend(self.sound_executor.execute_with_report(result));
        report.extend(self.desktop_notice_executor.execute_with_report(result));
        report
    }
}

pub type NativeOutputExecutor = CombinedOutputExecutor<
    NativeNotificationExecutor,
    NativeWebhookExecutor,
    NativeSoundExecutor,
    NativeDesktopNoticeExecutor,
>;

pub struct LocalOutputExecutor<N, S, D> {
    notification_executor: N,
    sound_executor: S,
    desktop_notice_executor: D,
}

impl<N, S, D> LocalOutputExecutor<N, S, D> {
    pub fn new(notification_executor: N, sound_executor: S, desktop_notice_executor: D) -> Self {
        Self {
            notification_executor,
            sound_executor,
            desktop_notice_executor,
        }
    }
}

impl NativeLocalOutputExecutor {
    pub fn from_app_handle(app: tauri::AppHandle) -> Self {
        let resource_dir = app.path().resource_dir().ok();
        LocalOutputExecutor::new(
            ThrottledNotificationExecutor::new(NativeNotificationSender::from_app_handle(
                app.clone(),
            )),
            NativeSoundExecutor::new(NativeSoundSender::from_runtime_paths(resource_dir)),
            NativeDesktopNoticeExecutor::new(NativeDesktopNoticeSender::from_app_handle(app)),
        )
    }
}

impl<N: OutputExecutor, S: OutputExecutor, D: OutputExecutor> OutputExecutor
    for LocalOutputExecutor<N, S, D>
{
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
        let _ = self.execute_with_report(result);
        Ok(())
    }

    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        let mut report = OutputExecutionReport::default();
        report.extend(self.notification_executor.execute_with_report(result));
        report.extend(self.sound_executor.execute_with_report(result));
        report.extend(self.desktop_notice_executor.execute_with_report(result));
        report
    }
}

pub struct WebhookOutputExecutor<S> {
    sender: S,
}

impl<S> WebhookOutputExecutor<S> {
    pub fn new(sender: S) -> Self {
        Self { sender }
    }

    #[cfg(test)]
    fn sender(&self) -> &S {
        &self.sender
    }
}

impl<S: Default> Default for WebhookOutputExecutor<S> {
    fn default() -> Self {
        Self::new(S::default())
    }
}

impl<S: WebhookSender> OutputExecutor for WebhookOutputExecutor<S> {
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
        let _ = self.execute_with_report(result);
        Ok(())
    }

    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        let mut report = OutputExecutionReport::default();
        for output in &result.outputs {
            if output.output_type != HardwareOutputType::Webhook {
                continue;
            }
            let Some(request) = webhook_request_from_output(output) else {
                tracing::warn!("webhook output skipped because required fields are missing");
                report.push(output.output_type, output.rule_id.clone(), false);
                continue;
            };
            match self.sender.send(request) {
                Ok(()) => report.push(output.output_type, output.rule_id.clone(), true),
                Err(error) => {
                    tracing::warn!("webhook output failed: {error}");
                    report.push(output.output_type, output.rule_id.clone(), false);
                }
            }
        }
        report
    }
}

pub struct SoundOutputExecutor<S> {
    sender: S,
    last_played_at: HashMap<String, Instant>,
}

impl<S> SoundOutputExecutor<S> {
    pub fn new(sender: S) -> Self {
        Self {
            sender,
            last_played_at: HashMap::new(),
        }
    }

    #[cfg(test)]
    fn sender(&self) -> &S {
        &self.sender
    }
}

impl<S: Default> Default for SoundOutputExecutor<S> {
    fn default() -> Self {
        Self::new(S::default())
    }
}

impl<S: SoundSender> OutputExecutor for SoundOutputExecutor<S> {
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
        let _ = self.execute_with_report(result);
        Ok(())
    }

    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        let mut report = OutputExecutionReport::default();
        for output in &result.outputs {
            if output.output_type != HardwareOutputType::Sound {
                continue;
            }
            let throttle_seconds = output.sound_throttle_seconds.unwrap_or(30);
            let throttle_key = sound_throttle_key(result, &output.rule_id);
            if self.should_throttle(&throttle_key, throttle_seconds) {
                tracing::info!(
                    "sound output throttled: key={}, throttle_seconds={}",
                    throttle_key,
                    throttle_seconds
                );
                report.push(output.output_type, output.rule_id.clone(), true);
                continue;
            }
            let Some(request) = sound_request_from_output(output) else {
                tracing::warn!("sound output skipped because required fields are missing");
                report.push(output.output_type, output.rule_id.clone(), false);
                continue;
            };
            if let Err(error) = self.sender.play(request) {
                tracing::warn!("sound output failed: {error}");
                report.push(output.output_type, output.rule_id.clone(), false);
                continue;
            }
            report.push(output.output_type, output.rule_id.clone(), true);
            self.last_played_at.insert(throttle_key, Instant::now());
        }
        report
    }
}

impl<S> SoundOutputExecutor<S> {
    fn should_throttle(&self, key: &str, throttle_seconds: u32) -> bool {
        if throttle_seconds == 0 {
            return false;
        }
        self.last_played_at.get(key).is_some_and(|played_at| {
            played_at.elapsed() < Duration::from_secs(u64::from(throttle_seconds))
        })
    }
}

pub struct DesktopNoticeOutputExecutor<S> {
    sender: S,
}

impl<S> DesktopNoticeOutputExecutor<S> {
    pub fn new(sender: S) -> Self {
        Self { sender }
    }

    #[cfg(test)]
    fn sender(&self) -> &S {
        &self.sender
    }
}

impl<S: Default> Default for DesktopNoticeOutputExecutor<S> {
    fn default() -> Self {
        Self::new(S::default())
    }
}

impl<S: DesktopNoticeSender> OutputExecutor for DesktopNoticeOutputExecutor<S> {
    fn execute(&mut self, result: &SubmitRelayEventResult) -> Result<(), String> {
        let report = self.execute_with_report(result);
        if report.has_failures() {
            return Err(stable_desktop_notice_error(
                DesktopNoticeErrorCode::InvalidRule,
            ));
        }
        Ok(())
    }

    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        let mut report = OutputExecutionReport::default();
        for output in &result.outputs {
            if output.output_type != HardwareOutputType::DesktopNotice {
                continue;
            }
            if output.desktop_notice_targets.is_empty() {
                tracing::warn!(
                    rule_id = output.rule_id,
                    "desktop notice output skipped because target list is empty"
                );
                report.push(output.output_type, output.rule_id.clone(), false);
                continue;
            }
            let mut success = true;
            for target in &output.desktop_notice_targets {
                let request = DesktopNoticeOutputRequest {
                    rule_id: output.rule_id.clone(),
                    target_id: target.target_id.clone(),
                    effect: target.effect,
                    color_mode: target.color_mode,
                    colors: target.colors.clone(),
                    duration_ms: target.duration_ms,
                    animation_period_ms: target.animation_period_ms,
                    breathing_period_ms: target.breathing_period_ms,
                    opacity_percent: target.opacity_percent,
                    brightness_percent: target.brightness_percent,
                    restore_behavior: normalize_desktop_notice_restore_behavior(
                        target.restore_behavior,
                    ),
                    edge: target.edge,
                    mascot_state: target.mascot_state,
                    mascot_action_id: target.mascot_action_id.clone(),
                    mascot_play_mode: target.mascot_play_mode,
                    mascot_playback_window_ms: target.mascot_playback_window_ms,
                    mascot_bubble_text: target.mascot_bubble_template.clone(),
                };
                if let Err(error) = self.sender.apply(request) {
                    tracing::warn!(
                        rule_id = output.rule_id,
                        target_id = target.target_id,
                        error,
                        "desktop notice output target failed"
                    );
                    success = false;
                }
            }
            report.push(output.output_type, output.rule_id.clone(), success);
        }
        report
    }
}

fn normalize_desktop_notice_restore_behavior(
    behavior: DesktopNoticeRestoreBehavior,
) -> DesktopNoticeRestoreBehavior {
    match behavior {
        DesktopNoticeRestoreBehavior::RestoreDefault => {
            DesktopNoticeRestoreBehavior::UseInstanceIdle
        }
        value => value,
    }
}

#[derive(Debug, Default)]
pub struct NoopDesktopNoticeSender;

impl DesktopNoticeSender for NoopDesktopNoticeSender {
    fn apply(&self, request: DesktopNoticeOutputRequest) -> Result<(), String> {
        tracing::info!(
            rule_id = request.rule_id,
            target_id = request.target_id,
            "desktop notice output prepared"
        );
        Ok(())
    }
}

#[derive(Clone)]
pub struct NativeDesktopNoticeSender {
    app: Option<tauri::AppHandle>,
}

impl NativeDesktopNoticeSender {
    pub fn from_app_handle(app: tauri::AppHandle) -> Self {
        Self { app: Some(app) }
    }
}

impl Default for NativeDesktopNoticeSender {
    fn default() -> Self {
        Self { app: None }
    }
}

impl DesktopNoticeSender for NativeDesktopNoticeSender {
    fn apply(&self, request: DesktopNoticeOutputRequest) -> Result<(), String> {
        let app = self.app.as_ref().ok_or_else(|| {
            stable_desktop_notice_error(DesktopNoticeErrorCode::WindowUpdateFailed)
        })?;
        let state = app.state::<crate::AppState>();
        let instance = state
            .app_config_service
            .lock()
            .map_err(|error| error.to_string())?
            .config()
            .desktop_notice_instances
            .into_iter()
            .find(|instance| instance.id == request.target_id)
            .ok_or_else(|| stable_desktop_notice_error(DesktopNoticeErrorCode::TargetNotFound))?;
        if !instance.enabled {
            return Err(stable_desktop_notice_error(
                DesktopNoticeErrorCode::TargetDisabled,
            ));
        }
        let desktop_notice_service = state
            .desktop_notice_service
            .lock()
            .map_err(|error| error.to_string())?
            .clone();
        desktop_notice_service.apply_rule_effect(app, &instance, request)
    }
}

#[derive(Debug, Default)]
pub struct AsyncReqwestWebhookSender;

impl WebhookSender for AsyncReqwestWebhookSender {
    fn send(&self, request: WebhookRequest) -> Result<(), String> {
        tauri::async_runtime::spawn(async move {
            let rule_id = request.rule_id.clone();
            if let Err(error) = send_webhook_request(request).await {
                tracing::warn!("webhook send failed: rule_id={rule_id}, error={error}");
            }
        });
        Ok(())
    }
}

#[derive(Debug, Default)]
pub struct NativeSoundSender {
    sound_asset_service: Option<SoundAssetService>,
}

impl NativeSoundSender {
    pub fn from_runtime_paths(resource_dir: Option<PathBuf>) -> Self {
        Self {
            sound_asset_service: Some(SoundAssetService::from_default_runtime_paths(resource_dir)),
        }
    }

    fn resolve_file_path(&self, file_path: &str) -> String {
        self.sound_asset_service
            .as_ref()
            .map(|service| service.resolve_sound_reference(file_path))
            .unwrap_or_else(|| file_path.to_string())
    }
}

impl SoundSender for NativeSoundSender {
    fn play(&self, request: SoundRequest) -> Result<(), String> {
        let request = SoundRequest {
            file_path: self.resolve_file_path(&request.file_path),
            ..request
        };
        tauri::async_runtime::spawn(async move {
            let rule_id = request.rule_id.clone();
            if let Err(error) = play_native_sound(request) {
                tracing::warn!("sound play failed: rule_id={rule_id}, error={error}");
            }
        });
        Ok(())
    }
}

fn webhook_request_from_output(
    output: &crate::app_services::inbound_event_service::SubmitRelayEventOutput,
) -> Option<WebhookRequest> {
    let url = output.webhook_url.as_deref()?.trim();
    if url.is_empty() {
        return None;
    }
    let method = output
        .webhook_method
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("POST")
        .to_string();
    let body = if method.eq_ignore_ascii_case("GET") {
        None
    } else {
        output
            .webhook_body
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .cloned()
    };

    Some(WebhookRequest {
        rule_id: output.rule_id.clone(),
        method,
        url: url.to_string(),
        headers_json: output
            .webhook_headers
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .cloned(),
        body,
    })
}

fn sound_request_from_output(
    output: &crate::app_services::inbound_event_service::SubmitRelayEventOutput,
) -> Option<SoundRequest> {
    let file_path = output.sound_file_path.as_deref()?.trim();
    if file_path.is_empty() {
        return None;
    }

    Some(SoundRequest {
        rule_id: output.rule_id.clone(),
        file_path: file_path.to_string(),
        volume_percent: output.sound_volume_percent.unwrap_or(80).min(100),
        max_duration_ms: output.sound_max_duration_ms.unwrap_or(3000),
    })
}

fn stable_desktop_notice_error(code: DesktopNoticeErrorCode) -> String {
    DesktopNoticeConfigError {
        code,
        detail: String::new(),
    }
    .code_string()
}

async fn send_webhook_request(request: WebhookRequest) -> Result<(), String> {
    install_rustls_provider();
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|error| format!("invalid webhook method {}: {error}", request.method))?;
    let client = reqwest::ClientBuilder::new()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("failed to build webhook http client: {error}"))?;
    let mut builder = client.request(method, &request.url);

    if let Some(headers_json) = request.headers_json.as_deref() {
        let headers = parse_webhook_headers(headers_json)?;
        for (name, value) in headers {
            builder = builder.header(name, value);
        }
    }

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("webhook request failed: {error}"))?;
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    Err(format!(
        "webhook request returned non-success status: {status}"
    ))
}

fn install_rustls_provider() {
    static INSTALL: Once = Once::new();
    INSTALL.call_once(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}

fn parse_webhook_headers(headers_json: &str) -> Result<Vec<(String, String)>, String> {
    let value = serde_json::from_str::<serde_json::Value>(headers_json)
        .map_err(|error| format!("invalid webhook headers json: {error}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| "webhook headers must be a JSON object".to_string())?;
    let mut headers = Vec::with_capacity(object.len());
    for (name, value) in object {
        let Some(header_value) = value.as_str() else {
            return Err(format!("webhook header {name} must be a string"));
        };
        headers.push((name.clone(), header_value.to_string()));
    }
    Ok(headers)
}

fn notification_throttle_key(result: &SubmitRelayEventResult, rule_id: &str) -> String {
    format!(
        "{:?}:{}:{}",
        result.event.source_tool, result.internal_event, rule_id
    )
}

fn sound_throttle_key(result: &SubmitRelayEventResult, rule_id: &str) -> String {
    format!(
        "{:?}:{}:{}",
        result.event.source_tool, result.internal_event, rule_id
    )
}

fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn windows_sound_volume(volume_percent: u8) -> String {
    let volume = f64::from(volume_percent.min(100)) / 100.0;
    format!("{volume:.2}")
}

fn windows_sound_script(request: &SoundRequest) -> String {
    let file_path = user_facing_path_text(&request.file_path);
    format!(
        "Add-Type -AssemblyName PresentationCore; \
         $player = New-Object System.Windows.Media.MediaPlayer; \
         $player.Open([System.Uri]{}); \
         $player.Volume = {}; \
         $player.Play(); \
         Start-Sleep -Milliseconds {}; \
         $player.Stop(); \
         $player.Close();",
        powershell_single_quoted(&file_path),
        windows_sound_volume(request.volume_percent),
        request.max_duration_ms.max(1)
    )
}

fn play_native_sound(request: SoundRequest) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let duration_seconds = sound_duration_seconds(request.max_duration_ms);
        let status = std::process::Command::new("afplay")
            .args([
                "-t",
                duration_seconds.as_str(),
                "-v",
                macos_sound_volume(request.volume_percent).as_str(),
                request.file_path.as_str(),
            ])
            .status()
            .map_err(|error| format!("failed to execute afplay sound: {error}"))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("afplay sound exited with status: {status}"));
    }

    #[cfg(target_os = "linux")]
    {
        let duration_seconds = format!("{}s", sound_duration_seconds(request.max_duration_ms));
        let volume = format!("--volume={}", linux_sound_volume(request.volume_percent));
        let status = std::process::Command::new("timeout")
            .args([
                duration_seconds.as_str(),
                "paplay",
                volume.as_str(),
                request.file_path.as_str(),
            ])
            .status()
            .map_err(|error| format!("failed to execute paplay sound: {error}"))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("paplay sound exited with status: {status}"));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let script = windows_sound_script(&request);
        let status = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", script.as_str()])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|error| format!("failed to execute PowerShell sound: {error}"))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("PowerShell sound exited with status: {status}"));
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = request;
        Err("native sound output is not supported on this platform".to_string())
    }
}

#[cfg(target_os = "macos")]
fn sound_duration_seconds(max_duration_ms: u32) -> String {
    let seconds = (max_duration_ms.max(1) as f64 / 1000.0).max(0.1);
    format!("{seconds:.1}")
}

#[cfg(target_os = "macos")]
fn macos_sound_volume(volume_percent: u8) -> String {
    let volume = f64::from(volume_percent.min(100)) / 100.0;
    format!("{volume:.2}")
}

#[cfg(target_os = "linux")]
fn sound_duration_seconds(max_duration_ms: u32) -> String {
    let seconds = (max_duration_ms.max(1) as f64 / 1000.0).max(0.1);
    format!("{seconds:.1}")
}

#[cfg(target_os = "linux")]
fn linux_sound_volume(volume_percent: u8) -> u32 {
    u32::from(volume_percent.min(100)) * 65_536 / 100
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_services::inbound_event_service::{
        SubmitRelayEventOutput, SubmitRelayEventResult,
    };
    use crate::core::events::{NoticeEvent, NoticeEventType, SourceTool};
    use crate::core::profiles::DesktopNoticeRuleTarget;
    use crate::core::protocol::{NoticeCommand, NoticeCommandType};
    use crate::infrastructure::desktop_notification::{
        DesktopNotificationRequest, DesktopNotificationSender,
    };
    use std::sync::{Arc, Mutex};

    #[derive(Debug, Default)]
    struct RecordingNotificationSender {
        sent: Mutex<Vec<(String, String, Option<String>)>>,
    }

    impl RecordingNotificationSender {
        fn sent_count(&self) -> usize {
            self.sent.lock().expect("sent lock").len()
        }
    }

    impl NotificationSender for RecordingNotificationSender {
        fn send(&self, title: &str, body: &str, sound: Option<&str>) -> Result<(), String> {
            self.sent.lock().expect("sent lock").push((
                title.to_string(),
                body.to_string(),
                sound.map(str::to_string),
            ));
            Ok(())
        }
    }

    #[derive(Debug, Default)]
    struct RecordingDesktopNotificationSender {
        sent: Arc<Mutex<Vec<DesktopNotificationRequest>>>,
    }

    impl DesktopNotificationSender for RecordingDesktopNotificationSender {
        fn send_notification(&self, request: DesktopNotificationRequest) -> Result<(), String> {
            self.sent.lock().expect("desktop sent lock").push(request);
            Ok(())
        }
    }

    #[derive(Debug, Default)]
    struct FailingWebhookSender {
        sent: Mutex<Vec<WebhookRequest>>,
    }

    impl FailingWebhookSender {
        fn sent_count(&self) -> usize {
            self.sent.lock().expect("sent lock").len()
        }
    }

    impl WebhookSender for FailingWebhookSender {
        fn send(&self, request: WebhookRequest) -> Result<(), String> {
            self.sent.lock().expect("sent lock").push(request);
            Err("network unavailable".to_string())
        }
    }

    #[derive(Debug, Default)]
    struct RecordingSoundSender {
        played: Mutex<Vec<SoundRequest>>,
    }

    impl RecordingSoundSender {
        fn played_count(&self) -> usize {
            self.played.lock().expect("played lock").len()
        }
    }

    impl SoundSender for RecordingSoundSender {
        fn play(&self, request: SoundRequest) -> Result<(), String> {
            self.played.lock().expect("played lock").push(request);
            Ok(())
        }
    }

    #[derive(Debug, Default)]
    struct RecordingDesktopNoticeSender {
        requests: Mutex<Vec<DesktopNoticeOutputRequest>>,
    }

    impl DesktopNoticeSender for RecordingDesktopNoticeSender {
        fn apply(&self, request: DesktopNoticeOutputRequest) -> Result<(), String> {
            self.requests
                .lock()
                .expect("desktop notice requests lock")
                .push(request);
            Ok(())
        }
    }

    #[test]
    fn native_notification_sender_delegates_to_desktop_notification_sender() {
        let sent = Arc::new(Mutex::new(Vec::new()));
        let sender = NativeNotificationSender::new(Box::new(RecordingDesktopNotificationSender {
            sent: Arc::clone(&sent),
        }));

        sender
            .send("CC Notice", "agent.completed", Some("default"))
            .expect("desktop notification should send");

        let requests = sent.lock().expect("desktop sent lock");
        assert_eq!(
            vec![DesktopNotificationRequest {
                title: "CC Notice".to_string(),
                body: "agent.completed".to_string(),
                sound: Some("default".to_string())
            }],
            *requests
        );
    }

    #[test]
    fn desktop_notice_executor_dispatches_each_target() {
        let sender = RecordingDesktopNoticeSender::default();
        let mut executor = DesktopNoticeOutputExecutor::new(sender);
        let result = SubmitRelayEventResult {
            debug_entry_id: "debug-desktop-notice".to_string(),
            event: notice_event(),
            command: show_text_command("desktop notice output queued"),
            internal_event: "agent.started".to_string(),
            device_results: Vec::new(),
            outputs: vec![desktop_notice_result_output(vec![
                "notice-a".to_string(),
                "notice-b".to_string(),
            ])],
        };

        let report = executor.execute_with_report(&result);

        assert_eq!(1, report.items.len());
        assert!(report.items[0].success);
        let requests = executor
            .sender()
            .requests
            .lock()
            .expect("desktop notice requests lock");
        assert_eq!(2, requests.len());
        assert_eq!("notice-a", requests[0].target_id);
        assert_eq!("notice-b", requests[1].target_id);
    }

    #[test]
    fn desktop_notice_executor_passes_rule_level_intensity() {
        let sender = RecordingDesktopNoticeSender::default();
        let mut executor = DesktopNoticeOutputExecutor::new(sender);
        let mut output = desktop_notice_result_output(vec!["notice-a".to_string()]);
        output.desktop_notice_targets[0].opacity_percent = Some(80);
        output.desktop_notice_targets[0].brightness_percent = Some(90);
        let result = SubmitRelayEventResult {
            debug_entry_id: "debug-desktop-notice".to_string(),
            event: notice_event(),
            command: show_text_command("desktop notice output queued"),
            internal_event: "agent.started".to_string(),
            device_results: Vec::new(),
            outputs: vec![output],
        };

        executor.execute_with_report(&result);

        let requests = executor
            .sender()
            .requests
            .lock()
            .expect("desktop notice requests lock");
        assert_eq!(Some(80), requests[0].opacity_percent);
        assert_eq!(Some(90), requests[0].brightness_percent);
    }

    #[test]
    fn desktop_notice_executor_passes_mascot_fields_to_sender() {
        let sender = RecordingDesktopNoticeSender::default();
        let mut executor = DesktopNoticeOutputExecutor::new(sender);
        let mut output = desktop_notice_result_output(vec!["mascot-1".to_string()]);
        output.desktop_notice_targets[0].mascot_state = Some(DesktopMascotState::TaskReceived);
        output.desktop_notice_targets[0].mascot_action_id = Some("task-received.wave".to_string());
        output.desktop_notice_targets[0].mascot_play_mode =
            Some(DesktopMascotPlayMode::OnceThenIdle);
        output.desktop_notice_targets[0].mascot_playback_window_ms = Some(2600);
        output.desktop_notice_targets[0].mascot_bubble_template = Some("收到任务".to_string());
        let result = SubmitRelayEventResult {
            debug_entry_id: "debug-desktop-notice".to_string(),
            event: notice_event(),
            command: show_text_command("desktop notice output queued"),
            internal_event: "agent.started".to_string(),
            device_results: Vec::new(),
            outputs: vec![output],
        };

        executor.execute_with_report(&result);

        let requests = executor
            .sender()
            .requests
            .lock()
            .expect("desktop notice requests lock");
        assert_eq!(
            Some(DesktopMascotState::TaskReceived),
            requests[0].mascot_state
        );
        assert_eq!(
            Some("task-received.wave"),
            requests[0].mascot_action_id.as_deref()
        );
        assert_eq!(
            Some(DesktopMascotPlayMode::OnceThenIdle),
            requests[0].mascot_play_mode
        );
        assert_eq!(Some(2600), requests[0].mascot_playback_window_ms);
        assert_eq!(Some("收到任务"), requests[0].mascot_bubble_text.as_deref());
    }

    #[test]
    fn desktop_notice_executor_uses_each_target_configuration() {
        let sender = RecordingDesktopNoticeSender::default();
        let mut executor = DesktopNoticeOutputExecutor::new(sender);
        let mut output =
            desktop_notice_result_output(vec!["notice-a".to_string(), "notice-b".to_string()]);
        output.desktop_notice_targets[0].effect = DesktopNoticeRuleEffect::Solid;
        output.desktop_notice_targets[0].colors = vec![DesktopNoticeColorStop {
            color: "#22C55E".to_string(),
            position: 0,
        }];
        output.desktop_notice_targets[1].effect = DesktopNoticeRuleEffect::EdgeBreathing;
        output.desktop_notice_targets[1].colors = vec![DesktopNoticeColorStop {
            color: "#EF4444".to_string(),
            position: 0,
        }];
        output.desktop_notice_targets[1].duration_ms = 5000;
        output.desktop_notice_targets[1].edge = Some(DesktopNoticeEdge::Right);
        let result = SubmitRelayEventResult {
            debug_entry_id: "debug-desktop-notice".to_string(),
            event: notice_event(),
            command: show_text_command("desktop notice output queued"),
            internal_event: "agent.started".to_string(),
            device_results: Vec::new(),
            outputs: vec![output],
        };

        executor.execute_with_report(&result);

        let requests = executor
            .sender()
            .requests
            .lock()
            .expect("desktop notice requests lock");
        assert_eq!(DesktopNoticeRuleEffect::Solid, requests[0].effect);
        assert_eq!("#22C55E", requests[0].colors[0].color);
        assert_eq!(DesktopNoticeRuleEffect::EdgeBreathing, requests[1].effect);
        assert_eq!("#EF4444", requests[1].colors[0].color);
        assert_eq!(5000, requests[1].duration_ms);
        assert_eq!(Some(DesktopNoticeEdge::Right), requests[1].edge);
    }

    fn notification_result(rule_id: &str, throttle_seconds: Option<u32>) -> SubmitRelayEventResult {
        SubmitRelayEventResult {
            debug_entry_id: format!("debug-{rule_id}"),
            event: NoticeEvent {
                source_tool: SourceTool::Codex,
                event_type: NoticeEventType::AgentStarted,
                workspace_path: None,
                session_id: None,
                message: None,
                occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
            },
            command: NoticeCommand {
                command_type: NoticeCommandType::ShowText,
                text: Some("body".to_string()),
                duration_ms: None,
                priority: 50,
            },
            internal_event: "agent.started".to_string(),
            device_results: Vec::new(),
            outputs: vec![SubmitRelayEventOutput {
                output_type: HardwareOutputType::SystemNotification,
                rule_id: rule_id.to_string(),
                command: NoticeCommand {
                    command_type: NoticeCommandType::ShowText,
                    text: Some("body".to_string()),
                    duration_ms: None,
                    priority: 50,
                },
                notification_level: Some("info".to_string()),
                notification_title: Some("title".to_string()),
                notification_body: Some("body".to_string()),
                notification_throttle_seconds: throttle_seconds,
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
                desktop_notice_targets: Vec::new(),
            }],
        }
    }

    fn desktop_notice_result_output(target_ids: Vec<String>) -> SubmitRelayEventOutput {
        SubmitRelayEventOutput {
            output_type: HardwareOutputType::DesktopNotice,
            rule_id: "desktop-notice-rule".to_string(),
            command: show_text_command("desktop notice output queued"),
            notification_level: None,
            notification_title: None,
            notification_body: None,
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
            desktop_notice_targets: target_ids
                .into_iter()
                .map(|target_id| DesktopNoticeRuleTarget {
                    target_id,
                    effect: DesktopNoticeRuleEffect::Solid,
                    color_mode: DesktopNoticeColorMode::Solid,
                    colors: vec![DesktopNoticeColorStop {
                        color: "#22C55E".to_string(),
                        position: 0,
                    }],
                    duration_ms: 3000,
                    animation_period_ms: None,
                    breathing_period_ms: None,
                    opacity_percent: None,
                    brightness_percent: None,
                    restore_behavior: DesktopNoticeRestoreBehavior::RestoreDefault,
                    edge: None,
                    mascot_state: None,
                    mascot_action_id: None,
                    mascot_play_mode: None,
                    mascot_playback_window_ms: None,
                    mascot_bubble_template: None,
                })
                .collect(),
        }
    }

    fn notice_event() -> NoticeEvent {
        NoticeEvent {
            source_tool: SourceTool::Codex,
            event_type: NoticeEventType::AgentStarted,
            workspace_path: None,
            session_id: None,
            message: None,
            occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
        }
    }

    fn show_text_command(text: &str) -> NoticeCommand {
        NoticeCommand {
            command_type: NoticeCommandType::ShowText,
            text: Some(text.to_string()),
            duration_ms: None,
            priority: 50,
        }
    }

    fn webhook_result() -> SubmitRelayEventResult {
        SubmitRelayEventResult {
            debug_entry_id: "debug-webhook".to_string(),
            event: NoticeEvent {
                source_tool: SourceTool::Codex,
                event_type: NoticeEventType::AgentStarted,
                workspace_path: None,
                session_id: None,
                message: None,
                occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
            },
            command: NoticeCommand {
                command_type: NoticeCommandType::ShowText,
                text: Some("Webhook output queued".to_string()),
                duration_ms: None,
                priority: 50,
            },
            internal_event: "agent.started".to_string(),
            device_results: Vec::new(),
            outputs: vec![SubmitRelayEventOutput {
                output_type: HardwareOutputType::Webhook,
                rule_id: "rule-webhook".to_string(),
                command: NoticeCommand {
                    command_type: NoticeCommandType::ShowText,
                    text: Some("Webhook output queued".to_string()),
                    duration_ms: None,
                    priority: 50,
                },
                notification_level: None,
                notification_title: None,
                notification_body: None,
                notification_throttle_seconds: None,
                notification_sound: None,
                webhook_method: Some("POST".to_string()),
                webhook_url: Some("https://example.test/hooks".to_string()),
                webhook_headers: Some(r#"{"X-Event":"agent.started"}"#.to_string()),
                webhook_body: Some(r#"{"event":"agent.started"}"#.to_string()),
                webhook_body_max_chars: None,
                sound_file_path: None,
                sound_volume_percent: None,
                sound_max_duration_ms: None,
                sound_throttle_seconds: None,
                desktop_notice_targets: Vec::new(),
            }],
        }
    }

    fn notification_then_webhook_result() -> SubmitRelayEventResult {
        let mut result = notification_result("rule-notification", Some(0));
        let webhook = webhook_result()
            .outputs
            .into_iter()
            .next()
            .expect("webhook output should exist");
        result.outputs.push(webhook);
        result
    }

    #[test]
    fn webhook_executor_queues_request_and_ignores_sender_failure() {
        let sender = FailingWebhookSender::default();
        let mut executor = WebhookOutputExecutor::new(sender);

        executor
            .execute(&webhook_result())
            .expect("webhook sender failure should not fail output execution");

        assert_eq!(1, executor.sender().sent_count());
    }

    #[test]
    fn combined_executor_runs_webhook_after_system_notification_output() {
        let notification_sender = RecordingNotificationSender::default();
        let webhook_sender = FailingWebhookSender::default();
        let sound_sender = RecordingSoundSender::default();
        let mut executor = CombinedOutputExecutor::new(
            ThrottledNotificationExecutor::new(notification_sender),
            WebhookOutputExecutor::new(webhook_sender),
            SoundOutputExecutor::new(sound_sender),
            DesktopNoticeOutputExecutor::new(NoopDesktopNoticeSender),
        );

        executor
            .execute(&notification_then_webhook_result())
            .expect("combined output execution should not fail");

        assert_eq!(1, executor.notification_executor.sender().sent_count());
        assert_eq!(1, executor.webhook_executor.sender().sent_count());
    }

    #[test]
    fn webhook_request_ignores_body_for_get_method() {
        let mut result = webhook_result();
        result.outputs[0].webhook_method = Some("GET".to_string());
        result.outputs[0].webhook_body = Some(r#"{"event":"agent.started"}"#.to_string());

        let request = webhook_request_from_output(&result.outputs[0])
            .expect("webhook request should be created");

        assert_eq!("GET", request.method);
        assert_eq!(None, request.body);
    }

    #[test]
    fn sound_executor_queues_configured_sound_output() {
        let sender = RecordingSoundSender::default();
        let mut executor = SoundOutputExecutor::new(sender);
        let mut result = webhook_result();
        result.outputs[0].output_type = HardwareOutputType::Sound;
        result.outputs[0].rule_id = "rule-sound".to_string();
        result.outputs[0].sound_file_path = Some("/tmp/notice.wav".to_string());
        result.outputs[0].sound_volume_percent = Some(70);
        result.outputs[0].sound_max_duration_ms = Some(2500);
        result.outputs[0].sound_throttle_seconds = Some(0);

        executor
            .execute(&result)
            .expect("sound output should be queued");

        assert_eq!(1, executor.sender().played_count());
    }

    #[test]
    fn windows_sound_script_uses_media_player_for_supported_audio_assets() {
        let request = SoundRequest {
            rule_id: "sound-preview".to_string(),
            file_path: r"\\?\C:\Users\Alice\.cc-notice\sounds\done.mp3".to_string(),
            volume_percent: 80,
            max_duration_ms: 2500,
        };

        let script = windows_sound_script(&request);

        assert!(script.contains("System.Windows.Media.MediaPlayer"));
        assert!(script.contains("PresentationCore"));
        assert!(script.contains(r"C:\Users\Alice\.cc-notice\sounds\done.mp3"));
        assert!(script.contains("Start-Sleep -Milliseconds 2500"));
        assert!(!script.contains("System.Media.SoundPlayer"));
        assert!(!script.contains(r"\\?\"));
    }

    #[test]
    fn throttled_executor_skips_repeated_notification_within_rule_window() {
        let sender = RecordingNotificationSender::default();
        let mut executor = ThrottledNotificationExecutor::new(sender);
        let result = notification_result("rule-a", Some(30));

        executor
            .execute(&result)
            .expect("first notification should send");
        executor
            .execute(&result)
            .expect("second notification should be throttled without failing");

        assert_eq!(1, executor.sender().sent_count());
    }

    #[test]
    fn throttled_executor_allows_zero_throttle_seconds() {
        let sender = RecordingNotificationSender::default();
        let mut executor = ThrottledNotificationExecutor::new(sender);
        let result = notification_result("rule-a", Some(0));

        executor
            .execute(&result)
            .expect("first notification should send");
        executor
            .execute(&result)
            .expect("second notification should send");

        assert_eq!(2, executor.sender().sent_count());
    }
}
