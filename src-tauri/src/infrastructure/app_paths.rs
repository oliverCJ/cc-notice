use std::path::{Path, PathBuf};

pub const APP_HOME_DIR_NAME: &str = ".cc-notice";

pub fn user_home_dir() -> Result<PathBuf, String> {
    user_home_dir_from_env(
        std::env::var_os("HOME").map(PathBuf::from),
        std::env::var_os("USERPROFILE").map(PathBuf::from),
        std::env::var_os("HOMEDRIVE"),
        std::env::var_os("HOMEPATH"),
    )
}

pub fn user_home_dir_from_env(
    home: Option<PathBuf>,
    userprofile: Option<PathBuf>,
    homedrive: Option<std::ffi::OsString>,
    homepath: Option<std::ffi::OsString>,
) -> Result<PathBuf, String> {
    if let Some(path) = non_empty_path(home) {
        return Ok(path);
    }
    if let Some(path) = non_empty_path(userprofile) {
        return Ok(path);
    }
    if let (Some(drive), Some(path)) = (homedrive, homepath) {
        let mut combined = PathBuf::from(drive);
        combined.push(path);
        if let Some(path) = non_empty_path(Some(combined)) {
            return Ok(path);
        }
    }
    Err("user home directory is not available".to_string())
}

pub fn app_home_dir() -> Result<PathBuf, String> {
    Ok(app_home_dir_for_user(&user_home_dir()?))
}

pub fn app_home_dir_for_user(home: &Path) -> PathBuf {
    home.join(APP_HOME_DIR_NAME)
}

pub fn settings_file_path() -> Result<PathBuf, String> {
    Ok(app_home_dir()?.join("settings.json"))
}

fn non_empty_path(path: Option<PathBuf>) -> Option<PathBuf> {
    path.filter(|value| !value.as_os_str().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_home_prefers_home() {
        let home = user_home_dir_from_env(
            Some(PathBuf::from("/Users/alice")),
            Some(PathBuf::from("C:\\Users\\alice")),
            None,
            None,
        )
        .expect("home should resolve");

        assert_eq!(Path::new("/Users/alice"), home.as_path());
    }

    #[test]
    fn user_home_falls_back_to_userprofile() {
        let home =
            user_home_dir_from_env(None, Some(PathBuf::from("C:\\Users\\alice")), None, None)
                .expect("userprofile should resolve");

        assert_eq!(Path::new("C:\\Users\\alice"), home.as_path());
    }

    #[test]
    fn user_home_falls_back_to_home_drive_and_path() {
        let home =
            user_home_dir_from_env(None, None, Some("C:".into()), Some("\\Users\\alice".into()))
                .expect("home drive and path should resolve");

        assert_eq!(Path::new("C:").join("\\Users\\alice"), home);
    }

    #[test]
    fn app_home_uses_hidden_directory_under_user_home() {
        let app_home = app_home_dir_for_user(Path::new("/Users/alice"));

        assert_eq!(Path::new("/Users/alice/.cc-notice"), app_home.as_path());
    }
}
