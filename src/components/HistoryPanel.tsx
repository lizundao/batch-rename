import type { HistoryEntry } from "../services/historyService";
import { useI18n } from "../context/I18nContext";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onUndo: (id: string) => void;
  onClear: () => void;
  busy: boolean;
}

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "zh-CN");
}

export function HistoryPanel({ entries, onUndo, onClear, busy }: HistoryPanelProps) {
  const { tr, locale } = useI18n();

  return (
    <section className="history-panel">
      <div className="history-header">
        <h2>{tr("historyTitle")}</h2>
        {entries.length > 0 && (
          <button type="button" onClick={onClear} disabled={busy}>
            {tr("historyClear")}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="hint">{tr("historyEmpty")}</p>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => (
            <li key={entry.id} className={entry.undone ? "undone" : ""}>
              <div className="history-meta">
                <span>{formatTime(entry.timestamp, locale)}</span>
                <span>{tr("historyCount", entry.count)}</span>
              </div>
              {entry.undone ? (
                <span className="history-status">{tr("historyUndone")}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onUndo(entry.id)}
                  disabled={busy}
                >
                  {tr("historyUndo")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
