use std::env;
use std::fs;
use std::path::Path;

use cc_notice::core::custom_faces::{
    compile_group, face_runtime_hash, library_hash, rgb888_to_rgb565, CustomFace, CustomFaceColor,
    CustomFaceFrame, CustomFaceGroup,
};
use serde_json::json;

const GROUP_ID: &str = "00000000-0000-4000-8000-000000000001";
const FACE_ID_1: &str = "00000000-0000-4000-8000-000000000011";
const FACE_ID_2: &str = "00000000-0000-4000-8000-000000000012";

fn main() -> Result<(), String> {
    let output_dir = env::args()
        .nth(1)
        .ok_or_else(|| "output directory is required".to_string())?;
    let output_dir = Path::new(&output_dir);
    fs::create_dir_all(output_dir).map_err(|error| error.to_string())?;

    let group = golden_group();
    let compiled = compile_group(&group).map_err(|error| error.to_string())?;
    let mut binary = Vec::new();
    push_u32(&mut binary, compiled.manifest_bytes.len() as u32);
    binary.extend_from_slice(&compiled.manifest_bytes);
    for blob in compiled.face_blobs.values() {
        push_u32(&mut binary, blob.len() as u32);
        binary.extend_from_slice(blob);
    }

    let faces = group
        .faces
        .iter()
        .map(|face| {
            Ok(json!({
                "faceId": face.face_id,
                "faceRuntimeHash": hex::encode(
                    face_runtime_hash(&group, face).map_err(|error| error.to_string())?
                ),
                "rgb565": rgb888_to_rgb565(face.color),
                "frames": face.frames.iter().map(|frame| json!({
                    "durationMs": frame.duration_ms,
                    "packedPixelsHex": hex::encode(&frame.packed_pixels)
                })).collect::<Vec<_>>()
            }))
        })
        .collect::<Result<Vec<_>, String>>()?;
    let metadata = json!({
        "version": "custom-face-package-v1",
        "groupId": group.group_id,
        "libraryHash": hex::encode(library_hash(&group).map_err(|error| error.to_string())?),
        "groupRuntimeHash": hex::encode(compiled.group_runtime_hash),
        "manifestHex": hex::encode(&compiled.manifest_bytes),
        "faces": faces
    });

    fs::write(output_dir.join("custom-face-package-v1.bin"), binary)
        .map_err(|error| error.to_string())?;
    fs::write(
        output_dir.join("custom-face-package-v1.json"),
        serde_json::to_string_pretty(&metadata).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn golden_group() -> CustomFaceGroup {
    let mut first_frame = vec![0; 512];
    first_frame[7] = 0x80;
    first_frame[8] = 0x01;
    let mut second_frame = first_frame.clone();
    second_frame[8] = 0x03;
    second_frame[64] = 0x10;
    let mut other_frame = vec![0; 512];
    other_frame[20..24].copy_from_slice(&[1, 2, 3, 4]);

    CustomFaceGroup {
        schema_version: 1,
        group_id: GROUP_ID.to_string(),
        name: "Golden group".to_string(),
        display_profile_id: "custom-mono-128x32-v1".to_string(),
        revision: 1,
        default_face_id: FACE_ID_1.to_string(),
        faces: vec![
            CustomFace {
                face_id: FACE_ID_1.to_string(),
                name: "Animated".to_string(),
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
            },
            CustomFace {
                face_id: FACE_ID_2.to_string(),
                name: "Static".to_string(),
                color: CustomFaceColor {
                    red: 0xaa,
                    green: 0xbb,
                    blue: 0xcc,
                },
                frames: vec![CustomFaceFrame {
                    duration_ms: 200,
                    packed_pixels: other_frame,
                }],
            },
        ],
    }
}

fn push_u32(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}
