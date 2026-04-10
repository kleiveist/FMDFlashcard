/**
 * @file apps/fmd-desktop/src/pages/MonitoringRulesPage.tsx
 *
 * Global manager for monitoring render profiles.
 */

import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ModalShell } from "../components/ModalShell";
import { useAppState } from "../components/AppStateProvider";
import { TrashIcon } from "../components/icons";
import {
  buildFrontmatterSuggestionIndex,
  sortFrontmatterKeySuggestions,
} from "../features/preview/frontmatter";
import { MonitoringRenderValue } from "../features/monitoring/MonitoringRenderValue";
import {
  createMonitoringRenderRule,
  formatMonitoringCompactText,
  renderMonitoringValue,
  resolveMonitoringPreviewRawDefault,
  type MonitoringInputFormat,
  type MonitoringRenderResult,
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

const normalizeLower = (value: string) => value.trim().toLowerCase();

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

const pruneRuleTextDraftMap = (
  current: Record<string, string>,
  activeRuleIds: Set<string>,
) => {
  const next: Record<string, string> = {};
  let changed = false;
  Object.entries(current).forEach(([ruleId, value]) => {
    if (activeRuleIds.has(ruleId)) {
      next[ruleId] = value;
      return;
    }
    changed = true;
  });
  return changed ? next : current;
};

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

const resolveRulePreviewAlias = (
  rule: MonitoringRenderRule,
  aliases: string[],
) => {
  if (aliases.length === 0) {
    return rule.rulePreviewAlias?.trim() ?? "";
  }
  const normalizedRuleAlias = normalizeLower(rule.rulePreviewAlias ?? "");
  if (!normalizedRuleAlias) {
    return aliases[0] ?? "";
  }
  const matched = aliases.find((alias) => normalizeLower(alias) === normalizedRuleAlias);
  return matched ?? aliases[0] ?? "";
};

const resolveRulePreviewRawValue = (
  rule: MonitoringRenderRule,
  fallbackRawValue: string,
) =>
  typeof rule.rulePreviewRawValue === "string"
    ? rule.rulePreviewRawValue
    : fallbackRawValue;

const truncateRulePreview = (value: string, maxLength = 60) => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const summarizeRuleFallback = (rule: MonitoringRenderRule) => {
  if (rule.type === "value-map") {
    const first = rule.mappings[0];
    if (!first) {
      return "Kein Mapping";
    }
    const remaining = rule.mappings.length - 1;
    return remaining > 0
      ? `${first.from}=${first.to} (+${remaining})`
      : `${first.from}=${first.to}`;
  }
  if (rule.type === "threshold-symbol") {
    const first = rule.thresholds[0];
    if (!first) {
      return "Keine Schwellenwerte";
    }
    const remaining = rule.thresholds.length - 1;
    return remaining > 0
      ? `${first.op} ${first.value} ${first.symbol} (+${remaining})`
      : `${first.op} ${first.value} ${first.symbol}`;
  }
  if (rule.type === "ratio-derived-percent") {
    return `Decimals ${rule.decimals ?? 0}`;
  }
  if (rule.type === "percent-format") {
    return `Decimals ${rule.decimals ?? 0}`;
  }
  if (rule.type === "progress-bar" || rule.type === "progress-ring") {
    return `${rule.min ?? 0}-${rule.max ?? 100}`;
  }
  if (rule.type === "grouped-label-map") {
    const first = rule.groups[0];
    if (!first) {
      return "Keine Gruppen";
    }
    const remaining = rule.groups.length - 1;
    return remaining > 0 ? `${first.label} (+${remaining})` : first.label;
  }
  return "";
};

const buildRuleListLabel = ({
  index,
  previewRawValue,
  rule,
  previewResult,
}: {
  index: number;
  previewRawValue: string;
  rule: MonitoringRenderRule;
  previewResult: MonitoringRenderResult | null;
}) => {
  const prefix = `Regel ${index + 1} ${toLabel(rule.type)}`.trim();
  const renderedPreview = truncateRulePreview(
    formatMonitoringCompactText(previewResult, summarizeRuleFallback(rule)),
  );
  const rawPreview = truncateRulePreview(previewRawValue, 32);
  const relationPreview = rawPreview && renderedPreview
    ? rawPreview === renderedPreview
      ? rawPreview
      : `${rawPreview} -> ${renderedPreview}`
    : rawPreview || renderedPreview;
  return relationPreview ? `${prefix} ${relationPreview}` : prefix;
};

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
  rules: [
    {
      ...createMonitoringRenderRule("value-map"),
      rulePreviewAlias: "new-attribute",
      rulePreviewRawValue: resolveMonitoringPreviewRawDefault("text"),
    },
  ],
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
  const [valueMapTextByRuleId, setValueMapTextByRuleId] = useState<Record<string, string>>({});
  const [thresholdTextByRuleId, setThresholdTextByRuleId] = useState<Record<string, string>>({});
  const [groupedMapTextByRuleId, setGroupedMapTextByRuleId] = useState<Record<string, string>>({});
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
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
      setValueMapTextByRuleId({});
      setThresholdTextByRuleId({});
      setGroupedMapTextByRuleId({});
      setSelectedRuleId(null);
      setIsRuleEditorOpen(false);
      return;
    }
    const cloned = cloneProfile(selectedProfile);
    setDraft(cloned);
    setAliasesDraft(cloned.attributeAliases.join(", "));
    setValueMapTextByRuleId({});
    setThresholdTextByRuleId({});
    setGroupedMapTextByRuleId({});
    setSelectedRuleId(null);
    setIsRuleEditorOpen(false);
    setAliasSuggestionsOpen(false);
    setAliasSuggestionCursor(0);
    setAliasCaretPosition(0);
  }, [profiles, selectedProfile]);

  useEffect(() => {
    const activeRuleIds = new Set(draft?.rules.map((rule) => rule.id) ?? []);
    setValueMapTextByRuleId((current) => pruneRuleTextDraftMap(current, activeRuleIds));
    setThresholdTextByRuleId((current) => pruneRuleTextDraftMap(current, activeRuleIds));
    setGroupedMapTextByRuleId((current) => pruneRuleTextDraftMap(current, activeRuleIds));
  }, [draft]);

  useEffect(() => {
    if (!draft) {
      if (selectedRuleId !== null) {
        setSelectedRuleId(null);
      }
      if (isRuleEditorOpen) {
        setIsRuleEditorOpen(false);
      }
      return;
    }
    if (!selectedRuleId) {
      return;
    }
    const stillExists = draft.rules.some((rule) => rule.id === selectedRuleId);
    if (stillExists) {
      return;
    }
    if (draft.rules.length === 0) {
      setSelectedRuleId(null);
      setIsRuleEditorOpen(false);
      return;
    }
    setSelectedRuleId(draft.rules[0]?.id ?? null);
  }, [draft, selectedRuleId, isRuleEditorOpen]);

  const previewAliases = useMemo(() => parseCsv(aliasesDraft), [aliasesDraft]);
  const availableRuleAliases = useMemo(
    () => (previewAliases.length > 0 ? previewAliases : draft?.attributeAliases ?? []),
    [draft?.attributeAliases, previewAliases],
  );
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

  const preparedRuleEntries = useMemo(() => {
    if (!draft) {
      return [];
    }
    return draft.rules.map((rule, index) => {
      const rulePreviewAlias = resolveRulePreviewAlias(rule, availableRuleAliases);
      const rulePreviewRawValue = resolveRulePreviewRawValue(rule, activePreviewRawValue);
      const rulePreviewProfile: MonitoringRenderProfile = {
        ...cloneProfile(draft),
        rules: [cloneRule(rule)],
      };
      const rulePreviewResult = rulePreviewAlias
        ? renderMonitoringValue({
            attributeKey: rulePreviewAlias,
            value: rulePreviewRawValue,
            profiles: [rulePreviewProfile],
          })
        : null;
      return {
        index,
        rule,
        previewAlias: rulePreviewAlias,
        previewRawValue: rulePreviewRawValue,
        previewResult: rulePreviewResult,
        buttonLabel: buildRuleListLabel({
          index,
          previewRawValue: rulePreviewRawValue,
          rule,
          previewResult: rulePreviewResult,
        }),
      };
    });
  }, [activePreviewRawValue, availableRuleAliases, draft]);

  const selectedRuleEntry = useMemo(
    () => preparedRuleEntries.find((entry) => entry.rule.id === selectedRuleId) ?? null,
    [preparedRuleEntries, selectedRuleId],
  );
  const activeRule = selectedRuleEntry?.rule ?? null;
  const activeRuleIndex = selectedRuleEntry?.index ?? -1;
  const activeRulePreviewRawValue = selectedRuleEntry?.previewRawValue ?? "";
  const activeRulePreviewResult = selectedRuleEntry?.previewResult ?? null;

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

  const openRuleEditor = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setIsRuleEditorOpen(true);
  };

  const handleAddRule = () => {
    const nextRule = {
      ...createMonitoringRenderRule("value-map"),
      rulePreviewAlias:
        availableRuleAliases[0] ??
        draft?.attributeAliases[0] ??
        "",
      rulePreviewRawValue: activePreviewRawValue,
    };
    updateDraft((profile) => ({
      ...profile,
      rules: [...profile.rules, nextRule],
    }));
    setSelectedRuleId(nextRule.id);
    setIsRuleEditorOpen(true);
  };

  const handleRemoveRule = (
    ruleId: string,
    options?: {
      openEditorAfter?: boolean;
    },
  ) => {
    if (!draft || draft.rules.length <= 1) {
      return;
    }
    const openEditorAfter = options?.openEditorAfter ?? true;
    const currentIndex = draft.rules.findIndex((entry) => entry.id === ruleId);
    if (currentIndex < 0) {
      return;
    }
    const nextRules = draft.rules.filter((entry) => entry.id !== ruleId);
    updateDraft((profile) => ({
      ...profile,
      rules: profile.rules.filter((entry) => entry.id !== ruleId),
    }));
    if (nextRules.length === 0) {
      setSelectedRuleId(null);
      setIsRuleEditorOpen(false);
      return;
    }
    const nextIndex = Math.min(currentIndex, nextRules.length - 1);
    setSelectedRuleId(nextRules[nextIndex]?.id ?? null);
    setIsRuleEditorOpen(openEditorAfter);
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
    const normalizedDraftWithPendingRuleText: MonitoringRenderProfile = {
      ...normalizedDraft,
      rules: normalizedDraft.rules.map((rule) => {
        if (rule.type === "value-map") {
          const raw = valueMapTextByRuleId[rule.id];
          if (typeof raw === "string") {
            return {
              ...rule,
              mappings: parseMappingsText(raw),
            };
          }
          return rule;
        }
        if (rule.type === "threshold-symbol") {
          const raw = thresholdTextByRuleId[rule.id];
          if (typeof raw === "string") {
            return {
              ...rule,
              thresholds: parseThresholdsText(raw),
            };
          }
          return rule;
        }
        if (rule.type === "grouped-label-map") {
          const raw = groupedMapTextByRuleId[rule.id];
          if (typeof raw === "string") {
            return {
              ...rule,
              groups: parseGroupedMapText(raw),
            };
          }
          return rule;
        }
        return rule;
      }),
    };
    const normalizedDraftWithRulePreviewContext: MonitoringRenderProfile = {
      ...normalizedDraftWithPendingRuleText,
      rules: normalizedDraftWithPendingRuleText.rules.map((rule) => ({
        ...rule,
        rulePreviewAlias: resolveRulePreviewAlias(
          rule,
          normalizedDraftWithPendingRuleText.attributeAliases,
        ),
        rulePreviewRawValue: resolveRulePreviewRawValue(
          rule,
          normalizedDraftWithPendingRuleText.previewRawValue ?? "",
        ),
      })),
    };
    const nextProfiles = profiles.map((profile) =>
      profile.id === normalizedDraftWithRulePreviewContext.id ? normalizedDraftWithRulePreviewContext : profile,
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
          <h2>Attribute Rules</h2>
          <p className="muted">
            Globales Attribut-Regelwerk fuer Score/Percent/Status-Rendering mit Live-Preview.
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
        <aside className="monitoring-rules-list" aria-label="Attribute rules profile list">
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
                    onClick={handleAddRule}
                  >
                    Regel hinzufuegen
                  </button>
                </div>

                <div
                  className="monitoring-rules-rule-button-list"
                  role="list"
                  aria-label="Attribute Regeln"
                >
                  {preparedRuleEntries.map((entry) => (
                    <div
                      key={entry.rule.id}
                      role="listitem"
                      className={`monitoring-rules-rule-row${
                        selectedRuleId === entry.rule.id ? " is-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="monitoring-rules-rule-button"
                        onClick={() => openRuleEditor(entry.rule.id)}
                      >
                        <span className="monitoring-rules-rule-button-text">
                          {entry.buttonLabel}
                        </span>
                        {entry.previewResult?.symbol ? (
                          <span
                            className="monitoring-rules-rule-button-indicator"
                            aria-hidden="true"
                          >
                            {entry.previewResult.symbol}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="monitoring-rules-rule-remove-button"
                        aria-label={`Regel ${entry.index + 1} entfernen`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveRule(entry.rule.id, { openEditorAfter: false });
                        }}
                        disabled={draft.rules.length <= 1}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {isRuleEditorOpen && activeRule ? (
                <ModalShell
                  isOpen={isRuleEditorOpen}
                  title={`Regel ${activeRuleIndex + 1} bearbeiten`}
                  onClose={() => setIsRuleEditorOpen(false)}
                  className="monitoring-rules-rule-modal-panel"
                  bodyClassName="monitoring-rules-rule-modal-body"
                >
                  <article className="monitoring-rules-rule-card">
                    <header className="monitoring-rules-rule-head">
                      <select
                        value={activeRule.type}
                        onChange={(event) => {
                          const nextType = event.target.value as MonitoringRenderRule["type"];
                          updateRule(activeRule.id, (current) => ({
                            ...createMonitoringRenderRule(nextType),
                            id: current.id,
                            rulePreviewAlias: current.rulePreviewAlias,
                            rulePreviewRawValue: current.rulePreviewRawValue,
                          }));
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
                          handleRemoveRule(activeRule.id);
                        }}
                        disabled={draft.rules.length <= 1}
                      >
                        Entfernen
                      </button>
                    </header>

                    {activeRule.type === "value-map" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label>
                          Display-Modus
                          <select
                            value={activeRule.displayMode ?? "append"}
                            onChange={(event) => {
                              const next = event.target.value === "replace" ? "replace" : "append";
                              updateRule(activeRule.id, (current) =>
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
                            value={activeRule.separator ?? " "}
                            onChange={(event) => {
                              const next = event.target.value;
                              updateRule(activeRule.id, (current) =>
                                current.type === "value-map"
                                  ? { ...current, separator: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label className="monitoring-rules-enabled-toggle monitoring-rules-enabled-toggle-switch">
                          <span className="monitoring-rules-enabled-toggle-text">Case-sensitive</span>
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={Boolean(activeRule.caseSensitive)}
                              onChange={(event) => {
                                const next = event.target.checked;
                                updateRule(activeRule.id, (current) =>
                                  current.type === "value-map"
                                    ? { ...current, caseSensitive: next }
                                    : current,
                                );
                              }}
                            />
                            <span className="slider" />
                          </span>
                        </label>
                        <label>
                          Mappings (`from=to`, eine Zeile je Mapping)
                          <textarea
                            value={valueMapTextByRuleId[activeRule.id] ?? mappingsToText(activeRule)}
                            onChange={(event) => {
                              const nextText = event.target.value;
                              setValueMapTextByRuleId((current) => ({
                                ...current,
                                [activeRule.id]: nextText,
                              }));
                              const mappings = parseMappingsText(nextText);
                              updateRule(activeRule.id, (current) =>
                                current.type === "value-map"
                                  ? { ...current, mappings }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {activeRule.type === "ratio-derived-percent" ? (
                      <div className="monitoring-rules-rule-fields monitoring-rules-rule-fields--ratio">
                        <label>
                          Decimals
                          <input
                            type="number"
                            min={0}
                            max={6}
                            value={activeRule.decimals ?? 0}
                            onChange={(event) => {
                              const next = Math.max(0, Math.min(6, Number(event.target.value) || 0));
                              updateRule(activeRule.id, (current) =>
                                current.type === "ratio-derived-percent"
                                  ? { ...current, decimals: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label className="monitoring-rules-enabled-toggle monitoring-rules-enabled-toggle-switch monitoring-rules-enabled-toggle-switch-compact">
                          <span className="monitoring-rules-enabled-toggle-text">
                            Basiswert anzeigen
                          </span>
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={activeRule.showBase !== false}
                              onChange={(event) => {
                                const next = event.target.checked;
                                updateRule(activeRule.id, (current) =>
                                  current.type === "ratio-derived-percent"
                                    ? { ...current, showBase: next }
                                    : current,
                                );
                              }}
                            />
                            <span className="slider" />
                          </span>
                        </label>
                        <label className="monitoring-rules-enabled-toggle monitoring-rules-enabled-toggle-switch monitoring-rules-enabled-toggle-switch-compact">
                          <span className="monitoring-rules-enabled-toggle-text">
                            Prozent in Klammern
                          </span>
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={activeRule.wrapInParentheses !== false}
                              onChange={(event) => {
                                const next = event.target.checked;
                                updateRule(activeRule.id, (current) =>
                                  current.type === "ratio-derived-percent"
                                    ? { ...current, wrapInParentheses: next }
                                    : current,
                                );
                              }}
                            />
                            <span className="slider" />
                          </span>
                        </label>
                      </div>
                    ) : null}

                    {activeRule.type === "percent-format" ? (
                      <div className="monitoring-rules-rule-fields monitoring-rules-rule-fields--decimals-toggle">
                        <label>
                          Decimals
                          <input
                            type="number"
                            min={0}
                            max={6}
                            value={activeRule.decimals ?? 0}
                            onChange={(event) => {
                              const next = Math.max(0, Math.min(6, Number(event.target.value) || 0));
                              updateRule(activeRule.id, (current) =>
                                current.type === "percent-format"
                                  ? { ...current, decimals: next }
                                  : current,
                              );
                            }}
                          />
                        </label>
                        <label className="monitoring-rules-enabled-toggle monitoring-rules-enabled-toggle-switch">
                          <span className="monitoring-rules-enabled-toggle-text">Clamp 0-100</span>
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={activeRule.clamp !== false}
                              onChange={(event) => {
                                const next = event.target.checked;
                                updateRule(activeRule.id, (current) =>
                                  current.type === "percent-format"
                                    ? { ...current, clamp: next }
                                    : current,
                                );
                              }}
                            />
                            <span className="slider" />
                          </span>
                        </label>
                      </div>
                    ) : null}

                    {activeRule.type === "progress-bar" || activeRule.type === "progress-ring" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label>
                          Min
                          <input
                            type="number"
                            value={activeRule.min ?? 0}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              updateRule(activeRule.id, (current) =>
                                current.type === activeRule.type
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
                            value={activeRule.max ?? 100}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              updateRule(activeRule.id, (current) =>
                                current.type === activeRule.type
                                  ? { ...current, max: Number.isFinite(next) ? next : 100 }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {activeRule.type === "threshold-symbol" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label className="monitoring-rules-enabled-toggle monitoring-rules-enabled-toggle-switch">
                          <span className="monitoring-rules-enabled-toggle-text">
                            Symbol an Text anhaengen
                          </span>
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={activeRule.appendToText !== false}
                              onChange={(event) => {
                                const next = event.target.checked;
                                updateRule(activeRule.id, (current) =>
                                  current.type === "threshold-symbol"
                                    ? { ...current, appendToText: next }
                                    : current,
                                );
                              }}
                            />
                            <span className="slider" />
                          </span>
                        </label>
                        <label>
                          Separator
                          <input
                            className="text-input"
                            type="text"
                            value={activeRule.separator ?? " "}
                            onChange={(event) => {
                              const next = event.target.value;
                              updateRule(activeRule.id, (current) =>
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
                            value={thresholdTextByRuleId[activeRule.id] ?? thresholdsToText(activeRule)}
                            onChange={(event) => {
                              const nextText = event.target.value;
                              setThresholdTextByRuleId((current) => ({
                                ...current,
                                [activeRule.id]: nextText,
                              }));
                              const thresholds = parseThresholdsText(nextText);
                              updateRule(activeRule.id, (current) =>
                                current.type === "threshold-symbol"
                                  ? { ...current, thresholds }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {activeRule.type === "grouped-label-map" ? (
                      <div className="monitoring-rules-rule-fields">
                        <label className="monitoring-rules-enabled-toggle monitoring-rules-enabled-toggle-switch">
                          <span className="monitoring-rules-enabled-toggle-text">Case-sensitive</span>
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={Boolean(activeRule.caseSensitive)}
                              onChange={(event) => {
                                const next = event.target.checked;
                                updateRule(activeRule.id, (current) =>
                                  current.type === "grouped-label-map"
                                    ? { ...current, caseSensitive: next }
                                    : current,
                                );
                              }}
                            />
                            <span className="slider" />
                          </span>
                        </label>
                        <label className="monitoring-rules-enabled-toggle monitoring-rules-enabled-toggle-switch">
                          <span className="monitoring-rules-enabled-toggle-text">Text ersetzen</span>
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={Boolean(activeRule.replaceText)}
                              onChange={(event) => {
                                const next = event.target.checked;
                                updateRule(activeRule.id, (current) =>
                                  current.type === "grouped-label-map"
                                    ? { ...current, replaceText: next }
                                    : current,
                                );
                              }}
                            />
                            <span className="slider" />
                          </span>
                        </label>
                        <label>
                          Separator
                          <input
                            className="text-input"
                            type="text"
                            value={activeRule.separator ?? " "}
                            onChange={(event) => {
                              const next = event.target.value;
                              updateRule(activeRule.id, (current) =>
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
                            value={groupedMapTextByRuleId[activeRule.id] ?? groupedMapToText(activeRule)}
                            onChange={(event) => {
                              const nextText = event.target.value;
                              setGroupedMapTextByRuleId((current) => ({
                                ...current,
                                [activeRule.id]: nextText,
                              }));
                              const groups = parseGroupedMapText(nextText);
                              updateRule(activeRule.id, (current) =>
                                current.type === "grouped-label-map"
                                  ? { ...current, groups }
                                  : current,
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    <div className="monitoring-rules-rule-preview-layout">
                      <div className="monitoring-rules-rule-preview">
                        <span className="monitoring-rules-rule-preview-label">
                          Regel-Vorschau
                        </span>
                        <div className="monitoring-rules-rule-preview-value">
                          <MonitoringRenderValue
                            result={activeRulePreviewResult}
                            fallback={activeRulePreviewRawValue}
                          />
                        </div>
                      </div>
                      <div className="monitoring-rules-rule-preview-fields">
                        <label className="monitoring-rules-rule-preview-field">
                          Rohwert
                          <input
                            className="text-input monitoring-rules-rule-preview-raw"
                            type="text"
                            value={activeRulePreviewRawValue}
                            onChange={(event) => {
                              const nextRawValue = event.target.value;
                              updateRule(activeRule.id, (current) => ({
                                ...current,
                                rulePreviewRawValue: nextRawValue,
                              }));
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </article>
                </ModalShell>
              ) : null}

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
