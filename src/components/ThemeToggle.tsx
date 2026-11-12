import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../context/I18nContext";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const { tr } = useI18n();
  const isDark = theme === "dark";
  const title = isDark ? tr("themeLight") : tr("themeDark");

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      title={title}
      aria-label={title}
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
