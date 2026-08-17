use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::infrastructure::app_paths;
use crate::infrastructure::path_text::user_facing_path_text;

const USER_SOUND_DIR_NAME: &str = "sounds";
const SUPPORTED_AUDIO_EXTENSIONS: &[&str] = &["wav", "aiff", "aif", "mp3", "m4a"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundAsset {
    pub id: String,
    pub label: String,
    pub path: String,
    pub source: SoundAssetSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SoundAssetSource {
    BuiltIn,
    User,
}

#[derive(Debug, Clone)]
pub struct SoundAssetService {
    built_in_dir: PathBuf,
    app_home: PathBuf,
}

impl SoundAssetService {
    pub fn new(built_in_dir: PathBuf, app_home: PathBuf) -> Self {
        Self {
            built_in_dir,
            app_home,
        }
    }

    pub fn from_runtime_paths(resource_dir: Option<PathBuf>, app_home: PathBuf) -> Self {
        let built_in_dir = resource_dir
            .map(|dir| dir.join("assets"))
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets"))
            .join("sounds");

        Self::new(built_in_dir, app_home)
    }

    pub fn from_default_runtime_paths(resource_dir: Option<PathBuf>) -> Self {
        let app_home =
            app_paths::app_home_dir().unwrap_or_else(|_| std::env::temp_dir().join(".cc-notice"));
        Self::from_runtime_paths(resource_dir, app_home)
    }

    pub fn list_assets(&self) -> Result<Vec<SoundAsset>, String> {
        self.ensure_user_sound_dir()?;
        let mut assets = Vec::new();
        assets.extend(scan_sound_dir(
            &self.built_in_dir,
            SoundAssetSource::BuiltIn,
        ));
        assets.extend(scan_sound_dir(
            &self.user_sound_dir(),
            SoundAssetSource::User,
        ));
        Ok(assets)
    }

    pub fn user_sound_dir(&self) -> PathBuf {
        self.app_home.join(USER_SOUND_DIR_NAME)
    }

    fn ensure_user_sound_dir(&self) -> Result<(), String> {
        std::fs::create_dir_all(self.user_sound_dir())
            .map_err(|error| format!("failed to initialize user sound directory: {error}"))
    }
}

fn scan_sound_dir(dir: &Path, source: SoundAssetSource) -> Vec<SoundAsset> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut assets = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && is_supported_audio_file(path))
        .filter_map(|path| sound_asset_from_path(path, source.clone()))
        .collect::<Vec<_>>();
    assets.sort_by(|left, right| left.label.cmp(&right.label));
    assets
}

fn sound_asset_from_path(path: PathBuf, source: SoundAssetSource) -> Option<SoundAsset> {
    let file_stem = path.file_stem()?.to_string_lossy().to_string();
    let file_name = path.file_name()?.to_string_lossy().to_string();
    let id_prefix = match source {
        SoundAssetSource::BuiltIn => "builtin",
        SoundAssetSource::User => "user",
    };
    Some(SoundAsset {
        id: format!("{id_prefix}:{file_name}"),
        label: file_stem,
        path: user_facing_path_text(&path.to_string_lossy()),
        source,
    })
}

fn is_supported_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            SUPPORTED_AUDIO_EXTENSIONS
                .iter()
                .any(|supported| extension.eq_ignore_ascii_case(supported))
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::unique_temp_root;

    #[test]
    fn lists_built_in_and_user_sound_assets_with_supported_extensions_only() {
        let root = unique_temp_root("cc-notice-sound-assets");
        let built_in_dir = root.join("assets").join("sounds");
        let app_home = root.join(".cc-notice");
        let user_dir = app_home.join("sounds");
        std::fs::create_dir_all(&built_in_dir).expect("built-in dir should exist");
        std::fs::create_dir_all(&user_dir).expect("user dir should exist");
        std::fs::write(built_in_dir.join("done.wav"), "").expect("built-in sound should write");
        std::fs::write(user_dir.join("custom.MP3"), "").expect("user sound should write");
        std::fs::write(user_dir.join("ignore.txt"), "").expect("ignored file should write");

        let service = SoundAssetService::new(built_in_dir, app_home);
        let assets = service.list_assets().expect("assets should list");

        assert_eq!(2, assets.len());
        assert!(assets.iter().any(|asset| {
            asset.id == "builtin:done.wav"
                && asset.label == "done"
                && asset.source == SoundAssetSource::BuiltIn
        }));
        assert!(assets.iter().any(|asset| {
            asset.id == "user:custom.MP3"
                && asset.label == "custom"
                && asset.source == SoundAssetSource::User
        }));
    }

    #[test]
    fn missing_sound_directories_return_empty_assets() {
        let root = unique_temp_root("cc-notice-missing-sound-assets");
        let service = SoundAssetService::new(root.join("missing"), root.join(".cc-notice"));

        assert!(service
            .list_assets()
            .expect("assets should list")
            .is_empty());
        assert!(root.join(".cc-notice").join("sounds").is_dir());
    }

    #[test]
    fn list_assets_creates_user_sound_directory_when_missing() {
        let root = unique_temp_root("cc-notice-create-sound-assets");
        let app_home = root.join(".cc-notice");
        let service = SoundAssetService::new(root.join("assets").join("sounds"), app_home.clone());

        let assets = service.list_assets().expect("assets should list");

        assert!(assets.is_empty());
        assert!(app_home.join("sounds").is_dir());
    }

    #[test]
    fn strips_windows_verbatim_prefix_for_frontend_paths() {
        assert_eq!(
            r"C:\Program Files\CC Notice\assets\sounds\done.mp3",
            user_facing_path_text(r"\\?\C:\Program Files\CC Notice\assets\sounds\done.mp3")
        );
        assert_eq!(
            r"\\server\share\done.mp3",
            user_facing_path_text(r"\\?\UNC\server\share\done.mp3")
        );
    }
}
