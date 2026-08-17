use crate::app_services::device_connection_service::DeviceConnectionService;
use crate::core::device::{
    DeviceCandidateResource, DeviceConnectionStatus, DeviceDiscoveryStatus, DeviceInstance,
    DeviceRuntimeState, DeviceTransportConfig, DeviceTransportKind,
};
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;

pub struct DeviceDiscoveryService;

impl DeviceDiscoveryService {
    pub fn scan_manual() -> Result<Vec<DeviceCandidateResource>, String> {
        DeviceConnectionService::scan_transports().map(Self::candidates_from_ports)
    }

    pub fn candidates_from_ports(ports: Vec<DevicePortDescriptor>) -> Vec<DeviceCandidateResource> {
        ports.into_iter().map(candidate_from_port).collect()
    }

    pub fn candidates_from_ports_with_registered_devices(
        ports: Vec<DevicePortDescriptor>,
        registered: &[DeviceInstance],
    ) -> Vec<DeviceCandidateResource> {
        ports
            .into_iter()
            .map(|port| candidate_from_port_with_registered_devices(port, registered))
            .collect()
    }

    pub fn candidates_from_ports_with_registered_and_runtime_states(
        ports: Vec<DevicePortDescriptor>,
        registered: &[DeviceInstance],
        states: &[DeviceRuntimeState],
    ) -> Vec<DeviceCandidateResource> {
        ports
            .into_iter()
            .map(|port| {
                candidate_from_port_with_registered_and_runtime_states(port, registered, states)
            })
            .collect()
    }
}

fn candidate_from_port_with_registered_and_runtime_states(
    port: DevicePortDescriptor,
    registered: &[DeviceInstance],
    states: &[DeviceRuntimeState],
) -> DeviceCandidateResource {
    let candidate = candidate_from_port_with_registered_devices(port.clone(), registered);
    if candidate.matched_device_id.is_some() {
        return candidate;
    }

    let Some(device) = connected_state_for_port(&port, states) else {
        return candidate;
    };

    let mut matched = candidate;
    matched.discovery_status = DeviceDiscoveryStatus::Matched;
    matched.device_uid = device.device_uid.clone();
    matched.matched_device_id = device.device_id.clone();
    matched
}

fn candidate_from_port_with_registered_devices(
    port: DevicePortDescriptor,
    registered: &[DeviceInstance],
) -> DeviceCandidateResource {
    let mut candidate = candidate_from_port(port.clone());
    let matched_device = registered.iter().find(|device| {
        device
            .device_uid
            .as_deref()
            .map(|uid| port_matches_device_uid(&port, uid))
            .unwrap_or(false)
    });

    if let Some(device) = matched_device {
        candidate.discovery_status = DeviceDiscoveryStatus::Matched;
        candidate.device_uid = device.device_uid.clone().or(port.stable_device_uid);
        candidate.matched_device_id = Some(device.id.clone());
    }

    candidate
}

fn port_matches_device_uid(port: &DevicePortDescriptor, device_uid: &str) -> bool {
    port.stable_device_uid.as_deref() == Some(device_uid)
        || port
            .stable_device_uid_candidates
            .iter()
            .any(|uid| uid == device_uid)
}

fn candidate_from_port(port: DevicePortDescriptor) -> DeviceCandidateResource {
    let transport = transport_from_port(&port);
    DeviceCandidateResource {
        resource_id: port.id,
        transport,
        display_name: port.display_name,
        discovery_status: DeviceDiscoveryStatus::Unidentified,
        handshake_info: None,
        device_uid: None,
        matched_device_id: None,
        error: None,
    }
}

fn transport_from_port(port: &DevicePortDescriptor) -> DeviceTransportConfig {
    match port.transport_kind {
        DeviceTransportKind::Serial => DeviceTransportConfig::serial(&port.address, 115200),
        kind => DeviceTransportConfig {
            kind,
            serial_port: None,
            baud_rate: None,
            host: None,
            port: None,
            path: None,
            topic: None,
        },
    }
}

fn connected_state_for_port<'a>(
    port: &DevicePortDescriptor,
    states: &'a [DeviceRuntimeState],
) -> Option<&'a DeviceRuntimeState> {
    states.iter().find(|state| {
        state.status == DeviceConnectionStatus::Connected
            && state
                .transport
                .as_ref()
                .and_then(|transport| transport.serial_port.as_deref())
                == Some(port.address.as_str())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::{DeviceDiscoveryStatus, DeviceTransportKind};
    use crate::infrastructure::transports::descriptor::DevicePortDescriptor;

    #[test]
    fn manual_scan_returns_candidates_without_handshake() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem1".to_string(),
            display_name: "cu.usbmodem1".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem1".to_string(),
            stable_device_uid: None,
            stable_device_uid_candidates: Vec::new(),
        }];

        let candidates = DeviceDiscoveryService::candidates_from_ports(ports);

        assert_eq!(1, candidates.len());
        assert_eq!(
            DeviceDiscoveryStatus::Unidentified,
            candidates[0].discovery_status
        );
        assert!(candidates[0].handshake_info.is_none());
        assert_eq!(
            Some("/dev/cu.usbmodem1".to_string()),
            candidates[0].transport.serial_port
        );
    }

    #[test]
    fn candidates_mark_registered_devices_as_matched_by_stable_uid() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem2".to_string(),
            display_name: "cu.usbmodem2".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem2".to_string(),
            stable_device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            stable_device_uid_candidates: vec!["rp2040-pico:0011223344556677".to_string()],
        }];
        let registered = vec![DeviceInstance {
            id: "desk-pico".to_string(),
            label: "Desk Pico".to_string(),
            board_id: "rp2040-pico".to_string(),
            device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-old", 115200),
            channels: Vec::new(),
            enabled: true,
        }];

        let candidates = DeviceDiscoveryService::candidates_from_ports_with_registered_devices(
            ports,
            &registered,
        );

        assert_eq!(
            DeviceDiscoveryStatus::Matched,
            candidates[0].discovery_status
        );
        assert_eq!(
            Some("desk-pico".to_string()),
            candidates[0].matched_device_id
        );
        assert_eq!(
            Some("rp2040-pico:0011223344556677".to_string()),
            candidates[0].device_uid
        );
    }

    #[test]
    fn candidates_match_stable_uid_before_saved_address_when_port_changes() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem-new".to_string(),
            display_name: "Pico New".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem-new".to_string(),
            stable_device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            stable_device_uid_candidates: vec!["rp2040-pico:0011223344556677".to_string()],
        }];
        let registered = vec![
            DeviceInstance {
                id: "desk-pico".to_string(),
                label: "Desk Pico".to_string(),
                board_id: "rp2040-pico".to_string(),
                device_uid: Some("rp2040-pico:0011223344556677".to_string()),
                transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-old", 115200),
                channels: Vec::new(),
                enabled: true,
            },
            DeviceInstance {
                id: "other-pico".to_string(),
                label: "Other Pico".to_string(),
                board_id: "rp2040-pico".to_string(),
                device_uid: Some("rp2040-pico:other".to_string()),
                transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-new", 115200),
                channels: Vec::new(),
                enabled: true,
            },
        ];

        let candidates = DeviceDiscoveryService::candidates_from_ports_with_registered_devices(
            ports,
            &registered,
        );

        assert_eq!(
            Some("desk-pico".to_string()),
            candidates[0].matched_device_id
        );
        assert_eq!(
            Some("/dev/cu.usbmodem-new".to_string()),
            candidates[0].transport.serial_port
        );
    }

    #[test]
    fn candidates_do_not_match_by_address_when_scanned_uid_differs() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem2".to_string(),
            display_name: "cu.usbmodem2".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem2".to_string(),
            stable_device_uid: Some("rp2040-pico:new-device".to_string()),
            stable_device_uid_candidates: vec!["rp2040-pico:new-device".to_string()],
        }];
        let registered = vec![DeviceInstance {
            id: "old-pico".to_string(),
            label: "Old Pico".to_string(),
            board_id: "rp2040-pico".to_string(),
            device_uid: Some("rp2040-pico:old-device".to_string()),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem2", 115200),
            channels: Vec::new(),
            enabled: true,
        }];

        let candidates = DeviceDiscoveryService::candidates_from_ports_with_registered_devices(
            ports,
            &registered,
        );

        assert_eq!(
            DeviceDiscoveryStatus::Unidentified,
            candidates[0].discovery_status
        );
        assert_eq!(None, candidates[0].matched_device_id);
    }

    #[test]
    fn candidates_do_not_match_saved_address_without_stable_uid() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem-saved".to_string(),
            display_name: "Saved Address".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem-saved".to_string(),
            stable_device_uid: None,
            stable_device_uid_candidates: Vec::new(),
        }];
        let registered = vec![DeviceInstance {
            id: "desk-pico".to_string(),
            label: "Desk Pico".to_string(),
            board_id: "rp2040-pico".to_string(),
            device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-saved", 115200),
            channels: Vec::new(),
            enabled: true,
        }];

        let candidates = DeviceDiscoveryService::candidates_from_ports_with_registered_devices(
            ports,
            &registered,
        );

        assert_eq!(
            DeviceDiscoveryStatus::Unidentified,
            candidates[0].discovery_status
        );
        assert_eq!(None, candidates[0].matched_device_id);
        assert_eq!(None, candidates[0].device_uid);
    }

    #[test]
    fn candidates_do_not_probe_or_match_registered_wio_without_stable_uid() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem-new".to_string(),
            display_name: "Wio Terminal".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem-new".to_string(),
            stable_device_uid: None,
            stable_device_uid_candidates: Vec::new(),
        }];
        let registered = vec![DeviceInstance {
            id: "desk-wio".to_string(),
            label: "Desk Wio".to_string(),
            board_id: "seeed-wio-terminal".to_string(),
            device_uid: Some("seeed-wio-terminal:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-old", 115200),
            channels: Vec::new(),
            enabled: true,
        }];

        let candidates = DeviceDiscoveryService::candidates_from_ports_with_registered_devices(
            ports,
            &registered,
        );

        assert_eq!(
            DeviceDiscoveryStatus::Unidentified,
            candidates[0].discovery_status
        );
        assert_eq!(None, candidates[0].matched_device_id);
        assert_eq!(None, candidates[0].device_uid);
        assert_eq!(
            Some("/dev/cu.usbmodem-new".to_string()),
            candidates[0].transport.serial_port
        );
    }

    #[test]
    fn candidates_mark_connected_runtime_port_as_matched_without_stable_uid() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem1301".to_string(),
            display_name: "Seeed Wio Terminal".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem1301".to_string(),
            stable_device_uid: None,
            stable_device_uid_candidates: Vec::new(),
        }];
        let registered = vec![DeviceInstance {
            id: "desk-wio".to_string(),
            label: "Desk Wio".to_string(),
            board_id: "seeed-wio-terminal".to_string(),
            device_uid: Some("seeed-wio-terminal:090645eb5336464e".to_string()),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-old", 115200),
            channels: Vec::new(),
            enabled: true,
        }];
        let mut connected_state = DeviceRuntimeState::disconnected();
        connected_state.device_id = Some("desk-wio".to_string());
        connected_state.device_uid = Some("seeed-wio-terminal:090645eb5336464e".to_string());
        connected_state.status = DeviceConnectionStatus::Connected;
        connected_state.transport = Some(DeviceTransportConfig::serial(
            "/dev/cu.usbmodem1301",
            115200,
        ));

        let candidates =
            DeviceDiscoveryService::candidates_from_ports_with_registered_and_runtime_states(
                ports,
                &registered,
                &[connected_state],
            );

        assert_eq!(
            DeviceDiscoveryStatus::Matched,
            candidates[0].discovery_status
        );
        assert_eq!(
            Some("desk-wio".to_string()),
            candidates[0].matched_device_id
        );
        assert_eq!(
            Some("seeed-wio-terminal:090645eb5336464e".to_string()),
            candidates[0].device_uid
        );
    }

    #[test]
    fn candidates_match_registered_pico_variant_by_stable_uid_candidate() {
        let ports = vec![DevicePortDescriptor {
            id: "serial:/dev/cu.usbmodem-oled".to_string(),
            display_name: "Raspberry Pi Pico".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "/dev/cu.usbmodem-oled".to_string(),
            stable_device_uid: Some("rp2040-pico:0011223344556677".to_string()),
            stable_device_uid_candidates: vec![
                "rp2040-pico:0011223344556677".to_string(),
                "rp2040-pico-oled-091:0011223344556677".to_string(),
            ],
        }];
        let registered = vec![DeviceInstance {
            id: "desk-oled".to_string(),
            label: "Desk OLED".to_string(),
            board_id: "rp2040-pico-oled-091".to_string(),
            device_uid: Some("rp2040-pico-oled-091:0011223344556677".to_string()),
            transport: DeviceTransportConfig::serial("/dev/cu.usbmodem-old", 115200),
            channels: Vec::new(),
            enabled: true,
        }];

        let candidates = DeviceDiscoveryService::candidates_from_ports_with_registered_devices(
            ports,
            &registered,
        );

        assert_eq!(
            DeviceDiscoveryStatus::Matched,
            candidates[0].discovery_status
        );
        assert_eq!(
            Some("desk-oled".to_string()),
            candidates[0].matched_device_id
        );
        assert_eq!(
            Some("rp2040-pico-oled-091:0011223344556677".to_string()),
            candidates[0].device_uid
        );
    }
}
