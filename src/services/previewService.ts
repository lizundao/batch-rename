import type { FileItem, RenameConfig, RenameMode, SortOrder } from "../types";

export interface PreviewJob {
  id: number;
  files: FileItem[];
  mode: RenameMode;
  config: RenameConfig;
  sortOrder: SortOrder;
}

export interface PreviewJobResult {
  id: number;
  ok: boolean;
  result?: FileItem[];
  error?: string;
}

interface Waiter {
  resolve: (files: FileItem[]) => void;
  reject: (err: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/** Worker 里的正则一旦卡死无法中断，超时后必须 terminate 并重建。 */
const PREVIEW_TIMEOUT_MS = 10_000;

let worker: Worker | null = null;
let jobSeq = 0;
let activeJobId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const waiters = new Map<number, Waiter>();

function disposeWorker() {
  if (worker) {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    worker = null;
  }
}

function settle(id: number, fn: (waiter: Waiter) => void) {
  const waiter = waiters.get(id);
  if (!waiter) return;
  waiters.delete(id);
  if (waiter.timer) clearTimeout(waiter.timer);
  fn(waiter);
}

function rejectAll(reason: string, restartWorker: boolean) {
  for (const [id, waiter] of waiters) {
    if (waiter.timer) clearTimeout(waiter.timer);
    waiter.reject(new Error(reason));
    waiters.delete(id);
  }
  if (restartWorker) disposeWorker();
}

function ensureWorker(): Worker {
  if (worker) return worker;

  const next = new Worker(new URL("../workers/preview.worker.ts", import.meta.url), {
    type: "module",
  });

  next.onmessage = (event: MessageEvent<PreviewJobResult>) => {
    const { id, ok, result, error } = event.data;
    if (id !== activeJobId) return;
    settle(id, (waiter) => {
      if (ok && result) waiter.resolve(result);
      else waiter.reject(new Error(error ?? "preview_worker_error"));
    });
  };

  next.onerror = () => {
    // 崩溃后销毁实例，下一次 schedulePreview 会重新创建，避免此后所有预览都失效。
    rejectAll("preview_worker_crash", true);
  };

  worker = next;
  return next;
}

export function schedulePreview(
  files: FileItem[],
  mode: RenameMode,
  config: RenameConfig,
  sortOrder: SortOrder,
  debounceMs = 120,
): Promise<FileItem[]> {
  // 上一个未完成的 job 必须显式 settle，避免 Promise 永远悬挂。
  rejectAll("preview_cancelled", false);

  const jobId = ++jobSeq;
  activeJobId = jobId;
  if (debounceTimer) clearTimeout(debounceTimer);

  return new Promise((resolve, reject) => {
    const waiter: Waiter = { resolve, reject };
    waiters.set(jobId, waiter);

    waiter.timer = setTimeout(() => {
      if (!waiters.has(jobId)) return;
      settle(jobId, (w) => w.reject(new Error("preview_worker_timeout")));
      // 计算卡死时只能整体重启 Worker。
      disposeWorker();
    }, PREVIEW_TIMEOUT_MS + debounceMs);

    const run = () => {
      if (!waiters.has(jobId)) return;
      if (files.length === 0) {
        settle(jobId, (w) => w.resolve([]));
        return;
      }
      const payload: PreviewJob = { id: jobId, files, mode, config, sortOrder };
      try {
        ensureWorker().postMessage(payload);
      } catch (err) {
        settle(jobId, (w) =>
          w.reject(err instanceof Error ? err : new Error("preview_worker_error")),
        );
        disposeWorker();
      }
    };

    if (debounceMs <= 0) run();
    else debounceTimer = setTimeout(run, debounceMs);
  });
}

export function cancelPendingPreview() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  jobSeq += 1;
  activeJobId = jobSeq;
  rejectAll("preview_cancelled", false);
}
