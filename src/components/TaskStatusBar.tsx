import type { TaskState } from "../types/task";
import { isBusy } from "../types/task";
import { useI18n } from "../context/I18nContext";
import { translateBackendError } from "../lib/translateBackendError";
import type { MessageKey } from "../i18n";

interface TaskStatusBarProps {
  taskState: TaskState;
  onDismissNotice?: () => void;
}

type TranslateFn = (key: MessageKey, ...args: (number | string)[]) => string;

function formatNotice(notice: string, tr: TranslateFn): string {
  const pipe = notice.indexOf("|");
  const code = pipe >= 0 ? notice.slice(0, pipe) : notice;
  const detail = pipe >= 0 ? notice.slice(pipe + 1) : "";

  switch (code) {
    case "scan_truncated":
      return tr("noticeScanTruncated", Number(detail) || 0);
    case "list_truncated":
      return tr("noticeListTruncated", Number(detail) || 0);
    case "preview_failed":
      return tr("noticePreviewFailed", translateBackendError(tr, detail));
    case "load_failed":
      return tr("noticeLoadFailed", translateBackendError(tr, detail));
    case "rename_failed":
      return tr("noticeRenameFailed", translateBackendError(tr, detail));
    default:
      return translateBackendError(tr, notice);
  }
}

export function TaskStatusBar({ taskState, onDismissNotice }: TaskStatusBarProps) {
  const { tr } = useI18n();
  const busy = isBusy(taskState);
  const notice = taskState.notice;

  if (!busy && !notice) return null;

  let message = "";
  if (busy) {
    if (taskState.isExecuting) {
      message = taskState.executeProgress
        ? tr("executingProgress", taskState.executeProgress.current, taskState.executeProgress.total)
        : tr("executingTask");
    } else if (taskState.isLoadingFiles) {
      message = tr("loadingFiles");
    } else if (taskState.isPreviewPending) {
      message = tr("previewPending");
    }
  }

  return (
    <div className="task-status-area">
      {busy && (
        <div className="task-status-bar" role="status" aria-live="polite">
          <span className="task-spinner" />
          {message}
        </div>
      )}
      {notice && (
        <div className="task-notice" role="alert">
          <span>{formatNotice(notice, tr)}</span>
          {onDismissNotice && (
            <button type="button" className="task-notice-close" onClick={onDismissNotice} aria-label="close">
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
