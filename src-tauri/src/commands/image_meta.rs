use std::fs::File;
use std::io::BufReader;
use std::path::Path;

const IMAGE_EXTENSIONS: &[&str] = &[
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif",
];

pub struct ImageMeta {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub exif_taken: Option<String>,
}

pub fn is_image_extension(ext: &str) -> bool {
    let lower = ext.to_lowercase();
    IMAGE_EXTENSIONS.iter().any(|e| lower == *e)
}

pub fn read_image_meta(path: &Path) -> ImageMeta {
    let (width, height) = read_dimensions(path);
    let exif_taken = read_exif_datetime(path);
    ImageMeta {
        width,
        height,
        exif_taken,
    }
}

fn read_dimensions(path: &Path) -> (Option<u32>, Option<u32>) {
    match imagesize::size(path) {
        Ok(size) => (Some(size.width as u32), Some(size.height as u32)),
        Err(_) => (None, None),
    }
}

fn read_exif_datetime(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .ok()?;

    let field = exif
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .or_else(|| exif.get_field(exif::Tag::DateTime, exif::In::PRIMARY))?;

    let raw = field.display_value().with_unit(&exif).to_string();
    Some(format_exif_datetime(&raw))
}

fn format_exif_datetime(raw: &str) -> String {
    // EXIF: "2026:03:20 21:24:11"
    let parts: Vec<&str> = raw.split(|c| c == ':' || c == ' ').collect();
    if parts.len() >= 6 {
        return format!(
            "{}{}{}_{}{}{}",
            parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
        );
    }
    raw.replace([':', ' '], "")
}
