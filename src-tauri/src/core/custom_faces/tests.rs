use std::collections::BTreeMap;

use uuid::Uuid;

use super::{
    compile_group, decode_face_blob, decode_rle, encode_rle, face_runtime_hash, group_runtime_hash,
    library_hash, package_hash, parse_face_blob, parse_manifest, plan_update, validate_group,
    CustomFace, CustomFaceColor, CustomFaceCompileError, CustomFaceFrame, CustomFaceGroup,
    CustomFaceValidationError, RleError, TransferMode,
};

const GROUP_ID: &str = "00000000-0000-4000-8000-000000000001";
const FACE_ID_1: &str = "00000000-0000-4000-8000-000000000011";
const FACE_ID_2: &str = "00000000-0000-4000-8000-000000000012";
const FACE_ID_3: &str = "00000000-0000-4000-8000-000000000013";

fn test_face(face_id: &str, name: &str, frame_count: usize, framebuffer_size: usize) -> CustomFace {
    CustomFace {
        face_id: face_id.to_string(),
        name: name.to_string(),
        color: CustomFaceColor {
            red: 0x12,
            green: 0x34,
            blue: 0x56,
        },
        frames: (0..frame_count)
            .map(|_| CustomFaceFrame {
                duration_ms: 200,
                packed_pixels: vec![0; framebuffer_size],
            })
            .collect(),
    }
}

fn test_group(
    profile_id: &str,
    face_count: usize,
    frame_count: usize,
    framebuffer_size: usize,
) -> CustomFaceGroup {
    let face_ids = [FACE_ID_1, FACE_ID_2];
    CustomFaceGroup {
        schema_version: 1,
        group_id: GROUP_ID.to_string(),
        name: "Test group".to_string(),
        display_profile_id: profile_id.to_string(),
        revision: 1,
        default_face_id: FACE_ID_1.to_string(),
        faces: (0..face_count)
            .map(|index| {
                test_face(
                    face_ids[index],
                    &format!("Face {}", index + 1),
                    frame_count,
                    framebuffer_size,
                )
            })
            .collect(),
    }
}

#[test]
fn validates_a_static_128x32_group() {
    let group = test_group("custom-mono-128x32-v1", 1, 1, 512);

    assert_eq!(Ok(()), validate_group(&group));
}

#[test]
fn validates_50ms_frame_and_rejects_49ms_frame() {
    let mut group = test_group("custom-mono-128x32-v1", 1, 1, 512);
    group.faces[0].frames[0].duration_ms = 50;
    assert_eq!(Ok(()), validate_group(&group));

    group.faces[0].frames[0].duration_ms = 49;
    assert_eq!(
        Err(CustomFaceValidationError::InvalidFrameDuration(49)),
        validate_group(&group)
    );
}

#[test]
fn rejects_duplicate_nfkc_casefolded_names() {
    let mut group = test_group("custom-mono-128x32-v1", 2, 1, 512);
    group.faces[0].name = "Ready".to_string();
    group.faces[1].name = "  ready  ".to_string();

    assert_eq!(
        Err(CustomFaceValidationError::DuplicateFaceName(
            "ready".to_string()
        )),
        validate_group(&group)
    );
}

#[test]
fn accepts_320x240_tenth_frame_and_rejects_eleventh_frame() {
    let group = test_group("custom-mono-320x240-v1", 1, 6, 9600);

    assert_eq!(Ok(()), validate_group(&group));

    let group = test_group("custom-mono-320x240-v1", 1, 11, 9600);

    assert_eq!(
        Err(CustomFaceValidationError::TooManyFrames {
            max: 10,
            actual: 11
        }),
        validate_group(&group)
    );
}

#[test]
fn rejects_wrong_framebuffer_length_and_missing_default() {
    let mut group = test_group("custom-mono-128x32-v1", 1, 1, 511);
    assert_eq!(
        Err(CustomFaceValidationError::InvalidFramebufferLength {
            expected: 512,
            actual: 511,
        }),
        validate_group(&group)
    );

    group.faces[0].frames[0].packed_pixels = vec![0; 512];
    group.default_face_id = FACE_ID_2.to_string();
    assert_eq!(
        Err(CustomFaceValidationError::DefaultFaceMissing(
            FACE_ID_2.to_string()
        )),
        validate_group(&group)
    );
}

#[test]
fn names_change_library_hash_but_not_runtime_hashes() {
    let original = test_group("custom-mono-128x32-v1", 1, 1, 512);
    let mut renamed = original.clone();
    renamed.name = "Renamed group".to_string();
    renamed.faces[0].name = "Renamed face".to_string();

    assert_ne!(
        library_hash(&original).unwrap(),
        library_hash(&renamed).unwrap()
    );
    assert_eq!(
        face_runtime_hash(&original, &original.faces[0]).unwrap(),
        face_runtime_hash(&renamed, &renamed.faces[0]).unwrap()
    );
    assert_eq!(
        group_runtime_hash(&original).unwrap(),
        group_runtime_hash(&renamed).unwrap()
    );
}

#[test]
fn ui_order_does_not_change_group_runtime_hash() {
    let original = test_group("custom-mono-128x32-v1", 2, 1, 512);
    let mut reordered = original.clone();
    reordered.faces.reverse();

    assert_eq!(
        group_runtime_hash(&original).unwrap(),
        group_runtime_hash(&reordered).unwrap()
    );
    assert_ne!(
        library_hash(&original).unwrap(),
        library_hash(&reordered).unwrap()
    );
}

#[test]
fn pixels_change_face_and_group_runtime_hashes() {
    let original = test_group("custom-mono-128x32-v1", 1, 1, 512);
    let mut changed = original.clone();
    changed.faces[0].frames[0].packed_pixels[7] = 1;

    assert_ne!(
        face_runtime_hash(&original, &original.faces[0]).unwrap(),
        face_runtime_hash(&changed, &changed.faces[0]).unwrap()
    );
    assert_ne!(
        group_runtime_hash(&original).unwrap(),
        group_runtime_hash(&changed).unwrap()
    );
}

#[test]
fn deleted_face_ids_change_package_hash() {
    let target_hash = [7u8; 32];
    let manifest = b"manifest";
    let blobs = BTreeMap::new();
    let deleted = Uuid::parse_str(FACE_ID_2).unwrap();

    assert_ne!(
        package_hash(2, Some([3u8; 32]), target_hash, manifest, &[], &blobs),
        package_hash(
            2,
            Some([3u8; 32]),
            target_hash,
            manifest,
            &[deleted],
            &blobs,
        )
    );
}

#[test]
fn rle_roundtrips_zero_and_literal_runs_over_128_bytes() {
    let mut source = vec![0; 260];
    source.extend((1u8..=200).cycle().take(260));

    let encoded = encode_rle(&source);

    assert_eq!(source, decode_rle(&encoded, source.len()).unwrap());
}

#[test]
fn rle_rejects_truncated_literal_and_wrong_output_size() {
    assert_eq!(
        Err(RleError::TruncatedLiteral),
        decode_rle(&[0x82, 1, 2], 3)
    );
    assert_eq!(
        Err(RleError::OutputSizeMismatch {
            expected: 2,
            actual: 1,
        }),
        decode_rle(&[0x00], 2)
    );
}

fn two_frame_delta_group() -> CustomFaceGroup {
    let mut group = test_group("custom-mono-128x32-v1", 1, 2, 512);
    group.faces[0].frames[1].duration_ms = 400;
    group.faces[0].frames[1].packed_pixels[3] = 1;
    group
}

fn incompressible_group_over_profile_limit() -> CustomFaceGroup {
    let faces = (0u128..15)
        .map(|index| {
            let face_id = Uuid::from_u128(0x1000_0000_0000_4000_8000_0000_0000_0000 + index);
            CustomFace {
                face_id: face_id.to_string(),
                name: format!("Face {index}"),
                color: CustomFaceColor {
                    red: 0x12,
                    green: 0x34,
                    blue: 0x56,
                },
                frames: (0u8..5)
                    .map(|frame_index| CustomFaceFrame {
                        duration_ms: 200,
                        packed_pixels: (0..9600)
                            .map(|pixel_index| {
                                ((pixel_index + usize::from(frame_index) * 17) % 254 + 1) as u8
                            })
                            .collect(),
                    })
                    .collect(),
            }
        })
        .collect::<Vec<_>>();
    CustomFaceGroup {
        schema_version: 1,
        group_id: GROUP_ID.to_string(),
        name: "Large Wio group".to_string(),
        display_profile_id: "custom-mono-320x240-v1".to_string(),
        revision: 1,
        default_face_id: faces[0].face_id.clone(),
        faces,
    }
}

#[test]
fn compiles_manifest_and_independent_face_blobs() {
    let group = test_group("custom-mono-128x32-v1", 2, 1, 512);

    let compiled = compile_group(&group).unwrap();

    assert_eq!(&compiled.manifest_bytes[..4], b"CCFM");
    assert_eq!(76 + 56 * 2, compiled.manifest_bytes.len());
    assert_eq!(2, compiled.face_blobs.len());
    for (face_id, blob) in &compiled.face_blobs {
        let expected = group
            .faces
            .iter()
            .find(|face| face.face_id == face_id.to_string())
            .unwrap();
        assert_eq!(&blob[..4], b"CCFB");
        assert_eq!(expected.frames, decode_face_blob(blob).unwrap().frames);
    }
}

#[test]
fn second_frame_uses_xor_delta() {
    let group = two_frame_delta_group();
    let compiled = compile_group(&group).unwrap();
    let blob = compiled.face_blobs.values().next().unwrap();

    let parsed = parse_face_blob(blob).unwrap();

    assert_eq!(0, parsed.records[0].mode);
    assert_eq!(1, parsed.records[1].mode);
    assert_eq!(
        group.faces[0].frames,
        decode_face_blob(blob).unwrap().frames
    );
}

#[test]
fn rejects_compiled_group_larger_than_profile_limit() {
    let group = incompressible_group_over_profile_limit();

    assert!(matches!(
        compile_group(&group),
        Err(CustomFaceCompileError::GroupTooLarge { max: 393216, .. })
    ));
}

#[test]
fn rejects_editor_only_and_custom_profiles_at_device_compile_boundary() {
    let editor_only = test_group("custom-mono-128x64-v1", 1, 1, 1024);
    assert!(matches!(
        compile_group(&editor_only),
        Err(CustomFaceCompileError::ProfileNotDeployable(_))
    ));
    let custom = test_group("custom-200x48-v1", 1, 1, 1200);
    assert!(matches!(
        compile_group(&custom),
        Err(CustomFaceCompileError::ProfileNotDeployable(_))
    ));
}

#[test]
fn patch_sends_only_changed_and_new_faces() {
    let base_group = test_group("custom-mono-128x32-v1", 2, 1, 512);
    let base = compile_group(&base_group).unwrap();
    let mut next_group = base_group.clone();
    next_group.faces[1].frames[0].packed_pixels[3] ^= 1;
    next_group
        .faces
        .push(test_face(FACE_ID_3, "New face", 1, 512));
    let target = compile_group(&next_group).unwrap();

    let plan = plan_update(Some(&base.snapshot().unwrap()), &target, true).unwrap();

    assert_eq!(TransferMode::Patch, plan.mode);
    assert_eq!(2, plan.face_blobs.len());
    assert!(plan.deleted_face_ids.is_empty());
}

#[test]
fn rename_only_is_noop_and_different_group_is_full() {
    let original = test_group("custom-mono-128x32-v1", 1, 1, 512);
    let base = compile_group(&original).unwrap();
    let mut renamed = original.clone();
    renamed.name = "Renamed".to_string();
    renamed.faces[0].name = "Renamed face".to_string();

    assert_eq!(
        TransferMode::Noop,
        plan_update(
            Some(&base.snapshot().unwrap()),
            &compile_group(&renamed).unwrap(),
            true,
        )
        .unwrap()
        .mode
    );

    let mut copied = original;
    copied.group_id = "00000000-0000-4000-8000-000000000099".to_string();
    assert_eq!(
        TransferMode::Full,
        plan_update(
            Some(&base.snapshot().unwrap()),
            &compile_group(&copied).unwrap(),
            true,
        )
        .unwrap()
        .mode
    );
}

#[test]
fn patch_records_deleted_faces() {
    let base_group = test_group("custom-mono-128x32-v1", 2, 1, 512);
    let base = compile_group(&base_group).unwrap();
    let mut next_group = base_group;
    next_group.faces.pop();
    let target = compile_group(&next_group).unwrap();

    let plan = plan_update(Some(&base.snapshot().unwrap()), &target, true).unwrap();

    assert_eq!(TransferMode::Patch, plan.mode);
    assert_eq!(
        vec![Uuid::parse_str(FACE_ID_2).unwrap()],
        plan.deleted_face_ids
    );
    assert!(plan.face_blobs.is_empty());
}

#[test]
fn committed_golden_fixture_matches_rust_parser() {
    let binary = include_bytes!("../../../tests/fixtures/custom-face-package-v1.bin");
    let metadata: serde_json::Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/custom-face-package-v1.json"
    ))
    .unwrap();
    let manifest_length = u32::from_le_bytes(binary[..4].try_into().unwrap()) as usize;
    let manifest_bytes = &binary[4..4 + manifest_length];
    let manifest = parse_manifest(manifest_bytes).unwrap();

    assert_eq!(2, manifest.entries.len());
    assert_eq!(
        metadata["manifestHex"].as_str().unwrap(),
        hex::encode(manifest_bytes)
    );

    let mut offset = 4 + manifest_length;
    for entry in manifest.entries {
        let blob_length =
            u32::from_le_bytes(binary[offset..offset + 4].try_into().unwrap()) as usize;
        offset += 4;
        assert_eq!(entry.blob_length as usize, blob_length);
        let decoded = decode_face_blob(&binary[offset..offset + blob_length]).unwrap();
        assert_eq!(entry.face_id, decoded.face_id);
        assert_eq!(entry.frame_count as usize, decoded.frames.len());
        offset += blob_length;
    }
    assert_eq!(binary.len(), offset);
}
