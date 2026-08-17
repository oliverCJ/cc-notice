#[cfg(not(windows))]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(not(windows))]
use std::thread;

#[cfg(not(windows))]
use signal_hook::consts::signal::{SIGINT, SIGTERM};
#[cfg(not(windows))]
use signal_hook::iterator::Signals;

#[cfg(not(windows))]
use crate::startup::window_lifecycle;

#[cfg(not(windows))]
static SHUTDOWN_SIGNAL_HANDLER_INSTALLED: AtomicBool = AtomicBool::new(false);
#[cfg(not(windows))]
const SHUTDOWN_SIGNALS: [i32; 2] = [SIGINT, SIGTERM];

#[cfg(not(windows))]
pub(crate) fn install(app: tauri::AppHandle) -> Result<(), String> {
    if SHUTDOWN_SIGNAL_HANDLER_INSTALLED.swap(true, Ordering::SeqCst) {
        tracing::warn!("shutdown signal handler already installed");
        return Ok(());
    }

    let mut signals = Signals::new(SHUTDOWN_SIGNALS)
        .map_err(|error| format!("failed to register shutdown signals: {error}"))?;
    thread::Builder::new()
        .name("cc-notice-shutdown-signal".to_string())
        .spawn(move || {
            for signal in signals.forever() {
                let reason = shutdown_reason_for_signal(signal).unwrap_or("shutdown signal");
                tracing::warn!("shutdown signal received: {reason}");
                window_lifecycle::disconnect_all_devices_for_shutdown_signal(&app, reason);
                std::process::exit(0);
            }
        })
        .map(|_| ())
        .map_err(|error| format!("failed to spawn shutdown signal handler: {error}"))
}

#[cfg(windows)]
pub(crate) fn install(_app: tauri::AppHandle) -> Result<(), String> {
    tracing::debug!("shutdown signal handler is disabled on Windows");
    Ok(())
}

#[cfg(not(windows))]
fn shutdown_reason_for_signal(signal: i32) -> Option<&'static str> {
    match signal {
        SIGINT => Some("SIGINT"),
        SIGTERM => Some("SIGTERM"),
        _ => None,
    }
}

#[cfg(not(windows))]
#[cfg(test)]
mod tests {
    use super::shutdown_reason_for_signal;

    #[test]
    fn shutdown_reason_maps_interrupt_and_terminate_signals() {
        assert_eq!(
            Some("SIGINT"),
            shutdown_reason_for_signal(signal_hook::consts::SIGINT)
        );
        assert_eq!(
            Some("SIGTERM"),
            shutdown_reason_for_signal(signal_hook::consts::SIGTERM)
        );
        assert_eq!(None, shutdown_reason_for_signal(0));
    }
}
