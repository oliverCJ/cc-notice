use std::collections::HashSet;
use std::path::Path;
use std::process::{Command, Output};
use std::thread;
use std::time::{Duration, Instant};

use crate::app_services::arduino_cli_service::ArduinoCliService;
use crate::core::device::DeviceTransportConfig;
use crate::core::firmware::{FirmwareArtifact, FirmwareUploadConfig};

use super::{
    FirmwareFlashContext, FirmwareFlashRequest, FirmwareFlashResult, FirmwareFlashStatus,
    FirmwareFlashTarget,
};

pub fn status(
    artifact_id: &str,
    artifact: &FirmwareArtifact,
    context: &FirmwareFlashContext,
) -> Result<FirmwareFlashStatus, String> {
    let cli_status = ArduinoCliService::new(context.arduino_cli_path.clone()).status();

    Ok(FirmwareFlashStatus {
        artifact_id: artifact_id.to_string(),
        board_id: artifact.board_id.clone(),
        artifact_name: artifact.artifact_name.clone(),
        artifact_type: artifact.artifact_type.clone(),
        flash_strategy: artifact.flash_strategy.clone(),
        ready: cli_status.available,
        target: None,
        upload_tool: None,
        arduino_cli: Some(cli_status),
    })
}

pub fn flash(
    request: &FirmwareFlashRequest,
    artifact: &FirmwareArtifact,
    firmware_root: &Path,
    context: &FirmwareFlashContext,
    target_transport: Option<DeviceTransportConfig>,
) -> Result<FirmwareFlashResult, String> {
    let upload = artifact
        .upload
        .as_ref()
        .ok_or_else(|| "Arduino 固件缺少上传参数".to_string())?;
    let serial_port = target_transport
        .and_then(|transport| transport.serial_port)
        .or_else(|| {
            request
                .target_id
                .as_ref()
                .and_then(serial_port_from_target_id)
        })
        .ok_or_else(|| "请选择烧录串口".to_string())?;
    let artifact_path = firmware_root.join(&artifact.relative_path);
    if !artifact_path.is_file() {
        return Err(format!(
            "固件产物不存在：{}",
            artifact_path.to_string_lossy()
        ));
    }

    let cli_service = ArduinoCliService::new(context.arduino_cli_path.clone());
    let command_path = cli_service.command_path();
    let upload_serial_port = prepare_serial_port_for_upload(upload, &serial_port)?;
    let args = upload_args(upload, &upload_serial_port, &artifact_path);
    tracing::info!(
        command = %command_path.to_string_lossy(),
        args = ?args,
        "starting arduino cli firmware upload"
    );

    let output = run_arduino_cli_upload_command(&command_path, &args)?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.success() {
        tracing::info!(stdout = %stdout, stderr = %stderr, "arduino cli firmware upload completed");
        return Ok(FirmwareFlashResult {
            artifact_id: request.artifact_id.clone(),
            board_id: artifact.board_id.clone(),
            artifact_name: artifact.artifact_name.clone(),
            target: FirmwareFlashTarget {
                mount_path: serial_port,
                volume_name: "serial".to_string(),
            },
            copied_bytes: 0,
        });
    }

    tracing::warn!(stdout = %stdout, stderr = %stderr, "arduino cli firmware upload failed");
    Err(format!(
        "Arduino CLI 烧录失败：{}",
        upload_error_summary(&stderr)
    ))
}

pub(crate) fn upload_args(
    upload: &FirmwareUploadConfig,
    serial_port: &str,
    artifact_path: &Path,
) -> Vec<String> {
    vec![
        "upload".to_string(),
        "-p".to_string(),
        serial_port.to_string(),
        "-b".to_string(),
        fqbn_with_options(upload),
        "-i".to_string(),
        artifact_path.to_string_lossy().to_string(),
    ]
}

fn fqbn_with_options(upload: &FirmwareUploadConfig) -> String {
    if upload.board_options.is_empty() {
        return upload.fqbn.clone();
    }

    let options = upload
        .board_options
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join(",");
    if upload.fqbn.contains('=') {
        format!("{},{options}", upload.fqbn)
    } else {
        format!("{}:{options}", upload.fqbn)
    }
}

fn serial_port_from_target_id(target_id: &String) -> Option<String> {
    target_id.strip_prefix("serial:").map(ToString::to_string)
}

fn prepare_serial_port_for_upload(
    upload: &FirmwareUploadConfig,
    serial_port: &str,
) -> Result<String, String> {
    if !upload.requires_1200bps_reset {
        return Ok(serial_port.to_string());
    }

    let ports_before_reset = available_serial_port_names();
    touch_1200bps_reset(serial_port)?;
    let bootloader_port = wait_for_bootloader_serial_port(
        serial_port,
        &ports_before_reset,
        Duration::from_millis(upload.bootloader_wait_ms),
    );
    if bootloader_port != serial_port {
        tracing::info!(
            selected_port = %serial_port,
            bootloader_port = %bootloader_port,
            "selected bootloader serial port after 1200bps reset"
        );
    }
    Ok(bootloader_port)
}

fn touch_1200bps_reset(serial_port: &str) -> Result<(), String> {
    let mut port = serialport::new(serial_port, 1200)
        .timeout(Duration::from_millis(250))
        .open()
        .map_err(|error| format!("无法以 1200bps 打开烧录串口触发 bootloader：{error}"))?;
    let _ = port.write_data_terminal_ready(false);
    let _ = port.write_request_to_send(false);
    drop(port);
    thread::sleep(Duration::from_millis(250));
    Ok(())
}

fn wait_for_bootloader_serial_port(
    original_port: &str,
    ports_before_reset: &[String],
    wait_duration: Duration,
) -> String {
    let deadline = Instant::now() + wait_duration;
    let mut last_ports = available_serial_port_names();
    loop {
        let selected =
            select_bootloader_serial_port(original_port, ports_before_reset, &last_ports);
        if selected != original_port {
            return selected;
        }
        if Instant::now() >= deadline {
            return selected;
        }
        thread::sleep(Duration::from_millis(100));
        last_ports = available_serial_port_names();
    }
}

fn available_serial_port_names() -> Vec<String> {
    serialport::available_ports()
        .map(|ports| ports.into_iter().map(|port| port.port_name).collect())
        .unwrap_or_default()
}

fn select_bootloader_serial_port(
    original_port: &str,
    ports_before_reset: &[String],
    ports_after_reset: &[String],
) -> String {
    let before = ports_before_reset.iter().collect::<HashSet<_>>();
    let mut new_ports = ports_after_reset
        .iter()
        .filter(|port| !before.contains(port))
        .collect::<Vec<_>>();
    new_ports.sort_by_key(|port| serial_upload_port_score(port));

    new_ports
        .first()
        .map(|port| (*port).clone())
        .or_else(|| {
            ports_after_reset
                .iter()
                .find(|port| port.as_str() == original_port)
                .cloned()
        })
        .unwrap_or_else(|| original_port.to_string())
}

fn serial_upload_port_score(port: &str) -> u8 {
    if is_windows_com_port(port) {
        return 0;
    }
    if port.starts_with("/dev/cu.usbmodem") {
        return 0;
    }
    if port.starts_with("/dev/cu.") {
        return 1;
    }
    if port.contains("usbmodem") {
        return 2;
    }
    if port.contains("usbserial") {
        return 3;
    }
    4
}

fn is_windows_com_port(port: &str) -> bool {
    let Some(number) = port.strip_prefix("COM") else {
        return false;
    };
    !number.is_empty() && number.chars().all(|ch| ch.is_ascii_digit())
}

fn run_arduino_cli_upload_command(command_path: &Path, args: &[String]) -> Result<Output, String> {
    let mut command = Command::new(command_path);
    command.args(args);
    configure_arduino_cli_command(&mut command);
    arduino_cli_command_output(command)
}

#[cfg(target_os = "windows")]
fn configure_arduino_cli_command(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn configure_arduino_cli_command(_command: &mut Command) {}

fn arduino_cli_command_output(mut command: Command) -> Result<Output, String> {
    command.output().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "未检测到 Arduino CLI。请在设置中配置 arduino-cli 路径，或确认它已经加入系统 PATH。"
                .to_string()
        } else {
            format!("无法启动 Arduino CLI：{error}")
        }
    })
}

fn upload_error_summary(stderr: &str) -> String {
    stderr
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("请检查串口、板型和 Arduino CLI 环境")
        .to_string()
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::path::Path;

    use crate::core::firmware::FirmwareUploadConfig;

    #[test]
    fn upload_args_include_fqbn_board_options_port_and_artifact() {
        let upload = FirmwareUploadConfig {
            fqbn: "arduino:avr:nano".to_string(),
            protocol: "arduino".to_string(),
            speed: 57600,
            requires_1200bps_reset: false,
            bootloader_wait_ms: 2000,
            board_options: BTreeMap::from([("cpu".to_string(), "atmega328old".to_string())]),
        };

        let args = super::upload_args(
            &upload,
            "/dev/cu.usbserial-14110",
            Path::new("/tmp/cc-notice-arduino-nano.hex"),
        );

        assert_eq!(
            args,
            vec![
                "upload",
                "-p",
                "/dev/cu.usbserial-14110",
                "-b",
                "arduino:avr:nano:cpu=atmega328old",
                "-i",
                "/tmp/cc-notice-arduino-nano.hex"
            ]
        );
    }

    #[test]
    fn upload_args_append_board_options_with_comma_when_fqbn_already_has_options() {
        let upload = FirmwareUploadConfig {
            fqbn: "STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C6".to_string(),
            protocol: "serial".to_string(),
            speed: 115200,
            requires_1200bps_reset: false,
            bootloader_wait_ms: 2000,
            board_options: BTreeMap::from([(
                "upload_method".to_string(),
                "serialMethod".to_string(),
            )]),
        };

        let args = super::upload_args(
            &upload,
            "/dev/cu.usbserial-14110",
            Path::new("/tmp/cc-notice-stm32f103cx-blue-pill.bin"),
        );

        assert_eq!(
            args,
            vec![
                "upload",
                "-p",
                "/dev/cu.usbserial-14110",
                "-b",
                "STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C6,upload_method=serialMethod",
                "-i",
                "/tmp/cc-notice-stm32f103cx-blue-pill.bin"
            ]
        );
    }

    #[test]
    fn bootloader_port_selection_prefers_new_port_after_1200bps_reset() {
        let selected_port = super::select_bootloader_serial_port(
            "/dev/cu.usbmodem1101",
            &["/dev/cu.usbmodem1101".to_string()],
            &["/dev/cu.usbmodem1201".to_string()],
        );

        assert_eq!("/dev/cu.usbmodem1201", selected_port);
    }

    #[test]
    fn bootloader_port_selection_prefers_new_windows_com_port_after_1200bps_reset() {
        let selected_port = super::select_bootloader_serial_port(
            "COM3",
            &["COM3".to_string()],
            &["BluetoothPort".to_string(), "COM7".to_string()],
        );

        assert_eq!("COM7", selected_port);
    }
}
