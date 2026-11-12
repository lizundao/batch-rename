import { useI18n } from "../context/I18nContext";
import type { SmartRenameConfig } from "../types";
import type { MessageKey } from "../i18n";

interface SmartPanelProps {
  config: SmartRenameConfig;
  onChange: (config: SmartRenameConfig) => void;
}

const presets: { key: MessageKey; template: string }[] = [
  { key: "presetKeepName", template: "{stem}" },
  { key: "presetDateStem", template: "{date}_{stem}" },
  { key: "presetStemDate", template: "{stem}_{date}" },
  { key: "presetFiledateStem", template: "{filedate}_{stem}" },
  { key: "presetExifdateStem", template: "{exifdate}_{stem}" },
  { key: "presetArtistTitle", template: "{artist}_{title}" },
  { key: "presetAlbumTitle", template: "{album}_{title}" },
];

export function SmartPanel({ config, onChange }: SmartPanelProps) {
  const { tr } = useI18n();

  return (
    <div className="mode-panel">
      <label>
        {tr("template")}
        <input
          value={config.template}
          onChange={(e) => onChange({ ...config, template: e.target.value })}
          placeholder={tr("templatePlaceholder")}
        />
      </label>
      <p className="hint">{tr("smartVariablesHint")}</p>
      <div className="preset-row">
        {presets.map((p) => (
          <button
            key={p.template}
            type="button"
            onClick={() => onChange({ template: p.template })}
          >
            {tr(p.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
