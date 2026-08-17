use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::core::desktop_notice::{DesktopMascotPlayMode, DesktopMascotState};
use crate::infrastructure::app_paths;

const MASCOT_DIR_NAME: &str = "mascots";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const MAX_PACK_DIRS: usize = 64;
const MAX_MANIFEST_BYTES: u64 = 256 * 1024;
const MAX_ANIMATION_COUNT: usize = 128;
const MAX_ACTION_COUNT: usize = 64;
const MAX_GIF_FILE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_PACK_BYTES: u64 = 80 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMascotScanResult {
    pub root_dir: String,
    pub packs: Vec<CustomMascotPack>,
    pub diagnostics: Vec<CustomMascotDiagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMascotPack {
    pub id: String,
    pub name: String,
    pub version: String,
    pub renderer: CustomMascotRenderer,
    pub animations: HashMap<String, String>,
    pub states: Vec<DesktopMascotState>,
    pub actions: Vec<CustomMascotAction>,
    pub interactions: CustomMascotInteractions,
    pub source: CustomMascotSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CustomMascotRenderer {
    Gif,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CustomMascotSource {
    Local,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMascotAction {
    pub id: String,
    #[serde(default)]
    pub label: Option<String>,
    pub state: DesktopMascotState,
    pub animation: String,
    #[serde(default)]
    #[serde(rename = "loop")]
    pub loop_enabled: bool,
    #[serde(default)]
    pub interruptible: bool,
    #[serde(default)]
    pub play_mode: Option<DesktopMascotPlayMode>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMascotInteractions {
    pub hover_action_id: String,
    pub click_action_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMascotDiagnostic {
    pub pack_id: Option<String>,
    pub path: String,
    pub code: CustomMascotDiagnosticCode,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CustomMascotDiagnosticCode {
    ManifestReadFailed,
    ManifestInvalidJson,
    ManifestTooLarge,
    InvalidId,
    InvalidRenderer,
    InvalidAnimationPath,
    MissingAnimationFile,
    InvalidGifFile,
    AnimationFileTooLarge,
    PackTooLarge,
    TooManyPacks,
    TooManyAnimations,
    TooManyActions,
    MissingRequiredAction,
    UnknownActionAnimation,
    InvalidInteractionAction,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomMascotManifest {
    id: String,
    name: String,
    version: String,
    renderer: String,
    animations: HashMap<String, String>,
    actions: Vec<CustomMascotAction>,
    interactions: CustomMascotInteractions,
}

pub fn custom_mascot_root_dir() -> Result<PathBuf, String> {
    Ok(app_paths::app_home_dir()?.join(MASCOT_DIR_NAME))
}

pub fn scan_custom_mascot_packs() -> Result<CustomMascotScanResult, String> {
    scan_custom_mascot_packs_from_root(custom_mascot_root_dir()?)
}

pub fn resolve_custom_mascot_pack(asset_pack_id: &str) -> Option<CustomMascotPack> {
    scan_custom_mascot_packs().ok().and_then(|result| {
        result
            .packs
            .into_iter()
            .find(|pack| pack.id == asset_pack_id)
    })
}

pub fn scan_custom_mascot_packs_from_root(
    root_dir: PathBuf,
) -> Result<CustomMascotScanResult, String> {
    let mut packs = Vec::new();
    let mut diagnostics = Vec::new();
    if !root_dir.exists() {
        fs::create_dir_all(&root_dir).map_err(|error| error.to_string())?;
    }
    let entries = fs::read_dir(&root_dir).map_err(|error| error.to_string())?;
    let mut pack_dir_count = 0_usize;
    for entry in entries.flatten() {
        let pack_dir = entry.path();
        if !pack_dir.is_dir() {
            continue;
        }
        pack_dir_count += 1;
        if pack_dir_count > MAX_PACK_DIRS {
            diagnostics.push(diagnostic(
                &root_dir,
                None,
                CustomMascotDiagnosticCode::TooManyPacks,
                "too many local mascot packs",
            ));
            break;
        }
        match load_pack_from_dir(&pack_dir) {
            Ok(pack) => packs.push(pack),
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }
    packs.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    diagnostics.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(CustomMascotScanResult {
        root_dir: root_dir.to_string_lossy().to_string(),
        packs,
        diagnostics,
    })
}

fn load_pack_from_dir(pack_dir: &Path) -> Result<CustomMascotPack, CustomMascotDiagnostic> {
    let manifest_path = pack_dir.join(MANIFEST_FILE_NAME);
    let manifest_size = fs::metadata(&manifest_path)
        .map_err(|error| {
            diagnostic(
                pack_dir,
                None,
                CustomMascotDiagnosticCode::ManifestReadFailed,
                format!("failed to read manifest metadata: {error}"),
            )
        })?
        .len();
    if manifest_size > MAX_MANIFEST_BYTES {
        return Err(diagnostic(
            pack_dir,
            None,
            CustomMascotDiagnosticCode::ManifestTooLarge,
            "manifest is larger than 256KB",
        ));
    }
    let content = fs::read_to_string(&manifest_path).map_err(|error| {
        diagnostic(
            pack_dir,
            None,
            CustomMascotDiagnosticCode::ManifestReadFailed,
            format!("failed to read manifest: {error}"),
        )
    })?;
    let manifest: CustomMascotManifest = serde_json::from_str(&content).map_err(|error| {
        diagnostic(
            pack_dir,
            None,
            CustomMascotDiagnosticCode::ManifestInvalidJson,
            format!("invalid manifest json: {error}"),
        )
    })?;
    validate_pack_id(pack_dir, &manifest.id)?;
    let renderer = validate_renderer(pack_dir, &manifest.id, &manifest.renderer)?;
    validate_manifest_size_limits(pack_dir, &manifest)?;
    let animations = resolve_animation_paths(pack_dir, &manifest)?;
    validate_pack_size(pack_dir, &manifest.id, &animations)?;
    validate_actions(pack_dir, &manifest)?;
    let states = states_for_actions(&manifest.actions);
    Ok(CustomMascotPack {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        renderer,
        animations,
        states,
        actions: manifest.actions,
        interactions: manifest.interactions,
        source: CustomMascotSource::Local,
    })
}

fn validate_manifest_size_limits(
    pack_dir: &Path,
    manifest: &CustomMascotManifest,
) -> Result<(), CustomMascotDiagnostic> {
    if manifest.animations.len() > MAX_ANIMATION_COUNT {
        return Err(diagnostic(
            pack_dir,
            Some(&manifest.id),
            CustomMascotDiagnosticCode::TooManyAnimations,
            "mascot pack has too many animations",
        ));
    }
    if manifest.actions.len() > MAX_ACTION_COUNT {
        return Err(diagnostic(
            pack_dir,
            Some(&manifest.id),
            CustomMascotDiagnosticCode::TooManyActions,
            "mascot pack has too many actions",
        ));
    }
    Ok(())
}

fn validate_pack_id(pack_dir: &Path, id: &str) -> Result<(), CustomMascotDiagnostic> {
    if id.is_empty()
        || !id.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'-' | b'_' | b'.')
        })
    {
        return Err(diagnostic(
            pack_dir,
            Some(id),
            CustomMascotDiagnosticCode::InvalidId,
            "manifest id must use lowercase letters, numbers, dot, underscore or hyphen",
        ));
    }
    Ok(())
}

fn validate_renderer(
    pack_dir: &Path,
    pack_id: &str,
    renderer: &str,
) -> Result<CustomMascotRenderer, CustomMascotDiagnostic> {
    if renderer == "gif" {
        return Ok(CustomMascotRenderer::Gif);
    }
    Err(diagnostic(
        pack_dir,
        Some(pack_id),
        CustomMascotDiagnosticCode::InvalidRenderer,
        "manifest renderer must be gif",
    ))
}

fn resolve_animation_paths(
    pack_dir: &Path,
    manifest: &CustomMascotManifest,
) -> Result<HashMap<String, String>, CustomMascotDiagnostic> {
    let mut resolved = HashMap::new();
    let canonical_pack_dir = fs::canonicalize(pack_dir).map_err(|error| {
        diagnostic(
            pack_dir,
            Some(&manifest.id),
            CustomMascotDiagnosticCode::InvalidAnimationPath,
            format!("failed to resolve mascot pack path: {error}"),
        )
    })?;
    for (animation_id, relative_path) in &manifest.animations {
        if !is_safe_relative_gif_path(relative_path) {
            return Err(diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::InvalidAnimationPath,
                format!("animation {animation_id} must be a relative gif path inside the pack"),
            ));
        }
        let path = pack_dir.join(relative_path);
        if !path.is_file() {
            return Err(diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::MissingAnimationFile,
                format!("animation file not found: {relative_path}"),
            ));
        }
        let canonical_path = fs::canonicalize(&path).map_err(|error| {
            diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::InvalidAnimationPath,
                format!("failed to resolve animation file path: {relative_path}: {error}"),
            )
        })?;
        if !canonical_path.starts_with(&canonical_pack_dir) {
            return Err(diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::InvalidAnimationPath,
                format!("animation {animation_id} must stay inside the mascot pack directory"),
            ));
        }
        let size = fs::metadata(&canonical_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        if size > MAX_GIF_FILE_BYTES {
            return Err(diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::AnimationFileTooLarge,
                format!("animation file is larger than 10MB: {relative_path}"),
            ));
        }
        validate_gif_header(pack_dir, &manifest.id, &canonical_path, relative_path)?;
        resolved.insert(
            animation_id.clone(),
            canonical_path.to_string_lossy().to_string(),
        );
    }
    Ok(resolved)
}

fn validate_gif_header(
    pack_dir: &Path,
    pack_id: &str,
    path: &Path,
    relative_path: &str,
) -> Result<(), CustomMascotDiagnostic> {
    let mut file = fs::File::open(path).map_err(|error| {
        diagnostic(
            pack_dir,
            Some(pack_id),
            CustomMascotDiagnosticCode::InvalidGifFile,
            format!("failed to read gif header: {relative_path}: {error}"),
        )
    })?;
    let mut header = [0_u8; 6];
    file.read_exact(&mut header).map_err(|error| {
        diagnostic(
            pack_dir,
            Some(pack_id),
            CustomMascotDiagnosticCode::InvalidGifFile,
            format!("failed to read gif header: {relative_path}: {error}"),
        )
    })?;
    if header == *b"GIF87a" || header == *b"GIF89a" {
        return Ok(());
    }
    Err(diagnostic(
        pack_dir,
        Some(pack_id),
        CustomMascotDiagnosticCode::InvalidGifFile,
        format!("animation file is not a gif: {relative_path}"),
    ))
}

fn validate_pack_size(
    pack_dir: &Path,
    pack_id: &str,
    animations: &HashMap<String, String>,
) -> Result<(), CustomMascotDiagnostic> {
    let mut total_bytes = 0_u64;
    for path in animations.values() {
        total_bytes += fs::metadata(path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);
    }
    if total_bytes > MAX_PACK_BYTES {
        return Err(diagnostic(
            pack_dir,
            Some(pack_id),
            CustomMascotDiagnosticCode::PackTooLarge,
            "mascot pack is larger than 80MB",
        ));
    }
    Ok(())
}

fn validate_actions(
    pack_dir: &Path,
    manifest: &CustomMascotManifest,
) -> Result<(), CustomMascotDiagnostic> {
    let animation_ids: HashSet<&str> = manifest.animations.keys().map(String::as_str).collect();
    for action in &manifest.actions {
        if !animation_ids.contains(action.animation.as_str()) {
            return Err(diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::UnknownActionAnimation,
                format!(
                    "action {} references unknown animation {}",
                    action.id, action.animation
                ),
            ));
        }
    }
    let action_ids: HashSet<&str> = manifest
        .actions
        .iter()
        .map(|action| action.id.as_str())
        .collect();
    for action_id in [
        manifest.interactions.hover_action_id.as_str(),
        manifest.interactions.click_action_id.as_str(),
    ] {
        if !action_ids.contains(action_id) {
            return Err(diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::InvalidInteractionAction,
                format!("interaction action does not exist: {action_id}"),
            ));
        }
    }
    for state in [
        DesktopMascotState::Idle,
        DesktopMascotState::TaskReceived,
        DesktopMascotState::Working,
        DesktopMascotState::Success,
        DesktopMascotState::Error,
    ] {
        if !manifest.actions.iter().any(|action| action.state == state) {
            return Err(diagnostic(
                pack_dir,
                Some(&manifest.id),
                CustomMascotDiagnosticCode::MissingRequiredAction,
                format!("missing required mascot action state: {state:?}"),
            ));
        }
    }
    Ok(())
}

fn states_for_actions(actions: &[CustomMascotAction]) -> Vec<DesktopMascotState> {
    let mut states = Vec::new();
    for action in actions {
        if !states.contains(&action.state) {
            states.push(action.state);
        }
    }
    states
}

fn is_safe_relative_gif_path(value: &str) -> bool {
    let path = Path::new(value);
    !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
        && path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("gif"))
}

fn diagnostic(
    pack_dir: &Path,
    pack_id: Option<&str>,
    code: CustomMascotDiagnosticCode,
    message: impl Into<String>,
) -> CustomMascotDiagnostic {
    CustomMascotDiagnostic {
        pack_id: pack_id.map(str::to_string),
        path: pack_dir.to_string_lossy().to_string(),
        code,
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_valid_custom_gif_mascot_pack() {
        let root = unique_test_root("valid-pack");
        let pack_dir = root.join("my-mascot");
        write_valid_pack(&pack_dir, "my-mascot");

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.diagnostics.len());
        assert_eq!(1, result.packs.len());
        let pack = &result.packs[0];
        assert_eq!("my-mascot", pack.id);
        assert_eq!("我的精灵", pack.name);
        assert_eq!(CustomMascotRenderer::Gif, pack.renderer);
        assert_eq!(CustomMascotSource::Local, pack.source);
        assert!(pack.animations["idle-sleep"].ends_with("idle-sleep.gif"));
        assert!(pack
            .actions
            .iter()
            .any(|action| action.state == DesktopMascotState::Idle));
    }

    #[test]
    fn creates_empty_root_dir_when_scanning_missing_mascot_root() {
        let parent = unique_test_root("missing-root-parent");
        let root = parent.join("mascots");

        let result =
            scan_custom_mascot_packs_from_root(root.clone()).expect("scan should complete");

        assert!(root.is_dir());
        assert_eq!(root.to_string_lossy(), result.root_dir);
        assert_eq!(0, result.packs.len());
        assert_eq!(0, result.diagnostics.len());
    }

    #[test]
    fn rejects_animation_paths_outside_pack() {
        let root = unique_test_root("unsafe-path");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        let manifest_path = pack_dir.join(MANIFEST_FILE_NAME);
        let mut value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("manifest should exist"),
        )
        .expect("manifest should parse");
        value["animations"]["idle-sleep"] = serde_json::Value::String("../idle.gif".to_string());
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&value).unwrap(),
        )
        .unwrap();

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::InvalidAnimationPath,
            result.diagnostics[0].code
        );
    }

    #[test]
    fn rejects_pack_missing_required_action_state() {
        let root = unique_test_root("missing-action");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        let manifest_path = pack_dir.join(MANIFEST_FILE_NAME);
        let mut value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("manifest should exist"),
        )
        .expect("manifest should parse");
        value["actions"] = serde_json::Value::Array(
            value["actions"]
                .as_array()
                .expect("actions should be array")
                .iter()
                .filter(|action| action["state"] != "error")
                .cloned()
                .collect(),
        );
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&value).unwrap(),
        )
        .unwrap();

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::MissingRequiredAction,
            result.diagnostics[0].code
        );
    }

    #[test]
    fn rejects_invalid_renderer_with_stable_code() {
        let root = unique_test_root("invalid-renderer");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        let manifest_path = pack_dir.join(MANIFEST_FILE_NAME);
        let mut value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("manifest should exist"),
        )
        .expect("manifest should parse");
        value["renderer"] = serde_json::Value::String("svg".to_string());
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&value).unwrap(),
        )
        .unwrap();

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::InvalidRenderer,
            result.diagnostics[0].code
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_animation_symlink_to_file_outside_pack() {
        use std::os::unix::fs::symlink;

        let root = unique_test_root("symlink-outside");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        let outside_gif = root.join("outside.gif");
        fs::write(&outside_gif, b"GIF89a").expect("outside gif should be written");
        let linked_gif = pack_dir.join("animations").join("linked.gif");
        symlink(&outside_gif, &linked_gif).expect("symlink should be created");
        let manifest_path = pack_dir.join(MANIFEST_FILE_NAME);
        let mut value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("manifest should exist"),
        )
        .expect("manifest should parse");
        value["animations"]["idle-sleep"] =
            serde_json::Value::String("animations/linked.gif".to_string());
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&value).unwrap(),
        )
        .unwrap();

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::InvalidAnimationPath,
            result.diagnostics[0].code
        );
    }

    #[test]
    fn rejects_manifest_larger_than_limit() {
        let root = unique_test_root("large-manifest");
        let pack_dir = root.join("bad-mascot");
        fs::create_dir_all(&pack_dir).expect("pack dir should be created");
        fs::write(pack_dir.join(MANIFEST_FILE_NAME), "x".repeat(257 * 1024))
            .expect("manifest should be written");

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::ManifestTooLarge,
            result.diagnostics[0].code
        );
    }

    #[test]
    fn accepts_gif_files_above_previous_two_mb_guideline() {
        let root = unique_test_root("larger-animation");
        let pack_dir = root.join("larger-mascot");
        write_valid_pack(&pack_dir, "larger-mascot");
        resize_gif_file(
            &pack_dir.join("animations").join("working.gif"),
            3 * 1024 * 1024,
        );

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.diagnostics.len());
        assert_eq!(1, result.packs.len());
    }

    #[test]
    fn rejects_gif_file_larger_than_ten_mb() {
        let root = unique_test_root("too-large-animation");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        resize_gif_file(
            &pack_dir.join("animations").join("working.gif"),
            10 * 1024 * 1024 + 1,
        );

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::AnimationFileTooLarge,
            result.diagnostics[0].code
        );
        assert!(result.diagnostics[0].message.contains("10MB"));
    }

    #[test]
    fn accepts_pack_above_previous_twenty_mb_guideline() {
        let root = unique_test_root("larger-pack");
        let pack_dir = root.join("larger-mascot");
        write_valid_pack(&pack_dir, "larger-mascot");
        for file_name in [
            "idle-sleep.gif",
            "task-wave.gif",
            "working.gif",
            "success.gif",
            "error.gif",
        ] {
            resize_gif_file(
                &pack_dir.join("animations").join(file_name),
                5 * 1024 * 1024,
            );
        }

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.diagnostics.len());
        assert_eq!(1, result.packs.len());
    }

    #[test]
    fn rejects_pack_larger_than_eighty_mb() {
        let root = unique_test_root("too-large-pack");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        add_extra_animation_refs(&pack_dir, 9);
        for index in 0..9 {
            resize_gif_file(
                &pack_dir
                    .join("animations")
                    .join(format!("large-extra-{index}.gif")),
                9 * 1024 * 1024 + 512 * 1024,
            );
        }

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::PackTooLarge,
            result.diagnostics[0].code
        );
        assert!(result.diagnostics[0].message.contains("80MB"));
    }

    #[test]
    fn rejects_too_many_actions() {
        let root = unique_test_root("too-many-actions");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        let manifest_path = pack_dir.join(MANIFEST_FILE_NAME);
        let mut value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("manifest should exist"),
        )
        .expect("manifest should parse");
        let actions = (0..65)
            .map(|index| {
                serde_json::json!({
                    "id": format!("working.extra-{index}"),
                    "label": "额外动作",
                    "state": "working",
                    "animation": "working",
                    "playMode": "loop",
                    "interruptible": true
                })
            })
            .collect();
        value["actions"] = serde_json::Value::Array(actions);
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&value).unwrap(),
        )
        .unwrap();

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::TooManyActions,
            result.diagnostics[0].code
        );
    }

    #[test]
    fn rejects_non_gif_file_content() {
        let root = unique_test_root("invalid-gif-content");
        let pack_dir = root.join("bad-mascot");
        write_valid_pack(&pack_dir, "bad-mascot");
        fs::write(pack_dir.join("animations").join("working.gif"), b"not-gif")
            .expect("gif should be overwritten");

        let result = scan_custom_mascot_packs_from_root(root).expect("scan should complete");

        assert_eq!(0, result.packs.len());
        assert_eq!(
            CustomMascotDiagnosticCode::InvalidGifFile,
            result.diagnostics[0].code
        );
    }

    fn write_valid_pack(pack_dir: &Path, id: &str) {
        let animations_dir = pack_dir.join("animations");
        fs::create_dir_all(&animations_dir).expect("animations dir should be created");
        for file_name in [
            "idle-sleep.gif",
            "task-wave.gif",
            "working.gif",
            "success.gif",
            "error.gif",
        ] {
            fs::write(animations_dir.join(file_name), b"GIF89a").expect("gif should be written");
        }
        let manifest = serde_json::json!({
            "id": id,
            "name": "我的精灵",
            "version": "1.0.0",
            "renderer": "gif",
            "animations": {
                "idle-sleep": "animations/idle-sleep.gif",
                "task-wave": "animations/task-wave.gif",
                "working": "animations/working.gif",
                "success": "animations/success.gif",
                "error": "animations/error.gif"
            },
            "actions": [
                {"id":"idle.sleep","label":"空闲：睡觉","state":"idle","animation":"idle-sleep","loop":true,"interruptible":true,"playMode":"loop"},
                {"id":"task-received.wave","label":"收到任务：打招呼","state":"task-received","animation":"task-wave","loop":false,"interruptible":true,"playMode":"once-then-idle"},
                {"id":"working.loop","label":"工作中","state":"working","animation":"working","loop":true,"interruptible":true,"playMode":"loop"},
                {"id":"success.ok","label":"完成","state":"success","animation":"success","loop":false,"interruptible":false,"playMode":"once-then-hold"},
                {"id":"error.cry","label":"出错","state":"error","animation":"error","loop":false,"interruptible":false,"playMode":"once-then-hold"}
            ],
            "interactions": {
                "hoverActionId": "idle.sleep",
                "clickActionId": "task-received.wave"
            }
        });
        fs::write(
            pack_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .expect("manifest should be written");
    }

    fn add_extra_animation_refs(pack_dir: &Path, count: usize) {
        let manifest_path = pack_dir.join(MANIFEST_FILE_NAME);
        let mut value: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("manifest should exist"),
        )
        .expect("manifest should parse");
        let animations = value["animations"]
            .as_object_mut()
            .expect("animations should be object");
        for index in 0..count {
            let file_name = format!("large-extra-{index}.gif");
            fs::write(pack_dir.join("animations").join(&file_name), b"GIF89a")
                .expect("gif should be written");
            animations.insert(
                format!("large-extra-{index}"),
                serde_json::Value::String(format!("animations/{file_name}")),
            );
        }
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&value).unwrap(),
        )
        .expect("manifest should be written");
    }

    fn resize_gif_file(path: &Path, size: u64) {
        fs::write(path, b"GIF89a").expect("gif header should be written");
        let file = fs::OpenOptions::new()
            .write(true)
            .open(path)
            .expect("gif should be opened");
        file.set_len(size).expect("gif size should be changed");
    }

    fn unique_test_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "cc-notice-custom-mascot-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("test root should be created");
        root
    }
}
