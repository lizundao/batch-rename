import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  FileItem,
  RenameConfig,
  RenameMode,
  SortOrder,
} from "../types";
import type { TaskState } from "../types/task";
import { applyPasteLines, parsePasteLines, type PasteWarning } from "../lib/paste";
import {
  applyRenameSuccess,
  applyUndoToFiles,
  toIdleDisplayFiles,
} from "../lib/renameApply";
import { MAX_PREVIEW_FILES } from "../lib/previewCore";
import { schedulePreview, cancelPendingPreview } from "../services/previewService";
import {
  executeRenameOnDisk,
  loadPathsFromDisk,
  rollbackRenameOnDisk,
  type RenameResult,
  type RenameSuccess,
} from "../services/fileService";
import {
  loadSettings,
  mergeWithDefaults,
  pushFindHistory,
  saveSettings,
} from "../services/settingsService";
import {
  addOperationHistory,
  clearOperationHistory,
  loadOperationHistory,
  markHistoryUndone,
  updateHistoryAfterUndo,
  type HistoryEntry,
} from "../services/historyService";
import type { MessageKey } from "../i18n";

const MAX_LIST_FILES = MAX_PREVIEW_FILES;

function readInitialSettings() {
  return mergeWithDefaults(loadSettings());
}

export function useBatchRename() {
  const initial = useRef(readInitialSettings()).current;

  const [files, setFiles] = useState<FileItem[]>([]);
  const [previewFiles, setPreviewFiles] = useState<FileItem[]>([]);
  const [mode, setMode] = useState<RenameMode>(initial.mode);
  const [config, setConfig] = useState<RenameConfig>(initial.config);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initial.sortOrder);
  const [recursive, setRecursive] = useState(initial.recursive);
  const [findHistory, setFindHistory] = useState<string[]>(initial.findHistory);
  const [operationHistory, setOperationHistory] = useState<HistoryEntry[]>(() =>
    loadOperationHistory(),
  );
  const [taskState, setTaskState] = useState<TaskState>({
    isPreviewPending: false,
    isLoadingFiles: false,
    isExecuting: false,
    executeProgress: undefined,
  });
  const [previewReady, setPreviewReady] = useState(false);

  const skipPreviewRef = useRef(false);
  const [debouncedConfig, setDebouncedConfig] = useState(config);

  const setNotice = useCallback((notice?: string) => {
    setTaskState((s) => ({ ...s, notice }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedConfig(config), 400);
    return () => clearTimeout(timer);
  }, [config]);

  const syncFileLists = useCallback((updater: (prev: FileItem[]) => FileItem[]) => {
    setFiles(updater);
    setPreviewFiles(updater);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const merged = mergeWithDefaults(loadSettings());
      saveSettings({
        mode,
        config,
        sortOrder,
        recursive,
        findHistory,
        locale: merged.locale,
        theme: merged.theme,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [mode, config, sortOrder, recursive, findHistory]);

  const refreshHistory = useCallback(() => {
    setOperationHistory(loadOperationHistory());
  }, []);

  // 所有模式统一在 Worker 里计算预览：规则模式也能看到目标文件名，
  // 主线程不再执行用户正则，统计与执行都读取同一份快照。
  useEffect(() => {
    if (skipPreviewRef.current) return;

    let cancelled = false;
    setPreviewReady(false);
    setTaskState((s) => ({ ...s, isPreviewPending: true }));

    schedulePreview(files, mode, debouncedConfig, sortOrder)
      .then((result) => {
        if (cancelled) return;
        setPreviewFiles(result);
        setPreviewReady(true);
        setTaskState((s) => ({ ...s, isPreviewPending: false }));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setPreviewFiles(toIdleDisplayFiles(files));
        setPreviewReady(false);
        const reason = err?.message ?? "preview_worker_error";
        setTaskState((s) => ({
          ...s,
          isPreviewPending: false,
          notice: `preview_failed|${reason}`,
        }));
      });

    return () => {
      cancelled = true;
      cancelPendingPreview();
    };
  }, [files, mode, debouncedConfig, sortOrder]);

  const mergeFiles = useCallback(
    (items: FileItem[]) => {
      setFiles((prev) => {
        const existing = new Set(prev.map((f) => f.path));
        const joined = [...prev, ...items.filter((f) => !existing.has(f.path))];
        if (joined.length > MAX_LIST_FILES) {
          setNotice(`list_truncated|${MAX_LIST_FILES}`);
          return joined.slice(0, MAX_LIST_FILES);
        }
        return joined;
      });
    },
    [setNotice],
  );

  const withFileLoading = useCallback(
    async (task: () => Promise<{ items: FileItem[]; truncated: boolean }>) => {
      setTaskState((s) => ({ ...s, isLoadingFiles: true }));
      try {
        const { items, truncated } = await task();
        mergeFiles(items);
        if (truncated) setNotice(`scan_truncated|${MAX_LIST_FILES}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        setNotice(`load_failed|${reason}`);
      } finally {
        setTaskState((s) => ({ ...s, isLoadingFiles: false }));
      }
    },
    [mergeFiles, setNotice],
  );

  const addFiles = useCallback(async () => {
    const selected = await open({ multiple: true, directory: false });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await withFileLoading(() => loadPathsFromDisk(paths, false));
  }, [withFileLoading]);

  const addFolder = useCallback(async () => {
    const selected = await open({ multiple: false, directory: true });
    if (!selected || Array.isArray(selected)) return;
    await withFileLoading(() => loadPathsFromDisk([selected], recursive));
  }, [recursive, withFileLoading]);

  const addPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      await withFileLoading(() => loadPathsFromDisk(paths, recursive));
    },
    [recursive, withFileLoading],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setPreviewFiles([]);
    setNotice(undefined);
  }, [setNotice]);

  const updateConfig = useCallback((patch: Partial<RenameConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const commitFindHistory = useCallback((value: string) => {
    setFindHistory((prev) => pushFindHistory(prev, value));
  }, []);

  const setManualName = useCallback((id: string, manualName: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, manualName } : f)),
    );
  }, []);

  const pasteManualNames = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    const lines = parsePasteLines(text);
    if (lines.length === 0) {
      return { ok: false as const, errorKey: "clipboardEmpty" as MessageKey };
    }

    let applied = 0;
    let warning: PasteWarning | undefined;

    setFiles((prev) => {
      const { updates, result } = applyPasteLines(prev, lines, sortOrder);
      applied = result.updatedIds.length;
      warning = result.warning;
      return prev.map((f) => {
        const name = updates.get(f.id);
        return name !== undefined ? { ...f, manualName: name } : f;
      });
    });

    return { ok: true as const, applied, warning };
  }, [sortOrder]);

  const configSettled = useMemo(
    () => JSON.stringify(config) === JSON.stringify(debouncedConfig),
    [config, debouncedConfig],
  );

  const executeRename = useCallback(async () => {
    if (!previewReady || !configSettled || taskState.isPreviewPending) {
      return { ok: false as const, errorKey: "previewPendingExecute" as MessageKey };
    }

    // 只执行界面上已经展示过的那份预览，保证「所见即所得」。
    const targets = previewFiles.filter((f) => f.status === "changed");
    const operations = targets.map((f) => ({ path: f.path, newName: f.previewName }));

    if (operations.length === 0) {
      return { ok: false as const, errorKey: "noChangesToExecute" as MessageKey };
    }
    if (operations.length > MAX_PREVIEW_FILES) {
      return { ok: false as const, errorKey: "batchTooLarge" as MessageKey };
    }

    for (const rule of config.findReplace.rules) {
      if (rule.find.trim()) {
        setFindHistory((prev) => pushFindHistory(prev, rule.find));
      }
    }

    skipPreviewRef.current = true;
    setNotice(undefined);
    setTaskState((s) => ({
      ...s,
      isExecuting: true,
      isPreviewPending: false,
      executeProgress: { current: 0, total: operations.length },
    }));

    try {
      // 整批一次提交：后端用两阶段临时名事务处理交换/链式，并逐条返回结果。
      const result: RenameResult = await executeRenameOnDisk(operations);

      const successByPath = new Map(result.successes.map((s) => [s.oldPath, s]));
      const failureByPath = new Map(result.failures.map((f) => [f.path, f]));

      syncFileLists((prev) =>
        prev.map((f) => {
          const success = successByPath.get(f.path);
          if (success) return applyRenameSuccess(f, success);
          const failure = failureByPath.get(f.path);
          if (failure) {
            return {
              ...f,
              renamePhase: "rename-failed" as const,
              error: failure.reason,
            };
          }
          return f;
        }),
      );

      let historyId: string | undefined;
      if (result.successes.length > 0) {
        // 单次 IPC 完成后立即落盘，中途不会再出现「改了名却没有撤销记录」。
        const entry = addOperationHistory(result.successes);
        historyId = entry?.id;
        refreshHistory();
      }

      return {
        ok: true as const,
        result,
        allSuccess: result.failures.length === 0,
        historyId,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setNotice(`rename_failed|${reason}`);
      return { ok: false as const, errorKey: "renameIpcError" as MessageKey };
    } finally {
      skipPreviewRef.current = false;
      setTaskState((s) => ({
        ...s,
        isExecuting: false,
        executeProgress: undefined,
      }));
    }
  }, [
    previewReady,
    configSettled,
    taskState.isPreviewPending,
    previewFiles,
    config.findReplace.rules,
    refreshHistory,
    syncFileLists,
    setNotice,
  ]);

  /** 用本次执行的真实成功记录回滚，不依赖历史列表或渲染闭包。 */
  const rollbackBatch = useCallback(
    async (records: RenameSuccess[], historyId?: string) => {
      if (records.length === 0) {
        return { ok: false as const, errorKey: "noRollbackRecords" as MessageKey };
      }
      setTaskState((s) => ({ ...s, isExecuting: true }));
      try {
        const result = await rollbackRenameOnDisk(records);
        if (result.successes.length > 0) {
          skipPreviewRef.current = true;
          syncFileLists((prev) => applyUndoToFiles(prev, result.successes));
          skipPreviewRef.current = false;
        }
        if (historyId) {
          const undonePaths = new Set(result.successes.map((s) => s.oldPath));
          if (result.failures.length === 0) markHistoryUndone(historyId);
          else updateHistoryAfterUndo(historyId, undonePaths);
          refreshHistory();
        }
        return { ok: true as const, result };
      } finally {
        setTaskState((s) => ({ ...s, isExecuting: false }));
      }
    },
    [refreshHistory, syncFileLists],
  );

  const undoHistoryEntry = useCallback(
    async (id: string) => {
      const entry = operationHistory.find((e) => e.id === id);
      if (!entry) {
        return { ok: false as const, errorKey: "historyEntryNotFound" as MessageKey };
      }
      if (entry.undone) {
        return { ok: false as const, errorKey: "historyAlreadyUndone" as MessageKey };
      }

      setTaskState((s) => ({ ...s, isExecuting: true }));
      try {
        const result = await rollbackRenameOnDisk(entry.successes);
        if (result.successes.length > 0) {
          skipPreviewRef.current = true;
          // 只还原真正成功的记录，失败项仍保持新文件名。
          syncFileLists((prev) => applyUndoToFiles(prev, result.successes));
          skipPreviewRef.current = false;
        }
        const undonePaths = new Set(result.successes.map((s) => s.oldPath));
        // 有失败项时保留「未撤销」状态，用户可以再次点击重试。
        if (result.failures.length === 0) markHistoryUndone(id);
        else updateHistoryAfterUndo(id, undonePaths);
        refreshHistory();
        return { ok: true as const, result };
      } finally {
        setTaskState((s) => ({ ...s, isExecuting: false }));
      }
    },
    [operationHistory, refreshHistory, syncFileLists],
  );

  const undoLastHistory = useCallback(async () => {
    const entry = operationHistory.find((e) => !e.undone);
    if (!entry) {
      return { ok: false as const, errorKey: "noUndoAvailable" as MessageKey };
    }
    return undoHistoryEntry(entry.id);
  }, [operationHistory, undoHistoryEntry]);

  const clearHistory = useCallback(() => {
    clearOperationHistory();
    refreshHistory();
  }, [refreshHistory]);

  const stats = useMemo(() => {
    const total = files.length;
    let changed = 0;
    let invalid = 0;
    let conflict = 0;
    for (const file of previewFiles) {
      if (file.status === "changed") changed += 1;
      else if (file.status === "invalid") invalid += 1;
      else if (file.status === "conflict") conflict += 1;
    }
    return { total, changed, invalid, conflict };
  }, [files.length, previewFiles]);

  return {
    files: previewFiles,
    mode,
    setMode,
    config,
    updateConfig,
    sortOrder,
    setSortOrder,
    recursive,
    setRecursive,
    findHistory,
    commitFindHistory,
    addFiles,
    addFolder,
    addPaths,
    removeFile,
    clearFiles,
    setManualName,
    pasteManualNames,
    executeRename,
    rollbackBatch,
    undoHistoryEntry,
    undoLastHistory,
    operationHistory,
    clearHistory,
    stats,
    taskState,
    previewReady,
    configSettled,
    clearNotice: () => setNotice(undefined),
  };
}

export type BatchRenameState = ReturnType<typeof useBatchRename>;
