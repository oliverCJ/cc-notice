mod commands;
mod startup;
#[cfg(test)]
mod test_support;
mod utils;

pub mod adapters;
pub mod app_services;
pub mod core;
pub mod infrastructure;

use std::sync::{Arc, Mutex};

use app_services::app_config_service::AppConfigService;
use app_services::custom_internal_event_service::CustomInternalEventService;
use app_services::desktop_notice_service::DesktopNoticeService;
use app_services::device_input_service::DeviceInputService;
use app_services::device_runtime_registry::DeviceRuntimeRegistry;
use app_services::device_transport_monitor_service::DeviceTransportMonitorService;
use app_services::inbound_event_service::InboundEventService;
use app_services::local_hook_server_service::{LocalHookServerStatus, SharedHookAuthToken};
use app_services::output_executor::NativeOutputExecutor;
use app_services::profile_service::ProfileService;
use app_services::runtime_monitor::RuntimeMonitorService;
use app_services::tool_bin_service::ToolBinService;

pub use startup::run;

pub(crate) struct AppState {
    pub(crate) inbound_event_service: Arc<Mutex<InboundEventService>>,
    pub(crate) app_config_service: Mutex<AppConfigService>,
    pub(crate) profile_service: Mutex<ProfileService>,
    pub(crate) custom_internal_event_service: Mutex<CustomInternalEventService>,
    pub(crate) local_hook_server_status: Arc<Mutex<LocalHookServerStatus>>,
    pub(crate) hook_auth_token: SharedHookAuthToken,
    pub(crate) output_executor: Arc<Mutex<NativeOutputExecutor>>,
    pub(crate) device_input_service: Arc<Mutex<DeviceInputService>>,
    pub(crate) device_runtime_registry: Arc<Mutex<DeviceRuntimeRegistry>>,
    pub(crate) device_transport_monitor_service: Arc<Mutex<DeviceTransportMonitorService>>,
    pub(crate) desktop_notice_service: Mutex<DesktopNoticeService>,
    pub(crate) runtime_monitor_service: Arc<Mutex<RuntimeMonitorService>>,
    pub(crate) tool_bin_service: Mutex<ToolBinService>,
}
