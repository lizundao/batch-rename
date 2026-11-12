import { useI18n } from "../context/I18nContext";
import type { AutoNumberConfig, NumberType } from "../types";

interface AutoNumberPanelProps {
  config: AutoNumberConfig;
  onChange: (config: AutoNumberConfig) => void;
}

const numberTypes: NumberType[] = ["arabic", "roman", "alpha"];

const numberTypeKeys: Record<NumberType, "numberTypeArabic" | "numberTypeRoman" | "numberTypeAlpha"> = {
  arabic: "numberTypeArabic",
  roman: "numberTypeRoman",
  alpha: "numberTypeAlpha",
};

export function AutoNumberPanel({ config, onChange }: AutoNumberPanelProps) {
  const { tr } = useI18n();

  return (
    <div className="mode-panel">
      <label>
        {tr("prefixBeforeNumber")}
        <input
          value={config.prefix}
          onChange={(e) => onChange({ ...config, prefix: e.target.value })}
        />
      </label>
      <label>
        {tr("startNumber")}
        <input
          type="number"
          min={1}
          value={config.start}
          onChange={(e) => onChange({ ...config, start: Number(e.target.value) })}
        />
      </label>
      <label>
        {tr("numberType")}
        <select
          value={config.numberType}
          onChange={(e) =>
            onChange({ ...config, numberType: e.target.value as NumberType })
          }
        >
          {numberTypes.map((t) => (
            <option key={t} value={t}>
              {tr(numberTypeKeys[t])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tr("fixedDigits")}
        <input
          type="number"
          min={0}
          value={config.padding}
          onChange={(e) => onChange({ ...config, padding: Number(e.target.value) })}
          title={
            config.numberType === "arabic"
              ? tr("paddingArabicTitle")
              : tr("paddingOtherTitle")
          }
        />
      </label>
      <label>
        {tr("suffixAfterNumber")}
        <input
          value={config.suffix}
          onChange={(e) => onChange({ ...config, suffix: e.target.value })}
        />
      </label>
    </div>
  );
}
