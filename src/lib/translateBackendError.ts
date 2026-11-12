import type { MessageKey } from "../i18n";

type TranslateFn = (key: MessageKey, ...args: (number | string)[]) => string;

const CODE_KEYS: Record<string, MessageKey> = {
  parent_dir: "errParentDir",
  target_exists: "errTargetExists",
  target_conflict: "errTargetConflict",
  duplicate_source: "errDuplicateSource",
  invalid_filename: "errInvalidFilename",
  invalid: "errorInvalidName",
  conflict: "errorNameConflict",
  not_a_file: "errNotAFile",
  io: "errIo",
  out_of_scope: "errOutOfScope",
  restore_failed: "errRestoreFailed",
  rollback_missing: "errRollbackMissing",
  rollback_target_exists: "errRollbackTargetExists",
  parse_original_name: "errParseOriginalName",
  batch_limit: "errBatchLimit",
  file_limit: "errFileLimit",
  unsafe_pattern: "errUnsafePattern",
  preview_error: "errPreviewError",
  preview_worker_error: "previewWorkerError",
  preview_worker_crash: "previewWorkerCrash",
  preview_worker_timeout: "errPreviewTimeout",
  preview_cancelled: "errPreviewCancelled",
};

export function translateBackendError(tr: TranslateFn, reason: string): string {
  const pipe = reason.indexOf("|");
  const code = pipe >= 0 ? reason.slice(0, pipe) : reason;
  const detail = pipe >= 0 ? reason.slice(pipe + 1) : "";
  const key = CODE_KEYS[code];

  if (key) {
    const msg = tr(key);
    return detail ? `${msg}: ${detail}` : msg;
  }

  return reason;
}
