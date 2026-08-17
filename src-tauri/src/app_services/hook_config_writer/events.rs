use crate::adapters::ai_tools::registry;
use crate::core::app_config::HookEventSelections;

pub(crate) fn events_for_source<'a>(
    source: &str,
    selections: &'a HookEventSelections,
) -> Result<&'a [String], String> {
    registry::ai_tool_definition(source)?;
    let events = selections.events_for_source_slice(source);
    if events.is_empty() {
        return Err(format!("hook event selection for {source} cannot be empty"));
    }
    Ok(events)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_selected_events_for_registered_sources() {
        let mut selections = HookEventSelections::default();
        selections.set_events_for_source("codex", vec!["SessionStart".to_string()]);
        selections.set_events_for_source("claude-code", vec!["Stop".to_string()]);

        assert_eq!(
            &["SessionStart".to_string()],
            events_for_source("codex", &selections).unwrap()
        );
        assert_eq!(
            &["Stop".to_string()],
            events_for_source("claude-code", &selections).unwrap()
        );
    }

    #[test]
    fn unknown_source_uses_registry_error() {
        let error = events_for_source("unknown", &HookEventSelections::default())
            .expect_err("unknown source should fail");

        assert_eq!("unknown ai tool source: unknown", error);
    }
}
