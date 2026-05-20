use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, GenericImageView};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use vtracer::{ColorImage, ColorMode, Config, Hierarchical};

#[tauri::command]
pub fn vectorize_image(
    image_base64: String,
    mode: String,
    color_precision: u8,
    filter_speckle: u8,
    threshold: u8,
) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(image_base64)
        .map_err(|e| format!("Invalid base64 image data: {e}"))?;

    let image = image::load_from_memory(&bytes).map_err(|e| format!("Unable to read image: {e}"))?;
    let flattened = flatten_alpha_to_white(&image);
    let source = if mode == "monochrome" {
        threshold_to_binary(flattened, threshold)
    } else if mode == "color" {
        flattened
    } else {
        return Err("mode must be \"color\" or \"monochrome\"".to_string());
    };

    let color_image = ColorImage {
        pixels: source.pixels,
        width: source.width,
        height: source.height,
    };

    let mut config = Config::default();
    config.color_mode = if mode == "monochrome" {
        ColorMode::Binary
    } else {
        ColorMode::Color
    };
    config.hierarchical = Hierarchical::Stacked;
    config.color_precision = color_precision.clamp(1, 8) as i32;
    config.filter_speckle = filter_speckle.clamp(0, 20) as usize;
    config.layer_difference = 6;
    config.length_threshold = 5.0;
    config.max_iterations = 2;
    config.path_precision = Some(5);

    let svg = vtracer::convert(color_image, config)
        .map_err(|e| format!("Vectorization failed: {e}"))?
        .to_string();
    let svg = ensure_view_box(svg, source.width, source.height);

    validate_svg(&svg)?;
    Ok(svg)
}

#[tauri::command]
pub async fn save_svg_file(
    app: AppHandle,
    svg_content: String,
    default_name: String,
) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app
        .dialog()
        .file()
        .add_filter("SVG", &["svg"])
        .set_file_name(&default_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let path = rx.await.map_err(|e| format!("Save dialog failed: {e}"))?;

    if let Some(file_path) = path {
        let path = file_path
            .as_path()
            .ok_or_else(|| "Invalid save path".to_string())?;
        tokio::fs::write(path, svg_content)
            .await
            .map_err(|e| format!("Unable to save SVG: {e}"))?;
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

struct RgbaPixels {
    pixels: Vec<u8>,
    width: usize,
    height: usize,
}

fn flatten_alpha_to_white(image: &DynamicImage) -> RgbaPixels {
    let (width, height) = image.dimensions();
    let rgba = image.to_rgba8();
    let mut pixels = Vec::with_capacity((width * height * 4) as usize);

    for pixel in rgba.pixels() {
        let [r, g, b, a] = pixel.0;
        let alpha = a as u16;
        let inv_alpha = 255 - alpha;
        let flatten = |channel: u8| -> u8 {
            (((channel as u16 * alpha) + (255 * inv_alpha)) / 255) as u8
        };

        pixels.push(flatten(r));
        pixels.push(flatten(g));
        pixels.push(flatten(b));
        pixels.push(255);
    }

    RgbaPixels {
        pixels,
        width: width as usize,
        height: height as usize,
    }
}

fn threshold_to_binary(mut image: RgbaPixels, threshold: u8) -> RgbaPixels {
    let threshold = if threshold == 0 {
        otsu_threshold(&image.pixels)
    } else {
        threshold
    };

    for rgba in image.pixels.chunks_exact_mut(4) {
        let luminance = ((rgba[0] as u16 * 299) + (rgba[1] as u16 * 587) + (rgba[2] as u16 * 114)) / 1000;
        let value = if luminance as u8 >= threshold { 255 } else { 0 };
        rgba[0] = value;
        rgba[1] = value;
        rgba[2] = value;
        rgba[3] = 255;
    }

    image
}

fn otsu_threshold(pixels: &[u8]) -> u8 {
    let mut histogram = [0u32; 256];
    let mut total = 0u32;
    let mut sum = 0u64;

    for rgba in pixels.chunks_exact(4) {
        let luminance = ((rgba[0] as u16 * 299) + (rgba[1] as u16 * 587) + (rgba[2] as u16 * 114)) / 1000;
        histogram[luminance as usize] += 1;
        total += 1;
        sum += luminance as u64;
    }

    if total == 0 {
        return 128;
    }

    let mut background_weight = 0u32;
    let mut background_sum = 0u64;
    let mut max_variance = 0.0f64;
    let mut threshold = 128u8;

    for (level, count) in histogram.iter().enumerate() {
        background_weight += count;
        if background_weight == 0 {
            continue;
        }

        let foreground_weight = total - background_weight;
        if foreground_weight == 0 {
            break;
        }

        background_sum += (level as u64) * (*count as u64);
        let background_mean = background_sum as f64 / background_weight as f64;
        let foreground_mean = (sum - background_sum) as f64 / foreground_weight as f64;
        let variance = background_weight as f64
            * foreground_weight as f64
            * (background_mean - foreground_mean).powi(2);

        if variance > max_variance {
            max_variance = variance;
            threshold = level as u8;
        }
    }

    threshold
}

fn ensure_view_box(svg: String, width: usize, height: usize) -> String {
    if svg.contains("viewBox=") {
        return svg;
    }

    svg.replacen(
        "<svg ",
        &format!("<svg viewBox=\"0 0 {width} {height}\" "),
        1,
    )
}

fn validate_svg(svg: &str) -> Result<(), String> {
    if svg.to_lowercase().contains("base64") {
        return Err("Generated SVG contains base64 encoded data".to_string());
    }

    if svg.to_lowercase().contains("<image") {
        return Err("Generated SVG contains an <image> element".to_string());
    }

    if !svg.to_lowercase().contains("<path") {
        return Err("Generated SVG is missing <path> elements".to_string());
    }

    if !svg.contains("viewBox=") {
        return Err("Generated SVG is missing a viewBox attribute".to_string());
    }

    Ok(())
}
