use std::fs::OpenOptions;
use std::io::{Cursor, Write};
use std::sync::mpsc;
use std::time::Duration;

use fs2::FileExt;

use crate::app_services::custom_face_library::{
    decode_stored_group, encode_stored_group, CustomFaceImportMode, CustomFaceImportStatus,
    CustomFaceLibraryError, CustomFaceLibraryService,
};
use crate::core::custom_faces::{CustomFace, CustomFaceColor, CustomFaceFrame, CustomFaceGroup};

pub(crate) const TEST_GROUP_ID: &str = "00000000-0000-4000-8000-000000000101";
pub(crate) const TEST_FACE_ID: &str = "00000000-0000-4000-8000-000000000111";

pub(crate) fn test_custom_face_group() -> CustomFaceGroup {
    let mut first_frame = vec![0; 512];
    first_frame[4] = 1;
    let mut second_frame = first_frame.clone();
    second_frame[5] = 2;
    CustomFaceGroup {
        schema_version: 1,
        group_id: TEST_GROUP_ID.to_string(),
        name: "Test group".to_string(),
        display_profile_id: "custom-mono-128x32-v1".to_string(),
        revision: 1,
        default_face_id: TEST_FACE_ID.to_string(),
        faces: vec![CustomFace {
            face_id: TEST_FACE_ID.to_string(),
            name: "Ready".to_string(),
            color: CustomFaceColor {
                red: 0x12,
                green: 0x34,
                blue: 0x56,
            },
            frames: vec![
                CustomFaceFrame {
                    duration_ms: 200,
                    packed_pixels: first_frame,
                },
                CustomFaceFrame {
                    duration_ms: 400,
                    packed_pixels: second_frame,
                },
            ],
        }],
    }
}

fn test_library() -> CustomFaceLibraryService {
    let prefix = format!("custom-face-library-{}", uuid::Uuid::new_v4());
    CustomFaceLibraryService::new(crate::test_support::unique_temp_root(&prefix))
}

#[test]
fn storage_codec_roundtrips_group_without_pixels_in_manifest() {
    let group = test_custom_face_group();

    let encoded = encode_stored_group(&group).unwrap();
    let manifest_json = serde_json::to_string(&encoded.manifest).unwrap();

    assert!(!manifest_json.contains("packedPixels"));
    assert_eq!(
        group,
        decode_stored_group(&encoded.manifest, &encoded.frames).unwrap()
    );
}

#[test]
fn storage_codec_rejects_gap_overlap_and_trailing_bytes() {
    let group = test_custom_face_group();
    let mut encoded = encode_stored_group(&group).unwrap();
    encoded.manifest.faces[0].frames[0].offset = 1;
    assert_eq!(
        Err(CustomFaceLibraryError::InvalidFrameLayout),
        decode_stored_group(&encoded.manifest, &encoded.frames)
    );

    let mut encoded = encode_stored_group(&group).unwrap();
    encoded.frames.push(0);
    assert_eq!(
        Err(CustomFaceLibraryError::InvalidFrameLayout),
        decode_stored_group(&encoded.manifest, &encoded.frames)
    );
}

#[test]
fn library_save_load_list_and_noop_revision() {
    let service = test_library();
    let group = test_custom_face_group();

    let first = service.save_group(group.clone(), None).unwrap();
    assert_eq!(1, first.group.revision);
    let second = service
        .save_group(group, Some(&first.library_hash))
        .unwrap();

    assert_eq!(1, second.group.revision);
    assert_eq!(first.library_hash, second.library_hash);
    assert!(!second.changed);
    assert_eq!(
        second.group,
        service.load_group(&second.group.group_id).unwrap()
    );
    assert_eq!(1, service.list_groups().unwrap().len());
}

#[test]
fn library_increments_revision_and_removes_unreferenced_frames_file() {
    let service = test_library();
    let first = service.save_group(test_custom_face_group(), None).unwrap();
    let mut changed = first.group.clone();
    changed.name = "Changed name".to_string();

    let second = service
        .save_group(changed, Some(&first.library_hash))
        .unwrap();

    assert_eq!(2, second.group.revision);
    assert!(second.changed);
    let files = std::fs::read_dir(service.root().join("groups").join(&second.group.group_id))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().to_string())
        .collect::<Vec<_>>();
    assert!(files.contains(&"manifest.json".to_string()));
    assert_eq!(
        1,
        files
            .iter()
            .filter(|name| name.starts_with("frames-"))
            .count()
    );
}

#[test]
fn library_rejects_stale_save_and_delete() {
    let service = test_library();
    let saved = service.save_group(test_custom_face_group(), None).unwrap();

    assert!(matches!(
        service.save_group(saved.group.clone(), Some("00")),
        Err(CustomFaceLibraryError::Conflict { .. })
    ));
    assert!(matches!(
        service.delete_group(&saved.group.group_id, "00"),
        Err(CustomFaceLibraryError::Conflict { .. })
    ));
    service
        .delete_group(&saved.group.group_id, &saved.library_hash)
        .unwrap();
    assert!(matches!(
        service.load_group(&saved.group.group_id),
        Err(CustomFaceLibraryError::NotFound(_))
    ));
}

#[test]
fn library_save_waits_for_cross_process_group_lock() {
    let config_root = crate::test_support::unique_temp_root("custom-face-library-lock");
    let service = CustomFaceLibraryService::new(config_root.clone());
    let saved = service.save_group(test_custom_face_group(), None).unwrap();
    let locks_dir = service.root().join("locks");
    std::fs::create_dir_all(&locks_dir).unwrap();
    let lock_path = locks_dir.join(format!("{}.lock", saved.group.group_id));
    let lock_file = OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(lock_path)
        .unwrap();
    lock_file.lock_exclusive().unwrap();

    let expected_hash = saved.library_hash.clone();
    let mut changed = saved.group;
    changed.name = "Blocked update".to_string();
    let (ready_sender, ready_receiver) = mpsc::channel();
    let (sender, receiver) = mpsc::channel();
    let worker = std::thread::spawn(move || {
        let other_process = CustomFaceLibraryService::new(config_root);
        ready_sender.send(()).unwrap();
        sender
            .send(other_process.save_group(changed, Some(&expected_hash)))
            .unwrap();
    });

    ready_receiver.recv_timeout(Duration::from_secs(1)).unwrap();
    assert!(matches!(
        receiver.recv_timeout(Duration::from_secs(1)),
        Err(mpsc::RecvTimeoutError::Timeout)
    ));
    FileExt::unlock(&lock_file).unwrap();
    let result = receiver
        .recv_timeout(Duration::from_secs(2))
        .unwrap()
        .unwrap();
    worker.join().unwrap();
    assert_eq!(2, result.group.revision);
}

#[test]
fn library_list_skips_recovery_only_and_orphan_frames_directories() {
    let service = test_library();
    let recovery_only = test_custom_face_group();
    service.save_recovery(&recovery_only).unwrap();

    let mut healthy = test_custom_face_group();
    healthy.group_id = "00000000-0000-4000-8000-000000000201".to_string();
    healthy.default_face_id = "00000000-0000-4000-8000-000000000211".to_string();
    healthy.faces[0].face_id = healthy.default_face_id.clone();
    service.save_group(healthy.clone(), None).unwrap();

    let orphan_dir = service
        .root()
        .join("groups")
        .join("00000000-0000-4000-8000-000000000301");
    std::fs::create_dir_all(&orphan_dir).unwrap();
    std::fs::write(
        orphan_dir.join(format!("frames-{}.bin", "0".repeat(64))),
        b"orphan",
    )
    .unwrap();

    let groups = service.list_groups().unwrap();
    assert_eq!(1, groups.len());
    assert_eq!(healthy.group_id, groups[0].group_id);
}

#[test]
fn library_list_reports_corrupt_manifest_group_path() {
    let service = test_library();
    let group_dir = service
        .root()
        .join("groups")
        .join("00000000-0000-4000-8000-000000000401");
    std::fs::create_dir_all(&group_dir).unwrap();
    std::fs::write(group_dir.join("manifest.json"), b"{ invalid json").unwrap();

    let error = service.list_groups().unwrap_err().to_string();
    assert!(error.contains(&group_dir.to_string_lossy().to_string()));
}

#[test]
fn library_rejects_unsafe_frames_file_name_before_file_access() {
    let service = test_library();
    let saved = service.save_group(test_custom_face_group(), None).unwrap();
    let manifest_path = service
        .root()
        .join("groups")
        .join(saved.group.group_id)
        .join("manifest.json");
    let mut manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&manifest_path).unwrap()).unwrap();
    manifest["framesFile"] = serde_json::Value::String("../outside.bin".to_string());
    std::fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();

    assert!(matches!(
        service.load_group(TEST_GROUP_ID),
        Err(CustomFaceLibraryError::InvalidFramesFile(_))
    ));
}

#[cfg(unix)]
#[test]
fn library_rejects_symlinked_manifest_and_frames_files() {
    use std::os::unix::fs::symlink;

    let service = test_library();
    let saved = service.save_group(test_custom_face_group(), None).unwrap();
    let group_dir = service.root().join("groups").join(saved.group.group_id);
    let manifest_path = group_dir.join("manifest.json");
    let external_manifest = service.root().join("external-manifest.json");
    std::fs::rename(&manifest_path, &external_manifest).unwrap();
    symlink(&external_manifest, &manifest_path).unwrap();
    assert!(matches!(
        service.load_group(TEST_GROUP_ID),
        Err(CustomFaceLibraryError::InvalidFramesFile(_))
    ));

    std::fs::remove_file(&manifest_path).unwrap();
    std::fs::rename(&external_manifest, &manifest_path).unwrap();
    let manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&manifest_path).unwrap()).unwrap();
    let frames_path = group_dir.join(manifest["framesFile"].as_str().unwrap());
    let external_frames = service.root().join("external-frames.bin");
    std::fs::rename(&frames_path, &external_frames).unwrap();
    symlink(&external_frames, &frames_path).unwrap();
    assert!(matches!(
        service.load_group(TEST_GROUP_ID),
        Err(CustomFaceLibraryError::InvalidFramesFile(_))
    ));
}

#[test]
fn recovery_roundtrips_and_does_not_replace_saved_group() {
    let service = test_library();
    let saved = service.save_group(test_custom_face_group(), None).unwrap();
    let mut recovery = saved.group.clone();
    recovery.faces[0].frames[0].packed_pixels[0] = 1;

    service.save_recovery(&recovery).unwrap();

    assert_eq!(
        Some(recovery),
        service.load_recovery(&saved.group.group_id).unwrap()
    );
    assert_eq!(
        saved.group,
        service.load_group(&saved.group.group_id).unwrap()
    );
    service.clear_recovery(&saved.group.group_id).unwrap();
    service.clear_recovery(&saved.group.group_id).unwrap();
    assert_eq!(None, service.load_recovery(&saved.group.group_id).unwrap());
}

#[test]
fn ccface_export_preview_and_import_copy_preserve_or_replace_ids() {
    let source = test_library();
    let saved = source.save_group(test_custom_face_group(), None).unwrap();
    let archive = crate::test_support::unique_temp_root("ccface").join("group.ccface");
    source
        .export_group(&saved.group.group_id, &archive)
        .unwrap();
    let first_bytes = std::fs::read(&archive).unwrap();
    source
        .export_group(&saved.group.group_id, &archive)
        .unwrap();
    assert_eq!(first_bytes, std::fs::read(&archive).unwrap());

    let target = test_library();
    assert_eq!(
        CustomFaceImportStatus::New,
        target.preview_import(&archive).unwrap().status
    );
    let imported = target
        .import_group(&archive, CustomFaceImportMode::Update)
        .unwrap();
    assert_eq!(saved.group.group_id, imported.group.group_id);
    assert_eq!(
        CustomFaceImportStatus::Duplicate,
        target.preview_import(&archive).unwrap().status
    );
    let duplicate = target
        .import_group(&archive, CustomFaceImportMode::Update)
        .unwrap();
    assert!(!duplicate.changed);
    assert_eq!(imported.group.revision, duplicate.group.revision);
    let copied = target
        .import_group(&archive, CustomFaceImportMode::Copy)
        .unwrap();
    assert_ne!(saved.group.group_id, copied.group.group_id);
    assert!(copied.group.faces.iter().all(|face| !saved
        .group
        .faces
        .iter()
        .any(|source| source.face_id == face.face_id)));
    assert!(copied
        .group
        .faces
        .iter()
        .any(|face| face.face_id == copied.group.default_face_id));
}

#[test]
fn ccface_update_replaces_conflicting_group() {
    let source = test_library();
    let saved = source.save_group(test_custom_face_group(), None).unwrap();
    let archive = crate::test_support::unique_temp_root("ccface-conflict").join("group.ccface");
    source
        .export_group(&saved.group.group_id, &archive)
        .unwrap();

    let target = test_library();
    let mut conflicting = test_custom_face_group();
    conflicting.name = "Local conflict".to_string();
    target.save_group(conflicting, None).unwrap();
    assert_eq!(
        CustomFaceImportStatus::Conflict,
        target.preview_import(&archive).unwrap().status
    );

    let updated = target
        .import_group(&archive, CustomFaceImportMode::Update)
        .unwrap();
    assert_eq!(saved.group.name, updated.group.name);
    assert_eq!(2, updated.group.revision);
}

#[test]
fn ccface_rejects_duplicate_unknown_and_parent_path_entries() {
    let duplicate_archive =
        crate::test_support::unique_temp_root("duplicate-ccface").join("group.ccface");
    write_zip_entries(
        &duplicate_archive,
        &[
            ("manifest.json", b"{}".as_slice()),
            ("manifest.jsom", b"{}".as_slice()),
            ("frames.bin", b"".as_slice()),
        ],
    );
    replace_archive_entry_name(&duplicate_archive, b"manifest.jsom", b"manifest.json");
    assert!(matches!(
        test_library().preview_import(&duplicate_archive),
        Err(CustomFaceLibraryError::UnsafeArchive(_))
    ));

    for (entries, expected_error) in [
        (
            vec![
                ("manifest.json", b"{}".as_slice()),
                ("frames.bin", b"".as_slice()),
                ("evil.txt", b"evil".as_slice()),
            ],
            "unknown entry",
        ),
        (
            vec![
                ("../manifest.json", b"{}".as_slice()),
                ("frames.bin", b"".as_slice()),
                ("checksums.json", b"{}".as_slice()),
            ],
            "path is unsafe",
        ),
    ] {
        let archive = crate::test_support::unique_temp_root("unsafe-ccface").join("group.ccface");
        write_zip_entries(&archive, &entries);
        assert!(matches!(
            test_library().preview_import(&archive),
            Err(CustomFaceLibraryError::UnsafeArchive(message))
                if message.contains(expected_error)
        ));
    }
}

fn write_zip_entries(path: &std::path::Path, entries: &[(&str, &[u8])]) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let writer = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(writer);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    for (name, content) in entries {
        zip.start_file(*name, options).unwrap();
        zip.write_all(content).unwrap();
    }
    let bytes = zip.finish().unwrap().into_inner();
    std::fs::write(path, bytes).unwrap();
}

fn replace_archive_entry_name(path: &std::path::Path, from: &[u8], to: &[u8]) {
    assert_eq!(from.len(), to.len());
    let mut bytes = std::fs::read(path).unwrap();
    let mut replacements = 0;
    for index in 0..=bytes.len() - from.len() {
        if &bytes[index..index + from.len()] == from {
            bytes[index..index + to.len()].copy_from_slice(to);
            replacements += 1;
        }
    }
    assert_eq!(2, replacements);
    std::fs::write(path, bytes).unwrap();
}
