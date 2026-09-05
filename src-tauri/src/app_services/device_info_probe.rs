use crate::adapters::boards::BoardCatalogRegistry;
use crate::core::boards::StableUidPolicy;
use crate::core::device::{
    DeviceCustomFaceActiveSource, DeviceCustomFaceActiveState, DeviceFirmwareInfo,
    DeviceTransportConfig,
};
use crate::core::protocol::DeviceInfoAck;
use crate::core::protocol::ProtocolCommandV2;
use crate::infrastructure::transports::transport::DeviceTransport;

const DEVICE_INFO_MAX_ATTEMPTS: usize = 24;
const MAX_SKIPPED_LINES_PER_READ: usize = 16;

pub fn query_device_info_line(
    transport: &mut dyn DeviceTransport,
) -> Result<Option<String>, String> {
    let line = ProtocolCommandV2::device_info()
        .to_json_line()
        .map_err(|error| error.to_string())?;

    for attempt in 0..DEVICE_INFO_MAX_ATTEMPTS {
        transport.send_line(&line)?;
        if let Some(ack_line) = read_device_info_ack_line(transport)? {
            return Ok(Some(ack_line));
        }
        tracing::debug!(
            attempt = attempt + 1,
            max_attempts = DEVICE_INFO_MAX_ATTEMPTS,
            "device_info response not ready, retrying"
        );
    }

    Ok(None)
}

pub(crate) fn read_device_info_ack_line(
    transport: &mut dyn DeviceTransport,
) -> Result<Option<String>, String> {
    read_json_line_matching(transport, |line| {
        DeviceInfoAck::parse(line).map_or(false, |ack| {
            if is_ignorable_protocol_noise(ack.error.as_deref()) {
                return false;
            }
            !ack.ok || ack.ack_type.as_deref() == Some("device_info")
        })
    })
}

pub(crate) fn read_protocol_ack_line_of_type(
    transport: &mut dyn DeviceTransport,
    expected_type: &str,
) -> Result<Option<String>, String> {
    read_protocol_ack_line_for_command(transport, expected_type, None)
}

pub(crate) fn read_protocol_ack_line_for_command(
    transport: &mut dyn DeviceTransport,
    expected_type: &str,
    expected_channel: Option<&str>,
) -> Result<Option<String>, String> {
    read_protocol_ack_line_for_command_with_input_handler(
        transport,
        expected_type,
        expected_channel,
        &mut |_line| {},
    )
}

pub(crate) fn read_protocol_ack_line_for_command_with_input_handler<F>(
    transport: &mut dyn DeviceTransport,
    expected_type: &str,
    expected_channel: Option<&str>,
    input_handler: &mut F,
) -> Result<Option<String>, String>
where
    F: FnMut(&str),
{
    read_json_line_matching(transport, |line| {
        if crate::core::protocol::DeviceInputEventAck::parse(line).is_ok() {
            input_handler(line);
            tracing::debug!(
                input_event = line,
                "dispatched device input event while waiting ack"
            );
            return false;
        }
        crate::core::protocol::ProtocolAck::parse(line).map_or(false, |ack| {
            if is_ignorable_protocol_noise(ack.error.as_deref()) {
                tracing::debug!(
                    ack_line = line,
                    "ignored protocol noise while reading command ack"
                );
                return false;
            }
            if ack.ack_type.as_deref() == Some(expected_type) {
                tracing::debug!(ack_line = line, "matched protocol ack by type");
                return true;
            }
            if !ack.ok {
                tracing::debug!(ack_line = line, "matched protocol error ack");
                return true;
            }
            if expected_channel.is_some() {
                let matched = ack.channel.as_deref() == expected_channel;
                if matched {
                    tracing::debug!(ack_line = line, "matched protocol ack by channel");
                } else {
                    tracing::debug!(
                        ack_line = line,
                        expected_type,
                        expected_channel = expected_channel.unwrap_or(""),
                        "skipped unrelated protocol ack while reading command ack"
                    );
                }
                return matched;
            }
            tracing::debug!(
                ack_line = line,
                expected_type,
                "skipped unrelated protocol ack while reading command ack"
            );
            false
        })
    })
}

fn is_ignorable_protocol_noise(error: Option<&str>) -> bool {
    matches!(error, Some("empty_command"))
}

fn read_json_line_matching<F>(
    transport: &mut dyn DeviceTransport,
    mut matches: F,
) -> Result<Option<String>, String>
where
    F: FnMut(&str) -> bool,
{
    let mut skipped = 0;
    loop {
        let Some(line) = transport.read_line()? else {
            return Ok(None);
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            skipped += 1;
            tracing::debug!(
                skipped,
                max_skipped = MAX_SKIPPED_LINES_PER_READ,
                "skipped blank serial line while reading protocol ack"
            );
            if skipped >= MAX_SKIPPED_LINES_PER_READ {
                return Ok(None);
            }
            continue;
        }
        if let Some(json_start) = trimmed.find('{') {
            let candidate = &trimmed[json_start..];
            if matches(candidate) {
                return Ok(Some(candidate.to_string()));
            }
        }
        skipped += 1;
        if skipped >= MAX_SKIPPED_LINES_PER_READ {
            return Ok(None);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::DeviceCustomFaceErrorCode;
    use crate::infrastructure::transports::mock::MockDeviceTransport;

    #[test]
    fn read_device_info_ack_line_stops_after_too_many_blank_lines() {
        let mut lines = vec![String::new(); MAX_SKIPPED_LINES_PER_READ];
        lines.push(
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"seeed-wio-terminal","device_uid":"seeed-wio-terminal:0011223344556677","firmware_version":"0.2.0","protocol_version":2}"#
                .to_string(),
        );
        let mut transport = MockDeviceTransport::with_received_lines(lines);

        let ack_line =
            read_device_info_ack_line(&mut transport).expect("blank line handling should not fail");

        assert_eq!(None, ack_line);
    }

    #[test]
    fn read_protocol_ack_line_for_channel_less_command_accepts_error_ack_without_type() {
        let mut transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string(),
        ]);

        let ack_line = read_protocol_ack_line_for_command(&mut transport, "display_card", None)
            .expect("error ack should not fail");

        assert_eq!(
            Some(r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string()),
            ack_line
        );
    }

    #[test]
    fn read_protocol_ack_line_dispatches_input_event_and_continues_waiting_for_ack() {
        let mut transport = MockDeviceTransport::with_received_lines(vec![
            r#"{"v":2,"type":"input_event","control":"button.a","action":"press","seq":18}"#
                .to_string(),
            r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string(),
        ]);
        let mut events = Vec::new();

        let ack = read_protocol_ack_line_for_command_with_input_handler(
            &mut transport,
            "display_status",
            None,
            &mut |line| events.push(line.to_string()),
        )
        .expect("ack should read");

        assert_eq!(
            Some(r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string()),
            ack
        );
        assert_eq!(
            vec![
                r#"{"v":2,"type":"input_event","control":"button.a","action":"press","seq":18}"#
                    .to_string()
            ],
            events
        );
    }

    #[test]
    fn parses_valid_custom_face_capability_without_changing_base_identity() {
        let ack = DeviceInfoAck::parse(
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico-oled-091","device_uid":"rp2040-pico-oled-091:0011223344556677","firmware_version":"0.1.2","protocol_version":2,"custom_face":{"protocol_version":1,"profile_code":1,"pixel_width":128,"pixel_height":32,"max_faces":15,"max_frames_per_face":20,"max_group_bytes":131072,"chunk_bytes":512,"incremental_update":true}}"#,
        )
        .unwrap();

        let info = firmware_info_from_ack(ack, &DeviceTransportConfig::serial("/dev/test", 115200))
            .unwrap();

        assert_eq!(
            Some(1),
            info.custom_face.as_ref().map(|value| value.profile_code)
        );
        assert_eq!(None, info.custom_face_error);
        assert_eq!("rp2040-pico-oled-091:0011223344556677", info.device_uid);
    }

    #[test]
    fn invalid_custom_face_capability_keeps_base_identity_and_records_extension_error() {
        let ack = DeviceInfoAck::parse(
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico-oled-091","device_uid":"rp2040-pico-oled-091:0011223344556677","firmware_version":"0.1.2","protocol_version":2,"custom_face":{"protocol_version":1,"profile_code":1,"pixel_width":320}}"#,
        )
        .unwrap();

        let info = firmware_info_from_ack(ack, &DeviceTransportConfig::serial("/dev/test", 115200))
            .unwrap();

        assert!(info.custom_face.is_none());
        assert_eq!(
            Some(DeviceCustomFaceErrorCode::CustomFaceCapabilityInvalid),
            info.custom_face_error
        );
        assert_eq!("rp2040-pico-oled-091:0011223344556677", info.device_uid);
    }

    #[test]
    fn parses_device_info_custom_face_active_source() {
        let ack = DeviceInfoAck::parse(
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"seeed-wio-terminal","device_uid":"seeed-wio-terminal:0011223344556677","firmware_version":"0.2.1","protocol_version":2,"custom_face":{"protocol_version":1,"profile_code":3,"pixel_width":320,"pixel_height":240,"max_faces":15,"max_frames_per_face":10,"max_group_bytes":393216,"chunk_bytes":512,"incremental_update":true},"custom_face_active":{"source":"custom","group_id":"00000000-0000-4000-8000-000000000201"}}"#,
        )
        .unwrap();

        let info = firmware_info_from_ack(ack, &DeviceTransportConfig::serial("/dev/test", 115200))
            .unwrap();

        assert_eq!(
            Some(crate::core::device::DeviceCustomFaceActiveState {
                source: crate::core::device::DeviceCustomFaceActiveSource::Custom,
                group_id: Some("00000000-0000-4000-8000-000000000201".to_string()),
            }),
            info.custom_face_active
        );
    }
}

pub fn firmware_info_from_ack(
    ack: DeviceInfoAck,
    transport: &DeviceTransportConfig,
) -> Result<DeviceFirmwareInfo, String> {
    if !ack.ok {
        return Err(ack
            .error
            .unwrap_or_else(|| "device_info failed".to_string()));
    }

    if ack.ack_type.as_deref() != Some("device_info") {
        return Err("unexpected device_info response type".to_string());
    }

    let board_id = ack
        .board_id
        .ok_or_else(|| "device_info response missing board_id".to_string())?;
    let identity_policy = stable_uid_policy(&board_id);
    let device_uid = device_uid_or_limited_fallback(&board_id, ack.device_uid, transport)?;
    let protocol_version = protocol_version_or_limited_fallback(
        ack.protocol_version,
        ack.v,
        identity_policy.as_ref(),
    )?;
    let (custom_face, custom_face_error) = match ack.custom_face.as_ref() {
        Some(value) => match crate::core::custom_faces::parse_custom_face_capabilities(value) {
            Ok(capability) => (Some(capability), None),
            Err(error) => {
                tracing::warn!(
                    board_id = %board_id,
                    device_uid = %device_uid,
                    error_code = ?error,
                    "ignored invalid custom face capability from device_info"
                );
                (None, Some(error))
            }
        },
        None => (None, None),
    };
    let custom_face_active = match ack.custom_face_active.as_ref() {
        Some(value) => match parse_custom_face_active_state(value) {
            Ok(state) => Some(state),
            Err(error) => {
                tracing::warn!(
                    board_id = %board_id,
                    device_uid = %device_uid,
                    error,
                    "ignored invalid custom face active state from device_info"
                );
                None
            }
        },
        None => None,
    };
    Ok(DeviceFirmwareInfo {
        board_id,
        device_uid,
        firmware_version: ack
            .firmware_version
            .ok_or_else(|| "device_info response missing firmware_version".to_string())?,
        protocol_version,
        custom_face,
        custom_face_error,
        custom_face_active,
    })
}

fn parse_custom_face_active_state(
    value: &serde_json::Value,
) -> Result<DeviceCustomFaceActiveState, String> {
    let source = value
        .get("source")
        .and_then(|item| item.as_str())
        .ok_or_else(|| "device_info custom_face_active missing source".to_string())?;
    let source = match source {
        "builtin" => DeviceCustomFaceActiveSource::Builtin,
        "custom" => DeviceCustomFaceActiveSource::Custom,
        other => {
            return Err(format!(
                "device_info custom_face_active invalid source: {other}"
            ));
        }
    };
    let group_id = value
        .get("group_id")
        .and_then(|item| item.as_str())
        .map(str::to_string);
    match source {
        DeviceCustomFaceActiveSource::Builtin => Ok(DeviceCustomFaceActiveState {
            source,
            group_id: None,
        }),
        DeviceCustomFaceActiveSource::Custom => {
            let group_id = group_id.ok_or_else(|| {
                "device_info custom_face_active missing group_id".to_string()
            })?;
            Ok(DeviceCustomFaceActiveState {
                source,
                group_id: Some(group_id),
            })
        }
    }
}

fn device_uid_or_limited_fallback(
    board_id: &str,
    device_uid: Option<String>,
    transport: &DeviceTransportConfig,
) -> Result<String, String> {
    match device_uid {
        Some(value) if !value.trim().is_empty() => Ok(value),
        Some(_) => limited_transport_fallback_uid(board_id, transport)
            .ok_or_else(|| "device_info response empty device_uid".to_string()),
        None => limited_transport_fallback_uid(board_id, transport)
            .ok_or_else(|| "device_info response missing device_uid".to_string()),
    }
}

fn limited_transport_fallback_uid(
    board_id: &str,
    transport: &DeviceTransportConfig,
) -> Option<String> {
    if stable_uid_policy(board_id).as_ref() != Some(&StableUidPolicy::Limited) {
        return None;
    }
    let address = transport_identity_fragment(transport)?;
    Some(format!("{board_id}:serial:{address}"))
}

fn protocol_version_or_limited_fallback(
    protocol_version: Option<u16>,
    ack_version: u16,
    identity_policy: Option<&StableUidPolicy>,
) -> Result<u16, String> {
    if let Some(protocol_version) = protocol_version {
        return Ok(protocol_version);
    }
    if identity_policy == Some(&StableUidPolicy::Limited) {
        return Ok(ack_version);
    }
    Err("device_info response missing protocol_version".to_string())
}

pub(crate) fn stable_uid_policy(board_id: &str) -> Option<StableUidPolicy> {
    BoardCatalogRegistry::bundled()
        .ok()?
        .board(board_id)
        .map(|board| board.stable_uid_policy().clone())
}

fn transport_identity_fragment(transport: &DeviceTransportConfig) -> Option<String> {
    let value = match transport.kind {
        crate::core::device::DeviceTransportKind::Serial => transport.serial_port.as_deref(),
        _ => None,
    }?;
    let normalized = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    (!normalized.is_empty()).then_some(normalized)
}
