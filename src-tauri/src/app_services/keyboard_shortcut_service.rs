use crate::core::keyboard_shortcut::{is_modifier_key, validate_shortcut, KeyboardShortcut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KeyStroke {
    Down(String),
    Press(String),
    Up(String),
}

pub struct KeyboardShortcutService;

impl KeyboardShortcutService {
    pub fn trigger(shortcut: &KeyboardShortcut) -> Result<(), String> {
        let sequence = key_sequence(shortcut)?;
        trigger_key_sequence(&sequence)
    }
}

pub fn key_sequence(shortcut: &KeyboardShortcut) -> Result<Vec<KeyStroke>, String> {
    validate_shortcut(shortcut)?;
    if shortcut.keys.len() == 1 {
        return Ok(vec![KeyStroke::Press(shortcut.keys[0].clone())]);
    }
    let modifiers = shortcut
        .keys
        .iter()
        .filter(|key| is_modifier_key(key))
        .cloned()
        .collect::<Vec<_>>();
    let primary = shortcut
        .keys
        .iter()
        .find(|key| !is_modifier_key(key))
        .expect("validated primary key")
        .clone();
    let mut sequence = Vec::new();
    for key in &modifiers {
        sequence.push(KeyStroke::Down(key.clone()));
    }
    sequence.push(KeyStroke::Press(primary));
    for key in modifiers.iter().rev() {
        sequence.push(KeyStroke::Up(key.clone()));
    }
    Ok(sequence)
}

#[cfg(not(target_os = "macos"))]
fn trigger_key_sequence(_sequence: &[KeyStroke]) -> Result<(), String> {
    Err("keyboard shortcut simulation is only supported on macOS in this version".to_string())
}

#[cfg(target_os = "macos")]
fn trigger_key_sequence(sequence: &[KeyStroke]) -> Result<(), String> {
    for stroke in sequence {
        post_key_stroke(stroke)?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn post_key_stroke(stroke: &KeyStroke) -> Result<(), String> {
    let (key, is_down, press_release) = match stroke {
        KeyStroke::Down(key) => (key.as_str(), true, false),
        KeyStroke::Up(key) => (key.as_str(), false, false),
        KeyStroke::Press(key) => (key.as_str(), true, true),
    };
    let key_code = macos_key_code(key).ok_or_else(|| format!("unsupported key: {key}"))?;
    post_macos_key_event(key_code, is_down)?;
    if press_release {
        post_macos_key_event(key_code, false)?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_key_code(key: &str) -> Option<u16> {
    match key {
        "A" | "a" => Some(0x00),
        "S" | "s" => Some(0x01),
        "D" | "d" => Some(0x02),
        "F" | "f" => Some(0x03),
        "H" | "h" => Some(0x04),
        "G" | "g" => Some(0x05),
        "Z" | "z" => Some(0x06),
        "X" | "x" => Some(0x07),
        "C" | "c" => Some(0x08),
        "V" | "v" => Some(0x09),
        "B" | "b" => Some(0x0B),
        "Q" | "q" => Some(0x0C),
        "W" | "w" => Some(0x0D),
        "E" | "e" => Some(0x0E),
        "R" | "r" => Some(0x0F),
        "Y" | "y" => Some(0x10),
        "T" | "t" => Some(0x11),
        "1" => Some(0x12),
        "2" => Some(0x13),
        "3" => Some(0x14),
        "4" => Some(0x15),
        "6" => Some(0x16),
        "5" => Some(0x17),
        "9" => Some(0x19),
        "7" => Some(0x1A),
        "8" => Some(0x1C),
        "0" => Some(0x1D),
        "O" | "o" => Some(0x1F),
        "U" | "u" => Some(0x20),
        "I" | "i" => Some(0x22),
        "P" | "p" => Some(0x23),
        "L" | "l" => Some(0x25),
        "J" | "j" => Some(0x26),
        "K" | "k" => Some(0x28),
        "N" | "n" => Some(0x2D),
        "M" | "m" => Some(0x2E),
        "Enter" => Some(0x24),
        "Tab" => Some(0x30),
        "Space" => Some(0x31),
        "Backspace" => Some(0x33),
        "Escape" => Some(0x35),
        "Command" => Some(0x37),
        "Shift" => Some(0x38),
        "Alt" => Some(0x3A),
        "Control" => Some(0x3B),
        "Win" => Some(0x37),
        "F1" => Some(0x7A),
        "F2" => Some(0x78),
        "F3" => Some(0x63),
        "F4" => Some(0x76),
        "F5" => Some(0x60),
        "F6" => Some(0x61),
        "F7" => Some(0x62),
        "F8" => Some(0x64),
        "F9" => Some(0x65),
        "F10" => Some(0x6D),
        "F11" => Some(0x67),
        "F12" => Some(0x6F),
        "Home" => Some(0x73),
        "PageUp" => Some(0x74),
        "Delete" => Some(0x75),
        "End" => Some(0x77),
        "PageDown" => Some(0x79),
        "ArrowLeft" => Some(0x7B),
        "ArrowRight" => Some(0x7C),
        "ArrowDown" => Some(0x7D),
        "ArrowUp" => Some(0x7E),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn post_macos_key_event(key_code: u16, key_down: bool) -> Result<(), String> {
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn CGEventCreateKeyboardEvent(
            source: *const std::ffi::c_void,
            virtual_key: u16,
            key_down: bool,
        ) -> *mut std::ffi::c_void;
        fn CGEventPost(tap: u32, event: *mut std::ffi::c_void);
        fn CFRelease(cf: *mut std::ffi::c_void);
    }

    const K_CG_HID_EVENT_TAP: u32 = 0;
    let event = unsafe { CGEventCreateKeyboardEvent(std::ptr::null(), key_code, key_down) };
    if event.is_null() {
        return Err("failed to create keyboard event; check Accessibility permission".to_string());
    }
    unsafe {
        CGEventPost(K_CG_HID_EVENT_TAP, event);
        CFRelease(event);
    }
    Ok(())
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

    #[test]
    fn key_sequence_presses_modifiers_then_primary_key() {
        let shortcut = KeyboardShortcut {
            keys: vec!["Control".to_string(), "Shift".to_string(), "A".to_string()],
        };

        assert_eq!(
            vec![
                KeyStroke::Down("Control".to_string()),
                KeyStroke::Down("Shift".to_string()),
                KeyStroke::Press("A".to_string()),
                KeyStroke::Up("Shift".to_string()),
                KeyStroke::Up("Control".to_string()),
            ],
            key_sequence(&shortcut).expect("sequence")
        );
    }
}
