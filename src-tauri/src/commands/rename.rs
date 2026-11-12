use super::safety::{
    conflict_key, resolve_file, unique_temp_name, validate_new_name, MAX_OPERATIONS,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameOperation {
    pub path: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameSuccess {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameFailure {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    pub success_count: usize,
    pub successes: Vec<RenameSuccess>,
    pub failures: Vec<RenameFailure>,
}

/// 一次移动的最小单元。`src` / `dest` 均为同一 canonical 目录下的绝对路径。
struct Job {
    src: PathBuf,
    dest: PathBuf,
    src_display: String,
    dest_display: String,
}

fn prepare_operation(op: &RenameOperation) -> Result<Job, String> {
    validate_new_name(&op.new_name)?;
    let (src, dir) = resolve_file(Path::new(&op.path))?;
    let dest = dir.join(&op.new_name);
    Ok(Job {
        src,
        dest_display: dest.to_string_lossy().into_owned(),
        dest,
        src_display: op.path.clone(),
    })
}

fn prepare_rollback(record: &RenameSuccess) -> Result<Job, String> {
    let original = Path::new(&record.old_path);
    let original_name = original
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "parse_original_name|missing".to_string())?;
    validate_new_name(original_name)?;

    let (src, dir) = resolve_file(Path::new(&record.new_path))?;
    let original_dir = original
        .parent()
        .ok_or_else(|| "parent_dir|no_parent".to_string())?
        .canonicalize()
        .map_err(|e| format!("parent_dir|{e}"))?;
    if original_dir != dir {
        return Err("out_of_scope|rollback_cross_directory".to_string());
    }

    let dest = dir.join(original_name);
    Ok(Job {
        src,
        dest_display: dest.to_string_lossy().into_owned(),
        dest,
        src_display: record.new_path.clone(),
    })
}

fn fail(job: &Job, reason: String, failures: &mut Vec<RenameFailure>) {
    failures.push(RenameFailure {
        path: job.src_display.clone(),
        reason,
    });
}

fn reserve(path: &Path) -> Result<bool, String> {
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
    {
        Ok(file) => {
            drop(file);
            Ok(true)
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
        Err(e) => Err(format!("io|{e}")),
    }
}

/// 把临时文件放回原名。`src` 此时应已腾空；绝不覆盖外部新建的同名文件。
fn restore(tmp: &Path, src: &Path) -> Result<(), String> {
    if !reserve(src)? {
        return Err(format!("restore_failed|{}", tmp.display()));
    }
    if let Err(e) = fs::rename(tmp, src) {
        let _ = fs::remove_file(src);
        return Err(format!("restore_failed|{} ({e})", tmp.display()));
    }
    Ok(())
}

/// 两阶段批量移动：
///
/// 1. 所有源先改名到同目录下的唯一临时名，把原名全部腾空；
/// 2. 临时名再改到目标名，落目标前用 `create_new` 占位，确保不会覆盖任何已有文件。
///
/// 这样交换文件名（A↔B）、链式重命名（A→B→C）、仅大小写变更都能正确处理；
/// 任一步失败都把对应文件放回原名，不会留下「消失的文件」。
fn run_batch(jobs: Vec<Job>, mut failures: Vec<RenameFailure>) -> RenameResult {
    if jobs.is_empty() {
        return RenameResult {
            success_count: 0,
            successes: Vec::new(),
            failures,
        };
    }

    // 批次内目标重名（Windows / macOS 大小写不敏感）一律拒绝，避免后者覆盖前者。
    let mut seen_dest: HashSet<String> = HashSet::new();
    let mut duplicate: HashSet<String> = HashSet::new();
    for job in &jobs {
        let key = conflict_key(&job.dest);
        if !seen_dest.insert(key.clone()) {
            duplicate.insert(key);
        }
    }

    let mut accepted = Vec::with_capacity(jobs.len());
    for job in jobs {
        if duplicate.contains(&conflict_key(&job.dest)) {
            fail(&job, format!("target_conflict|{}", job.dest.display()), &mut failures);
        } else {
            accepted.push(job);
        }
    }

    // 阶段一：腾空所有原名。
    let mut staged: Vec<(Job, PathBuf)> = Vec::with_capacity(accepted.len());
    for (index, job) in accepted.into_iter().enumerate() {
        let Some(dir) = job.src.parent() else {
            fail(&job, "parent_dir|no_parent".to_string(), &mut failures);
            continue;
        };
        let tmp = match unique_temp_name(dir, index) {
            Ok(path) => path,
            Err(reason) => {
                fail(&job, reason, &mut failures);
                continue;
            }
        };
        match fs::rename(&job.src, &tmp) {
            Ok(()) => staged.push((job, tmp)),
            Err(e) => {
                let _ = fs::remove_file(&tmp);
                fail(&job, format!("io|{e}"), &mut failures);
            }
        }
    }

    // 阶段二：临时名 → 目标名。
    let mut successes = Vec::with_capacity(staged.len());
    for (job, tmp) in staged {
        let reserved = match reserve(&job.dest) {
            Ok(v) => v,
            Err(reason) => {
                if let Err(restore_err) = restore(&tmp, &job.src) {
                    fail(&job, format!("{reason}; {restore_err}"), &mut failures);
                } else {
                    fail(&job, reason, &mut failures);
                }
                continue;
            }
        };

        if !reserved {
            if let Err(restore_err) = restore(&tmp, &job.src) {
                fail(&job, restore_err, &mut failures);
            } else {
                fail(
                    &job,
                    format!("target_exists|{}", job.dest_display),
                    &mut failures,
                );
            }
            continue;
        }

        match fs::rename(&tmp, &job.dest) {
            Ok(()) => successes.push(RenameSuccess {
                old_path: job.src_display,
                new_path: job.dest_display,
            }),
            Err(e) => {
                let _ = fs::remove_file(&job.dest);
                if let Err(restore_err) = restore(&tmp, &job.src) {
                    fail(&job, format!("io|{e}; {restore_err}"), &mut failures);
                } else {
                    fail(&job, format!("io|{e}"), &mut failures);
                }
            }
        }
    }

    RenameResult {
        success_count: successes.len(),
        successes,
        failures,
    }
}

fn do_rename(operations: Vec<RenameOperation>) -> Result<RenameResult, String> {
    if operations.len() > MAX_OPERATIONS {
        return Err(format!("batch_limit|{MAX_OPERATIONS}"));
    }

    let mut jobs = Vec::with_capacity(operations.len());
    let mut failures = Vec::new();
    let mut seen_src: HashSet<String> = HashSet::new();

    for op in operations {
        let src_key = Path::new(&op.path).to_string_lossy().to_lowercase();
        if !seen_src.insert(src_key.clone()) {
            failures.push(RenameFailure {
                path: op.path,
                reason: "duplicate_source|same file listed twice".to_string(),
            });
            continue;
        }
        match prepare_operation(&op) {
            Ok(job) => jobs.push(job),
            Err(reason) => failures.push(RenameFailure {
                path: op.path,
                reason,
            }),
        }
    }

    Ok(run_batch(jobs, failures))
}

fn do_rollback(records: Vec<RenameSuccess>) -> Result<RenameResult, String> {
    if records.len() > MAX_OPERATIONS {
        return Err(format!("batch_limit|{MAX_OPERATIONS}"));
    }

    let mut jobs = Vec::with_capacity(records.len());
    let mut failures = Vec::new();
    let mut seen_src: HashSet<String> = HashSet::new();

    for record in records {
        let src_key = Path::new(&record.new_path)
            .to_string_lossy()
            .to_lowercase();
        if !seen_src.insert(src_key) {
            failures.push(RenameFailure {
                path: record.new_path,
                reason: "duplicate_source|same file listed twice".to_string(),
            });
            continue;
        }
        match prepare_rollback(&record) {
            Ok(job) => jobs.push(job),
            Err(reason) => failures.push(RenameFailure {
                path: record.new_path,
                reason,
            }),
        }
    }

    Ok(run_batch(jobs, failures))
}

#[tauri::command]
pub async fn execute_rename(operations: Vec<RenameOperation>) -> Result<RenameResult, String> {
    tauri::async_runtime::spawn_blocking(move || do_rename(operations))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn rollback_rename(records: Vec<RenameSuccess>) -> Result<RenameResult, String> {
    tauri::async_runtime::spawn_blocking(move || do_rollback(records))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_dir() -> PathBuf {
        let id = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "batch-rename-test-{}-{id}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn touch(path: &Path, content: &str) {
        fs::write(path, content).unwrap();
    }

    #[test]
    fn swaps_two_names_without_losing_data() {
        let dir = temp_dir();
        touch(&dir.join("a.txt"), "A");
        touch(&dir.join("b.txt"), "B");

        let ops = vec![
            RenameOperation { path: dir.join("a.txt").to_string_lossy().into_owned(), new_name: "b.txt".into() },
            RenameOperation { path: dir.join("b.txt").to_string_lossy().into_owned(), new_name: "a.txt".into() },
        ];
        let result = do_rename(ops).unwrap();
        assert_eq!(result.success_count, 2, "{:?}", result.failures);
        assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "B");
        assert_eq!(fs::read_to_string(dir.join("b.txt")).unwrap(), "A");

        let rollback = do_rollback(result.successes).unwrap();
        assert_eq!(rollback.success_count, 2, "{:?}", rollback.failures);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn never_overwrites_existing_target() {
        let dir = temp_dir();
        touch(&dir.join("a.txt"), "A");
        touch(&dir.join("b.txt"), "B");
        let op = RenameOperation { path: dir.join("a.txt").to_string_lossy().into_owned(), new_name: "b.txt".into() };
        let result = do_rename(vec![op]).unwrap();
        assert_eq!(result.success_count, 0);
        assert_eq!(result.failures.len(), 1);
        assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "A");
        assert_eq!(fs::read_to_string(dir.join("b.txt")).unwrap(), "B");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_path_traversal_and_absolute_names() {
        let dir = temp_dir();
        touch(&dir.join("a.txt"), "A");
        let op = RenameOperation {
            path: dir.join("a.txt").to_string_lossy().into_owned(),
            new_name: "..\\outside.txt".into(),
        };
        let result = do_rename(vec![op]).unwrap();
        assert_eq!(result.success_count, 0);
        assert!(result.failures[0].reason.starts_with("invalid_filename"));
        assert!(dir.join("a.txt").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_duplicate_targets() {
        let dir = temp_dir();
        touch(&dir.join("a.txt"), "A");
        touch(&dir.join("b.txt"), "B");
        let ops = vec![
            RenameOperation { path: dir.join("a.txt").to_string_lossy().into_owned(), new_name: "same.txt".into() },
            RenameOperation { path: dir.join("b.txt").to_string_lossy().into_owned(), new_name: "same.txt".into() },
        ];
        let result = do_rename(ops).unwrap();
        assert_eq!(result.success_count, 0);
        assert_eq!(result.failures.len(), 2);
        assert!(dir.join("a.txt").exists());
        assert!(dir.join("b.txt").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn supports_chain_rename() {
        let dir = temp_dir();
        touch(&dir.join("a.txt"), "A");
        touch(&dir.join("b.txt"), "B");
        let ops = vec![
            RenameOperation { path: dir.join("a.txt").to_string_lossy().into_owned(), new_name: "b.txt".into() },
            RenameOperation { path: dir.join("b.txt").to_string_lossy().into_owned(), new_name: "c.txt".into() },
        ];
        let result = do_rename(ops).unwrap();
        assert_eq!(result.success_count, 2, "{:?}", result.failures);
        assert_eq!(fs::read_to_string(dir.join("b.txt")).unwrap(), "A");
        assert_eq!(fs::read_to_string(dir.join("c.txt")).unwrap(), "B");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rollback_rejects_cross_directory_paths() {
        let dir = temp_dir();
        let other = temp_dir();
        touch(&dir.join("a.txt"), "A");
        let record = RenameSuccess {
            old_path: other.join("a.txt").to_string_lossy().into_owned(),
            new_path: dir.join("a.txt").to_string_lossy().into_owned(),
        };
        let result = do_rollback(vec![record]).unwrap();
        assert_eq!(result.success_count, 0);
        assert!(result.failures[0].reason.starts_with("parent_dir") || result.failures[0].reason.starts_with("out_of_scope"));
        fs::remove_dir_all(&dir).unwrap();
        fs::remove_dir_all(&other).unwrap();
    }
}
