use std::fs;
use std::path::{Path, PathBuf};

use image::GenericImageView;
use serde::{Deserialize, Serialize};
use visioncortex::PathSimplifyMode;
use vtracer::{ColorMode, Config, Hierarchical};

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS: u64 = 16_000_000;
const MAX_SVG_BYTES: usize = 2 * 1024 * 1024;
const TEMP_DIR_NAME: &str = "custom-face-vectorizer";
const TEMP_INPUT_NAME: &str = "current-input";
const TEMP_PREVIEW_NAME: &str = "preview.svg";
const TEMP_SVG_NAME: &str = "current-vectorized.svg";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum CustomFaceVectorizeMode {
    Binary,
    Color,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceVectorizeOptions {
    pub mode: CustomFaceVectorizeMode,
    pub filter_speckle: usize,
    pub color_precision: i32,
    pub layer_difference: i32,
    pub corner_threshold: i32,
    pub length_threshold: f64,
    pub max_iterations: usize,
    pub splice_threshold: i32,
    pub path_precision: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceVectorizeRequest {
    pub file_name: String,
    pub image_bytes: Vec<u8>,
    pub options: CustomFaceVectorizeOptions,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceVectorizeResult {
    pub svg: String,
    pub width: u32,
    pub height: u32,
}

pub fn vectorize_custom_face_image(
    app_home: &Path,
    request: CustomFaceVectorizeRequest,
) -> Result<CustomFaceVectorizeResult, String> {
    validate_image_bytes(&request.image_bytes)?;
    let image = image::load_from_memory(&request.image_bytes)
        .map_err(|error| format!("图片格式不支持或无法解码图片：{error}"))?;
    let width = image.width();
    let height = image.height();
    validate_image_dimensions(width, height)?;

    let temp_dir = vectorizer_temp_dir(app_home);
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let input_path = temp_dir.join(input_file_name(&request.file_name));
    let output_path = temp_dir.join(TEMP_PREVIEW_NAME);
    fs::write(&input_path, &request.image_bytes).map_err(|error| error.to_string())?;

    tracing::info!(
        width,
        height,
        mode = ?request.options.mode,
        "vectorizing custom face image"
    );
    vtracer::convert_image_to_svg(
        &input_path,
        &output_path,
        config_from_options(&request.options),
    )
    .map_err(|error| format!("VTracer 转换失败：{error}"))?;
    let svg = fs::read_to_string(&output_path).map_err(|error| error.to_string())?;
    validate_svg_size(&svg)?;
    Ok(CustomFaceVectorizeResult { svg, width, height })
}

pub fn write_vectorized_svg_temp_file(app_home: &Path, svg: &str) -> Result<PathBuf, String> {
    validate_svg_size(svg)?;
    let path = custom_face_vectorizer_temp_svg_path(app_home);
    let parent = path
        .parent()
        .ok_or_else(|| "无法解析图片转 SVG 临时目录".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let tmp_path = path.with_extension("svg.tmp");
    fs::write(&tmp_path, svg).map_err(|error| error.to_string())?;
    fs::rename(&tmp_path, &path).map_err(|error| error.to_string())?;
    tracing::info!(path = %path.display(), "custom face vectorized SVG temp file written");
    Ok(path)
}

pub fn custom_face_vectorizer_temp_svg_path(app_home: &Path) -> PathBuf {
    vectorizer_temp_dir(app_home).join(TEMP_SVG_NAME)
}

fn vectorizer_temp_dir(app_home: &Path) -> PathBuf {
    app_home.join("tmp").join(TEMP_DIR_NAME)
}

fn validate_image_bytes(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("图片内容为空".to_string());
    }
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err("图片文件超过 10 MiB 限制".to_string());
    }
    Ok(())
}

fn validate_image_dimensions(width: u32, height: u32) -> Result<(), String> {
    if width == 0 || height == 0 {
        return Err("图片尺寸无效".to_string());
    }
    if u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err("图片像素超过 1600 万限制".to_string());
    }
    Ok(())
}

fn validate_svg_size(svg: &str) -> Result<(), String> {
    if svg.len() > MAX_SVG_BYTES {
        return Err("SVG 超过 2 MiB，无法进入表情 SVG 导入流程".to_string());
    }
    Ok(())
}

fn input_file_name(file_name: &str) -> String {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("png");
    format!("{TEMP_INPUT_NAME}.{extension}")
}

fn config_from_options(options: &CustomFaceVectorizeOptions) -> Config {
    Config {
        color_mode: match options.mode {
            CustomFaceVectorizeMode::Binary => ColorMode::Binary,
            CustomFaceVectorizeMode::Color => ColorMode::Color,
        },
        hierarchical: Hierarchical::Stacked,
        filter_speckle: options.filter_speckle,
        color_precision: options.color_precision,
        layer_difference: options.layer_difference,
        mode: PathSimplifyMode::Spline,
        corner_threshold: options.corner_threshold,
        length_threshold: options.length_threshold,
        max_iterations: options.max_iterations,
        splice_threshold: options.splice_threshold,
        path_precision: Some(options.path_precision),
    }
}
