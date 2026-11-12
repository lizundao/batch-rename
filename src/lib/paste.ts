import type { FileItem, SortOrder } from "../types";
import { splitFileName } from "./path";
import { sortFiles } from "./sort";

export function parsePasteLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export type PasteWarning =
  | { key: "pasteWarningExcess"; lines: number; files: number }
  | { key: "pasteWarningShort"; lines: number; remaining: number };

export interface PasteResult {
  updatedIds: string[];
  lineCount: number;
  fileCount: number;
  warning?: PasteWarning;
}

export function applyPasteLines(
  files: FileItem[],
  lines: string[],
  sortOrder: SortOrder,
): { updates: Map<string, string>; result: PasteResult } {
  const sorted = sortFiles(files, sortOrder);
  const updates = new Map<string, string>();
  const count = Math.min(lines.length, sorted.length);

  for (let i = 0; i < count; i++) {
    const file = sorted[i];
    const line = lines[i];
    const parsed = splitFileName(line);

    if (file.extension && line.toLowerCase().endsWith(file.extension.toLowerCase())) {
      updates.set(file.id, parsed.stem);
    } else if (parsed.extension && !file.extension) {
      updates.set(file.id, line);
    } else {
      updates.set(file.id, parsed.extension ? parsed.stem : line);
    }
  }

  let warning: PasteWarning | undefined;
  if (lines.length > sorted.length) {
    warning = { key: "pasteWarningExcess", lines: lines.length, files: sorted.length };
  } else if (lines.length < sorted.length) {
    warning = {
      key: "pasteWarningShort",
      lines: lines.length,
      remaining: sorted.length - lines.length,
    };
  }

  return {
    updates,
    result: {
      updatedIds: Array.from(updates.keys()),
      lineCount: lines.length,
      fileCount: sorted.length,
      warning,
    },
  };
}
