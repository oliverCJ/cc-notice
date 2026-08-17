use crate::core::device::{
    DeviceChannel, DeviceChannelAction, DeviceChannelActionType, DeviceCommandResult,
    DeviceExtensionAction, DeviceExtensionActionType, DeviceInputKind, DeviceRuntimeState,
};
use crate::AppState;
use std::sync::{Arc, Mutex};
use std::thread;

use super::reference_validation::{
    validate_output_channels_not_switched_to_input, validate_removed_channels_not_referenced,
    validate_unique_channels,
};
use super::requests::{SendDeviceExtensionActionRequest, SendDeviceTestActionRequest};

pub(crate) fn update_device_channels_impl(
    state: &AppState,
    device_id: String,
    channels: Vec<DeviceChannel>,
) -> Result<DeviceRuntimeState, String> {
    if channels.is_empty() {
        return Err("device channels cannot be empty".to_string());
    }
    validate_unique_channels(&channels)?;
    validate_removed_channels_not_referenced(state, &device_id, &channels)?;
    validate_output_channels_not_switched_to_input(state, &device_id, &channels)?;

    let mut config_service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = config_service.config();
    let device = config
        .devices
        .iter_mut()
        .find(|device| device.id == device_id)
        .ok_or_else(|| format!("device is not registered: {device_id}"))?;
    let disabled_gpio_input_channel_ids =
        disabled_gpio_input_channel_ids(&device.channels, &channels);
    let next_input_channel_ids = channels
        .iter()
        .filter(|channel| channel.input.is_some())
        .map(|channel| channel.id.as_str())
        .collect::<std::collections::HashSet<_>>();
    device.channels = channels.clone();
    config.device_input_bindings.retain(|binding| {
        binding.device_id != device_id
            || next_input_channel_ids.contains(binding.channel_id.as_str())
    });
    let next_input_bindings = config.device_input_bindings.clone();
    config_service.save_config(config)?;
    drop(config_service);

    let prepared_commands = {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.replace_device_channels(&device_id, channels)?;
        registry.prepare_gpio_input_config_commands(&device_id, &disabled_gpio_input_channel_ids)?
    };

    state
        .device_input_service
        .lock()
        .map_err(|error| error.to_string())?
        .set_bindings(next_input_bindings);

    spawn_gpio_input_config_sync(
        Arc::clone(&state.device_runtime_registry),
        device_id.clone(),
        prepared_commands,
    );

    state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .state(&device_id)
        .ok_or_else(|| format!("device is not registered: {device_id}"))
}

fn disabled_gpio_input_channel_ids(
    previous_channels: &[DeviceChannel],
    next_channels: &[DeviceChannel],
) -> Vec<String> {
    let next_gpio_input_ids = next_channels
        .iter()
        .filter(|channel| {
            channel
                .input
                .as_ref()
                .is_some_and(|input| input.input_kind == DeviceInputKind::Gpio)
        })
        .map(|channel| channel.id.as_str())
        .collect::<std::collections::HashSet<_>>();
    previous_channels
        .iter()
        .filter(|channel| {
            channel
                .input
                .as_ref()
                .is_some_and(|input| input.input_kind == DeviceInputKind::Gpio)
                && !next_gpio_input_ids.contains(channel.id.as_str())
        })
        .map(|channel| channel.id.clone())
        .collect()
}

fn spawn_gpio_input_config_sync(
    registry: Arc<Mutex<crate::app_services::device_runtime_registry::DeviceRuntimeRegistry>>,
    device_id: String,
    prepared_commands: Vec<crate::app_services::device_runtime_service::PreparedDeviceCommand>,
) {
    if prepared_commands.is_empty() {
        return;
    }
    thread::spawn(move || {
        for prepared in prepared_commands {
            let session_id = prepared.session_id;
            let result = prepared.worker.send_protocol_command(prepared.command);
            match registry.lock() {
                Ok(mut registry) => {
                    if let Err(error) =
                        registry.complete_gpio_input_config_command(&device_id, session_id, result)
                    {
                        tracing::warn!(
                            device_id,
                            error,
                            "failed to sync gpio input config after channel update"
                        );
                    }
                }
                Err(error) => {
                    tracing::warn!(
                        error = %error,
                        "failed to lock registry after gpio input config sync"
                    );
                    break;
                }
            }
        }
    });
}

pub(crate) fn send_device_test_action_impl(
    state: &AppState,
    request: SendDeviceTestActionRequest,
) -> Result<DeviceCommandResult, String> {
    if request.action == DeviceChannelActionType::Pattern {
        tracing::debug!(
            device_id = %request.device_id,
            channel_id = %request.channel_id,
            pattern = ?request.pattern,
            "routing buzzer pattern test action through extension command"
        );
        return send_device_extension_action_outside_registry_lock(
            state,
            DeviceExtensionAction {
                device_id: request.device_id,
                channel_id: Some(request.channel_id),
                action: DeviceExtensionActionType::BuzzerPattern,
                status: None,
                title: None,
                message: None,
                icon: None,
                lines: None,
                pattern: request.pattern,
                control: None,
                active: None,
            },
        );
    }

    let action = DeviceChannelAction {
        device_id: request.device_id,
        channel_id: request.channel_id,
        action: request.action,
        duration_ms: request.duration_ms,
        interval_ms: request.interval_ms,
        duty_percent: request.duty_percent,
        frequency_hz: request.frequency_hz,
        color: request.color,
        brightness_percent: request.brightness_percent,
        pattern: request.pattern,
        priority: 100,
    };
    let prepared = {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        if registry.state(&action.device_id).is_none() {
            return Err(format!("device is not registered: {}", action.device_id));
        }
        match registry.prepare_action_command(&action) {
            Ok(prepared) => prepared,
            Err(result) => return Ok(result),
        }
    };
    let session_id = prepared.session_id;
    let result = prepared.worker.send_protocol_command(prepared.command);
    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(registry.complete_action_command(&action, session_id, result))
}

pub(crate) fn send_device_extension_action_impl(
    state: &AppState,
    request: SendDeviceExtensionActionRequest,
) -> Result<DeviceCommandResult, String> {
    let action = DeviceExtensionAction {
        device_id: request.device_id,
        channel_id: None,
        action: request.action,
        status: request.status,
        title: request.title,
        message: request.message,
        icon: request.icon,
        lines: request.lines,
        pattern: request.pattern,
        control: request.control,
        active: request.active,
    };
    send_device_extension_action_outside_registry_lock(state, action)
}

fn send_device_extension_action_outside_registry_lock(
    state: &AppState,
    action: DeviceExtensionAction,
) -> Result<DeviceCommandResult, String> {
    let prepared = {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        if registry.state(&action.device_id).is_none() {
            return Err(format!("device is not registered: {}", action.device_id));
        }
        match registry.prepare_extension_command(&action) {
            Ok(prepared) => prepared,
            Err(result) => return Ok(result),
        }
    };
    let session_id = prepared.session_id;
    let result = prepared.worker.send_protocol_command(prepared.command);
    let (command_result, fallback) = {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.complete_extension_command(&action, session_id, result)
    };
    match fallback {
        Some(fallback_action) => {
            send_device_extension_action_outside_registry_lock(state, fallback_action)
        }
        None => Ok(command_result),
    }
}
