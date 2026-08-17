use crate::core::device::{DeviceTransportConfig, DeviceTransportKind};
use crate::infrastructure::transports::mock::MockDeviceTransport;
use crate::infrastructure::transports::serial::transport::SerialDeviceTransport;
use crate::infrastructure::transports::transport::DeviceTransport;

pub fn open_transport(config: &DeviceTransportConfig) -> Result<Box<dyn DeviceTransport>, String> {
    match config.kind {
        DeviceTransportKind::Serial => open_serial_transport(config),
        unsupported => Err(format!("unsupported device transport: {unsupported:?}")),
    }
}

fn open_serial_transport(
    config: &DeviceTransportConfig,
) -> Result<Box<dyn DeviceTransport>, String> {
    let port = config
        .serial_port
        .as_deref()
        .ok_or_else(|| "serial transport requires serialPort".to_string())?;
    let baud_rate = config
        .baud_rate
        .ok_or_else(|| "serial transport requires baudRate".to_string())?;

    if port.starts_with("mock://") {
        return Ok(Box::new(MockDeviceTransport::default()));
    }

    SerialDeviceTransport::open(port, baud_rate)
        .map(|transport| Box::new(transport) as Box<dyn DeviceTransport>)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_serial_transport_is_only_selected_for_mock_address() {
        let config = DeviceTransportConfig::serial("mock://rp2040-pico-default", 115200);

        let mut transport = open_transport(&config).expect("mock transport should open");

        transport
            .send_line("{\"v\":2}\n")
            .expect("mock transport should send");
        assert_eq!(vec!["{\"v\":2}\n"], transport.sent_lines());
    }

    #[test]
    fn serial_transport_requires_port_and_baud_rate() {
        let mut config = DeviceTransportConfig::serial("/dev/tty.usbmodem-test", 115200);
        config.baud_rate = None;

        let error = match open_transport(&config) {
            Ok(_) => panic!("missing baud rate should fail"),
            Err(error) => error,
        };

        assert_eq!("serial transport requires baudRate", error);
    }

    #[test]
    fn unsupported_transport_kind_returns_error() {
        let config = DeviceTransportConfig {
            kind: DeviceTransportKind::Tcp,
            serial_port: None,
            baud_rate: None,
            host: Some("127.0.0.1".to_string()),
            port: Some(8080),
            path: None,
            topic: None,
        };

        let error = match open_transport(&config) {
            Ok(_) => panic!("unsupported transport should fail"),
            Err(error) => error,
        };

        assert_eq!("unsupported device transport: Tcp", error);
    }
}
