use id3::TagLike;
use std::path::Path;

const AUDIO_EXTENSIONS: &[&str] = &[".mp3"];

pub struct AudioMeta {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<String>,
}

pub fn is_audio_extension(ext: &str) -> bool {
    let lower = ext.to_lowercase();
    AUDIO_EXTENSIONS.iter().any(|e| lower == *e)
}

pub fn read_audio_meta(path: &Path) -> AudioMeta {
    match id3::Tag::read_from_path(path) {
        Ok(tag) => AudioMeta {
            title: tag.title().map(|s| sanitize_tag(s.to_string())),
            artist: tag.artist().map(|s| sanitize_tag(s.to_string())),
            album: tag.album().map(|s| sanitize_tag(s.to_string())),
            year: tag
                .year()
                .map(|y| y.to_string())
                .or_else(|| tag.date_recorded().map(|d| d.year.to_string())),
        },
        Err(_) => AudioMeta::empty(),
    }
}

impl AudioMeta {
    fn empty() -> Self {
        Self {
            title: None,
            artist: None,
            album: None,
            year: None,
        }
    }
}

fn sanitize_tag(value: String) -> String {
    value
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'))
        .collect::<String>()
        .trim()
        .to_string()
}
