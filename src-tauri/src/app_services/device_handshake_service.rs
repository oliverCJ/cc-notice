use crate::core::boards::StableUidPolicy;
use crate::core::device::{
    DeviceCandidateHandshakeInfo, DeviceCandidateResource, DeviceDiscoveryStatus,
    DeviceIdentityPersistence, DeviceTransportConfig,
};
use crate::core::protocol::{DeviceInfoAck, ProtocolAck, ProtocolCommandV2};
use crate::infrastructure::transports::factory::open_transport;
use crate::infrastructure::transports::transport::DeviceTransport;

use super::device_info_probe::{
    firmware_info_from_ack, query_device_info_line, read_protocol_ack_line_of_type,
    stable_uid_policy,
};

const UID_PERSISTENCE_ACK_MAX_ATTEMPTS: usize = 8;

pub struct DeviceHandshakeService;

impl DeviceHandshakeService {
    pub fn identify_candidate(
        resource_id: &str,
        display_name: &str,
        transport: DeviceTransportConfig,
    ) -> Result<DeviceCandidateResource, String> {
        tracing::info!(
            resource_id,
            display_name,
            serial_port = transport.serial_port.as_deref().unwrap_or(""),
            "starting device candidate identification"
        );
        let device_transport = match open_transport(&transport) {
            Ok(device_transport) => device_transport,
            Err(error) => {
                tracing::warn!(
                    resource_id,
                    serial_port = transport.serial_port.as_deref().unwrap_or(""),
                    error,
                    "failed to open transport for candidate identification"
                );
                return Err(error);
            }
        };
        let result =
            Self::identify_with_transport(resource_id, display_name, transport, device_transport);
        match &result {
            Ok(candidate) => {
                tracing::info!(
                    resource_id,
                    board_id = candidate
                        .handshake_info
                        .as_ref()
                        .map(|info| info.board_id.as_str())
                        .unwrap_or(""),
                    device_uid = candidate.device_uid.as_deref().unwrap_or(""),
                    "device candidate identified"
                );
            }
            Err(error) => {
                tracing::warn!(resource_id, error, "device candidate identification failed");
            }
        }
        result
    }

    pub fn identify_with_transport(
        resource_id: &str,
        display_name: &str,
        transport: DeviceTransportConfig,
        device_transport: Box<dyn DeviceTransport>,
    ) -> Result<DeviceCandidateResource, String> {
        Self::identify_with_transport_and_uid_factory(
            resource_id,
            display_name,
            transport,
            device_transport,
            generate_device_uid,
        )
    }

    pub(crate) fn identify_with_transport_and_uid_factory<F>(
        resource_id: &str,
        display_name: &str,
        transport: DeviceTransportConfig,
        mut device_transport: Box<dyn DeviceTransport>,
        uid_factory: F,
    ) -> Result<DeviceCandidateResource, String>
    where
        F: FnOnce(&str) -> String,
    {
        tracing::debug!(
            resource_id,
            display_name,
            "querying device_info during candidate identification"
        );
        let ack_line = query_device_info_line(device_transport.as_mut())?
            .ok_or_else(|| "device_info response timed out".to_string())?;
        let mut firmware_info =
            firmware_info_from_ack(DeviceInfoAck::parse(&ack_line)?, &transport)?;
        let mut identity_persistence = DeviceIdentityPersistence::Persisted;
        if should_persist_limited_uid(&firmware_info.board_id, &firmware_info.device_uid) {
            identity_persistence = DeviceIdentityPersistence::Fallback;
            let generated_uid = uid_factory(&firmware_info.board_id);
            if try_persist_device_uid(device_transport.as_mut(), &generated_uid)? {
                let verify_line =
                    query_device_info_line(device_transport.as_mut())?.ok_or_else(|| {
                        "device_info response timed out after device uid write".to_string()
                    })?;
                let verified_info =
                    firmware_info_from_ack(DeviceInfoAck::parse(&verify_line)?, &transport)?;
                if verified_info.device_uid != generated_uid {
                    return Err(
                        "device_info response did not confirm persisted device_uid".to_string()
                    );
                }
                firmware_info = verified_info;
                identity_persistence = DeviceIdentityPersistence::Persisted;
            }
        }
        let handshake_info = DeviceCandidateHandshakeInfo {
            board_id: firmware_info.board_id,
            device_uid: firmware_info.device_uid,
            firmware_version: firmware_info.firmware_version,
            protocol_version: firmware_info.protocol_version,
            identity_persistence,
        };

        Ok(DeviceCandidateResource {
            resource_id: resource_id.to_string(),
            transport,
            display_name: display_name.to_string(),
            discovery_status: DeviceDiscoveryStatus::Identified,
            device_uid: Some(handshake_info.device_uid.clone()),
            handshake_info: Some(handshake_info),
            matched_device_id: None,
            error: None,
        })
    }
}

fn should_persist_limited_uid(board_id: &str, device_uid: &str) -> bool {
    if stable_uid_policy(board_id) != Some(StableUidPolicy::Limited) {
        return false;
    }
    device_uid == format!("{board_id}:limited")
        || device_uid.starts_with(&format!("{board_id}:serial:"))
}

fn generate_device_uid(board_id: &str) -> String {
    let uuid_hex = uuid::Uuid::new_v4().simple().to_string();
    format!("{}:{}", board_id, &uuid_hex[..16])
}

fn try_persist_device_uid(
    transport: &mut dyn DeviceTransport,
    device_uid: &str,
) -> Result<bool, String> {
    let line = ProtocolCommandV2::set_device_uid(device_uid.to_string())
        .to_json_line()
        .map_err(|error| error.to_string())?;
    transport.send_line(&line)?;
    let mut ack_line = None;
    for attempt in 0..UID_PERSISTENCE_ACK_MAX_ATTEMPTS {
        ack_line = read_protocol_ack_line_of_type(transport, "set_device_uid")?;
        if ack_line.is_some() {
            break;
        }
        tracing::debug!(
            attempt = attempt + 1,
            max_attempts = UID_PERSISTENCE_ACK_MAX_ATTEMPTS,
            "set_device_uid response not ready, retrying"
        );
    }
    let Some(ack_line) = ack_line else {
        return Ok(false);
    };
    let ack = ProtocolAck::parse(&ack_line)?;
    if ack.v != 2 {
        return Err("unsupported set_device_uid response protocol version".to_string());
    }
    if ack.ok {
        if ack.ack_type.as_deref() != Some("set_device_uid") {
            return Err("unexpected set_device_uid response type".to_string());
        }
        return Ok(true);
    }
    if ack.error.as_deref() == Some("unsupported_command") {
        return Ok(false);
    }
    Err(ack
        .error
        .unwrap_or_else(|| "set_device_uid failed".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::DeviceTransportConfig;
    use crate::infrastructure::transports::mock::MockDeviceTransport;

    #[test]
    fn identify_with_transport_returns_handshake_info() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.3","protocol_version":2}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbmodem1",
            "cu.usbmodem1",
            DeviceTransportConfig::serial("/dev/cu.usbmodem1", 115200),
            Box::new(transport),
        )
        .expect("candidate should identify");

        assert_eq!(
            "rp2040-pico:0011223344556677",
            candidate.device_uid.unwrap()
        );
        assert_eq!(
            "0.2.3",
            candidate.handshake_info.unwrap().firmware_version.as_str()
        );
    }

    #[test]
    fn identify_with_transport_retries_device_info_when_board_reboots_after_serial_open() {
        let transport = MockDeviceTransport::with_received_attempts(vec![
            None,
            None,
            Some(
                r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:limited","firmware_version":"0.2.0","protocol_version":2}"#
                    .to_string(),
            ),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbserial-test",
            "cu.usbserial-test",
            DeviceTransportConfig::serial("/dev/cu.usbserial-test", 115200),
            Box::new(transport),
        )
        .expect("candidate should identify after serial reset window");

        assert_eq!("arduino-uno:limited", candidate.device_uid.unwrap());
    }

    #[test]
    fn identify_with_transport_waits_for_samd_usb_cdc_after_flash_reset() {
        let mut attempts = vec![None; 10];
        attempts.push(Some(
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"seeed-wio-terminal","device_uid":"seeed-wio-terminal:0011223344556677","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        ));
        let transport = MockDeviceTransport::with_received_attempts(attempts);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbmodem-wio",
            "cu.usbmodem-wio",
            DeviceTransportConfig::serial("/dev/cu.usbmodem-wio", 115200),
            Box::new(transport),
        )
        .expect("SAMD USB CDC device should identify after post-flash reset window");

        assert_eq!(
            "seeed-wio-terminal:0011223344556677",
            candidate.device_uid.unwrap()
        );
    }

    #[test]
    fn identify_with_transport_accepts_empty_device_uid_for_limited_identity_board() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbserial-uno",
            "cu.usbserial-uno",
            DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200),
            Box::new(transport),
        )
        .expect("limited identity board should use transport fallback uid");

        assert_eq!(
            "arduino-uno:serial:dev-cu-usbserial-uno",
            candidate.device_uid.unwrap()
        );
    }

    #[test]
    fn identify_with_transport_rejects_empty_device_uid_for_required_identity_board() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"","firmware_version":"0.2.3","protocol_version":2}"#
                .to_string(),
        ]);

        let error = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbmodem-pico",
            "cu.usbmodem-pico",
            DeviceTransportConfig::serial("/dev/cu.usbmodem-pico", 115200),
            Box::new(transport),
        )
        .expect_err("required identity board must not use transport fallback uid");

        assert_eq!("device_info response empty device_uid", error);
    }

    #[test]
    fn identify_with_transport_uses_ack_version_when_limited_identity_board_omits_protocol_version()
    {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"","firmware_version":"0.2.0"}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbserial-uno",
            "cu.usbserial-uno",
            DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200),
            Box::new(transport),
        )
        .expect("limited identity board should infer protocol version from ack version");

        assert_eq!(2, candidate.handshake_info.unwrap().protocol_version);
    }

    #[test]
    fn identify_with_transport_persists_generated_uid_for_limited_identity_board() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:limited","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
            r#"{"ok":true,"v":2,"type":"set_device_uid"}"#.to_string(),
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:test-persistent","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport_and_uid_factory(
            "serial:/dev/cu.usbserial-uno",
            "cu.usbserial-uno",
            DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200),
            Box::new(transport),
            |_| "arduino-uno:test-persistent".to_string(),
        )
        .expect("limited identity board should persist generated uid");

        assert_eq!("arduino-uno:test-persistent", candidate.device_uid.unwrap());
    }

    #[test]
    fn identify_with_transport_waits_for_slow_limited_uid_persistence_ack() {
        let transport = MockDeviceTransport::with_received_attempts(vec![
            Some(
                r#"{"ok":true,"v":2,"type":"device_info","board_id":"stm32f103cx-blue-pill","device_uid":"stm32f103cx-blue-pill:limited","firmware_version":"0.2.0","protocol_version":2}"#
                    .to_string(),
            ),
            None,
            None,
            Some(r#"{"ok":true,"v":2,"type":"set_device_uid"}"#.to_string()),
            Some(
                r#"{"ok":true,"v":2,"type":"device_info","board_id":"stm32f103cx-blue-pill","device_uid":"stm32f103cx-blue-pill:test-persistent","firmware_version":"0.2.0","protocol_version":2}"#
                    .to_string(),
            ),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport_and_uid_factory(
            "serial:/dev/cu.usbserial-stm32",
            "cu.usbserial-stm32",
            DeviceTransportConfig::serial("/dev/cu.usbserial-stm32", 115200),
            Box::new(transport),
            |_| "stm32f103cx-blue-pill:test-persistent".to_string(),
        )
        .expect("slow STM32 flash-backed uid persistence should still identify");

        assert_eq!(
            "stm32f103cx-blue-pill:test-persistent",
            candidate.device_uid.unwrap()
        );
        assert_eq!(
            DeviceIdentityPersistence::Persisted,
            candidate.handshake_info.unwrap().identity_persistence
        );
    }

    #[test]
    fn generated_limited_uid_uses_short_random_suffix_for_tiny_avr_stability() {
        let uid = generate_device_uid("arduino-nano");
        let suffix = uid
            .strip_prefix("arduino-nano:")
            .expect("uid should use board prefix");

        assert_eq!(16, suffix.len());
        assert!(suffix.chars().all(|value| value.is_ascii_hexdigit()));
    }

    #[test]
    fn identify_with_transport_skips_stale_device_info_before_set_uid_ack() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:limited","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:limited","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
            r#"{"ok":true,"v":2,"type":"set_device_uid"}"#.to_string(),
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:test-persistent","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport_and_uid_factory(
            "serial:/dev/cu.usbserial-uno",
            "cu.usbserial-uno",
            DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200),
            Box::new(transport),
            |_| "arduino-uno:test-persistent".to_string(),
        )
        .expect("stale device_info should not be treated as set_device_uid failure");

        assert_eq!("arduino-uno:test-persistent", candidate.device_uid.unwrap());
    }

    #[test]
    fn identify_with_transport_skips_stale_set_uid_ack_before_verify_device_info() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:limited","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
            r#"{"ok":true,"v":2,"type":"set_device_uid"}"#.to_string(),
            r#"{"ok":true,"v":2,"type":"set_device_uid"}"#.to_string(),
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:test-persistent","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport_and_uid_factory(
            "serial:/dev/cu.usbserial-uno",
            "cu.usbserial-uno",
            DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200),
            Box::new(transport),
            |_| "arduino-uno:test-persistent".to_string(),
        )
        .expect("stale set_device_uid ack should not be treated as verify device_info failure");

        assert_eq!("arduino-uno:test-persistent", candidate.device_uid.unwrap());
    }

    #[test]
    fn identify_with_transport_skips_blank_lines_before_device_info_response() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            String::new(),
            "  ".to_string(),
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-nano","device_uid":"arduino-nano:persistent","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbserial-nano",
            "cu.usbserial-nano",
            DeviceTransportConfig::serial("/dev/cu.usbserial-nano", 115200),
            Box::new(transport),
        )
        .expect("blank serial lines should not be parsed as JSON");

        assert_eq!("arduino-nano:persistent", candidate.device_uid.unwrap());
    }

    #[test]
    fn identify_with_transport_skips_serial_noise_before_device_info_response() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            "empty_command\"}".to_string(),
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-nano","device_uid":"arduino-nano:persistent","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbserial-nano",
            "cu.usbserial-nano",
            DeviceTransportConfig::serial("/dev/cu.usbserial-nano", 115200),
            Box::new(transport),
        )
        .expect("non-json serial noise should not stop device identification");

        assert_eq!("arduino-nano:persistent", candidate.device_uid.unwrap());
    }

    #[test]
    fn identify_with_transport_recovers_json_after_utf8_noise_prefix() {
        let transport = MockDeviceTransport::with_received_lines(vec![format!(
            "\u{fffd}\u{fffd}{}",
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-nano","device_uid":"arduino-nano:persistent","firmware_version":"0.2.0","protocol_version":2}"#
        )]);

        let candidate = DeviceHandshakeService::identify_with_transport(
            "serial:/dev/cu.usbserial-nano",
            "cu.usbserial-nano",
            DeviceTransportConfig::serial("/dev/cu.usbserial-nano", 115200),
            Box::new(transport),
        )
        .expect("valid JSON after UTF-8 noise prefix should still identify");

        assert_eq!("arduino-nano:persistent", candidate.device_uid.unwrap());
    }

    #[test]
    fn identify_with_transport_keeps_fallback_uid_when_set_uid_ack_is_unrelated() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"arduino-uno:limited","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
            r#"{"ok":true,"v":2,"type":"pong"}"#.to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport_and_uid_factory(
            "serial:/dev/cu.usbserial-uno",
            "cu.usbserial-uno",
            DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200),
            Box::new(transport),
            |_| "arduino-uno:test-persistent".to_string(),
        )
        .expect("unrelated ack should not stop fallback identification");

        assert_eq!("arduino-uno:limited", candidate.device_uid.unwrap());
        assert_eq!(
            DeviceIdentityPersistence::Fallback,
            candidate.handshake_info.unwrap().identity_persistence
        );
    }

    #[test]
    fn identify_with_transport_keeps_fallback_uid_when_old_limited_firmware_rejects_uid_write() {
        let transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"","firmware_version":"0.2.0"}"#
                .to_string(),
            r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string(),
        ]);

        let candidate = DeviceHandshakeService::identify_with_transport_and_uid_factory(
            "serial:/dev/cu.usbserial-uno",
            "cu.usbserial-uno",
            DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200),
            Box::new(transport),
            |_| "arduino-uno:test-persistent".to_string(),
        )
        .expect("old limited identity firmware should still identify with fallback uid");

        assert_eq!(
            "arduino-uno:serial:dev-cu-usbserial-uno",
            candidate.device_uid.unwrap()
        );
    }
}
