use std::collections::BTreeMap;

use uuid::Uuid;

use super::compiler::CompiledCustomFaceGroup;
use super::hash::package_hash;
use super::package::{parse_manifest, CustomFaceCompileError};

const FULL_MODE_CODE: u8 = 1;
const PATCH_MODE_CODE: u8 = 2;
const ENVELOPE_FIXED_BYTES: usize = 68;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransferMode {
    Noop,
    Full,
    Patch,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstalledGroupSnapshot {
    pub group_id: Uuid,
    pub profile_code: u16,
    pub group_runtime_hash: [u8; 32],
    pub default_face_id: Uuid,
    pub faces: BTreeMap<Uuid, [u8; 32]>,
}

impl InstalledGroupSnapshot {
    pub fn from_compiled(
        compiled: &CompiledCustomFaceGroup,
    ) -> Result<Self, CustomFaceCompileError> {
        let manifest = parse_manifest(&compiled.manifest_bytes)?;
        Ok(Self {
            group_id: manifest.group_id,
            profile_code: manifest.profile_code,
            group_runtime_hash: manifest.group_runtime_hash,
            default_face_id: manifest.default_face_id,
            faces: manifest
                .entries
                .into_iter()
                .map(|entry| (entry.face_id, entry.face_runtime_hash))
                .collect(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomFaceTransferPlan {
    pub mode: TransferMode,
    pub base_group_runtime_hash: Option<[u8; 32]>,
    pub target_group_runtime_hash: [u8; 32],
    pub manifest_bytes: Vec<u8>,
    pub face_blobs: BTreeMap<Uuid, Vec<u8>>,
    pub deleted_face_ids: Vec<Uuid>,
    pub package_hash: [u8; 32],
    pub transfer_bytes: usize,
}

pub fn plan_update(
    installed: Option<&InstalledGroupSnapshot>,
    target: &CompiledCustomFaceGroup,
    incremental_supported: bool,
) -> Result<CustomFaceTransferPlan, CustomFaceCompileError> {
    let target_manifest = parse_manifest(&target.manifest_bytes)?;
    if installed.is_some_and(|current| {
        current.group_id == target.group_id
            && current.profile_code == target.profile_code
            && current.group_runtime_hash == target.group_runtime_hash
    }) {
        return Ok(build_plan(
            TransferMode::Noop,
            installed.map(|current| current.group_runtime_hash),
            target,
            BTreeMap::new(),
            Vec::new(),
            0,
        ));
    }

    let full_blobs = target.face_blobs.clone();
    let full_size = transfer_size(&target.manifest_bytes, &[], &full_blobs, false);
    let Some(current) = installed.filter(|current| {
        incremental_supported
            && current.group_id == target.group_id
            && current.profile_code == target.profile_code
    }) else {
        return Ok(build_plan(
            TransferMode::Full,
            None,
            target,
            full_blobs,
            Vec::new(),
            full_size,
        ));
    };

    let target_faces = target_manifest
        .entries
        .iter()
        .map(|entry| (entry.face_id, entry.face_runtime_hash))
        .collect::<BTreeMap<_, _>>();
    let changed_blobs = target
        .face_blobs
        .iter()
        .filter(|(face_id, _)| current.faces.get(face_id) != target_faces.get(face_id))
        .map(|(face_id, blob)| (*face_id, blob.clone()))
        .collect::<BTreeMap<_, _>>();
    let deleted_face_ids = current
        .faces
        .keys()
        .filter(|face_id| !target_faces.contains_key(face_id))
        .copied()
        .collect::<Vec<_>>();
    let patch_size = transfer_size(
        &target.manifest_bytes,
        &deleted_face_ids,
        &changed_blobs,
        true,
    );
    if patch_size >= full_size {
        return Ok(build_plan(
            TransferMode::Full,
            None,
            target,
            full_blobs,
            Vec::new(),
            full_size,
        ));
    }
    Ok(build_plan(
        TransferMode::Patch,
        Some(current.group_runtime_hash),
        target,
        changed_blobs,
        deleted_face_ids,
        patch_size,
    ))
}

fn build_plan(
    mode: TransferMode,
    base_group_runtime_hash: Option<[u8; 32]>,
    target: &CompiledCustomFaceGroup,
    face_blobs: BTreeMap<Uuid, Vec<u8>>,
    deleted_face_ids: Vec<Uuid>,
    transfer_bytes: usize,
) -> CustomFaceTransferPlan {
    let mode_code = match mode {
        TransferMode::Noop => 0,
        TransferMode::Full => FULL_MODE_CODE,
        TransferMode::Patch => PATCH_MODE_CODE,
    };
    let hash = package_hash(
        mode_code,
        base_group_runtime_hash,
        target.group_runtime_hash,
        &target.manifest_bytes,
        &deleted_face_ids,
        &face_blobs,
    );
    CustomFaceTransferPlan {
        mode,
        base_group_runtime_hash,
        target_group_runtime_hash: target.group_runtime_hash,
        manifest_bytes: target.manifest_bytes.clone(),
        face_blobs,
        deleted_face_ids,
        package_hash: hash,
        transfer_bytes,
    }
}

fn transfer_size(
    manifest: &[u8],
    deleted_face_ids: &[Uuid],
    face_blobs: &BTreeMap<Uuid, Vec<u8>>,
    includes_base_hash: bool,
) -> usize {
    ENVELOPE_FIXED_BYTES
        + usize::from(includes_base_hash) * 32
        + 4
        + manifest.len()
        + deleted_face_ids.len() * 16
        + face_blobs
            .values()
            .map(|blob| 16 + 4 + blob.len())
            .sum::<usize>()
}
