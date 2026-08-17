pub(crate) mod actions;
pub(crate) mod menu;
pub(crate) mod model;
pub(crate) mod snapshot;
pub(crate) mod text;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tauri::{App, AppHandle, Manager, Runtime};

use self::actions::handle_tray_action;
use self::menu::native_tray_menu;
use self::model::TrayMenuAction;
use self::snapshot::tray_status_snapshot;
use self::text::tray_menu_model;
use crate::startup::window_lifecycle;
use crate::AppState;

const TRAY_ID: &str = "cc-notice-tray";
const TRAY_ICON_RESOURCE_PATH: &str = "icons/tray-icon.png";
static TRAY_AVAILABLE: AtomicBool = AtomicBool::new(false);
static TRAY_ACTIONS: OnceLock<Arc<Mutex<BTreeMap<String, TrayMenuAction>>>> = OnceLock::new();

pub(crate) fn is_tray_available() -> bool {
    TRAY_AVAILABLE.load(Ordering::SeqCst)
}

pub(crate) fn setup_system_tray(app: &mut App) -> Result<(), String> {
    TRAY_AVAILABLE.store(false, Ordering::SeqCst);
    window_lifecycle::reset_exit_disconnect_guard();

    let state = app
        .try_state::<AppState>()
        .ok_or_else(|| "app state is unavailable while setting up tray".to_string())?;
    let snapshot = tray_status_snapshot(&state);
    let model = tray_menu_model(&snapshot);
    let native_menu = native_tray_menu(app, &model)?;
    let actions = tray_actions();
    replace_tray_actions(&actions, native_menu.actions);
    let icon = tray_icon(app)?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip("CC Notice")
        .menu(&native_menu.menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            let action = action_for_event(&actions, event.id.as_ref());
            if let Some(action) = action {
                handle_tray_action(app, action);
            }
        })
        .build(app)
        .map_err(|error| error.to_string())?;
    TRAY_AVAILABLE.store(true, Ordering::SeqCst);

    Ok(())
}

pub(crate) fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<bool, String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        tracing::warn!("tray icon not found while refreshing menu");
        return Ok(false);
    };
    let Some(state) = app.try_state::<AppState>() else {
        return Err("app state is unavailable while refreshing tray".to_string());
    };

    let snapshot = tray_status_snapshot(&state);
    let model = tray_menu_model(&snapshot);
    let native_menu = native_tray_menu(app, &model)?;
    replace_tray_actions(&tray_actions(), native_menu.actions);
    tray.set_menu(Some(native_menu.menu))
        .map_err(|error| error.to_string())?;
    Ok(true)
}

pub(crate) fn refresh_tray_menu_after_state_change<R: Runtime>(app: &AppHandle<R>, reason: &str) {
    match refresh_tray_menu(app) {
        Ok(true) => {}
        Ok(false) => {
            tracing::warn!("tray menu refresh skipped after {reason} because tray is unavailable")
        }
        Err(error) => tracing::warn!("failed to refresh tray menu after {reason}: {error}"),
    }
}

fn tray_actions() -> Arc<Mutex<BTreeMap<String, TrayMenuAction>>> {
    TRAY_ACTIONS
        .get_or_init(|| Arc::new(Mutex::new(BTreeMap::new())))
        .clone()
}

fn replace_tray_actions(
    actions: &Arc<Mutex<BTreeMap<String, TrayMenuAction>>>,
    next_actions: BTreeMap<String, TrayMenuAction>,
) {
    match actions.lock() {
        Ok(mut actions) => {
            *actions = next_actions;
        }
        Err(error) => tracing::warn!("failed to update tray action map: {error}"),
    }
}

pub(crate) fn action_for_event(
    actions: &Arc<Mutex<BTreeMap<String, TrayMenuAction>>>,
    event_id: &str,
) -> Option<TrayMenuAction> {
    actions
        .lock()
        .map(|actions| actions.get(event_id).copied())
        .unwrap_or_else(|error| {
            tracing::warn!("failed to lock tray action map: {error}");
            None
        })
}

fn tray_icon(app: &App) -> Result<Image<'static>, String> {
    let resource_dir = app.path().resource_dir().ok();
    for path in tray_icon_candidate_paths(resource_dir.as_deref()) {
        match Image::from_path(&path) {
            Ok(icon) => return Ok(icon),
            Err(error) => {
                tracing::warn!("failed to load tray icon from {}: {error}", path.display());
            }
        }
    }

    app.default_window_icon()
        .ok_or_else(|| "default window icon is unavailable".to_string())
        .map(|icon| icon.clone().to_owned())
}

fn tray_icon_candidate_paths(resource_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(resource_dir) = resource_dir {
        candidates.push(resource_dir.join(TRAY_ICON_RESOURCE_PATH));
    }
    candidates.push(Path::new(env!("CARGO_MANIFEST_DIR")).join(TRAY_ICON_RESOURCE_PATH));
    candidates
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::sync::{Arc, Mutex};

    use crate::startup::tray::model::TrayMenuAction;

    #[test]
    fn tray_icon_candidates_prefer_packaged_resource_then_development_asset() {
        let resource_dir = std::path::Path::new("/Applications/CC Notice.app/Contents/Resources");
        let candidates = super::tray_icon_candidate_paths(Some(resource_dir));

        assert_eq!(
            std::path::Path::new(
                "/Applications/CC Notice.app/Contents/Resources/icons/tray-icon.png"
            ),
            candidates[0].as_path()
        );
        assert!(candidates
            .get(1)
            .expect("development asset candidate should exist")
            .ends_with("icons/tray-icon.png"));
    }

    #[test]
    fn action_for_event_returns_none_for_unknown_menu_id() {
        let actions = Arc::new(Mutex::new(BTreeMap::from([(
            "known".to_string(),
            TrayMenuAction::ShowMainWindow,
        )])));

        assert_eq!(None, super::action_for_event(&actions, "missing"));
    }
}
