import { useI18n } from "../context/I18nContext";

interface ManualPanelProps {
  fileCount: number;
  onPaste: () => void;
}

export function ManualPanel({ fileCount, onPaste }: ManualPanelProps) {
  const { tr } = useI18n();

  return (
    <div className="mode-panel manual-panel">
      <p className="hint">{tr("manualHint")}</p>
      <button type="button" onClick={onPaste} disabled={fileCount === 0}>
        {tr("batchPaste")}
      </button>
    </div>
  );
}
