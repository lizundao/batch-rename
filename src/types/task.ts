export interface TaskState {
  isPreviewPending: boolean;
  isLoadingFiles: boolean;
  isExecuting: boolean;
  executeProgress?: { current: number; total: number };
  /** 形如 "code|detail" 的提示，由状态栏统一翻译展示。 */
  notice?: string;
}

export const idleTaskState: TaskState = {
  isPreviewPending: false,
  isLoadingFiles: false,
  isExecuting: false,
  executeProgress: undefined,
};

export function isBusy(state: TaskState): boolean {
  return state.isPreviewPending || state.isLoadingFiles || state.isExecuting;
}
