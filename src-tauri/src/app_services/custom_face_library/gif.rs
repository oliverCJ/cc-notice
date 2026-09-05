use std::io::Cursor;
use std::path::Path;

use gif::{DisposalMethod, Encoder, Frame, Repeat};
use image::{ImageBuffer, Rgba, RgbaImage};

use crate::core::custom_faces::contract_generated::custom_face_profile_by_id;
use crate::core::custom_faces::{validate_face_for_profile, CustomFace};
use crate::infrastructure::file_config;

use super::model::{CustomFaceGifExportResult, CustomFaceLibraryError};
use super::service::CustomFaceLibraryService;

const GIF_BACKGROUND: [u8; 3] = [12, 18, 24];
const MAX_GIF_SCALE: u8 = 8;
const MAX_GIF_DIMENSION: usize = 2_048;
const MAX_GIF_PIXELS: usize = 2_097_152;
const MAX_GIF_RAW_FRAME_BYTES: usize = 16 * 1024 * 1024;
const MAX_GIF_FILE_BYTES: usize = 10 * 1024 * 1024;

impl CustomFaceLibraryService {
    pub fn export_face_gif(
        &self,
        face: &CustomFace,
        display_profile_id: &str,
        path: &Path,
        scale: u8,
        invert: bool,
        transparent_background: bool,
        frame_indices: &[usize],
    ) -> Result<CustomFaceGifExportResult, CustomFaceLibraryError> {
        validate_face_for_profile(display_profile_id, face)?;
        let profile = custom_face_profile_by_id(display_profile_id).ok_or_else(|| {
            CustomFaceLibraryError::InvalidFramesFile(display_profile_id.to_string())
        })?;

        let selected_frames: Vec<_> = if frame_indices.is_empty() {
            face.frames.iter().collect()
        } else {
            let mut unique_indices: Vec<_> = frame_indices.iter().copied().collect();
            unique_indices.sort_unstable();
            unique_indices.dedup();
            unique_indices.retain(|&i| i < face.frames.len());
            if unique_indices.is_empty() {
                return Err(CustomFaceLibraryError::InvalidGifExport(
                    "no valid frame indices".into(),
                ));
            }
            unique_indices.iter().map(|&i| &face.frames[i]).collect()
        };

        let (width, height, frame_bytes) =
            gif_output_size(profile.width, profile.height, selected_frames.len(), scale)?;

        let (palette, transparent_index, active_color_index, background_color_index) =
            if transparent_background {
                let palette = if invert {
                    [255, 255, 255, 0, 0, 0]
                } else {
                    [0, 0, 0, 0, 0, 0]
                };
                (palette, Some(1u8), 0u8, 1u8)
            } else if invert {
                let palette = [
                    face.color.red,
                    face.color.green,
                    face.color.blue,
                    GIF_BACKGROUND[0],
                    GIF_BACKGROUND[1],
                    GIF_BACKGROUND[2],
                ];
                (palette, None, 1u8, 0u8)
            } else {
                let palette = [
                    GIF_BACKGROUND[0],
                    GIF_BACKGROUND[1],
                    GIF_BACKGROUND[2],
                    face.color.red,
                    face.color.green,
                    face.color.blue,
                ];
                (palette, None, 1u8, 0u8)
            };

        let mut output = Cursor::new(Vec::new());
        {
            let mut encoder =
                Encoder::new(&mut output, width, height, &palette).map_err(gif_error)?;
            encoder.set_repeat(Repeat::Infinite).map_err(gif_error)?;
            for source in &selected_frames {
                let frame = Frame {
                    delay: quantize_delay_centiseconds(source.duration_ms),
                    dispose: DisposalMethod::Background,
                    transparent: transparent_index,
                    needs_user_input: false,
                    left: 0,
                    top: 0,
                    width,
                    height,
                    interlaced: false,
                    palette: None,
                    buffer: pixel_art_frame_scaled(
                        &source.packed_pixels,
                        profile.width,
                        profile.height,
                        scale,
                        frame_bytes,
                        active_color_index,
                        background_color_index,
                    )?
                    .into(),
                };
                encoder.write_frame(&frame).map_err(gif_error)?;
            }
        }
        let output = output.into_inner();
        if output.len() > MAX_GIF_FILE_BYTES {
            return Err(CustomFaceLibraryError::InvalidGifExport(
                "encoded GIF exceeds 10 MiB".into(),
            ));
        }
        file_config::write_bytes_atomic(path, &output).map_err(CustomFaceLibraryError::Io)?;
        let frame_delays_ms = selected_frames
            .iter()
            .map(|frame| u16::from(quantize_delay_centiseconds(frame.duration_ms)) * 10)
            .collect::<Vec<_>>();
        let total_duration_ms = frame_delays_ms.iter().map(|delay| u32::from(*delay)).sum();
        tracing::info!(path = %path.display(), face_id = %face.face_id, "custom face GIF exported");
        Ok(CustomFaceGifExportResult {
            frame_delays_ms,
            total_duration_ms,
        })
    }

    pub fn export_face_png(
        &self,
        packed_pixels: &[u8],
        display_profile_id: &str,
        path: &Path,
        scale: u8,
        invert: bool,
        transparent_background: bool,
    ) -> Result<(), CustomFaceLibraryError> {
        let profile = custom_face_profile_by_id(display_profile_id).ok_or_else(|| {
            CustomFaceLibraryError::InvalidFramesFile(display_profile_id.to_string())
        })?;

        if !(1..=MAX_GIF_SCALE).contains(&scale) {
            return Err(CustomFaceLibraryError::InvalidGifExport(
                "scale must be an integer from 1 to 8".into(),
            ));
        }

        let source_width = usize::from(profile.width);
        let source_height = usize::from(profile.height);
        let expected_bytes = source_width * ((source_height + 7) / 8);
        if packed_pixels.len() != expected_bytes {
            return Err(CustomFaceLibraryError::InvalidGifExport(
                "packed framebuffer length mismatch".into(),
            ));
        }

        let scaled_width = source_width
            .checked_mul(usize::from(scale))
            .and_then(|w| u16::try_from(w).ok())
            .filter(|&w| w as usize <= MAX_GIF_DIMENSION)
            .ok_or_else(|| {
                CustomFaceLibraryError::InvalidGifExport("scaled width out of range".into())
            })?;

        let scaled_height = source_height
            .checked_mul(usize::from(scale))
            .and_then(|h| u16::try_from(h).ok())
            .filter(|&h| h as usize <= MAX_GIF_DIMENSION)
            .ok_or_else(|| {
                CustomFaceLibraryError::InvalidGifExport("scaled height out of range".into())
            })?;

        let total_pixels = (scaled_width as usize)
            .checked_mul(scaled_height as usize)
            .filter(|&p| p <= MAX_GIF_PIXELS)
            .ok_or_else(|| {
                CustomFaceLibraryError::InvalidGifExport("scaled pixel count exceeds limit".into())
            })?;

        let (active_color, background_color) = if transparent_background {
            let opaque_black = Rgba([0, 0, 0, 255]);
            let transparent = Rgba([0, 0, 0, 0]);
            (opaque_black, transparent)
        } else if invert {
            (Rgba([0, 0, 0, 255]), Rgba([255, 255, 255, 255]))
        } else {
            (Rgba([255, 255, 255, 255]), Rgba([0, 0, 0, 255]))
        };

        let mut img: RgbaImage =
            ImageBuffer::from_pixel(scaled_width as u32, scaled_height as u32, background_color);

        for y in 0..source_height {
            for x in 0..source_width {
                let source_index = x + (y / 8) * source_width;
                let active = packed_pixels.get(source_index).ok_or_else(|| {
                    CustomFaceLibraryError::InvalidGifExport(
                        "source framebuffer index out of bounds".into(),
                    )
                })? & (1 << (y & 7))
                    != 0;

                if active {
                    for sy in 0..scale {
                        for sx in 0..scale {
                            let px = (x * usize::from(scale) + usize::from(sx)) as u32;
                            let py = (y * usize::from(scale) + usize::from(sy)) as u32;
                            img.put_pixel(px, py, active_color);
                        }
                    }
                }
            }
        }

        img.save(path)
            .map_err(|e| CustomFaceLibraryError::Io(format!("PNG encoding failed: {e}")))?;
        tracing::info!(path = %path.display(), profile = %display_profile_id, "custom face PNG exported");
        Ok(())
    }
}

fn gif_output_size(
    source_width: u16,
    source_height: u16,
    frame_count: usize,
    scale: u8,
) -> Result<(u16, u16, usize), CustomFaceLibraryError> {
    if !(1..=MAX_GIF_SCALE).contains(&scale) {
        return Err(CustomFaceLibraryError::InvalidGifExport(
            "scale must be an integer from 1 to 8".into(),
        ));
    }
    let width = usize::from(source_width)
        .checked_mul(usize::from(scale))
        .ok_or_else(|| CustomFaceLibraryError::InvalidGifExport("scaled width overflows".into()))?;
    let height = usize::from(source_height)
        .checked_mul(usize::from(scale))
        .ok_or_else(|| {
            CustomFaceLibraryError::InvalidGifExport("scaled height overflows".into())
        })?;
    let frame_bytes = width
        .checked_mul(height)
        .filter(|pixels| *pixels <= MAX_GIF_PIXELS)
        .ok_or_else(|| {
            CustomFaceLibraryError::InvalidGifExport("scaled GIF has too many pixels".into())
        })?;
    let total_bytes = frame_bytes
        .checked_mul(frame_count)
        .filter(|bytes| *bytes <= MAX_GIF_RAW_FRAME_BYTES)
        .ok_or_else(|| {
            CustomFaceLibraryError::InvalidGifExport("GIF frames require too much memory".into())
        })?;
    let _ = total_bytes;
    if width > MAX_GIF_DIMENSION || height > MAX_GIF_DIMENSION {
        return Err(CustomFaceLibraryError::InvalidGifExport(
            "scaled GIF exceeds 2048 pixels per side".into(),
        ));
    }
    Ok((
        u16::try_from(width).map_err(|_| {
            CustomFaceLibraryError::InvalidGifExport("scaled width is invalid".into())
        })?,
        u16::try_from(height).map_err(|_| {
            CustomFaceLibraryError::InvalidGifExport("scaled height is invalid".into())
        })?,
        frame_bytes,
    ))
}

fn pixel_art_frame_scaled(
    pixels: &[u8],
    source_width: u16,
    source_height: u16,
    scale: u8,
    frame_bytes: usize,
    active_color_index: u8,
    background_color_index: u8,
) -> Result<Vec<u8>, CustomFaceLibraryError> {
    let source_width = usize::from(source_width);
    let source_height = usize::from(source_height);
    let scale = usize::from(scale);
    let output_width = source_width
        .checked_mul(scale)
        .ok_or_else(|| CustomFaceLibraryError::InvalidGifExport("scaled width overflows".into()))?;
    let mut indexed = vec![background_color_index; frame_bytes];
    for y in 0..source_height {
        for x in 0..source_width {
            let source = x
                .checked_add((y / 8).checked_mul(source_width).ok_or_else(|| {
                    CustomFaceLibraryError::InvalidGifExport("source index overflows".into())
                })?)
                .ok_or_else(|| {
                    CustomFaceLibraryError::InvalidGifExport("source index overflows".into())
                })?;
            let active = pixels.get(source).ok_or_else(|| {
                CustomFaceLibraryError::InvalidGifExport("source framebuffer is invalid".into())
            })? & (1 << (y & 7))
                != 0;
            if !active {
                continue;
            }
            for scaled_y in 0..scale {
                let row = (y * scale + scaled_y)
                    .checked_mul(output_width)
                    .ok_or_else(|| {
                        CustomFaceLibraryError::InvalidGifExport("output row overflows".into())
                    })?;
                for scaled_x in 0..scale {
                    let target = row.checked_add(x * scale + scaled_x).ok_or_else(|| {
                        CustomFaceLibraryError::InvalidGifExport("output index overflows".into())
                    })?;
                    *indexed.get_mut(target).ok_or_else(|| {
                        CustomFaceLibraryError::InvalidGifExport("output buffer is invalid".into())
                    })? = active_color_index;
                }
            }
        }
    }
    Ok(indexed)
}

fn quantize_delay_centiseconds(duration_ms: u16) -> u16 {
    let centiseconds = (u32::from(duration_ms) + 5) / 10;
    u16::try_from(centiseconds.max(1)).unwrap_or(u16::MAX)
}

fn gif_error(error: gif::EncodingError) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Io(format!("GIF encoding failed: {error}"))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use gif::DecodeOptions;

    use super::*;
    use crate::core::custom_faces::{CustomFaceColor, CustomFaceFrame};

    fn test_face() -> CustomFace {
        let mut pixels = vec![0; 512];
        pixels[0] = 1;
        CustomFace {
            face_id: "00000000-0000-4000-8000-000000000111".into(),
            name: "Ready".into(),
            color: CustomFaceColor {
                red: 0x12,
                green: 0x34,
                blue: 0x56,
            },
            frames: vec![CustomFaceFrame {
                duration_ms: 205,
                packed_pixels: pixels,
            }],
        }
    }

    fn multi_frame_face() -> CustomFace {
        let durations = [600, 600, 600, 200, 500];
        let frames = durations
            .into_iter()
            .enumerate()
            .map(|(index, duration_ms)| {
                let mut pixels = vec![0; 1024];
                let x = index * 17 + 3;
                let y = index * 11 + 2;
                pixels[x + (y / 8) * 128] = 1 << (y & 7);
                CustomFaceFrame {
                    duration_ms,
                    packed_pixels: pixels,
                }
            })
            .collect();
        CustomFace {
            face_id: "00000000-0000-4000-8000-000000000112".into(),
            name: "Sequence".into(),
            color: CustomFaceColor {
                red: 0xff,
                green: 0xff,
                blue: 0xff,
            },
            frames,
        }
    }

    #[test]
    fn preserves_50ms_frame_delay_in_gif_centiseconds() {
        let root = std::env::temp_dir().join(format!("ccface-gif-{}", uuid::Uuid::new_v4()));
        let path = root.join("fast.gif");
        let mut face = test_face();
        face.frames[0].duration_ms = 50;
        let service = CustomFaceLibraryService::new(root.clone());
        let result = service
            .export_face_gif(&face, "custom-mono-128x32-v1", &path, 1, false, false, &[])
            .unwrap();
        assert_eq!(result.frame_delays_ms, vec![50]);
        assert_eq!(result.total_duration_ms, 50);

        let mut options = DecodeOptions::new();
        options.set_color_output(gif::ColorOutput::Indexed);
        let mut reader = options.read_info(fs::File::open(&path).unwrap()).unwrap();
        let frame = reader.read_next_frame().unwrap().unwrap();
        assert_eq!(frame.delay, 5);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn exports_real_profile_size_and_rounds_frame_delay() {
        let root = std::env::temp_dir().join(format!("ccface-gif-{}", uuid::Uuid::new_v4()));
        let path = root.join("ready.gif");
        let service = CustomFaceLibraryService::new(root.clone());
        let result = service
            .export_face_gif(
                &test_face(),
                "custom-mono-128x32-v1",
                &path,
                1,
                false,
                false,
                &[],
            )
            .unwrap();
        assert_eq!(result.frame_delays_ms, vec![210]);
        assert_eq!(result.total_duration_ms, 210);

        let mut options = DecodeOptions::new();
        options.set_color_output(gif::ColorOutput::Indexed);
        let mut reader = options.read_info(fs::File::open(&path).unwrap()).unwrap();
        assert_eq!(reader.width(), 128);
        assert_eq!(reader.height(), 32);
        let frame = reader.read_next_frame().unwrap().unwrap();
        assert_eq!(frame.delay, 21);
        assert_eq!(frame.buffer[0], 1);
        assert_eq!(frame.buffer[1], 0);
        assert_eq!(frame.buffer[129], 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn scales_pixels_with_nearest_neighbor_blocks() {
        let root = std::env::temp_dir().join(format!("ccface-gif-{}", uuid::Uuid::new_v4()));
        let path = root.join("ready-2x.gif");
        let service = CustomFaceLibraryService::new(root.clone());
        service
            .export_face_gif(
                &test_face(),
                "custom-mono-128x32-v1",
                &path,
                2,
                false,
                false,
                &[],
            )
            .unwrap();

        let mut options = DecodeOptions::new();
        options.set_color_output(gif::ColorOutput::Indexed);
        let mut reader = options.read_info(fs::File::open(&path).unwrap()).unwrap();
        assert_eq!(reader.width(), 256);
        assert_eq!(reader.height(), 64);
        let frame = reader.read_next_frame().unwrap().unwrap();
        assert_eq!(frame.buffer[0], 1);
        assert_eq!(frame.buffer[1], 1);
        assert_eq!(frame.buffer[256], 1);
        assert_eq!(frame.buffer[257], 1);
        assert_eq!(frame.buffer[2], 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn limits_scale_and_allows_large_profile_at_four_times() {
        let service = CustomFaceLibraryService::new(std::env::temp_dir());
        assert!(matches!(
            service.export_face_gif(
                &test_face(),
                "custom-mono-128x32-v1",
                Path::new("/tmp/ignored.gif"),
                9,
                false,
                false,
                &[],
            ),
            Err(CustomFaceLibraryError::InvalidGifExport(_))
        ));
        assert_eq!(
            gif_output_size(320, 240, 10, 4).unwrap(),
            (1280, 960, 1_228_800)
        );
    }

    #[test]
    fn preserves_five_full_frames_in_source_order() {
        let root = std::env::temp_dir().join(format!("ccface-gif-{}", uuid::Uuid::new_v4()));
        let path = root.join("sequence.gif");
        let service = CustomFaceLibraryService::new(root.clone());
        let face = multi_frame_face();
        let result = service
            .export_face_gif(&face, "custom-mono-128x64-v1", &path, 1, false, false, &[])
            .unwrap();
        assert_eq!(result.frame_delays_ms, vec![600, 600, 600, 200, 500]);

        let mut options = DecodeOptions::new();
        options.set_color_output(gif::ColorOutput::Indexed);
        let mut reader = options.read_info(fs::File::open(&path).unwrap()).unwrap();
        for source in &face.frames {
            let frame = reader.read_next_frame().unwrap().unwrap();
            assert_eq!(frame.left, 0);
            assert_eq!(frame.top, 0);
            assert_eq!(frame.width, 128);
            assert_eq!(frame.height, 64);
            assert_eq!(frame.delay, quantize_delay_centiseconds(source.duration_ms));
            assert_eq!(frame.dispose, DisposalMethod::Background);
            assert_eq!(frame.transparent, None);
            assert!(!frame.interlaced);
            assert!(frame.palette.is_none());
            assert_eq!(
                frame.buffer.as_ref(),
                pixel_art_frame_scaled(&source.packed_pixels, 128, 64, 1, 8_192, 1, 0)
                    .unwrap()
                    .as_slice()
            );
        }
        assert!(reader.read_next_frame().unwrap().is_none());
        let _ = fs::remove_dir_all(root);
    }
}
