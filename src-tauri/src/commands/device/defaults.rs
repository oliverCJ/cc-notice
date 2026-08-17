use crate::adapters::boards::rp2040_pico::Rp2040PicoBoardAdapter;
use crate::adapters::boards::{BoardAdapter, BoardCatalogRegistry};
#[cfg(test)]
use crate::core::device::DeviceTransportConfig;
use crate::core::device::{DeviceCandidateResource, DeviceChannel, DeviceInstance};

#[cfg(test)]
pub const DEFAULT_RP2040_DEVICE_ID: &str = "rp2040-pico-default";

#[cfg(test)]
pub(crate) fn default_rp2040_device() -> DeviceInstance {
    let adapter = Rp2040PicoBoardAdapter;
    DeviceInstance {
        id: DEFAULT_RP2040_DEVICE_ID.to_string(),
        label: adapter.display_name().to_string(),
        board_id: adapter.board_id().to_string(),
        device_uid: None,
        transport: DeviceTransportConfig::serial(
            "mock://rp2040-pico-default",
            adapter.default_baud_rate(),
        ),
        channels: adapter.default_channels(),
        enabled: true,
    }
}

pub(crate) fn default_channels_for_board(resource: &DeviceCandidateResource) -> Vec<DeviceChannel> {
    match resource
        .handshake_info
        .as_ref()
        .map(|info| info.board_id.as_str())
    {
        Some("rp2040-pico") => Rp2040PicoBoardAdapter.default_channels(),
        Some(board_id) => BoardCatalogRegistry::bundled()
            .ok()
            .and_then(|registry| {
                registry
                    .board(board_id)
                    .map(|board| board.default_channels())
            })
            .unwrap_or_default(),
        None => Vec::new(),
    }
}

pub(crate) fn unique_device_id(devices: &[DeviceInstance], device_uid: &str) -> String {
    let base = stable_id_fragment(device_uid);
    if !devices.iter().any(|device| device.id == base) {
        return base;
    }

    for index in 2.. {
        let candidate = format!("{base}-{index}");
        if !devices.iter().any(|device| device.id == candidate) {
            return candidate;
        }
    }
    unreachable!("unbounded sequence should eventually produce a unique device id")
}

pub(crate) fn non_blank_or(value: &str, fallback: &str) -> String {
    let value = value.trim();
    if value.is_empty() {
        fallback.to_string()
    } else {
        value.to_string()
    }
}

fn stable_id_fragment(value: &str) -> String {
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
    non_blank_or(&normalized, "registered-device")
}
