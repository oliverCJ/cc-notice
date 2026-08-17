use std::collections::HashSet;
use std::time::Instant;

use crate::core::device::DeviceTransportKind;
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;

pub fn scan_serial_ports() -> Result<Vec<DevicePortDescriptor>, String> {
    scan_serial_ports_with(|| serialport::available_ports().map_err(|error| error.to_string()))
}

fn scan_serial_ports_with<F>(available_ports: F) -> Result<Vec<DevicePortDescriptor>, String>
where
    F: FnOnce() -> Result<Vec<serialport::SerialPortInfo>, String>,
{
    let started = Instant::now();
    let ports = match available_ports() {
        Ok(ports) => ports,
        Err(error) => {
            let elapsed_ms = started.elapsed().as_millis() as u64;
            tracing::warn!(elapsed_ms, error, "serial port scan failed");
            return Err(error);
        }
    };
    let raw_port_count = ports.len();
    let descriptors = descriptors_from_serial_ports(ports);
    let elapsed_ms = started.elapsed().as_millis() as u64;
    if elapsed_ms >= 1_000 {
        tracing::warn!(
            elapsed_ms,
            raw_port_count,
            descriptor_count = descriptors.len(),
            "serial port scan was slow"
        );
    } else {
        tracing::debug!(
            elapsed_ms,
            raw_port_count,
            descriptor_count = descriptors.len(),
            "serial port scan finished"
        );
    }
    Ok(descriptors)
}

pub(crate) fn descriptors_from_serial_ports(
    ports: Vec<serialport::SerialPortInfo>,
) -> Vec<DevicePortDescriptor> {
    let preferred_cu_keys = preferred_macos_cu_keys(&ports);

    ports
        .into_iter()
        .filter(|port| !matches!(port.port_type, serialport::SerialPortType::BluetoothPort))
        .filter(|port| !is_macos_bluetooth_virtual_port(&port.port_name))
        .filter(|port| !is_macos_system_debug_console_port(&port.port_name))
        .filter(|port| !is_shadowed_macos_tty_port(&port.port_name, &preferred_cu_keys))
        .map(|port| DevicePortDescriptor {
            id: format!("serial:{}", port.port_name),
            display_name: display_name_for_port_info(&port),
            transport_kind: DeviceTransportKind::Serial,
            stable_device_uid: stable_device_uid_for_port_info(&port),
            stable_device_uid_candidates: stable_device_uid_candidates_for_port_info(&port),
            address: port.port_name,
        })
        .collect()
}

fn display_name_for_port(port_name: &str) -> String {
    port_name
        .rsplit('/')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or(port_name)
        .to_string()
}

fn display_name_for_port_info(port: &serialport::SerialPortInfo) -> String {
    let basename = display_name_for_port(&port.port_name);
    match &port.port_type {
        serialport::SerialPortType::UsbPort(info) => {
            let label = info
                .product
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .or_else(|| {
                    info.manufacturer
                        .as_deref()
                        .filter(|value| !value.trim().is_empty())
                })
                .unwrap_or("USB Serial Device");
            let usb_identity = usb_identity_for_display(info);
            format!("{label} ({basename}, {usb_identity})")
        }
        _ => basename,
    }
}

fn usb_identity_for_display(info: &serialport::UsbPortInfo) -> String {
    let mut parts = vec![format!("VID {:04X}:PID {:04X}", info.vid, info.pid)];
    if let Some(serial) = info
        .serial_number
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        parts.push(format!("SN {serial}"));
    }
    parts.join(", ")
}

fn stable_device_uid_for_port_info(port: &serialport::SerialPortInfo) -> Option<String> {
    stable_device_uid_candidates_for_port_info(port)
        .into_iter()
        .next()
}

fn stable_device_uid_candidates_for_port_info(port: &serialport::SerialPortInfo) -> Vec<String> {
    let serialport::SerialPortType::UsbPort(info) = &port.port_type else {
        return Vec::new();
    };
    if info.vid != 0x2e8a {
        return Vec::new();
    }
    let serial = info
        .serial_number
        .as_deref()
        .map(normalize_usb_serial)
        .filter(|value| !value.is_empty());
    let Some(serial) = serial else {
        return Vec::new();
    };
    rp2040_board_uid_prefixes()
        .iter()
        .map(|prefix| format!("{prefix}:{serial}"))
        .collect()
}

fn rp2040_board_uid_prefixes() -> &'static [&'static str] {
    &[
        "rp2040-pico",
        "rp2040-pico-oled-096",
        "rp2040-pico-oled-091",
    ]
}

fn normalize_usb_serial(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_hexdigit())
        .map(|ch| ch.to_ascii_lowercase())
        .collect()
}

fn preferred_macos_cu_keys(ports: &[serialport::SerialPortInfo]) -> HashSet<String> {
    ports
        .iter()
        .filter_map(|port| macos_serial_pair_key(&port.port_name, "/dev/cu."))
        .collect()
}

fn is_shadowed_macos_tty_port(port_name: &str, preferred_cu_keys: &HashSet<String>) -> bool {
    macos_serial_pair_key(port_name, "/dev/tty.")
        .map(|key| preferred_cu_keys.contains(&key))
        .unwrap_or(false)
}

fn macos_serial_pair_key(port_name: &str, prefix: &str) -> Option<String> {
    port_name
        .strip_prefix(prefix)
        .filter(|suffix| !suffix.is_empty())
        .map(str::to_string)
}

fn is_macos_bluetooth_virtual_port(port_name: &str) -> bool {
    let basename = port_name.rsplit('/').next().unwrap_or(port_name);
    basename == "cu.BLTH"
        || basename == "tty.BLTH"
        || basename.starts_with("cu.Bluetooth-")
        || basename.starts_with("tty.Bluetooth-")
}

fn is_macos_system_debug_console_port(port_name: &str) -> bool {
    let basename = port_name.rsplit('/').next().unwrap_or(port_name);
    // macOS exposes this virtual console on some machines; it is not a user device.
    basename == "cu.debug-console" || basename == "tty.debug-console"
}

#[cfg(test)]
mod tests {
    use super::*;
    use serialport::{SerialPortInfo, SerialPortType, UsbPortInfo};

    #[test]
    fn descriptors_drop_bluetooth_ports() {
        let descriptors = descriptors_from_serial_ports(vec![
            serial_port(
                "/dev/cu.Bluetooth-Incoming-Port",
                SerialPortType::BluetoothPort,
            ),
            serial_port("/dev/cu.usbmodem143101", usb_port("Raspberry Pi Pico")),
        ]);

        assert_eq!(1, descriptors.len());
        assert_eq!("/dev/cu.usbmodem143101", descriptors[0].address);
        assert_eq!(
            Some("rp2040-pico:143101".to_string()),
            descriptors[0].stable_device_uid
        );
        assert_eq!(
            vec![
                "rp2040-pico:143101".to_string(),
                "rp2040-pico-oled-096:143101".to_string(),
                "rp2040-pico-oled-091:143101".to_string()
            ],
            descriptors[0].stable_device_uid_candidates
        );
    }

    #[test]
    fn descriptors_drop_macos_bluetooth_virtual_ports_even_when_type_is_unknown() {
        let descriptors = descriptors_from_serial_ports(vec![
            serial_port("/dev/cu.BLTH", SerialPortType::Unknown),
            serial_port("/dev/tty.BLTH", SerialPortType::Unknown),
            serial_port("/dev/cu.Bluetooth-Incoming-Port", SerialPortType::Unknown),
            serial_port("/dev/cu.usbmodem143101", usb_port("Raspberry Pi Pico")),
        ]);

        assert_eq!(1, descriptors.len());
        assert_eq!("/dev/cu.usbmodem143101", descriptors[0].address);
    }

    #[test]
    fn descriptors_drop_macos_system_debug_console_ports() {
        let descriptors = descriptors_from_serial_ports(vec![
            serial_port("/dev/cu.debug-console", SerialPortType::Unknown),
            serial_port("/dev/tty.debug-console", SerialPortType::Unknown),
            serial_port("/dev/cu.usbmodem1301", usb_port("Seeed Wio Terminal")),
        ]);

        assert_eq!(1, descriptors.len());
        assert_eq!("/dev/cu.usbmodem1301", descriptors[0].address);
    }

    #[test]
    fn descriptors_prefer_cu_over_tty_for_same_macos_usbmodem() {
        let descriptors = descriptors_from_serial_ports(vec![
            serial_port("/dev/tty.usbmodem143101", usb_port("Raspberry Pi Pico")),
            serial_port("/dev/cu.usbmodem143101", usb_port("Raspberry Pi Pico")),
        ]);

        assert_eq!(1, descriptors.len());
        assert_eq!("/dev/cu.usbmodem143101", descriptors[0].address);
    }

    #[test]
    fn descriptors_use_usb_product_name_with_port_basename() {
        let descriptors = descriptors_from_serial_ports(vec![serial_port(
            "/dev/cu.usbmodem143101",
            usb_port("Raspberry Pi Pico"),
        )]);

        assert_eq!(
            "Raspberry Pi Pico (cu.usbmodem143101, VID 2E8A:PID 000A, SN 143101)",
            descriptors[0].display_name
        );
    }

    #[test]
    fn scan_serial_ports_with_returns_scanner_error() {
        let error = scan_serial_ports_with(|| Err("scan failed".to_string()))
            .expect_err("scanner error should be returned");

        assert_eq!("scan failed", error);
    }

    fn serial_port(port_name: &str, port_type: SerialPortType) -> SerialPortInfo {
        SerialPortInfo {
            port_name: port_name.to_string(),
            port_type,
        }
    }

    fn usb_port(product: &str) -> SerialPortType {
        SerialPortType::UsbPort(UsbPortInfo {
            vid: 0x2e8a,
            pid: 0x000a,
            serial_number: Some("143101".to_string()),
            manufacturer: Some("Raspberry Pi".to_string()),
            product: Some(product.to_string()),
        })
    }
}
