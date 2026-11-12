import { computePreview } from "../lib/previewCore";
import type { PreviewJob, PreviewJobResult } from "../services/previewService";

self.onmessage = (event: MessageEvent<PreviewJob>) => {
  const { id, files, mode, config, sortOrder } = event.data;

  try {
    const result = computePreview(files, mode, config, sortOrder);
    const payload: PreviewJobResult = { id, ok: true, result };
    self.postMessage(payload);
  } catch (err) {
    const payload: PreviewJobResult = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(payload);
  }
};

export {};
