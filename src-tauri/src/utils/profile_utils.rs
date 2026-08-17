use crate::core::app_config::HookEventSelections;
use crate::core::profiles::EnabledHookEvent;

pub fn generate_profile_id(profile_name: &str) -> String {
    let base_id = profile_name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c
            } else if c.is_ascii_punctuation() || c.is_whitespace() {
                '-'
            } else {
                '\0'
            }
        })
        .filter(|c| *c != '\0')
        .collect::<String>();

    let normalized = base_id
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if normalized.is_empty() || normalized.len() < 3 {
        format!(
            "profile-{}",
            uuid::Uuid::new_v4().to_string().split('-').next().unwrap()
        )
    } else {
        format!(
            "{}-{}",
            normalized,
            uuid::Uuid::new_v4().to_string().split('-').next().unwrap()
        )
    }
}

pub fn hook_events_from_selections(selections: &HookEventSelections) -> Vec<EnabledHookEvent> {
    crate::adapters::ai_tools::registry::all_ai_tools()
        .into_iter()
        .flat_map(|tool| {
            selections
                .events_for_source(tool.source)
                .into_iter()
                .map(move |event| EnabledHookEvent {
                    source: tool.source.to_string(),
                    event,
                })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::core::app_config::HookEventSelections;

    use super::{generate_profile_id, hook_events_from_selections};

    #[test]
    fn generate_profile_id_creates_kebab_case_with_suffix() {
        let id = generate_profile_id("Deep Focus Mode");

        assert!(id.starts_with("deep-focus-mode-"));
        assert!(id.len() > "deep-focus-mode-".len());
        assert!(id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'));
    }

    #[test]
    fn generate_profile_id_handles_non_ascii_name() {
        let id = generate_profile_id("专注模式");

        assert!(id.starts_with("profile-"));
        assert!(id.len() > "profile-".len());
    }

    #[test]
    fn generate_profile_id_normalizes_special_characters() {
        let id = generate_profile_id("Work/Home Mode!");

        assert!(id.starts_with("work-home-mode-"));
    }

    #[test]
    fn generate_profile_id_handles_empty_name() {
        let id = generate_profile_id("");

        assert!(id.starts_with("profile-"));
    }

    #[test]
    fn generate_profile_id_handles_whitespace_only() {
        let id = generate_profile_id("   ");

        assert!(id.starts_with("profile-"));
    }

    #[test]
    fn hook_events_from_selections_converts_selected_events_by_source() {
        let mut selections = HookEventSelections::default();
        selections.set_events_for_source(
            "codex",
            vec!["SessionStart".to_string(), "Stop".to_string()],
        );

        let events = hook_events_from_selections(&selections);

        assert!(events
            .iter()
            .any(|event| event.source == "codex" && event.event == "SessionStart"));
        assert!(events
            .iter()
            .any(|event| event.source == "codex" && event.event == "Stop"));
    }
}
