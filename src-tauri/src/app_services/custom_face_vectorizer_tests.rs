use std::fs;

use crate::app_services::custom_face_vectorizer::{
    custom_face_vectorizer_temp_svg_path, vectorize_custom_face_image,
    write_vectorized_svg_temp_file, CustomFaceVectorizeMode, CustomFaceVectorizeOptions,
    CustomFaceVectorizeRequest,
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
