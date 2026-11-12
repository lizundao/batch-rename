import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { t, type Locale, type MessageKey } from "../i18n";
import { loadSettings, mergeWithDefaults, saveSettings } from "../services/settingsService";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tr: (key: MessageKey, ...args: (number | string)[]) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => mergeWithDefaults(loadSettings()).locale ?? "zh",
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    const merged = mergeWithDefaults(loadSettings());
    saveSettings({ ...merged, locale: next });
  }, []);

  const tr = useCallback(
    (key: MessageKey, ...args: (number | string)[]) => t(locale, key, ...args),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    document.title = t(locale, "appName");
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, tr }),
    [locale, setLocale, tr],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
