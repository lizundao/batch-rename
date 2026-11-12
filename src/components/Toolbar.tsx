import type { SortOrder } from "../types";
import type { TaskState } from "../types/task";
import { isBusy } from "../types/task";
import { useI18n } from "../context/I18nContext";

interface ToolbarProps {
  total: number;
  changed: number;
  sortOrder: SortOrder;
  recursive: boolean;
  taskState: TaskState;
  onAddFiles: () => void;
  onAddFolder: () => void;
  onClear: () => void;
  onSortChange: (order: SortOrder) => void;
  onRecursiveChange: (value: boolean) => void;
  onExecute?: () => void;
  canExecute?: boolean;
}

export function Toolbar({
  total,
  changed,
  sortOrder,
  recursive,
  taskState,
  onAddFiles,
  onAddFolder,
  onClear,
  onSortChange,
  onRecursiveChange,
  onExecute,
  canExecute = false,
}: ToolbarProps) {
  const { tr } = useI18n();
  const busy = isBusy(taskState);

  const sortOptions: { value: SortOrder; label: string }[] = [
    { value: "name-asc", label: tr("sortNameAsc") },
    { value: "name-desc", label: tr("sortNameDesc") },
    { value: "modified-asc", label: tr("sortModifiedAsc") },
    { value: "modified-desc", label: tr("sortModifiedDesc") },
  ];

  return (
    <footer className="toolbar">
      <div className="toolbar-left">
        <button type="button" onClick={onAddFiles} disabled={busy} title={tr("hotkeyOpenFiles")}>
          {tr("addFiles")}
        </button>
        <button
          type="button"
          onClick={onAddFolder}
          disabled={busy}
          title={tr("hotkeyOpenFolder")}
        >
          {tr("addFolder")}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={total === 0 || busy}
          title={tr("hotkeyClearList")}
        >
          {tr("clear")}
        </button>
        <label className="toolbar-recursive">
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => onRecursiveChange(e.target.checked)}
          />
          {tr("recursive")}
        </label>
      </div>
      <div className="toolbar-center">
        <select
          value={sortOrder}
          onChange={(e) => onSortChange(e.target.value as SortOrder)}
          disabled={total === 0}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="toolbar-stats">
          {tr("filesSelected", total)}
          {changed > 0 &&
            `${tr("statsChangedSeparator")}${tr("filesChanged", changed)}`}
        </span>
      </div>
      <div className="toolbar-right">
        <button
          type="button"
          className="btn-primary"
          onClick={onExecute}
          disabled={!canExecute || busy}
          title={tr("hotkeyExecute")}
        >
          {taskState.isExecuting ? tr("executing") : tr("execute")}
        </button>
      </div>
    </footer>
  );
}
