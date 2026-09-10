use thiserror::Error;
use uuid::Uuid;

use super::contract_generated::{
    custom_face_profile_by_code, CUSTOM_FACE_BINARY_VERSION, CUSTOM_FACE_BLOB_MAGIC,
    CUSTOM_FACE_FRAME_DURATION_MAX_MS, CUSTOM_FACE_FRAME_DURATION_MIN_MS,
    CUSTOM_FACE_MANIFEST_MAGIC, CUSTOM_FACE_MAX_FACES_PER_GROUP,
};
use super::model::CustomFaceFrame;
use super::rle::{decode_rle, RleError};
use super::validation::CustomFaceValidationError;

pub const MANIFEST_HEADER_SIZE: usize = 76;
pub const MANIFEST_ENTRY_SIZE: usize = 56;
pub const FACE_BLOB_HEADER_SIZE: usize = 60;
const FRAME_RECORD_HEADER_SIZE: usize = 8;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CustomFaceCompileError {
    #[error(transparent)]
    Validation(#[from] CustomFaceValidationError),
    #[error("custom face group is too large: {actual} > {max}")]
    GroupTooLarge { max: usize, actual: usize },
    #[error("custom face profile is not deployable: {0}")]
    ProfileNotDeployable(String),
    #[error("custom face package is malformed: {0}")]
    MalformedPackage(String),
    #[error(transparent)]
    Rle(#[from] RleError),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedManifestEntry {
    pub face_id: Uuid,
    pub face_runtime_hash: [u8; 32],
    pub rgb565: u16,
    pub frame_count: u8,
    pub blob_length: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedManifest {
    pub profile_code: u16,
    pub group_id: Uuid,
    pub default_face_id: Uuid,
    pub group_runtime_hash: [u8; 32],
    pub entries: Vec<ParsedManifestEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedFaceRecord {
    pub duration_ms: u16,
    pub mode: u8,
    pub encoded: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedFaceBlob {
    pub face_id: Uuid,
    pub face_runtime_hash: [u8; 32],
    pub framebuffer_size: usize,
    pub records: Vec<ParsedFaceRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedFaceBlob {
    pub face_id: Uuid,
    pub face_runtime_hash: [u8; 32],
    pub frames: Vec<CustomFaceFrame>,
}

pub fn parse_manifest(bytes: &[u8]) -> Result<ParsedManifest, CustomFaceCompileError> {
    let mut cursor = Cursor::new(bytes);
    if cursor.read_array::<4>()? != CUSTOM_FACE_MANIFEST_MAGIC {
        return malformed("invalid manifest magic");
    }
    if cursor.read_u16()? != CUSTOM_FACE_BINARY_VERSION {
        return malformed("unsupported manifest version");
    }
    let profile_code = cursor.read_u16()?;
    let profile = custom_face_profile_by_code(profile_code)
        .ok_or_else(|| CustomFaceCompileError::MalformedPackage("unknown profile code".into()))?;
    let face_count = usize::from(cursor.read_u8()?);
    if face_count == 0 || face_count > CUSTOM_FACE_MAX_FACES_PER_GROUP {
        return malformed("invalid manifest face count");
    }
    if cursor.read_array::<3>()? != [0; 3] {
        return malformed("manifest reserved bytes must be zero");
    }
    let group_id = cursor.read_uuid()?;
    let default_face_id = cursor.read_uuid()?;
    let group_runtime_hash = cursor.read_array::<32>()?;
    if bytes.len() != MANIFEST_HEADER_SIZE + face_count * MANIFEST_ENTRY_SIZE {
        return malformed("manifest length does not match face count");
    }

    let mut entries = Vec::with_capacity(face_count);
    let mut previous_face_id = None;
    for _ in 0..face_count {
        let face_id = cursor.read_uuid()?;
        if previous_face_id.is_some_and(|previous| previous >= face_id) {
            return malformed("manifest entries are not strictly sorted");
        }
        previous_face_id = Some(face_id);
        let face_runtime_hash = cursor.read_array::<32>()?;
        let rgb565 = cursor.read_u16()?;
        let frame_count = cursor.read_u8()?;
        if frame_count == 0 || frame_count > profile.max_frames {
            return malformed("manifest frame count exceeds profile limit");
        }
        if cursor.read_u8()? != 0 {
            return malformed("manifest entry reserved byte must be zero");
        }
        let blob_length = cursor.read_u32()?;
        if blob_length < FACE_BLOB_HEADER_SIZE as u32 {
            return malformed("manifest blob length is too small");
        }
        entries.push(ParsedManifestEntry {
            face_id,
            face_runtime_hash,
            rgb565,
            frame_count,
            blob_length,
        });
    }
    if !entries.iter().any(|entry| entry.face_id == default_face_id) {
        return malformed("manifest default face is missing");
    }
    Ok(ParsedManifest {
        profile_code,
        group_id,
        default_face_id,
        group_runtime_hash,
        entries,
    })
}

pub fn parse_face_blob(bytes: &[u8]) -> Result<ParsedFaceBlob, CustomFaceCompileError> {
    let mut cursor = Cursor::new(bytes);
    if cursor.read_array::<4>()? != CUSTOM_FACE_BLOB_MAGIC {
        return malformed("invalid face blob magic");
    }
    if cursor.read_u16()? != CUSTOM_FACE_BINARY_VERSION {
        return malformed("unsupported face blob version");
    }
    let frame_count = usize::from(cursor.read_u8()?);
    if frame_count == 0 {
        return malformed("face blob has no frames");
    }
    if cursor.read_u8()? != 0 {
        return malformed("face blob reserved byte must be zero");
    }
    let face_id = cursor.read_uuid()?;
    let face_runtime_hash = cursor.read_array::<32>()?;
    let framebuffer_size = cursor.read_u32()? as usize;
    if framebuffer_size == 0 {
        return malformed("face blob framebuffer size is zero");
    }

    let mut records = Vec::with_capacity(frame_count);
    for index in 0..frame_count {
        if cursor.remaining() < FRAME_RECORD_HEADER_SIZE {
            return malformed("face frame record is truncated");
        }
        let duration_ms = cursor.read_u16()?;
        if !(CUSTOM_FACE_FRAME_DURATION_MIN_MS..=CUSTOM_FACE_FRAME_DURATION_MAX_MS)
            .contains(&duration_ms)
        {
            return malformed("face frame duration is invalid");
        }
        let mode = cursor.read_u8()?;
        if mode != if index == 0 { 0 } else { 1 } {
            return malformed("face frame mode is invalid");
        }
        if cursor.read_u8()? != 0 {
            return malformed("face frame reserved byte must be zero");
        }
        let encoded_length = cursor.read_u32()? as usize;
        let encoded = cursor.read_bytes(encoded_length)?.to_vec();
        records.push(ParsedFaceRecord {
            duration_ms,
            mode,
            encoded,
        });
    }
    if cursor.remaining() != 0 {
        return malformed("face blob contains trailing bytes");
    }
    Ok(ParsedFaceBlob {
        face_id,
        face_runtime_hash,
        framebuffer_size,
        records,
    })
}

pub fn decode_face_blob(bytes: &[u8]) -> Result<DecodedFaceBlob, CustomFaceCompileError> {
    let parsed = parse_face_blob(bytes)?;
    let mut frames = Vec::with_capacity(parsed.records.len());
    let mut previous = vec![0; parsed.framebuffer_size];
    for record in &parsed.records {
        let decoded = decode_rle(&record.encoded, parsed.framebuffer_size)?;
        let packed_pixels = if record.mode == 0 {
            decoded
        } else {
            previous
                .iter()
                .zip(decoded)
                .map(|(left, right)| *left ^ right)
                .collect()
        };
        previous.clone_from(&packed_pixels);
        frames.push(CustomFaceFrame {
            duration_ms: record.duration_ms,
            packed_pixels,
        });
    }
    Ok(DecodedFaceBlob {
        face_id: parsed.face_id,
        face_runtime_hash: parsed.face_runtime_hash,
        frames,
    })
}

fn malformed<T>(message: &str) -> Result<T, CustomFaceCompileError> {
    Err(CustomFaceCompileError::MalformedPackage(
        message.to_string(),
    ))
}

struct Cursor<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Cursor<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn remaining(&self) -> usize {
        self.bytes.len().saturating_sub(self.offset)
    }

    fn read_bytes(&mut self, length: usize) -> Result<&'a [u8], CustomFaceCompileError> {
        let end = self
            .offset
            .checked_add(length)
            .ok_or_else(|| CustomFaceCompileError::MalformedPackage("offset overflow".into()))?;
        if end > self.bytes.len() {
            return malformed("package field is truncated");
        }
        let result = &self.bytes[self.offset..end];
        self.offset = end;
        Ok(result)
    }

    fn read_array<const N: usize>(&mut self) -> Result<[u8; N], CustomFaceCompileError> {
        self.read_bytes(N)?
            .try_into()
            .map_err(|_| CustomFaceCompileError::MalformedPackage("invalid array length".into()))
    }

    fn read_u8(&mut self) -> Result<u8, CustomFaceCompileError> {
        Ok(self.read_array::<1>()?[0])
    }

    fn read_u16(&mut self) -> Result<u16, CustomFaceCompileError> {
        Ok(u16::from_le_bytes(self.read_array::<2>()?))
    }

    fn read_u32(&mut self) -> Result<u32, CustomFaceCompileError> {
        Ok(u32::from_le_bytes(self.read_array::<4>()?))
    }

    fn read_uuid(&mut self) -> Result<Uuid, CustomFaceCompileError> {
        Ok(Uuid::from_bytes(self.read_array::<16>()?))
    }
}
