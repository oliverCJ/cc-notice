use crate::core::boards::loader::{
    load_board_catalog_from_str, load_bundled_board_catalog_from_str,
};

#[test]
fn board_catalog_rejects_duplicate_board_ids() {
    let yaml = r#"
boards:
  - id: rp2040-pico
    displayName: Raspberry Pi Pico
    family: raspberry-pi-pico
    chip: rp2040
    mcu: rp2040
    protocolVersion: 2
    defaultTransport: serial
    defaultBaudRate: 115200
    supportedTransports: [serial]
    supportedFlashStrategies: [uf2_mount_copy]
    identity: { stableUid: required }
    pinCatalogId: rp2040-pico
    defaultChannelTemplateIds: []
  - id: rp2040-pico
    displayName: Duplicate
    family: raspberry-pi-pico
    chip: rp2040
    mcu: rp2040
    protocolVersion: 2
    defaultTransport: serial
    defaultBaudRate: 115200
    supportedTransports: [serial]
    supportedFlashStrategies: [uf2_mount_copy]
    identity: { stableUid: required }
    pinCatalogId: rp2040-pico
    defaultChannelTemplateIds: []
pinCatalogs: []
channelTemplates: []
"#;

    let error = load_board_catalog_from_str(yaml).expect_err("duplicate board id must fail");

    assert!(error.contains("duplicate board id: rp2040-pico"));
}

#[test]
fn board_catalog_defaults_missing_display_size_class_to_small() {
    let yaml = r#"
boards:
  - id: display-test
    displayName: Display Test
    family: test
    chip: test
    mcu: test
    protocolVersion: 2
    defaultTransport: serial
    defaultBaudRate: 115200
    supportedTransports: [serial]
    supportedFlashStrategies: [uf2_mount_copy]
    identity: { stableUid: required }
    deviceExtensions:
      display:
        status: true
        runtime: true
        clear: true
        titleMaxChars: 16
        messageMaxChars: 16
    pinCatalogId: display-test
    defaultChannelTemplateIds: []
pinCatalogs:
  - id: display-test
    pins: []
channelTemplates: []
"#;

    let catalog = load_board_catalog_from_str(yaml).expect("legacy display catalog should load");
    let display = catalog.boards[0]
        .device_extensions
        .as_ref()
        .and_then(|extensions| extensions.display.as_ref())
        .expect("display extension should load");

    assert_eq!(
        crate::core::device::DeviceDisplaySizeClass::Small,
        display.size_class
    );
}

#[test]
fn bundled_board_catalog_requires_display_size_class() {
    let yaml = r#"
boards:
  - id: display-test
    displayName: Display Test
    family: test
    chip: test
    mcu: test
    protocolVersion: 2
    defaultTransport: serial
    defaultBaudRate: 115200
    supportedTransports: [serial]
    supportedFlashStrategies: [uf2_mount_copy]
    identity: { stableUid: required }
    deviceExtensions:
      display:
        status: true
        runtime: true
        clear: true
        titleMaxChars: 16
        messageMaxChars: 16
    pinCatalogId: display-test
    defaultChannelTemplateIds: []
pinCatalogs:
  - id: display-test
    pins: []
channelTemplates: []
"#;

    let error =
        load_bundled_board_catalog_from_str(yaml).expect_err("bundled catalog must be strict");

    assert!(error.contains("board display-test display extension must declare sizeClass"));
}

#[test]
fn bundled_board_catalog_contains_usb_stable_priority_boards() {
    let content = include_str!("../../templates/boards.yaml");
    let catalog =
        load_bundled_board_catalog_from_str(content).expect("bundled board catalog should load");
    let ids = catalog
        .boards
        .iter()
        .map(|board| board.id.as_str())
        .collect::<Vec<_>>();

    assert!(ids.contains(&"rp2040-pico"));
    assert!(ids.contains(&"arduino-leonardo"));
    assert!(ids.contains(&"arduino-micro"));
    assert!(ids.contains(&"sparkfun-pro-micro-32u4"));
    assert!(ids.contains(&"arduino-uno"));
    assert!(ids.contains(&"arduino-nano"));
    assert!(ids.contains(&"stm32f103cx-blue-pill"));
}

#[test]
fn board_catalog_loads_pin_metadata_and_validates_template_references() {
    let yaml = r#"
boards:
  - id: arduino-test
    displayName: Arduino Test
    family: arduino-avr
    chip: atmega32u4
    mcu: atmega32u4
    protocolVersion: 2
    defaultTransport: serial
    defaultBaudRate: 115200
    supportedTransports: [serial]
    supportedFlashStrategies: [arduino_cli_upload]
    identity: { stableUid: limited }
    pinCatalogId: arduino-test
    defaultChannelTemplateIds: [arduino-digital]
pinCatalogs:
  - id: arduino-test
    pins:
      - id: d18
        label: A0 / D18
        physicalPin: null
        gpio: PF7
        arduinoPin: 18
        aliases: [a0]
        analogChannel: A0
        roles: [analog, header]
        notes: [Analog-capable digital pin]
        capabilities: [digital-output, analog-input]
channelTemplates:
  - id: arduino-digital
    channelKind: digital-output
    compatiblePinCapabilities: [digital-output]
    supportedActions: [activate]
    hardwareGuideId: digital-output
    recommendedPinIds: [d18]
"#;

    let catalog = load_board_catalog_from_str(yaml).expect("metadata catalog should load");
    let pin = &catalog.pin_catalogs[0].pins[0];

    assert_eq!(Some(18), pin.arduino_pin);
    assert_eq!(vec!["a0"], pin.aliases);
    assert_eq!(Some("A0"), pin.analog_channel.as_deref());
    assert!(pin.roles.contains(&"analog".to_string()));
    assert!(pin
        .notes
        .contains(&"Analog-capable digital pin".to_string()));
}

#[test]
fn board_catalog_rejects_template_recommended_pin_missing_from_catalog() {
    let yaml = r#"
boards:
  - id: arduino-test
    displayName: Arduino Test
    family: arduino-avr
    chip: atmega32u4
    mcu: atmega32u4
    protocolVersion: 2
    defaultTransport: serial
    defaultBaudRate: 115200
    supportedTransports: [serial]
    supportedFlashStrategies: [arduino_cli_upload]
    identity: { stableUid: limited }
    pinCatalogId: arduino-test
    defaultChannelTemplateIds: [arduino-digital]
pinCatalogs:
  - id: arduino-test
    pins:
      - id: d2
        label: D2
        physicalPin: null
        gpio: PD1
        capabilities: [digital-output]
channelTemplates:
  - id: arduino-digital
    channelKind: digital-output
    compatiblePinCapabilities: [digital-output]
    supportedActions: [activate]
    hardwareGuideId: digital-output
    recommendedPinIds: [d99]
"#;

    let error = load_board_catalog_from_str(yaml).expect_err("missing recommended pin must fail");

    assert!(error.contains("recommended pin d99 is not defined in pin catalog arduino-test"));
}

#[test]
fn bundled_atmega32u4_catalogs_include_board_specific_pin_metadata() {
    let content = include_str!("../../templates/boards.yaml");
    let catalog =
        load_bundled_board_catalog_from_str(content).expect("bundled board catalog should load");

    let leonardo = catalog
        .pin_catalogs
        .iter()
        .find(|pin_catalog| pin_catalog.id == "arduino-leonardo")
        .expect("Leonardo catalog should exist");
    let micro = catalog
        .pin_catalogs
        .iter()
        .find(|pin_catalog| pin_catalog.id == "arduino-micro")
        .expect("Micro catalog should exist");
    let pro_micro = catalog
        .pin_catalogs
        .iter()
        .find(|pin_catalog| pin_catalog.id == "sparkfun-pro-micro-32u4")
        .expect("Pro Micro catalog should exist");

    assert!(leonardo.pins.len() >= 23);
    assert!(micro.pins.len() >= 24);
    assert!(pro_micro.pins.len() >= 18);
    assert!(leonardo
        .pins
        .iter()
        .any(|pin| pin.id == "d18" && pin.aliases.contains(&"a0".to_string())));
    assert!(micro
        .pins
        .iter()
        .any(|pin| pin.id == "d16" && pin.roles.contains(&"spi".to_string())));
    assert!(pro_micro
        .pins
        .iter()
        .any(|pin| pin.id == "d10" && pin.analog_channel.as_deref() == Some("A10")));
    assert!(pro_micro.pins.iter().any(|pin| pin.id == "a0"
        && pin.arduino_pin == Some(18)
        && pin.label == "A0"
        && pin.aliases.contains(&"d18".to_string())));
    assert!(pro_micro
        .pins
        .iter()
        .any(|pin| pin.id == "d17" && pin.capabilities.is_empty()));
    assert!(!pro_micro.pins.iter().any(|pin| pin.id == "d18"));
}

#[test]
fn bundled_rp2040_boards_hide_pwm_and_ws2812_software_channels() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");

    for board_id in [
        "rp2040-pico",
        "rp2040-pico-oled-096",
        "rp2040-pico-oled-091",
    ] {
        let board = registry.board(board_id).expect("board should exist");
        let available_channels = board.available_channels();

        assert!(
            available_channels.iter().any(
                |channel| channel.kind == crate::core::device::DeviceChannelKind::DigitalOutput
            ),
            "{board_id} should keep digital output channels"
        );
        assert!(
            available_channels
                .iter()
                .any(|channel| channel.kind == crate::core::device::DeviceChannelKind::Buzzer),
            "{board_id} should keep buzzer channels"
        );
        assert!(
            !available_channels
                .iter()
                .any(|channel| channel.id.starts_with("pwm.")),
            "{board_id} should hide independent PWM channels"
        );
        assert!(
            !available_channels
                .iter()
                .any(|channel| channel.id.starts_with("ws2812.")),
            "{board_id} should hide WS2812 channels"
        );
    }
}

#[test]
fn bundled_atmega32u4_boards_hide_independent_pwm_software_channels() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");

    for board_id in [
        "arduino-leonardo",
        "arduino-micro",
        "sparkfun-pro-micro-32u4",
    ] {
        let board = registry.board(board_id).expect("board should exist");
        let available_channels = board.available_channels();

        assert!(
            available_channels.iter().any(
                |channel| channel.kind == crate::core::device::DeviceChannelKind::DigitalOutput
            ),
            "{board_id} should keep digital output channels"
        );
        assert!(
            available_channels
                .iter()
                .any(|channel| channel.kind == crate::core::device::DeviceChannelKind::Buzzer),
            "{board_id} should keep buzzer channels"
        );
        assert!(
            !available_channels
                .iter()
                .any(|channel| channel.id.starts_with("pwm.")),
            "{board_id} should hide independent PWM channels"
        );
        assert!(
            !available_channels
                .iter()
                .any(|channel| channel.id.starts_with("ws2812.")),
            "{board_id} should keep WS2812 hidden"
        );
    }
}

#[test]
fn bundled_pro_micro_exposes_pwm_capable_digital_breathe_without_pwm_channels() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");
    let board = registry
        .board("sparkfun-pro-micro-32u4")
        .expect("Pro Micro board should exist");
    let available_channels = board.available_channels();

    for channel_id in ["pin.d3", "pin.d5", "pin.d6", "pin.d9", "pin.d10"] {
        assert!(
            available_channels
                .iter()
                .find(|channel| channel.id == channel_id)
                .expect("pwm-capable Pro Micro digital pin should exist")
                .supported_actions
                .contains(&crate::core::device::DeviceChannelActionType::Breathe),
            "{channel_id} should support breathe"
        );
    }
    assert!(!available_channels
        .iter()
        .any(|channel| channel.id.starts_with("pwm.")));
    assert!(available_channels
        .iter()
        .any(|channel| channel.id == "buzzer.d9"));
    assert!(available_channels
        .iter()
        .any(|channel| channel.id == "pin.a0" && channel.label == "A0"));
    assert!(!available_channels
        .iter()
        .any(|channel| channel.id == "pin.d17" || channel.id == "pin.d18"));
}

#[test]
fn bundled_atmega328p_catalogs_include_uno_and_nano_pin_metadata() {
    let content = include_str!("../../templates/boards.yaml");
    let catalog =
        load_bundled_board_catalog_from_str(content).expect("bundled board catalog should load");

    let uno = catalog
        .pin_catalogs
        .iter()
        .find(|pin_catalog| pin_catalog.id == "arduino-uno")
        .expect("Uno catalog should exist");
    let nano = catalog
        .pin_catalogs
        .iter()
        .find(|pin_catalog| pin_catalog.id == "arduino-nano")
        .expect("Nano catalog should exist");

    assert!(uno
        .pins
        .iter()
        .any(|pin| pin.id == "d0" && pin.roles.contains(&"serial-rx".to_string())));
    assert!(uno
        .pins
        .iter()
        .any(|pin| pin.id == "d0" && pin.capabilities.is_empty()));
    assert!(uno
        .pins
        .iter()
        .any(|pin| pin.id == "d1" && pin.capabilities.is_empty()));
    assert!(uno
        .pins
        .iter()
        .any(|pin| pin.id == "d3" && pin.capabilities == vec!["digital-output", "pwm-output"]));
    assert!(uno
        .pins
        .iter()
        .any(|pin| pin.id == "d13" && pin.roles.contains(&"builtin-led".to_string())));
    assert!(nano
        .pins
        .iter()
        .any(|pin| pin.id == "a0" && pin.analog_channel.as_deref() == Some("A0")));
    assert!(nano
        .pins
        .iter()
        .any(|pin| pin.id == "d0" && pin.capabilities.is_empty()));
    assert!(nano
        .pins
        .iter()
        .any(|pin| pin.id == "d1" && pin.capabilities.is_empty()));
    assert!(nano
        .pins
        .iter()
        .any(|pin| pin.id == "d6" && pin.capabilities == vec!["digital-output", "pwm-output"]));
    assert!(nano
        .pins
        .iter()
        .any(|pin| pin.id == "a6" && pin.capabilities == vec!["analog-input"]));
}

#[test]
fn bundled_atmega328p_boards_expose_tiny_avr_digital_channels_with_pin_level_breathe() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");

    for board_id in ["arduino-uno", "arduino-nano"] {
        let board = registry.board(board_id).expect("board should exist");
        let available_channels = board.available_channels();
        let default_channels = board.default_channels();

        assert!(available_channels
            .iter()
            .any(|channel| channel.kind == crate::core::device::DeviceChannelKind::DigitalOutput));
        assert!(!available_channels
            .iter()
            .any(|channel| channel.id.starts_with("pwm.")));
        assert!(!available_channels
            .iter()
            .any(|channel| channel.id.starts_with("buzzer.")));
        assert!(!available_channels
            .iter()
            .any(|channel| channel.id.starts_with("ws2812.")));
        assert!(!available_channels
            .iter()
            .find(|channel| channel.id == "pin.d2")
            .expect("pin.d2 should exist")
            .supported_actions
            .contains(&crate::core::device::DeviceChannelActionType::Breathe));
        for channel_id in ["pin.d3", "pin.d5", "pin.d6", "pin.d9", "pin.d10"] {
            assert!(
                available_channels
                    .iter()
                    .find(|channel| channel.id == channel_id)
                    .expect("pwm-capable digital pin should exist")
                    .supported_actions
                    .contains(&crate::core::device::DeviceChannelActionType::Breathe),
                "{channel_id} should support breathe"
            );
        }
        assert_eq!(
            vec![
                "pin.d2", "pin.d3", "pin.d4", "pin.d5", "pin.d6", "pin.d7", "pin.d8", "pin.d9",
                "pin.d10"
            ],
            available_channels
                .iter()
                .map(|channel| channel.id.as_str())
                .collect::<Vec<_>>()
        );
        assert_eq!(
            Some("D3 / PWM"),
            available_channels
                .iter()
                .find(|channel| channel.id == "pin.d3")
                .map(|channel| channel.label.as_str())
        );
        assert_eq!(
            Some("D10 / PWM / SS"),
            available_channels
                .iter()
                .find(|channel| channel.id == "pin.d10")
                .map(|channel| channel.label.as_str())
        );
        assert_eq!(
            vec!["pin.d2", "pin.d3", "pin.d4"],
            default_channels
                .iter()
                .map(|channel| channel.id.as_str())
                .collect::<Vec<_>>()
        );
    }
}

#[test]
fn bundled_atmega328p_available_channels_are_supported_by_firmware_catalogs() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");
    let firmware_channels = [
        (
            "arduino-uno",
            include_str!("../../../../firmware/boards/arduino-uno/src/board_channels.cpp"),
        ),
        (
            "arduino-nano",
            include_str!("../../../../firmware/boards/arduino-nano/src/board_channels.cpp"),
        ),
    ];

    for (board_id, firmware_source) in firmware_channels {
        let board = registry.board(board_id).expect("board should exist");
        for channel in board.available_channels() {
            assert!(
                firmware_source.contains(&format!("\"{}\"", channel.id)),
                "{board_id} catalog channel {} is missing from firmware",
                channel.id
            );
        }
    }
}

#[test]
fn bundled_stm32_blue_pill_catalog_uses_small_mcu_channel_scope() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");
    let board = registry
        .board("stm32f103cx-blue-pill")
        .expect("STM32 Blue Pill board should exist");
    let available_channels = board.available_channels();
    let default_channels = board.default_channels();

    assert_eq!("STM32F103C8T6/C6T6 Blue Pill", board.display_name());
    assert_eq!(115200, board.default_baud_rate());
    assert!(board.supports_flash_strategy("arduino_cli_upload"));
    assert_eq!(
        vec![
            "pin.pa0", "pin.pa1", "pin.pa2", "pin.pa3", "pin.pa4", "pin.pa5", "pin.pa6", "pin.pa7",
            "pin.pb0", "pin.pb1", "pin.pb10", "pin.pb11"
        ],
        available_channels
            .iter()
            .map(|channel| channel.id.as_str())
            .collect::<Vec<_>>()
    );
    assert_eq!(
        vec![
            crate::core::device::DeviceChannelActionType::Activate,
            crate::core::device::DeviceChannelActionType::Deactivate,
            crate::core::device::DeviceChannelActionType::Blink,
            crate::core::device::DeviceChannelActionType::Pulse,
        ],
        available_channels
            .iter()
            .find(|channel| channel.id == "pin.pa0")
            .expect("PA0 should exist")
            .supported_actions
    );
    assert!(!available_channels
        .iter()
        .find(|channel| channel.id == "pin.pa4")
        .expect("PA4 should exist")
        .supported_actions
        .contains(&crate::core::device::DeviceChannelActionType::Breathe));
    assert!(!available_channels
        .iter()
        .any(|channel| channel.id.starts_with("pwm.")));
    assert!(!available_channels
        .iter()
        .any(|channel| channel.id.starts_with("buzzer.")));
    assert!(!available_channels
        .iter()
        .any(|channel| channel.id == "pin.pa13" || channel.id == "pin.pa14"));
    assert_eq!(
        vec!["pin.pa0", "pin.pa1", "pin.pa2"],
        default_channels
            .iter()
            .map(|channel| channel.id.as_str())
            .collect::<Vec<_>>()
    );
}

#[test]
fn bundled_stm32_blue_pill_available_channels_are_supported_by_firmware_catalog() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");
    let board = registry
        .board("stm32f103cx-blue-pill")
        .expect("STM32 Blue Pill board should exist");
    let firmware_source =
        include_str!("../../../../firmware/boards/stm32f103cx-blue-pill/src/board_channels.cpp");

    for channel in board.available_channels() {
        assert!(
            firmware_source.contains(&format!("\"{}\"", channel.id)),
            "STM32 Blue Pill catalog channel {} is missing from firmware",
            channel.id
        );
    }
}

#[test]
fn bundled_atmega32u4_catalogs_keep_usb_serial_pins_consistent_with_firmware() {
    let registry = crate::adapters::boards::BoardCatalogRegistry::bundled()
        .expect("bundled registry should load");

    for board_id in [
        "arduino-leonardo",
        "arduino-micro",
        "sparkfun-pro-micro-32u4",
    ] {
        let board = registry.board(board_id).expect("board should exist");
        let channel_ids = board
            .available_channels()
            .iter()
            .map(|channel| channel.id.clone())
            .collect::<Vec<_>>();

        assert!(
            channel_ids.contains(&"pin.d0".to_string()),
            "{board_id} should expose pin.d0 when firmware supports it"
        );
        assert!(
            channel_ids.contains(&"pin.d1".to_string()),
            "{board_id} should expose pin.d1 when firmware supports it"
        );
    }
}

#[test]
fn bundled_wio_terminal_catalog_uses_stable_uid_and_variant_pin_numbers() {
    let content = include_str!("../../templates/boards.yaml");
    let catalog =
        load_bundled_board_catalog_from_str(content).expect("bundled board catalog should load");
    let leonardo = catalog
        .boards
        .iter()
        .find(|board| board.id == "arduino-leonardo")
        .expect("Leonardo board should exist");
    let wio = catalog
        .boards
        .iter()
        .find(|board| board.id == "seeed-wio-terminal")
        .expect("Wio Terminal board should exist");
    let pins = catalog
        .pin_catalogs
        .iter()
        .find(|pin_catalog| pin_catalog.id == "seeed-wio-terminal")
        .expect("Wio Terminal pin catalog should exist");

    assert_eq!(
        crate::core::boards::StableUidPolicy::Limited,
        leonardo.identity.stable_uid
    );
    assert_eq!(
        crate::core::boards::StableUidPolicy::Required,
        wio.identity.stable_uid
    );
    for (pin_id, arduino_pin) in [
        ("d0", 0),
        ("d1", 1),
        ("d2", 2),
        ("d3", 3),
        ("d4", 4),
        ("d5", 5),
        ("d6", 6),
        ("d7", 7),
        ("d8", 8),
        ("onboard", 12),
    ] {
        assert!(
            pins.pins
                .iter()
                .any(|pin| pin.id == pin_id && pin.arduino_pin == Some(arduino_pin)),
            "{pin_id} should use Wio Terminal variant pin {arduino_pin}"
        );
    }
    assert!(
        pins.pins
            .iter()
            .any(|pin| pin.id == "d0" && pin.label == "D0 / BCM27 / A0 / PWM0"),
        "D0 should follow the official Wio pinout label"
    );
}

#[test]
fn wio_terminal_declares_device_extension_capabilities() {
    let content = include_str!("../../templates/boards.yaml");
    let catalog =
        load_bundled_board_catalog_from_str(content).expect("bundled board catalog should load");
    let board = catalog
        .boards
        .iter()
        .find(|item| item.id == "seeed-wio-terminal")
        .expect("wio terminal board should exist");
    let extensions = board
        .device_extensions
        .as_ref()
        .expect("wio terminal should declare device extensions");

    let display = extensions
        .display
        .as_ref()
        .expect("wio terminal should support display extension");
    assert!(display.status);
    assert!(display.card);
    assert!(display.lines);
    assert!(display.runtime);
    assert!(display.clear);
    assert_eq!(
        vec!["notice", "working", "success", "warning", "error"],
        display.statuses
    );
    assert_eq!(39, display.title_max_chars);
    assert_eq!(95, display.message_max_chars);
    assert_eq!(
        crate::core::device::DeviceDisplayTextEncoding::Ascii,
        display.text_encoding
    );
    assert_eq!(
        crate::core::device::DeviceDisplaySizeClass::Medium,
        display.size_class
    );

    let buzzer = extensions
        .buzzer
        .as_ref()
        .expect("wio terminal should support buzzer extension");
    assert_eq!(
        vec!["notice", "success", "warning", "error", "working"],
        buzzer.patterns
    );

    let inputs = extensions
        .inputs
        .as_ref()
        .expect("wio terminal should declare input capabilities");
    let buttons = inputs
        .buttons
        .as_ref()
        .expect("wio terminal should declare button input capability");
    assert_eq!("supported", buttons.status);
    assert_eq!(
        vec![
            "button.a",
            "button.b",
            "button.c",
            "fiveway.up",
            "fiveway.down"
        ],
        buttons.controls
    );
}

#[test]
fn pico_oled_variants_declare_runtime_display_capability() {
    let content = include_str!("../../templates/boards.yaml");
    let catalog =
        load_bundled_board_catalog_from_str(content).expect("bundled board catalog should load");

    for (board_id, supports_status, size_class) in [
        (
            "rp2040-pico-oled-096",
            true,
            crate::core::device::DeviceDisplaySizeClass::Small,
        ),
        (
            "rp2040-pico-oled-091",
            true,
            crate::core::device::DeviceDisplaySizeClass::Compact,
        ),
    ] {
        let board = catalog
            .boards
            .iter()
            .find(|item| item.id == board_id)
            .expect("pico oled board should exist");
        let display = board
            .device_extensions
            .as_ref()
            .and_then(|extensions| extensions.display.as_ref())
            .expect("pico oled board should support display extension");

        assert_eq!(supports_status, display.status);
        assert!(display.lines);
        assert!(display.runtime);
        assert!(display.clear);
        assert_eq!(size_class, display.size_class);
    }
}
