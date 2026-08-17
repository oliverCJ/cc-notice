use std::collections::{BTreeMap, HashSet};

use crate::core::device::{DeviceInstance, DeviceTransportConfig};
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;

pub struct DeviceConnectionManager;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AutoConnectPlan {
    pub attempts: Vec<AutoConnectAttempt>,
    pub skipped_unknown_resources: usize,
    pub duplicate_device_uids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AutoConnectAttempt {
    pub device_id: String,
    pub device_uid: String,
    pub transport: DeviceTransportConfig,
}

impl DeviceConnectionManager {
    pub fn plan_auto_connect(
        registered: &[DeviceInstance],
        scanned: &[DevicePortDescriptor],
        suppressed_device_ids: &HashSet<String>,
        connected_device_ids: &HashSet<String>,
    ) -> AutoConnectPlan {
        let registered_uids = registered_device_uids(registered);
        let skipped_unknown_resources = scanned
            .iter()
            .filter(|descriptor| {
                let uid_matches = descriptor_matches_registered_uid(descriptor, &registered_uids);
                !uid_matches
            })
            .count();
        let duplicate_device_uids = duplicate_device_uids(registered);
        let duplicate_uid_set = duplicate_device_uids
            .iter()
            .map(String::as_str)
            .collect::<HashSet<_>>();

        let attempts = registered
            .iter()
            .filter(|device| device.enabled)
            .filter(|device| !connected_device_ids.contains(&device.id))
            .filter(|device| !suppressed_device_ids.contains(&device.id))
            .filter_map(|device| {
                let device_uid = device.device_uid.as_ref()?;
                if duplicate_uid_set.contains(device_uid.as_str()) {
                    return None;
                }
                let transport = matched_transport_for_device(device, scanned)?;
                Some(AutoConnectAttempt {
                    device_id: device.id.clone(),
                    device_uid: device_uid.clone(),
                    transport,
                })
            })
            .collect();

        AutoConnectPlan {
            attempts,
            skipped_unknown_resources,
            duplicate_device_uids,
        }
    }
}

fn registered_device_uids(registered: &[DeviceInstance]) -> HashSet<&str> {
    registered
        .iter()
        .filter_map(|device| device.device_uid.as_deref())
        .collect()
}

fn matched_transport_for_device(
    device: &DeviceInstance,
    scanned: &[DevicePortDescriptor],
) -> Option<DeviceTransportConfig> {
    let device_uid = device.device_uid.as_deref()?;
    if let Some(descriptor) = scanned
        .iter()
        .find(|descriptor| descriptor_matches_uid(descriptor, device_uid))
    {
        let mut transport = device.transport.clone();
        transport.serial_port = Some(descriptor.address.clone());
        return Some(transport);
    }

    None
}

fn descriptor_matches_registered_uid(
    descriptor: &DevicePortDescriptor,
    registered_uids: &HashSet<&str>,
) -> bool {
    descriptor
        .stable_device_uid
        .as_deref()
        .map(|uid| registered_uids.contains(uid))
        .unwrap_or(false)
        || descriptor
            .stable_device_uid_candidates
            .iter()
            .any(|uid| registered_uids.contains(uid.as_str()))
}

fn descriptor_matches_uid(descriptor: &DevicePortDescriptor, device_uid: &str) -> bool {
    descriptor.stable_device_uid.as_deref() == Some(device_uid)
        || descriptor
            .stable_device_uid_candidates
            .iter()
            .any(|uid| uid == device_uid)
}

fn duplicate_device_uids(registered: &[DeviceInstance]) -> Vec<String> {
    let mut counts = BTreeMap::<&str, usize>::new();
    for device in registered {
        if let Some(device_uid) = device.device_uid.as_deref() {
            *counts.entry(device_uid).or_default() += 1;
        }
    }
    counts
        .into_iter()
        .filter_map(|(device_uid, count)| (count > 1).then(|| device_uid.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::core::device::{DeviceInstance, DeviceTransportConfig, DeviceTransportKind};
    use crate::infrastructure::transports::descriptor::DevicePortDescriptor;

    use super::DeviceConnectionManager;

    #[test]
    fn auto_connect_skips_unknown_resources() {
        let registered = vec![test_registered_device_with_uid(
            "desk-pico",
            "rp2040-pico:0011223344556677",
            "/dev/cu.known",
        )];
        let scanned = vec![serial_descriptor("/dev/cu.unknown")];

        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            &scanned,
            &Default::default(),
            &Default::default(),
        );

        assert!(plan.attempts.is_empty());
        assert_eq!(1, plan.skipped_unknown_resources);
    }

    #[test]
    fn auto_connect_matches_scanned_device_uid_when_port_changes() {
        let registered = vec![test_registered_device_with_uid(
            "desk-pico",
            "rp2040-pico:0011223344556677",
            "/dev/cu.usbmodem-old",
        )];
        let scanned = vec![serial_descriptor_with_uid(
            "/dev/cu.usbmodem-new",
            "rp2040-pico:0011223344556677",
        )];

        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            &scanned,
            &Default::default(),
            &Default::default(),
        );

        assert_eq!(1, plan.attempts.len());
        assert_eq!("desk-pico", plan.attempts[0].device_id);
        assert_eq!(
            Some("/dev/cu.usbmodem-new".to_string()),
            plan.attempts[0].transport.serial_port
        );
    }

    #[test]
    fn auto_connect_matches_pico_variant_uid_from_scanned_uid_candidates() {
        let registered = vec![test_registered_device(
            "desk-oled",
            "rp2040-pico-oled-091",
            "rp2040-pico-oled-091:0011223344556677",
            "/dev/cu.usbmodem-old",
        )];
        let scanned = vec![serial_descriptor_with_uid_candidates(
            "/dev/cu.usbmodem-new",
            "rp2040-pico:0011223344556677",
            vec![
                "rp2040-pico:0011223344556677",
                "rp2040-pico-oled-096:0011223344556677",
                "rp2040-pico-oled-091:0011223344556677",
            ],
        )];

        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            &scanned,
            &Default::default(),
            &Default::default(),
        );

        assert_eq!(1, plan.attempts.len());
        assert_eq!("desk-oled", plan.attempts[0].device_id);
        assert_eq!(
            Some("/dev/cu.usbmodem-new".to_string()),
            plan.attempts[0].transport.serial_port
        );
        assert_eq!(0, plan.skipped_unknown_resources);
    }

    #[test]
    fn auto_connect_does_not_match_saved_address_when_scanned_uid_belongs_to_other_device() {
        let registered = vec![test_registered_device_with_uid(
            "old-pico",
            "rp2040-pico:old-device",
            "/dev/cu.usbmodem-reused",
        )];
        let scanned = vec![serial_descriptor_with_uid(
            "/dev/cu.usbmodem-reused",
            "rp2040-pico:new-device",
        )];

        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            &scanned,
            &Default::default(),
            &Default::default(),
        );

        assert!(plan.attempts.is_empty());
    }

    #[test]
    fn auto_connect_does_not_match_saved_address_without_stable_uid() {
        let registered = vec![test_registered_device_with_uid(
            "desk-wio",
            "seeed-wio-terminal:0011223344556677",
            "/dev/cu.usbmodem1301",
        )];
        let scanned = vec![serial_descriptor("/dev/cu.usbmodem1301")];

        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            &scanned,
            &Default::default(),
            &Default::default(),
        );

        assert!(plan.attempts.is_empty());
        assert_eq!(1, plan.skipped_unknown_resources);
    }

    #[test]
    fn auto_connect_skips_connected_registered_devices() {
        let registered = vec![test_registered_device_with_uid(
            "desk-pico",
            "rp2040-pico:0011223344556677",
            "/dev/cu.usbmodem-old",
        )];
        let scanned = vec![serial_descriptor_with_uid(
            "/dev/cu.usbmodem-new",
            "rp2040-pico:0011223344556677",
        )];
        let connected_device_ids = HashSet::from(["desk-pico".to_string()]);

        let plan = DeviceConnectionManager::plan_auto_connect(
            &registered,
            &scanned,
            &Default::default(),
            &connected_device_ids,
        );

        assert!(plan.attempts.is_empty());
    }

    fn test_registered_device_with_uid(
        device_id: &str,
        device_uid: &str,
        serial_port: &str,
    ) -> DeviceInstance {
        test_registered_device(device_id, "rp2040-pico", device_uid, serial_port)
    }

    fn test_registered_device(
        device_id: &str,
        board_id: &str,
        device_uid: &str,
        serial_port: &str,
    ) -> DeviceInstance {
        DeviceInstance {
            id: device_id.to_string(),
            label: device_id.to_string(),
            board_id: board_id.to_string(),
            device_uid: Some(device_uid.to_string()),
            transport: DeviceTransportConfig::serial(serial_port, 115200),
            channels: Vec::new(),
            enabled: true,
        }
    }

    fn serial_descriptor(serial_port: &str) -> DevicePortDescriptor {
        DevicePortDescriptor {
            id: format!("serial:{serial_port}"),
            display_name: serial_port.to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: serial_port.to_string(),
            stable_device_uid: None,
            stable_device_uid_candidates: Vec::new(),
        }
    }

    fn serial_descriptor_with_uid(
        serial_port: &str,
        stable_device_uid: &str,
    ) -> DevicePortDescriptor {
        DevicePortDescriptor {
            id: format!("serial:{serial_port}"),
            display_name: serial_port.to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: serial_port.to_string(),
            stable_device_uid: Some(stable_device_uid.to_string()),
            stable_device_uid_candidates: vec![stable_device_uid.to_string()],
        }
    }

    fn serial_descriptor_with_uid_candidates(
        serial_port: &str,
        stable_device_uid: &str,
        stable_device_uid_candidates: Vec<&str>,
    ) -> DevicePortDescriptor {
        DevicePortDescriptor {
            id: format!("serial:{serial_port}"),
            display_name: serial_port.to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: serial_port.to_string(),
            stable_device_uid: Some(stable_device_uid.to_string()),
            stable_device_uid_candidates: stable_device_uid_candidates
                .into_iter()
                .map(str::to_string)
                .collect(),
        }
    }
}
