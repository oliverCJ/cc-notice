use std::collections::HashSet;

use crate::core::device::{DeviceChannel, DeviceChannelDirection};
use crate::core::profiles::HardwareOutputType;
use crate::AppState;

pub(crate) fn validate_unique_channels(channels: &[DeviceChannel]) -> Result<(), String> {
    let mut ids = HashSet::new();
    for channel in channels {
        if channel.id.trim().is_empty() {
            return Err("device channel id cannot be empty".to_string());
        }
        if !ids.insert(channel.id.as_str()) {
            return Err(format!("duplicate device channel id: {}", channel.id));
        }
    }
    Ok(())
}

pub(crate) fn validate_removed_channels_not_referenced(
    state: &AppState,
    device_id: &str,
    channels: &[DeviceChannel],
) -> Result<(), String> {
    let next_channel_ids = channels
        .iter()
        .map(|channel| channel.id.as_str())
        .collect::<HashSet<_>>();
    let config = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?
        .config();
    let removed_channel_ids = config
        .devices
        .iter()
        .find(|device| device.id == device_id)
        .map(|device| {
            device
                .channels
                .iter()
                .filter_map(|channel| {
                    (!next_channel_ids.contains(channel.id.as_str())).then_some(channel.id.as_str())
                })
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();
    if removed_channel_ids.is_empty() {
        return Ok(());
    }

    let active_profile = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?
        .active_profile();

    for rule in active_profile.hardware_rules {
        if rule.output.output_type != HardwareOutputType::DeviceChannel {
            continue;
        }
        for action in &rule.output.channel_actions {
            if action.device_id != device_id {
                continue;
            }
            if removed_channel_ids.contains(action.channel_id.as_str()) {
                return Err(format!(
                    "device channel {} is used by output rule {}",
                    action.channel_id, rule.id
                ));
            }
        }
    }

    Ok(())
}

pub(crate) fn validate_output_channels_not_switched_to_input(
    state: &AppState,
    device_id: &str,
    channels: &[DeviceChannel],
) -> Result<(), String> {
    let next_input_channel_ids = channels
        .iter()
        .filter(|channel| channel.direction == DeviceChannelDirection::Input)
        .map(|channel| channel.id.as_str())
        .collect::<HashSet<_>>();
    if next_input_channel_ids.is_empty() {
        return Ok(());
    }

    let active_profile = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?
        .active_profile();

    for rule in active_profile.hardware_rules {
        if rule.output.output_type != HardwareOutputType::DeviceChannel {
            continue;
        }
        for action in &rule.output.channel_actions {
            if action.device_id != device_id {
                continue;
            }
            if next_input_channel_ids.contains(action.channel_id.as_str()) {
                return Err(format!(
                    "device channel {} is used by output rule {}",
                    action.channel_id, rule.id
                ));
            }
        }
    }

    Ok(())
}

pub(crate) fn validate_device_not_referenced_by_active_profile(
    state: &AppState,
    device_id: &str,
) -> Result<(), String> {
    let active_profile = state
        .profile_service
        .lock()
        .map_err(|error| error.to_string())?
        .active_profile();

    for rule in active_profile.hardware_rules {
        if rule.output.output_type != HardwareOutputType::DeviceChannel {
            continue;
        }
        for action in &rule.output.channel_actions {
            if action.device_id == device_id {
                return Err(format!(
                    "device {device_id} is used by output rule {}",
                    rule.id
                ));
            }
        }
    }

    Ok(())
}
