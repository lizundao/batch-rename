import { InkdotLogo } from "./InkdotLogo";
import { ThemeToggle } from "./ThemeToggle";
import { APP_VERSION, BRAND_NAME, BRAND_SLUG } from "../constants/app";
import { useI18n } from "../context/I18nContext";
import type { RenameMode } from "../types";
import type { MessageKey } from "../i18n";

export type AppPage = "rename" | "about" | "license";

const modeKeys: Record<RenameMode, MessageKey> = {
  "find-replace": "modeFindReplace",
  smart: "modeSmart",
  insert: "modeInsert",
  "auto-number": "modeAutoNumber",
  manual: "modeManual",
};

const modes: RenameMode[] = [
  "find-replace",
  "smart",
  "insert",
  "auto-number",
  "manual",
];

interface SidebarProps {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  renameMode: RenameMode;
  onRenameModeChange: (mode: RenameMode) => void;
}

export function Sidebar({
  page,
  onNavigate,
  renameMode,
  onRenameModeChange,
}: SidebarProps) {
  const { tr, locale, setLocale } = useI18n();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <InkdotLogo size={28} className="sidebar-app-logo" />
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-row">
            <span className="sidebar-app-name">{tr("appName")}</span>
            <ThemeToggle className="sidebar-theme-toggle" />
          </div>
          <div className="sidebar-brand-name">
            {BRAND_NAME} {BRAND_SLUG}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-group">
          <div className="sidebar-nav-label">{tr("navTools")}</div>
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={page === "rename" && renameMode === mode ? "active" : ""}
              onClick={() => onRenameModeChange(mode)}
            >
              {tr(modeKeys[mode])}
            </button>
          ))}
        </div>

        <div className="sidebar-nav-group">
          <div className="sidebar-nav-label">{tr("navAbout")}</div>
          <button
            type="button"
            className={page === "about" ? "active" : ""}
            onClick={() => onNavigate("about")}
          >
            {tr("navAbout")}
          </button>
          <button
            type="button"
            className={page === "license" ? "active" : ""}
            onClick={() => onNavigate("license")}
          >
            {tr("navLicense")}
          </button>
        </div>
      </nav>

      <div className="sidebar-locale">
        <label>
          {tr("language")}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "zh" | "en")}
          >
            <option value="zh">{tr("langZh")}</option>
            <option value="en">{tr("langEn")}</option>
          </select>
        </label>
      </div>

      <div className="sidebar-footer">
        v{APP_VERSION} · {BRAND_NAME} {BRAND_SLUG}
      </div>
    </aside>
  );
}
