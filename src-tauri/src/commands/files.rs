use super::audio_meta::{is_audio_extension, read_audio_meta};
use super::image_meta::{is_image_extension, read_image_meta};
use super::safety::{
    MAX_FILES_PER_SCAN, MAX_SCAN_DEPTH, MAX_SCAN_ROOTS,
};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawFileInfo {
    pub path: String,
    pub name: String,
    pub stem: String,
    pub extension: String,
    pub dir: String,
    pub created: Option<u64>,
    pub modified: Option<u64>,
    pub size: Option<u64>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
    pub exif_taken: Option<String>,
    pub id3_title: Option<String>,
    pub id3_artist: Option<String>,
    pub id3_album: Option<String>,
    pub id3_year: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadPathsResult {
    pub files: Vec<RawFileInfo>,
    /// 达到文件数或深度上限，结果被截断（界面需要提示用户）。
    pub truncated: bool,
    /// 因权限、损坏或深度超限跳过的条目数。
    pub skipped: usize,
}

fn split_file_name(name: &str) -> (String, String) {
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => (stem.to_string(), format!(".{ext}")),
        _ => (name.to_string(), String::new()),
    }
}

fn unix_seconds(time: std::time::SystemTime) -> Option<u64> {
    time.duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

fn file_info(path: &Path) -> Result<RawFileInfo, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err(format!("not_a_file|{}", path.display()));
    }

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "invalid_filename|non_utf8".to_string())?
        .to_string();

    let dir = path
        .parent()
        .and_then(|p| p.to_str())
        .unwrap_or("")
        .to_string();

    let (stem, extension) = split_file_name(&name);
    let created = metadata.created().ok().and_then(unix_seconds);
    let modified = metadata.modified().ok().and_then(unix_seconds);
    let size = Some(metadata.len());

    let (image_width, image_height, exif_taken) = if is_image_extension(&extension) {
        let meta = read_image_meta(path);
        (meta.width, meta.height, meta.exif_taken)
    } else {
        (None, None, None)
    };

    let (id3_title, id3_artist, id3_album, id3_year) = if is_audio_extension(&extension) {
        let meta = read_audio_meta(path);
        (meta.title, meta.artist, meta.album, meta.year)
    } else {
        (None, None, None, None)
    };

    Ok(RawFileInfo {
        path: path.to_string_lossy().to_string(),
        name,
        stem,
        extension,
        dir,
        created,
        modified,
        size,
        image_width,
        image_height,
        exif_taken,
        id3_title,
        id3_artist,
        id3_album,
        id3_year,
    })
}

#[derive(Default)]
struct ScanStats {
    truncated: bool,
    skipped: usize,
}

/// 迭代式目录遍历：不使用递归（避免栈溢出），不跟随符号链接 / junction，
/// 设置深度与文件数上限；单个目录不可读时只跳过该目录，不丢弃已收集的结果。
fn collect_from_dir(
    root: &Path,
    recursive: bool,
    result: &mut Vec<RawFileInfo>,
    stats: &mut ScanStats,
) {
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];

    while let Some((dir, depth)) = stack.pop() {
        if result.len() >= MAX_FILES_PER_SCAN {
            stats.truncated = true;
            return;
        }

        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => {
                stats.skipped += 1;
                continue;
            }
        };

        for entry in entries {
            if result.len() >= MAX_FILES_PER_SCAN {
                stats.truncated = true;
                return;
            }

            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => {
                    stats.skipped += 1;
                    continue;
                }
            };
            let path = entry.path();

            // symlink_metadata 不会跟随链接；Windows junction 同样表现为 reparse point。
            let metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => {
                    stats.skipped += 1;
                    continue;
                }
            };
            if metadata.file_type().is_symlink() {
                continue;
            }

            if metadata.is_file() {
                match file_info(&path) {
                    Ok(info) => result.push(info),
                    Err(_) => stats.skipped += 1,
                }
            } else if metadata.is_dir() && recursive {
                if depth < MAX_SCAN_DEPTH {
                    stack.push((path, depth + 1));
                } else {
                    stats.skipped += 1;
                }
            }
        }
    }
}

#[tauri::command]
pub async fn load_paths(paths: Vec<String>, recursive: bool) -> Result<LoadPathsResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.len() > MAX_SCAN_ROOTS {
            return Err(format!("batch_limit|{MAX_SCAN_ROOTS}"));
        }

        let mut result: Vec<RawFileInfo> = Vec::new();
        let mut stats = ScanStats::default();

        for path_str in paths {
            if result.len() >= MAX_FILES_PER_SCAN {
                stats.truncated = true;
                break;
            }

            let path = PathBuf::from(&path_str);
            let metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => {
                    stats.skipped += 1;
                    continue;
                }
            };
            if metadata.file_type().is_symlink() {
                continue;
            }

            if metadata.is_file() {
                match file_info(&path) {
                    Ok(info) => result.push(info),
                    Err(_) => stats.skipped += 1,
                }
            } else if metadata.is_dir() {
                collect_from_dir(&path, recursive, &mut result, &mut stats);
            }
        }

        result.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(LoadPathsResult {
            files: result,
            truncated: stats.truncated,
            skipped: stats.skipped,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
