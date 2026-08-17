use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::core::device::{DeviceRuntimeState, DeviceTransportConfig};
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;
use crate::infrastructure::transports::factory::open_transport;
use crate::infrastructure::transports::serial::scanner::scan_serial_ports;

pub struct DeviceConnectionService;

impl DeviceConnectionService {
    pub fn scan_transports() -> Result<Vec<DevicePortDescriptor>, String> {
        scan_serial_ports()
    }

    pub fn connect(
        registry: &mut DeviceRuntimeRegistry,
        device_id: &str,
        transport_override: Option<DeviceTransportConfig>,
    ) -> Result<DeviceRuntimeState, String> {
        let state = registry
            .state(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))?;
        let transport_config = transport_override
            .or(state.transport)
            .ok_or_else(|| format!("device transport is not configured: {device_id}"))?;
        let transport = open_transport(&transport_config)?;

        registry.connect_with_transport_config(device_id, transport_config, transport)?;
        registry
            .state(device_id)
            .ok_or_else(|| format!("device is not registered: {device_id}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::{DeviceConnectionStatus, DeviceInstance, DeviceTransportConfig};

    #[test]
    fn connect_uses_registered_device_transport_config() {
        let mut registry =
            DeviceRuntimeRegistry::new(vec![test_device("desk-pico", "mock://desk-pico")]);

        let state = DeviceConnectionService::connect(&mut registry, "desk-pico", None)
            .expect("mock transport should connect");

        assert_eq!(DeviceConnectionStatus::Connected, state.status);
    }

    #[test]
    fn connect_can_override_registered_transport_config() {
        let mut registry =
            DeviceRuntimeRegistry::new(vec![test_device("desk-pico", "mock://desk-pico")]);

        let state = DeviceConnectionService::connect(
            &mut registry,
            "desk-pico",
            Some(DeviceTransportConfig::serial(
                "mock://selected-pico",
                115200,
            )),
        )
        .expect("selected mock transport should connect");

        assert_eq!(DeviceConnectionStatus::Connected, state.status);
        assert_eq!(
            Some("mock://selected-pico".to_string()),
            state.transport.and_then(|transport| transport.serial_port)
        );
    }

    #[test]
    fn connect_unknown_device_returns_error() {
        let mut registry = DeviceRuntimeRegistry::new(Vec::new());

        let error = DeviceConnectionService::connect(&mut registry, "missing-pico", None)
            .expect_err("unknown device should fail");

        assert_eq!("device is not registered: missing-pico", error);
    }

    fn test_device(device_id: &str, serial_port: &str) -> DeviceInstance {
        DeviceInstance {
            id: device_id.to_string(),
            label: device_id.to_string(),
            board_id: "rp2040-pico".to_string(),
            device_uid: None,
            transport: DeviceTransportConfig::serial(serial_port, 115200),
            channels: Vec::new(),
            enabled: true,
        }
    }
}
