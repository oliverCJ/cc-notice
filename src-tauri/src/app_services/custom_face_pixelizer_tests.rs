use crate::app_services::custom_face_pixelizer::{
    custom_face_pixelizer_temp_dir, pixelize_custom_face_image, CustomFacePixelizeMode,
    CustomFacePixelizeOptions, CustomFacePixelizeRequest, CustomFacePixelizeSourceRequest,
    CustomFacePixelizerSourceStore, PrepareCustomFacePixelizerSourceRequest,
};
use crate::test_support::unique_temp_root;

fn png_8x8_checker() -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_fn(8, 8, |x, y| {
        if (x + y) % 2 == 0 {
            image::Rgba([0, 0, 0, 255])
        } else {
            image::Rgba([255, 255, 255, 255])
        }
    });
    image::DynamicImage::ImageRgba8(image)
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageOutputFormat::Png,
        )
        .expect("png should encode");
    bytes
}

fn png_8x8_color_blocks() -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_fn(8, 8, |x, y| match (x + y) % 4 {
        0 => image::Rgba([255, 0, 0, 255]),
        1 => image::Rgba([0, 255, 0, 255]),
        2 => image::Rgba([0, 0, 255, 255]),
        _ => image::Rgba([255, 255, 0, 255]),
    });
    image::DynamicImage::ImageRgba8(image)
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageOutputFormat::Png,
        )
        .expect("png should encode");
    bytes
}

fn png_1x1(color: [u8; 4]) -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_fn(1, 1, |_, _| image::Rgba(color));
    image::DynamicImage::ImageRgba8(image)
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageOutputFormat::Png,
        )
        .expect("png should encode");
    bytes
}

fn png_2x2_black() -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_pixel(2, 2, image::Rgba([0, 0, 0, 255]));
    image::DynamicImage::ImageRgba8(image)
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageOutputFormat::Png,
        )
        .expect("png should encode");
    bytes
}

fn png_solid(width: u32, height: u32, color: [u8; 4]) -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_pixel(width, height, image::Rgba(color));
    image::DynamicImage::ImageRgba8(image)
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageOutputFormat::Png,
        )
        .expect("png should encode");
    bytes
}

fn default_options() -> CustomFacePixelizeOptions {
    CustomFacePixelizeOptions {
        mode: CustomFacePixelizeMode::Mono,
        color_count: 8,
        dither: true,
        invert: false,
        threshold: 128,
        contrast: 0,
        brightness: 0,
        scale: 1.0,
        offset_x: 0,
        offset_y: 0,
    }
}

fn packed_pixel_active(pixels: &[u8], width: usize, x: usize, y: usize) -> bool {
    let index = x + (y / 8) * width;
    pixels[index] & (1 << (y & 7)) != 0
}

#[test]
fn mono_preview_respects_invert() {
    let root = unique_temp_root("cc-notice-pixelizer-service-invert");
    let normal = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 1,
            profile_height: 1,
            image_bytes: png_1x1([255, 255, 255, 255]),
            options: CustomFacePixelizeOptions {
                mode: CustomFacePixelizeMode::Mono,
                color_count: 8,
                dither: false,
                invert: false,
                threshold: 128,
                contrast: 0,
                brightness: 0,
                scale: 1.0,
                offset_x: 0,
                offset_y: 0,
            },
        },
    )
    .expect("png should pixelize");
    let inverted = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 1,
            profile_height: 1,
            image_bytes: png_1x1([255, 255, 255, 255]),
            options: CustomFacePixelizeOptions {
                mode: CustomFacePixelizeMode::Mono,
                color_count: 8,
                dither: false,
                invert: true,
                threshold: 128,
                contrast: 0,
                brightness: 0,
                scale: 1.0,
                offset_x: 0,
                offset_y: 0,
            },
        },
    )
    .expect("png should pixelize with invert");

    assert_eq!(normal.preview_pixels.len(), 4);
    assert_eq!(inverted.preview_pixels.len(), 4);
    assert_eq!(normal.preview_pixels[0], 0);
    assert_eq!(inverted.preview_pixels[0], 255);
    assert_ne!(normal.preview_pixels, inverted.preview_pixels);
    assert_ne!(normal.packed_pixels, inverted.packed_pixels);
}

#[test]
fn applies_scale_and_offset_before_mono_packing() {
    let root = unique_temp_root("cc-notice-pixelizer-service-transform");
    let result = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 8,
            profile_height: 8,
            image_bytes: png_2x2_black(),
            options: CustomFacePixelizeOptions {
                scale: 0.5,
                offset_x: 2,
                offset_y: 0,
                dither: false,
                ..default_options()
            },
        },
    )
    .expect("png should pixelize with transform");

    assert_eq!(8, result.width);
    assert_eq!(8, result.height);
    assert!(!packed_pixel_active(&result.packed_pixels, 8, 3, 2));
    assert!(packed_pixel_active(&result.packed_pixels, 8, 4, 2));
    assert!(packed_pixel_active(&result.packed_pixels, 8, 7, 5));
    assert!(!packed_pixel_active(&result.packed_pixels, 8, 4, 1));
    assert!(!packed_pixel_active(&result.packed_pixels, 8, 4, 6));
}

#[test]
fn fits_source_aspect_ratio_before_applying_object_offset() {
    let root = unique_temp_root("cc-notice-pixelizer-service-aspect-fit");
    let centered = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 8,
            profile_height: 4,
            image_bytes: png_2x2_black(),
            options: CustomFacePixelizeOptions {
                dither: false,
                ..default_options()
            },
        },
    )
    .expect("png should pixelize with aspect fit");
    let shifted = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 8,
            profile_height: 4,
            image_bytes: png_2x2_black(),
            options: CustomFacePixelizeOptions {
                offset_x: 2,
                dither: false,
                ..default_options()
            },
        },
    )
    .expect("png should pixelize with object offset");

    assert!(!packed_pixel_active(&centered.packed_pixels, 8, 1, 1));
    assert!(packed_pixel_active(&centered.packed_pixels, 8, 2, 1));
    assert!(packed_pixel_active(&centered.packed_pixels, 8, 5, 1));
    assert!(!packed_pixel_active(&centered.packed_pixels, 8, 6, 1));

    assert!(!packed_pixel_active(&shifted.packed_pixels, 8, 3, 1));
    assert!(packed_pixel_active(&shifted.packed_pixels, 8, 4, 1));
    assert!(packed_pixel_active(&shifted.packed_pixels, 8, 7, 1));
}

#[test]
fn keeps_large_source_fit_inside_target_canvas_by_default() {
    let root = unique_temp_root("cc-notice-pixelizer-service-large-source-fit");
    let result = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 8,
            profile_height: 8,
            image_bytes: png_solid(100, 50, [0, 0, 0, 255]),
            options: CustomFacePixelizeOptions {
                dither: false,
                ..default_options()
            },
        },
    )
    .expect("large png should pixelize with aspect fit");

    assert!(!packed_pixel_active(&result.packed_pixels, 8, 4, 1));
    assert!(packed_pixel_active(&result.packed_pixels, 8, 4, 2));
    assert!(packed_pixel_active(&result.packed_pixels, 8, 4, 5));
    assert!(!packed_pixel_active(&result.packed_pixels, 8, 4, 6));
}

#[test]
fn pixelizes_png_bytes_into_packed_pixels() {
    let root = unique_temp_root("cc-notice-pixelizer-service");
    let result = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 128,
            profile_height: 32,
            image_bytes: png_8x8_checker(),
            options: default_options(),
        },
    )
    .expect("png should pixelize");

    assert_eq!(128, result.width);
    assert_eq!(32, result.height);
    assert_eq!(128 * 4, result.packed_pixels.len());
    assert_eq!(128 * 32 * 4, result.preview_pixels.len());
    assert!(result.packed_pixels.iter().any(|value| *value != 0));
}

#[test]
fn pixelizes_png_bytes_into_color_preview() {
    let root = unique_temp_root("cc-notice-pixelizer-service-color");
    let result = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 16,
            profile_height: 16,
            image_bytes: png_8x8_color_blocks(),
            options: CustomFacePixelizeOptions {
                mode: CustomFacePixelizeMode::Color,
                color_count: 4,
                dither: true,
                invert: false,
                threshold: 128,
                contrast: 0,
                brightness: 0,
                scale: 1.0,
                offset_x: 0,
                offset_y: 0,
            },
        },
    )
    .expect("png should pixelize in color mode");

    assert_eq!(16 * 16 * 4, result.preview_pixels.len());
    assert!(result
        .preview_pixels
        .chunks(4)
        .any(|pixel| pixel[0] != pixel[1] || pixel[1] != pixel[2]));
}

#[test]
fn accepts_max_color_palette_for_preview() {
    let root = unique_temp_root("cc-notice-pixelizer-service-color-256");
    let result = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 8,
            profile_height: 8,
            image_bytes: png_8x8_checker(),
            options: CustomFacePixelizeOptions {
                mode: CustomFacePixelizeMode::Color,
                color_count: 256,
                dither: false,
                invert: false,
                threshold: 128,
                contrast: 0,
                brightness: 0,
                scale: 1.0,
                offset_x: 0,
                offset_y: 0,
            },
        },
    )
    .expect("png should pixelize with the max palette size");

    assert_eq!(8 * 8 * 4, result.preview_pixels.len());
}

#[test]
fn rejects_non_image_bytes() {
    let root = unique_temp_root("cc-notice-pixelizer-invalid");
    let error = pixelize_custom_face_image(
        &root,
        CustomFacePixelizeRequest {
            profile_width: 128,
            profile_height: 32,
            image_bytes: b"not an image".to_vec(),
            options: default_options(),
        },
    )
    .expect_err("invalid image should fail");

    assert!(error.contains("图片格式不支持") || error.contains("无法解码图片"));
}

#[test]
fn creates_fixed_temp_dir_under_app_home() {
    let root = unique_temp_root("cc-notice-pixelizer-temp-dir");
    let temp_dir = custom_face_pixelizer_temp_dir(&root);

    assert_eq!(root.join("tmp").join("custom-face-pixelizer"), temp_dir);
}

#[test]
fn prepares_bounded_working_source_and_pixelizes_by_source_id() {
    let store = CustomFacePixelizerSourceStore::default();
    let prepared = store
        .prepare_source(PrepareCustomFacePixelizerSourceRequest {
            profile_width: 128,
            profile_height: 128,
            image_bytes: png_solid(2000, 1000, [0, 0, 0, 255]),
        })
        .expect("large png should prepare");

    assert_eq!(2000, prepared.source_width);
    assert_eq!(1000, prepared.source_height);
    assert_eq!(512, prepared.working_width);
    assert_eq!(256, prepared.working_height);
    assert!(!prepared.source_id.is_empty());

    let result = store
        .pixelize_source(CustomFacePixelizeSourceRequest {
            source_id: prepared.source_id.clone(),
            profile_width: 128,
            profile_height: 128,
            options: CustomFacePixelizeOptions {
                dither: false,
                ..default_options()
            },
        })
        .expect("prepared source should pixelize");

    assert_eq!(128, result.width);
    assert_eq!(128, result.height);
    assert_eq!(128 * 16, result.packed_pixels.len());
    assert_eq!(128 * 128 * 4, result.preview_pixels.len());
    assert_eq!(2000, result.source_width);
    assert_eq!(1000, result.source_height);
}

#[test]
fn release_prepared_source_prevents_further_pixelizing() {
    let store = CustomFacePixelizerSourceStore::default();
    let prepared = store
        .prepare_source(PrepareCustomFacePixelizerSourceRequest {
            profile_width: 128,
            profile_height: 128,
            image_bytes: png_8x8_checker(),
        })
        .expect("png should prepare");

    assert!(store.release_source(&prepared.source_id));
    let error = store
        .pixelize_source(CustomFacePixelizeSourceRequest {
            source_id: prepared.source_id,
            profile_width: 128,
            profile_height: 128,
            options: default_options(),
        })
        .expect_err("released source should not pixelize");

    assert!(error.contains("图片源已失效"));
}

#[test]
fn clear_cancels_prepare_that_started_before_clear() {
    let store = std::sync::Arc::new(CustomFacePixelizerSourceStore::default());
    let clearing_store = store.clone();
    store.set_before_insert_hook_for_test(move || {
        clearing_store.clear();
    });

    let result = store.prepare_source(PrepareCustomFacePixelizerSourceRequest {
        profile_width: 128,
        profile_height: 128,
        image_bytes: png_8x8_checker(),
    });

    assert!(
        result.is_err(),
        "prepare started before clear must not insert a stale source after clear"
    );
}
