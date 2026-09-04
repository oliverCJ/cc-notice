use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use image::imageops::FilterType;
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use visioncortex::PathSimplifyMode;
use vtracer::{ColorMode, Config, Hierarchical};

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS: u64 = 16_000_000;
const MAX_SVG_BYTES: usize = 2 * 1024 * 1024;
const MAX_WORKING_IMAGE_EDGE: u32 = 1024;
const MAX_WORKING_IMAGE_SCALE: f64 = 4.0;
const TEMP_DIR_NAME: &str = "custom-face-vectorizer";
const TEMP_INPUT_NAME: &str = "current-input";
const TEMP_PREVIEW_NAME: &str = "preview";
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
    pub scale: f64,
    pub offset_x: i32,
    pub offset_y: i32,
    pub rotation_deg: i32,
    pub invert: bool,
    pub brightness: i32,
    pub contrast: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceVectorizeRequest {
    pub file_name: String,
    pub image_bytes: Vec<u8>,
    pub options: CustomFaceVectorizeOptions,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCustomFaceVectorizerSourceRequest {
    pub file_name: String,
    pub image_bytes: Vec<u8>,
    pub target_width: u32,
    pub target_height: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceVectorizeSourceRequest {
    pub source_id: String,
    pub options: CustomFaceVectorizeOptions,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCustomFaceVectorizerSourceResult {
    pub source_id: String,
    pub source_width: u32,
    pub source_height: u32,
    pub working_width: u32,
    pub working_height: u32,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceVectorizeResult {
    pub svg: String,
    pub width: u32,
    pub height: u32,
}

struct PreparedVectorizerSource {
    image: image::DynamicImage,
    source_width: u32,
    source_height: u32,
    working_width: u32,
    working_height: u32,
}

#[derive(Default)]
pub struct CustomFaceVectorizerSourceStore {
    next_id: AtomicU64,
    generation: AtomicU64,
    sources: Mutex<HashMap<String, PreparedVectorizerSource>>,
}

pub fn vectorize_custom_face_image(
    app_home: &Path,
    request: CustomFaceVectorizeRequest,
) -> Result<CustomFaceVectorizeResult, String> {
    let image = load_custom_face_vectorizer_image(&request.image_bytes)?;
    let image = resize_to_working_image(&image, image.width(), image.height());
    let image = preprocess_vectorizer_image(&image, &request.options);
    vectorize_decoded_custom_face_image(
        app_home,
        &image,
        image.width(),
        image.height(),
        &request.options,
    )
}

impl CustomFaceVectorizerSourceStore {
    pub fn prepare_source(
        &self,
        _app_home: &Path,
        request: PrepareCustomFaceVectorizerSourceRequest,
    ) -> Result<PrepareCustomFaceVectorizerSourceResult, String> {
        let generation = self.generation.load(Ordering::Acquire);
        let image = load_custom_face_vectorizer_image(&request.image_bytes)?;
        let source_id = self.next_source_id();
        let source_width = image.width();
        let source_height = image.height();
        let working_image =
            resize_to_working_image(&image, request.target_width, request.target_height);
        let working_width = working_image.width();
        let working_height = working_image.height();
        let mut sources = self
            .sources
            .lock()
            .map_err(|error| format!("图片源缓存不可用：{error}"))?;
        if self.generation.load(Ordering::Acquire) != generation {
            return Err("图片导入工作台已重置，请重新导入图片".to_string());
        }
        sources.insert(
            source_id.clone(),
            PreparedVectorizerSource {
                image: working_image,
                source_width,
                source_height,
                working_width,
                working_height,
            },
        );
        tracing::info!(
            source_width,
            source_height,
            working_width,
            working_height,
            source_id = %source_id,
            "prepared custom face vectorizer source"
        );
        Ok(PrepareCustomFaceVectorizerSourceResult {
            source_id,
            source_width,
            source_height,
            working_width,
            working_height,
        })
    }

    pub fn vectorize_source(
        &self,
        app_home: &Path,
        request: CustomFaceVectorizeSourceRequest,
    ) -> Result<CustomFaceVectorizeResult, String> {
        let sources = self
            .sources
            .lock()
            .map_err(|error| format!("图片源缓存不可用：{error}"))?;
        let source = sources
            .get(&request.source_id)
            .ok_or_else(|| "图片源已失效，请重新导入图片".to_string())?;
        tracing::info!(
            source_width = source.source_width,
            source_height = source.source_height,
            working_width = source.working_width,
            working_height = source.working_height,
            mode = ?request.options.mode,
            "vectorizing custom face image source"
        );
        let image = preprocess_vectorizer_image(&source.image, &request.options);
        vectorize_decoded_custom_face_image(
            app_home,
            &image,
            image.width(),
            image.height(),
            &request.options,
        )
    }

    pub fn release_source(&self, source_id: &str) -> bool {
        match self.sources.lock() {
            Ok(mut sources) => sources.remove(source_id).is_some(),
            Err(error) => {
                tracing::warn!(%error, "failed to lock custom face vectorizer source store");
                false
            }
        }
    }

    pub fn clear(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
        match self.sources.lock() {
            Ok(mut sources) => sources.clear(),
            Err(error) => tracing::warn!(%error, "failed to clear custom face vectorizer sources"),
        }
    }

    fn next_source_id(&self) -> String {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        format!("custom-face-vectorizer-source-{id}")
    }
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

fn load_custom_face_vectorizer_image(bytes: &[u8]) -> Result<image::DynamicImage, String> {
    validate_image_bytes(bytes)?;
    let image = image::load_from_memory(bytes)
        .map_err(|error| format!("图片格式不支持或无法解码图片：{error}"))?;
    let width = image.width();
    let height = image.height();
    validate_image_dimensions(width, height)?;
    Ok(image)
}

fn vectorize_decoded_custom_face_image(
    app_home: &Path,
    image: &image::DynamicImage,
    width: u32,
    height: u32,
    options: &CustomFaceVectorizeOptions,
) -> Result<CustomFaceVectorizeResult, String> {
    let temp_dir = vectorizer_temp_dir(app_home);
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let temp_file_token = uuid::Uuid::new_v4().simple().to_string();
    let input_path = temp_dir.join(format!("{TEMP_INPUT_NAME}-{temp_file_token}.png"));
    let output_path = temp_dir.join(format!("{TEMP_PREVIEW_NAME}-{temp_file_token}.svg"));
    let svg = (|| {
        image
            .write_to(
                &mut fs::File::create(&input_path).map_err(|error| error.to_string())?,
                image::ImageOutputFormat::Png,
            )
            .map_err(|error| error.to_string())?;

        tracing::info!(
            width,
            height,
            mode = ?options.mode,
            "vectorizing custom face image"
        );
        vtracer::convert_image_to_svg(&input_path, &output_path, config_from_options(options))
            .map_err(|error| format!("VTracer 转换失败：{error}"))?;
        fs::read_to_string(&output_path).map_err(|error| error.to_string())
    })();
    cleanup_vectorizer_preview_file(&input_path);
    cleanup_vectorizer_preview_file(&output_path);
    let svg = svg?;
    validate_svg_size(&svg)?;
    Ok(CustomFaceVectorizeResult { svg, width, height })
}

fn cleanup_vectorizer_preview_file(path: &Path) {
    if let Err(error) = fs::remove_file(path) {
        if error.kind() != ErrorKind::NotFound {
            tracing::warn!(path = %path.display(), %error, "failed to remove custom face vectorizer preview temp file");
        }
    }
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

fn resize_to_working_image(
    image: &image::DynamicImage,
    target_width: u32,
    target_height: u32,
) -> image::DynamicImage {
    let source_width = image.width();
    let source_height = image.height();
    if source_width == 0 || source_height == 0 || target_width == 0 || target_height == 0 {
        return image.clone();
    }
    let target_edge = target_width.max(target_height).max(1) as f64;
    let max_edge = (target_edge * MAX_WORKING_IMAGE_SCALE).ceil() as u32;
    let max_edge = max_edge.min(MAX_WORKING_IMAGE_EDGE).max(1);
    if source_width <= max_edge && source_height <= max_edge {
        return image.clone();
    }
    let scale = (max_edge as f64 / source_width as f64).min(max_edge as f64 / source_height as f64);
    let working_width = ((source_width as f64) * scale).round().max(1.0) as u32;
    let working_height = ((source_height as f64) * scale).round().max(1.0) as u32;
    image.resize_exact(working_width, working_height, FilterType::Lanczos3)
}

fn preprocess_vectorizer_image(
    image: &image::DynamicImage,
    options: &CustomFaceVectorizeOptions,
) -> image::DynamicImage {
    let mut current = image.clone();
    if options.brightness != 0 {
        current = current.brighten(options.brightness);
    }
    if options.contrast != 0 {
        current = current.adjust_contrast(options.contrast as f32);
    }
    if options.invert {
        current.invert();
    }
    let scale = if options.scale.is_finite() {
        options.scale.clamp(0.25, 4.0)
    } else {
        1.0
    };
    if (scale - 1.0).abs() > f64::EPSILON {
        let scaled_width = ((current.width() as f64) * scale).round().max(1.0) as u32;
        let scaled_height = ((current.height() as f64) * scale).round().max(1.0) as u32;
        current = current.resize_exact(scaled_width, scaled_height, FilterType::Triangle);
    }
    if options.rotation_deg % 360 != 0 {
        current = image::DynamicImage::ImageRgba8(rotate_vectorizer_image(
            &current.to_rgba8(),
            options.rotation_deg,
        ));
    }
    if options.offset_x != 0 || options.offset_y != 0 {
        current = image::DynamicImage::ImageRgba8(translate_vectorizer_image(
            &current.to_rgba8(),
            options.offset_x,
            options.offset_y,
        ));
    }
    current
}

fn rotate_vectorizer_image(image: &image::RgbaImage, rotation_deg: i32) -> image::RgbaImage {
    let normalized = rotation_deg.rem_euclid(360);
    if normalized == 0 {
        return image.clone();
    }
    let radians = f64::from(normalized).to_radians();
    let sin = radians.sin();
    let cos = radians.cos();
    let source_width = image.width() as f64;
    let source_height = image.height() as f64;
    let target_width = (source_width * cos.abs() + source_height * sin.abs())
        .ceil()
        .max(1.0) as u32;
    let target_height = (source_width * sin.abs() + source_height * cos.abs())
        .ceil()
        .max(1.0) as u32;
    let source_center_x = (source_width - 1.0) / 2.0;
    let source_center_y = (source_height - 1.0) / 2.0;
    let target_center_x = (target_width as f64 - 1.0) / 2.0;
    let target_center_y = (target_height as f64 - 1.0) / 2.0;
    let mut output =
        image::RgbaImage::from_pixel(target_width, target_height, image::Rgba([255, 255, 255, 0]));
    for target_y in 0..target_height {
        for target_x in 0..target_width {
            let delta_x = target_x as f64 - target_center_x;
            let delta_y = target_y as f64 - target_center_y;
            let source_x = cos * delta_x + sin * delta_y + source_center_x;
            let source_y = -sin * delta_x + cos * delta_y + source_center_y;
            if source_x < 0.0
                || source_y < 0.0
                || source_x >= source_width
                || source_y >= source_height
            {
                continue;
            }
            let sample_x = source_x.round().clamp(0.0, source_width - 1.0) as u32;
            let sample_y = source_y.round().clamp(0.0, source_height - 1.0) as u32;
            let source_pixel = image.get_pixel(sample_x, sample_y);
            output.put_pixel(target_x, target_y, *source_pixel);
        }
    }
    output
}

fn translate_vectorizer_image(
    image: &image::RgbaImage,
    offset_x: i32,
    offset_y: i32,
) -> image::RgbaImage {
    let mut output = image::RgbaImage::from_pixel(
        image.width(),
        image.height(),
        image::Rgba([255, 255, 255, 0]),
    );
    let width = image.width() as i32;
    let height = image.height() as i32;
    for source_y in 0..height {
        for source_x in 0..width {
            let target_x = source_x + offset_x;
            let target_y = source_y + offset_y;
            if target_x < 0 || target_y < 0 || target_x >= width || target_y >= height {
                continue;
            }
            let pixel = image.get_pixel(source_x as u32, source_y as u32);
            output.put_pixel(target_x as u32, target_y as u32, *pixel);
        }
    }
    output
}

fn validate_svg_size(svg: &str) -> Result<(), String> {
    if svg.len() > MAX_SVG_BYTES {
        return Err("SVG 超过 2 MiB，无法进入表情 SVG 导入流程".to_string());
    }
    Ok(())
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
