use crate::app_services::app_update_service::{self, AppUpdateCheckResult};

#[tauri::command]
pub async fn check_for_app_update() -> Result<AppUpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    app_update_service::check_for_update(current_version).await
}
