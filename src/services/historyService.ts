import type { RenameSuccess } from "./fileService";

const HISTORY_KEY = "batch-rename-operation-history";
const MAX_ENTRIES = 30;
const MAX_RECORDS_PER_ENTRY = 5_000;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  count: number;
  successes: RenameSuccess[];
  undone: boolean;
}

function isRecord(value: unknown): value is RenameSuccess {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.oldPath === "string" && typeof record.newPath === "string";
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.timestamp === "number" &&
    typeof entry.count === "number" &&
    typeof entry.undone === "boolean" &&
    Array.isArray(entry.successes) &&
    entry.successes.every(isRecord)
  );
}

export function loadOperationHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 损坏的历史不能让界面崩溃，也不能把伪造记录送进后端。
    return parsed.filter(isEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function saveOperationHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // 本地存储不可用时静默忽略；真正的回滚能力来自本次执行结果，不依赖持久化。
  }
}

export function addOperationHistory(successes: RenameSuccess[]): HistoryEntry | null {
  if (successes.length === 0) return null;

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    count: successes.length,
    successes: successes.slice(0, MAX_RECORDS_PER_ENTRY),
    undone: false,
  };

  saveOperationHistory([entry, ...loadOperationHistory()]);
  return entry;
}

export function markHistoryUndone(id: string): void {
  saveOperationHistory(
    loadOperationHistory().map((e) => (e.id === id ? { ...e, undone: true } : e)),
  );
}

/**
 * 部分撤销成功后，只移除已还原的记录；仍有剩余记录时保持「未撤销」，
 * 用户可以再点一次撤销重试失败的那几个。
 * `undoneCurrentPaths` 是本次回滚结果里的 oldPath（即撤销前的文件路径）。
 */
export function updateHistoryAfterUndo(id: string, undoneCurrentPaths: Set<string>): void {
  const next = loadOperationHistory().map((entry) => {
    if (entry.id !== id) return entry;
    const remaining = entry.successes.filter(
      (record) => !undoneCurrentPaths.has(record.newPath),
    );
    return {
      ...entry,
      successes: remaining,
      count: remaining.length,
      undone: remaining.length === 0,
    };
  });
  saveOperationHistory(next);
}

export function getLastUndoableEntry(): HistoryEntry | undefined {
  return loadOperationHistory().find((e) => !e.undone);
}

export function clearOperationHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // 静默忽略
  }
}
