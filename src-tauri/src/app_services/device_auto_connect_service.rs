use crate::app_services::device_connection_manager::DeviceConnectionManager;
use crate::app_services::device_connection_service::DeviceConnectionService;
use crate::app_services::device_io_worker::{DeviceIoError, DeviceIoErrorCode};
use crate::app_services::device_operation::AUTO_CONNECT_TIMEOUT_MS;
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::app_services::firmware_service::FirmwareService;
use crate::core::device::DeviceRuntimeState;
use crate::core::firmware::FirmwareArtifact;
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;
use std::collections::HashSet;

pub struct DeviceAutoConnectService;

pub struct DeviceAutoConnectAttempt {
    pub device_id: String,
    pub operation_id: u64,
    pub transport: crate::core::device::DeviceTransportConfig,
    pub firmware_artifact: Option<FirmwareArtifact>,
    pub expected_device_uid: Option<String>,
}

impl DeviceAutoConnectService {
    pub fn auto_connect_attempts(
        registry: &mut DeviceRuntimeRegistry,
        scanned: &[DevicePortDescriptor],
        firmware_service: &FirmwareService,
    ) -> Result<Vec<DeviceAutoConnectAttempt>, String> {
        let registered = registry.registered_devices();
        let suppressed_device_ids = registry
            .manual_reconnect_suppressed_device_ids()
            .into_iter()
            .chain(registry.auto_reconnect_blocked_device_ids())
            .collect::<HashSet<_>>();
        let connected_device_ids = registry.connected_device_ids();
        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            scanned,
            &suppressed_device_ids,
            &connected_device_ids,
        );
        if !plan.duplicate_device_uids.is_empty() {
            return Err(format!(
                "duplicate device uid in registered devices: {}",
                plan.duplicate_device_uids.join(", ")
            ));
        }

        let mut attempts = Vec::new();
        for attempt in plan.attempts {
            let Some(state) = registry.state(&attempt.device_id) else {
                continue;
            };
            if state.status == crate::core::device::DeviceConnectionStatus::Connected
                || state.active_operation.is_some()
            {
                continue;
            }
            let operation = registry.begin_operation(
                &attempt.device_id,
                crate::core::device::DeviceOperationKind::AutoConnect,
                AUTO_CONNECT_TIMEOUT_MS,
                true,
            )?;
            let firmware_artifact = registry
                .state(&attempt.device_id)
                .as_ref()
                .and_then(|state| bundled_firmware_artifact_for_state(firmware_service, state))
                .cloned();
            attempts.push(DeviceAutoConnectAttempt {
                device_id: attempt.device_id,
                operation_id: operation.operation_id,
                transport: attempt.transport,
                firmware_artifact,
                expected_device_uid: Some(attempt.device_uid),
            });
        }

        Ok(attempts)
    }

    pub fn auto_connect_registered_devices(
        registry: &mut DeviceRuntimeRegistry,
        scanned: &[DevicePortDescriptor],
        firmware_service: &FirmwareService,
    ) -> Result<Vec<DeviceRuntimeState>, String> {
        let registered = registry.registered_devices();
        let suppressed_device_ids = registry
            .manual_reconnect_suppressed_device_ids()
            .into_iter()
            .chain(registry.auto_reconnect_blocked_device_ids())
            .collect::<HashSet<_>>();
        let connected_device_ids = registry.connected_device_ids();
        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            scanned,
            &suppressed_device_ids,
            &connected_device_ids,
        );
        if !plan.duplicate_device_uids.is_empty() {
            return Err(format!(
                "duplicate device uid in registered devices: {}",
                plan.duplicate_device_uids.join(", ")
            ));
        }

        for attempt in plan.attempts {
            if registry
                .state(&attempt.device_id)
                .map(|state| state.status == crate::core::device::DeviceConnectionStatus::Connected)
                .unwrap_or(false)
            {
                continue;
            }
            if registry
                .state(&attempt.device_id)
                .and_then(|state| state.active_operation)
                .is_some()
            {
                tracing::debug!(
                    device_id = attempt.device_id,
                    "auto connect skipped device with active operation"
                );
                continue;
            }
            let mut connected_state = match DeviceConnectionService::connect(
                registry,
                &attempt.device_id,
                Some(attempt.transport.clone()),
            ) {
                Ok(state) => state,
                Err(error) if is_transient_transport_busy(&error) => {
                    tracing::warn!(
                        device_id = attempt.device_id,
                        error,
                        "auto connect skipped busy transport"
                    );
                    continue;
                }
                Err(error) => return Err(error),
            };
            if let Some(artifact) =
                bundled_firmware_artifact_for_state(firmware_service, &connected_state)
            {
                connected_state = registry.query_device_info(&attempt.device_id, artifact)?;
                if connected_state.device_uid.as_deref() != Some(attempt.device_uid.as_str()) {
                    registry.disconnect(&attempt.device_id);
                    return Err(format!(
                        "connected device uid mismatch for {}",
                        attempt.device_id
                    ));
                }
            }
        }

        Ok(registry.states())
    }
}

fn is_transient_transport_busy(error: &str) -> bool {
    matches!(
        DeviceIoError::transport(error).code,
        DeviceIoErrorCode::TransportBusy | DeviceIoErrorCode::TransportPermissionDenied
    )
}

fn bundled_firmware_artifact_for_state<'a>(
    firmware_service: &'a FirmwareService,
    runtime_state: &DeviceRuntimeState,
) -> Option<&'a crate::core::firmware::FirmwareArtifact> {
    let board_id = runtime_state.board_id.as_deref()?;
    firmware_service.find_by_board(board_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::DeviceOperationKind;
    use crate::core::device::{
        DeviceConnectionStatus, DeviceInstance, DeviceTransportConfig, DeviceTransportKind,
    };
    use crate::core::firmware::FirmwareManifest;

    #[test]
    fn auto_connect_uses_stable_uid_when_port_changes() {
        let mut registry = DeviceRuntimeRegistry::new(vec![DeviceInstance {
            id: "desk-pico".to_string(),
            label: "Desk Pico".to_string(),
            board_id: "unknown-board".to_string(),
            device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("mock://old-port", 115200),
            channels: Vec::new(),
            enabled: true,
        }]);
        let scanned = vec![DevicePortDescriptor {
            id: "serial:mock://new-port".to_string(),
            display_name: "Mock Pico".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "mock://new-port".to_string(),
            stable_device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            stable_device_uid_candidates: vec!["rp2040-pico:0011223344556677".to_string()],
        }];
        let firmware_service = FirmwareService::new(FirmwareManifest {
            firmware: Vec::new(),
        });

        let states = DeviceAutoConnectService::auto_connect_registered_devices(
            &mut registry,
            &scanned,
            &firmware_service,
        )
        .expect("auto connect should use scanned stable uid");

        assert_eq!(DeviceConnectionStatus::Connected, states[0].status);
        assert_eq!(
            Some("mock://new-port".to_string()),
            states[0]
                .transport
                .as_ref()
                .and_then(|transport| transport.serial_port.clone())
        );
    }

    #[test]
    fn auto_connect_attempts_start_operation_without_opening_transport_or_replacing_runtime_port() {
        let mut registry = DeviceRuntimeRegistry::new(vec![DeviceInstance {
            id: "desk-pico".to_string(),
            label: "Desk Pico".to_string(),
            board_id: "unknown-board".to_string(),
            device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("mock://old-port", 115200),
            channels: Vec::new(),
            enabled: true,
        }]);
        let scanned = vec![DevicePortDescriptor {
            id: "serial:mock://new-port".to_string(),
            display_name: "Mock Pico".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "mock://new-port".to_string(),
            stable_device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            stable_device_uid_candidates: vec!["rp2040-pico:0011223344556677".to_string()],
        }];
        let firmware_service = FirmwareService::new(FirmwareManifest {
            firmware: Vec::new(),
        });

        let attempts = DeviceAutoConnectService::auto_connect_attempts(
            &mut registry,
            &scanned,
            &firmware_service,
        )
        .expect("auto connect attempts should be planned");

        assert_eq!(1, attempts.len());
        let state = registry.state("desk-pico").expect("state should exist");
        assert_eq!(DeviceConnectionStatus::Connecting, state.status);
        assert_eq!(
            Some(DeviceOperationKind::AutoConnect),
            state.active_operation.map(|operation| operation.kind)
        );
        assert_eq!(
            Some("mock://old-port".to_string()),
            state.transport.and_then(|transport| transport.serial_port)
        );
        assert_eq!(
            Some("mock://new-port".to_string()),
            attempts[0].transport.serial_port.clone()
        );
    }

    #[test]
    fn auto_connect_skips_already_connected_registered_device() {
        let mut registry = DeviceRuntimeRegistry::new(vec![DeviceInstance {
            id: "desk-pico".to_string(),
            label: "Desk Pico".to_string(),
            board_id: "unknown-board".to_string(),
            device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("mock://old-port", 115200),
            channels: Vec::new(),
            enabled: true,
        }]);
        registry
            .connect_with_transport_config(
                "desk-pico",
                DeviceTransportConfig::serial("mock://old-port", 115200),
                Box::new(crate::infrastructure::transports::mock::MockDeviceTransport::default()),
            )
            .expect("device should connect");
        let scanned = vec![DevicePortDescriptor {
            id: "serial:mock://new-port".to_string(),
            display_name: "Mock Pico".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "mock://new-port".to_string(),
            stable_device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            stable_device_uid_candidates: vec!["rp2040-pico:0011223344556677".to_string()],
        }];
        let firmware_service = FirmwareService::new(FirmwareManifest {
            firmware: Vec::new(),
        });

        let states = DeviceAutoConnectService::auto_connect_registered_devices(
            &mut registry,
            &scanned,
            &firmware_service,
        )
        .expect("auto connect should skip connected device");

        assert_eq!(DeviceConnectionStatus::Connected, states[0].status);
        assert_eq!(
            Some("mock://old-port".to_string()),
            states[0]
                .transport
                .as_ref()
                .and_then(|transport| transport.serial_port.clone())
        );
    }

    #[test]
    fn auto_connect_skips_devices_with_active_operation_or_cancel_cooldown() {
        let mut registry = DeviceRuntimeRegistry::new(vec![DeviceInstance {
            id: "desk-pico".to_string(),
            label: "Desk Pico".to_string(),
            board_id: "unknown-board".to_string(),
            device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("mock://old-port", 115200),
            channels: Vec::new(),
            enabled: true,
        }]);
        let operation = registry
            .begin_operation(
                "desk-pico",
                DeviceOperationKind::ManualConnect,
                12_000,
                true,
            )
            .expect("operation should start");
        registry
            .cancel_operation("desk-pico", operation.operation_id)
            .expect("operation should cancel");
        let scanned = vec![DevicePortDescriptor {
            id: "serial:mock://new-port".to_string(),
            display_name: "Mock Pico".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "mock://new-port".to_string(),
            stable_device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            stable_device_uid_candidates: vec!["rp2040-pico:0011223344556677".to_string()],
        }];
        let firmware_service = FirmwareService::new(FirmwareManifest {
            firmware: Vec::new(),
        });

        let states = DeviceAutoConnectService::auto_connect_registered_devices(
            &mut registry,
            &scanned,
            &firmware_service,
        )
        .expect("auto connect should skip cooled down device");

        assert_eq!(DeviceConnectionStatus::Disconnected, states[0].status);
        assert!(states[0].auto_reconnect_blocked_until.is_some());
    }

    #[test]
    fn transient_transport_busy_errors_are_skipped_by_auto_connect() {
        assert!(is_transient_transport_busy("Device or resource busy"));
        assert!(is_transient_transport_busy("Resource busy"));
        assert!(is_transient_transport_busy("Permission denied"));
        assert!(!is_transient_transport_busy(
            "device_info response timed out"
        ));
    }
}
