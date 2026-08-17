use crate::app_services::output_executor::{preview_sound_with_sender, NativeSoundSender};
use crate::app_services::sound_asset_service::{SoundAsset, SoundAssetService};
use tauri::Manager;

#[tauri::command]
pub fn sound_assets(app: tauri::AppHandle) -> Result<Vec<SoundAsset>, String> {
    let resource_dir = app.path().resource_dir().ok();
    SoundAssetService::from_default_runtime_paths(resource_dir).list_assets()
}

#[tauri::command]
pub fn preview_sound(
    app: tauri::AppHandle,
    file_path: String,
    volume_percent: u8,
    max_duration_ms: u32,
) -> Result<(), String> {
    let resource_dir = app.path().resource_dir().ok();
    preview_sound_with_sender(
        &NativeSoundSender::from_runtime_paths(resource_dir),
        file_path,
        volume_percent,
        max_duration_ms,
    )
}

#[cfg(test)]
mod tests {
    use crate::app_services::output_executor::{
        preview_sound_with_sender, SoundRequest, SoundSender,
    };
    use std::sync::Mutex;

    #[derive(Default)]
    struct RecordingSoundSender {
        played: Mutex<Vec<SoundRequest>>,
    }

    impl SoundSender for RecordingSoundSender {
        fn play(&self, request: SoundRequest) -> Result<(), String> {
            self.played.lock().expect("played lock").push(request);
            Ok(())
        }
    }

    #[test]
    fn preview_sound_builds_bounded_sound_request() {
        let sender = RecordingSoundSender::default();

        preview_sound_with_sender(&sender, "/tmp/notice.wav".to_string(), 150, 2500)
            .expect("preview should play");
        let played = sender.played.lock().expect("played lock");

        assert_eq!(1, played.len());
        assert_eq!("sound-preview", played[0].rule_id);
        assert_eq!("/tmp/notice.wav", played[0].file_path);
        assert_eq!(100, played[0].volume_percent);
        assert_eq!(2500, played[0].max_duration_ms);
    }

    #[test]
    fn preview_sound_rejects_empty_file_path() {
        let sender = RecordingSoundSender::default();

        let error = preview_sound_with_sender(&sender, "  ".to_string(), 80, 3000)
            .expect_err("empty file path should fail");

        assert_eq!("sound preview requires file_path", error);
    }
}
