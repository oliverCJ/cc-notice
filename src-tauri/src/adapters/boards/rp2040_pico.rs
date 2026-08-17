use crate::adapters::boards::{BoardAdapter, BoardCatalogRegistry};
use crate::core::capability::BoardCapabilities;
use crate::core::device::DeviceChannel;

pub struct Rp2040PicoBoardAdapter;

impl BoardAdapter for Rp2040PicoBoardAdapter {
    fn board_id(&self) -> &'static str {
        "rp2040-pico"
    }

    fn display_name(&self) -> &'static str {
        "Raspberry Pi Pico"
    }

    fn capabilities(&self) -> BoardCapabilities {
        rp2040_catalog_board(|board| board.capabilities())
    }

    fn supported_protocol_version(&self) -> u16 {
        rp2040_catalog_board(|board| board.supported_protocol_version())
    }

    fn default_baud_rate(&self) -> u32 {
        rp2040_catalog_board(|board| board.default_baud_rate())
    }

    fn available_channels(&self) -> Vec<DeviceChannel> {
        rp2040_catalog_board(|board| board.available_channels())
    }

    fn default_channels(&self) -> Vec<DeviceChannel> {
        rp2040_catalog_board(|board| board.default_channels())
    }

    fn flash_strategy(&self) -> &'static str {
        "uf2_mount_copy"
    }
}

fn rp2040_catalog_board<T>(
    read: impl FnOnce(crate::adapters::boards::CatalogBoardAdapter<'_>) -> T,
) -> T {
    let registry = BoardCatalogRegistry::bundled().expect("bundled board catalog should load");
    let board = registry
        .board("rp2040-pico")
        .expect("bundled board catalog should include rp2040-pico");
    read(board)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::{ActiveLevel, DeviceChannelKind};
    use std::collections::HashSet;

    #[test]
    fn rp2040_pico_uses_protocol_v2_for_channelized_outputs() {
        let adapter = Rp2040PicoBoardAdapter;

        assert_eq!(2, adapter.supported_protocol_version());
    }

    #[test]
    fn rp2040_pico_defaults_to_serial_115200() {
        let adapter = Rp2040PicoBoardAdapter;

        assert_eq!(115200, adapter.default_baud_rate());
    }

    #[test]
    fn rp2040_pico_exposes_default_digital_output_channels() {
        let adapter = Rp2040PicoBoardAdapter;
        let channels = adapter.default_channels();
        let channel_ids = channels
            .iter()
            .map(|channel| channel.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(vec!["pin.gp0", "pin.gp1", "pin.gp2"], channel_ids);
        for channel in channels
            .iter()
            .filter(|channel| channel.kind == DeviceChannelKind::DigitalOutput)
        {
            assert_eq!(DeviceChannelKind::DigitalOutput, channel.kind);
            let config = channel
                .digital_output
                .as_ref()
                .expect("default RP2040 digital channel should be digital output");
            assert_eq!(ActiveLevel::High, config.active_level);
            assert_eq!(ActiveLevel::Low, config.default_level);
        }
        assert!(channels
            .iter()
            .all(|channel| channel.kind == DeviceChannelKind::DigitalOutput));
    }

    #[test]
    fn rp2040_pico_default_channels_do_not_reuse_physical_pins() {
        let adapter = Rp2040PicoBoardAdapter;
        let channels = adapter.default_channels();
        let mut pins = HashSet::new();

        for channel in channels {
            let pin = channel_physical_pin(&channel);
            assert!(
                pins.insert(pin),
                "default RP2040 channel pin should be unique: {pin}"
            );
        }
    }

    fn channel_physical_pin(channel: &DeviceChannel) -> u8 {
        if let Some(config) = &channel.digital_output {
            return config.pin;
        }
        if let Some(config) = &channel.pwm_output {
            return config.pin;
        }
        if let Some(config) = &channel.buzzer {
            return config.pin;
        }
        if let Some(config) = &channel.addressable_led {
            return config.pin;
        }

        panic!("default channel should map to a physical pin");
    }

    #[test]
    fn rp2040_pico_exposes_configurable_gpio_channel_capabilities() {
        let adapter = Rp2040PicoBoardAdapter;
        let channels = adapter.available_channels();
        let channel_ids = channels
            .iter()
            .map(|channel| channel.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(22, channels.len());
        assert!(channel_ids.contains(&"pin.gp0"));
        assert!(channel_ids.contains(&"pin.gp22"));
        assert!(channel_ids.contains(&"pin.gp26"));
        assert!(channel_ids.contains(&"pin.gp28"));
        assert!(!channel_ids.contains(&"pin.gp14"));
        assert!(!channel_ids.contains(&"pin.gp15"));
        assert!(!channel_ids.contains(&"pin.gp16"));
        assert!(!channel_ids.contains(&"pin.gp17"));
        assert!(!channel_ids.contains(&"pin.gp18"));
        assert!(!channel_ids.contains(&"pin.gp19"));
        assert!(!channel_ids.contains(&"pwm.gp14"));
        assert!(!channel_ids.contains(&"pwm.gp15"));
        assert!(channel_ids.contains(&"buzzer.gp18"));
        assert!(channel_ids.contains(&"buzzer.gp19"));
        assert!(!channel_ids.contains(&"ws2812.gp16"));
        assert!(!channel_ids.contains(&"ws2812.gp17"));
        assert!(!channel_ids.contains(&"pin.gp23"));
        assert!(!channel_ids.contains(&"pin.gp24"));
        assert!(!channel_ids.contains(&"pin.gp25"));
        assert!(!channel_ids.contains(&"pin.gp29"));
    }

    #[test]
    fn rp2040_pico_channels_include_physical_pin_metadata() {
        let adapter = Rp2040PicoBoardAdapter;
        let channels = adapter.available_channels();
        let gp2 = channels
            .iter()
            .find(|channel| channel.id == "pin.gp2")
            .expect("RP2040 Pico should expose GP2 as a configurable channel");

        assert_eq!(Some(4), gp2.physical_pin);
    }

    #[test]
    fn rp2040_pico_capabilities_express_channel_and_display_support() {
        let adapter = Rp2040PicoBoardAdapter;
        let capabilities = adapter.capabilities();

        assert!(capabilities.digital_output_channels);
        assert!(!capabilities.text_display);
    }
}
