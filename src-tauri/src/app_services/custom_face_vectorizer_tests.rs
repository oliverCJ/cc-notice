use std::fs;
use std::sync::{Arc, Barrier};
use std::thread;

use crate::app_services::custom_face_vectorizer::{
    custom_face_vectorizer_temp_svg_path, vectorize_custom_face_image,
    write_vectorized_svg_temp_file, CustomFaceVectorizeMode, CustomFaceVectorizeOptions,
    CustomFaceVectorizeRequest, CustomFaceVectorizeSourceRequest, CustomFaceVectorizerSourceStore,
    PrepareCustomFaceVectorizerSourceRequest,
};
use crate::test_support::unique_temp_root;

fn png_2x2_rgba() -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_fn(2, 2, |x, y| {
        if x == y {
            image::Rgba([0, 0, 0, 255])
        } else {
            image::Rgba([255, 255, 255, 0])
        }
    });
    image::DynamicImage::ImageRgba8(image)
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageOutputFormat::Png,
        )
        .expect("test png should encode");
    bytes
}

fn png_large_rgba(width: u32, height: u32) -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_fn(width, height, |x, y| {
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
        .expect("large test png should encode");
    bytes
}

fn png_solid_rgba(width: u32, height: u32, color: image::Rgba<u8>) -> Vec<u8> {
    let mut bytes = Vec::new();
    let image = image::RgbaImage::from_pixel(width, height, color);
    image::DynamicImage::ImageRgba8(image)
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageOutputFormat::Png,
        )
        .expect("solid test png should encode");
    bytes
}

fn default_options() -> CustomFaceVectorizeOptions {
    CustomFaceVectorizeOptions {
        mode: CustomFaceVectorizeMode::Binary,
        filter_speckle: 1,
        color_precision: 6,
        layer_difference: 16,
        corner_threshold: 60,
        length_threshold: 4.0,
        max_iterations: 10,
        splice_threshold: 45,
        path_precision: 2,
        scale: 1.0,
        offset_x: 0,
        offset_y: 0,
        rotation_deg: 0,
        invert: false,
        brightness: 0,
        contrast: 0,
    }
}

#[test]
fn vectorizes_png_bytes_to_svg() {
    let root = unique_temp_root("cc-notice-vectorizer-service");
    let result = vectorize_custom_face_image(
        &root,
        CustomFaceVectorizeRequest {
            file_name: "sample.png".into(),
            image_bytes: png_2x2_rgba(),
            options: default_options(),
        },
    )
    .expect("png should vectorize");

    assert_eq!(2, result.width);
    assert_eq!(2, result.height);
    assert!(result.svg.contains("<svg"));
    assert!(result.svg.contains("</svg>"));
}

#[test]
fn vectorizes_processed_png_even_when_source_name_has_non_png_extension() {
    let root = unique_temp_root("cc-notice-vectorizer-service-extension");
    let result = vectorize_custom_face_image(
        &root,
        CustomFaceVectorizeRequest {
            file_name: "clipboard-image.jpg".into(),
            image_bytes: png_2x2_rgba(),
            options: default_options(),
        },
    )
    .expect("processed png should vectorize regardless of original file extension");

    assert_eq!(2, result.width);
    assert_eq!(2, result.height);
    assert!(result.svg.contains("<svg"));
}

#[test]
fn concurrent_vectorize_requests_do_not_share_temp_files() {
    let root = unique_temp_root("cc-notice-vectorizer-concurrent");
    let first_image = png_solid_rgba(2, 2, image::Rgba([0, 0, 0, 255]));
    let second_image = png_solid_rgba(7, 5, image::Rgba([0, 0, 0, 255]));
    let barrier = Arc::new(Barrier::new(12));
    let mut handles = Vec::new();

    for index in 0..12 {
        let next_root = root.clone();
        let next_barrier = barrier.clone();
        let image_bytes = if index % 2 == 0 {
            first_image.clone()
        } else {
            second_image.clone()
        };
        let expected_width = if index % 2 == 0 { 2 } else { 7 };
        let expected_height = if index % 2 == 0 { 2 } else { 5 };
        handles.push(thread::spawn(move || {
            next_barrier.wait();
            let result = vectorize_custom_face_image(
                &next_root,
                CustomFaceVectorizeRequest {
                    file_name: format!("sample-{index}.png"),
                    image_bytes,
                    options: default_options(),
                },
            )
            .expect("concurrent vectorize should succeed");

            assert_eq!(expected_width, result.width);
            assert_eq!(expected_height, result.height);
            assert!(
                result.svg.contains(&format!("width=\"{expected_width}\""))
                    || result
                        .svg
                        .contains(&format!("viewBox=\"0 0 {expected_width} ")),
                "svg should match the request dimensions: {}",
                result.svg
            );
        }));
    }

    for handle in handles {
        handle.join().expect("worker thread should finish");
    }
}

#[test]
fn rejects_non_image_bytes() {
    let root = unique_temp_root("cc-notice-vectorizer-invalid");
    let error = vectorize_custom_face_image(
        &root,
        CustomFaceVectorizeRequest {
            file_name: "broken.png".into(),
            image_bytes: b"not an image".to_vec(),
            options: default_options(),
        },
    )
    .expect_err("invalid image should fail");

    assert!(error.contains("图片格式不支持") || error.contains("无法解码图片"));
}

#[test]
fn writes_fixed_temp_svg_atomically() {
    let root = unique_temp_root("cc-notice-vectorizer-temp-svg");
    let first = write_vectorized_svg_temp_file(&root, "<svg viewBox=\"0 0 1 1\"></svg>")
        .expect("first svg should write");
    let second = write_vectorized_svg_temp_file(&root, "<svg viewBox=\"0 0 2 2\"></svg>")
        .expect("second svg should overwrite fixed path");

    assert_eq!(first, second);
    assert_eq!(custom_face_vectorizer_temp_svg_path(&root), first);
    assert_eq!(
        "<svg viewBox=\"0 0 2 2\"></svg>",
        fs::read_to_string(second).unwrap()
    );
}

#[test]
fn rejects_svg_above_import_limit() {
    let root = unique_temp_root("cc-notice-vectorizer-big-svg");
    let svg = format!("<svg>{}</svg>", "x".repeat(2 * 1024 * 1024));
    let error = write_vectorized_svg_temp_file(&root, &svg)
        .expect_err("oversized svg should not be written");

    assert!(error.contains("SVG 超过 2 MiB"));
}

#[test]
fn reuses_prepared_source_for_multiple_vectorize_requests() {
    let store = CustomFaceVectorizerSourceStore::default();
    let root = unique_temp_root("cc-notice-vectorizer-source-store");
    let source = store
        .prepare_source(
            &root,
            PrepareCustomFaceVectorizerSourceRequest {
                file_name: "sample.png".into(),
                image_bytes: png_2x2_rgba(),
                target_width: 128,
                target_height: 32,
            },
        )
        .expect("image source should prepare");

    let first = store
        .vectorize_source(
            &root,
            CustomFaceVectorizeSourceRequest {
                source_id: source.source_id.clone(),
                options: default_options(),
            },
        )
        .expect("first vectorize should succeed");
    let second = store
        .vectorize_source(
            &root,
            CustomFaceVectorizeSourceRequest {
                source_id: source.source_id.clone(),
                options: default_options(),
            },
        )
        .expect("second vectorize should reuse the same source");

    assert_eq!(source.source_width, 2);
    assert_eq!(source.source_height, 2);
    assert_eq!(first.width, 2);
    assert_eq!(first.height, 2);
    assert_eq!(first.svg, second.svg);
}

#[test]
fn prepares_large_sources_with_a_bounded_working_image() {
    let store = CustomFaceVectorizerSourceStore::default();
    let root = unique_temp_root("cc-notice-vectorizer-source-compress");
    let source = store
        .prepare_source(
            &root,
            PrepareCustomFaceVectorizerSourceRequest {
                file_name: "large.png".into(),
                image_bytes: png_large_rgba(2400, 1600),
                target_width: 128,
                target_height: 32,
            },
        )
        .expect("large image should prepare");

    assert_eq!(2400, source.source_width);
    assert_eq!(1600, source.source_height);
    assert!(source.working_width <= 512);
    assert!(source.working_height <= 512);
}

#[test]
fn keeps_small_sources_uncompressed_for_large_canvases() {
    let store = CustomFaceVectorizerSourceStore::default();
    let root = unique_temp_root("cc-notice-vectorizer-source-no-compress");
    let source = store
        .prepare_source(
            &root,
            PrepareCustomFaceVectorizerSourceRequest {
                file_name: "small.png".into(),
                image_bytes: png_large_rgba(400, 300),
                target_width: 128,
                target_height: 32,
            },
        )
        .expect("small image should prepare without compression");

    assert_eq!(400, source.working_width);
    assert_eq!(300, source.working_height);
}

#[test]
fn releasing_prepared_source_invalidates_followup_vectorize_requests() {
    let store = CustomFaceVectorizerSourceStore::default();
    let root = unique_temp_root("cc-notice-vectorizer-release-store");
    let source = store
        .prepare_source(
            &root,
            PrepareCustomFaceVectorizerSourceRequest {
                file_name: "sample.png".into(),
                image_bytes: png_2x2_rgba(),
                target_width: 128,
                target_height: 32,
            },
        )
        .expect("image source should prepare");

    assert!(store.release_source(&source.source_id));
    let error = store
        .vectorize_source(
            &root,
            CustomFaceVectorizeSourceRequest {
                source_id: source.source_id,
                options: default_options(),
            },
        )
        .expect_err("released source should no longer be usable");

    assert!(error.contains("图片源已失效") || error.contains("图片导入工作台已重置"));
}
