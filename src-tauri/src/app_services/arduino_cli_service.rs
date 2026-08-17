use std::path::PathBuf;
use std::process::{Command, Output};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArduinoCliStatus {
    pub configured_path: Option<String>,
    pub resolved_path: String,
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArduinoCliService {
    configured_path: Option<String>,
}

impl ArduinoCliService {
    pub fn new(configured_path: Option<String>) -> Self {
        Self {
            configured_path: configured_path
                .map(|path| path.trim().to_string())
                .filter(|path| !path.is_empty()),
        }
    }

    pub fn command_path(&self) -> PathBuf {
        self.configured_path
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("arduino-cli"))
    }

    pub fn status(&self) -> ArduinoCliStatus {
        let command_path = self.command_path();
        let resolved_path = command_path.to_string_lossy().to_string();
        let output = run_arduino_cli_version_command(&command_path);

        match output {
            Ok(output) if output.status.success() => ArduinoCliStatus {
                configured_path: self.configured_path.clone(),
                resolved_path,
                available: true,
                version: Some(parse_version_output(&output.stdout, &output.stderr)),
                error: None,
            },
            Ok(output) => ArduinoCliStatus {
                configured_path: self.configured_path.clone(),
                resolved_path,
                available: false,
                version: None,
                error: Some(short_process_error(
                    &output.stderr,
                    "arduino_cli_exit_failed",
                )),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => ArduinoCliStatus {
                configured_path: self.configured_path.clone(),
                resolved_path,
                available: false,
                version: None,
                error: Some("arduino_cli_not_found".to_string()),
            },
            Err(error) => ArduinoCliStatus {
                configured_path: self.configured_path.clone(),
                resolved_path,
                available: false,
                version: None,
                error: Some(format!("arduino_cli_unavailable: {error}")),
            },
        }
    }

    #[cfg(test)]
    pub fn command_path_for_test(&self) -> String {
        self.command_path().to_string_lossy().to_string()
    }

    #[cfg(test)]
    pub fn command_name_for_test(&self) -> String {
        self.command_path().to_string_lossy().to_string()
    }
}

fn run_arduino_cli_version_command(command_path: &std::path::Path) -> std::io::Result<Output> {
    let mut command = Command::new(command_path);
    command.arg("version");
    configure_arduino_cli_command(&mut command);
    command.output()
}

#[cfg(target_os = "windows")]
fn configure_arduino_cli_command(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn configure_arduino_cli_command(_command: &mut Command) {}

fn parse_version_output(stdout: &[u8], stderr: &[u8]) -> String {
    let stdout_text = String::from_utf8_lossy(stdout).trim().to_string();
    if !stdout_text.is_empty() {
        return stdout_text;
    }
    String::from_utf8_lossy(stderr).trim().to_string()
}

fn short_process_error(stderr: &[u8], fallback: &str) -> String {
    let stderr_text = String::from_utf8_lossy(stderr).trim().to_string();
    if stderr_text.is_empty() {
        return fallback.to_string();
    }
    stderr_text.lines().next().unwrap_or(fallback).to_string()
}

#[cfg(test)]
mod tests {
    use super::ArduinoCliService;

    #[test]
    fn locator_prefers_configured_path_when_present() {
        let service = ArduinoCliService::new(Some("/custom/bin/arduino-cli".into()));

        assert_eq!(service.command_path_for_test(), "/custom/bin/arduino-cli");
    }

    #[test]
    fn locator_uses_path_lookup_when_config_is_empty() {
        let service = ArduinoCliService::new(None);

        assert_eq!(service.command_name_for_test(), "arduino-cli");
    }
}
