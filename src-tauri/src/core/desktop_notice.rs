use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashSet;

pub const MAX_DESKTOP_NOTICE_INSTANCES: usize = 16;
pub const DESKTOP_NOTICE_MIN_WIDTH: u32 = 10;
pub const DESKTOP_NOTICE_MAX_WIDTH: u32 = 2000;
pub const DESKTOP_NOTICE_MIN_HEIGHT: u32 = 10;
pub const DESKTOP_NOTICE_MAX_HEIGHT: u32 = 2000;
pub const DESKTOP_NOTICE_MIN_OPACITY_PERCENT: u8 = 10;
pub const DESKTOP_NOTICE_MAX_OPACITY_PERCENT: u8 = 100;
pub const DESKTOP_NOTICE_MIN_CORNER_RADIUS_PERCENT: u8 = 0;
pub const DESKTOP_NOTICE_MAX_CORNER_RADIUS_PERCENT: u8 = 50;
pub const DESKTOP_NOTICE_MIN_BRIGHTNESS_PERCENT: u8 = 10;
pub const DESKTOP_NOTICE_MAX_BRIGHTNESS_PERCENT: u8 = 100;
pub const DESKTOP_NOTICE_MIN_BREATHING_PERIOD_MS: u32 = 500;
pub const DESKTOP_NOTICE_MAX_BREATHING_PERIOD_MS: u32 = 5000;
pub const DESKTOP_NOTICE_MIN_BLINK_PERIOD_MS: u32 = 200;
pub const DESKTOP_NOTICE_MAX_BLINK_PERIOD_MS: u32 = 3000;
pub const DESKTOP_NOTICE_MIN_SCAN_PERIOD_MS: u32 = 500;
pub const DESKTOP_NOTICE_MAX_SCAN_PERIOD_MS: u32 = 8000;
pub const DESKTOP_NOTICE_MIN_RULE_DURATION_MS: u32 = 100;
pub const DESKTOP_NOTICE_MAX_RULE_DURATION_MS: u32 = 60_000;
pub const DESKTOP_MASCOT_MIN_PLAYBACK_WINDOW_MS: u32 = 500;
pub const DESKTOP_MASCOT_MAX_PLAYBACK_WINDOW_MS: u32 = 8000;
pub const DESKTOP_MASCOT_MIN_STAGE_WIDTH: u32 = 160;
pub const DESKTOP_MASCOT_MAX_STAGE_WIDTH: u32 = 520;
pub const DESKTOP_MASCOT_MIN_STAGE_HEIGHT: u32 = 160;
pub const DESKTOP_MASCOT_MAX_STAGE_HEIGHT: u32 = 520;
pub const DESKTOP_MASCOT_MIN_BUBBLE_FONT_SIZE_PX: u8 = 12;
pub const DESKTOP_MASCOT_MAX_BUBBLE_FONT_SIZE_PX: u8 = 20;
pub const DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_SIZE_PX: u8 = 14;
pub const G7_DESKTOP_MASCOT_ASSET_PACK_ID: &str = "g7-buddy";
pub const WARM_BUDDY_DESKTOP_MASCOT_ASSET_PACK_ID: &str = "warm-buddy";
pub const DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID: &str = G7_DESKTOP_MASCOT_ASSET_PACK_ID;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeInstance {
    pub id: String,
    pub name: String,
    pub variant: DesktopNoticeVariant,
    pub enabled: bool,
    pub show_on_startup: bool,
    pub always_on_top: bool,
    #[serde(default = "default_desktop_notice_idle_behavior")]
    pub idle_behavior: DesktopNoticeIdleBehavior,
    #[serde(default)]
    pub custom_lightbar: Option<CustomLightbarSettings>,
    #[serde(default)]
    pub edge_lightbar: Option<EdgeLightbarSettings>,
    #[serde(default)]
    pub mascot: Option<MascotSettings>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeVariant {
    #[serde(alias = "lightbar")]
    CustomLightbar,
    EdgeLightbar,
    Mascot,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLightbarSettings {
    pub preset_position: DesktopNoticePresetPosition,
    #[serde(default = "default_desktop_notice_direction")]
    pub direction: DesktopNoticeDirection,
    pub size: DesktopNoticeSize,
    #[serde(default = "default_desktop_notice_opacity_percent")]
    pub opacity_percent: u8,
    #[serde(default = "default_desktop_notice_corner_radius_percent")]
    pub corner_radius_percent: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bounds_override: Option<DesktopNoticeBounds>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeLightbarSettings {
    pub enabled_edges: Vec<DesktopNoticeScreenEdge>,
    pub thickness_px: u32,
    pub inset_px: u32,
    #[serde(default = "default_desktop_notice_opacity_percent")]
    pub opacity_percent: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MascotSettings {
    pub asset_pack_id: String,
    pub stage_size: DesktopNoticeSize,
    pub preset_position: DesktopNoticePresetPosition,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bounds_override: Option<DesktopNoticeBounds>,
    pub idle_state: DesktopMascotState,
    pub interaction_enabled: bool,
    pub bubble_enabled: bool,
    pub bubble_placement: DesktopMascotBubblePlacement,
    #[serde(default = "default_desktop_mascot_bubble_font_size_px")]
    pub bubble_font_size_px: u8,
    #[serde(default = "default_desktop_mascot_bubble_font_id")]
    pub bubble_font_id: DesktopMascotBubbleFontId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopMascotState {
    TaskReceived,
    Working,
    WaitingInput,
    Thinking,
    Success,
    Warning,
    Error,
    Idle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopMascotPlayMode {
    Default,
    Loop,
    OnceThenHold,
    OnceThenIdle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopMascotBubblePlacement {
    Top,
    TopLeft,
    TopRight,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopMascotBubbleFontId {
    SoftHandwriting,
    RoundCute,
    Comic,
    CleanSans,
    SystemDefault,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeScreenEdge {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeDefaultState {
    Hidden,
    Solid,
    Breathing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeIdleBehavior {
    Hidden,
    DimPlaceholder,
    KeepLast,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticePresetPosition {
    TopCenter,
    BottomCenter,
    LeftCenter,
    RightCenter,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Center,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeDirection {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub source_work_area: Option<DesktopNoticeWorkArea>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeWorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeAppearance {
    pub color_mode: DesktopNoticeColorMode,
    pub colors: Vec<DesktopNoticeColorStop>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeColorMode {
    Solid,
    Gradient,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeRuleEffect {
    Solid,
    Breathing,
    Blink,
    Scan,
    Fade,
    EdgeBreathing,
}

pub fn desktop_notice_animation_period_range(
    effect: DesktopNoticeRuleEffect,
) -> Option<(u32, u32)> {
    match effect {
        DesktopNoticeRuleEffect::Breathing | DesktopNoticeRuleEffect::EdgeBreathing => Some((
            DESKTOP_NOTICE_MIN_BREATHING_PERIOD_MS,
            DESKTOP_NOTICE_MAX_BREATHING_PERIOD_MS,
        )),
        DesktopNoticeRuleEffect::Blink => Some((
            DESKTOP_NOTICE_MIN_BLINK_PERIOD_MS,
            DESKTOP_NOTICE_MAX_BLINK_PERIOD_MS,
        )),
        DesktopNoticeRuleEffect::Scan => Some((
            DESKTOP_NOTICE_MIN_SCAN_PERIOD_MS,
            DESKTOP_NOTICE_MAX_SCAN_PERIOD_MS,
        )),
        DesktopNoticeRuleEffect::Solid | DesktopNoticeRuleEffect::Fade => None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeEdge {
    Auto,
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopNoticeRestoreBehavior {
    UseInstanceIdle,
    Hide,
    KeepLast,
    DimPlaceholder,
    RestoreDefault,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeColorStop {
    pub color: String,
    pub position: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeDefaultStateConfig {
    pub brightness_percent: u8,
    pub breathing_period_ms: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawDesktopNoticeInstance {
    id: String,
    name: String,
    variant: DesktopNoticeVariant,
    enabled: bool,
    show_on_startup: bool,
    always_on_top: bool,
    #[serde(default = "default_desktop_notice_idle_behavior")]
    idle_behavior: DesktopNoticeIdleBehavior,
    #[serde(default)]
    custom_lightbar: Option<CustomLightbarSettings>,
    #[serde(default)]
    edge_lightbar: Option<EdgeLightbarSettings>,
    #[serde(default)]
    mascot: Option<MascotSettings>,
    #[serde(default)]
    preset_position: Option<DesktopNoticePresetPosition>,
    #[serde(default)]
    direction: Option<DesktopNoticeDirection>,
    #[serde(default)]
    size: Option<DesktopNoticeSize>,
    #[serde(default)]
    opacity_percent: Option<u8>,
    #[serde(default)]
    corner_radius_percent: Option<u8>,
    #[serde(default)]
    bounds_override: Option<DesktopNoticeBounds>,
}

impl<'de> Deserialize<'de> for DesktopNoticeInstance {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = RawDesktopNoticeInstance::deserialize(deserializer)?;
        let custom_lightbar = migrate_legacy_custom_lightbar(raw.custom_lightbar.clone(), &raw)
            .map_err(serde::de::Error::custom)?;

        Ok(Self {
            id: raw.id,
            name: raw.name,
            variant: raw.variant,
            enabled: raw.enabled,
            show_on_startup: raw.show_on_startup,
            always_on_top: raw.always_on_top,
            idle_behavior: raw.idle_behavior,
            custom_lightbar,
            edge_lightbar: raw.edge_lightbar,
            mascot: raw.mascot,
        })
    }
}

fn migrate_legacy_custom_lightbar(
    settings: Option<CustomLightbarSettings>,
    raw: &RawDesktopNoticeInstance,
) -> Result<Option<CustomLightbarSettings>, String> {
    if raw.variant != DesktopNoticeVariant::CustomLightbar || settings.is_some() {
        return Ok(settings);
    }
    let has_legacy_lightbar_fields = raw.preset_position.is_some()
        || raw.direction.is_some()
        || raw.size.is_some()
        || raw.opacity_percent.is_some()
        || raw.corner_radius_percent.is_some()
        || raw.bounds_override.is_some();
    if !has_legacy_lightbar_fields {
        return Ok(None);
    }
    let mut migrated = CustomLightbarSettings::default();
    if let Some(preset_position) = raw.preset_position {
        migrated.preset_position = preset_position;
    }
    if let Some(direction) = raw.direction {
        migrated.direction = direction;
    }
    if let Some(size) = raw.size {
        migrated.size = size;
    }
    if let Some(opacity_percent) = raw.opacity_percent {
        migrated.opacity_percent = opacity_percent;
    }
    if let Some(corner_radius_percent) = raw.corner_radius_percent {
        migrated.corner_radius_percent = corner_radius_percent;
    }
    migrated.bounds_override = raw.bounds_override;
    Ok(Some(migrated))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DesktopNoticeErrorCode {
    InstanceLimitExceeded,
    InstanceIdRequired,
    DuplicateInstanceId,
    InstanceNameRequired,
    InstanceNameTooLong,
    InvalidSize,
    InvalidBounds,
    InvalidOpacity,
    InvalidCornerRadius,
    InvalidStateEffect,
    InvalidColor,
    InvalidColorStops,
    TargetNotFound,
    TargetDisabled,
    TargetInUse,
    InvalidRule,
    WindowCreateFailed,
    WindowUpdateFailed,
    DesktopMascotAssetPackNotFound,
    DesktopMascotActionNotFound,
    DesktopMascotStateNotFound,
    DesktopMascotRendererInitFailed,
    DesktopMascotAssetLoadFailed,
    DesktopMascotInvalidStageSize,
    DesktopMascotInvalidBubbleText,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DesktopNoticeConfigError {
    pub code: DesktopNoticeErrorCode,
    pub detail: String,
}

impl DesktopNoticeInstance {
    pub fn new_custom_lightbar(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            variant: DesktopNoticeVariant::CustomLightbar,
            enabled: true,
            show_on_startup: false,
            always_on_top: true,
            idle_behavior: DesktopNoticeIdleBehavior::Hidden,
            custom_lightbar: Some(CustomLightbarSettings::default()),
            edge_lightbar: None,
            mascot: None,
        }
    }

    pub fn new_edge_lightbar(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            variant: DesktopNoticeVariant::EdgeLightbar,
            enabled: true,
            show_on_startup: false,
            always_on_top: true,
            idle_behavior: DesktopNoticeIdleBehavior::Hidden,
            custom_lightbar: None,
            edge_lightbar: Some(EdgeLightbarSettings::default()),
            mascot: None,
        }
    }

    pub fn new_mascot(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            variant: DesktopNoticeVariant::Mascot,
            enabled: true,
            show_on_startup: true,
            always_on_top: true,
            idle_behavior: DesktopNoticeIdleBehavior::Hidden,
            custom_lightbar: None,
            edge_lightbar: None,
            mascot: Some(MascotSettings::default()),
        }
    }

    pub fn new_lightbar(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self::new_custom_lightbar(id, name)
    }
}

impl Default for CustomLightbarSettings {
    fn default() -> Self {
        Self {
            preset_position: DesktopNoticePresetPosition::TopCenter,
            direction: DesktopNoticeDirection::Horizontal,
            size: DesktopNoticeSize {
                width: 720,
                height: 32,
            },
            opacity_percent: default_desktop_notice_opacity_percent(),
            corner_radius_percent: default_desktop_notice_corner_radius_percent(),
            bounds_override: None,
        }
    }
}

impl Default for EdgeLightbarSettings {
    fn default() -> Self {
        Self {
            enabled_edges: vec![
                DesktopNoticeScreenEdge::Top,
                DesktopNoticeScreenEdge::Bottom,
            ],
            thickness_px: 18,
            inset_px: 0,
            opacity_percent: default_desktop_notice_opacity_percent(),
        }
    }
}

impl Default for MascotSettings {
    fn default() -> Self {
        Self {
            asset_pack_id: DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID.to_string(),
            stage_size: DesktopNoticeSize {
                width: 260,
                height: 260,
            },
            preset_position: DesktopNoticePresetPosition::BottomRight,
            bounds_override: None,
            idle_state: DesktopMascotState::Idle,
            interaction_enabled: false,
            bubble_enabled: false,
            bubble_placement: DesktopMascotBubblePlacement::TopRight,
            bubble_font_size_px: DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_SIZE_PX,
            bubble_font_id: DesktopMascotBubbleFontId::SoftHandwriting,
        }
    }
}

fn default_desktop_notice_direction() -> DesktopNoticeDirection {
    DesktopNoticeDirection::Horizontal
}

fn default_desktop_notice_opacity_percent() -> u8 {
    DESKTOP_NOTICE_MAX_OPACITY_PERCENT
}

fn default_desktop_notice_corner_radius_percent() -> u8 {
    DESKTOP_NOTICE_MIN_CORNER_RADIUS_PERCENT
}

fn default_desktop_notice_idle_behavior() -> DesktopNoticeIdleBehavior {
    DesktopNoticeIdleBehavior::Hidden
}

fn default_desktop_mascot_bubble_font_size_px() -> u8 {
    DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_SIZE_PX
}

fn default_desktop_mascot_bubble_font_id() -> DesktopMascotBubbleFontId {
    DesktopMascotBubbleFontId::SoftHandwriting
}

impl Default for DesktopNoticeDefaultStateConfig {
    fn default() -> Self {
        Self {
            brightness_percent: DESKTOP_NOTICE_MAX_BRIGHTNESS_PERCENT,
            breathing_period_ms: 1600,
        }
    }
}

impl DesktopNoticeConfigError {
    fn new(code: DesktopNoticeErrorCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
        }
    }

    pub fn code_string(&self) -> String {
        let suffix = serde_json::to_value(self.code)
            .ok()
            .and_then(|value| value.as_str().map(ToString::to_string))
            .unwrap_or_else(|| "INVALID_CONFIG".to_string());
        format!("DESKTOP_NOTICE_{suffix}")
    }
}

pub fn validate_desktop_notice_instances(
    instances: &[DesktopNoticeInstance],
) -> Result<(), DesktopNoticeConfigError> {
    if instances.len() > MAX_DESKTOP_NOTICE_INSTANCES {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InstanceLimitExceeded,
            "too many desktop notice instances",
        ));
    }

    let mut ids = HashSet::new();
    for instance in instances {
        validate_instance_identity(instance, &mut ids)?;
        validate_instance_settings(instance)?;
    }

    Ok(())
}

pub fn sanitize_desktop_notice_instances(instances: &mut Vec<DesktopNoticeInstance>) {
    for instance in instances.iter_mut() {
        sanitize_instance_settings(instance);
    }
    let mut seen = HashSet::new();
    instances.retain(|instance| {
        !instance.id.trim().is_empty()
            && !instance.name.trim().is_empty()
            && seen.insert(instance.id.clone())
            && validate_instance_settings(instance).is_ok()
    });
    instances.truncate(MAX_DESKTOP_NOTICE_INSTANCES);
}

fn sanitize_instance_settings(instance: &mut DesktopNoticeInstance) {
    match instance.variant {
        DesktopNoticeVariant::CustomLightbar => {
            let mut settings = instance.custom_lightbar.unwrap_or_default();
            settings.size.width = settings
                .size
                .width
                .clamp(DESKTOP_NOTICE_MIN_WIDTH, DESKTOP_NOTICE_MAX_WIDTH);
            settings.size.height = settings
                .size
                .height
                .clamp(DESKTOP_NOTICE_MIN_HEIGHT, DESKTOP_NOTICE_MAX_HEIGHT);
            settings.opacity_percent = settings.opacity_percent.clamp(
                DESKTOP_NOTICE_MIN_OPACITY_PERCENT,
                DESKTOP_NOTICE_MAX_OPACITY_PERCENT,
            );
            settings.corner_radius_percent = settings.corner_radius_percent.clamp(
                DESKTOP_NOTICE_MIN_CORNER_RADIUS_PERCENT,
                DESKTOP_NOTICE_MAX_CORNER_RADIUS_PERCENT,
            );
            if let Some(bounds) = settings.bounds_override.as_mut() {
                bounds.width = bounds
                    .width
                    .clamp(DESKTOP_NOTICE_MIN_WIDTH, DESKTOP_NOTICE_MAX_WIDTH);
                bounds.height = bounds
                    .height
                    .clamp(DESKTOP_NOTICE_MIN_HEIGHT, DESKTOP_NOTICE_MAX_HEIGHT);
                if matches!(
                    bounds.source_work_area,
                    Some(DesktopNoticeWorkArea { width: 0, .. })
                        | Some(DesktopNoticeWorkArea { height: 0, .. })
                ) {
                    bounds.source_work_area = None;
                }
            }
            instance.custom_lightbar = Some(settings);
            instance.edge_lightbar = None;
            instance.mascot = None;
        }
        DesktopNoticeVariant::EdgeLightbar => {
            let mut settings = instance.edge_lightbar.clone().unwrap_or_default();
            let mut edges = HashSet::new();
            settings.enabled_edges.retain(|edge| edges.insert(*edge));
            if settings.enabled_edges.is_empty() {
                settings.enabled_edges = EdgeLightbarSettings::default().enabled_edges;
            }
            settings.thickness_px = settings
                .thickness_px
                .clamp(DESKTOP_NOTICE_MIN_HEIGHT, DESKTOP_NOTICE_MAX_HEIGHT);
            settings.inset_px = settings.inset_px.min(DESKTOP_NOTICE_MAX_WIDTH);
            settings.opacity_percent = settings.opacity_percent.clamp(
                DESKTOP_NOTICE_MIN_OPACITY_PERCENT,
                DESKTOP_NOTICE_MAX_OPACITY_PERCENT,
            );
            instance.custom_lightbar = None;
            instance.edge_lightbar = Some(settings);
            instance.mascot = None;
        }
        DesktopNoticeVariant::Mascot => {
            let mut settings = instance.mascot.clone().unwrap_or_default();
            if instance.idle_behavior != DesktopNoticeIdleBehavior::Hidden {
                instance.idle_behavior = DesktopNoticeIdleBehavior::DimPlaceholder;
            }
            settings.stage_size.width = settings.stage_size.width.clamp(
                DESKTOP_MASCOT_MIN_STAGE_WIDTH,
                DESKTOP_MASCOT_MAX_STAGE_WIDTH,
            );
            settings.stage_size.height = settings.stage_size.height.clamp(
                DESKTOP_MASCOT_MIN_STAGE_HEIGHT,
                DESKTOP_MASCOT_MAX_STAGE_HEIGHT,
            );
            settings.bubble_font_size_px = settings.bubble_font_size_px.clamp(
                DESKTOP_MASCOT_MIN_BUBBLE_FONT_SIZE_PX,
                DESKTOP_MASCOT_MAX_BUBBLE_FONT_SIZE_PX,
            );
            if settings.asset_pack_id.trim().is_empty() {
                settings.asset_pack_id = DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID.to_string();
            }
            if let Some(bounds) = settings.bounds_override.as_mut() {
                if matches!(
                    bounds.source_work_area,
                    Some(DesktopNoticeWorkArea { width: 0, .. })
                        | Some(DesktopNoticeWorkArea { height: 0, .. })
                ) {
                    bounds.source_work_area = None;
                }
            }
            instance.custom_lightbar = None;
            instance.edge_lightbar = None;
            instance.mascot = Some(settings);
        }
    }
}

fn validate_instance_settings(
    instance: &DesktopNoticeInstance,
) -> Result<(), DesktopNoticeConfigError> {
    match instance.variant {
        DesktopNoticeVariant::CustomLightbar => {
            let settings = instance.custom_lightbar.as_ref().ok_or_else(|| {
                DesktopNoticeConfigError::new(
                    DesktopNoticeErrorCode::InvalidRule,
                    format!(
                        "desktop notice instance {} missing custom lightbar settings",
                        instance.id
                    ),
                )
            })?;
            validate_custom_lightbar_settings(settings)
        }
        DesktopNoticeVariant::EdgeLightbar => {
            let settings = instance.edge_lightbar.as_ref().ok_or_else(|| {
                DesktopNoticeConfigError::new(
                    DesktopNoticeErrorCode::InvalidRule,
                    format!(
                        "desktop notice instance {} missing edge lightbar settings",
                        instance.id
                    ),
                )
            })?;
            validate_edge_lightbar_settings(settings)
        }
        DesktopNoticeVariant::Mascot => {
            let settings = instance.mascot.as_ref().ok_or_else(|| {
                DesktopNoticeConfigError::new(
                    DesktopNoticeErrorCode::DesktopMascotInvalidStageSize,
                    format!(
                        "desktop mascot instance {} missing mascot settings",
                        instance.id
                    ),
                )
            })?;
            validate_mascot_settings(settings)
        }
    }
}

fn validate_custom_lightbar_settings(
    settings: &CustomLightbarSettings,
) -> Result<(), DesktopNoticeConfigError> {
    validate_size(settings.size, settings.direction)?;
    validate_opacity_percent(settings.opacity_percent)?;
    validate_corner_radius_percent(settings.corner_radius_percent)?;
    if let Some(bounds) = settings.bounds_override {
        validate_size(
            DesktopNoticeSize {
                width: bounds.width,
                height: bounds.height,
            },
            settings.direction,
        )
        .map_err(|_| {
            DesktopNoticeConfigError::new(
                DesktopNoticeErrorCode::InvalidBounds,
                "desktop notice bounds are outside allowed size",
            )
        })?;
        if let Some(source_work_area) = bounds.source_work_area {
            if source_work_area.width == 0 || source_work_area.height == 0 {
                return Err(DesktopNoticeConfigError::new(
                    DesktopNoticeErrorCode::InvalidBounds,
                    "desktop notice source work area is invalid",
                ));
            }
        }
    }
    Ok(())
}

fn validate_edge_lightbar_settings(
    settings: &EdgeLightbarSettings,
) -> Result<(), DesktopNoticeConfigError> {
    if settings.enabled_edges.is_empty() {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidRule,
            "desktop notice edge lightbar requires at least one enabled edge",
        ));
    }
    let mut edges = HashSet::new();
    if !settings
        .enabled_edges
        .iter()
        .all(|edge| edges.insert(*edge))
    {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidRule,
            "desktop notice edge lightbar has duplicate edges",
        ));
    }
    if !(DESKTOP_NOTICE_MIN_HEIGHT..=DESKTOP_NOTICE_MAX_HEIGHT).contains(&settings.thickness_px) {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidSize,
            "desktop notice edge lightbar thickness is outside allowed range",
        ));
    }
    if settings.inset_px > DESKTOP_NOTICE_MAX_WIDTH {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidBounds,
            "desktop notice edge lightbar inset is outside allowed range",
        ));
    }
    validate_opacity_percent(settings.opacity_percent)?;
    Ok(())
}

fn validate_mascot_settings(settings: &MascotSettings) -> Result<(), DesktopNoticeConfigError> {
    if !is_supported_mascot_asset_pack_id(&settings.asset_pack_id) {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::DesktopMascotAssetPackNotFound,
            "desktop mascot asset pack id is invalid",
        ));
    }
    if !(DESKTOP_MASCOT_MIN_STAGE_WIDTH..=DESKTOP_MASCOT_MAX_STAGE_WIDTH)
        .contains(&settings.stage_size.width)
        || !(DESKTOP_MASCOT_MIN_STAGE_HEIGHT..=DESKTOP_MASCOT_MAX_STAGE_HEIGHT)
            .contains(&settings.stage_size.height)
    {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::DesktopMascotInvalidStageSize,
            "desktop mascot stage size is outside allowed range",
        ));
    }
    if !(DESKTOP_MASCOT_MIN_BUBBLE_FONT_SIZE_PX..=DESKTOP_MASCOT_MAX_BUBBLE_FONT_SIZE_PX)
        .contains(&settings.bubble_font_size_px)
    {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidRule,
            "desktop mascot bubble font size is outside allowed range",
        ));
    }
    Ok(())
}

pub fn is_registered_mascot_asset_pack(asset_pack_id: &str) -> bool {
    matches!(
        asset_pack_id,
        G7_DESKTOP_MASCOT_ASSET_PACK_ID | WARM_BUDDY_DESKTOP_MASCOT_ASSET_PACK_ID
    )
}

fn is_supported_mascot_asset_pack_id(asset_pack_id: &str) -> bool {
    is_registered_mascot_asset_pack(asset_pack_id)
        || (!asset_pack_id.is_empty()
            && asset_pack_id.bytes().all(|byte| {
                byte.is_ascii_lowercase()
                    || byte.is_ascii_digit()
                    || matches!(byte, b'-' | b'_' | b'.')
            }))
}

fn validate_instance_identity(
    instance: &DesktopNoticeInstance,
    ids: &mut HashSet<String>,
) -> Result<(), DesktopNoticeConfigError> {
    if instance.id.trim().is_empty() {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InstanceIdRequired,
            "desktop notice instance id is required",
        ));
    }
    if !ids.insert(instance.id.clone()) {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::DuplicateInstanceId,
            "duplicate desktop notice instance id",
        ));
    }
    let name = instance.name.trim();
    if name.is_empty() {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InstanceNameRequired,
            "desktop notice instance name is required",
        ));
    }
    if name.chars().count() > 40 {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InstanceNameTooLong,
            "desktop notice instance name is too long",
        ));
    }
    Ok(())
}

fn validate_size(
    size: DesktopNoticeSize,
    _direction: DesktopNoticeDirection,
) -> Result<(), DesktopNoticeConfigError> {
    if !(DESKTOP_NOTICE_MIN_WIDTH..=DESKTOP_NOTICE_MAX_WIDTH).contains(&size.width)
        || !(DESKTOP_NOTICE_MIN_HEIGHT..=DESKTOP_NOTICE_MAX_HEIGHT).contains(&size.height)
    {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidSize,
            "desktop notice size is outside allowed range",
        ));
    }
    Ok(())
}

fn validate_corner_radius_percent(
    corner_radius_percent: u8,
) -> Result<(), DesktopNoticeConfigError> {
    if !(DESKTOP_NOTICE_MIN_CORNER_RADIUS_PERCENT..=DESKTOP_NOTICE_MAX_CORNER_RADIUS_PERCENT)
        .contains(&corner_radius_percent)
    {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidCornerRadius,
            "desktop notice corner radius is outside allowed range",
        ));
    }
    Ok(())
}

fn validate_opacity_percent(opacity_percent: u8) -> Result<(), DesktopNoticeConfigError> {
    if !(DESKTOP_NOTICE_MIN_OPACITY_PERCENT..=DESKTOP_NOTICE_MAX_OPACITY_PERCENT)
        .contains(&opacity_percent)
    {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidOpacity,
            "desktop notice opacity is outside allowed range",
        ));
    }
    Ok(())
}

pub fn validate_desktop_notice_appearance(
    appearance: &DesktopNoticeAppearance,
) -> Result<(), DesktopNoticeConfigError> {
    let expected = match appearance.color_mode {
        DesktopNoticeColorMode::Solid => 1..=1,
        DesktopNoticeColorMode::Gradient => 2..=4,
    };
    if !expected.contains(&appearance.colors.len()) {
        return Err(DesktopNoticeConfigError::new(
            DesktopNoticeErrorCode::InvalidColorStops,
            "desktop notice color stop count is invalid",
        ));
    }
    for color in &appearance.colors {
        if !is_hex_color(&color.color) || color.position > 100 {
            return Err(DesktopNoticeConfigError::new(
                DesktopNoticeErrorCode::InvalidColor,
                "desktop notice color is invalid",
            ));
        }
    }
    Ok(())
}

fn is_hex_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_instance_is_valid_lightbar_with_hidden_state() {
        let instance = DesktopNoticeInstance::new_lightbar("desk-1", "主灯条");

        validate_desktop_notice_instances(&[instance.clone()]).expect("instance should be valid");

        assert_eq!(DesktopNoticeVariant::CustomLightbar, instance.variant);
        assert_eq!(DesktopNoticeIdleBehavior::Hidden, instance.idle_behavior);
        let settings = instance
            .custom_lightbar
            .expect("custom lightbar settings should exist");
        assert_eq!(DesktopNoticeDirection::Horizontal, settings.direction);
        assert_eq!(0, settings.corner_radius_percent);
        assert_eq!(720, settings.size.width);
        assert_eq!(32, settings.size.height);
        assert!(instance.enabled);
        assert!(!instance.show_on_startup);
    }

    #[test]
    fn new_desktop_notice_instance_defaults_to_custom_lightbar() {
        let instance = DesktopNoticeInstance::new_custom_lightbar("desk-1", "桌面提示");

        assert_eq!(DesktopNoticeVariant::CustomLightbar, instance.variant);
        assert!(instance.custom_lightbar.is_some());
        assert!(instance.edge_lightbar.is_none());
    }

    #[test]
    fn edge_lightbar_requires_at_least_one_enabled_edge() {
        let mut instance = DesktopNoticeInstance::new_edge_lightbar("desk-1", "屏幕边缘");
        instance
            .edge_lightbar
            .as_mut()
            .expect("edge settings should exist")
            .enabled_edges
            .clear();

        let error = validate_desktop_notice_instances(&[instance]).expect_err("edge is required");

        assert_eq!(DesktopNoticeErrorCode::InvalidRule, error.code);
    }

    #[test]
    fn loads_custom_lightbar_settings() {
        let instance: DesktopNoticeInstance = serde_json::from_str(
            r##"{
                "id": "desk-1",
                "name": "主灯条",
                "variant": "custom-lightbar",
                "enabled": true,
                "showOnStartup": false,
                "alwaysOnTop": true,
                "idleBehavior": "hidden",
                "customLightbar": {
                    "presetPosition": "top-center",
                    "size": { "width": 720, "height": 32 },
                    "opacityPercent": 100,
                    "cornerRadiusPercent": 0,
                    "boundsOverride": null
                }
            }"##,
        )
        .expect("custom lightbar instance should load");

        let settings = instance
            .custom_lightbar
            .expect("custom lightbar settings should exist");
        assert_eq!(DesktopNoticeDirection::Horizontal, settings.direction);
        assert_eq!(100, settings.opacity_percent);
        assert_eq!(0, settings.corner_radius_percent);
    }

    #[test]
    fn loads_legacy_flat_lightbar_instance_as_custom_lightbar() {
        let instance: DesktopNoticeInstance = serde_json::from_str(
            r##"{
                "id": "desktop-notice-legacy",
                "name": "旧灯条",
                "variant": "lightbar",
                "enabled": true,
                "showOnStartup": false,
                "alwaysOnTop": true,
                "presetPosition": "custom",
                "direction": "horizontal",
                "size": { "width": 1895, "height": 70 },
                "opacityPercent": 100,
                "cornerRadiusPercent": 50,
                "idleBehavior": "hidden",
                "boundsOverride": {
                    "x": 738,
                    "y": 1390,
                    "width": 1895,
                    "height": 50,
                    "sourceWorkArea": {
                        "x": 0,
                        "y": 25,
                        "width": 3440,
                        "height": 1415
                    }
                },
                "defaultState": "hidden",
                "defaultStateConfig": {
                    "brightnessPercent": 100,
                    "breathingPeriodMs": 1600
                },
                "defaultAppearance": {
                    "colorMode": "solid",
                    "colors": [{ "color": "#22C55E", "position": 0 }]
                }
            }"##,
        )
        .expect("legacy flat lightbar instance should load");

        assert_eq!(DesktopNoticeVariant::CustomLightbar, instance.variant);
        assert!(instance.edge_lightbar.is_none());
        let settings = instance
            .custom_lightbar
            .expect("legacy lightbar settings should migrate into customLightbar");
        assert_eq!(
            DesktopNoticePresetPosition::Custom,
            settings.preset_position
        );
        assert_eq!(DesktopNoticeDirection::Horizontal, settings.direction);
        assert_eq!(1895, settings.size.width);
        assert_eq!(70, settings.size.height);
        assert_eq!(50, settings.corner_radius_percent);
        assert_eq!(
            Some(DesktopNoticeBounds {
                x: 738,
                y: 1390,
                width: 1895,
                height: 50,
                source_work_area: Some(DesktopNoticeWorkArea {
                    x: 0,
                    y: 25,
                    width: 3440,
                    height: 1415,
                }),
            }),
            settings.bounds_override
        );
        validate_desktop_notice_instances(&[instance]).expect("migrated instance should be valid");
    }

    #[test]
    fn rejects_invalid_opacity_with_stable_error_code() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "主灯条");
        instance
            .custom_lightbar
            .as_mut()
            .expect("custom lightbar settings should exist")
            .opacity_percent = 5;

        let error = validate_desktop_notice_instances(&[instance]).expect_err("invalid opacity");

        assert_eq!(DesktopNoticeErrorCode::InvalidOpacity, error.code);
        assert_eq!("DESKTOP_NOTICE_INVALID_OPACITY", error.code_string());
    }

    #[test]
    fn loads_custom_preset_position() {
        let instance: DesktopNoticeInstance = serde_json::from_str(
            r##"{
                "id": "desk-1",
                "name": "主灯条",
                "variant": "custom-lightbar",
                "enabled": true,
                "showOnStartup": false,
                "alwaysOnTop": true,
                "idleBehavior": "hidden",
                "customLightbar": {
                    "presetPosition": "custom",
                    "direction": "horizontal",
                    "size": { "width": 720, "height": 32 },
                    "opacityPercent": 100,
                    "cornerRadiusPercent": 0,
                    "boundsOverride": { "x": 120, "y": 160, "width": 720, "height": 32 }
                }
            }"##,
        )
        .expect("custom position should load");

        let settings = instance
            .custom_lightbar
            .expect("custom lightbar settings should exist");
        assert_eq!(
            DesktopNoticePresetPosition::Custom,
            settings.preset_position
        );
    }

    #[test]
    fn accepts_vertical_lightbar_size_using_height_as_length() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "侧边灯条");
        let settings = instance
            .custom_lightbar
            .as_mut()
            .expect("custom lightbar settings should exist");
        settings.direction = DesktopNoticeDirection::Vertical;
        settings.size = DesktopNoticeSize {
            width: 10,
            height: 10,
        };

        validate_desktop_notice_instances(&[instance]).expect("vertical lightbar should be valid");
    }

    #[test]
    fn rejects_invalid_corner_radius_with_stable_error_code() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "主灯条");
        instance
            .custom_lightbar
            .as_mut()
            .expect("custom lightbar settings should exist")
            .corner_radius_percent = 55;

        let error =
            validate_desktop_notice_instances(&[instance]).expect_err("invalid corner radius");

        assert_eq!(DesktopNoticeErrorCode::InvalidCornerRadius, error.code);
        assert_eq!("DESKTOP_NOTICE_INVALID_CORNER_RADIUS", error.code_string());
    }

    #[test]
    fn rejects_missing_custom_lightbar_settings_with_stable_error_code() {
        let mut instance = DesktopNoticeInstance::new_lightbar("desk-1", "主灯条");
        instance.custom_lightbar = None;

        let error = validate_desktop_notice_instances(&[instance]).expect_err("missing settings");

        assert_eq!(DesktopNoticeErrorCode::InvalidRule, error.code);
        assert_eq!("DESKTOP_NOTICE_INVALID_RULE", error.code_string());
    }

    #[test]
    fn sanitize_repairs_missing_lightbar_settings_instead_of_dropping_instance() {
        let mut instances = vec![DesktopNoticeInstance {
            id: "desk-1".to_string(),
            name: "主灯条".to_string(),
            variant: DesktopNoticeVariant::CustomLightbar,
            enabled: true,
            show_on_startup: false,
            always_on_top: true,
            idle_behavior: DesktopNoticeIdleBehavior::Hidden,
            custom_lightbar: None,
            edge_lightbar: None,
            mascot: None,
        }];

        sanitize_desktop_notice_instances(&mut instances);

        assert_eq!(1, instances.len());
        assert!(instances[0].custom_lightbar.is_some());
        validate_desktop_notice_instances(&instances).expect("sanitized instance should be valid");
    }

    #[test]
    fn mascot_instance_is_valid_with_default_settings() {
        let instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");

        validate_desktop_notice_instances(&[instance.clone()])
            .expect("mascot instance should be valid");

        assert_eq!(DesktopNoticeIdleBehavior::Hidden, instance.idle_behavior);
        let mascot = instance.mascot.expect("mascot settings should exist");
        assert!(!mascot.interaction_enabled);
        assert!(!mascot.bubble_enabled);
    }

    #[test]
    fn mascot_instance_accepts_bundled_g7_and_warm_buddy_asset_packs() {
        let g7_instance = DesktopNoticeInstance::new_mascot("mascot-g7", "G7 精灵");
        let mut warm_instance = DesktopNoticeInstance::new_mascot("mascot-warm", "暖萌机器人");
        warm_instance
            .mascot
            .as_mut()
            .expect("mascot settings should exist")
            .asset_pack_id = WARM_BUDDY_DESKTOP_MASCOT_ASSET_PACK_ID.to_string();

        validate_desktop_notice_instances(&[g7_instance, warm_instance])
            .expect("bundled mascot asset packs should be valid");
    }

    #[test]
    fn mascot_instance_accepts_custom_asset_pack_id_format() {
        let mut instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");
        instance
            .mascot
            .as_mut()
            .expect("mascot settings should exist")
            .asset_pack_id = "my-custom.mascot_1".to_string();

        validate_desktop_notice_instances(&[instance])
            .expect("custom mascot asset pack id should be accepted by config validation");
    }

    #[test]
    fn mascot_instance_rejects_invalid_asset_pack_id_format() {
        let mut instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");
        instance
            .mascot
            .as_mut()
            .expect("mascot settings should exist")
            .asset_pack_id = "Bad Pack".to_string();

        let error = validate_desktop_notice_instances(&[instance])
            .expect_err("invalid pack id format should fail");

        assert_eq!(
            DesktopNoticeErrorCode::DesktopMascotAssetPackNotFound,
            error.code
        );
    }

    #[test]
    fn sanitize_mascot_instance_clamps_stage_size() {
        let mut instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");
        instance
            .mascot
            .as_mut()
            .expect("mascot settings should exist")
            .stage_size = DesktopNoticeSize {
            width: 10_000,
            height: 10_000,
        };
        let mut instances = vec![instance];

        sanitize_desktop_notice_instances(&mut instances);

        let mascot = instances[0]
            .mascot
            .as_ref()
            .expect("mascot settings should remain");
        assert_eq!(520, mascot.stage_size.width);
        assert_eq!(520, mascot.stage_size.height);
        validate_desktop_notice_instances(&instances).expect("sanitized mascot should be valid");
    }

    #[test]
    fn sanitize_mascot_instance_normalizes_keep_last_idle_behavior_to_resident() {
        let mut instance = DesktopNoticeInstance::new_mascot("mascot-1", "桌面精灵");
        instance.idle_behavior = DesktopNoticeIdleBehavior::KeepLast;
        let mut instances = vec![instance];

        sanitize_desktop_notice_instances(&mut instances);

        assert_eq!(
            DesktopNoticeIdleBehavior::DimPlaceholder,
            instances[0].idle_behavior
        );
    }

    #[test]
    fn rejects_duplicate_instance_ids_with_stable_error_code() {
        let instances = vec![
            DesktopNoticeInstance::new_lightbar("desk-1", "主灯条"),
            DesktopNoticeInstance::new_lightbar("desk-1", "备用灯条"),
        ];

        let error = validate_desktop_notice_instances(&instances).expect_err("duplicate id");

        assert_eq!(DesktopNoticeErrorCode::DuplicateInstanceId, error.code);
    }

    #[test]
    fn rejects_invalid_rule_appearance_with_stable_error_code() {
        let appearance = DesktopNoticeAppearance {
            color_mode: DesktopNoticeColorMode::Solid,
            colors: vec![DesktopNoticeColorStop {
                color: "red".to_string(),
                position: 0,
            }],
        };

        let error =
            validate_desktop_notice_appearance(&appearance).expect_err("invalid appearance");

        assert_eq!(DesktopNoticeErrorCode::InvalidColor, error.code);
        assert_eq!("DESKTOP_NOTICE_INVALID_COLOR", error.code_string());
    }
}
