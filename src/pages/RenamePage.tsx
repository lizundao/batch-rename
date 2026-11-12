import { useCallback, useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { BatchRenameState } from "../hooks/useBatchRename";
import { useHotkeys } from "../hooks/useHotkeys";
import { useI18n } from "../context/I18nContext";
import { FileList } from "../components/FileList";
import { Toolbar } from "../components/Toolbar";
import { TaskStatusBar } from "../components/TaskStatusBar";
import { HistoryPanel } from "../components/HistoryPanel";
import { FindReplacePanel } from "../components/FindReplacePanel";
import { AutoNumberPanel } from "../components/AutoNumberPanel";
import { InsertPanel } from "../components/InsertPanel";
import { SmartPanel } from "../components/SmartPanel";
import { ManualPanel } from "../components/ManualPanel";
import { isBusy } from "../types/task";
import type { PasteWarning } from "../lib/paste";
import { translateBackendError } from "../lib/translateBackendError";

interface RenamePageProps {
  batch: BatchRenameState;
}

export function RenamePage({ batch }: RenamePageProps) {
  const { tr } = useI18n();
  const {
    files,
    mode,
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
    clearNotice,
  } = batch;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    (async () => {
      unlisten = await getCurrentWindow().onDragDropEvent((event) => {
        if (cancelled) return;
        if (event.payload.type === "drop") {
          void addPaths(event.payload.paths);
        }
      });
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [addPaths]);

  const formatPasteWarning = useCallback(
    (warning: PasteWarning) => {
      if (warning.key === "pasteWarningExcess") {
        return tr("pasteWarningExcess", warning.lines, warning.files);
      }
      return tr("pasteWarningShort", warning.lines, warning.remaining);
    },
    [tr],
  );

  const handlePaste = useCallback(async () => {
    try {
      const result = await pasteManualNames();
      if (!result.ok) {
        window.alert(tr(result.errorKey));
        return;
      }
      if (result.warning) {
        window.alert(
          `${tr("pastedFiles", result.applied)}\n\n${formatPasteWarning(result.warning)}`,
        );
      }
    } catch {
      window.alert(tr("clipboardError"));
    }
  }, [pasteManualNames, tr, formatPasteWarning]);

  useEffect(() => {
    if (mode !== "manual") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && stats.total > 0) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        void handlePaste();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, stats.total, handlePaste]);

  const canExecute =
    stats.total > 0 &&
    stats.changed > 0 &&
    stats.invalid === 0 &&
    stats.conflict === 0 &&
    !taskState.isExecuting &&
    !taskState.isPreviewPending &&
    previewReady &&
    configSettled;

  const handleUndo = useCallback(
    async (id?: string) => {
      const outcome = id ? await undoHistoryEntry(id) : await undoLastHistory();
      if (!outcome.ok) {
        window.alert(tr(outcome.errorKey));
        return;
      }
      const { result } = outcome;
      if (result.failures.length > 0) {
        const msg = result.failures
          .map((f) => `${f.path}\n  ${translateBackendError(tr, f.reason)}`)
          .join("\n\n");
        window.alert(
          `${tr("undoPartial", result.successCount, result.failures.length)}\n\n${msg}\n\n${tr("undoRetryHint")}`,
        );
      }
    },
    [undoHistoryEntry, undoLastHistory, tr],
  );

  const handleExecute = useCallback(async () => {
    if (!canExecute || isBusy(taskState)) return;

    const confirmed = window.confirm(tr("confirmRename", stats.changed));
    if (!confirmed) return;

    const outcome = await executeRename();
    if (!outcome.ok) {
      window.alert(tr(outcome.errorKey));
      return;
    }

    const { result, allSuccess, historyId } = outcome;

    if (allSuccess) {
      window.alert(tr("renameSuccess", result.successCount));
      return;
    }

    const failMsg = result.failures
      .map((f) => `${f.path}\n  ${translateBackendError(tr, f.reason)}`)
      .join("\n\n");

    if (result.successCount > 0) {
      const wantRollback = window.confirm(
        `${tr("renamePartial", result.successCount, result.failures.length)}\n\n${failMsg}\n\n${tr("rollbackPrompt", result.successCount)}`,
      );

      if (wantRollback) {
        // 用本次执行的真实成功记录回滚，避免误撤销上一次操作。
        const rollback = await rollbackBatch(result.successes, historyId);
        if (rollback.ok && rollback.result.failures.length > 0) {
          window.alert(
            `${tr("undoPartial", rollback.result.successCount, rollback.result.failures.length)}\n\n${tr("undoRetryHint")}`,
          );
        }
      }
    } else {
      window.alert(`${tr("renameAllFailed", result.failures.length)}\n\n${failMsg}`);
    }
  }, [canExecute, taskState, stats.changed, executeRename, rollbackBatch, tr]);

  const hotkeys = useMemo(
    () => [
      {
        key: "o",
        ctrl: true,
        handler: () => void addFiles(),
        when: () => !isBusy(taskState),
      },
      {
        key: "o",
        ctrl: true,
        shift: true,
        handler: () => void addFolder(),
        when: () => !isBusy(taskState),
      },
      {
        key: "Enter",
        ctrl: true,
        handler: () => void handleExecute(),
        when: () => canExecute && !isBusy(taskState),
      },
      {
        key: "l",
        ctrl: true,
        shift: true,
        handler: () => clearFiles(),
        when: () => stats.total > 0 && !isBusy(taskState),
      },
      {
        key: "z",
        ctrl: true,
        handler: () => void handleUndo(),
        when: () => !isBusy(taskState) && operationHistory.some((e) => !e.undone),
      },
    ],
    [
      addFiles,
      addFolder,
      clearFiles,
      handleExecute,
      handleUndo,
      canExecute,
      stats.total,
      taskState,
      operationHistory,
    ],
  );

  useHotkeys(hotkeys);

  return (
    <div className="rename-page">
      <TaskStatusBar taskState={taskState} onDismissNotice={clearNotice} />

      <section className="config-area">
        {mode === "find-replace" && (
          <FindReplacePanel
            config={config.findReplace}
            findHistory={findHistory}
            onChange={(findReplace) => updateConfig({ findReplace })}
            onFindCommit={commitFindHistory}
          />
        )}
        {mode === "auto-number" && (
          <AutoNumberPanel
            config={config.autoNumber}
            onChange={(autoNumber) => updateConfig({ autoNumber })}
          />
        )}
        {mode === "insert" && (
          <InsertPanel
            config={config.insert}
            onChange={(insert) => updateConfig({ insert })}
          />
        )}
        {mode === "smart" && (
          <SmartPanel
            config={config.smart}
            onChange={(smart) => updateConfig({ smart })}
          />
        )}
        {mode === "manual" && (
          <ManualPanel
            fileCount={stats.total}
            onPaste={() => void handlePaste()}
          />
        )}
      </section>

      <main
        className={`file-area${mode === "manual" && taskState.isPreviewPending ? " is-dimmed" : ""}`}
      >
        <FileList
          files={files}
          mode={mode}
          onRemove={removeFile}
          onManualNameChange={setManualName}
        />
      </main>

      <HistoryPanel
        entries={operationHistory}
        onUndo={(id) => void handleUndo(id)}
        onClear={clearHistory}
        busy={isBusy(taskState)}
      />

      <Toolbar
        total={stats.total}
        changed={stats.changed}
        sortOrder={sortOrder}
        recursive={recursive}
        taskState={taskState}
        onAddFiles={() => void addFiles()}
        onAddFolder={() => void addFolder()}
        onClear={clearFiles}
        onSortChange={setSortOrder}
        onRecursiveChange={setRecursive}
        onExecute={() => void handleExecute()}
        canExecute={canExecute}
      />
    </div>
  );
}
