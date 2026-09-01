mod compiler;
pub mod contract_generated;
mod device_protocol;
pub mod device_protocol_generated;
mod hash;
mod model;
mod package;
mod rle;
mod update_plan;
mod validation;

pub use compiler::{compile_group, CompiledCustomFaceGroup};
pub use device_protocol::{parse_custom_face_capabilities, parse_custom_face_status};
pub use hash::{
    face_runtime_hash, group_runtime_hash, library_hash, package_hash, rgb888_to_rgb565,
};
pub use model::{CustomFace, CustomFaceColor, CustomFaceFrame, CustomFaceGroup};
pub use package::{
    decode_face_blob, parse_face_blob, parse_manifest, CustomFaceCompileError, DecodedFaceBlob,
    ParsedFaceBlob, ParsedFaceRecord, ParsedManifest, ParsedManifestEntry,
};
pub use rle::{decode_rle, encode_rle, RleError};
pub use update_plan::{plan_update, CustomFaceTransferPlan, InstalledGroupSnapshot, TransferMode};
pub use validation::{
    normalize_custom_face_name, validate_face_for_profile, validate_group,
    CustomFaceValidationError,
};

#[cfg(test)]
mod tests;
