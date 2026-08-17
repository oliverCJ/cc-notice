use serde_json::Value;

use crate::adapters::ai_tools::definition::HookConfigShape;
use crate::adapters::ai_tools::registry;

pub(crate) fn validate_written_config(config: &Value, source: &str) -> Result<(), String> {
    let tool = registry::ai_tool_definition(source)?;
    let hooks = config
        .get("hooks")
        .ok_or_else(|| "hook config validation failed: missing 'hooks' field".to_string())?;

    let hook_count = match tool.hook_config_shape {
        HookConfigShape::HooksObject => {
            hooks.as_object().map(|hooks| hooks.len()).ok_or_else(|| {
                "hook config validation failed: 'hooks' must be an object".to_string()
            })?
        }
        HookConfigShape::HooksArray => hooks
            .as_array()
            .map(|hooks| hooks.len())
            .ok_or_else(|| "hook config validation failed: 'hooks' must be an array".to_string())?,
    };

    tracing::debug!(
        "hook config validated: source={}, hooks={}",
        source,
        hook_count
    );
    Ok(())
}
