use super::custom_face_installer::{build_full_install_commands, install_custom_face_group};
use super::device_runtime_registry::DeviceRuntimeRegistry;
use crate::core::custom_faces::{CustomFace, CustomFaceColor, CustomFaceFrame, CustomFaceGroup};
use crate::core::device::{
    ActiveLevel, DeviceChannel, DeviceConnectionStatus, DeviceCustomFaceStatusState,
    DeviceInstance, DeviceTransportConfig,
};
use crate::core::firmware::FirmwareArtifact;
use crate::infrastructure::transports::mock::MockDeviceTransport;

fn test_group() -> CustomFaceGroup {
    let mut pixels = vec![0; 320 * 240 / 8];
    for (index, value) in pixels.iter_mut().enumerate() {
        *value = (index % 251) as u8 + 1;
    }
    CustomFaceGroup {
        schema_version: 1,
        group_id: "00000000-0000-4000-8000-000000000001".to_string(),
        name: "Wio group".to_string(),
        display_profile_id: "custom-mono-320x240-v1".to_string(),
        revision: 1,
        default_face_id: "00000000-0000-4000-8000-000000000011".to_string(),
        faces: vec![CustomFace {
            face_id: "00000000-0000-4000-8000-000000000011".to_string(),
            name: "Idle".to_string(),
            color: CustomFaceColor {
                red: 255,
                green: 255,
                blue: 255,
            },
            frames: vec![CustomFaceFrame {
                duration_ms: 200,
                packed_pixels: pixels,
            }],
        }],
    }
}

#[test]
fn builds_full_install_commands_with_512_byte_base64_chunks() {
    let commands = build_full_install_commands(&test_group(), "session-1")
        .expect("install commands should be built");
    let lines = commands
        .iter()
        .map(|command| command.to_json_line().expect("command should serialize"))
        .collect::<Vec<_>>();

    assert!(lines
        .first()
        .expect("begin command")
        .contains("\"type\":\"custom_face_install_begin\""));
    assert!(lines
        .first()
        .expect("begin command")
        .contains("\"profile_code\":3"));
    assert!(lines
        .first()
        .expect("begin command")
        .contains("\"chunk_bytes\":512"));
    assert!(lines
        .first()
        .expect("begin command")
        .contains("\"group_id\":\"00000000-0000-4000-8000-000000000001\""));
    assert!(lines
        .iter()
        .any(|line| line.contains("\"type\":\"custom_face_install_chunk\"")));
    assert!(lines
        .last()
        .expect("commit command")
        .contains("\"type\":\"custom_face_install_commit\""));
    assert!(lines
        .last()
        .expect("commit command")
        .contains("\"session_id\":\"session-1\""));

    let chunk_lines = lines
        .iter()
        .filter(|line| line.contains("\"type\":\"custom_face_install_chunk\""))
        .collect::<Vec<_>>();
    assert!(chunk_lines.len() >= 2);
    assert!(chunk_lines[0].contains("\"offset\":0"));
    assert!(chunk_lines[1].contains("\"offset\":512"));
    assert!(chunk_lines[0].contains("\"data\":\""));
}

#[test]
fn installs_full_group_through_existing_worker_and_refreshes_status() {
    let group = test_group();
    let expected_commands =
        build_full_install_commands(&group, "session-1").expect("commands should build");
    let expected_lines = expected_commands
        .iter()
        .map(|command| command.to_json_line().expect("command should serialize"))
        .collect::<Vec<_>>();
    let begin: serde_json::Value =
        serde_json::from_str(expected_lines.first().expect("begin line")).unwrap();
    let group_hash = begin
        .get("group_runtime_hash")
        .and_then(serde_json::Value::as_str)
        .expect("group hash")
        .to_string();
    let encoded_bytes = begin
        .get("total_bytes")
        .and_then(serde_json::Value::as_u64)
        .expect("total bytes");
    let mut ack_lines = vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"seeed-wio-terminal","device_uid":"seeed-wio-terminal:0011223344556677","firmware_version":"0.2.1","protocol_version":2,"custom_face":{"protocol_version":1,"profile_code":3,"pixel_width":320,"pixel_height":240,"max_faces":15,"max_frames_per_face":10,"max_group_bytes":393216,"chunk_bytes":512,"incremental_update":true}}"#.to_string(),
        r#"{"ok":true,"v":2,"type":"custom_face_status","state":"empty"}"#.to_string(),
    ];
    for line in &expected_lines {
        let command: serde_json::Value = serde_json::from_str(line).unwrap();
        ack_lines.push(format!(
            r#"{{"ok":true,"v":2,"type":"{}"}}"#,
            command
                .get("type")
                .and_then(serde_json::Value::as_str)
                .unwrap()
        ));
    }
    ack_lines.push(format!(
        r#"{{"ok":true,"v":2,"type":"custom_face_status","state":"installed","profile_code":3,"group_id":"{}","group_runtime_hash":"{}","default_face_id":"{}","face_count":1,"encoded_bytes":{}}}"#,
        group.group_id, group_hash, group.default_face_id, encoded_bytes
    ));
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-wio")]);
    registry
        .connect_with_transport(
            "desk-wio",
            Box::new(MockDeviceTransport::with_received_lines(ack_lines)),
        )
        .expect("device should connect");
    let prepared = registry
        .prepare_device_info_query("desk-wio")
        .expect("device_info should prepare");
    let device_info_result = prepared.worker.query_device_info_line();
    registry
        .complete_device_info_query(
            "desk-wio",
            prepared.session_id,
            &bundled_artifact_for_board("seeed-wio-terminal", "0.2.1", 2),
            device_info_result,
        )
        .expect("device_info should complete");
    let prepared_status = registry
        .prepare_custom_face_status_query("desk-wio")
        .expect("status should prepare");
    let status_result = prepared_status
        .worker
        .send_protocol_command(prepared_status.command);
    registry
        .complete_custom_face_status_query("desk-wio", prepared_status.session_id, status_result)
        .expect("initial status should complete");

    let state = install_custom_face_group(&mut registry, "desk-wio", &group, "session-1")
        .expect("install should complete");

    assert_eq!(DeviceConnectionStatus::Connected, state.status);
    assert_eq!(
        DeviceCustomFaceStatusState::Installed,
        state.custom_face_status.state
    );
    let sent_lines = registry.sent_lines("desk-wio");
    assert_eq!(
        "{\"v\":2,\"type\":\"device_info\"}\n",
        sent_lines.first().expect("device_info line")
    );
    assert_eq!(
        "{\"v\":2,\"type\":\"custom_face_status\"}\n",
        sent_lines.get(1).expect("initial status line")
    );
    assert!(sent_lines
        .iter()
        .any(|line| line.contains("\"type\":\"custom_face_install_begin\"")));
    assert!(sent_lines
        .iter()
        .any(|line| line.contains("\"type\":\"custom_face_install_chunk\"")));
    assert!(sent_lines
        .iter()
        .any(|line| line.contains("\"type\":\"custom_face_install_commit\"")));
    assert_eq!(
        "{\"v\":2,\"type\":\"custom_face_status\"}\n",
        sent_lines.last().expect("refreshed status line")
    );
}

fn test_device(device_id: &str) -> DeviceInstance {
    DeviceInstance {
        id: device_id.to_string(),
        label: device_id.to_string(),
        board_id: "seeed-wio-terminal".to_string(),
        device_uid: None,
        transport: DeviceTransportConfig::serial("/dev/tty.usbmodem-test", 115200),
        channels: vec![DeviceChannel::digital_output(
            "pin.d0",
            "D0",
            0,
            ActiveLevel::High,
            ActiveLevel::Low,
        )],
        enabled: true,
    }
}

fn bundled_artifact_for_board(
    board_id: &str,
    firmware_version: &str,
    protocol_version: u16,
) -> FirmwareArtifact {
    FirmwareArtifact {
        target_id: None,
        board_id: board_id.to_string(),
        firmware_version: firmware_version.to_string(),
        protocol_version,
        visible: true,
        toolchain: None,
        artifact_name: format!("cc-notice-{board_id}.bin"),
        artifact_type: "bin".to_string(),
        flash_strategy: "arduino_cli_upload".to_string(),
        flash_volume_name: String::new(),
        relative_path: format!("{board_id}/cc-notice-{board_id}.bin"),
        upload: None,
    }
}
