use crate::core::app_config::DeviceInputBinding;
use crate::AppState;

pub fn device_input_bindings_impl(state: &AppState) -> Result<Vec<DeviceInputBinding>, String> {
    let service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let config = service.config();
    Ok(config.device_input_bindings.clone())
}

pub fn save_device_input_bindings_impl(
    state: &AppState,
    bindings: Vec<DeviceInputBinding>,
) -> Result<Vec<DeviceInputBinding>, String> {
    crate::core::app_config::validate_device_input_bindings(&bindings)?;

    let mut service = state
        .app_config_service
        .lock()
        .map_err(|error| error.to_string())?;
    let mut config = service.config();
    config.device_input_bindings = bindings.clone();
    service
        .save_config(config)
        .map_err(|error| error.to_string())?;

    state
        .device_input_service
        .lock()
        .map_err(|error| error.to_string())?
        .set_bindings(bindings.clone());

    tracing::info!("device input bindings saved");
    Ok(bindings)
}
