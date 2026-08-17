use std::path::Path;

use serde_json::{json, Value};

pub(crate) fn managed_handler_with_relay(
    source: &str,
    event: &str,
    relay_path: &Path,
    debug: bool,
) -> Value {
    let debug_flag = if debug { " --debug" } else { "" };
    json!({
        "type": "command",
        "command": format!(
            "{} --source {source} --event {event}{debug_flag}",
            shell_quote_path(relay_path),
        ),
        "statusMessage": format!("CC Notice: {event}")
    })
}

pub(crate) fn is_managed_handler(source: &str, handler: &Value) -> bool {
    let command_matches = handler
        .get("command")
        .and_then(Value::as_str)
        .map(|command| {
            command_uses_managed_relay(command)
                && relay_event_from_command(command, source).is_some()
        })
        .unwrap_or(false);
    let status_matches = handler
        .get("statusMessage")
        .and_then(Value::as_str)
        .map(|status| status.starts_with("CC Notice:"))
        .unwrap_or(false);
    command_matches && status_matches
}

fn command_uses_managed_relay(command: &str) -> bool {
    shell_words(command)
        .first()
        .map(|executable| relay_executable_name(executable) == "cc-notice-relay")
        .unwrap_or(false)
}

fn relay_executable_name(executable: &str) -> String {
    let file_name = executable.rsplit(['/', '\\']).next().unwrap_or(executable);
    let normalized = file_name.to_ascii_lowercase();
    normalized
        .strip_suffix(".exe")
        .unwrap_or(&normalized)
        .to_string()
}

pub(crate) fn relay_event_from_command(command: &str, source: &str) -> Option<String> {
    let args = shell_words(command);
    let mut saw_source = false;
    let mut event = None;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--source" => {
                saw_source = args.get(index + 1).map(String::as_str) == Some(source);
                index += 2;
            }
            "--event" => {
                event = args.get(index + 1).cloned();
                index += 2;
            }
            _ => index += 1,
        }
    }
    if saw_source {
        event
    } else {
        None
    }
}

pub(crate) fn command_has_debug(command: &str) -> bool {
    shell_words(command).iter().any(|arg| arg == "--debug")
}

fn shell_quote_path(path: &Path) -> String {
    let raw = path.to_string_lossy();
    if raw
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '/' | '.' | '_' | '-'))
    {
        return raw.to_string();
    }
    format!("'{}'", raw.replace('\'', "'\\''"))
}

fn shell_words(command: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut in_single = false;
    for ch in command.chars() {
        match ch {
            '\'' => in_single = !in_single,
            ' ' | '\t' if !in_single => {
                if !current.is_empty() {
                    words.push(current.clone());
                    current.clear();
                }
            }
            _ => current.push(ch),
        }
    }
    if !current.is_empty() {
        words.push(current);
    }
    words
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn builds_managed_handler_with_absolute_relay_and_debug() {
        let handler = managed_handler_with_relay(
            "claude-code",
            "Stop",
            Path::new("/Users/alice/.cc-notice/bin/cc-notice-relay"),
            true,
        );

        assert_eq!("command", handler["type"]);
        assert_eq!(
            "/Users/alice/.cc-notice/bin/cc-notice-relay --source claude-code --event Stop --debug",
            handler["command"]
        );
        assert_eq!("CC Notice: Stop", handler["statusMessage"]);
    }

    #[test]
    fn identifies_managed_handler_only_for_same_source() {
        let handler = managed_handler_with_relay(
            "codex",
            "SessionStart",
            Path::new("cc-notice-relay"),
            false,
        );

        assert!(is_managed_handler("codex", &handler));
        assert!(!is_managed_handler("claude-code", &handler));
    }

    #[test]
    fn identifies_managed_handler_with_windows_relay_exe_path() {
        let handler = managed_handler_with_relay(
            "codex",
            "Stop",
            Path::new(r"C:\Users\alice\.cc-notice\bin\cc-notice-relay.exe"),
            false,
        );

        assert!(is_managed_handler("codex", &handler));
    }

    #[test]
    fn extracts_event_and_debug_from_command() {
        let command =
            "'/Users/alice/cc notice/cc-notice-relay' --source claude-code --event Stop --debug";

        assert_eq!(
            Some("Stop".to_string()),
            relay_event_from_command(command, "claude-code")
        );
        assert!(command_has_debug(command));
    }
}
