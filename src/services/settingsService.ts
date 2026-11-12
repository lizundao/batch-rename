import type { RenameConfig, RenameMode, SortOrder } from "../types";
import type { Locale } from "../i18n";
import type { Theme } from "../context/ThemeContext";
import { defaultRenameConfig } from "../types";

const STORAGE_KEY = "batch-rename-settings";
const MAX_FIND_HISTORY = 12;

export interface PersistedSettings {
  version: 1;
  mode: RenameMode;
  config: RenameConfig;
  sortOrder: SortOrder;
  recursive: boolean;
  findHistory: string[];
  locale?: Locale;
  theme?: Theme;
}

export function loadSettings(): Partial<PersistedSettings> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSettings;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSettings(settings: Omit<PersistedSettings, "version">): void {
  try {
    const payload: PersistedSettings = { version: 1, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 本地存储不可用时静默忽略
  }
}

/** 持久化配置可能被手工改坏（NaN / Infinity / 字符串），读取时统一夹紧到安全范围。 */
function safeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const n = Math.trunc(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function mergeWithDefaults(
  partial: Partial<PersistedSettings> | null,
): Omit<PersistedSettings, "version"> {
  const defaults = defaultRenameConfig();
  if (!partial) {
    return {
      mode: "find-replace",
      config: defaults,
      sortOrder: "name-asc",
      recursive: true,
      findHistory: [],
      locale: "zh",
      theme: "light",
    };
  }

  return {
    mode: partial.mode ?? "find-replace",
    config: {
      findReplace: partial.config?.findReplace ?? defaults.findReplace,
      autoNumber: {
        ...defaults.autoNumber,
        ...partial.config?.autoNumber,
        start: safeNumber(partial.config?.autoNumber?.start, 1, -1_000_000_000, 1_000_000_000),
        padding: safeNumber(partial.config?.autoNumber?.padding, 1, 0, 32),
      },
      insert: {
        ...defaults.insert,
        ...partial.config?.insert,
        index: safeNumber(partial.config?.insert?.index, 0, 0, 4096),
      },
      smart: { ...defaults.smart, ...partial.config?.smart },
    },
    sortOrder: partial.sortOrder ?? "name-asc",
    recursive: partial.recursive ?? true,
    findHistory: partial.findHistory ?? [],
    locale: partial.locale ?? "zh",
    theme: partial.theme ?? "light",
  };
}

export function pushFindHistory(history: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return history;
  const next = [trimmed, ...history.filter((h) => h !== trimmed)];
  return next.slice(0, MAX_FIND_HISTORY);
}
