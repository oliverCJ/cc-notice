use std::collections::BTreeMap;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{Manager, Runtime};

use super::model::{TrayMenuAction, TrayMenuEntry, TrayMenuModel};

pub(crate) struct NativeTrayMenu<R: Runtime> {
    pub(crate) menu: Menu<R>,
    pub(crate) actions: BTreeMap<String, TrayMenuAction>,
}

pub(crate) fn native_tray_menu<R: Runtime, M: Manager<R>>(
    app: &M,
    model: &TrayMenuModel,
) -> Result<NativeTrayMenu<R>, String> {
    let menu = Menu::new(app).map_err(|error| error.to_string())?;
    let mut actions = BTreeMap::new();

    for (index, entry) in model.entries.iter().enumerate() {
        match entry {
            TrayMenuEntry::Title(label) | TrayMenuEntry::Status(label) => {
                let item = MenuItem::with_id(
                    app,
                    format!("tray-status-{index}"),
                    label,
                    false,
                    None::<&str>,
                )
                .map_err(|error| error.to_string())?;
                menu.append(&item).map_err(|error| error.to_string())?;
            }
            TrayMenuEntry::Action { id, label, action } => {
                let item = MenuItem::with_id(app, *id, label, true, None::<&str>)
                    .map_err(|error| error.to_string())?;
                menu.append(&item).map_err(|error| error.to_string())?;
                actions.insert((*id).to_string(), *action);
            }
            TrayMenuEntry::Separator => {
                let item = PredefinedMenuItem::separator(app).map_err(|error| error.to_string())?;
                menu.append(&item).map_err(|error| error.to_string())?;
            }
        }
    }

    Ok(NativeTrayMenu { menu, actions })
}
