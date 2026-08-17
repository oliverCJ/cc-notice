use std::path::Path;

use super::model::FirmwareUploadToolStatus;

const AVR_UPLOADER_TOOL_ID: &str = "cc-notice-avr-uploader";

pub fn avr_uploader_status(tool_root: &Path) -> FirmwareUploadToolStatus {
    let platform = current_platform().to_string();
    let path = tool_root.join(&platform).join(executable_name());

    FirmwareUploadToolStatus {
        tool_id: AVR_UPLOADER_TOOL_ID.to_string(),
        platform,
        path: path.to_string_lossy().to_string(),
        available: path.is_file(),
    }
}

fn current_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        "linux"
    }
}

fn executable_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "cc-notice-avr-uploader.exe"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "cc-notice-avr-uploader"
    }
}
