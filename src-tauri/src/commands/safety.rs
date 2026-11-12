//! 文件名与路径安全校验。
//!
//! 前端传来的任何路径都不可信：所有 `execute_rename` / `rollback_rename` /
//! `load_paths` 的输入都必须先经过本模块的校验。核心约束：
//!
//! 1. 新文件名只能是「一个文件名」，不能含路径分隔符、盘符或 `..`；
//! 2. 源与目标必须落在同一个已解析（canonicalize）的目录里；
//! 3. 拒绝 Windows 保留设备名、控制字符、非法字符与超长名称；
//! 4. 所有批次都有数量上限，避免无界循环与内存耗尽。

use std::path::{Path, PathBuf};

pub const MAX_OPERATIONS: usize = 5_000;
pub const MAX_SCAN_ROOTS: usize = 128;
pub const MAX_FILES_PER_SCAN: usize = 20_000;
pub const MAX_SCAN_DEPTH: usize = 32;
pub const MAX_NAME_BYTES: usize = 255;

/// Windows 保留设备名（大小写不敏感，带扩展名同样保留，如 `CON.txt`）。
const RESERVED_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
    "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// 校验「新文件名」是否合法。返回 Ok(()) 或带错误码的 Err。
pub fn validate_new_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.trim().is_empty() {
        return Err("invalid_filename|empty".to_string());
    }
    if name.len() > MAX_NAME_BYTES {
        return Err("invalid_filename|too_long".to_string());
    }
    if name == "." || name == ".." {
        return Err("invalid_filename|dot_segment".to_string());
    }
    // 路径分隔符、盘符、ADS 流、UNC 前缀一律拒绝。
    if name.contains('/') || name.contains('\\') || name.contains(':') {
        return Err("invalid_filename|path_separator".to_string());
    }
    for ch in name.chars() {
        if (ch as u32) < 0x20 || ch == '\u{7f}' {
            return Err("invalid_filename|control_char".to_string());
        }
        if matches!(ch, '<' | '>' | '"' | '|' | '?' | '*') {
            return Err("invalid_filename|invalid_char".to_string());
        }
    }
    if name.starts_with(' ') || name.ends_with(' ') || name.ends_with('.') {
        return Err("invalid_filename|trailing_char".to_string());
    }
    let stem = name
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end()
        .to_ascii_uppercase();
    if RESERVED_NAMES.contains(&stem.as_str()) {
        return Err("invalid_filename|reserved_name".to_string());
    }
    Ok(())
}

/// 解析并返回某个已存在文件所在的真实目录；同时要求该文件确实在这个目录里。
/// 这可以挡住相对路径、`..` 穿越、以及符号链接 / junction 指向目录外的情况。
pub fn resolve_file(path: &Path) -> Result<(PathBuf, PathBuf), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "parent_dir|no_parent".to_string())?;
    let dir = parent
        .canonicalize()
        .map_err(|e| format!("parent_dir|{e}"))?;
    if !dir.is_dir() {
        return Err("parent_dir|not_a_directory".to_string());
    }

    let real = path
        .canonicalize()
        .map_err(|e| format!("io|{e}"))?;
    let metadata = fs_symlink_metadata(&real)?;
    if !metadata.is_file() {
        return Err("not_a_file|source".to_string());
    }
    let real_parent = real
        .parent()
        .ok_or_else(|| "parent_dir|no_parent".to_string())?;
    if real_parent != dir {
        return Err("out_of_scope|source_outside_directory".to_string());
    }
    Ok((real, dir))
}

fn fs_symlink_metadata(path: &Path) -> Result<std::fs::Metadata, String> {
    std::fs::symlink_metadata(path).map_err(|e| format!("io|{e}"))
}

/// Windows 与 macOS 的文件名默认大小写不敏感，冲突检测统一用小写 key。
pub fn conflict_key(path: &Path) -> String {
    path.to_string_lossy().to_lowercase()
}

/// 生成一个不与现有文件冲突的临时文件名（仍在同一个目录里）。
pub fn unique_temp_name(dir: &Path, seq: usize) -> Result<PathBuf, String> {
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let pid = std::process::id();

    for attempt in 0..64u32 {
        let name = format!(
            ".batch-rename-tmp-{pid}-{seed:x}-{seq}-{attempt}.tmp"
        );
        let candidate = dir.join(&name);
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(file) => {
                drop(file);
                // 占位文件由调用方在 rename 时覆盖，或失败时清理。
                return Ok(candidate);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("io|{e}")),
        }
    }
    Err("io|temp_name_exhausted".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_traversal_and_absolute_names() {
        for bad in [
            "..",
            "../evil.txt",
            "..\\evil.txt",
            "C:\\Windows\\evil.txt",
            "/etc/passwd",
            "a/b.txt",
            "a\\b.txt",
        ] {
            assert!(validate_new_name(bad).is_err(), "should reject {bad:?}");
        }
    }

    #[test]
    fn rejects_windows_reserved_and_invalid_names() {
        for bad in [
            "CON",
            "con.txt",
            "NUL.log",
            "COM1.txt",
            "a<b>.txt",
            "a|b.txt",
            "a?b.txt",
            "a*b.txt",
            "trailing.",
            " leading.txt",
            "trailing ",
            "a\u{0001}b.txt",
        ] {
            assert!(validate_new_name(bad).is_err(), "should reject {bad:?}");
        }
    }

    #[test]
    fn accepts_normal_names() {
        for good in ["照片_001.jpg", ".gitignore", "报告 v2 (最终).pdf", "a.b.c.txt"] {
            assert!(validate_new_name(good).is_ok(), "should accept {good:?}");
        }
    }

    #[test]
    fn rejects_overlong_names() {
        let long = "a".repeat(MAX_NAME_BYTES + 1);
        assert!(validate_new_name(&long).is_err());
    }
}
