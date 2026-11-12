import type { FileItem } from "../types";
import type { RenameSuccess } from "../services/fileService";
import { splitFileName } from "./path";

export function parentDir(path: string): string {
  const sep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return sep >= 0 ? path.slice(0, sep) : path;
}

export function basename(path: string): string {
  const sep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return sep >= 0 ? path.slice(sep + 1) : path;
}

function fileItemAtPath(path: string, file: FileItem): FileItem {
  const name = basename(path);
  const { stem, extension } = splitFileName(name);

  return {
    ...file,
    path,
    dir: parentDir(path),
    originalName: name,
    stem,
    extension,
    previewName: name,
    status: "unchanged",
    manualName: undefined,
    error: undefined,
    previousName: undefined,
    renamePhase: undefined,
  };
}

export function applyRenameSuccess(file: FileItem, success: RenameSuccess): FileItem {
  const previousName = file.originalName;

  return {
    ...fileItemAtPath(success.newPath, file),
    previousName,
    renamePhase: "renamed",
  };
}

/** 非手动模式下列表展示：不预览规则结果，仅显示当前文件名 */
export function toIdleDisplayFiles(files: FileItem[]): FileItem[] {
  return files.map((f) => {
    if (f.renamePhase === "renamed" || f.renamePhase === "rename-failed" || f.renamePhase === "renaming") {
      return f;
    }
    return {
      ...f,
      previewName: f.originalName,
      status: "unchanged",
      error: undefined,
    };
  });
}

export function markRenamePhase(
  files: FileItem[],
  id: string,
  phase: FileItem["renamePhase"],
): FileItem[] {
  return files.map((f) => (f.id === id ? { ...f, renamePhase: phase } : f));
}

/**
 * 撤销后将列表中的路径还原为重命名前的状态。
 * 传入的是「本次回滚真正成功的记录」：其中 oldPath 是撤销前的当前路径，
 * newPath 是还原后的原路径。只还原成功项，失败项保持现状，避免列表撒谎。
 */
export function applyUndoToFiles(files: FileItem[], records: RenameSuccess[]): FileItem[] {
  const byCurrentPath = new Map(records.map((r) => [r.oldPath, r]));

  return files.map((f) => {
    const record = byCurrentPath.get(f.path);
    if (!record) return f;
    return fileItemAtPath(record.newPath, f);
  });
}
