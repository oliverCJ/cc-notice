use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    validate_external_url(&url)?;
    tracing::info!("opening external reference url");
    #[allow(deprecated)]
    app.shell()
        .open(url, None)
        .map_err(|error| format!("failed to open external url: {error}"))
}

fn validate_external_url(url: &str) -> Result<(), String> {
    let normalized = url.trim();
    if normalized.starts_with("https://") || normalized.starts_with("http://") {
        return Ok(());
    }

    Err("external url must start with http:// or https://".to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    #[test]
    fn validate_external_url_allows_http_and_https_urls() {
        assert!(validate_external_url("https://www.raspberrypi.com").is_ok());
        assert!(validate_external_url("http://localhost:1420").is_ok());
    }

    #[test]
    fn validate_external_url_rejects_non_web_urls() {
        assert!(validate_external_url("file:///tmp/test.pdf").is_err());
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("").is_err());
    }
}
