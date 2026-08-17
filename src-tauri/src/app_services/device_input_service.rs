use std::collections::VecDeque;

use crate::core::app_config::{DeviceInputAction, DeviceInputBinding, DeviceInputTrigger};
use crate::core::device::{DeviceInputEvent, DeviceInputEventAction};

use super::keyboard_shortcut_service::KeyboardShortcutService;

const RECENT_INPUT_EVENT_LIMIT: usize = 64;

pub struct DeviceInputService {
    bindings: Vec<DeviceInputBinding>,
    recent_keys: VecDeque<String>,
}

impl DeviceInputService {
    pub fn new(bindings: Vec<DeviceInputBinding>) -> Self {
        Self {
            bindings,
            recent_keys: VecDeque::new(),
        }
    }

    pub fn set_bindings(&mut self, bindings: Vec<DeviceInputBinding>) {
        self.bindings = bindings;
        tracing::info!("device input bindings refreshed");
    }

    pub fn handle_event(&mut self, event: DeviceInputEvent) -> Result<bool, String> {
        if self.is_duplicate(&event) {
            tracing::debug!(
                device_id = %event.device_id,
                channel_id = %event.channel_id,
                control = %event.control,
                seq = event.seq,
                "ignored duplicate device input event"
            );
            return Ok(false);
        }
        self.remember(&event);

        let Some(binding) = self.match_binding(&event) else {
            tracing::debug!(
                device_id = %event.device_id,
                channel_id = %event.channel_id,
                control = %event.control,
                "device input event has no enabled binding"
            );
            return Ok(false);
        };

        match &binding.action {
            DeviceInputAction::KeyboardShortcut { shortcut } => {
                KeyboardShortcutService::trigger(shortcut).map_err(|error| {
                    tracing::warn!(
                        binding_id = %binding.id,
                        device_id = %event.device_id,
                        channel_id = %event.channel_id,
                        "failed to trigger keyboard shortcut from device input: {error}"
                    );
                    error
                })?;
                tracing::info!(
                    binding_id = %binding.id,
                    device_id = %event.device_id,
                    channel_id = %event.channel_id,
                    "device input event triggered keyboard shortcut"
                );
                Ok(true)
            }
        }
    }

    fn match_binding(&self, event: &DeviceInputEvent) -> Option<&DeviceInputBinding> {
        self.bindings.iter().find(|binding| {
            binding.enabled
                && binding.device_id == event.device_id
                && binding.channel_id == event.channel_id
                && matches!(
                    (binding.trigger, event.action),
                    (DeviceInputTrigger::Press, DeviceInputEventAction::Press)
                )
        })
    }

    fn remember(&mut self, event: &DeviceInputEvent) {
        self.recent_keys.push_back(Self::event_key(event));
        while self.recent_keys.len() > RECENT_INPUT_EVENT_LIMIT {
            self.recent_keys.pop_front();
        }
    }

    fn is_duplicate(&self, event: &DeviceInputEvent) -> bool {
        self.recent_keys.contains(&Self::event_key(event))
    }

    fn event_key(event: &DeviceInputEvent) -> String {
        format!(
            "{}\u{1f}{}\u{1f}{:?}\u{1f}{}",
            event.device_id, event.channel_id, event.action, event.seq
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::keyboard_shortcut::KeyboardShortcut;

    fn press_event(seq: u64) -> DeviceInputEvent {
        DeviceInputEvent {
            device_id: "desk-wio".to_string(),
            channel_id: "input.button.a".to_string(),
            control: "button.a".to_string(),
            action: DeviceInputEventAction::Press,
            seq,
            received_at: "2026-07-16T00:00:00+08:00".to_string(),
        }
    }

    fn binding(enabled: bool) -> DeviceInputBinding {
        DeviceInputBinding {
            id: "desk-wio-button-a".to_string(),
            enabled,
            device_id: "desk-wio".to_string(),
            channel_id: "input.button.a".to_string(),
            trigger: DeviceInputTrigger::Press,
            action: DeviceInputAction::KeyboardShortcut {
                shortcut: KeyboardShortcut {
                    keys: vec!["Escape".to_string()],
                },
            },
        }
    }

    #[test]
    fn duplicate_input_event_is_skipped_before_action() {
        let mut service = DeviceInputService::new(Vec::new());
        let event = press_event(7);

        assert_eq!(Ok(false), service.handle_event(event.clone()));
        assert_eq!(Ok(false), service.handle_event(event));
    }

    #[test]
    fn disabled_binding_does_not_match() {
        let service = DeviceInputService::new(vec![binding(false)]);

        assert!(service.match_binding(&press_event(1)).is_none());
    }
}
