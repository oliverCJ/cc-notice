use crate::core::device::DeviceRuntimeState;
use crate::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Instant;
use tauri::Emitter;

use crate::app_services::device_runtime_event_service::{
    DeviceRuntimeUpdatedPayload, DEVICE_RUNTIME_UPDATED_EVENT,
};

#[cfg(test)]
use super::defaults::default_rp2040_device;

static CONNECTED_DEVICES_PING_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

pub(crate) fn device_runtime_states_impl(
    state: &AppState,
) -> Result<Vec<DeviceRuntimeState>, String> {
    let registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(registry.states())
}

pub(crate) fn device_runtime_state_impl(
    state: &AppState,
    device_id: String,
) -> Result<DeviceRuntimeState, String> {
    let registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry
        .state(&device_id)
        .ok_or_else(|| format!("device is not registered: {device_id}"))
}

#[cfg(test)]
pub(crate) fn register_default_devices_impl(state: &AppState) -> Result<(), String> {
    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.register_device_if_absent(default_rp2040_device());
    Ok(())
}

pub(crate) fn disconnect_all_devices_impl(
    state: &AppState,
) -> Result<Vec<DeviceRuntimeState>, String> {
    let mut registry = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?;
    registry.disconnect_all_manually();
    Ok(registry.states())
}

pub(crate) fn ping_connected_devices_impl(
    app: &tauri::AppHandle,
    state: &AppState,
) -> Result<Vec<DeviceRuntimeState>, String> {
    let states = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .states();
    if CONNECTED_DEVICES_PING_IN_FLIGHT
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_ok()
    {
        spawn_connected_devices_ping(app.clone(), Arc::clone(&state.device_runtime_registry));
    } else {
        tracing::debug!("connected device heartbeat already scheduled; skipping duplicate request");
    }
    Ok(states)
}

fn spawn_connected_devices_ping(
    app: tauri::AppHandle,
    registry: Arc<
        std::sync::Mutex<crate::app_services::device_runtime_registry::DeviceRuntimeRegistry>,
    >,
) {
    thread::spawn(move || {
        struct PingInFlightReset;
        impl Drop for PingInFlightReset {
            fn drop(&mut self) {
                CONNECTED_DEVICES_PING_IN_FLIGHT.store(false, Ordering::Release);
            }
        }
        let _reset = PingInFlightReset;
        if let Err(error) = run_connected_devices_ping(&registry) {
            tracing::warn!(error, "connected device heartbeat failed");
        }
        if let Err(error) = app.emit(
            DEVICE_RUNTIME_UPDATED_EVENT,
            DeviceRuntimeUpdatedPayload {
                reason: "device-heartbeat".to_string(),
                device_ids: Vec::new(),
            },
        ) {
            tracing::warn!(error = %error, "failed to emit device heartbeat update");
        }
    });
}

fn run_connected_devices_ping(
    registry: &Arc<
        std::sync::Mutex<crate::app_services::device_runtime_registry::DeviceRuntimeRegistry>,
    >,
) -> Result<(), String> {
    let started = Instant::now();
    let prepared = {
        let registry = registry.lock().map_err(|error| error.to_string())?;
        registry.prepare_connected_ping_commands()
    };

    let results = prepared
        .into_iter()
        .map(|(device_id, prepared)| {
            let session_id = prepared.session_id;
            let result = prepared.worker.send_protocol_command(prepared.command);
            (device_id, session_id, result)
        })
        .collect::<Vec<_>>();

    let mut registry = registry.lock().map_err(|error| error.to_string())?;
    for (device_id, session_id, result) in results {
        if let Err(error) = registry.complete_ping_command(&device_id, session_id, result) {
            tracing::warn!(device_id, error, "failed to complete device heartbeat");
        }
    }
    let states = registry.states();
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if elapsed_ms >= 1_000 {
        tracing::warn!(
            elapsed_ms,
            state_count = states.len(),
            "connected device heartbeat was slow"
        );
    } else {
        tracing::debug!(
            elapsed_ms,
            state_count = states.len(),
            "connected device heartbeat finished"
        );
    }
    Ok(())
}
