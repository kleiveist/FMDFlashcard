/**
 * @file apps/fmd-desktop/src/pages/MonitoringRulesPage.tsx
 *
 * Global manager for monitoring render profiles.
 */

import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import { MonitoringRenderValue } from "../features/monitoring/MonitoringRenderValue";
import {
  createMonitoringRenderRule,
  renderMonitoringValue,
  type MonitoringInputFormat,
  type MonitoringRenderProfile,
  type MonitoringRenderRule,
  type MonitoringRenderScope,
} from "../features/monitoring/monitoring-render-rules";

const ALL_SCOPES: MonitoringRenderScope[] = [
  "monitoring-page",
  "database",
  "properties",
];

const ALL_INPUT_FORMATS: MonitoringInputFormat[] = [
  "ratio",
  "numeric-percent",
  "code",
  "text",
  "short-structured-text-with-number",
];

const ALL_RULE_TYPES: MonitoringRenderRule["type"][] = [
  "value-map",
  "ratio-derived-percent",
  "percent-format",
  "progress-bar",
  "progress-ring",
  "threshold-symbol",
  "grouped-label-map",
];

const toLabel = (value: string) =>
  value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const createProfileId = () => `monitoring-${Math.random().toString(16).slice(2, 10)}`;

const dedupeAliases = (input: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  input.forEach((entry) => {
    const trimmed = entry.trim();
    const normalized = trimmed.toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(trimmed);
  });
  return next;
};

const parseCsv = (input: string) =>
  dedupeAliases(
    input
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const mappingsToText = (rule: Extract<MonitoringRenderRule, { type: "value-map" }>) =>
  rule.mappings.map((mapping) => `${mapping.from}=${mapping.to}`).join("\n");

const parseMappingsText = (input: string) =>
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        return null;
      }
      const from = line.slice(0, separatorIndex).trim();
      const to = line.slice(separatorIndex + 1).trim();
      if (!from || !to) {
        return null;
      }
      return { from, to };
    })
    .filter((entry): entry is { from: string; to: string } => Boolean(entry));

const thresholdsToText = (rule: Extract<MonitoringRenderRule, { type: "threshold-symbol" }>) =>
  rule.thresholds.map((entry) => `${entry.op} ${entry.value} ${entry.symbol}`).join("\n");

const parseThresholdsText = (input: string) =>
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(>=|>|<=|<|=)\s*(-?\d+(?:[.,]\d+)?)\s+(.+)$/);
      if (!match) {
        return null;
      }
      const value = Number((match[2] ?? "").replace(",", "."));
      const symbol = String(match[3] ?? "").trim();
      if (!Number.isFinite(value) || !symbol) {
        return null;
      }
      return {
        op: match[1] as ">=" | ">" | "<=" | "<" | "=",
        value,
        symbol,
      };
    })
    .filter((entry): entry is { op: ">=" | ">" | "<=" | "<" | "="; value: number; symbol: string } => Boolean(entry));

const groupedMapToText = (rule: Extract<MonitoringRenderRule, { type: "grouped-label-map" }>) =>
  rule.groups
    .map((group) => `${group.label}|${group.symbol ?? ""}|${group.values.join(",")}`)
    .join("\n");

const parseGroupedMapText = (input: string) =>
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelRaw, symbolRaw, valuesRaw] = line.split("|");
      const label = (labelRaw ?? "").trim();
      const symbol = (symbolRaw ?? "").trim() || null;
      const values = (valuesRaw ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (!label || values.length === 0) {
        return null;
      }
      return {
        label,
        symbol,
        values,
      };
    })
    .filter((entry): entry is { label: string; symbol: string | null; values: string[] } => Boolean(entry));

const cloneRule = (rule: MonitoringRenderRule): MonitoringRenderRule => {
  if (rule.type === "value-map") {
    return {
      ...rule,
      mappings: rule.mappings.map((entry) => ({ ...entry })),
    };
  }
  if (rule.type === "threshold-symbol") {
    return {
      ...rule,
      thresholds: rule.thresholds.map((entry) => ({ ...entry })),
    };
  }
  if (rule.type === "grouped-label-map") {
    return {
      ...rule,
      groups: rule.groups.map((group) => ({
        ...group,
        values: [...group.values],
      })),
    };
  }
  return { ...rule };
};

const cloneProfile = (profile: MonitoringRenderProfile): MonitoringRenderProfile => ({
  ...profile,
  attributeAliases: [...profile.attributeAliases],
  scopes: [...profile.scopes],
  rules: profile.rules.map((rule) => cloneRule(rule)),
});

const buildInitialProfile = (): MonitoringRenderProfile => ({
  id: createProfileId(),
  name: "Neues Monitoring-Profil",
  attributeAliases: ["new-attribute"],
  inputFormat: "text",
  scopes: ["monitoring-page", "database", "properties"],
  rules: [createMonitoringRenderRule("value-map")],
  enabled: true,
});

export const MonitoringRulesPage = () => {
  const { settings } = useAppState();
  const profiles = settings.monitoringRenderProfiles;

  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const [draft, setDraft] = useState<MonitoringRenderProfile | null>(
    profiles[0] ? cloneProfile(profiles[0]) : null,
  );
  const [aliasesDraft, setAliasesDraft] = useState(
    draft?.attributeAliases.join(", ") ?? "",
  );
  const [previewValue, setPreviewValue] = useState("59/69");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  useEffect(() => {
    if (!selectedProfile && profiles.length > 0) {
      setSelectedId(profiles[0]?.id ?? null);
      return;
    }
    if (!selectedProfile) {
      setDraft(null);
      setAliasesDraft("");
      return;
    }
    const cloned = cloneProfile(selectedProfile);
    setDraft(cloned);
    setAliasesDraft(cloned.attributeAliases.join(", "));
  }, [profiles, selectedProfile]);

  const previewAttribute = draft?.attributeAliases[0] ?? "";
  const previewResult = useMemo(() => {
    if (!draft || !previewAttribute) {
      return null;
    }
    return renderMonitoringValue({
      attributeKey: previewAttribute,
      value: previewValue,
      profiles: [draft],
    });
  }, [draft, previewAttribute, previewValue]);

  const persistProfiles = async (nextProfiles: MonitoringRenderProfile[]) => {
    settings.setMonitoringRenderProfiles(nextProfiles);
    const saved = await settings.persistSettings({
      monitoringRenderProfiles: nextProfiles,
    });
    if (!saved) {
      setStatusError("Monitoring-Profile konnten nicht gespeichert werden.");
      return false;
    }
    return true;
  };

  const handleCreateProfile = async () => {
    const profile = buildInitialProfile();
    const nextProfiles = [...profiles, profile];
    const saved = await persistProfiles(nextProfiles);
    if (!saved) {
      return;
    }
    setSelectedId(profile.id);
    setStatusError("");
    setStatusMessage("Profil erstellt.");
  };

  const handleDeleteProfile = async () => {
    if (!selectedId) {
      return;
    }
    const nextProfiles = profiles.filter((profile) => profile.id !== selectedId);
    const saved = await persistProfiles(nextProfiles);
    if (!saved) {
      return;
    }
    setSelectedId(nextProfiles[0]?.id ?? null);
    setStatusError("");
    setStatusMessage("Profil entfernt.");
  };

  const updateDraft = (updater: (profile: MonitoringRenderProfile) => MonitoringRenderProfile) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return updater(current);
    });
  };

  const updateRule = (
    ruleId: string,
    updater: (rule: MonitoringRenderRule) => MonitoringRenderRule,
  ) => {
    updateDraft((profile) => ({
      ...profile,
      rules: profile.rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
    }));
  };

  const handleSaveDraft = async () => {
    if (!draft) {
      return;
    }
    const aliases = parseCsv(aliasesDraft);
    if (aliases.length === 0) {
      setStatusMessage("");
      setStatusError("Mindestens ein Alias-Attribut ist erforderlich.");
      return;
    }
    const normalizedDraft: MonitoringRenderProfile = {
      ...cloneProfile(draft),
      name: draft.name.trim() || "Monitoring Profil",
      attributeAliases: aliases,
      scopes: draft.scopes.length > 0 ? draft.scopes : ["database"],
      rules: draft.rules.length > 0 ? draft.rules : [createMonitoringRenderRule("value-map")],
    };
    const nextProfiles = profiles.map((profile) =>
      profile.id === normalizedDraft.id ? normalizedDraft : profile,
    );
    const saved = await persistProfiles(nextProfiles);
    if (!saved) {
      return;
    }
    setStatusError("");
    setStatusMessage("Profil gespeichert.");
  };

  return (
    <section className="panel monitoring-rules-panel">
      <div className="panel-header">
        <div>
          <h2>Monitoring Rules</h2>
          <p className="muted">
            Globales Regelwerk fuer Score/Percent/Status-Rendering mit Live-Preview.
          </p>
        </div>
        <div className="monitoring-rules-header-actions">
          <button type="button" className="ghost small" onClick={() => void handleCreateProfile()}>
            Neues Profil
          </button>
          <button
            type="button"
            className="ghost small"
            disabled={!selectedId || profiles.length <= 1}
            onClick={() => void handleDeleteProfile()}
          >
            Profil loeschen
          </button>
          <button
            type="button"
            className="primary small"
            disabled={!draft}
            onClick={() => void handleSaveDraft()}
          >
            Speichern
          </button>
        </div>
      </div>

      {statusError ? <div className="error">{statusError}</div> : null}
      {statusMessage ? <p className="muted">{statusMessage}</p> : null}

      <div className="monitoring-rules-layout">
        <aside className="monitoring-rules-list" aria-label="Monitoring profile list">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`monitoring-rules-list-item${profile.id === selectedId ? " is-active" : ""}`}
              onClick={() => {
                setSelectedId(profile.id);
                setStatusMessage("");
                setStatusError("");
              }}
            >
              <strong>{profile.name}</strong>
              <span>{profile.attributeAliases.join(", ")}</span>
            </button>
          ))}
        </aside>

        <div className="monitoring-rules-editor">
          {draft ? (
            <>
              <section className="monitoring-rules-section">
                <h3>Profil</h3>
                <div className="monitoring-rules-grid">
                  <label>
                    Name
                    <input
                      className="text-input"
                      type="text"
                      value={draft.name}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        updateDraft((profile) => ({ ...profile, name: nextName }));
                      }}
                    />
                  </label>
                  <label>
                    Alias-Attribute (comma-separated)
                    <input
                      className="text-input"
                      type="text"
                      value={aliasesDraft}
                      onChange={(event) => {
                        setAliasesDraft(event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    Input-Format
                    <select
                      value={draft.inputFormat}
                      onChange={(event) => {
                        const next = event.target.value as MonitoringInputFormat;
                        updateDraft((profile) => ({ ...profile, inputFormat: next }));
                      }}
                    >
                      {ALL_INPUT_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {toLabel(format)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="monitoring-rules-enabled-toggle">
                    <input
                      type="checkbox"
                      checked={draft.enabled !== false}
                      onChange={(event) => {
                        const next = event.target.checked;
                        updateDraft((profile) => ({ ...profile, enabled: next }));
                      }}
                    />
                    Aktiv
                  </label>
                </div>

                <fieldset className="monitoring-rules-scopes">
                  <legend>Geltungsbereich</legend>
                  <div>
                    {ALL_SCOPES.map((scope) => {
                      const checked = draft.scopes.includes(scope);
                      return (
                        <label key={scope}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextChecked = event.target.checked;
                              updateDraft((profile) => {
                                const nextScopes = nextChecked
                                  ? Array.from(new Set([...profile.scopes, scope]))
                                  : profile.scopes.filter((entry) => entry !== scope);
                                return {
                                  ...profile,
                                  scopes: nextScopes,
                                };
                              });
                            }}
                          />
                          {toLabel(scope)}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </section>

              <section className="monitoring-rules-section">
                <div className="monitoring-rules-section-header">
                  <h3>Regeln</h3>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => {
                      updateDraft((profile) => ({
                        ...profile,
                        rules: [...profile.rules, createMonitoringRenderRule("value-map")],
                      }));
                    }}
                  >
                    Regel hinzufuegen
                  </button>
                </div>

                {draft.rules.map((rule) => {
                  const rulePreviewProfile: MonitoringRenderProfile = {
                    ...cloneProfile(draft),
                    rules: [cloneRule(rule)],
                  };
                  const rulePreviewResult = previewAttribute
                    ? renderMonitoringValue({
                        attributeKey: previewAttribute,
                        value: previewValue,
                        profiles: [rulePreviewProfile],
                      })
                    : null;

                  return (
                    <article key={rule.id} className="monitoring-rules-rule-card">
                    <header className="monitoring-rules-rule-head">
                      <select
                        value={rule.type}
                        onChange={(event) => {
                          const nextType = event.target.value as MonitoringRenderRule["type"];
                          updateRule(rule.id, () => createMonitoringRenderRule(nextType));
                        }}
                      >
                        {ALL_RULE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {toLabel(type)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => {
                          updateDraft((profile) => ({
                            ...profile,
                            rules: profile.rules.filter((entry) => entry.id !== rule.id),
                          }));
                        }}
                        disabled={draft.rules.length <= 1}
                      >
                        Entfernen
                      </button>
                    </header>

                    {rule.type === "value-map" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label>
                          Display-Modus
                          <select
                            value={rule.displayMode ?? "append"}
                            onChange={(event) => {
                              const next = event.target.value === "replace" ? "replace" : "append";
                              updateRule(rule.id, (current) =>
                                current.type === "value-map"
                                  ? { ...current, displayMode: next }
                                  : current,
                              );
                            }}
                          >
                            <option value="append">Append</option>
                            <option value="replace">Replace</option>
                          </select>
                        </label>
                        <label>
                          Separator
                          <input
                            className="text-input"
                            type="text"
                            value={rule.separator ?? " "}
                            onChange={(event) => {
                              const next = event.target.value;
                              updateRule(rule.id, (current) =>
                                current.type === "value-map"
                                  ? { ...current, separator: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label className="monitoring-rules-enabled-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(rule.caseSensitive)}
                            onChange={(event) => {
                              const next = event.target.checked;
                              updateRule(rule.id, (current) =>
                                current.type === "value-map"
                                  ? { ...current, caseSensitive: next }
                                  : current,
                              );
                            }}
                          />
                          Case-sensitive
                        </label>
                        <label>
                          Mappings (`from=to`, eine Zeile je Mapping)
                          <textarea
                            value={mappingsToText(rule)}
                            onChange={(event) => {
                              const mappings = parseMappingsText(event.target.value);
                              updateRule(rule.id, (current) =>
                                current.type === "value-map"
                                  ? { ...current, mappings }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {rule.type === "ratio-derived-percent" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label>
                          Decimals
                          <input
                            type="number"
                            min={0}
                            max={6}
                            value={rule.decimals ?? 0}
                            onChange={(event) => {
                              const next = Math.max(0, Math.min(6, Number(event.target.value) || 0));
                              updateRule(rule.id, (current) =>
                                current.type === "ratio-derived-percent"
                                  ? { ...current, decimals: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label className="monitoring-rules-enabled-toggle">
                          <input
                            type="checkbox"
                            checked={rule.showBase !== false}
                            onChange={(event) => {
                              const next = event.target.checked;
                              updateRule(rule.id, (current) =>
                                current.type === "ratio-derived-percent"
                                  ? { ...current, showBase: next }
                                  : current,
                              );
                            }}
                          />
                          Basiswert anzeigen
                        </label>
                        <label className="monitoring-rules-enabled-toggle">
                          <input
                            type="checkbox"
                            checked={rule.wrapInParentheses !== false}
                            onChange={(event) => {
                              const next = event.target.checked;
                              updateRule(rule.id, (current) =>
                                current.type === "ratio-derived-percent"
                                  ? { ...current, wrapInParentheses: next }
                                  : current,
                              );
                            }}
                          />
                          Prozent in Klammern
                        </label>
                      </div>
                    ) : null}

                    {rule.type === "percent-format" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label>
                          Decimals
                          <input
                            type="number"
                            min={0}
                            max={6}
                            value={rule.decimals ?? 0}
                            onChange={(event) => {
                              const next = Math.max(0, Math.min(6, Number(event.target.value) || 0));
                              updateRule(rule.id, (current) =>
                                current.type === "percent-format"
                                  ? { ...current, decimals: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label className="monitoring-rules-enabled-toggle">
                          <input
                            type="checkbox"
                            checked={rule.clamp !== false}
                            onChange={(event) => {
                              const next = event.target.checked;
                              updateRule(rule.id, (current) =>
                                current.type === "percent-format"
                                  ? { ...current, clamp: next }
                                  : current,
                              );
                            }}
                          />
                          Clamp 0-100
                        </label>
                      </div>
                    ) : null}

                    {rule.type === "progress-bar" || rule.type === "progress-ring" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label>
                          Min
                          <input
                            type="number"
                            value={rule.min ?? 0}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              updateRule(rule.id, (current) =>
                                current.type === rule.type
                                  ? { ...current, min: Number.isFinite(next) ? next : 0 }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label>
                          Max
                          <input
                            type="number"
                            value={rule.max ?? 100}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              updateRule(rule.id, (current) =>
                                current.type === rule.type
                                  ? { ...current, max: Number.isFinite(next) ? next : 100 }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {rule.type === "threshold-symbol" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label className="monitoring-rules-enabled-toggle">
                          <input
                            type="checkbox"
                            checked={rule.appendToText !== false}
                            onChange={(event) => {
                              const next = event.target.checked;
                              updateRule(rule.id, (current) =>
                                current.type === "threshold-symbol"
                                  ? { ...current, appendToText: next }
                                  : current,
                              );
                            }}
                          />
                          Symbol an Text anhaengen
                        </label>
                        <label>
                          Separator
                          <input
                            className="text-input"
                            type="text"
                            value={rule.separator ?? " "}
                            onChange={(event) => {
                              const next = event.target.value;
                              updateRule(rule.id, (current) =>
                                current.type === "threshold-symbol"
                                  ? { ...current, separator: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label>
                          {"Thresholds (`>= 90 ⭐`, eine Zeile je Regel)"}
                          <textarea
                            value={thresholdsToText(rule)}
                            onChange={(event) => {
                              const thresholds = parseThresholdsText(event.target.value);
                              updateRule(rule.id, (current) =>
                                current.type === "threshold-symbol"
                                  ? { ...current, thresholds }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {rule.type === "grouped-label-map" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label className="monitoring-rules-enabled-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(rule.caseSensitive)}
                            onChange={(event) => {
                              const next = event.target.checked;
                              updateRule(rule.id, (current) =>
                                current.type === "grouped-label-map"
                                  ? { ...current, caseSensitive: next }
                                  : current,
                              );
                            }}
                          />
                          Case-sensitive
                        </label>
                        <label className="monitoring-rules-enabled-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(rule.replaceText)}
                            onChange={(event) => {
                              const next = event.target.checked;
                              updateRule(rule.id, (current) =>
                                current.type === "grouped-label-map"
                                  ? { ...current, replaceText: next }
                                  : current,
                              );
                            }}
                          />
                          Text ersetzen
                        </label>
                        <label>
                          Separator
                          <input
                            className="text-input"
                            type="text"
                            value={rule.separator ?? " "}
                            onChange={(event) => {
                              const next = event.target.value;
                              updateRule(rule.id, (current) =>
                                current.type === "grouped-label-map"
                                  ? { ...current, separator: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label>
                          Gruppen (`Label|Symbol|v1,v2,v3`)
                          <textarea
                            value={groupedMapToText(rule)}
                            onChange={(event) => {
                              const groups = parseGroupedMapText(event.target.value);
                              updateRule(rule.id, (current) =>
                                current.type === "grouped-label-map"
                                  ? { ...current, groups }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                      <div className="monitoring-rules-rule-preview">
                        <span className="monitoring-rules-rule-preview-label">
                          Regel-Vorschau
                        </span>
                        <div className="monitoring-rules-rule-preview-value">
                          <MonitoringRenderValue
                            result={rulePreviewResult}
                            fallback={previewValue}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>

              <section className="monitoring-rules-section">
                <h3>Live-Preview</h3>
                <div className="monitoring-rules-preview-inputs">
                  <label>
                    Attribut-Alias
                    <input
                      className="text-input"
                      type="text"
                      value={previewAttribute}
                      readOnly
                      title="Preview nutzt den ersten Alias des Profils"
                    />
                  </label>
                  <label>
                    Rohwert
                    <input
                      className="text-input"
                      type="text"
                      value={previewValue}
                      onChange={(event) => setPreviewValue(event.target.value)}
                    />
                  </label>
                </div>
                <div className="monitoring-rules-preview-output">
                  <MonitoringRenderValue
                    result={previewResult}
                    fallback={previewValue}
                  />
                </div>
              </section>
            </>
          ) : (
            <div className="database-view-empty">Kein Monitoring-Profil verfuegbar.</div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MonitoringRulesPage;
