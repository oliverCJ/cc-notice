use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::app_services::sound_asset_service::builtin_sound_reference;
use crate::core::desktop_notice::{
    is_registered_mascot_asset_pack, validate_desktop_notice_instances, DesktopNoticeInstance,
    DesktopNoticeVariant,
};
use crate::core::device::{
    DeviceChannelActionType, DeviceChannelKind, DeviceConnectionStatus, DeviceRuntimeState,
};
use crate::core::internal_events::builtin_internal_event_ids;
use crate::core::profiles::{HardwareOutputType, HardwareRule, NoticeProfile, DEFAULT_PROFILE_ID};
use crate::utils::profile_utils::generate_profile_id;

pub const PROFILE_PACKAGE_SCHEMA_VERSION: u16 = 2;
const PROFILE_PACKAGE_MIN_SUPPORTED_SCHEMA_VERSION: u16 = 1;
pub const PROFILE_PACKAGE_KIND: &str = "cc-notice-profile-package";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackage {
    pub schema_version: u16,
    pub kind: String,
    pub exported_at: String,
    pub app_version: String,
    pub profile: NoticeProfile,
    #[serde(default)]
    pub device_rule_hints: Vec<ProfilePackageDeviceRuleHint>,
    #[serde(default)]
    pub desktop_notice_instances: Vec<DesktopNoticeInstance>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageDeviceRuleHint {
    pub source_device_key: String,
    pub board_id: Option<String>,
    pub requirements: Vec<ProfilePackageDeviceRequirement>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageDeviceRequirement {
    pub rule_id: String,
    pub output_type: HardwareOutputType,
    pub channel_id: Option<String>,
    pub channel_kind: Option<DeviceChannelKind>,
    pub action: Option<DeviceChannelActionType>,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProfilePackageDeviceBindingStatus {
    FullMatch,
    PartialMatch,
    BoardMismatch,
    Unbound,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageDeviceBinding {
    pub source_device_key: String,
    pub target_device_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageImportPreview {
    pub source_profile_name: String,
    pub imported_profile_name: String,
    pub enabled_hook_event_count: usize,
    pub ai_mapping_count: usize,
    pub output_rule_count: usize,
    pub device_rule_count: usize,
    pub desktop_notice_instance_count: usize,
    pub custom_mascot_asset_pack_ids: Vec<String>,
    pub device_groups: Vec<ProfilePackageDeviceGroupPreview>,
    pub hook_config_sync_required: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageDeviceGroupPreview {
    pub source_device_key: String,
    pub board_id: Option<String>,
    pub requirement_count: usize,
    pub candidates: Vec<ProfilePackageDeviceCandidate>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageDeviceCandidate {
    pub device_id: String,
    pub board_id: Option<String>,
    pub status: ProfilePackageDeviceBindingStatus,
    pub missing_requirements: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePackageImportRequest {
    pub package_path: String,
    pub bindings: Vec<ProfilePackageDeviceBinding>,
    pub activate: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedProfilePackage {
    pub profile: NoticeProfile,
    pub desktop_notice_instances: Vec<DesktopNoticeInstance>,
}

pub struct ProfilePackageService;

impl ProfilePackageService {
    pub fn export_package(profile: &NoticeProfile, exported_at: &str) -> ProfilePackage {
        Self::export_package_with_device_board_ids_and_desktop_notice_instances(
            profile,
            exported_at,
            &HashMap::new(),
            &[],
        )
    }

    pub fn export_package_with_device_board_ids(
        profile: &NoticeProfile,
        exported_at: &str,
        device_board_ids: &HashMap<String, String>,
    ) -> ProfilePackage {
        Self::export_package_with_device_board_ids_and_desktop_notice_instances(
            profile,
            exported_at,
            device_board_ids,
            &[],
        )
    }

    pub fn export_package_with_device_board_ids_and_desktop_notice_instances(
        profile: &NoticeProfile,
        exported_at: &str,
        device_board_ids: &HashMap<String, String>,
        desktop_notice_instances: &[DesktopNoticeInstance],
    ) -> ProfilePackage {
        let source_device_key_map = build_source_device_key_map(profile);
        let source_device_board_ids =
            build_source_device_board_ids(&source_device_key_map, device_board_ids);
        let source_desktop_notice_key_map = build_source_desktop_notice_key_map(profile);
        let desktop_notice_instances = collect_desktop_notice_instance_templates(
            desktop_notice_instances,
            &source_desktop_notice_key_map,
        );
        let profile = sanitize_export_profile(profile, &source_desktop_notice_key_map);
        ProfilePackage {
            schema_version: PROFILE_PACKAGE_SCHEMA_VERSION,
            kind: PROFILE_PACKAGE_KIND.to_string(),
            exported_at: exported_at.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            device_rule_hints: collect_device_rule_hints(&profile, &source_device_board_ids),
            desktop_notice_instances,
            profile,
        }
    }

    pub fn parse_package(content: &str) -> Result<ProfilePackage, String> {
        let package: ProfilePackage = serde_json::from_str(content)
            .map_err(|error| format!("profile_package_invalid_json:{error}"))?;
        if package.kind != PROFILE_PACKAGE_KIND {
            return Err("profile_package_invalid_kind".to_string());
        }
        if package.schema_version < PROFILE_PACKAGE_MIN_SUPPORTED_SCHEMA_VERSION
            || package.schema_version > PROFILE_PACKAGE_SCHEMA_VERSION
        {
            return Err("profile_package_unsupported_schema".to_string());
        }
        Ok(package)
    }

    pub fn preview_import(
        package: &ProfilePackage,
        existing_profile_names: &[String],
        device_states: &[DeviceRuntimeState],
    ) -> ProfilePackageImportPreview {
        ProfilePackageImportPreview {
            source_profile_name: package.profile.name.clone(),
            imported_profile_name: generate_import_profile_name(
                &package.profile.name,
                existing_profile_names,
            ),
            enabled_hook_event_count: package.profile.enabled_hook_events.len(),
            ai_mapping_count: package.profile.ai_event_mappings.len(),
            output_rule_count: package.profile.hardware_rules.len(),
            device_rule_count: count_device_rules(&package.profile),
            desktop_notice_instance_count: package.desktop_notice_instances.len(),
            custom_mascot_asset_pack_ids: collect_custom_mascot_asset_pack_ids(
                &package.desktop_notice_instances,
                &referenced_desktop_notice_instance_ids(&package.profile),
            ),
            device_groups: build_device_group_previews(package, device_states),
            hook_config_sync_required: true,
        }
    }

    pub fn build_imported_profile(
        package: &ProfilePackage,
        imported_name: &str,
        bindings: &[ProfilePackageDeviceBinding],
        device_states: &[DeviceRuntimeState],
    ) -> Result<NoticeProfile, String> {
        Self::build_imported_profile_with_internal_events(
            package,
            imported_name,
            bindings,
            device_states,
            &builtin_internal_event_ids(),
        )
    }

    pub fn build_imported_profile_with_internal_events(
        package: &ProfilePackage,
        imported_name: &str,
        bindings: &[ProfilePackageDeviceBinding],
        device_states: &[DeviceRuntimeState],
        valid_event_ids: &HashSet<String>,
    ) -> Result<NoticeProfile, String> {
        Ok(Self::build_imported_profile_package_with_internal_events(
            package,
            imported_name,
            bindings,
            device_states,
            valid_event_ids,
        )?
        .profile)
    }

    pub fn build_imported_profile_package_with_internal_events(
        package: &ProfilePackage,
        imported_name: &str,
        bindings: &[ProfilePackageDeviceBinding],
        device_states: &[DeviceRuntimeState],
        valid_event_ids: &HashSet<String>,
    ) -> Result<ImportedProfilePackage, String> {
        Self::build_imported_profile_package_with_desktop_notice_ids(
            package,
            imported_name,
            bindings,
            device_states,
            valid_event_ids,
            &[],
        )
    }

    pub fn build_imported_profile_package_with_desktop_notice_ids(
        package: &ProfilePackage,
        imported_name: &str,
        bindings: &[ProfilePackageDeviceBinding],
        device_states: &[DeviceRuntimeState],
        valid_event_ids: &HashSet<String>,
        existing_desktop_notice_instance_ids: &[String],
    ) -> Result<ImportedProfilePackage, String> {
        Self::build_imported_profile_package_with_existing_desktop_notices(
            package,
            imported_name,
            bindings,
            device_states,
            valid_event_ids,
            &[],
            existing_desktop_notice_instance_ids,
        )
    }

    pub fn build_imported_profile_package_with_desktop_notice_instances(
        package: &ProfilePackage,
        imported_name: &str,
        bindings: &[ProfilePackageDeviceBinding],
        device_states: &[DeviceRuntimeState],
        valid_event_ids: &HashSet<String>,
        existing_desktop_notice_instances: &[DesktopNoticeInstance],
    ) -> Result<ImportedProfilePackage, String> {
        let existing_ids = existing_desktop_notice_instances
            .iter()
            .map(|instance| instance.id.clone())
            .collect::<Vec<_>>();
        Self::build_imported_profile_package_with_existing_desktop_notices(
            package,
            imported_name,
            bindings,
            device_states,
            valid_event_ids,
            existing_desktop_notice_instances,
            &existing_ids,
        )
    }

    fn build_imported_profile_package_with_existing_desktop_notices(
        package: &ProfilePackage,
        imported_name: &str,
        bindings: &[ProfilePackageDeviceBinding],
        device_states: &[DeviceRuntimeState],
        valid_event_ids: &HashSet<String>,
        existing_desktop_notice_instances: &[DesktopNoticeInstance],
        existing_desktop_notice_instance_ids: &[String],
    ) -> Result<ImportedProfilePackage, String> {
        let mut profile = package.profile.clone();
        normalize_profile_sound_references(&mut profile);
        profile.id = generate_profile_id(imported_name);
        profile.name = normalized_import_profile_name(imported_name)?;
        let desktop_notice_bindings = build_imported_desktop_notice_bindings(
            &package.desktop_notice_instances,
            existing_desktop_notice_instances,
            existing_desktop_notice_instance_ids,
        );
        apply_desktop_notice_bindings_or_disable(&mut profile, &desktop_notice_bindings);
        apply_device_bindings_or_disable(&mut profile, package, bindings, device_states);
        profile.validate_with_internal_events(valid_event_ids)?;
        let desktop_notice_instances = desktop_notice_bindings
            .into_values()
            .filter_map(|binding| binding.imported_instance)
            .collect::<Vec<_>>();
        validate_desktop_notice_instances(&desktop_notice_instances)
            .map_err(|error| error.code_string())?;
        Ok(ImportedProfilePackage {
            profile,
            desktop_notice_instances,
        })
    }
}

fn sanitize_export_profile(
    profile: &NoticeProfile,
    desktop_notice_key_map: &BTreeMap<String, String>,
) -> NoticeProfile {
    let device_key_map = build_source_device_key_map(profile);
    let mut profile = profile.clone();
    for rule in &mut profile.hardware_rules {
        for action in &mut rule.output.channel_actions {
            if let Some(source_key) = device_key_map.get(&action.device_id) {
                action.device_id = source_key.clone();
            }
        }
        if rule.output.output_type == HardwareOutputType::Display {
            let Some(display_device_id) = &rule.output.display_device_id else {
                continue;
            };
            if let Some(source_key) = device_key_map.get(display_device_id) {
                rule.output.display_device_id = Some(source_key.clone());
            }
        }
        if rule.output.output_type == HardwareOutputType::DesktopNotice {
            for target in &mut rule.output.desktop_notice_targets {
                if let Some(source_key) = desktop_notice_key_map.get(&target.target_id) {
                    target.target_id = source_key.clone();
                }
            }
        }
        if rule.output.output_type == HardwareOutputType::Sound {
            normalize_export_sound_reference(rule);
        }
    }
    profile
}

fn normalize_profile_sound_references(profile: &mut NoticeProfile) {
    for rule in &mut profile.hardware_rules {
        if rule.output.output_type == HardwareOutputType::Sound {
            normalize_export_sound_reference(rule);
        }
    }
}

fn normalize_export_sound_reference(rule: &mut HardwareRule) {
    let Some(file_path) = rule.output.sound_file_path.as_deref() else {
        return;
    };
    let Some(file_name) = built_in_sound_file_name_from_path(file_path) else {
        return;
    };
    if let Some(reference) = builtin_sound_reference(&file_name) {
        rule.output.sound_file_path = Some(reference);
    }
}

fn built_in_sound_file_name_from_path(file_path: &str) -> Option<String> {
    let normalized = file_path.replace('\\', "/");
    let marker = "/assets/sounds/";
    let marker_index = normalized.rfind(marker)?;
    let file_name = normalized[(marker_index + marker.len())..].trim();
    if file_name.is_empty() || file_name.contains('/') {
        return None;
    }
    Some(file_name.to_string())
}

fn build_source_desktop_notice_key_map(profile: &NoticeProfile) -> BTreeMap<String, String> {
    let mut source_keys = BTreeMap::new();
    for rule in &profile.hardware_rules {
        if rule.output.output_type != HardwareOutputType::DesktopNotice {
            continue;
        }
        for target in &rule.output.desktop_notice_targets {
            if !source_keys.contains_key(&target.target_id) {
                let source_key = format!("source-desktop-notice-{}", source_keys.len() + 1);
                source_keys.insert(target.target_id.clone(), source_key);
            }
        }
    }
    source_keys
}

fn referenced_desktop_notice_instance_ids(profile: &NoticeProfile) -> HashSet<String> {
    profile
        .hardware_rules
        .iter()
        .filter(|rule| rule.output.output_type == HardwareOutputType::DesktopNotice)
        .flat_map(|rule| {
            rule.output
                .desktop_notice_targets
                .iter()
                .map(|target| target.target_id.clone())
        })
        .collect()
}

fn collect_desktop_notice_instance_templates(
    instances: &[DesktopNoticeInstance],
    source_key_map: &BTreeMap<String, String>,
) -> Vec<DesktopNoticeInstance> {
    let instances_by_id = instances
        .iter()
        .map(|instance| (instance.id.as_str(), instance))
        .collect::<HashMap<_, _>>();
    source_key_map
        .iter()
        .filter_map(|(instance_id, source_key)| {
            let mut instance = (*instances_by_id.get(instance_id.as_str())?).clone();
            instance.id = source_key.clone();
            clear_desktop_notice_machine_state(&mut instance);
            Some(instance)
        })
        .collect()
}

fn collect_custom_mascot_asset_pack_ids(
    instances: &[DesktopNoticeInstance],
    referenced_instance_ids: &HashSet<String>,
) -> Vec<String> {
    let mut ids = instances
        .iter()
        .filter(|instance| referenced_instance_ids.contains(&instance.id))
        .filter(|instance| instance.variant == DesktopNoticeVariant::Mascot)
        .filter_map(|instance| instance.mascot.as_ref())
        .map(|settings| settings.asset_pack_id.as_str())
        .filter(|asset_pack_id| is_custom_mascot_asset_pack_id(asset_pack_id))
        .map(str::to_string)
        .collect::<Vec<_>>();
    ids.sort();
    ids.dedup();
    ids
}

fn is_custom_mascot_asset_pack_id(asset_pack_id: &str) -> bool {
    !is_registered_mascot_asset_pack(asset_pack_id)
}

fn clear_desktop_notice_machine_state(instance: &mut DesktopNoticeInstance) {
    if let Some(settings) = instance.custom_lightbar.as_mut() {
        settings.bounds_override = None;
    }
    if let Some(settings) = instance.mascot.as_mut() {
        settings.bounds_override = None;
    }
}

struct DesktopNoticeImportBinding {
    target_id: String,
    imported_instance: Option<DesktopNoticeInstance>,
}

fn build_imported_desktop_notice_bindings(
    templates: &[DesktopNoticeInstance],
    existing_instances: &[DesktopNoticeInstance],
    existing_ids: &[String],
) -> BTreeMap<String, DesktopNoticeImportBinding> {
    let mut used_ids = existing_ids.iter().cloned().collect::<HashSet<_>>();
    templates
        .iter()
        .map(|template| {
            let source_key = template.id.clone();
            if let Some(existing) =
                find_equivalent_desktop_notice_instance(template, existing_instances)
            {
                return (
                    source_key,
                    DesktopNoticeImportBinding {
                        target_id: existing.id.clone(),
                        imported_instance: None,
                    },
                );
            }
            let mut instance = template.clone();
            instance.id = unique_desktop_notice_import_id(&mut used_ids);
            clear_desktop_notice_machine_state(&mut instance);
            let target_id = instance.id.clone();
            (
                source_key,
                DesktopNoticeImportBinding {
                    target_id,
                    imported_instance: Some(instance),
                },
            )
        })
        .collect()
}

fn find_equivalent_desktop_notice_instance<'a>(
    template: &DesktopNoticeInstance,
    existing_instances: &'a [DesktopNoticeInstance],
) -> Option<&'a DesktopNoticeInstance> {
    let mut normalized_template = template.clone();
    normalized_template.id.clear();
    clear_desktop_notice_machine_state(&mut normalized_template);
    existing_instances.iter().find(|existing| {
        let mut normalized_existing = (*existing).clone();
        normalized_existing.id.clear();
        clear_desktop_notice_machine_state(&mut normalized_existing);
        normalized_existing == normalized_template
    })
}

fn unique_desktop_notice_import_id(used_ids: &mut HashSet<String>) -> String {
    for _ in 0..32 {
        let candidate = format!("desktop-notice-import-{}", short_random_suffix());
        if used_ids.insert(candidate.clone()) {
            return candidate;
        }
    }
    let fallback = format!("desktop-notice-import-{}", uuid::Uuid::new_v4());
    used_ids.insert(fallback.clone());
    fallback
}

fn apply_desktop_notice_bindings_or_disable(
    profile: &mut NoticeProfile,
    imported_instances_by_source_key: &BTreeMap<String, DesktopNoticeImportBinding>,
) {
    for rule in &mut profile.hardware_rules {
        if rule.output.output_type != HardwareOutputType::DesktopNotice {
            continue;
        }

        let mut fully_bound = true;
        for target in &mut rule.output.desktop_notice_targets {
            let Some(binding) = imported_instances_by_source_key.get(&target.target_id) else {
                fully_bound = false;
                continue;
            };
            target.target_id = binding.target_id.clone();
        }
        if !fully_bound {
            rule.enabled = false;
        }
    }
}

fn build_source_device_key_map(profile: &NoticeProfile) -> BTreeMap<String, String> {
    let mut source_keys = BTreeMap::new();
    for rule in &profile.hardware_rules {
        for source_device_id in rule_source_device_keys(rule) {
            if source_device_id == "display-device" {
                continue;
            }
            if !source_keys.contains_key(&source_device_id) {
                let source_key = format!("source-device-{}", source_keys.len() + 1);
                source_keys.insert(source_device_id, source_key);
            }
        }
    }
    source_keys
}

fn build_source_device_board_ids(
    source_device_key_map: &BTreeMap<String, String>,
    device_board_ids: &HashMap<String, String>,
) -> HashMap<String, String> {
    source_device_key_map
        .iter()
        .filter_map(|(device_id, source_key)| {
            device_board_ids
                .get(device_id)
                .map(|board_id| (source_key.clone(), board_id.clone()))
        })
        .collect()
}

fn collect_device_rule_hints(
    profile: &NoticeProfile,
    source_device_board_ids: &HashMap<String, String>,
) -> Vec<ProfilePackageDeviceRuleHint> {
    let mut groups: BTreeMap<String, ProfilePackageDeviceRuleHint> = BTreeMap::new();
    for rule in &profile.hardware_rules {
        if rule.output.output_type == HardwareOutputType::DeviceChannel {
            for action in &rule.output.channel_actions {
                let entry = groups.entry(action.device_id.clone()).or_insert_with(|| {
                    ProfilePackageDeviceRuleHint {
                        source_device_key: action.device_id.clone(),
                        board_id: source_device_board_ids.get(&action.device_id).cloned(),
                        requirements: Vec::new(),
                    }
                });
                entry.requirements.push(ProfilePackageDeviceRequirement {
                    rule_id: rule.id.clone(),
                    output_type: rule.output.output_type,
                    channel_id: Some(action.channel_id.clone()),
                    channel_kind: None,
                    action: Some(action.channel_action),
                    extension: None,
                });
            }
        }
        if rule.output.output_type == HardwareOutputType::Display {
            let source_device_key = rule
                .output
                .display_device_id
                .clone()
                .unwrap_or_else(|| "display-device".to_string());
            let entry = groups.entry(source_device_key.clone()).or_insert_with(|| {
                ProfilePackageDeviceRuleHint {
                    board_id: source_device_board_ids.get(&source_device_key).cloned(),
                    source_device_key,
                    requirements: Vec::new(),
                }
            });
            entry.requirements.push(ProfilePackageDeviceRequirement {
                rule_id: rule.id.clone(),
                output_type: rule.output.output_type,
                channel_id: None,
                channel_kind: None,
                action: None,
                extension: Some("display".to_string()),
            });
        }
    }
    groups.into_values().collect()
}

fn count_device_rules(profile: &NoticeProfile) -> usize {
    profile
        .hardware_rules
        .iter()
        .filter(|rule| is_device_rule(rule))
        .count()
}

fn is_device_rule(rule: &HardwareRule) -> bool {
    rule.output.output_type == HardwareOutputType::DeviceChannel
        || rule.output.output_type == HardwareOutputType::Display
}

fn build_device_group_previews(
    package: &ProfilePackage,
    device_states: &[DeviceRuntimeState],
) -> Vec<ProfilePackageDeviceGroupPreview> {
    package
        .device_rule_hints
        .iter()
        .map(|hint| ProfilePackageDeviceGroupPreview {
            source_device_key: hint.source_device_key.clone(),
            board_id: hint.board_id.clone(),
            requirement_count: hint.requirements.len(),
            candidates: connected_device_candidates(hint, device_states),
        })
        .collect()
}

fn connected_device_candidates(
    hint: &ProfilePackageDeviceRuleHint,
    device_states: &[DeviceRuntimeState],
) -> Vec<ProfilePackageDeviceCandidate> {
    let mut candidates = device_states
        .iter()
        .filter(|state| state.status == DeviceConnectionStatus::Connected)
        .filter_map(|state| {
            let device_id = state.device_id.as_ref()?;
            let status = binding_status_for_requirements(hint, Some(state));
            Some(ProfilePackageDeviceCandidate {
                device_id: device_id.clone(),
                board_id: state.board_id.clone(),
                status,
                missing_requirements: missing_requirements(hint, state),
            })
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        binding_status_priority(left.status)
            .cmp(&binding_status_priority(right.status))
            .then_with(|| left.device_id.cmp(&right.device_id))
    });
    candidates
}

fn apply_device_bindings_or_disable(
    profile: &mut NoticeProfile,
    package: &ProfilePackage,
    bindings: &[ProfilePackageDeviceBinding],
    device_states: &[DeviceRuntimeState],
) {
    let hints = package
        .device_rule_hints
        .iter()
        .map(|hint| (hint.source_device_key.as_str(), hint))
        .collect::<HashMap<_, _>>();
    let bindings = bindings
        .iter()
        .filter_map(|binding| {
            binding
                .target_device_id
                .as_ref()
                .map(|target| (binding.source_device_key.as_str(), target.as_str()))
        })
        .collect::<HashMap<_, _>>();

    for rule in &mut profile.hardware_rules {
        if !is_device_rule(rule) {
            continue;
        }

        let source_keys = rule_source_device_keys(rule);
        let mut fully_matched = true;
        let mut has_binding = false;

        for source_key in &source_keys {
            let Some(target_device_id) = bindings.get(source_key.as_str()) else {
                fully_matched = false;
                continue;
            };
            has_binding = true;
            let target_state = device_states.iter().find(|state| {
                state.device_id.as_deref() == Some(*target_device_id)
                    && state.status == DeviceConnectionStatus::Connected
            });
            let status = hints
                .get(source_key.as_str())
                .map(|hint| binding_status_for_requirements(hint, target_state))
                .unwrap_or(ProfilePackageDeviceBindingStatus::Unbound);
            if status != ProfilePackageDeviceBindingStatus::FullMatch {
                fully_matched = false;
            }
            replace_rule_device_id(rule, source_key, target_device_id);
        }

        if !has_binding || !fully_matched {
            rule.enabled = false;
        }
    }
}

fn rule_source_device_keys(rule: &HardwareRule) -> Vec<String> {
    let mut keys = Vec::new();
    for action in &rule.output.channel_actions {
        if !keys.contains(&action.device_id) {
            keys.push(action.device_id.clone());
        }
    }
    if rule.output.output_type == HardwareOutputType::Display {
        if let Some(display_device_id) = &rule.output.display_device_id {
            if !keys.contains(display_device_id) {
                keys.push(display_device_id.clone());
            }
        }
    }
    if keys.is_empty() && rule.output.output_type == HardwareOutputType::Display {
        keys.push("display-device".to_string());
    }
    keys
}

fn replace_rule_device_id(
    rule: &mut HardwareRule,
    source_device_key: &str,
    target_device_id: &str,
) {
    for action in &mut rule.output.channel_actions {
        if action.device_id == source_device_key {
            action.device_id = target_device_id.to_string();
        }
    }
    if rule.output.display_device_id.as_deref() == Some(source_device_key) {
        rule.output.display_device_id = Some(target_device_id.to_string());
    }
    if rule.output.output_type == HardwareOutputType::Display
        && source_device_key == "display-device"
        && rule.output.display_device_id.is_none()
    {
        rule.output.display_device_id = Some(target_device_id.to_string());
    }
}

fn binding_status_for_requirements(
    hint: &ProfilePackageDeviceRuleHint,
    target: Option<&DeviceRuntimeState>,
) -> ProfilePackageDeviceBindingStatus {
    let Some(target) = target else {
        return ProfilePackageDeviceBindingStatus::Unbound;
    };
    if hint.board_id.is_some() && target.board_id.as_deref() != hint.board_id.as_deref() {
        return ProfilePackageDeviceBindingStatus::BoardMismatch;
    }
    if hint
        .requirements
        .iter()
        .all(|requirement| device_satisfies_requirement(target, requirement))
    {
        ProfilePackageDeviceBindingStatus::FullMatch
    } else {
        ProfilePackageDeviceBindingStatus::PartialMatch
    }
}

fn device_satisfies_requirement(
    target: &DeviceRuntimeState,
    requirement: &ProfilePackageDeviceRequirement,
) -> bool {
    if requirement.extension.as_deref() == Some("display") {
        return target
            .channels
            .iter()
            .any(|channel| channel.kind == DeviceChannelKind::Display);
    }

    let Some(channel_id) = requirement.channel_id.as_deref() else {
        return true;
    };
    let Some(channel) = target
        .channels
        .iter()
        .find(|channel| channel.id == channel_id)
    else {
        return false;
    };
    if let Some(channel_kind) = requirement.channel_kind {
        if channel.kind != channel_kind {
            return false;
        }
    }
    if let Some(action) = requirement.action {
        if !channel.supported_actions.contains(&action) {
            return false;
        }
    }
    true
}

fn missing_requirements(
    hint: &ProfilePackageDeviceRuleHint,
    target: &DeviceRuntimeState,
) -> Vec<String> {
    hint.requirements
        .iter()
        .filter(|requirement| !device_satisfies_requirement(target, requirement))
        .map(|requirement| {
            requirement
                .channel_id
                .clone()
                .or_else(|| requirement.extension.clone())
                .unwrap_or_else(|| requirement.rule_id.clone())
        })
        .collect()
}

fn binding_status_priority(status: ProfilePackageDeviceBindingStatus) -> u8 {
    match status {
        ProfilePackageDeviceBindingStatus::FullMatch => 0,
        ProfilePackageDeviceBindingStatus::PartialMatch => 1,
        ProfilePackageDeviceBindingStatus::BoardMismatch => 2,
        ProfilePackageDeviceBindingStatus::Unbound => 3,
    }
}

pub fn generate_import_profile_name(
    source_name: &str,
    existing_profile_names: &[String],
) -> String {
    for _ in 0..32 {
        let candidate = format!(
            "import-{}-{}",
            short_random_suffix(),
            normalized_import_profile_name(source_name)
                .unwrap_or_else(|_| DEFAULT_PROFILE_ID.to_string())
        );
        if !existing_profile_names.iter().any(|name| name == &candidate) {
            return candidate;
        }
    }
    format!("import-{}-{}", short_random_suffix(), DEFAULT_PROFILE_ID)
}

fn short_random_suffix() -> String {
    uuid::Uuid::new_v4()
        .to_string()
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .take(6)
        .collect::<String>()
        .to_lowercase()
}

fn normalized_import_profile_name(profile_name: &str) -> Result<String, String> {
    let name = profile_name.trim();
    if name.is_empty() {
        return Err("profile name cannot be empty".to_string());
    }
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::desktop_notice::{
        CustomLightbarSettings, DesktopNoticeBounds, DesktopNoticeColorMode,
        DesktopNoticeColorStop, DesktopNoticeInstance, DesktopNoticePresetPosition,
        DesktopNoticeRestoreBehavior, DesktopNoticeRuleEffect, DesktopNoticeSize,
        DesktopNoticeWorkArea, G7_DESKTOP_MASCOT_ASSET_PACK_ID,
    };
    use crate::core::device::{ActiveLevel, DeviceChannel};
    use crate::core::profiles::{DesktopNoticeRuleTarget, DeviceChannelRuleAction, HardwareOutput};

    #[test]
    fn export_package_contains_profile_and_device_hints_without_runtime_device_facts() {
        let mut profile = NoticeProfile::daily_coding();
        profile.id = "desk-profile".to_string();
        profile.name = "Desk Profile".to_string();
        profile.device.board_id = "seeed-wio-terminal".to_string();
        profile.hardware_rules = vec![device_rule("rule-device", "desk-wio", "buzzer")];

        let package = ProfilePackageService::export_package(&profile, "2026-07-20T10:00:00+08:00");
        let json = serde_json::to_string(&package).expect("package should serialize");

        assert_eq!(2, package.schema_version);
        assert_eq!(PROFILE_PACKAGE_KIND, package.kind);
        assert_eq!("Desk Profile", package.profile.name);
        assert_eq!(1, package.device_rule_hints.len());
        assert_eq!(
            "source-device-1",
            package.device_rule_hints[0].source_device_key
        );
        assert!(json.contains("\"boardId\""));
        assert!(!json.contains("desk-wio"));
        assert!(!json.contains("deviceUid"));
        assert!(!json.contains("serialPort"));
        assert!(!json.contains("resourceId"));
        assert!(!json.contains("lastAck"));
        assert!(!json.contains("lastError"));
    }

    #[test]
    fn parse_package_accepts_schema_version_one_for_existing_exports() {
        let mut package = ProfilePackageService::export_package(
            &NoticeProfile::daily_coding(),
            "2026-07-26T10:00:00+08:00",
        );
        package.schema_version = 1;
        let content = serde_json::to_string(&package).expect("package should serialize");

        let parsed =
            ProfilePackageService::parse_package(&content).expect("v1 package should parse");

        assert_eq!(1, parsed.schema_version);
    }

    #[test]
    fn import_package_creates_new_profile_and_disables_unbound_device_rules() {
        let mut source = NoticeProfile::daily_coding();
        source.id = "shared".to_string();
        source.name = "Shared Setup".to_string();
        source.hardware_rules = vec![
            device_rule("device-rule", "old-device", "pin.gp2"),
            system_notification_rule("notice-rule"),
        ];
        let package = ProfilePackageService::export_package(&source, "2026-07-20T10:00:00+08:00");

        let imported = ProfilePackageService::build_imported_profile(
            &package,
            "import-a1b2c3-Shared Setup",
            &[],
            &[],
        )
        .expect("profile should import");

        assert_eq!("import-a1b2c3-Shared Setup", imported.name);
        assert!(imported.id.starts_with("import-a1b2c3-shared-setup"));
        assert_eq!(2, imported.hardware_rules.len());
        assert_eq!(
            Some(false),
            imported
                .hardware_rules
                .iter()
                .find(|rule| rule.id == "device-rule")
                .map(|rule| rule.enabled)
        );
        assert_eq!(
            Some(true),
            imported
                .hardware_rules
                .iter()
                .find(|rule| rule.id == "notice-rule")
                .map(|rule| rule.enabled)
        );
    }

    #[test]
    fn import_package_rebinds_fully_matched_device_rule_and_keeps_enabled() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![device_rule("device-rule", "old-device", "pin.gp2")];
        let package = ProfilePackageService::export_package(&source, "2026-07-20T10:00:00+08:00");
        let target =
            connected_device_state("current-pico", "rp2040-pico", vec![channel("pin.gp2")]);

        let imported = ProfilePackageService::build_imported_profile(
            &package,
            "import-a1b2c3-Daily Coding",
            &[ProfilePackageDeviceBinding {
                source_device_key: "source-device-1".to_string(),
                target_device_id: Some("current-pico".to_string()),
            }],
            &[target],
        )
        .expect("profile should import");

        let rule = imported
            .hardware_rules
            .iter()
            .find(|rule| rule.id == "device-rule")
            .unwrap();
        assert!(rule.enabled);
        assert_eq!("current-pico", rule.output.channel_actions[0].device_id);
    }

    #[test]
    fn import_package_disables_rebound_device_rule_when_channel_is_missing() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![device_rule("device-rule", "old-device", "pin.gp2")];
        let package = ProfilePackageService::export_package(&source, "2026-07-20T10:00:00+08:00");
        let target =
            connected_device_state("current-pico", "rp2040-pico", vec![channel("pin.gp3")]);

        let imported = ProfilePackageService::build_imported_profile(
            &package,
            "import-a1b2c3-Daily Coding",
            &[ProfilePackageDeviceBinding {
                source_device_key: "source-device-1".to_string(),
                target_device_id: Some("current-pico".to_string()),
            }],
            &[target],
        )
        .expect("profile should import");

        let rule = imported
            .hardware_rules
            .iter()
            .find(|rule| rule.id == "device-rule")
            .unwrap();
        assert!(!rule.enabled);
        assert_eq!("current-pico", rule.output.channel_actions[0].device_id);
    }

    #[test]
    fn import_package_accepts_custom_internal_events_from_valid_event_ids() {
        let mut source = NoticeProfile::daily_coding();
        source.ai_event_mappings[0].internal_event = "claude.common.send.userDefined".to_string();
        source.hardware_rules = Vec::new();
        let package = ProfilePackageService::export_package(&source, "2026-07-20T10:00:00+08:00");
        let mut valid_event_ids = crate::core::internal_events::builtin_internal_event_ids();
        valid_event_ids.insert("claude.common.send.userDefined".to_string());

        let imported = ProfilePackageService::build_imported_profile_with_internal_events(
            &package,
            "import-a1b2c3-Daily Coding",
            &[],
            &[],
            &valid_event_ids,
        )
        .expect("profile with custom internal event should import");

        assert_eq!(
            "claude.common.send.userDefined",
            imported.ai_event_mappings[0].internal_event
        );
    }

    #[test]
    fn export_package_ignores_stale_display_device_id_on_device_channel_rules() {
        let mut source = NoticeProfile::daily_coding();
        let mut rule = device_rule("device-rule", "wio-device", "buzzer");
        rule.output.display_device_id = Some("stale-display-device".to_string());
        source.hardware_rules = vec![rule];

        let package = ProfilePackageService::export_package(&source, "2026-07-20T10:00:00+08:00");

        assert_eq!(1, package.device_rule_hints.len());
        assert_eq!(
            "source-device-1",
            package.device_rule_hints[0].source_device_key
        );
        assert!(package.device_rule_hints[0]
            .requirements
            .iter()
            .all(|requirement| requirement.extension.is_none()));
    }

    #[test]
    fn export_package_uses_referenced_device_board_id_for_device_rule_hints() {
        let mut source = NoticeProfile::daily_coding();
        source.device.board_id = "rp2040-pico".to_string();
        source.hardware_rules = vec![device_rule("device-rule", "wio-device", "buzzer")];
        let mut board_ids = HashMap::new();
        board_ids.insert("wio-device".to_string(), "seeed-wio-terminal".to_string());

        let package = ProfilePackageService::export_package_with_device_board_ids(
            &source,
            "2026-07-20T10:00:00+08:00",
            &board_ids,
        );

        assert_eq!(
            Some("seeed-wio-terminal"),
            package.device_rule_hints[0].board_id.as_deref()
        );
    }

    #[test]
    fn export_package_stores_builtin_sound_as_stable_asset_id() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![sound_rule(
            "sound-rule",
            "/Applications/CC Notice.app/Contents/Resources/assets/sounds/done.mp3",
        )];

        let package = ProfilePackageService::export_package(&source, "2026-08-17T10:00:00+08:00");

        assert_eq!(
            Some("builtin:done.mp3"),
            package.profile.hardware_rules[0]
                .output
                .sound_file_path
                .as_deref()
        );
    }

    #[test]
    fn export_package_keeps_user_sound_file_path() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![sound_rule(
            "sound-rule",
            "/Users/test/.cc-notice/sounds/custom.mp3",
        )];

        let package = ProfilePackageService::export_package(&source, "2026-08-17T10:00:00+08:00");

        assert_eq!(
            Some("/Users/test/.cc-notice/sounds/custom.mp3"),
            package.profile.hardware_rules[0]
                .output
                .sound_file_path
                .as_deref()
        );
    }

    #[test]
    fn import_package_normalizes_legacy_builtin_sound_absolute_path() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![sound_rule(
            "sound-rule",
            "/Applications/CC Notice.app/Contents/Resources/assets/sounds/done.mp3",
        )];
        let package = ProfilePackage {
            schema_version: 1,
            kind: PROFILE_PACKAGE_KIND.to_string(),
            exported_at: "2026-08-17T10:00:00+08:00".to_string(),
            app_version: "1.0.0".to_string(),
            profile: source,
            device_rule_hints: Vec::new(),
            desktop_notice_instances: Vec::new(),
        };

        let imported = ProfilePackageService::build_imported_profile(
            &package,
            "import-a1b2c3-Daily Coding",
            &[],
            &[],
        )
        .expect("legacy package should import");

        assert_eq!(
            Some("builtin:done.mp3"),
            imported.hardware_rules[0].output.sound_file_path.as_deref()
        );
    }

    #[test]
    fn import_package_sets_display_device_id_for_legacy_display_rule_binding() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![legacy_display_rule("display-rule")];
        let package = ProfilePackageService::export_package(&source, "2026-07-20T10:00:00+08:00");
        let target = connected_device_state(
            "current-wio",
            "seeed-wio-terminal",
            vec![display_channel("display.main")],
        );

        let imported = ProfilePackageService::build_imported_profile(
            &package,
            "import-a1b2c3-Daily Coding",
            &[ProfilePackageDeviceBinding {
                source_device_key: "display-device".to_string(),
                target_device_id: Some("current-wio".to_string()),
            }],
            &[target],
        )
        .expect("profile should import");

        let rule = imported
            .hardware_rules
            .iter()
            .find(|rule| rule.id == "display-rule")
            .unwrap();
        assert!(rule.enabled);
        assert_eq!(
            Some("current-wio"),
            rule.output.display_device_id.as_deref()
        );
    }

    #[test]
    fn preview_import_lists_custom_mascot_asset_pack_references() {
        let mut package = ProfilePackageService::export_package(
            &NoticeProfile::daily_coding(),
            "2026-07-26T10:00:00+08:00",
        );
        package.profile.hardware_rules = vec![
            desktop_notice_rule("desktop-rule-custom", "source-desktop-notice-1"),
            desktop_notice_rule("desktop-rule-bundled", "source-desktop-notice-3"),
        ];
        package.desktop_notice_instances = vec![
            mascot_desktop_notice_instance("source-desktop-notice-1", "my-local-mascot"),
            mascot_desktop_notice_instance("source-desktop-notice-2", "unused-local-mascot"),
            mascot_desktop_notice_instance(
                "source-desktop-notice-3",
                G7_DESKTOP_MASCOT_ASSET_PACK_ID,
            ),
        ];

        let preview = ProfilePackageService::preview_import(&package, &[], &[]);

        assert_eq!(
            vec!["my-local-mascot".to_string()],
            preview.custom_mascot_asset_pack_ids
        );
    }

    #[test]
    fn export_package_clears_mascot_machine_bounds() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![desktop_notice_rule("desktop-rule", "desktop-notice-mascot")];
        let mut instance =
            mascot_desktop_notice_instance("desktop-notice-mascot", "my-local-mascot");
        let bounds = DesktopNoticeBounds {
            x: 320,
            y: 140,
            width: 240,
            height: 240,
            source_work_area: Some(DesktopNoticeWorkArea {
                x: 0,
                y: 25,
                width: 3440,
                height: 1415,
            }),
        };
        instance
            .mascot
            .as_mut()
            .expect("mascot settings should exist")
            .bounds_override = Some(bounds);

        let package =
            ProfilePackageService::export_package_with_device_board_ids_and_desktop_notice_instances(
                &source,
                "2026-07-26T10:00:00+08:00",
                &HashMap::new(),
                &[instance],
            );
        let json = serde_json::to_string(&package).expect("package should serialize");

        assert!(package.desktop_notice_instances[0]
            .mascot
            .as_ref()
            .expect("mascot settings should exist")
            .bounds_override
            .is_none());
        assert!(!json.contains("boundsOverride"));
        assert!(!json.contains("sourceWorkArea"));
    }

    #[test]
    fn export_package_includes_referenced_desktop_notice_template_without_machine_bounds() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![desktop_notice_rule("desktop-rule", "desktop-notice-local")];
        let instance = custom_desktop_notice_instance_with_bounds("desktop-notice-local");

        let package =
            ProfilePackageService::export_package_with_device_board_ids_and_desktop_notice_instances(
                &source,
                "2026-07-26T10:00:00+08:00",
                &HashMap::new(),
                &[instance],
            );
        let json = serde_json::to_string(&package).expect("package should serialize");

        assert_eq!(1, package.desktop_notice_instances.len());
        assert_eq!(
            "source-desktop-notice-1",
            package.desktop_notice_instances[0].id
        );
        assert_eq!(
            "source-desktop-notice-1",
            package.profile.hardware_rules[0]
                .output
                .desktop_notice_targets[0]
                .target_id
        );
        assert!(!json.contains("desktop-notice-local"));
        assert!(!json.contains("boundsOverride"));
        assert!(!json.contains("sourceWorkArea"));
    }

    #[test]
    fn import_package_recreates_desktop_notice_instance_and_rebinds_rule_target() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![desktop_notice_rule("desktop-rule", "desktop-notice-local")];
        let package =
            ProfilePackageService::export_package_with_device_board_ids_and_desktop_notice_instances(
                &source,
                "2026-07-26T10:00:00+08:00",
                &HashMap::new(),
                &[custom_desktop_notice_instance_with_bounds(
                    "desktop-notice-local",
                )],
            );

        let imported = ProfilePackageService::build_imported_profile_package_with_internal_events(
            &package,
            "import-a1b2c3-Daily Coding",
            &[],
            &[],
            &builtin_internal_event_ids(),
        )
        .expect("profile package should import");

        assert_eq!(1, imported.desktop_notice_instances.len());
        let imported_instance = &imported.desktop_notice_instances[0];
        assert_ne!("source-desktop-notice-1", imported_instance.id);
        assert!(imported_instance.id.starts_with("desktop-notice-import-"));
        assert!(imported_instance
            .custom_lightbar
            .as_ref()
            .and_then(|settings| settings.bounds_override)
            .is_none());
        let imported_rule = &imported.profile.hardware_rules[0];
        assert!(imported_rule.enabled);
        assert_eq!(
            imported_instance.id,
            imported_rule.output.desktop_notice_targets[0].target_id
        );
    }

    #[test]
    fn import_package_avoids_existing_desktop_notice_instance_ids() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![desktop_notice_rule("desktop-rule", "desktop-notice-local")];
        let package =
            ProfilePackageService::export_package_with_device_board_ids_and_desktop_notice_instances(
                &source,
                "2026-07-26T10:00:00+08:00",
                &HashMap::new(),
                &[custom_desktop_notice_instance_with_bounds("desktop-notice-local")],
            );
        let existing_ids = vec!["desktop-notice-import-fixed".to_string()];

        let imported =
            ProfilePackageService::build_imported_profile_package_with_desktop_notice_ids(
                &package,
                "import-a1b2c3-Daily Coding",
                &[],
                &[],
                &builtin_internal_event_ids(),
                &existing_ids,
            )
            .expect("profile package should import");

        assert_ne!(
            "desktop-notice-import-fixed",
            imported.desktop_notice_instances[0].id
        );
    }

    #[test]
    fn import_package_reuses_existing_equivalent_desktop_notice_instance() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![desktop_notice_rule("desktop-rule", "desktop-notice-local")];
        let package =
            ProfilePackageService::export_package_with_device_board_ids_and_desktop_notice_instances(
                &source,
                "2026-07-26T10:00:00+08:00",
                &HashMap::new(),
                &[custom_desktop_notice_instance_with_bounds("desktop-notice-local")],
            );
        let mut existing_instance = package.desktop_notice_instances[0].clone();
        existing_instance.id = "desktop-notice-import-existing".to_string();

        let imported =
            ProfilePackageService::build_imported_profile_package_with_desktop_notice_instances(
                &package,
                "import-a1b2c3-Daily Coding",
                &[],
                &[],
                &builtin_internal_event_ids(),
                &[existing_instance],
            )
            .expect("profile package should import");

        assert!(imported.desktop_notice_instances.is_empty());
        assert_eq!(
            "desktop-notice-import-existing",
            imported.profile.hardware_rules[0]
                .output
                .desktop_notice_targets[0]
                .target_id
        );
    }

    #[test]
    fn import_package_disables_desktop_notice_rule_when_template_is_missing() {
        let mut source = NoticeProfile::daily_coding();
        source.hardware_rules = vec![desktop_notice_rule(
            "desktop-rule",
            "missing-desktop-notice",
        )];
        let mut package =
            ProfilePackageService::export_package(&source, "2026-07-26T10:00:00+08:00");
        package.desktop_notice_instances.clear();

        let imported = ProfilePackageService::build_imported_profile_package_with_internal_events(
            &package,
            "import-a1b2c3-Daily Coding",
            &[],
            &[],
            &builtin_internal_event_ids(),
        )
        .expect("profile package should import with disabled rule");

        assert!(imported.desktop_notice_instances.is_empty());
        assert!(!imported.profile.hardware_rules[0].enabled);
    }

    fn device_rule(rule_id: &str, device_id: &str, channel_id: &str) -> HardwareRule {
        HardwareRule {
            id: rule_id.to_string(),
            internal_event: "agent.failed".to_string(),
            output: HardwareOutput {
                output_type: HardwareOutputType::DeviceChannel,
                channel_actions: vec![DeviceChannelRuleAction {
                    id: format!("{rule_id}-action"),
                    device_id: device_id.to_string(),
                    channel_id: channel_id.to_string(),
                    channel_action: DeviceChannelActionType::Activate,
                    duration_ms: Some(1000),
                    interval_ms: None,
                    duty_percent: None,
                    frequency_hz: None,
                    color: None,
                    brightness_percent: None,
                    pattern: None,
                    display_template_id: None,
                    display_accent: None,
                    display_icon: None,
                    display_lines_template: None,
                    display_status: None,
                    display_title_template: None,
                    display_message_template: None,
                    display_title_max_chars: None,
                    display_message_max_chars: None,
                }],
                duration_ms: Some(1000),
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
                desktop_notice_targets: Vec::new(),
            },
            priority: 50,
            enabled: true,
        }
    }

    fn system_notification_rule(rule_id: &str) -> HardwareRule {
        let mut rule = device_rule(rule_id, "unused-device", "unused-channel");
        rule.output.output_type = HardwareOutputType::SystemNotification;
        rule.output.channel_actions.clear();
        rule.output.notification_level = Some("info".to_string());
        rule.output.notification_title = Some("Title".to_string());
        rule.output.notification_body = Some("Body".to_string());
        rule
    }

    fn sound_rule(rule_id: &str, file_path: &str) -> HardwareRule {
        let mut rule = device_rule(rule_id, "unused-device", "unused-channel");
        rule.output.output_type = HardwareOutputType::Sound;
        rule.output.channel_actions.clear();
        rule.output.sound_file_path = Some(file_path.to_string());
        rule.output.sound_volume_percent = Some(80);
        rule.output.sound_max_duration_ms = Some(3000);
        rule.output.sound_throttle_seconds = Some(30);
        rule
    }

    fn legacy_display_rule(rule_id: &str) -> HardwareRule {
        let mut rule = device_rule(rule_id, "unused-device", "unused-channel");
        rule.output.output_type = HardwareOutputType::Display;
        rule.output.channel_actions.clear();
        rule.output.display_device_id = None;
        rule.output.display_template_id = Some("notice".to_string());
        rule.output.display_status = Some("notice".to_string());
        rule.output.display_title_template = Some("Title".to_string());
        rule.output.display_message_template = Some("Body".to_string());
        rule
    }

    fn desktop_notice_rule(rule_id: &str, target_id: &str) -> HardwareRule {
        let mut rule = system_notification_rule(rule_id);
        rule.output.output_type = HardwareOutputType::DesktopNotice;
        rule.output.notification_level = None;
        rule.output.notification_title = None;
        rule.output.notification_body = None;
        rule.output.desktop_notice_targets = vec![DesktopNoticeRuleTarget {
            target_id: target_id.to_string(),
            effect: DesktopNoticeRuleEffect::EdgeBreathing,
            color_mode: DesktopNoticeColorMode::Gradient,
            colors: vec![
                DesktopNoticeColorStop {
                    color: "#22c55e".to_string(),
                    position: 0,
                },
                DesktopNoticeColorStop {
                    color: "#3b82f6".to_string(),
                    position: 100,
                },
            ],
            duration_ms: 1200,
            animation_period_ms: Some(1600),
            breathing_period_ms: None,
            opacity_percent: Some(100),
            brightness_percent: Some(100),
            restore_behavior: DesktopNoticeRestoreBehavior::UseInstanceIdle,
            edge: None,
            mascot_state: None,
            mascot_action_id: None,
            mascot_play_mode: None,
            mascot_playback_window_ms: None,
            mascot_bubble_template: None,
        }];
        rule
    }

    fn custom_desktop_notice_instance_with_bounds(id: &str) -> DesktopNoticeInstance {
        let mut settings = CustomLightbarSettings::default();
        settings.preset_position = DesktopNoticePresetPosition::Custom;
        settings.size = DesktopNoticeSize {
            width: 640,
            height: 28,
        };
        settings.bounds_override = Some(DesktopNoticeBounds {
            x: 320,
            y: 140,
            width: 640,
            height: 28,
            source_work_area: Some(DesktopNoticeWorkArea {
                x: 0,
                y: 25,
                width: 3440,
                height: 1415,
            }),
        });
        DesktopNoticeInstance {
            custom_lightbar: Some(settings),
            ..DesktopNoticeInstance::new_custom_lightbar(id, "导入灯条")
        }
    }

    fn mascot_desktop_notice_instance(id: &str, asset_pack_id: &str) -> DesktopNoticeInstance {
        let mut instance = DesktopNoticeInstance::new_mascot(id, "导入精灵");
        instance
            .mascot
            .as_mut()
            .expect("mascot settings should exist")
            .asset_pack_id = asset_pack_id.to_string();
        instance
    }

    fn connected_device_state(
        device_id: &str,
        board_id: &str,
        channels: Vec<DeviceChannel>,
    ) -> DeviceRuntimeState {
        let mut state = DeviceRuntimeState::disconnected();
        state.device_id = Some(device_id.to_string());
        state.board_id = Some(board_id.to_string());
        state.status = DeviceConnectionStatus::Connected;
        state.channels = channels;
        state
    }

    fn channel(channel_id: &str) -> DeviceChannel {
        let mut channel = DeviceChannel::digital_output(
            channel_id,
            channel_id,
            2,
            ActiveLevel::High,
            ActiveLevel::Low,
        );
        channel.id = channel_id.to_string();
        channel
    }

    fn display_channel(channel_id: &str) -> DeviceChannel {
        let mut channel = channel(channel_id);
        channel.kind = DeviceChannelKind::Display;
        channel.supported_actions = Vec::new();
        channel
    }
}
