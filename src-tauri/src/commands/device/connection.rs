use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Instant;

use crate::app_services::device_auto_connect_service::DeviceAutoConnectService;
use crate::app_services::device_connection_operation::{
    spawn_connection_operation, spawn_connection_operation_without_emit,
    DeviceConnectionOperationInput,
};
use crate::app_services::device_connection_service::DeviceConnectionService;
use crate::app_services::device_operation::MANUAL_CONNECT_TIMEOUT_MS;
use crate::app_services::device_runtime_event_service::{
    DeviceRuntimeUpdatedPayload, DEVICE_RUNTIME_UPDATED_EVENT,
};
use crate::app_services::firmware_service::FirmwareService;
use crate::core::device::{DeviceOperationKind, DeviceRuntimeState};
use crate::AppState;
use tauri::AppHandle;
use tauri::Emitter;

use super::firmware_lookup::bundled_firmware_artifact_for_state;
use super::reference_validation::validate_device_not_referenced_by_active_profile;
use super::requests::ConnectDeviceRequest;

static AUTO_CONNECT_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

pub(crate) fn auto_connect_registered_devices_impl(
    app: &AppHandle,
    state: &AppState,
) -> Result<Vec<DeviceRuntimeState>, String> {
    let states = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .states();
    if AUTO_CONNECT_IN_FLIGHT
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_ok()
    {
        spawn_auto_connect_scheduler(app.clone(), Arc::clone(&state.device_runtime_registry));
    } else {
        tracing::debug!("auto connect already scheduled; skipping duplicate request");
    }
    Ok(states)
}

fn spawn_auto_connect_scheduler(
    app: AppHandle,
    registry: Arc<
        std::sync::Mutex<crate::app_services::device_runtime_registry::DeviceRuntimeRegistry>,
    >,
) {
    thread::spawn(move || {
        struct AutoConnectInFlightReset;
        impl Drop for AutoConnectInFlightReset {
            fn drop(&mut self) {
                AUTO_CONNECT_IN_FLIGHT.store(false, Ordering::Release);
            }
        }
        let _reset = AutoConnectInFlightReset;
        let started = Instant::now();
        let scanned = match DeviceConnectionService::scan_transports() {
            Ok(scanned) => scanned,
            Err(error) => {
                tracing::warn!(error, "auto connect background scan failed");
                emit_device_runtime_update(&app, Vec::new(), "auto-connect-scan-failed");
                return;
            }
        };
        let firmware_service =
            match crate::commands::firmware::firmware_manifest().map(FirmwareService::new) {
                Ok(service) => service,
                Err(error) => {
                    tracing::warn!(error, "auto connect firmware manifest load failed");
                    emit_device_runtime_update(&app, Vec::new(), "auto-connect-manifest-failed");
                    return;
                }
            };
        let attempts = {
            let mut registry = match registry.lock() {
                Ok(registry) => registry,
                Err(error) => {
                    tracing::warn!(error = %error, "auto connect registry lock failed");
                    return;
                }
            };
            match DeviceAutoConnectService::auto_connect_attempts(
                &mut registry,
                &scanned,
                &firmware_service,
            ) {
                Ok(attempts) => attempts,
                Err(error) => {
                    tracing::warn!(error, "auto connect attempt planning failed");
                    emit_device_runtime_update(&app, Vec::new(), "auto-connect-plan-failed");
                    return;
                }
            }
        };
        let attempt_device_ids = attempts
            .iter()
            .map(|attempt| attempt.device_id.clone())
            .collect::<Vec<_>>();
        let attempt_count = attempts.len();

        for attempt in attempts {
            spawn_connection_operation(
                app.clone(),
                Arc::clone(&registry),
                DeviceConnectionOperationInput {
                    device_id: attempt.device_id,
                    operation_id: attempt.operation_id,
                    deadline_ms: crate::app_services::device_operation::AUTO_CONNECT_TIMEOUT_MS,
                    transport: attempt.transport,
                    firmware_artifact: attempt.firmware_artifact,
                    expected_device_uid: attempt.expected_device_uid,
                },
            );
        }

        tracing::info!(
            elapsed_ms = started.elapsed().as_millis() as u64,
            scanned_count = scanned.len(),
            attempt_count,
            "auto connect registered devices scheduled in background"
        );
        emit_device_runtime_update(&app, attempt_device_ids, "auto-connect-scheduled");
    });
}

fn emit_device_runtime_update(app: &AppHandle, device_ids: Vec<String>, reason: &str) {
    if let Err(error) = app.emit(
        DEVICE_RUNTIME_UPDATED_EVENT,
        DeviceRuntimeUpdatedPayload {
            reason: reason.to_string(),
            device_ids,
        },
    ) {
        tracing::warn!(error = %error, "failed to emit auto connect update");
    }
}

#[cfg(test)]
pub(crate) fn connect_device_impl(
    state: &AppState,
    request: ConnectDeviceRequest,
) -> Result<DeviceRuntimeState, String> {
    start_connect_device_operation(state, request, None)
}

pub(crate) fn connect_device_with_app_impl(
    app: &AppHandle,
    state: &AppState,
    request: ConnectDeviceRequest,
) -> Result<DeviceRuntimeState, String> {
    start_connect_device_operation(state, request, Some(app))
}

fn start_connect_device_operation(
    state: &AppState,
    request: ConnectDeviceRequest,
    app: Option<&AppHandle>,
) -> Result<DeviceRuntimeState, String> {
    let (operation, transport, firmware_artifact, current_state) = {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        let current_state = registry
            .state(&request.device_id)
            .ok_or_else(|| format!("device is not registered: {}", request.device_id))?;
        if current_state.status == crate::core::device::DeviceConnectionStatus::Connected {
            return Ok(current_state);
        }
        let transport = request
            .transport
            .clone()
            .or(current_state.transport.clone())
            .ok_or_else(|| format!("device transport is not configured: {}", request.device_id))?;
        let operation = registry.begin_operation(
            &request.device_id,
            DeviceOperationKind::ManualConnect,
            MANUAL_CONNECT_TIMEOUT_MS,
            true,
        )?;
        let firmware_artifact = bundled_firmware_artifact_for_state(&current_state)?;
        let current_state = registry
            .state(&request.device_id)
            .ok_or_else(|| format!("device is not registered: {}", request.device_id))?;
        (operation, transport, firmware_artifact, current_state)
    };

    let input = DeviceConnectionOperationInput {
        device_id: request.device_id,
        operation_id: operation.operation_id,
        deadline_ms: MANUAL_CONNECT_TIMEOUT_MS,
        transport,
        firmware_artifact,
        expected_device_uid: current_state.device_uid.clone(),
    };
    match app {
        Some(app) => spawn_connection_operation(
            app.clone(),
            Arc::clone(&state.device_runtime_registry),
            input,
        ),
        None => spawn_connection_operation_without_emit(
            Arc::clone(&state.device_runtime_registry),
            input,
        ),
    }

    Ok(current_state)
}

pub(crate) fn cancel_device_operation_impl(
    state: &AppState,
    device_id: String,
    operation_id: u64,
) -> Result<DeviceRuntimeState, String> {
    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.cancel_operation(&device_id, operation_id)
}

pub(crate) fn check_device_firmware_impl(
    state: &AppState,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    let started = Instant::now();
    let (prepared, artifact) = {
        let registry = state
            .device_runtime_registry
            .lock()
            .map_err(|error| error.to_string())?;
        let current_state = registry
            .state(&device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        let artifact = bundled_firmware_artifact_for_state(&current_state)?
            .ok_or_else(|| "bundled firmware artifact not found for device board".to_string())?;
        let prepared = registry.prepare_device_info_query(&device_id)?;
        (prepared, artifact)
    };
    let session_id = prepared.session_id;
    let query_result = prepared.worker.query_device_info_line();
    let result = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .complete_device_info_query(&device_id, session_id, &artifact, query_result);
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if elapsed_ms >= 1_000 {
        tracing::warn!(device_id, elapsed_ms, "device firmware check was slow");
    } else {
        tracing::info!(device_id, elapsed_ms, "device firmware check finished");
    }
    result
}

pub(crate) fn disconnect_device_impl(
    state: &AppState,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    if registry.state(&device_id).is_none() {
        return Err(format!("device is not registered: {device_id}"));
    }
    registry.disconnect_manually(&device_id)?;
    registry
        .state(&device_id)
        .ok_or_else(|| format!("device is not registered: {device_id}"))
}

pub(crate) fn remove_registered_device_impl(
    state: &AppState,
    device_id: String,
) -> Result<Vec<DeviceRuntimeState>, String> {
    validate_device_not_referenced_by_active_profile(state, &device_id)?;

    let mut config_service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = config_service.config();
    let before_len = config.devices.len();
    config.devices.retain(|device| device.id != device_id);
    if before_len == config.devices.len() {
        return Err(format!("device is not registered: {device_id}"));
    }
    config_service.save_config(config)?;
    drop(config_service);

    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.remove_device(&device_id)?;
    Ok(registry.states())
}
