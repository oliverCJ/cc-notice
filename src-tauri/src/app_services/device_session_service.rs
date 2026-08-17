use crate::core::device::DeviceChannelAction;
use crate::core::protocol::ProtocolCommandV2;
use crate::infrastructure::serial::SerialTransport;

pub struct DeviceSessionService<T: SerialTransport> {
    protocol_version: u16,
    transport: T,
}

impl<T: SerialTransport> DeviceSessionService<T> {
    pub fn new(protocol_version: u16, transport: T) -> Self {
        Self {
            protocol_version,
            transport,
        }
    }

    pub fn send_action(&mut self, action: &DeviceChannelAction) -> Result<(), String> {
        if self.protocol_version != 2 {
            return Err(format!(
                "unsupported device channel protocol version: {}",
                self.protocol_version
            ));
        }
        let line = ProtocolCommandV2::from_device_channel_action(action)?
            .to_json_line()
            .map_err(|error| error.to_string())?;
        tracing::info!("sending device channel action over serial");
        self.transport.send_line(&line)
    }

    pub fn read_ack(&mut self) -> Result<Option<String>, String> {
        self.transport.read_line()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::{DeviceChannelAction, DeviceChannelActionType};
    use crate::infrastructure::serial::MockSerialTransport;

    #[test]
    fn sends_device_channel_action_line_to_serial_transport() {
        let transport = MockSerialTransport::default();
        let mut service = DeviceSessionService::new(2, transport);
        let action = DeviceChannelAction {
            device_id: "desk-pico".to_string(),
            channel_id: "pin.gp2".to_string(),
            action: DeviceChannelActionType::Activate,
            duration_ms: Some(0),
            interval_ms: None,
            duty_percent: None,
            frequency_hz: None,
            color: None,
            brightness_percent: None,
            pattern: None,
            priority: 50,
        };

        service.send_action(&action).expect("send should succeed");

        assert_eq!(
            "{\"v\":2,\"type\":\"digital_write\",\"channel\":\"pin.gp2\",\"state\":\"active\",\"duration_ms\":0}\n",
            service.transport.sent_lines()[0]
        );
    }

    #[test]
    fn rejects_non_v2_device_channel_protocol() {
        let transport = MockSerialTransport::default();
        let mut service = DeviceSessionService::new(1, transport);
        let action = DeviceChannelAction {
            device_id: "desk-pico".to_string(),
            channel_id: "pin.gp2".to_string(),
            action: DeviceChannelActionType::Activate,
            duration_ms: None,
            interval_ms: None,
            duty_percent: None,
            frequency_hz: None,
            color: None,
            brightness_percent: None,
            pattern: None,
            priority: 50,
        };

        let error = service
            .send_action(&action)
            .expect_err("non-v2 protocol should fail");

        assert_eq!("unsupported device channel protocol version: 1", error);
    }

    #[test]
    fn reads_ack_from_serial_transport() {
        let transport = MockSerialTransport::with_received_lines(vec!["{\"ok\":true}".to_string()]);
        let mut service = DeviceSessionService::new(1, transport);

        let ack = service.read_ack().expect("read should succeed");

        assert_eq!(Some("{\"ok\":true}".to_string()), ack);
    }
}
