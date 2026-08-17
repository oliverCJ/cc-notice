use std::collections::HashSet;

use super::BoardCatalog;
use serde_yaml::Value;

pub fn load_board_catalog_from_str(content: &str) -> Result<BoardCatalog, String> {
    let catalog: BoardCatalog = serde_yaml::from_str(content)
        .map_err(|error| format!("failed to parse board catalog: {error}"))?;
    validate_board_catalog(&catalog)?;
    Ok(catalog)
}

pub fn load_bundled_board_catalog_from_str(content: &str) -> Result<BoardCatalog, String> {
    validate_display_size_class_presence(content)?;
    load_board_catalog_from_str(content)
}

fn validate_display_size_class_presence(content: &str) -> Result<(), String> {
    let value: Value = serde_yaml::from_str(content)
        .map_err(|error| format!("failed to parse board catalog: {error}"))?;
    let Some(boards) = value.get("boards").and_then(|boards| boards.as_sequence()) else {
        return Ok(());
    };

    for board in boards {
        let board_id = board
            .get("id")
            .and_then(|id| id.as_str())
            .unwrap_or("<unknown>");
        let Some(display) = board
            .get("deviceExtensions")
            .and_then(|extensions| extensions.get("display"))
        else {
            continue;
        };
        if display.get("sizeClass").is_none() {
            return Err(format!(
                "board {board_id} display extension must declare sizeClass"
            ));
        }
    }
    Ok(())
}

pub fn validate_board_catalog(catalog: &BoardCatalog) -> Result<(), String> {
    let mut board_ids = HashSet::new();
    for board in &catalog.boards {
        if !board_ids.insert(board.id.as_str()) {
            return Err(format!("duplicate board id: {}", board.id));
        }
        if board.display_name.trim().is_empty() {
            return Err(format!("board {} displayName is empty", board.id));
        }
        if board.protocol_version == 0 {
            return Err(format!(
                "board {} protocolVersion must be positive",
                board.id
            ));
        }
    }

    validate_pin_catalogs(catalog)?;
    validate_channel_templates(catalog)?;

    let pin_catalog_ids = catalog
        .pin_catalogs
        .iter()
        .map(|pin_catalog| pin_catalog.id.as_str())
        .collect::<HashSet<_>>();
    let template_ids = catalog
        .channel_templates
        .iter()
        .map(|template| template.id.as_str())
        .collect::<HashSet<_>>();

    for board in &catalog.boards {
        if !pin_catalog_ids.contains(board.pin_catalog_id.as_str()) {
            return Err(format!(
                "board {} references missing pin catalog {}",
                board.id, board.pin_catalog_id
            ));
        }
        for template_id in &board.default_channel_template_ids {
            if !template_ids.contains(template_id.as_str()) {
                return Err(format!(
                    "board {} references missing channel template {}",
                    board.id, template_id
                ));
            }
        }
    }
    Ok(())
}

fn validate_pin_catalogs(catalog: &BoardCatalog) -> Result<(), String> {
    let mut catalog_ids = HashSet::new();
    for pin_catalog in &catalog.pin_catalogs {
        if !catalog_ids.insert(pin_catalog.id.as_str()) {
            return Err(format!("duplicate pin catalog id: {}", pin_catalog.id));
        }
        let mut pin_ids = HashSet::new();
        for pin in &pin_catalog.pins {
            if !pin_ids.insert(pin.id.as_str()) {
                return Err(format!(
                    "duplicate pin id {} in pin catalog {}",
                    pin.id, pin_catalog.id
                ));
            }
            if pin.label.trim().is_empty() {
                return Err(format!(
                    "pin {} in pin catalog {} has empty label",
                    pin.id, pin_catalog.id
                ));
            }
        }
    }
    Ok(())
}

fn validate_channel_templates(catalog: &BoardCatalog) -> Result<(), String> {
    let mut template_ids = HashSet::new();
    for template in &catalog.channel_templates {
        if !template_ids.insert(template.id.as_str()) {
            return Err(format!("duplicate channel template id: {}", template.id));
        }
        for board in &catalog.boards {
            if !board.default_channel_template_ids.contains(&template.id) {
                continue;
            }
            let Some(pin_catalog) = catalog
                .pin_catalogs
                .iter()
                .find(|pin_catalog| pin_catalog.id == board.pin_catalog_id)
            else {
                continue;
            };
            let pin_ids = pin_catalog
                .pins
                .iter()
                .map(|pin| pin.id.as_str())
                .collect::<HashSet<_>>();
            for pin_id in &template.recommended_pin_ids {
                if !pin_ids.contains(pin_id.as_str()) {
                    return Err(format!(
                        "recommended pin {} is not defined in pin catalog {}",
                        pin_id, pin_catalog.id
                    ));
                }
            }
        }
    }
    Ok(())
}
