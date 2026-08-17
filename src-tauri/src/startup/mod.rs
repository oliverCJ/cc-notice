pub(crate) mod app_appearance;
pub mod app_startup;
pub(crate) mod shutdown_signal;
pub(crate) mod tray;
pub mod window_lifecycle;

pub use app_startup::run;
