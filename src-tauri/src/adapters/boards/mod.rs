use crate::core::boards::{
    BoardCatalog, BoardDefinition, DeviceChannelTemplate, PinCatalog, PinDefinition,
    StableUidPolicy,
};
use crate::core::capability::BoardCapabilities;
use crate::core::device::{
    ActiveLevel, DeviceChannel, DeviceChannelActionType, DeviceExtensionCapabilities,
};

pub mod rp2040_pico;

pub trait BoardAdapter {
    fn board_id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn capabilities(&self) -> BoardCapabilities;
    fn supported_protocol_version(&self) -> u16;
    fn default_baud_rate(&self) -> u32;
    fn available_channels(&self) -> Vec<DeviceChannel>;
    fn default_channels(&self) -> Vec<DeviceChannel>;
    fn flash_strategy(&self) -> &'static str;
}

pub struct BoardCatalogRegistry {
    catalog: BoardCatalog,
}

impl BoardCatalogRegistry {
    pub fn bundled() -> Result<Self, String> {
        let catalog = crate::core::boards::loader::load_bundled_board_catalog_from_str(
            include_str!("../../../templates/boards.yaml"),
        )?;
        Ok(Self { catalog })
    }

    pub fn board(&self, board_id: &str) -> Option<CatalogBoardAdapter<'_>> {
        self.catalog
            .boards
            .iter()
            .find(|board| board.id == board_id)
            .map(|board| CatalogBoardAdapter {
                board,
                catalog: &self.catalog,
            })
    }
}

pub struct CatalogBoardAdapter<'a> {
    board: &'a BoardDefinition,
    catalog: &'a BoardCatalog,
}

impl CatalogBoardAdapter<'_> {
    pub fn board_id(&self) -> &str {
        &self.board.id
    }

    pub fn display_name(&self) -> &str {
        &self.board.display_name
    }

    pub fn capabilities(&self) -> BoardCapabilities {
        let has_channel_kind = |kind: &str| {
            self.board
                .default_channel_template_ids
                .iter()
                .filter_map(|template_id| self.channel_template(template_id))
                .any(|template| template.channel_kind == kind)
        };

        BoardCapabilities {
            digital_output_channels: has_channel_kind("digital-output"),
            text_display: has_channel_kind("display"),
        }
    }

    pub fn supported_protocol_version(&self) -> u16 {
        self.board.protocol_version
    }

    pub fn device_extensions(&self) -> Option<&DeviceExtensionCapabilities> {
        self.board.device_extensions.as_ref()
    }

    pub fn default_baud_rate(&self) -> u32 {
        self.board.default_baud_rate.unwrap_or(115200)
    }

    pub fn stable_uid_policy(&self) -> &StableUidPolicy {
        &self.board.identity.stable_uid
    }

    pub fn supports_flash_strategy(&self, strategy: &str) -> bool {
        self.board
            .supported_flash_strategies
            .iter()
            .any(|item| item == strategy)
    }

    pub fn available_channels(&self) -> Vec<DeviceChannel> {
        let Some(pin_catalog) = self.pin_catalog() else {
            return Vec::new();
        };

        self.board
            .default_channel_template_ids
            .iter()
            .filter_map(|template_id| self.channel_template(template_id))
            .flat_map(|template| {
                pin_catalog
                    .pins
                    .iter()
                    .filter(move |pin| pin_matches_template(pin, template))
                    .filter_map(move |pin| channel_from_template(pin, template))
            })
            .collect()
    }

    pub fn default_channels(&self) -> Vec<DeviceChannel> {
        let Some(pin_catalog) = self.pin_catalog() else {
            return Vec::new();
        };

        self.board
            .default_channel_template_ids
            .iter()
            .filter_map(|template_id| self.channel_template(template_id))
            .flat_map(|template| {
                template
                    .recommended_pin_ids
                    .iter()
                    .filter_map(|pin_id| pin_catalog.pins.iter().find(|pin| pin.id == *pin_id))
                    .filter(move |pin| pin_matches_template(pin, template))
                    .filter_map(move |pin| channel_from_template(pin, template))
            })
            .collect()
    }

    pub fn flash_strategy(&self) -> Option<&str> {
        self.board
            .supported_flash_strategies
            .first()
            .map(String::as_str)
    }

    fn pin_catalog(&self) -> Option<&PinCatalog> {
        self.catalog
            .pin_catalogs
            .iter()
            .find(|pin_catalog| pin_catalog.id == self.board.pin_catalog_id)
    }

    fn channel_template(&self, template_id: &str) -> Option<&DeviceChannelTemplate> {
        self.catalog
            .channel_templates
            .iter()
            .find(|template| template.id == template_id)
    }
}

fn pin_matches_template(pin: &PinDefinition, template: &DeviceChannelTemplate) -> bool {
    template
        .compatible_pin_capabilities
        .iter()
        .any(|capability| pin.capabilities.contains(capability))
}

fn channel_from_template(
    pin: &PinDefinition,
    template: &DeviceChannelTemplate,
) -> Option<DeviceChannel> {
    let pin_number = pin_number(pin)?;
    let channel = match template.channel_kind.as_str() {
        "digital-output" => DeviceChannel::digital_output(
            &format!("pin.{}", pin.id),
            &pin.label,
            pin_number,
            ActiveLevel::High,
            ActiveLevel::Low,
        ),
        "pwm-output" => DeviceChannel::pwm_output(
            &format!("pwm.{}", pin.id),
            &kind_label(&pin.label, "PWM"),
            pin_number,
            1000,
            0,
            100,
        ),
        "buzzer" => DeviceChannel::buzzer(
            &format!("buzzer.{}", pin.id),
            &kind_label(&pin.label, "Buzzer"),
            pin_number,
            ActiveLevel::High,
            2000,
            true,
        ),
        "addressable-led" => DeviceChannel::addressable_led(
            &format!("ws2812.{}", pin.id),
            &kind_label(&pin.label, "WS2812"),
            pin_number,
            "ws2812",
            8,
            "grb",
            30,
        ),
        _ => return None,
    };

    let mut channel = match pin.physical_pin {
        Some(physical_pin) => channel.with_physical_pin(physical_pin),
        None => channel,
    };
    let supported_actions = template
        .supported_actions
        .iter()
        .filter_map(|action| action_from_template(action))
        .collect::<Vec<_>>();
    if !supported_actions.is_empty() {
        channel.supported_actions = supported_actions;
    }
    if template.id == "arduino-avr-digital-output"
        && pin
            .capabilities
            .iter()
            .any(|capability| capability == "pwm-output")
        && !channel
            .supported_actions
            .contains(&DeviceChannelActionType::Breathe)
    {
        channel
            .supported_actions
            .push(DeviceChannelActionType::Breathe);
    }
    Some(channel)
}

fn action_from_template(action: &str) -> Option<DeviceChannelActionType> {
    match action {
        "activate" => Some(DeviceChannelActionType::Activate),
        "deactivate" => Some(DeviceChannelActionType::Deactivate),
        "blink" => Some(DeviceChannelActionType::Blink),
        "breathe" => Some(DeviceChannelActionType::Breathe),
        "pulse" => Some(DeviceChannelActionType::Pulse),
        "set-duty" => Some(DeviceChannelActionType::SetDuty),
        "beep" => Some(DeviceChannelActionType::Beep),
        "tone" => Some(DeviceChannelActionType::Tone),
        "pattern" => Some(DeviceChannelActionType::Pattern),
        "set-color" => Some(DeviceChannelActionType::SetColor),
        "clear" => Some(DeviceChannelActionType::Clear),
        _ => None,
    }
}

fn kind_label(label: &str, suffix: &str) -> String {
    if label.contains(suffix) {
        label.to_string()
    } else {
        format!("{label} {suffix}")
    }
}

fn pin_number(pin: &PinDefinition) -> Option<u8> {
    if let Some(arduino_pin) = pin.arduino_pin {
        return Some(arduino_pin);
    }
    let digits = pin
        .id
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect::<String>();
    digits.parse::<u8>().ok()
}

#[cfg(test)]
mod tests {
    use super::BoardCatalogRegistry;

    #[test]
    fn catalog_registry_returns_rp2040_default_channels_without_page_hardcoding() {
        let registry = BoardCatalogRegistry::bundled().expect("bundled registry should load");
        let board = registry
            .board("rp2040-pico")
            .expect("rp2040 board should exist");

        assert_eq!("Raspberry Pi Pico", board.display_name());
        assert_eq!(2, board.supported_protocol_version());
        assert_eq!(115200, board.default_baud_rate());
        assert!(board
            .default_channels()
            .iter()
            .any(|channel| channel.id == "pin.gp2"));
    }
}
