use std::io::{Read, Write};
use std::thread;
use std::time::Duration;

use crate::infrastructure::transports::transport::DeviceTransport;

const DEFAULT_SERIAL_TIMEOUT_MS: u64 = 500;
const POST_OPEN_READY_DELAY_MS: u64 = 250;

pub struct SerialDeviceTransport {
    port: Box<dyn serialport::SerialPort>,
}

impl SerialDeviceTransport {
    pub fn open(port_name: &str, baud_rate: u32) -> Result<Self, String> {
        let mut port = serialport::new(port_name, baud_rate)
            .timeout(Duration::from_millis(DEFAULT_SERIAL_TIMEOUT_MS))
            .open()
            .map_err(|error| error.to_string())?;
        prepare_open_serial_port(port.as_mut(), port_name);
        Ok(Self { port })
    }
}

fn prepare_open_serial_port(port: &mut dyn serialport::SerialPort, port_name: &str) {
    if let Err(error) = port.write_data_terminal_ready(true) {
        tracing::debug!(
            port_name,
            error = error.to_string(),
            "failed to assert serial DTR during open"
        );
    }
    if let Err(error) = port.write_request_to_send(true) {
        tracing::debug!(
            port_name,
            error = error.to_string(),
            "failed to assert serial RTS during open"
        );
    }
    thread::sleep(Duration::from_millis(POST_OPEN_READY_DELAY_MS));
    if let Err(error) = port.clear(serialport::ClearBuffer::Input) {
        tracing::debug!(
            port_name,
            error = error.to_string(),
            "failed to clear serial input buffer during open"
        );
    }
}

impl DeviceTransport for SerialDeviceTransport {
    fn send_line(&mut self, line: &str) -> Result<(), String> {
        self.port
            .write_all(line.as_bytes())
            .map_err(|error| error.to_string())?;
        self.port.flush().map_err(|error| error.to_string())
    }

    fn read_line(&mut self) -> Result<Option<String>, String> {
        let mut buffer = Vec::new();
        let mut byte = [0_u8; 1];
        loop {
            match self.port.read(&mut byte) {
                Ok(0) => return Ok(None),
                Ok(_) => {
                    if byte[0] == b'\n' {
                        break;
                    }
                    buffer.push(byte[0]);
                }
                Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {
                    if buffer.is_empty() {
                        return Ok(None);
                    }
                    break;
                }
                Err(error) => return Err(error.to_string()),
            }
        }

        Ok(Some(decode_serial_line(&buffer)))
    }
}

pub(crate) fn decode_serial_line(buffer: &[u8]) -> String {
    String::from_utf8_lossy(buffer).to_string()
}

#[cfg(test)]
mod tests {
    use super::decode_serial_line;

    #[test]
    fn decode_serial_line_replaces_invalid_utf8_noise() {
        let line = decode_serial_line(&[
            0xff, b'{', b'"', b'o', b'k', b'"', b':', b't', b'r', b'u', b'e', b'}',
        ]);

        assert!(line.starts_with('\u{fffd}'));
        assert!(line.contains(r#"{"ok":true}"#));
    }
}
