import { useI18n } from "../context/I18nContext";
import type { InsertConfig } from "../types";
import type { MessageKey } from "../i18n";

interface InsertPanelProps {
  config: InsertConfig;
  onChange: (config: InsertConfig) => void;
}

const contentTypes: { value: InsertConfig["contentType"]; key: MessageKey }[] = [
  { value: "text", key: "contentText" },
  { value: "serial", key: "contentSerial" },
  { value: "file-info", key: "contentFileInfo" },
];

const positions: { value: InsertConfig["position"]; key: MessageKey }[] = [
  { value: "start", key: "positionStart" },
  { value: "index", key: "positionIndex" },
  { value: "end", key: "positionEnd" },
];

const fileInfoFields: { value: InsertConfig["fileInfoField"]; key: MessageKey }[] = [
  { value: "modified", key: "fieldModified" },
  { value: "created", key: "fieldCreated" },
  { value: "size", key: "fieldSize" },
  { value: "width", key: "fieldWidth" },
  { value: "height", key: "fieldHeight" },
  { value: "dimensions", key: "fieldDimensions" },
  { value: "exif-taken", key: "fieldExifTaken" },
  { value: "id3-title", key: "fieldId3Title" },
  { value: "id3-artist", key: "fieldId3Artist" },
  { value: "id3-album", key: "fieldId3Album" },
  { value: "id3-year", key: "fieldId3Year" },
];

export function InsertPanel({ config, onChange }: InsertPanelProps) {
  const { tr } = useI18n();

  return (
    <div className="mode-panel">
      <fieldset>
        <legend>{tr("contentTypeLegend")}</legend>
        {contentTypes.map(({ value, key }) => (
          <label key={value} className="radio-label">
            <input
              type="radio"
              name="contentType"
              checked={config.contentType === value}
              onChange={() => onChange({ ...config, contentType: value })}
            />
            {tr(key)}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{tr("insertPositionLegend")}</legend>
        {positions.map(({ value, key }) => (
          <label key={value} className="radio-label">
            <input
              type="radio"
              name="position"
              checked={config.position === value}
              onChange={() => onChange({ ...config, position: value })}
            />
            {tr(key)}
          </label>
        ))}
      </fieldset>

      {config.contentType === "text" && (
        <label>
          {tr("fixedText")}
          <input
            value={config.text}
            onChange={(e) => onChange({ ...config, text: e.target.value })}
          />
        </label>
      )}

      {config.contentType === "serial" && (
        <label>
          {tr("serialPrefix")}
          <input
            value={config.text}
            onChange={(e) => onChange({ ...config, text: e.target.value })}
          />
        </label>
      )}

      {config.contentType === "file-info" && (
        <label>
          {tr("fileInfoField")}
          <select
            value={config.fileInfoField}
            onChange={(e) =>
              onChange({
                ...config,
                fileInfoField: e.target.value as InsertConfig["fileInfoField"],
              })
            }
          >
            {fileInfoFields.map(({ value, key }) => (
              <option key={value} value={value}>
                {tr(key)}
              </option>
            ))}
          </select>
        </label>
      )}

      {config.position === "index" && (
        <label>
          {tr("charPosition")}
          <input
            type="number"
            min={0}
            value={config.index}
            onChange={(e) => onChange({ ...config, index: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}
