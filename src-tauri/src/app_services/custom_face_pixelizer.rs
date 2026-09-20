use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use image::imageops::{
    colorops::{brighten_in_place, contrast_in_place, dither, grayscale, BiLevel},
    FilterType,
};
use image::math::nq::NeuQuant;
use image::GenericImageView;
use image::Pixel;
use serde::{Deserialize, Serialize};

use super::custom_face_pixelizer_gif::decode_gif;

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS: u64 = 16_000_000;
const MAX_PIXELIZER_SCALE: f32 = 4.0;
const MAX_WORKING_IMAGE_EDGE: u32 = 1024;
const TEMP_DIR_NAME: &str = "custom-face-pixelizer";
const DEFAULT_ALPHA_THRESHOLD: u8 = 32;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum CustomFacePixelizeMode {
    Mono,
    Color,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFacePixelizeOptions {
    pub mode: CustomFacePixelizeMode,
    pub color_count: u16,
    pub dither: bool,
    pub invert: bool,
    #[serde(default)]
    pub background_invert: bool,
    #[serde(default = "default_alpha_threshold")]
    pub alpha_threshold: u8,
    pub threshold: u8,
    pub contrast: i16,
    pub brightness: i16,
    pub scale: f32,
    pub rotation_deg: i16,
    pub offset_x: i32,
    pub offset_y: i32,
}

fn default_alpha_threshold() -> u8 {
    DEFAULT_ALPHA_THRESHOLD
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFacePixelizeRequest {
    pub profile_width: u32,
    pub profile_height: u32,
    pub image_bytes: Vec<u8>,
    pub options: CustomFacePixelizeOptions,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCustomFacePixelizerSourceRequest {
    pub profile_width: u32,
    pub profile_height: u32,
    pub image_bytes: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCustomFacePixelizerSourceResult {
    pub source_id: String,
    pub source_width: u32,
    pub source_height: u32,
    pub working_width: u32,
    pub working_height: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCustomFaceGifPixelizerSourceRequest {
    pub profile_width: u32,
    pub profile_height: u32,
    pub image_bytes: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCustomFaceGifPixelizerSourceResult {
    pub source_id: String,
    pub source_width: u32,
    pub source_height: u32,
    pub frame_count: usize,
    pub total_duration_ms: u32,
    pub duration_was_clamped: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFacePixelizeSourceRequest {
    pub source_id: String,
    pub profile_width: u32,
    pub profile_height: u32,
    pub options: CustomFacePixelizeOptions,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFacePixelizeResult {
    pub width: u32,
    pub height: u32,
    pub packed_pixels: Vec<u8>,
    pub preview_pixels: Vec<u8>,
    pub content_mask: Vec<u8>,
    pub source_width: u32,
    pub source_height: u32,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceGifPixelizeFrameResult {
    pub duration_ms: u16,
    pub packed_pixels: Vec<u8>,
    pub preview_pixels: Vec<u8>,
    pub content_mask: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceGifPixelizeResult {
    pub width: u32,
    pub height: u32,
    pub frames: Vec<CustomFaceGifPixelizeFrameResult>,
    pub source_width: u32,
    pub source_height: u32,
    pub total_duration_ms: u32,
}

struct PreparedPixelizerSource {
    frames: Vec<PreparedPixelizerFrame>,
    source_width: u32,
    source_height: u32,
}

struct PreparedPixelizerFrame {
    image: image::DynamicImage,
    content_mask: Option<image::DynamicImage>,
    duration_ms: u16,
}

#[derive(Default)]
pub struct CustomFacePixelizerSourceStore {
    next_id: AtomicU64,
    generation: AtomicU64,
    sources: Mutex<HashMap<String, PreparedPixelizerSource>>,
    #[cfg(test)]
    before_insert_hook: Mutex<Option<Box<dyn FnOnce() + Send>>>,
}

impl CustomFacePixelizerSourceStore {
    pub fn prepare_source(
        &self,
        request: PrepareCustomFacePixelizerSourceRequest,
    ) -> Result<PrepareCustomFacePixelizerSourceResult, String> {
        let generation = self.generation.load(Ordering::Acquire);
        validate_image_bytes(&request.image_bytes)?;
        let image = image::load_from_memory(&request.image_bytes)
            .map_err(|error| format!("图片格式不支持或无法解码图片：{error}"))?;
        let source_width = image.width();
        let source_height = image.height();
        validate_image_dimensions(source_width, source_height)?;
        let working_image =
            resize_to_working_image(&image, request.profile_width, request.profile_height);
        let source_id = self.next_source_id();
        let working_width = working_image.width();
        let working_height = working_image.height();
        #[cfg(test)]
        self.run_before_insert_hook();
        let mut sources = self
            .sources
            .lock()
            .map_err(|error| format!("图片源缓存不可用：{error}"))?;
        if self.generation.load(Ordering::Acquire) != generation {
            return Err("图片导入工作台已重置，请重新导入图片".to_string());
        }
        sources.insert(
            source_id.clone(),
            PreparedPixelizerSource {
                frames: vec![PreparedPixelizerFrame {
                    image: working_image,
                    content_mask: None,
                    duration_ms: 200,
                }],
                source_width,
                source_height,
            },
        );
        tracing::info!(
            source_width,
            source_height,
            working_width,
            working_height,
            "prepared custom face image pixelizer source"
        );
        Ok(PrepareCustomFacePixelizerSourceResult {
            source_id,
            source_width,
            source_height,
            working_width,
            working_height,
        })
    }

    pub fn pixelize_source(
        &self,
        request: CustomFacePixelizeSourceRequest,
    ) -> Result<CustomFacePixelizeResult, String> {
        let sources = self
            .sources
            .lock()
            .map_err(|error| format!("图片源缓存不可用：{error}"))?;
        let source = sources
            .get(&request.source_id)
            .ok_or_else(|| "图片源已失效，请重新导入图片".to_string())?;
        let frame = source
            .frames
            .first()
            .ok_or_else(|| "图片源不包含有效帧".to_string())?;
        pixelize_decoded_image(
            &frame.image,
            frame.content_mask.as_ref(),
            source.source_width,
            source.source_height,
            request.profile_width,
            request.profile_height,
            &request.options,
        )
    }

    pub fn prepare_gif_source(
        &self,
        request: PrepareCustomFaceGifPixelizerSourceRequest,
    ) -> Result<PrepareCustomFaceGifPixelizerSourceResult, String> {
        let generation = self.generation.load(Ordering::Acquire);
        validate_image_bytes(&request.image_bytes)?;
        let decoded = decode_gif(&request.image_bytes)?;
        let source_id = self.next_source_id();
        let frames = decoded
            .frames
            .iter()
            .map(|frame| {
                let image = image::DynamicImage::ImageRgba8(
                    image::RgbaImage::from_raw(
                        decoded.canvas_width,
                        decoded.canvas_height,
                        frame.rgba_pixels.clone(),
                    )
                    .ok_or_else(|| "GIF 帧像素数据无效".to_string())?,
                );
                Ok(PreparedPixelizerFrame {
                    image: resize_to_working_image(
                        &image,
                        request.profile_width,
                        request.profile_height,
                    ),
                    content_mask: Some(resize_to_working_image(
                        &image::DynamicImage::ImageRgba8(
                            image::RgbaImage::from_raw(
                                decoded.canvas_width,
                                decoded.canvas_height,
                                frame.content_mask.clone(),
                            )
                            .ok_or_else(|| "GIF 内容掩码无效".to_string())?,
                        ),
                        request.profile_width,
                        request.profile_height,
                    )),
                    duration_ms: frame.duration_ms,
                })
            })
            .collect::<Result<Vec<_>, String>>()?;
        let total_duration_ms = frames
            .iter()
            .map(|frame| u32::from(frame.duration_ms))
            .sum();
        let mut sources = self
            .sources
            .lock()
            .map_err(|error| format!("图片源缓存不可用：{error}"))?;
        if self.generation.load(Ordering::Acquire) != generation {
            return Err("图片导入工作台已重置，请重新导入图片".to_string());
        }
        sources.insert(
            source_id.clone(),
            PreparedPixelizerSource {
                frames,
                source_width: decoded.canvas_width,
                source_height: decoded.canvas_height,
            },
        );
        tracing::info!(
            source_width = decoded.canvas_width,
            source_height = decoded.canvas_height,
            frame_count = decoded.frames.len(),
            total_duration_ms,
            "prepared custom face GIF pixelizer source"
        );
        Ok(PrepareCustomFaceGifPixelizerSourceResult {
            source_id,
            source_width: decoded.canvas_width,
            source_height: decoded.canvas_height,
            frame_count: decoded.frames.len(),
            total_duration_ms,
            duration_was_clamped: decoded.duration_was_clamped,
        })
    }

    pub fn pixelize_gif_source(
        &self,
        request: CustomFacePixelizeSourceRequest,
    ) -> Result<CustomFaceGifPixelizeResult, String> {
        let sources = self
            .sources
            .lock()
            .map_err(|error| format!("图片源缓存不可用：{error}"))?;
        let source = sources
            .get(&request.source_id)
            .ok_or_else(|| "图片源已失效，请重新导入图片".to_string())?;
        let mut frames = Vec::with_capacity(source.frames.len());
        for frame in &source.frames {
            let result = pixelize_decoded_image(
                &frame.image,
                frame.content_mask.as_ref(),
                source.source_width,
                source.source_height,
                request.profile_width,
                request.profile_height,
                &request.options,
            )?;
            frames.push(CustomFaceGifPixelizeFrameResult {
                duration_ms: frame.duration_ms,
                packed_pixels: result.packed_pixels,
                preview_pixels: result.preview_pixels,
                content_mask: result.content_mask,
            });
        }
        let total_duration_ms = frames
            .iter()
            .map(|frame| u32::from(frame.duration_ms))
            .sum();
        Ok(CustomFaceGifPixelizeResult {
            width: request.profile_width,
            height: request.profile_height,
            frames,
            source_width: source.source_width,
            source_height: source.source_height,
            total_duration_ms,
        })
    }

    pub fn release_source(&self, source_id: &str) -> bool {
        match self.sources.lock() {
            Ok(mut sources) => sources.remove(source_id).is_some(),
            Err(error) => {
                tracing::warn!(%error, "failed to lock custom face pixelizer source store");
                false
            }
        }
    }

    pub fn clear(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
        match self.sources.lock() {
            Ok(mut sources) => sources.clear(),
            Err(error) => tracing::warn!(%error, "failed to clear custom face pixelizer sources"),
        }
    }

    fn next_source_id(&self) -> String {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        format!("custom-face-image-source-{id}")
    }

    #[cfg(test)]
    pub fn set_before_insert_hook_for_test(&self, hook: impl FnOnce() + Send + 'static) {
        if let Ok(mut before_insert_hook) = self.before_insert_hook.lock() {
            *before_insert_hook = Some(Box::new(hook));
        }
    }

    #[cfg(test)]
    fn run_before_insert_hook(&self) {
        let hook = self
            .before_insert_hook
            .lock()
            .ok()
            .and_then(|mut before_insert_hook| before_insert_hook.take());
        if let Some(hook) = hook {
            hook();
        }
    }
}

pub fn pixelize_custom_face_image(
    app_home: &Path,
    request: CustomFacePixelizeRequest,
) -> Result<CustomFacePixelizeResult, String> {
    validate_image_bytes(&request.image_bytes)?;
    let image = image::load_from_memory(&request.image_bytes)
        .map_err(|error| format!("图片格式不支持或无法解码图片：{error}"))?;
    let source_width = image.width();
    let source_height = image.height();
    validate_image_dimensions(source_width, source_height)?;
    let target_width = request.profile_width;
    let target_height = request.profile_height;
    let result = pixelize_decoded_image(
        &image,
        None,
        source_width,
        source_height,
        target_width,
        target_height,
        &request.options,
    )?;

    let _ = custom_face_pixelizer_temp_dir(app_home);

    Ok(result)
}

fn pixelize_decoded_image(
    image: &image::DynamicImage,
    content_source: Option<&image::DynamicImage>,
    source_width: u32,
    source_height: u32,
    target_width: u32,
    target_height: u32,
    options: &CustomFacePixelizeOptions,
) -> Result<CustomFacePixelizeResult, String> {
    let (mut resized, image_content_mask) = render_image_to_target_canvas(
        &image,
        target_width,
        target_height,
        options.scale,
        options.rotation_deg,
        options.offset_x,
        options.offset_y,
        options.alpha_threshold,
    );
    let content_mask = content_source
        .map(|source| {
            render_image_to_target_canvas(
                source,
                target_width,
                target_height,
                options.scale,
                options.rotation_deg,
                options.offset_x,
                options.offset_y,
                options.alpha_threshold,
            )
            .1
        })
        .unwrap_or(image_content_mask);
    if options.contrast != 0 {
        contrast_in_place(&mut resized, options.contrast as f32);
    }
    if options.brightness != 0 {
        brighten_in_place(&mut resized, options.brightness as i32);
    }

    let mut mono_source = grayscale(&resized);
    if options.dither {
        dither(&mut mono_source, &BiLevel);
    }
    let packed_pixels = pack_pixels_from_luma(
        &mono_source,
        &content_mask,
        options.threshold,
        options.invert,
        options.background_invert,
    );
    let preview_pixels = match options.mode {
        CustomFacePixelizeMode::Mono => build_mono_preview_pixels(
            &mono_source,
            &content_mask,
            options.threshold,
            options.invert,
            options.background_invert,
        ),
        CustomFacePixelizeMode::Color => {
            build_color_preview_pixels(&resized, options.color_count, options.dither)?
        }
    };

    tracing::info!(
        source_width,
        source_height,
        target_width,
        target_height,
        mode = match options.mode {
            CustomFacePixelizeMode::Mono => "mono",
            CustomFacePixelizeMode::Color => "color",
        },
        color_count = options.color_count,
        dither = options.dither,
        invert = options.invert,
        background_invert = options.background_invert,
        alpha_threshold = options.alpha_threshold,
        scale = options.scale,
        rotation_deg = options.rotation_deg,
        offset_x = options.offset_x,
        offset_y = options.offset_y,
        "pixelizing custom face image"
    );

    Ok(CustomFacePixelizeResult {
        width: target_width,
        height: target_height,
        packed_pixels,
        preview_pixels,
        content_mask: content_mask.iter().map(|active| u8::from(*active)).collect(),
        source_width,
        source_height,
    })
}

pub fn custom_face_pixelizer_temp_dir(app_home: &Path) -> PathBuf {
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
    let target_edge = target_width.max(target_height) as f32;
    let max_edge = MAX_WORKING_IMAGE_EDGE.min((target_edge * MAX_PIXELIZER_SCALE).ceil() as u32);
    let max_edge = max_edge.max(1);
    if source_width <= max_edge && source_height <= max_edge {
        return image.clone();
    }
    let scale = (max_edge as f32 / source_width as f32).min(max_edge as f32 / source_height as f32);
    let working_width = ((source_width as f32) * scale).round().max(1.0) as u32;
    let working_height = ((source_height as f32) * scale).round().max(1.0) as u32;
    image.resize_exact(working_width, working_height, FilterType::Lanczos3)
}

fn build_color_preview_pixels(
    image: &image::RgbaImage,
    color_count: u16,
    dither_preview: bool,
) -> Result<Vec<u8>, String> {
    let color_count = color_count.clamp(2, 256) as usize;
    let mut preview = image.clone();
    let cmap = NeuQuant::new(1, color_count, preview.as_raw());
    if dither_preview {
        dither(&mut preview, &cmap);
    } else {
        preview
            .pixels_mut()
            .for_each(|pixel| cmap.map_pixel(pixel.channels_mut()));
    }
    Ok(preview.into_raw())
}

fn render_image_to_target_canvas(
    image: &image::DynamicImage,
    target_width: u32,
    target_height: u32,
    scale: f32,
    rotation_deg: i16,
    offset_x: i32,
    offset_y: i32,
    alpha_threshold: u8,
) -> (image::RgbaImage, Vec<bool>) {
    let scale = if scale.is_finite() {
        scale.clamp(0.1, MAX_PIXELIZER_SCALE)
    } else {
        1.0
    };
    let source_width = image.width();
    let source_height = image.height();
    let fit_scale = (target_width as f32 / source_width as f32)
        .min(target_height as f32 / source_height as f32);
    let object_scale = (fit_scale * scale).max(f32::EPSILON);
    let scaled_width = ((source_width as f32) * object_scale).round().max(1.0) as u32;
    let scaled_height = ((source_height as f32) * object_scale).round().max(1.0) as u32;
    let resized = image
        .resize_exact(scaled_width, scaled_height, FilterType::Lanczos3)
        .to_rgba8();
    let mut canvas =
        image::RgbaImage::from_pixel(target_width, target_height, image::Rgba([255, 255, 255, 0]));
    let mut mask = vec![false; (target_width as usize) * (target_height as usize)];
    render_transformed_object(
        &resized,
        &mut canvas,
        &mut mask,
        rotation_deg.clamp(-180, 180),
        offset_x,
        offset_y,
        alpha_threshold,
    );
    (canvas, mask)
}

fn render_transformed_object(
    source: &image::RgbaImage,
    canvas: &mut image::RgbaImage,
    mask: &mut [bool],
    rotation_deg: i16,
    offset_x: i32,
    offset_y: i32,
    alpha_threshold: u8,
) {
    let target_width = canvas.width();
    let target_height = canvas.height();
    let source_width = source.width();
    let source_height = source.height();
    if target_width == 0 || target_height == 0 || source_width == 0 || source_height == 0 {
        return;
    }

    let radians = (rotation_deg as f32).to_radians();
    let cos = radians.cos();
    let sin = radians.sin();
    let target_center_x = ((target_width as f32 - 1.0) / 2.0) + offset_x as f32;
    let target_center_y = ((target_height as f32 - 1.0) / 2.0) + offset_y as f32;
    let source_center_x = (source_width as f32 - 1.0) / 2.0;
    let source_center_y = (source_height as f32 - 1.0) / 2.0;

    for target_y in 0..target_height {
        for target_x in 0..target_width {
            let translated_x = target_x as f32 - target_center_x;
            let translated_y = target_y as f32 - target_center_y;
            let source_x = translated_x * cos + translated_y * sin + source_center_x;
            let source_y = -translated_x * sin + translated_y * cos + source_center_y;
            let source_x = source_x.round() as i32;
            let source_y = source_y.round() as i32;
            if source_x < 0
                || source_y < 0
                || source_x >= source_width as i32
                || source_y >= source_height as i32
            {
                continue;
            }
            let pixel = *source.get_pixel(source_x as u32, source_y as u32);
            canvas.put_pixel(target_x, target_y, pixel);
            if alpha_is_content(pixel.0[3], alpha_threshold) {
                mask[target_y as usize * target_width as usize + target_x as usize] = true;
            }
        }
    }
}

fn alpha_is_content(alpha: u8, alpha_threshold: u8) -> bool {
    // 阈值为 0 时保持旧行为：只要不是完全透明就算作图像内容。
    if alpha_threshold == 0 {
        return alpha > 0;
    }
    alpha >= alpha_threshold
}

fn pack_pixels_from_luma(
    image: &image::ImageBuffer<image::Luma<u8>, Vec<u8>>,
    content_mask: &[bool],
    threshold: u8,
    invert: bool,
    background_invert: bool,
) -> Vec<u8> {
    let width = image.width() as usize;
    let height = image.height() as usize;
    let mut pixels = vec![0_u8; width * height.div_ceil(8)];
    for y in 0..height {
        for x in 0..width {
            let mask_index = y * width + x;
            let in_content = content_mask.get(mask_index).copied().unwrap_or(false);
            let active = if in_content {
                let luminance = image.get_pixel(x as u32, y as u32).0[0];
                let mut active = luminance <= threshold;
                if invert {
                    active = !active;
                }
                active
            } else {
                background_invert
            };
            if !active {
                continue;
            }
            let index = x + (y / 8) * width;
            pixels[index] |= 1 << (y & 7);
        }
    }
    pixels
}

fn build_mono_preview_pixels(
    image: &image::ImageBuffer<image::Luma<u8>, Vec<u8>>,
    content_mask: &[bool],
    threshold: u8,
    invert: bool,
    background_invert: bool,
) -> Vec<u8> {
    let width = image.width() as usize;
    let height = image.height() as usize;
    let mut pixels = vec![0_u8; width * height * 4];
    for y in 0..height {
        for x in 0..width {
            let mask_index = y * width + x;
            let in_content = content_mask.get(mask_index).copied().unwrap_or(false);
            // 透明背景点亮只影响透明区域，避免污染 GIF 原始 contentMask 语义。
            let active = if in_content {
                let luminance = image.get_pixel(x as u32, y as u32).0[0];
                let mut active = luminance <= threshold;
                if invert {
                    active = !active;
                }
                active
            } else {
                background_invert
            };
            let offset = (y * width + x) * 4;
            if active {
                pixels[offset] = 255;
                pixels[offset + 1] = 255;
                pixels[offset + 2] = 255;
            }
            pixels[offset + 3] = if in_content || background_invert { 255 } else { 0 };
        }
    }
    pixels
}
