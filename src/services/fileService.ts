import { invoke } from "@tauri-apps/api/core";
import type { RawFileInfo } from "../types";
import { rawToFileItem } from "../lib/preview";
import type { FileItem } from "../types";

export interface RenameSuccess {
  oldPath: string;
  newPath: string;
}

export interface RenameResult {
  successCount: number;
  successes: RenameSuccess[];
  failures: { path: string; reason: string }[];
}

export interface LoadedPaths {
  items: FileItem[];
  /** 扫描被数量/深度上限截断，界面需要提示用户分批添加。 */
  truncated: boolean;
  skipped: number;
}

interface LoadPathsResult {
  files: RawFileInfo[];
  truncated: boolean;
  skipped: number;
}

export async function loadPathsFromDisk(
  paths: string[],
  recursive: boolean,
): Promise<LoadedPaths> {
  const raw = await invoke<LoadPathsResult>("load_paths", { paths, recursive });
  return {
    items: raw.files.map(rawToFileItem),
    truncated: raw.truncated,
    skipped: raw.skipped,
  };
}

export async function executeRenameOnDisk(
  operations: { path: string; newName: string }[],
): Promise<RenameResult> {
  return invoke<RenameResult>("execute_rename", { operations });
}

export async function rollbackRenameOnDisk(
  records: RenameSuccess[],
): Promise<RenameResult> {
  return invoke<RenameResult>("rollback_rename", { records });
}
