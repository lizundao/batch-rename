import { useI18n } from "../context/I18nContext";
import type { FindReplaceConfig, FindReplaceRule } from "../types";

interface FindReplacePanelProps {
  config: FindReplaceConfig;
  findHistory: string[];
  onChange: (config: FindReplaceConfig) => void;
  onFindCommit: (value: string) => void;
}

function updateRule(
  rules: FindReplaceRule[],
  id: string,
  patch: Partial<FindReplaceRule>,
): FindReplaceRule[] {
  return rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function FindReplacePanel({
  config,
  findHistory,
  onChange,
  onFindCommit,
}: FindReplacePanelProps) {
  const { tr } = useI18n();
  const historyId = "find-history-list";

  const addRule = () => {
    onChange({
      rules: [
        ...config.rules,
        {
          id: crypto.randomUUID(),
          find: "",
          replace: "",
          replaceExtension: false,
          useRegex: false,
          caseSensitive: true,
        },
      ],
    });
  };

  const removeRule = (id: string) => {
    if (config.rules.length <= 1) return;
    onChange({ rules: config.rules.filter((r) => r.id !== id) });
  };

  return (
    <div className="mode-panel">
      <datalist id={historyId}>
        {findHistory.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      {config.rules.map((rule, index) => (
        <div key={rule.id} className="rule-row">
          <label>
            {tr("find")}
            <input
              list={findHistory.length > 0 ? historyId : undefined}
              value={rule.find}
              onChange={(e) =>
                onChange({
                  rules: updateRule(config.rules, rule.id, { find: e.target.value }),
                })
              }
              onBlur={(e) => onFindCommit(e.target.value)}
              placeholder={tr("findPlaceholder")}
            />
          </label>
          <label>
            {tr("replaceWith")}
            <input
              value={rule.replace}
              onChange={(e) =>
                onChange({
                  rules: updateRule(config.rules, rule.id, { replace: e.target.value }),
                })
              }
              placeholder={tr("replacePlaceholder")}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rule.replaceExtension}
              onChange={(e) =>
                onChange({
                  rules: updateRule(config.rules, rule.id, {
                    replaceExtension: e.target.checked,
                  }),
                })
              }
            />
            {tr("replaceExtension")}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rule.useRegex ?? false}
              onChange={(e) =>
                onChange({
                  rules: updateRule(config.rules, rule.id, {
                    useRegex: e.target.checked,
                  }),
                })
              }
            />
            {tr("useRegex")}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rule.caseSensitive ?? true}
              onChange={(e) =>
                onChange({
                  rules: updateRule(config.rules, rule.id, {
                    caseSensitive: e.target.checked,
                  }),
                })
              }
            />
            {tr("caseSensitive")}
          </label>
          {config.rules.length > 1 && (
            <button type="button" onClick={() => removeRule(rule.id)}>
              {tr("removeRule", index + 1)}
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRule}>
        {tr("addReplaceRule")}
      </button>
    </div>
  );
}
