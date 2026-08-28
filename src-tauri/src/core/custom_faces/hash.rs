use std::collections::BTreeMap;

use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::contract_generated::custom_face_profile_by_id;
use super::model::{CustomFace, CustomFaceColor, CustomFaceGroup};
use super::validation::{normalize_custom_face_name, validate_group, CustomFaceValidationError};

pub fn library_hash(group: &CustomFaceGroup) -> Result<[u8; 32], CustomFaceValidationError> {
    validate_group(group)?;
    let mut writer = HashWriter::new(b"CCFLIB1");
    writer.group_uuid(&group.group_id)?;
    writer.string(&normalize_custom_face_name(&group.name));
    writer.string(&group.display_profile_id);
    writer.face_uuid(&group.default_face_id)?;
    writer.u8(group.faces.len() as u8);
    for face in &group.faces {
        writer.face_uuid(&face.face_id)?;
        writer.string(&normalize_custom_face_name(&face.name));
        writer.u8(face.color.red);
        writer.u8(face.color.green);
        writer.u8(face.color.blue);
        writer.u8(face.frames.len() as u8);
        for frame in &face.frames {
            writer.u16(frame.duration_ms);
            writer.bytes(&frame.packed_pixels);
        }
    }
    Ok(writer.finish())
}

pub fn face_runtime_hash(
    group: &CustomFaceGroup,
    face: &CustomFace,
) -> Result<[u8; 32], CustomFaceValidationError> {
    validate_group(group)?;
    let profile = custom_face_profile_by_id(&group.display_profile_id).ok_or_else(|| {
        CustomFaceValidationError::UnknownProfile(group.display_profile_id.clone())
    })?;
    let mut writer = HashWriter::new(b"CCFACE1");
    writer.u16(profile.code);
    writer.face_uuid(&face.face_id)?;
    writer.u16(rgb888_to_rgb565(face.color));
    writer.u8(face.frames.len() as u8);
    for frame in &face.frames {
        writer.u16(frame.duration_ms);
        writer.bytes(&frame.packed_pixels);
    }
    Ok(writer.finish())
}

pub fn group_runtime_hash(group: &CustomFaceGroup) -> Result<[u8; 32], CustomFaceValidationError> {
    validate_group(group)?;
    let profile = custom_face_profile_by_id(&group.display_profile_id).ok_or_else(|| {
        CustomFaceValidationError::UnknownProfile(group.display_profile_id.clone())
    })?;
    let mut faces = BTreeMap::new();
    for face in &group.faces {
        faces.insert(
            parse_face_uuid(&face.face_id)?,
            face_runtime_hash(group, face)?,
        );
    }

    let mut writer = HashWriter::new(b"CCGROUP1");
    writer.group_uuid(&group.group_id)?;
    writer.u16(profile.code);
    writer.face_uuid(&group.default_face_id)?;
    writer.u8(faces.len() as u8);
    for (face_id, face_hash) in faces {
        writer.uuid(face_id);
        writer.raw(&face_hash);
    }
    Ok(writer.finish())
}

pub fn package_hash(
    mode: u8,
    base_group_runtime_hash: Option<[u8; 32]>,
    target_group_runtime_hash: [u8; 32],
    manifest_bytes: &[u8],
    deleted_face_ids: &[Uuid],
    face_blobs: &BTreeMap<Uuid, Vec<u8>>,
) -> [u8; 32] {
    let mut writer = HashWriter::new(b"CCPKG1");
    writer.u8(mode);
    match base_group_runtime_hash {
        Some(hash) => {
            writer.u8(1);
            writer.raw(&hash);
        }
        None => writer.u8(0),
    }
    writer.raw(&target_group_runtime_hash);
    writer.bytes(manifest_bytes);

    let mut deleted = deleted_face_ids.to_vec();
    deleted.sort();
    writer.u8(deleted.len() as u8);
    for face_id in deleted {
        writer.uuid(face_id);
    }
    writer.u8(face_blobs.len() as u8);
    for (face_id, blob) in face_blobs {
        writer.uuid(*face_id);
        writer.bytes(blob);
    }
    writer.finish()
}

pub fn rgb888_to_rgb565(color: CustomFaceColor) -> u16 {
    ((u16::from(color.red) >> 3) << 11)
        | ((u16::from(color.green) >> 2) << 5)
        | (u16::from(color.blue) >> 3)
}

fn parse_face_uuid(value: &str) -> Result<Uuid, CustomFaceValidationError> {
    Uuid::parse_str(value).map_err(|_| CustomFaceValidationError::InvalidFaceId(value.to_string()))
}

struct HashWriter(Sha256);

impl HashWriter {
    fn new(tag: &[u8]) -> Self {
        let mut hash = Sha256::new();
        hash.update(tag);
        Self(hash)
    }

    fn u8(&mut self, value: u8) {
        self.0.update([value]);
    }

    fn u16(&mut self, value: u16) {
        self.0.update(value.to_le_bytes());
    }

    fn u32(&mut self, value: u32) {
        self.0.update(value.to_le_bytes());
    }

    fn raw(&mut self, value: &[u8]) {
        self.0.update(value);
    }

    fn bytes(&mut self, value: &[u8]) {
        self.u32(value.len() as u32);
        self.raw(value);
    }

    fn string(&mut self, value: &str) {
        self.bytes(value.as_bytes());
    }

    fn uuid(&mut self, value: Uuid) {
        self.raw(value.as_bytes());
    }

    fn group_uuid(&mut self, value: &str) -> Result<(), CustomFaceValidationError> {
        let uuid = Uuid::parse_str(value)
            .map_err(|_| CustomFaceValidationError::InvalidGroupId(value.to_string()))?;
        self.uuid(uuid);
        Ok(())
    }

    fn face_uuid(&mut self, value: &str) -> Result<(), CustomFaceValidationError> {
        self.uuid(parse_face_uuid(value)?);
        Ok(())
    }

    fn finish(self) -> [u8; 32] {
        self.0.finalize().into()
    }
}
