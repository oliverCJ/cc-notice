use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

pub const TOKEN_FILE_NAME: &str = ".hook-token";

/// 生成新的认证 token（UUID v4）
pub fn generate_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 获取 token 文件路径
pub fn token_file_path(app_home: &Path) -> PathBuf {
    app_home.join(TOKEN_FILE_NAME)
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum AuthTokenReadError {
    Missing(PathBuf),
    Empty(PathBuf),
    Invalid(PathBuf),
    Io(String),
}

impl fmt::Display for AuthTokenReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthTokenReadError::Missing(path) => {
                write!(formatter, "token file not found: {}", path.display())
            }
            AuthTokenReadError::Empty(path) => {
                write!(formatter, "token file is empty: {}", path.display())
            }
            AuthTokenReadError::Invalid(path) => {
                write!(
                    formatter,
                    "token file contains invalid token: {}",
                    path.display()
                )
            }
            AuthTokenReadError::Io(error) => write!(formatter, "{error}"),
        }
    }
}

/// 写入 token 到文件，权限设为 0600（仅所有者可读写）
pub fn write_token(app_home: &Path, token: &str) -> Result<(), String> {
    let token_path = token_file_path(app_home);

    // 确保目录存在
    if let Some(parent) = token_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create token directory: {error}"))?;
    }

    // 写入 token
    fs::write(&token_path, token)
        .map_err(|error| format!("failed to write token file: {error}"))?;

    // 设置文件权限为 0600（仅限 Unix 系统）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&token_path, permissions)
            .map_err(|error| format!("failed to set token file permissions: {error}"))?;
    }

    tracing::info!("hook server auth token written to {}", token_path.display());
    Ok(())
}

/// 从文件读取 token
pub fn read_token(app_home: &Path) -> Result<String, String> {
    read_token_inner(app_home).map_err(|error| error.to_string())
}

fn read_token_inner(app_home: &Path) -> Result<String, AuthTokenReadError> {
    let token_path = token_file_path(app_home);

    if !token_path.exists() {
        return Err(AuthTokenReadError::Missing(token_path));
    }

    let token = fs::read_to_string(&token_path)
        .map_err(|error| AuthTokenReadError::Io(format!("failed to read token file: {error}")))?;
    let token = token.trim();

    if token.is_empty() {
        return Err(AuthTokenReadError::Empty(token_path));
    }
    if !is_valid_token(token) {
        return Err(AuthTokenReadError::Invalid(token_path));
    }

    Ok(token.to_string())
}

/// 读取已有 token；不存在时生成并持久化，避免应用重启覆盖正在运行服务使用的 token。
pub fn read_or_create_token(app_home: &Path) -> Result<String, String> {
    match read_token_inner(app_home) {
        Ok(token) => Ok(token),
        Err(AuthTokenReadError::Missing(_)) | Err(AuthTokenReadError::Empty(_)) => {
            let token = generate_token();
            write_token(app_home, &token)?;
            Ok(token)
        }
        Err(error) => Err(error.to_string()),
    }
}

/// 验证 token 是否匹配
pub fn verify_token(provided: Option<&str>, expected: &str) -> bool {
    match provided {
        Some(token) => token == expected,
        None => false,
    }
}

fn is_valid_token(token: &str) -> bool {
    uuid::Uuid::parse_str(token)
        .map(|parsed| parsed.to_string() == token)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_app_home(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("cc-notice-token-{name}-{unique}"))
    }

    #[test]
    fn generate_token_returns_uuid_format() {
        let token = generate_token();

        assert_eq!(36, token.len()); // UUID v4 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        assert!(token.contains('-'));
    }

    #[test]
    fn write_and_read_token_roundtrip() {
        let app_home = temp_app_home("roundtrip");
        let token = "123e4567-e89b-12d3-a456-426614174000";

        write_token(&app_home, token).expect("write should succeed");
        let read = read_token(&app_home).expect("read should succeed");

        assert_eq!(token, read);
    }

    #[test]
    fn read_or_create_token_reuses_existing_token() {
        let app_home = temp_app_home("reuse");
        let token = "123e4567-e89b-12d3-a456-426614174000";
        write_token(&app_home, token).expect("write should succeed");

        let resolved = read_or_create_token(&app_home).expect("token should resolve");

        assert_eq!(token, resolved);
        assert_eq!(
            token,
            read_token(&app_home).expect("token should remain unchanged")
        );
    }

    #[test]
    fn read_or_create_token_creates_token_when_missing() {
        let app_home = temp_app_home("create");

        let resolved = read_or_create_token(&app_home).expect("token should be created");

        assert_eq!(36, resolved.len());
        assert_eq!(
            resolved,
            read_token(&app_home).expect("created token should be stored")
        );
    }

    #[test]
    fn read_token_rejects_invalid_token_content() {
        let app_home = temp_app_home("invalid");
        fs::create_dir_all(&app_home).expect("app home should exist");
        fs::write(token_file_path(&app_home), "not-a-token").expect("invalid token file");

        let error = read_token(&app_home).expect_err("invalid token should fail");

        assert!(error.contains("invalid token"));
    }

    #[test]
    fn read_or_create_token_does_not_overwrite_invalid_token_content() {
        let app_home = temp_app_home("invalid-no-overwrite");
        fs::create_dir_all(&app_home).expect("app home should exist");
        let path = token_file_path(&app_home);
        fs::write(&path, "not-a-token").expect("invalid token file");

        let error = read_or_create_token(&app_home).expect_err("invalid token should fail");

        assert!(error.contains("invalid token"));
        assert_eq!(
            "not-a-token",
            fs::read_to_string(path).expect("token file should remain")
        );
    }

    #[test]
    fn read_or_create_token_replaces_empty_token_file() {
        let app_home = temp_app_home("empty");
        fs::create_dir_all(&app_home).expect("app home should exist");
        fs::write(
            token_file_path(&app_home),
            " 
",
        )
        .expect("empty token file");

        let resolved = read_or_create_token(&app_home).expect("empty token should be replaced");

        assert_eq!(36, resolved.len());
        assert_eq!(
            resolved,
            read_token(&app_home).expect("new token should be readable")
        );
    }

    #[test]
    fn read_token_fails_when_file_missing() {
        let app_home = temp_app_home("missing");

        let error = read_token(&app_home).expect_err("read should fail");

        assert!(error.contains("token file not found"));
    }

    #[test]
    fn verify_token_accepts_matching_token() {
        let expected = "123e4567-e89b-12d3-a456-426614174000";

        assert!(verify_token(
            Some("123e4567-e89b-12d3-a456-426614174000"),
            expected
        ));
    }

    #[test]
    fn verify_token_rejects_mismatched_token() {
        let expected = "123e4567-e89b-12d3-a456-426614174000";

        assert!(!verify_token(Some("wrong-token"), expected));
    }

    #[test]
    fn verify_token_rejects_missing_token() {
        let expected = "123e4567-e89b-12d3-a456-426614174000";

        assert!(!verify_token(None, expected));
    }

    #[test]
    #[cfg(unix)]
    fn write_token_sets_restrictive_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let app_home = temp_app_home("permissions");
        let token = "123e4567-e89b-12d3-a456-426614174000";

        write_token(&app_home, token).expect("write should succeed");

        let token_path = token_file_path(&app_home);
        let metadata = fs::metadata(token_path).expect("metadata should be available");
        let mode = metadata.permissions().mode();

        // 0600 = 0o100600 (文件类型位 + 权限位)
        assert_eq!(0o600, mode & 0o777, "file should have 0600 permissions");
    }
}
