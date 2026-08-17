use std::path::{Path, PathBuf};

use crate::infrastructure::app_paths;

#[derive(Debug, Clone)]
pub struct ToolBinService {
    app_home: PathBuf,
    relay_source: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayInstallationStatus {
    pub source_path: PathBuf,
    pub source_exists: bool,
    pub installed_path: PathBuf,
    pub installed_exists: bool,
    pub content_matches: bool,
}

impl ToolBinService {
    pub fn new(app_home: PathBuf, relay_source: PathBuf) -> Self {
        Self {
            app_home,
            relay_source,
        }
    }

    pub fn from_project_root(project_root: PathBuf) -> Result<Self, String> {
        Ok(Self::from_paths(
            app_paths::app_home_dir()?,
            None,
            project_root,
        ))
    }

    pub fn from_runtime_paths(
        app_home: PathBuf,
        resources_dir: Option<PathBuf>,
        project_root: PathBuf,
    ) -> Self {
        Self::from_paths(app_home, resources_dir, project_root)
    }

    pub fn from_paths(
        app_home: PathBuf,
        resources_dir: Option<PathBuf>,
        project_root: PathBuf,
    ) -> Self {
        let packaged_source = resources_dir.as_ref().map(|dir| {
            dir.join("assets")
                .join("tools")
                .join(executable_name("cc-notice-relay"))
        });
        let debug_source = project_root
            .join("src-tauri")
            .join("target")
            .join("debug")
            .join(executable_name("cc-notice-relay"));
        let relay_source = resolve_relay_source(packaged_source.as_deref(), &debug_source);
        Self::new(app_home, relay_source)
    }

    pub fn ensure_relay_installed(&self) -> Result<PathBuf, String> {
        let target = self.bin_dir().join(executable_name("cc-notice-relay"));
        if target.exists() {
            if same_file_content(&self.relay_source, &target)? {
                return Ok(target);
            }
        }
        if !self.relay_source.exists() {
            return Err(format!(
                "cc-notice-relay is not built at {}. Run npm run build:relay before writing hooks.",
                self.relay_source.to_string_lossy()
            ));
        }

        std::fs::create_dir_all(self.bin_dir()).map_err(|error| error.to_string())?;
        std::fs::copy(&self.relay_source, &target).map_err(|error| error.to_string())?;
        make_executable(&target)?;
        tracing::info!("tool installed: {}", target.to_string_lossy());
        Ok(target)
    }

    pub fn relay_installation_status(&self) -> RelayInstallationStatus {
        let installed_path = self.bin_dir().join(executable_name("cc-notice-relay"));
        let source_exists = self.relay_source.exists();
        let installed_exists = installed_path.exists();
        let content_matches = if source_exists && installed_exists {
            same_file_content(&self.relay_source, &installed_path).unwrap_or(false)
        } else {
            false
        };

        RelayInstallationStatus {
            source_path: self.relay_source.clone(),
            source_exists,
            installed_path,
            installed_exists,
            content_matches,
        }
    }

    fn bin_dir(&self) -> PathBuf {
        self.app_home.join("bin")
    }
}

fn executable_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

fn same_file_content(source: &Path, target: &Path) -> Result<bool, String> {
    let source_content = std::fs::read(source).map_err(|error| error.to_string())?;
    let target_content = std::fs::read(target).map_err(|error| error.to_string())?;
    Ok(source_content == target_content)
}

fn resolve_relay_source(packaged_source: Option<&Path>, debug_source: &Path) -> PathBuf {
    let packaged = packaged_source.filter(|path| path.exists());
    let debug_exists = debug_source.exists();

    match (packaged, debug_exists) {
        (Some(packaged_path), true) => {
            if is_newer(debug_source, packaged_path) {
                debug_source.to_path_buf()
            } else {
                packaged_path.to_path_buf()
            }
        }
        (Some(packaged_path), false) => packaged_path.to_path_buf(),
        (None, _) => debug_source.to_path_buf(),
    }
}

fn is_newer(left: &Path, right: &Path) -> bool {
    let Ok(left_modified) = std::fs::metadata(left).and_then(|metadata| metadata.modified()) else {
        return false;
    };
    let Ok(right_modified) = std::fs::metadata(right).and_then(|metadata| metadata.modified())
    else {
        return true;
    };
    left_modified > right_modified
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = std::fs::metadata(path)
        .map_err(|error| error.to_string())?
        .permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(path, permissions).map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installs_missing_relay_into_user_bin() {
        let root = std::path::PathBuf::from("/private/tmp")
            .join(format!("cc-notice-tool-bin-install-{}", std::process::id()));
        let source_dir = root.join("source");
        let user_root = root.join("user");
        std::fs::create_dir_all(&source_dir).expect("source dir");
        let source = source_dir.join("cc-notice-relay");
        std::fs::write(&source, "relay").expect("source binary");

        let service = ToolBinService::new(user_root.join(".cc-notice"), source);
        let installed = service
            .ensure_relay_installed()
            .expect("relay should install");

        assert_eq!(user_root.join(".cc-notice/bin/cc-notice-relay"), installed);
        assert_eq!(
            "relay",
            std::fs::read_to_string(installed).expect("installed content")
        );
    }

    #[test]
    fn skips_existing_relay_when_content_is_current() {
        let root = std::path::PathBuf::from("/private/tmp")
            .join(format!("cc-notice-tool-bin-skip-{}", std::process::id()));
        let source_dir = root.join("source");
        let user_root = root.join("user");
        std::fs::create_dir_all(&source_dir).expect("source dir");
        std::fs::create_dir_all(user_root.join(".cc-notice/bin")).expect("bin dir");
        let source = source_dir.join("cc-notice-relay");
        let installed = user_root.join(".cc-notice/bin/cc-notice-relay");
        std::fs::write(&source, "existing-relay").expect("source binary");
        std::fs::write(&installed, "existing-relay").expect("existing binary");

        let service = ToolBinService::new(user_root.join(".cc-notice"), source);
        let result = service
            .ensure_relay_installed()
            .expect("relay should resolve");

        assert_eq!(installed, result);
        assert_eq!(
            "existing-relay",
            std::fs::read_to_string(result).expect("installed content")
        );
    }

    #[test]
    fn updates_existing_relay_when_source_content_differs() {
        let root = std::path::PathBuf::from("/private/tmp")
            .join(format!("cc-notice-tool-bin-update-{}", std::process::id()));
        let source_dir = root.join("source");
        let user_root = root.join("user");
        std::fs::create_dir_all(&source_dir).expect("source dir");
        std::fs::create_dir_all(user_root.join(".cc-notice/bin")).expect("bin dir");
        let source = source_dir.join("cc-notice-relay");
        let installed = user_root.join(".cc-notice/bin/cc-notice-relay");
        std::fs::write(&source, "new-relay").expect("source binary");
        std::fs::write(&installed, "old-relay").expect("existing binary");

        let service = ToolBinService::new(user_root.join(".cc-notice"), source);
        let result = service
            .ensure_relay_installed()
            .expect("relay should update");

        assert_eq!(installed, result);
        assert_eq!(
            "new-relay",
            std::fs::read_to_string(result).expect("installed content")
        );
    }

    #[test]
    fn resolves_packaged_resource_before_project_target() {
        let root = std::path::PathBuf::from("/private/tmp")
            .join(format!("cc-notice-tool-bin-resolve-{}", std::process::id()));
        let app_home = root.join("home").join(".cc-notice");
        let resources_dir = root.join("resources");
        let project_root = root.join("app");
        let packaged = resources_dir.join("assets/tools/cc-notice-relay");
        let debug = project_root.join("src-tauri/target/debug/cc-notice-relay");
        std::fs::create_dir_all(packaged.parent().expect("packaged parent")).expect("packaged dir");
        std::fs::create_dir_all(debug.parent().expect("debug parent")).expect("debug dir");
        std::fs::write(&debug, "debug").expect("debug relay");
        std::thread::sleep(std::time::Duration::from_millis(2));
        std::fs::write(&packaged, "packaged").expect("packaged relay");

        let service =
            ToolBinService::from_paths(app_home.clone(), Some(resources_dir), project_root);
        let installed = service
            .ensure_relay_installed()
            .expect("relay should install");

        assert_eq!(app_home.join("bin/cc-notice-relay"), installed);
        assert_eq!(
            "packaged",
            std::fs::read_to_string(installed).expect("installed content")
        );
    }

    #[test]
    fn resolves_newer_debug_relay_when_packaged_asset_is_stale() {
        let root = std::path::PathBuf::from("/private/tmp").join(format!(
            "cc-notice-tool-bin-stale-asset-{}",
            std::process::id()
        ));
        let app_home = root.join("home").join(".cc-notice");
        let resources_dir = root.join("resources");
        let project_root = root.join("app");
        let packaged = resources_dir.join("assets/tools/cc-notice-relay");
        let debug = project_root.join("src-tauri/target/debug/cc-notice-relay");
        std::fs::create_dir_all(packaged.parent().expect("packaged parent")).expect("packaged dir");
        std::fs::create_dir_all(debug.parent().expect("debug parent")).expect("debug dir");
        std::fs::write(&packaged, "old-packaged").expect("packaged relay");
        std::thread::sleep(std::time::Duration::from_millis(2));
        std::fs::write(&debug, "new-debug").expect("debug relay");

        let service =
            ToolBinService::from_paths(app_home.clone(), Some(resources_dir), project_root);
        let installed = service
            .ensure_relay_installed()
            .expect("relay should install");

        assert_eq!(app_home.join("bin/cc-notice-relay"), installed);
        assert_eq!(
            "new-debug",
            std::fs::read_to_string(installed).expect("installed content")
        );
    }

    #[test]
    fn returns_readable_error_when_dev_source_is_missing() {
        let root = std::path::PathBuf::from("/private/tmp")
            .join(format!("cc-notice-tool-bin-missing-{}", std::process::id()));
        let service = ToolBinService::new(
            root.join(".cc-notice"),
            root.join("target/debug/cc-notice-relay"),
        );

        let error = service
            .ensure_relay_installed()
            .expect_err("missing relay should fail");

        assert!(error.contains("cc-notice-relay is not built"));
        assert!(error.contains("npm run build:relay"));
    }

    #[test]
    fn reports_relay_installation_status_without_installing_missing_target() {
        let root = std::path::PathBuf::from("/private/tmp")
            .join(format!("cc-notice-tool-bin-status-{}", std::process::id()));
        let source_dir = root.join("source");
        let app_home = root.join("home").join(".cc-notice");
        std::fs::create_dir_all(&source_dir).expect("source dir");
        let source = source_dir.join("cc-notice-relay");
        std::fs::write(&source, "relay").expect("source binary");

        let service = ToolBinService::new(app_home.clone(), source.clone());
        let status = service.relay_installation_status();

        assert!(status.source_exists);
        assert!(!status.installed_exists);
        assert_eq!(app_home.join("bin/cc-notice-relay"), status.installed_path);
        assert!(!status.installed_path.exists());
    }
}
