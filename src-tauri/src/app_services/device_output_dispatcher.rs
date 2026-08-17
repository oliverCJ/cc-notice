use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::app_services::device_runtime_service::PreparedDeviceCommand;
use crate::core::device::{
    DeviceChannelAction, DeviceCommandResult, DeviceExtensionAction, DeviceRuntimeErrorCode,
    OutputExecutionAction, OutputExecutionPlan,
};
use std::sync::{Arc, Mutex};

pub struct DeviceOutputDispatcher;

impl DeviceOutputDispatcher {
    pub fn dispatch(
        plan: &OutputExecutionPlan,
        registry: &mut DeviceRuntimeRegistry,
    ) -> Vec<DeviceCommandResult> {
        plan.actions
            .iter()
            .map(|action| match action {
                OutputExecutionAction::DeviceChannel(action) => {
                    Self::dispatch_channel_action(action, registry)
                }
                OutputExecutionAction::DeviceExtension(action) => {
                    Self::dispatch_extension_action(action, registry)
                }
            })
            .collect()
    }

    pub fn dispatch_with_shared_registry(
        plan: &OutputExecutionPlan,
        registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    ) -> Vec<DeviceCommandResult> {
        plan.actions
            .iter()
            .map(|action| match action {
                OutputExecutionAction::DeviceChannel(action) => {
                    Self::dispatch_channel_action_with_shared_registry(
                        action,
                        Arc::clone(&registry),
                    )
                }
                OutputExecutionAction::DeviceExtension(action) => {
                    Self::dispatch_extension_action_with_shared_registry(
                        action.clone(),
                        Arc::clone(&registry),
                    )
                }
            })
            .collect()
    }

    pub fn dispatch_extension_actions_with_shared_registry(
        actions: &[DeviceExtensionAction],
        registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    ) -> Vec<DeviceCommandResult> {
        actions
            .iter()
            .cloned()
            .map(|action| {
                Self::dispatch_extension_action_with_shared_registry(action, Arc::clone(&registry))
            })
            .collect()
    }

    fn dispatch_channel_action(
        action: &DeviceChannelAction,
        registry: &mut DeviceRuntimeRegistry,
    ) -> DeviceCommandResult {
        let prepared = match registry.prepare_action_command(action) {
            Ok(prepared) => prepared,
            Err(result) => return result,
        };
        let session_id = prepared.session_id;
        let result = send_prepared_command(prepared);
        registry.complete_action_command(action, session_id, result)
    }

    fn dispatch_extension_action(
        action: &DeviceExtensionAction,
        registry: &mut DeviceRuntimeRegistry,
    ) -> DeviceCommandResult {
        let prepared = match registry.prepare_extension_command(action) {
            Ok(prepared) => prepared,
            Err(result) => return result,
        };
        let session_id = prepared.session_id;
        let result = send_prepared_command(prepared);
        let (command_result, fallback) =
            registry.complete_extension_command(action, session_id, result);
        match fallback {
            Some(fallback_action) => Self::dispatch_extension_action(&fallback_action, registry),
            None => command_result,
        }
    }

    fn dispatch_channel_action_with_shared_registry(
        action: &DeviceChannelAction,
        registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    ) -> DeviceCommandResult {
        let prepared = match registry.lock() {
            Ok(mut registry) => match registry.prepare_action_command(action) {
                Ok(prepared) => prepared,
                Err(result) => return result,
            },
            Err(error) => return skipped_channel_result(action, error.to_string()),
        };
        let session_id = prepared.session_id;
        let result = send_prepared_command(prepared);
        match registry.lock() {
            Ok(mut registry) => registry.complete_action_command(action, session_id, result),
            Err(error) => skipped_channel_result(action, error.to_string()),
        }
    }

    fn dispatch_extension_action_with_shared_registry(
        action: DeviceExtensionAction,
        registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    ) -> DeviceCommandResult {
        let prepared = match registry.lock() {
            Ok(mut registry) => match registry.prepare_extension_command(&action) {
                Ok(prepared) => prepared,
                Err(result) => return result,
            },
            Err(error) => return skipped_extension_result(&action, error.to_string()),
        };
        let session_id = prepared.session_id;
        let result = send_prepared_command(prepared);
        let (command_result, fallback) = match registry.lock() {
            Ok(mut registry) => registry.complete_extension_command(&action, session_id, result),
            Err(error) => return skipped_extension_result(&action, error.to_string()),
        };
        match fallback {
            Some(fallback_action) => {
                Self::dispatch_extension_action_with_shared_registry(fallback_action, registry)
            }
            None => command_result,
        }
    }
}

fn send_prepared_command(
    prepared: PreparedDeviceCommand,
) -> Result<
    crate::app_services::device_io_worker::DeviceIoCommandResult,
    crate::app_services::device_io_worker::DeviceIoError,
> {
    prepared.worker.send_protocol_command(prepared.command)
}

fn skipped_channel_result(action: &DeviceChannelAction, error: String) -> DeviceCommandResult {
    DeviceCommandResult {
        device_id: action.device_id.clone(),
        channel_id: action.channel_id.clone(),
        output_type: crate::core::device::DeviceCommandOutputType::DeviceChannel,
        status: "skipped".to_string(),
        ack: None,
        error_code: Some(DeviceRuntimeErrorCode::DeviceRuntimeUnavailable),
        error: Some(error),
    }
}

fn skipped_extension_result(action: &DeviceExtensionAction, error: String) -> DeviceCommandResult {
    DeviceCommandResult {
        device_id: action.device_id.clone(),
        channel_id: "extension".to_string(),
        output_type: crate::core::device::DeviceCommandOutputType::DeviceControl,
        status: "skipped".to_string(),
        ack: None,
        error_code: Some(DeviceRuntimeErrorCode::DeviceRuntimeUnavailable),
        error: Some(error),
    }
}

#[cfg(test)]
#[path = "device_output_dispatcher_tests.rs"]
mod tests;
