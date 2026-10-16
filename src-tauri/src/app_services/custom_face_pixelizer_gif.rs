use std::io::Cursor;

use gif::{ColorOutput, DecodeOptions, DisposalMethod};

const MAX_GIF_FILE_BYTES: usize = 10 * 1024 * 1024;
const MAX_GIF_PIXELS: u64 = 16_000_000;
const MAX_DECODED_FRAME_BYTES: usize = 64 * 1024 * 1024;
const MIN_FRAME_DURATION_MS: u16 = 50;
const MAX_FRAME_DURATION_MS: u16 = 5000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct DecodedGifFrame {
    pub(crate) duration_ms: u16,
    pub(crate) rgba_pixels: Vec<u8>,
    pub(crate) content_mask: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct DecodedGif {
    pub(crate) canvas_width: u32,
    pub(crate) canvas_height: u32,
    pub(crate) frames: Vec<DecodedGifFrame>,
    pub(crate) duration_was_clamped: bool,
}

pub(crate) fn decode_gif(bytes: &[u8]) -> Result<DecodedGif, String> {
    if bytes.is_empty() {
        return Err("GIF 文件为空".to_string());
    }
    if bytes.len() > MAX_GIF_FILE_BYTES {
        return Err("GIF 文件超过 10 MiB 限制".to_string());
    }

    let mut options = DecodeOptions::new();
    options.set_color_output(ColorOutput::RGBA);
    let mut reader = options
        .read_info(Cursor::new(bytes))
        .map_err(|error| format!("GIF 文件无法解析：{error}"))?;
    let width = u32::from(reader.width());
    let height = u32::from(reader.height());
    let pixels = u64::from(width) * u64::from(height);
    if width == 0 || height == 0 || pixels > MAX_GIF_PIXELS {
        return Err("GIF 画布尺寸超过支持范围".to_string());
    }
    let canvas_bytes = pixels
        .checked_mul(4)
        .and_then(|bytes| usize::try_from(bytes).ok())
        .ok_or_else(|| "GIF 画布内存大小无效".to_string())?;
    let mut canvas = vec![0_u8; canvas_bytes];
    let mut frames = Vec::new();
    let mut decoded_bytes = 0usize;
    let mut duration_was_clamped = false;

    while let Some(frame) = reader
        .read_next_frame()
        .map_err(|error| format!("GIF 帧无法解析：{error}"))?
    {
        let frame_width = u32::from(frame.width);
        let frame_height = u32::from(frame.height);
        let left = u32::from(frame.left);
        let top = u32::from(frame.top);
        let frame_pixels = u64::from(frame_width) * u64::from(frame_height);
        if left
            .checked_add(frame_width)
            .is_none_or(|right| right > width)
            || top
                .checked_add(frame_height)
                .is_none_or(|bottom| bottom > height)
            || frame.buffer.len() != usize::try_from(frame_pixels * 4).unwrap_or(usize::MAX)
        {
            return Err("GIF 帧区域或像素数据无效".to_string());
        }

        let previous_canvas = if frame.dispose == DisposalMethod::Previous {
            Some(canvas.clone())
        } else {
            None
        };
        for y in 0..frame_height {
            for x in 0..frame_width {
                let source = usize::try_from((y * frame_width + x) * 4).unwrap_or(usize::MAX);
                let target =
                    usize::try_from(((top + y) * width + left + x) * 4).unwrap_or(usize::MAX);
                let alpha = frame.buffer[source + 3];
                if alpha == 0 {
                    continue;
                }
                canvas[target..target + 4].copy_from_slice(&frame.buffer[source..source + 4]);
            }
        }
        let mut content_mask = vec![0_u8; canvas_bytes];
        for y in 0..frame_height {
            for x in 0..frame_width {
                let source = usize::try_from((y * frame_width + x) * 4).unwrap_or(usize::MAX);
                if frame.buffer[source + 3] == 0 {
                    continue;
                }
                let target = usize::try_from(((top + y) * width + left + x) * 4).unwrap_or(usize::MAX);
                content_mask[target + 3] = 255;
            }
        }

        let duration_ms = u32::from(frame.delay) * 10;
        let clamped_duration = duration_ms.clamp(
            u32::from(MIN_FRAME_DURATION_MS),
            u32::from(MAX_FRAME_DURATION_MS),
        ) as u16;
        duration_was_clamped |= duration_ms != u32::from(clamped_duration);
        decoded_bytes = decoded_bytes
            .checked_add(canvas.len())
            .ok_or_else(|| "GIF 解码帧占用内存过大".to_string())?;
        if decoded_bytes > MAX_DECODED_FRAME_BYTES {
            return Err("GIF 解码帧占用内存超过 64 MiB 限制".to_string());
        }
        frames.push(DecodedGifFrame {
            duration_ms: clamped_duration,
            rgba_pixels: canvas.clone(),
            content_mask,
        });

        match frame.dispose {
            DisposalMethod::Background => {
                clear_rect(&mut canvas, width, left, top, frame_width, frame_height);
            }
            DisposalMethod::Previous => {
                if let Some(previous_canvas) = previous_canvas {
                    canvas = previous_canvas;
                }
            }
            DisposalMethod::Any | DisposalMethod::Keep => {}
        }
    }

    if frames.is_empty() {
        return Err("GIF 不包含有效帧".to_string());
    }
    Ok(DecodedGif {
        canvas_width: width,
        canvas_height: height,
        frames,
        duration_was_clamped,
    })
}

fn clear_rect(canvas: &mut [u8], canvas_width: u32, left: u32, top: u32, width: u32, height: u32) {
    for y in top..top + height {
        let start = usize::try_from((y * canvas_width + left) * 4).unwrap_or(0);
        let end = start + usize::try_from(width * 4).unwrap_or(0);
        canvas[start..end].fill(0);
    }
}

#[cfg(test)]
mod tests {
    use gif::{Encoder, Frame, Repeat};

    use super::decode_gif;

    fn two_frame_gif() -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut encoder = Encoder::new(&mut bytes, 2, 2, &[0, 0, 0, 255, 0, 0]).unwrap();
            encoder.set_repeat(Repeat::Infinite).unwrap();
            let mut first = Frame::default();
            first.width = 2;
            first.height = 2;
            first.delay = 0;
            first.buffer = vec![1, 0, 0, 0].into();
            encoder.write_frame(&first).unwrap();
            let mut second = Frame::default();
            second.width = 1;
            second.height = 1;
            second.left = 1;
            second.top = 1;
            second.delay = 600;
            second.buffer = vec![1].into();
            encoder.write_frame(&second).unwrap();
        }
        bytes
    }

    #[test]
    fn decodes_full_rgba_frames_and_clamps_delays() {
        let decoded = decode_gif(&two_frame_gif()).expect("GIF should decode");

        assert_eq!(decoded.canvas_width, 2);
        assert_eq!(decoded.canvas_height, 2);
        assert_eq!(decoded.frames.len(), 2);
        assert_eq!(decoded.frames[0].duration_ms, 50);
        assert_eq!(decoded.frames[1].duration_ms, 5000);
        assert_eq!(decoded.frames[1].rgba_pixels.len(), 2 * 2 * 4);
        assert_eq!(decoded.frames[1].rgba_pixels[3], 255);
    }
}
