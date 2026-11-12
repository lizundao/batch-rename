import { useI18n } from "../context/I18nContext";
import { translateBackendError } from "../lib/translateBackendError";
import type { FileItem, RenameMode } from "../types";
import type { MessageKey } from "../i18n";

interface FileListProps {
  files: FileItem[];
  mode: RenameMode;
  onRemove: (id: string) => void;
  onManualNameChange?: (id: string, name: string) => void;
}

const statusKeys: Record<FileItem["status"], MessageKey> = {
  unchanged: "statusUnchanged",
  changed: "statusChanged",
  conflict: "statusConflict",
  invalid: "statusInvalid",
};

export function FileList({ files, mode, onRemove, onManualNameChange }: FileListProps) {
  const { tr } = useI18n();

  const errorMessage = (file: FileItem): string | undefined =>
    file.error ? translateBackendError(tr, file.error) : undefined;

  const statusLabel = (file: FileItem): string => {
    if (file.renamePhase === "renaming") return tr("statusRenaming");
    if (file.renamePhase === "renamed") return tr("statusUpdated");
    if (file.renamePhase === "rename-failed") {
      return file.error ? translateBackendError(tr, file.error) : tr("statusConflict");
    }
    // 具体原因（保留名、危险正则、超出上限等）优先于笼统的「名称无效」。
    if (file.status === "invalid" && file.error && file.error !== "invalid") {
      return translateBackendError(tr, file.error);
    }
    return tr(statusKeys[file.status]);
  };

  const displayOriginalName = (file: FileItem): string =>
    file.previousName ?? file.originalName;

  if (files.length === 0) {
    return (
      <div className="file-list-empty">
        <p>{tr("fileListEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="file-list">
      <div className="file-list-header">
        <span>{tr("colOriginal")}</span>
        <span>{tr("colStatus")}</span>
        <span>{tr("colPreview")}</span>
        <span />
      </div>
      {files.map((file) => (
        <div
          key={file.id}
          className={`file-row status-${file.status}${file.renamePhase ? ` rename-phase-${file.renamePhase}` : ""}`}
        >
          <span className="file-original" title={file.path}>
            {displayOriginalName(file)}
          </span>
          <span
            className={`file-status status-${file.status}${file.renamePhase === "renamed" ? " status-renamed" : ""}`}
          >
            {file.renamePhase === "renaming" && (
              <span className="file-row-spinner" aria-hidden="true" />
            )}
            {statusLabel(file)}
          </span>
          {mode === "manual" ? (
            <input
              className="file-manual-input"
              value={file.manualName ?? file.stem}
              onChange={(e) => onManualNameChange?.(file.id, e.target.value)}
              placeholder={tr("manualNamePlaceholder")}
              disabled={file.renamePhase === "renaming"}
            />
          ) : (
            <span className="file-preview" title={errorMessage(file)}>
              {file.previewName}
            </span>
          )}
          <button
            type="button"
            className="file-remove"
            onClick={() => onRemove(file.id)}
            disabled={file.renamePhase === "renaming"}
            aria-label={tr("removeFile")}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
