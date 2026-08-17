use std::path::PathBuf;

use tauri::Manager;

use crate::app_services::arduino_cli_service::{ArduinoCliService, ArduinoCliStatus};
use crate::app_services::firmware_flash_service::{
    FirmwareFlashPortTarget, FirmwareFlashRequest, FirmwareFlashResult, FirmwareFlashService,
    FirmwareFlashStatus,
};
use crate::app_services::firmware_service::FirmwareService;
use crate::core::device::{
    DeviceConnectionStatus, DeviceRuntimeState, DeviceTransportConfig, DeviceTransportKind,
};
use crate::core::firmware::{FirmwareCatalog, FirmwareManifest};
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;
use crate::AppState;

use std::collections::HashSet;

const FIRMWARE_MANIFEST_JSON: &str = include_str!("../../assets/firmware/manifest.json");

#[tauri::command]
pub fn firmware_flash_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    artifact_id: String,
) -> Result<FirmwareFlashStatus, String> {
    firmware_flash_status_impl(
        app.path().resource_dir().ok(),
        artifact_id,
        arduino_cli_path(&state)?,
    )
}

pub(crate) fn firmware_flash_status_impl(
    resource_dir: Option<PathBuf>,
    artifact_id: String,
    arduino_cli_path: Option<String>,
) -> Result<FirmwareFlashStatus, String> {
    firmware_flash_service(resource_dir, arduino_cli_path)?.status(&artifact_id)
}

#[tauri::command]
pub fn flash_firmware(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: FirmwareFlashRequest,
) -> Result<FirmwareFlashResult, String> {
    let target_transport = selected_flash_target_transport(&request)?;
    flash_firmware_impl(
        app.path().resource_dir().ok(),
        request,
        arduino_cli_path(&state)?,
        target_transport,
    )
}

pub(crate) fn flash_firmware_impl(
    resource_dir: Option<PathBuf>,
    request: FirmwareFlashRequest,
    arduino_cli_path: Option<String>,
    target_transport: Option<DeviceTransportConfig>,
) -> Result<FirmwareFlashResult, String> {
    firmware_flash_service(resource_dir, arduino_cli_path)?.flash(&request, target_transport)
}

#[tauri::command]
pub fn arduino_cli_status(state: tauri::State<'_, AppState>) -> Result<ArduinoCliStatus, String> {
    Ok(ArduinoCliService::new(arduino_cli_path(&state)?).status())
}

#[tauri::command]
pub fn firmware_flash_targets(
    state: tauri::State<'_, AppState>,
    artifact_id: String,
) -> Result<Vec<FirmwareFlashPortTarget>, String> {
    if !firmware_artifact_requires_port_targets(&artifact_id)? {
        return Ok(Vec::new());
    }
    let ports = crate::commands::device::scan_device_transports_impl()?;
    let runtime_states = state
        .device_runtime_registry
        .lock()
        .map_err(|error| error.to_string())?
        .states();
    firmware_flash_targets_impl(artifact_id, ports, runtime_states)
}

pub(crate) fn firmware_flash_targets_impl(
    artifact_id: String,
    ports: Vec<DevicePortDescriptor>,
    runtime_states: Vec<DeviceRuntimeState>,
) -> Result<Vec<FirmwareFlashPortTarget>, String> {
    let manifest = firmware_manifest()?;
    let service = FirmwareService::new(manifest);
    let artifact = service
        .find_by_artifact_id(&artifact_id)
        .ok_or_else(|| format!("firmware artifact not found: {artifact_id}"))?;

    if artifact.flash_strategy != "arduino_cli_upload" {
        return Ok(Vec::new());
    }

    let occupied_serial_ports = occupied_serial_ports(runtime_states);
    Ok(ports
        .into_iter()
        .filter(|port| port.transport_kind == DeviceTransportKind::Serial)
        .filter(|port| !occupied_serial_ports.contains(&port.address))
        .map(serial_port_target)
        .collect())
}

fn firmware_artifact_requires_port_targets(artifact_id: &str) -> Result<bool, String> {
    let manifest = firmware_manifest()?;
    let service = FirmwareService::new(manifest);
    let artifact = service
        .find_by_artifact_id(artifact_id)
        .ok_or_else(|| format!("firmware artifact not found: {artifact_id}"))?;

    Ok(artifact.flash_strategy == "arduino_cli_upload")
}

#[tauri::command]
pub fn firmware_catalog() -> Result<FirmwareCatalog, String> {
    firmware_catalog_impl()
}

fn serial_port_target(port: DevicePortDescriptor) -> FirmwareFlashPortTarget {
    FirmwareFlashPortTarget {
        target_id: port.id,
        display_name: port.address.clone(),
        transport: DeviceTransportConfig::serial(&port.address, 115200),
    }
}

fn occupied_serial_ports(runtime_states: Vec<DeviceRuntimeState>) -> HashSet<String> {
    runtime_states
        .into_iter()
        .filter(|state| state.status == DeviceConnectionStatus::Connected)
        .filter_map(|state| state.transport)
        .filter(|transport| transport.kind == DeviceTransportKind::Serial)
        .filter_map(|transport| transport.serial_port)
        .collect()
}

pub(crate) fn firmware_catalog_impl() -> Result<FirmwareCatalog, String> {
    let manifest = firmware_manifest()?;
    Ok(FirmwareService::new(manifest).catalog())
}

fn firmware_flash_service(
    resource_dir: Option<PathBuf>,
    arduino_cli_path: Option<String>,
) -> Result<FirmwareFlashService, String> {
    let manifest = firmware_manifest()?;
    Ok(FirmwareFlashService::new(
        manifest,
        firmware_root(resource_dir.clone()),
        firmware_upload_tool_root(resource_dir),
        default_mount_roots(),
        arduino_cli_path,
    ))
}

fn arduino_cli_path(state: &tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(service.config().arduino_cli_path)
}

fn selected_flash_target_transport(
    request: &FirmwareFlashRequest,
) -> Result<Option<DeviceTransportConfig>, String> {
    let Some(target_id) = &request.target_id else {
        return Ok(None);
    };
    let targets = firmware_flash_targets_impl(
        request.artifact_id.clone(),
        crate::commands::device::scan_device_transports_impl()?,
        Vec::new(),
    )?;
    let target = targets
        .into_iter()
        .find(|target| &target.target_id == target_id)
        .ok_or_else(|| "选择的烧录串口不可用，请刷新后重试".to_string())?;
    Ok(Some(target.transport))
}

pub(crate) fn firmware_manifest() -> Result<FirmwareManifest, String> {
    let manifest: FirmwareManifest = serde_json::from_str(FIRMWARE_MANIFEST_JSON)
        .map_err(|error| format!("failed to parse firmware manifest: {error}"))?;
    manifest.validate()?;
    Ok(manifest)
}

fn firmware_root(resource_dir: Option<PathBuf>) -> PathBuf {
    resource_dir
        .map(|dir| dir.join("assets"))
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets"))
        .join("firmware")
}

fn firmware_upload_tool_root(resource_dir: Option<PathBuf>) -> PathBuf {
    resource_dir
        .map(|dir| dir.join("assets"))
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets"))
        .join("tools")
        .join("firmware-upload")
}

fn default_mount_roots() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        vec![PathBuf::from("/Volumes")]
    }

    #[cfg(target_os = "windows")]
    {
        windows_drive_roots()
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let mut roots = vec![PathBuf::from("/media"), PathBuf::from("/mnt")];
        if let Some(user) = std::env::var_os("USER") {
            roots.push(PathBuf::from("/run/media").join(user));
        }
        roots
    }
}

#[cfg(target_os = "windows")]
fn windows_drive_roots() -> Vec<PathBuf> {
    ('A'..='Z')
        .map(|letter| PathBuf::from(format!("{letter}:\\")))
        .filter(|root| root.is_dir())
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::core::device::{
        DeviceConnectionStatus, DeviceFirmwareStatus, DeviceHeartbeatStatus, DeviceRuntimeState,
        DeviceTransportConfig,
    };

    use super::{firmware_flash_status_impl, firmware_root, firmware_upload_tool_root};

    #[test]
    fn firmware_root_uses_bundled_resource_assets_when_available() {
        let root = std::path::PathBuf::from("/Applications/CC Notice.app/Contents/Resources");

        let firmware_root = firmware_root(Some(root));

        assert_eq!(
            std::path::Path::new("/Applications/CC Notice.app/Contents/Resources/assets/firmware"),
            firmware_root.as_path()
        );
    }

    #[test]
    fn firmware_upload_tool_root_uses_bundled_resource_assets_when_available() {
        let root = std::path::PathBuf::from("/Applications/CC Notice.app/Contents/Resources");

        let tool_root = firmware_upload_tool_root(Some(root));

        assert_eq!(
            std::path::Path::new(
                "/Applications/CC Notice.app/Contents/Resources/assets/tools/firmware-upload"
            ),
            tool_root.as_path()
        );
    }

    #[test]
    fn firmware_status_reports_artifact_metadata() {
        let status = firmware_flash_status_impl(
            None,
            "local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2".to_string(),
            None,
        )
        .expect("status should load manifest");

        assert_eq!(
            "local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2",
            status.artifact_id
        );
        assert_eq!("rp2040-pico", status.board_id);
        assert_eq!("cc-notice-rp2040-pico.uf2", status.artifact_name);
    }

    #[test]
    fn firmware_flash_targets_returns_serial_ports_for_arduino_artifacts() {
        let targets = super::firmware_flash_targets_impl(
            "local-bundled:arduino-leonardo:0.2.0:cc-notice-arduino-leonardo.hex".to_string(),
            vec![
                crate::infrastructure::transports::descriptor::DevicePortDescriptor {
                    id: "serial:/dev/cu.usbmodem1".to_string(),
                    display_name: "cu.usbmodem1".to_string(),
                    transport_kind: crate::core::device::DeviceTransportKind::Serial,
                    address: "/dev/cu.usbmodem1".to_string(),
                    stable_device_uid: None,
                    stable_device_uid_candidates: Vec::new(),
                },
            ],
            Vec::new(),
        )
        .expect("arduino flash targets should be returned");

        assert_eq!(1, targets.len());
        assert_eq!("serial:/dev/cu.usbmodem1", targets[0].target_id);
        assert_eq!("/dev/cu.usbmodem1", targets[0].display_name);
        assert_eq!(
            Some("/dev/cu.usbmodem1".to_string()),
            targets[0].transport.serial_port
        );
    }

    #[test]
    fn firmware_flash_targets_excludes_connected_runtime_serial_ports() {
        let targets = super::firmware_flash_targets_impl(
            "local-bundled:arduino-leonardo:0.2.0:cc-notice-arduino-leonardo.hex".to_string(),
            vec![
                crate::infrastructure::transports::descriptor::DevicePortDescriptor {
                    id: "serial:/dev/cu.usbmodem1".to_string(),
                    display_name: "Raspberry Pi Pico (cu.usbmodem1)".to_string(),
                    transport_kind: crate::core::device::DeviceTransportKind::Serial,
                    address: "/dev/cu.usbmodem1".to_string(),
                    stable_device_uid: None,
                    stable_device_uid_candidates: Vec::new(),
                },
                crate::infrastructure::transports::descriptor::DevicePortDescriptor {
                    id: "serial:/dev/cu.usbmodem2".to_string(),
                    display_name: "Arduino Leonardo (cu.usbmodem2)".to_string(),
                    transport_kind: crate::core::device::DeviceTransportKind::Serial,
                    address: "/dev/cu.usbmodem2".to_string(),
                    stable_device_uid: None,
                    stable_device_uid_candidates: Vec::new(),
                },
            ],
            vec![connected_serial_state("/dev/cu.usbmodem1")],
        )
        .expect("arduino flash targets should be returned");

        assert_eq!(1, targets.len());
        assert_eq!("/dev/cu.usbmodem2", targets[0].display_name);
    }

    #[test]
    fn firmware_flash_targets_returns_no_serial_ports_for_uf2_artifacts() {
        let targets = super::firmware_flash_targets_impl(
            "local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2".to_string(),
            vec![
                crate::infrastructure::transports::descriptor::DevicePortDescriptor {
                    id: "serial:/dev/cu.usbmodem1".to_string(),
                    display_name: "cu.usbmodem1".to_string(),
                    transport_kind: crate::core::device::DeviceTransportKind::Serial,
                    address: "/dev/cu.usbmodem1".to_string(),
                    stable_device_uid: None,
                    stable_device_uid_candidates: Vec::new(),
                },
            ],
            Vec::new(),
        )
        .expect("uf2 flash targets should be returned");

        assert!(targets.is_empty());
    }

    fn connected_serial_state(serial_port: &str) -> DeviceRuntimeState {
        DeviceRuntimeState {
            device_id: Some("desk-device".to_string()),
            device_uid: None,
            status: DeviceConnectionStatus::Connected,
            board_id: Some("rp2040-pico".to_string()),
            transport: Some(DeviceTransportConfig::serial(serial_port, 115200)),
            channels: Vec::new(),
            firmware_info: None,
            bundled_firmware_version: None,
            firmware_status: DeviceFirmwareStatus::Unknown,
            firmware_check_error: None,
            heartbeat_status: DeviceHeartbeatStatus::Unknown,
            last_heartbeat_at: None,
            heartbeat_failure_count: 0,
            manual_reconnect_suppressed: false,
            matched_resource_id: None,
            last_discovered_at: None,
            active_operation: None,
            auto_reconnect_blocked_until: None,
            last_ack: None,
            last_error_code: None,
            last_error: None,
            last_sent_at: None,
        }
    }
}
