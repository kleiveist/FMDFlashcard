/**
 * @file apps/fmd-desktop/src/pages/MonitoringRulesPage.tsx
 *
 * Global manager for monitoring render profiles.
 */

import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useAppState } from "../components/AppStateProvider";
import {
  buildFrontmatterSuggestionIndex,
  sortFrontmatterKeySuggestions,
} from "../features/preview/frontmatter";
import { MonitoringRenderValue } from "../features/monitoring/MonitoringRenderValue";
import {
  createMonitoringRenderRule,
  renderMonitoringValue,
  resolveMonitoringPreviewRawDefault,
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

const resolveAliasTokenBounds = (value: string, cursor: number) => {
  const boundedCursor = Math.max(0, Math.min(cursor, value.length));
  const prefix = value.slice(0, boundedCursor);
  const suffix = value.slice(boundedCursor);
  const start = Math.max(0, prefix.lastIndexOf(",") + 1);
  const suffixComma = suffix.indexOf(",");
  const end = suffixComma < 0 ? value.length : boundedCursor + suffixComma;
  return {
    start,
    end,
    token: value.slice(start, end).trim(),
  };
};

const replaceAliasToken = (value: string, cursor: number, nextToken: string) => {
  const bounds = resolveAliasTokenBounds(value, cursor);
  const merged = `${value.slice(0, bounds.start)}${nextToken}${value.slice(bounds.end)}`;
  return merged
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(", ");
};

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
  previewRawValue: profile.previewRawValue ?? "",
  attributeAliases: [...profile.attributeAliases],
  scopes: [...profile.scopes],
  rules: profile.rules.map((rule) => cloneRule(rule)),
});

const buildInitialProfile = (): MonitoringRenderProfile => ({
  id: createProfileId(),
  name: "Neues Monitoring-Profil",
  attributeAliases: ["new-attribute"],
  inputFormat: "text",
  previewRawValue: resolveMonitoringPreviewRawDefault("text"),
  scopes: ["monitoring-page", "database", "properties"],
  rules: [createMonitoringRenderRule("value-map")],
  enabled: true,
});

export const MonitoringRulesPage = () => {
  const { settings, vault } = useAppState();
  const profiles = settings.monitoringRenderProfiles;

  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const [draft, setDraft] = useState<MonitoringRenderProfile | null>(
    profiles[0] ? cloneProfile(profiles[0]) : null,
  );
  const [aliasesDraft, setAliasesDraft] = useState(
    draft?.attributeAliases.join(", ") ?? "",
  );
  const [previewRawByProfileId, setPreviewRawByProfileId] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        profiles.map((profile) => [
          profile.id,
          profile.previewRawValue ??
            resolveMonitoringPreviewRawDefault(profile.inputFormat),
        ]),
      ),
  );
  const [attributeAliasSuggestions, setAttributeAliasSuggestions] = useState<string[]>([]);
  const [aliasSuggestionsOpen, setAliasSuggestionsOpen] = useState(false);
  const [aliasSuggestionCursor, setAliasSuggestionCursor] = useState(0);
  const [aliasCaretPosition, setAliasCaretPosition] = useState(0);
  const aliasInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    const rebuildAliasSuggestions = async () => {
      if (!vault.vaultPath || vault.files.length === 0) {
        if (!cancelled) {
          setAttributeAliasSuggestions([]);
        }
        return;
      }
      const markdownFiles = vault.files.filter((file) =>
        file.path.toLowerCase().endsWith(".md")
      );
      if (markdownFiles.length === 0) {
        if (!cancelled) {
          setAttributeAliasSuggestions([]);
        }
        return;
      }
      const markdownDocuments = await Promise.all(
        markdownFiles.map(async (file) => {
          try {
            return await invoke<string>("read_text_file", { path: file.path });
          } catch {
            return "";
          }
        }),
      );
      if (cancelled) {
        return;
      }
      const suggestionIndex = buildFrontmatterSuggestionIndex(markdownDocuments);
      setAttributeAliasSuggestions(
        sortFrontmatterKeySuggestions(suggestionIndex.keyIndex),
      );
    };
    void rebuildAliasSuggestions();
    return () => {
      cancelled = true;
    };
  }, [vault.files, vault.vaultPath]);

  useEffect(() => {
    const activeIds = new Set(profiles.map((profile) => profile.id));
    setPreviewRawByProfileId((current) => {
      const next: Record<string, string> = {};
      profiles.forEach((profile) => {
        next[profile.id] = current[profile.id] ??
          profile.previewRawValue ??
          resolveMonitoringPreviewRawDefault(profile.inputFormat);
      });
      if (
        Object.keys(current).length === Object.keys(next).length &&
        Object.keys(current).every((key) => activeIds.has(key) && current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [profiles]);

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
    setAliasSuggestionsOpen(false);
    setAliasSuggestionCursor(0);
    setAliasCaretPosition(0);
  }, [profiles, selectedProfile]);

  const previewAliases = useMemo(() => parseCsv(aliasesDraft), [aliasesDraft]);
  const previewAttribute =
    previewAliases[0] ??
    draft?.attributeAliases[0] ??
    "";
  const activePreviewRawValue = useMemo(() => {
    if (!selectedProfile) {
      return "";
    }
    return previewRawByProfileId[selectedProfile.id] ??
      selectedProfile.previewRawValue ??
      resolveMonitoringPreviewRawDefault(selectedProfile.inputFormat);
  }, [previewRawByProfileId, selectedProfile]);

  const currentAliasToken = useMemo(
    () => resolveAliasTokenBounds(aliasesDraft, aliasCaretPosition).token,
    [aliasesDraft, aliasCaretPosition],
  );

  const filteredAliasSuggestions = useMemo(() => {
    const query = currentAliasToken.trim().toLowerCase();
    const ranked = query
      ? attributeAliasSuggestions.filter((suggestion) =>
          suggestion.toLowerCase().includes(query))
      : attributeAliasSuggestions;
    return ranked.slice(0, 120);
  }, [attributeAliasSuggestions, currentAliasToken]);

  useEffect(() => {
    setAliasSuggestionCursor((current) =>
      Math.min(current, Math.max(0, filteredAliasSuggestions.length - 1)));
  }, [filteredAliasSuggestions.length]);

  const previewResult = useMemo(() => {
    if (!draft || !previewAttribute) {
      return null;
    }
    return renderMonitoringValue({
      attributeKey: previewAttribute,
      value: activePreviewRawValue,
      profiles: [draft],
    });
  }, [activePreviewRawValue, draft, previewAttribute]);

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
    setPreviewRawByProfileId((current) => ({
      ...current,
      [profile.id]: profile.previewRawValue ??
        resolveMonitoringPreviewRawDefault(profile.inputFormat),
    }));
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
    setPreviewRawByProfileId((current) => {
      if (!(selectedId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[selectedId];
      return next;
    });
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

  const handleAliasSuggestionSelect = (suggestion: string) => {
    const cursor = aliasInputRef.current?.selectionStart ?? aliasesDraft.length;
    const next = replaceAliasToken(aliasesDraft, cursor, suggestion);
    setAliasesDraft(next);
    setAliasCaretPosition(next.length);
    setAliasSuggestionsOpen(false);
    setAliasSuggestionCursor(0);
  };

  const handleAliasInputChange = (value: string, caretPosition: number | null) => {
    setAliasesDraft(value);
    setAliasSuggestionsOpen(true);
    setAliasSuggestionCursor(0);
    setAliasCaretPosition(
      caretPosition === null ? value.length : caretPosition,
    );
  };

  const handleAliasInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setAliasSuggestionsOpen(false);
      return;
    }

    if (!aliasSuggestionsOpen || filteredAliasSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      setAliasSuggestionCursor((current) =>
        (current + offset + filteredAliasSuggestions.length) %
        filteredAliasSuggestions.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = filteredAliasSuggestions[aliasSuggestionCursor] ??
        filteredAliasSuggestions[0];
      if (!suggestion) {
        return;
      }
      handleAliasSuggestionSelect(suggestion);
    }
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
      previewRawValue: previewRawByProfileId[draft.id] ??
        draft.previewRawValue ??
        resolveMonitoringPreviewRawDefault(draft.inputFormat),
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
              <section className="monitoring-rules-section monitoring-rules-profile-section">
                <div className="monitoring-rules-profile-compact-grid">
                  <h3 className="monitoring-rules-profile-title">Profil</h3>
                  <span className="monitoring-rules-profile-label monitoring-rules-profile-label-name">
                    Name
                  </span>
                  <span className="monitoring-rules-profile-label monitoring-rules-profile-label-alias">
                    Alias-Attribute (comma-separated)
                  </span>
                  <span className="monitoring-rules-profile-label monitoring-rules-profile-label-format">
                    Input-Format
                  </span>
                  <label className="monitoring-rules-profile-active-toggle">
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

                  <div className="monitoring-rules-profile-control monitoring-rules-profile-control-name">
                    <input
                      className="text-input"
                      type="text"
                      value={draft.name}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        updateDraft((profile) => ({ ...profile, name: nextName }));
                      }}
                    />
                  </div>
                  <div className="monitoring-rules-profile-control monitoring-rules-profile-control-alias">
                    <div className="monitoring-rules-alias-combobox">
                      <input
                        ref={aliasInputRef}
                        className="text-input"
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={aliasSuggestionsOpen}
                        aria-controls={
                          aliasSuggestionsOpen
                            ? "monitoring-rules-alias-suggestions"
                            : undefined
                        }
                        value={aliasesDraft}
                        onFocus={(event) => {
                          setAliasSuggestionsOpen(true);
                          setAliasCaretPosition(event.currentTarget.selectionStart ?? aliasesDraft.length);
                        }}
                        onClick={(event) => {
                          setAliasSuggestionsOpen(true);
                          setAliasCaretPosition(event.currentTarget.selectionStart ?? aliasesDraft.length);
                        }}
                        onChange={(event) => {
                          handleAliasInputChange(
                            event.target.value,
                            event.target.selectionStart,
                          );
                        }}
                        onKeyUp={(event) => {
                          setAliasCaretPosition(
                            event.currentTarget.selectionStart ?? aliasesDraft.length,
                          );
                        }}
                        onKeyDown={handleAliasInputKeyDown}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setAliasSuggestionsOpen(false);
                          }, 80);
                        }}
                      />
                      {aliasSuggestionsOpen ? (
                        <ul
                          id="monitoring-rules-alias-suggestions"
                          className="frontmatter-suggestions monitoring-rules-alias-suggestions"
                          role="listbox"
                          aria-label="Alias Attribut Vorschlaege"
                        >
                          {filteredAliasSuggestions.length === 0 ? (
                            <li className="monitoring-rules-alias-empty">
                              Keine passenden Attribute
                            </li>
                          ) : (
                            filteredAliasSuggestions.map((suggestion, suggestionIndex) => (
                              <li key={`monitoring-alias-${suggestion}`}>
                                <button
                                  type="button"
                                  className={`frontmatter-suggestion-option ${
                                    suggestionIndex === aliasSuggestionCursor ? "active" : ""
                                  }`}
                                  role="option"
                                  aria-selected={suggestionIndex === aliasSuggestionCursor}
                                  tabIndex={-1}
                                  onMouseEnter={() => setAliasSuggestionCursor(suggestionIndex)}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    handleAliasSuggestionSelect(suggestion);
                                  }}
                                >
                                  {suggestion}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                  <div className="monitoring-rules-profile-control monitoring-rules-profile-control-format">
                    <select
                      value={draft.inputFormat}
                      onChange={(event) => {
                        const next = event.target.value as MonitoringInputFormat;
                        const previousFormat = draft.inputFormat;
                        updateDraft((profile) => ({ ...profile, inputFormat: next }));
                        if (!selectedId) {
                          return;
                        }
                        const previousDefault = resolveMonitoringPreviewRawDefault(previousFormat);
                        if (!(selectedId in previewRawByProfileId)) {
                          setPreviewRawByProfileId((current) => ({
                            ...current,
                            [selectedId]: resolveMonitoringPreviewRawDefault(next),
                          }));
                          return;
                        }
                        setPreviewRawByProfileId((current) => {
                          const currentRaw = current[selectedId];
                          if (
                            typeof currentRaw === "string" &&
                            currentRaw.trim() !== "" &&
                            currentRaw !== previousDefault
                          ) {
                            return current;
                          }
                          return {
                            ...current,
                            [selectedId]: resolveMonitoringPreviewRawDefault(next),
                          };
                        });
                      }}
                    >
                      {ALL_INPUT_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {toLabel(format)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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
                      value={activePreviewRawValue}
                      onChange={(event) => {
                        if (!selectedId) {
                          return;
                        }
                        const next = event.target.value;
                        setPreviewRawByProfileId((current) => ({
                          ...current,
                          [selectedId]: next,
                        }));
                      }}
                    />
                  </label>
                </div>
                <div className="monitoring-rules-preview-output">
                  <MonitoringRenderValue
                    result={previewResult}
                    fallback={activePreviewRawValue}
                  />
                </div>
              </section>

              <section className="monitoring-rules-section">
                <h3>Geltungsbereich</h3>
                <fieldset className="monitoring-rules-scopes">
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
                        value: activePreviewRawValue,
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
                            fallback={activePreviewRawValue}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
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
