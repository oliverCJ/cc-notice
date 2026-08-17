use serde::{Deserialize, Serialize};

use crate::core::device::DeviceTransportKind;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevicePortDescriptor {
    pub id: String,
    pub display_name: String,
    pub transport_kind: DeviceTransportKind,
    pub address: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stable_device_uid: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub stable_device_uid_candidates: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_port_descriptor_serializes_as_camel_case_contract() {
        let descriptor = DevicePortDescriptor {
            id: "mock://rp2040-pico-default".to_string(),
            display_name: "RP2040 Pico Mock Serial".to_string(),
            transport_kind: DeviceTransportKind::Serial,
            address: "mock://rp2040-pico-default".to_string(),
            stable_device_uid: None,
            stable_device_uid_candidates: Vec::new(),
        };

        let value = serde_json::to_value(descriptor).expect("descriptor should serialize");

        assert_eq!("mock://rp2040-pico-default", value["id"]);
        assert_eq!("RP2040 Pico Mock Serial", value["displayName"]);
        assert_eq!("serial", value["transportKind"]);
        assert_eq!("mock://rp2040-pico-default", value["address"]);
    }
}
