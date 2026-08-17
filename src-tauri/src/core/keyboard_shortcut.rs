use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardShortcut {
    pub keys: Vec<String>,
}

pub fn validate_shortcut(shortcut: &KeyboardShortcut) -> Result<(), String> {
    if shortcut.keys.is_empty() {
        return Err("shortcut requires at least one key".to_string());
    }
    for key in &shortcut.keys {
        if !is_known_key(key) {
            return Err(format!("unsupported key: {key}"));
        }
    }
    if shortcut.keys.len() == 1 {
        return Ok(());
    }
    let primary_count = shortcut
        .keys
        .iter()
        .filter(|key| !is_modifier_key(key))
        .count();
    let modifier_count = shortcut.keys.len() - primary_count;
    if modifier_count == 0 || primary_count != 1 {
        return Err("shortcut combo requires modifier keys and one primary key".to_string());
    }
    Ok(())
}

pub fn is_modifier_key(key: &str) -> bool {
    matches!(key, "Control" | "Alt" | "Command" | "Shift" | "Win")
}

fn is_known_key(key: &str) -> bool {
    is_modifier_key(key)
        || matches!(
            key,
            "Escape"
                | "Enter"
                | "Space"
                | "ArrowUp"
                | "ArrowDown"
                | "ArrowLeft"
                | "ArrowRight"
                | "Tab"
                | "Backspace"
                | "Delete"
                | "Home"
                | "End"
                | "PageUp"
                | "PageDown"
                | "F1"
                | "F2"
                | "F3"
                | "F4"
                | "F5"
                | "F6"
                | "F7"
                | "F8"
                | "F9"
                | "F10"
                | "F11"
                | "F12"
        )
        || is_single_ascii_alnum(key)
}

fn is_single_ascii_alnum(key: &str) -> bool {
    key.len() == 1 && key.as_bytes()[0].is_ascii_alphanumeric()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_letter_key_is_valid() {
        let shortcut = KeyboardShortcut {
            keys: vec!["A".to_string()],
        };

        assert_eq!(Ok(()), validate_shortcut(&shortcut));
    }

    #[test]
    fn modifier_combo_is_valid() {
        let shortcut = KeyboardShortcut {
            keys: vec!["Command".to_string(), "Enter".to_string()],
        };

        assert_eq!(Ok(()), validate_shortcut(&shortcut));
    }

    #[test]
    fn non_modifier_combo_is_rejected() {
        let shortcut = KeyboardShortcut {
            keys: vec!["A".to_string(), "B".to_string()],
        };

        assert_eq!(
            Err("shortcut combo requires modifier keys and one primary key".to_string()),
            validate_shortcut(&shortcut)
        );
    }
}
