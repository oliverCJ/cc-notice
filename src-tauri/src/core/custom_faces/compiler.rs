use std::collections::BTreeMap;

use uuid::Uuid;

use super::contract_generated::{
    custom_face_profile_by_id, CUSTOM_FACE_BINARY_VERSION, CUSTOM_FACE_BLOB_MAGIC,
    CUSTOM_FACE_MANIFEST_MAGIC,
};
use super::hash::{face_runtime_hash, group_runtime_hash, rgb888_to_rgb565};
use super::model::{CustomFace, CustomFaceGroup};
use super::package::{
    decode_face_blob, parse_manifest, CustomFaceCompileError, FACE_BLOB_HEADER_SIZE,
    MANIFEST_ENTRY_SIZE, MANIFEST_HEADER_SIZE,
};
use super::rle::encode_rle;
use super::validation::validate_group;
use super::InstalledGroupSnapshot;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompiledCustomFaceGroup {
    pub group_id: Uuid,
    pub profile_code: u16,
    pub group_runtime_hash: [u8; 32],
    pub manifest_bytes: Vec<u8>,
    pub face_blobs: BTreeMap<Uuid, Vec<u8>>,
}

impl CompiledCustomFaceGroup {
    pub fn snapshot(&self) -> Result<InstalledGroupSnapshot, CustomFaceCompileError> {
        InstalledGroupSnapshot::from_compiled(self)
    }
}

pub fn compile_group(
    group: &CustomFaceGroup,
) -> Result<CompiledCustomFaceGroup, CustomFaceCompileError> {
    validate_group(group)?;
    let profile = custom_face_profile_by_id(&group.display_profile_id).ok_or_else(|| {
        CustomFaceCompileError::MalformedPackage("unknown profile after validation".into())
    })?;
    let group_id = Uuid::parse_str(&group.group_id)
        .map_err(|_| CustomFaceCompileError::MalformedPackage("invalid group UUID".into()))?;
    let default_face_id = Uuid::parse_str(&group.default_face_id).map_err(|_| {
        CustomFaceCompileError::MalformedPackage("invalid default face UUID".into())
    })?;
    let group_hash = group_runtime_hash(group)?;
    let mut face_blobs = BTreeMap::new();
    let mut face_metadata = BTreeMap::new();

    for face in &group.faces {
        let face_id = Uuid::parse_str(&face.face_id)
            .map_err(|_| CustomFaceCompileError::MalformedPackage("invalid face UUID".into()))?;
        let face_hash = face_runtime_hash(group, face)?;
        let blob = compile_face_blob(face, face_id, face_hash);
        let decoded = decode_face_blob(&blob)?;
        if decoded.face_id != face_id
            || decoded.face_runtime_hash != face_hash
            || decoded.frames != face.frames
        {
            return Err(CustomFaceCompileError::MalformedPackage(
                "compiled face blob failed self-check".into(),
            ));
        }
        face_metadata.insert(
            face_id,
            (
                face_hash,
                rgb888_to_rgb565(face.color),
                face.frames.len() as u8,
                blob.len() as u32,
            ),
        );
        face_blobs.insert(face_id, blob);
    }

    let mut manifest =
        Vec::with_capacity(MANIFEST_HEADER_SIZE + face_metadata.len() * MANIFEST_ENTRY_SIZE);
    manifest.extend_from_slice(&CUSTOM_FACE_MANIFEST_MAGIC);
    push_u16(&mut manifest, CUSTOM_FACE_BINARY_VERSION);
    push_u16(&mut manifest, profile.code);
    manifest.push(face_metadata.len() as u8);
    manifest.extend_from_slice(&[0; 3]);
    manifest.extend_from_slice(group_id.as_bytes());
    manifest.extend_from_slice(default_face_id.as_bytes());
    manifest.extend_from_slice(&group_hash);
    for (face_id, (face_hash, rgb565, frame_count, blob_length)) in &face_metadata {
        manifest.extend_from_slice(face_id.as_bytes());
        manifest.extend_from_slice(face_hash);
        push_u16(&mut manifest, *rgb565);
        manifest.push(*frame_count);
        manifest.push(0);
        push_u32(&mut manifest, *blob_length);
    }
    parse_manifest(&manifest)?;

    let actual = manifest.len() + face_blobs.values().map(Vec::len).sum::<usize>();
    if actual > profile.max_group_bytes {
        return Err(CustomFaceCompileError::GroupTooLarge {
            max: profile.max_group_bytes,
            actual,
        });
    }
    Ok(CompiledCustomFaceGroup {
        group_id,
        profile_code: profile.code,
        group_runtime_hash: group_hash,
        manifest_bytes: manifest,
        face_blobs,
    })
}

fn compile_face_blob(face: &CustomFace, face_id: Uuid, face_hash: [u8; 32]) -> Vec<u8> {
    let framebuffer_size = face.frames[0].packed_pixels.len();
    let mut blob = Vec::with_capacity(FACE_BLOB_HEADER_SIZE + framebuffer_size);
    blob.extend_from_slice(&CUSTOM_FACE_BLOB_MAGIC);
    push_u16(&mut blob, CUSTOM_FACE_BINARY_VERSION);
    blob.push(face.frames.len() as u8);
    blob.push(0);
    blob.extend_from_slice(face_id.as_bytes());
    blob.extend_from_slice(&face_hash);
    push_u32(&mut blob, framebuffer_size as u32);

    let mut previous = vec![0; framebuffer_size];
    for (index, frame) in face.frames.iter().enumerate() {
        let mode = if index == 0 { 0 } else { 1 };
        let source = if mode == 0 {
            frame.packed_pixels.clone()
        } else {
            previous
                .iter()
                .zip(&frame.packed_pixels)
                .map(|(left, right)| *left ^ *right)
                .collect()
        };
        let encoded = encode_rle(&source);
        push_u16(&mut blob, frame.duration_ms);
        blob.push(mode);
        blob.push(0);
        push_u32(&mut blob, encoded.len() as u32);
        blob.extend_from_slice(&encoded);
        previous.clone_from(&frame.packed_pixels);
    }
    blob
}

fn push_u16(output: &mut Vec<u8>, value: u16) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}
