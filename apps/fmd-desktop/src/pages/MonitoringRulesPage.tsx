/**
 * @file apps/fmd-desktop/src/pages/MonitoringRulesPage.tsx
 *
 * Global manager for monitoring render profiles.
 */

import { invoke } from "@tauri-apps/api/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ModalShell } from "../components/ModalShell";
import { useAppState } from "../components/AppStateProvider";
import { TrashIcon } from "../components/icons";
import { extractDatabaseBlockLineRanges } from "../lib/databaseBlockSyntax";
import { joinPath } from "../lib/path";
import type { FormulaRegistryEntry } from "../features/settings/useAppSettings";
import {
  addFrontmatterProperty,
  buildFrontmatterSuggestionIndex,
  parseFrontmatterDocument,
  removeFrontmatterProperty,
  sortFrontmatterKeySuggestions,
  updateFrontmatterProperty,
} from "../features/preview/frontmatter";
import {
  FormulaAttributeBuilder,
  type FormulaBuilderAttributeOption,
} from "../features/preview/formula/formula-attribute-builder";
import {
  DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE,
  normalizeDatabaseFormulaDefinitionV1,
  type DatabaseFormulaDefinitionV1,
} from "../features/preview/formula/database-formula-types";
import {
  parseDatabaseBlockConfigFromRaw,
  serializeDatabaseBlockConfig,
} from "../features/preview/database/database-block-parser";
import type {
  DatabaseBlockConfig,
  DatabaseFilterRule,
  DatabaseFilterGroup,
  DatabasePropertiesByView,
  DatabaseSortRule,
  DatabaseViewSpec,
} from "../features/preview/database/database-types";
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
  "progress-visual",
  "threshold-symbol",
  "grouped-label-map",
];

const FORMULA_OPERATION_OPTIONS: DatabaseFormulaDefinitionV1["operation"][] = [
  "avg",
  "sum",
  "count",
  "group_count",
];

const FORMULA_OPERATION_LABELS: Record<DatabaseFormulaDefinitionV1["operation"], string> = {
  avg: "Durchschnitt",
  sum: "Summe",
  count: "Anzahl",
  group_count: "Gruppieren und Zaehlen",
};

const FORMULA_SOURCE_TYPE_OPTIONS: DatabaseFormulaDefinitionV1["source"]["type"][] = [
  "current-folder",
  "explicit-folder",
  "multi-folder",
];

const FORMULA_SOURCE_TYPE_LABELS: Record<DatabaseFormulaDefinitionV1["source"]["type"], string> = {
  "current-folder": "Aktueller Ordner",
  "explicit-folder": "Ein Ordner",
  "multi-folder": "Mehrere Ordner",
};

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
  if (rule.type === "progress-visual") {
    return `${toLabel(rule.visualStyle ?? "bar")} ${rule.min ?? 0}-${rule.max ?? 100}`;
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

type MonitoringRulesSubview = "attribute-pools" | "formula-attributes";

type FormulaOccurrence = {
  filePath: string;
  fileRelativePath: string;
  key: string;
  source: "frontmatter" | "database-block";
};

type FormulaGroup = {
  id: string;
  normalizedKey: string;
  displayKey: string;
  definition: DatabaseFormulaDefinitionV1;
  occurrences: FormulaOccurrence[];
  hasConflict: boolean;
  hasRegistryEntry: boolean;
};

const isFormulaPropertyKey = (key: string) => normalizeLower(key).startsWith("f-");

const buildFormulaGroupId = (key: string) => normalizeLower(key);

const FRONTMATTER_BLOCK_PATTERN =
  /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
};

const buildFormulaAttributeOptions = (suggestions: string[]): FormulaBuilderAttributeOption[] =>
  suggestions
    .filter((suggestion) => !isFormulaPropertyKey(suggestion))
    .map((suggestion) => ({
      key: suggestion,
      label: suggestion,
      supportsMath: true,
    }));

const collectFolderSuggestions = (
  files: Array<{ relative_path: string }>,
) =>
  dedupeAliases(
    files.map((file) => {
      const normalized = file.relative_path.replace(/\\/g, "/");
      const separatorIndex = normalized.lastIndexOf("/");
      if (separatorIndex <= 0) {
        return "";
      }
      return normalized.slice(0, separatorIndex).trim();
    }),
  );

const buildNextFormulaKey = (existingGroups: FormulaGroup[]) => {
  const base = "f-new-formula";
  const existing = new Set(existingGroups.map((group) => group.normalizedKey));
  if (!existing.has(base)) {
    return base;
  }
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

const buildFallbackFormulaDefinition = (formulaKey: string): DatabaseFormulaDefinitionV1 => {
  const fallbackAttributeKey = formulaKey
    .replace(/^f-/i, "")
    .trim() || "score";
  return {
    version: 1,
    operation: "count",
    attributeKeys: [fallbackAttributeKey],
    source: { type: "current-folder" },
    shortTextRule: { ...DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE },
  };
};

const pruneDatabaseFilterGroupByKeys = (
  group: DatabaseFilterGroup,
  removalKeys: Set<string>,
): DatabaseFilterGroup => {
  const nextRules: Array<DatabaseFilterRule | DatabaseFilterGroup> = [];
  group.rules.forEach((entry) => {
    if ("rules" in entry) {
      nextRules.push(pruneDatabaseFilterGroupByKeys(entry, removalKeys));
      return;
    }
    if (removalKeys.has(normalizeLower(entry.field))) {
      return;
    }
    nextRules.push({ ...entry });
  });
  return {
    ...group,
    rules: nextRules,
  };
};

const pruneDatabaseSortRulesByKeys = (
  rules: DatabaseSortRule[],
  removalKeys: Set<string>,
) => rules.filter((rule) => !removalKeys.has(normalizeLower(rule.field)));

const pruneDatabaseViewSpecByKeys = (
  view: DatabaseViewSpec,
  removalKeys: Set<string>,
): DatabaseViewSpec => ({
  ...view,
  groupBy: removalKeys.has(normalizeLower(view.groupBy ?? "")) ? null : view.groupBy ?? null,
  timelineStartField: removalKeys.has(normalizeLower(view.timelineStartField ?? ""))
    ? null
    : view.timelineStartField ?? null,
  timelineEndField: removalKeys.has(normalizeLower(view.timelineEndField ?? ""))
    ? null
    : view.timelineEndField ?? null,
  projectStartField: removalKeys.has(normalizeLower(view.projectStartField ?? ""))
    ? null
    : view.projectStartField ?? null,
  projectUnitField: removalKeys.has(normalizeLower(view.projectUnitField ?? ""))
    ? null
    : view.projectUnitField ?? null,
  pieGroupField: removalKeys.has(normalizeLower(view.pieGroupField ?? "")) ? null : view.pieGroupField ?? null,
  pieAggregateField: removalKeys.has(normalizeLower(view.pieAggregateField ?? ""))
    ? null
    : view.pieAggregateField ?? null,
});

const pruneDatabasePropertiesByViewByKeys = (
  propertiesByView: DatabasePropertiesByView | undefined,
  removalKeys: Set<string>,
): DatabasePropertiesByView | undefined => {
  if (!propertiesByView) {
    return propertiesByView;
  }
  const filterEntries = (entries: string[] | undefined) =>
    (entries ?? []).filter((entry) => !removalKeys.has(normalizeLower(entry)));
  return {
    ...(propertiesByView.table ? { table: filterEntries(propertiesByView.table) } : {}),
    ...(propertiesByView.kanban ? { kanban: filterEntries(propertiesByView.kanban) } : {}),
    ...(propertiesByView.gantt ? { gantt: filterEntries(propertiesByView.gantt) } : {}),
    ...(propertiesByView.project ? { project: filterEntries(propertiesByView.project) } : {}),
    ...(propertiesByView.pie ? { pie: filterEntries(propertiesByView.pie) } : {}),
  };
};

const pruneFormulaFromDatabaseBlockConfig = (
  config: DatabaseBlockConfig,
  formulaKey: string,
): { changed: boolean; config: DatabaseBlockConfig } => {
  const removalKeys = new Set<string>([buildFormulaGroupId(formulaKey)]);
  const originalSignature = stableSerialize(config);

  const nextFields = (config.fields ?? []).filter((field) => {
    const normalizedKey = normalizeLower(field.key);
    const normalizedLabel = normalizeLower(field.label ?? "");
    const shouldRemove =
      removalKeys.has(normalizedKey) ||
      (normalizedLabel.length > 0 && removalKeys.has(normalizedLabel));
    if (shouldRemove) {
      if (normalizedKey) {
        removalKeys.add(normalizedKey);
      }
      if (normalizedLabel) {
        removalKeys.add(normalizedLabel);
      }
    }
    return !shouldRemove;
  });

  const filterFieldKeys = (entries: string[]) =>
    entries.filter((entry) => !removalKeys.has(normalizeLower(entry)));

  const nextConfig: DatabaseBlockConfig = {
    ...config,
    fields: nextFields,
    columns: filterFieldKeys(config.columns),
    view: pruneDatabaseViewSpecByKeys(config.view, removalKeys),
    filters: pruneDatabaseFilterGroupByKeys(config.filters, removalKeys),
    sort: pruneDatabaseSortRulesByKeys(config.sort, removalKeys),
    propertiesByView: pruneDatabasePropertiesByViewByKeys(config.propertiesByView, removalKeys),
    views: {
      ...config.views,
      items: config.views.items.map((savedView) => ({
        ...savedView,
        view: pruneDatabaseViewSpecByKeys(savedView.view, removalKeys),
        properties: filterFieldKeys(savedView.properties),
        filters: pruneDatabaseFilterGroupByKeys(savedView.filters, removalKeys),
        sort: pruneDatabaseSortRulesByKeys(savedView.sort, removalKeys),
      })),
    },
  };

  const nextSignature = stableSerialize(nextConfig);
  return {
    changed: nextSignature !== originalSignature,
    config: nextConfig,
  };
};

const removeFormulaFromDatabaseBlocks = ({
  markdown,
  formulaKey,
}: {
  markdown: string;
  formulaKey: string;
}) => {
  const lineEnding = markdown.includes("\r\n") ? "\r\n" : "\n";
  const normalizedMarkdown = markdown.replace(/\r\n?/g, "\n");
  const lines = normalizedMarkdown.split("\n");
  const ranges = extractDatabaseBlockLineRanges(lines);
  if (ranges.length === 0) {
    return {
      markdown,
      changed: false,
    };
  }

  const nextLines = [...lines];
  let changed = false;

  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index];
    if (!range) {
      continue;
    }
    const blockRaw = nextLines.slice(range.startLine, range.endLine + 1).join("\n");
    const parsed = parseDatabaseBlockConfigFromRaw(blockRaw);
    if (!parsed.isClosed || parsed.errors.length > 0) {
      continue;
    }
    const pruned = pruneFormulaFromDatabaseBlockConfig(parsed.config, formulaKey);
    if (!pruned.changed) {
      continue;
    }
    const serialized = serializeDatabaseBlockConfig(pruned.config);
    const replacementLines = serialized.split("\n");
    nextLines.splice(range.startLine, range.endLine - range.startLine + 1, ...replacementLines);
    changed = true;
  }

  if (!changed) {
    return {
      markdown,
      changed: false,
    };
  }

  return {
    markdown: nextLines.join("\n").replace(/\n/g, lineEnding),
    changed: true,
  };
};

const extractFormulaKeysFromFrontmatter = (markdown: string) => {
  const match = markdown.match(FRONTMATTER_BLOCK_PATTERN);
  if (!match) {
    return [] as string[];
  }
  const rawYaml = match[1] ?? "";
  const lines = rawYaml.split(/\r?\n/);
  const keysByNormalized = new Map<string, string>();
  lines.forEach((line) => {
    if (!line || /^\s/.test(line)) {
      return;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      return;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!isFormulaPropertyKey(key)) {
      return;
    }
    const normalizedKey = buildFormulaGroupId(key);
    if (!keysByNormalized.has(normalizedKey)) {
      keysByNormalized.set(normalizedKey, key);
    }
  });
  return Array.from(keysByNormalized.values());
};

const extractFormulaDefinitionsFromDatabaseBlocks = (markdown: string) => {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const ranges = extractDatabaseBlockLineRanges(lines);
  const definitionsByNormalized = new Map<string, DatabaseFormulaDefinitionV1>();
  const keysByNormalized = new Map<string, string>();
  const registerFormulaKey = (candidate: unknown): string | null => {
    if (typeof candidate !== "string") {
      return null;
    }
    const key = candidate.trim();
    if (!isFormulaPropertyKey(key)) {
      return null;
    }
    const normalizedKey = buildFormulaGroupId(key);
    if (!keysByNormalized.has(normalizedKey)) {
      keysByNormalized.set(normalizedKey, key);
    }
    return normalizedKey;
  };

  ranges.forEach((range) => {
    const blockRaw = lines.slice(range.startLine, range.endLine + 1).join("\n");
    const parsedBlock = parseDatabaseBlockConfigFromRaw(blockRaw);
    parsedBlock.config.columns.forEach((columnKey) => {
      registerFormulaKey(columnKey);
    });
    const savedViewItems = parsedBlock.config.views?.items ?? [];
    savedViewItems.forEach((viewItem) => {
      (viewItem.properties ?? []).forEach((propertyKey) => {
        registerFormulaKey(propertyKey);
      });
    });
    const propertiesByView = parsedBlock.config.propertiesByView;
    if (propertiesByView) {
      Object.values(propertiesByView).forEach((propertyKeys) => {
        (propertyKeys ?? []).forEach((propertyKey) => {
          registerFormulaKey(propertyKey);
        });
      });
    }
    const fields = parsedBlock.config.fields ?? [];
    fields.forEach((field) => {
      const candidateKeys = [field.key, field.label]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
      const normalizedCandidates = candidateKeys
        .map((candidateKey) => registerFormulaKey(candidateKey))
        .filter((candidate): candidate is string => Boolean(candidate));
      if (normalizedCandidates.length === 0) {
        return;
      }
      const normalizedDefinition = normalizeDatabaseFormulaDefinitionV1(field.formulaDefinition);
      if (!normalizedDefinition) {
        return;
      }
      normalizedCandidates.forEach((normalizedKey) => {
        if (!definitionsByNormalized.has(normalizedKey)) {
          definitionsByNormalized.set(normalizedKey, normalizedDefinition);
        }
      });
    });
  });

  return {
    definitionsByNormalized,
    keysByNormalized,
  };
};

const normalizeFormulaRegistryEntries = (
  entries: FormulaRegistryEntry[],
): FormulaRegistryEntry[] => {
  const dedupedByKey = new Map<string, FormulaRegistryEntry>();
  entries.forEach((entry) => {
    const key = entry.key?.trim() ?? "";
    if (!isFormulaPropertyKey(key)) {
      return;
    }
    const normalizedDefinition = normalizeDatabaseFormulaDefinitionV1(entry.definition);
    if (!normalizedDefinition) {
      return;
    }
    dedupedByKey.set(buildFormulaGroupId(key), {
      key,
      definition: normalizedDefinition,
    });
  });
  return Array.from(dedupedByKey.values()).sort((left, right) =>
    left.key.localeCompare(right.key, undefined, { sensitivity: "base" }));
};

const upsertFormulaRegistryEntry = (
  entries: FormulaRegistryEntry[],
  nextEntry: FormulaRegistryEntry,
) => {
  const normalizedKey = buildFormulaGroupId(nextEntry.key);
  const filtered = entries.filter((entry) => buildFormulaGroupId(entry.key) !== normalizedKey);
  return normalizeFormulaRegistryEntries([
    ...filtered,
    nextEntry,
  ]);
};

const removeFormulaRegistryEntryByKey = (
  entries: FormulaRegistryEntry[],
  key: string,
) => {
  const normalizedKey = buildFormulaGroupId(key);
  return normalizeFormulaRegistryEntries(
    entries.filter((entry) => buildFormulaGroupId(entry.key) !== normalizedKey),
  );
};

const collectFormulaGroups = (
  files: Array<{ filePath: string; fileRelativePath: string; markdown: string }>,
  registryEntries: FormulaRegistryEntry[],
) => {
  const groups = new Map<
    string,
    {
      id: string;
      normalizedKey: string;
      displayKey: string;
      definition: DatabaseFormulaDefinitionV1;
      occurrences: FormulaOccurrence[];
      definitionSignatures: Set<string>;
      hasRegistryEntry: boolean;
    }
  >();
  files.forEach((file) => {
    const formulaKeysByNormalized = new Map<string, string>();
    const formulaOccurrenceSourceByNormalized = new Map<string, FormulaOccurrence["source"]>();
    extractFormulaKeysFromFrontmatter(file.markdown).forEach((formulaKey) => {
      const normalizedKey = buildFormulaGroupId(formulaKey);
      formulaKeysByNormalized.set(normalizedKey, formulaKey);
      formulaOccurrenceSourceByNormalized.set(normalizedKey, "frontmatter");
    });
    const databaseBlockFormula = extractFormulaDefinitionsFromDatabaseBlocks(file.markdown);
    databaseBlockFormula.keysByNormalized.forEach((formulaKey, normalizedKey) => {
      if (!formulaKeysByNormalized.has(normalizedKey)) {
        formulaKeysByNormalized.set(normalizedKey, formulaKey);
      }
      if (!formulaOccurrenceSourceByNormalized.has(normalizedKey)) {
        formulaOccurrenceSourceByNormalized.set(normalizedKey, "database-block");
      }
    });

    const parsed = parseFrontmatterDocument(file.markdown);
    const parsedDefinitionsByNormalized = new Map<string, DatabaseFormulaDefinitionV1>();
    if (parsed.hasFrontmatter) {
      parsed.properties.forEach((property) => {
        if (!isFormulaPropertyKey(property.key)) {
          return;
        }
        const normalizedKey = buildFormulaGroupId(property.key);
        if (!formulaKeysByNormalized.has(normalizedKey)) {
          formulaKeysByNormalized.set(normalizedKey, property.key);
        }
        const normalizedDefinition = normalizeDatabaseFormulaDefinitionV1(property.value);
        if (!normalizedDefinition) {
          return;
        }
        parsedDefinitionsByNormalized.set(normalizedKey, normalizedDefinition);
      });
    }
    databaseBlockFormula.definitionsByNormalized.forEach((definition, normalizedKey) => {
      if (!parsedDefinitionsByNormalized.has(normalizedKey)) {
        parsedDefinitionsByNormalized.set(normalizedKey, definition);
      }
    });

    formulaKeysByNormalized.forEach((displayKey, normalizedKey) => {
      const resolvedDefinition = parsedDefinitionsByNormalized.get(normalizedKey) ??
        buildFallbackFormulaDefinition(displayKey);
      const occurrenceSource =
        formulaOccurrenceSourceByNormalized.get(normalizedKey) ?? "frontmatter";
      const signature = stableSerialize(resolvedDefinition);
      const current = groups.get(normalizedKey);
      if (current) {
        const hasOccurrence = current.occurrences.some(
          (occurrence) =>
            occurrence.filePath === file.filePath &&
            buildFormulaGroupId(occurrence.key) === normalizedKey &&
            occurrence.source === occurrenceSource,
        );
        if (!hasOccurrence) {
          current.occurrences.push({
            filePath: file.filePath,
            fileRelativePath: file.fileRelativePath,
            key: displayKey,
            source: occurrenceSource,
          });
        }
        current.definitionSignatures.add(signature);
        return;
      }
      groups.set(normalizedKey, {
        id: normalizedKey,
        normalizedKey,
        displayKey,
        definition: resolvedDefinition,
        occurrences: [{
          filePath: file.filePath,
          fileRelativePath: file.fileRelativePath,
          key: displayKey,
          source: occurrenceSource,
        }],
        definitionSignatures: new Set([signature]),
        hasRegistryEntry: false,
      });
    });
  });

  registryEntries.forEach((entry) => {
    const normalizedDefinition = normalizeDatabaseFormulaDefinitionV1(entry.definition);
    if (!normalizedDefinition) {
      return;
    }
    const normalizedKey = buildFormulaGroupId(entry.key);
    const signature = stableSerialize(normalizedDefinition);
    const current = groups.get(normalizedKey);
    if (current) {
      current.hasRegistryEntry = true;
      current.definitionSignatures.add(signature);
      return;
    }
    groups.set(normalizedKey, {
      id: normalizedKey,
      normalizedKey,
      displayKey: entry.key,
      definition: normalizedDefinition,
      occurrences: [],
      definitionSignatures: new Set([signature]),
      hasRegistryEntry: true,
    });
  });

  const nextGroups: FormulaGroup[] = Array.from(groups.values())
    .map((group) => ({
      id: group.id,
      normalizedKey: group.normalizedKey,
      displayKey: group.displayKey,
      definition: group.definition,
      occurrences: group.occurrences
        .slice()
        .sort((left, right) =>
          left.fileRelativePath.localeCompare(right.fileRelativePath, undefined, { sensitivity: "base" })),
      hasConflict: group.definitionSignatures.size > 1,
      hasRegistryEntry: group.hasRegistryEntry,
    }))
    .sort((left, right) =>
      left.displayKey.localeCompare(right.displayKey, undefined, { sensitivity: "base" }));

  return nextGroups;
};

export const MonitoringRulesPage = () => {
  const appState = useAppState();
  const { settings, vault, actions } = appState;
  const profiles = settings.monitoringRenderProfiles;
  const formulaAttributeRegistry = useMemo(
    () => normalizeFormulaRegistryEntries(settings.formulaAttributeRegistry ?? []),
    [settings.formulaAttributeRegistry],
  );

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
  const [activeSubview, setActiveSubview] = useState<MonitoringRulesSubview>("attribute-pools");
  const [formulaGroups, setFormulaGroups] = useState<FormulaGroup[]>([]);
  const [formulaGroupsState, setFormulaGroupsState] = useState<"idle" | "loading" | "ready">(
    "idle",
  );
  const [selectedFormulaGroupId, setSelectedFormulaGroupId] = useState<string | null>(null);
  const [formulaKeyDraft, setFormulaKeyDraft] = useState("");
  const [formulaDefinitionDraft, setFormulaDefinitionDraft] = useState<DatabaseFormulaDefinitionV1 | null>(
    null,
  );
  const [formulaSavePending, setFormulaSavePending] = useState(false);
  const [profileDeleteTargetId, setProfileDeleteTargetId] = useState<string | null>(null);
  const [profileDeletePending, setProfileDeletePending] = useState(false);
  const [formulaDeleteTargetId, setFormulaDeleteTargetId] = useState<string | null>(null);
  const [formulaDeletePending, setFormulaDeletePending] = useState(false);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  const loadFormulaGroups = useCallback(async (registryOverride?: FormulaRegistryEntry[]) => {
    const effectiveRegistryEntries = normalizeFormulaRegistryEntries(
      registryOverride ?? formulaAttributeRegistry,
    );
    const toPathKey = (value: string) => value.replace(/\\/g, "/").toLowerCase();
    const markdownFilesByPath = new Map<
      string,
      { path: string; relativePath: string }
    >();
    vault.files.forEach((file) => {
      if (!file.path.toLowerCase().endsWith(".md")) {
        return;
      }
      markdownFilesByPath.set(toPathKey(file.path), {
        path: file.path,
        relativePath: file.relative_path,
      });
    });
    if (vault.vaultPath) {
      const historyDir = joinPath(vault.vaultPath, ".profile", "exam-runs");
      try {
        const historyEntries = await invoke<string[]>("list_files", { path: historyDir });
        if (Array.isArray(historyEntries)) {
          const normalizedHistoryDir = historyDir.replace(/\\/g, "/");
          historyEntries.forEach((entryPath) => {
            if (!entryPath.toLowerCase().endsWith(".md")) {
              return;
            }
            const entryPathKey = toPathKey(entryPath);
            if (markdownFilesByPath.has(entryPathKey)) {
              return;
            }
            const normalizedEntryPath = entryPath.replace(/\\/g, "/");
            const relativeWithinHistory = normalizedEntryPath.startsWith(`${normalizedHistoryDir}/`)
              ? normalizedEntryPath.slice(normalizedHistoryDir.length + 1)
              : (normalizedEntryPath.split("/").pop() ?? normalizedEntryPath);
            markdownFilesByPath.set(entryPathKey, {
              path: entryPath,
              relativePath: `.profile/exam-runs/${relativeWithinHistory}`,
            });
          });
        }
      } catch {
        // Ignore missing/unreadable history directory for formula discovery.
      }
    }
    const markdownFiles = Array.from(markdownFilesByPath.values());
    if (markdownFiles.length === 0) {
      setFormulaGroups(collectFormulaGroups([], effectiveRegistryEntries));
      setFormulaGroupsState("ready");
      return;
    }

    setFormulaGroupsState("loading");
    const loadedMarkdownByPath = await Promise.all(
      markdownFiles.map(async (file) => {
        try {
          const markdown = await invoke<string>("read_text_file", { path: file.path });
          return {
            filePath: file.path,
            fileRelativePath: file.relativePath,
            markdown,
          };
        } catch {
          return null;
        }
      }),
    );
    const readyFiles = loadedMarkdownByPath.filter(
      (entry): entry is { filePath: string; fileRelativePath: string; markdown: string } => Boolean(entry),
    );
    setFormulaGroups(collectFormulaGroups(readyFiles, effectiveRegistryEntries));
    setFormulaGroupsState("ready");
  }, [formulaAttributeRegistry, vault.files, vault.vaultPath]);

  const selectedFormulaGroup = useMemo(
    () => formulaGroups.find((group) => group.id === selectedFormulaGroupId) ?? null,
    [formulaGroups, selectedFormulaGroupId],
  );
  const profileDeleteTarget = useMemo(
    () => profiles.find((profile) => profile.id === profileDeleteTargetId) ?? null,
    [profiles, profileDeleteTargetId],
  );
  const formulaDeleteTarget = useMemo(
    () => formulaGroups.find((group) => group.id === formulaDeleteTargetId) ?? null,
    [formulaDeleteTargetId, formulaGroups],
  );

  const handleOpenFormulaOccurrence = useCallback(
    (
      occurrence: FormulaOccurrence,
      options?: {
        openInNewTab?: boolean;
      },
    ) => {
      const normalizedOccurrencePath = occurrence.filePath.replace(/\\/g, "/").toLowerCase();
      const file = vault.files.find((candidate) =>
        candidate.path === occurrence.filePath ||
        candidate.path.replace(/\\/g, "/").toLowerCase() === normalizedOccurrencePath
      ) ?? {
        path: occurrence.filePath,
        relative_path: occurrence.fileRelativePath,
      };
      actions?.handleSelectFile?.(file, options);
    },
    [actions, vault.files],
  );

  const formulaFolderSuggestions = useMemo(
    () => collectFolderSuggestions(vault.files),
    [vault.files],
  );

  const formulaAttributeOptions = useMemo(
    () => buildFormulaAttributeOptions(attributeAliasSuggestions),
    [attributeAliasSuggestions],
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

  useEffect(() => {
    if (activeSubview !== "formula-attributes" || formulaGroupsState !== "idle") {
      return;
    }
    void loadFormulaGroups();
  }, [activeSubview, formulaGroupsState, loadFormulaGroups]);

  useEffect(() => {
    setFormulaGroupsState("idle");
  }, [formulaAttributeRegistry, vault.files, vault.vaultPath]);

  useEffect(() => {
    if (profileDeleteTargetId && !profiles.some((profile) => profile.id === profileDeleteTargetId)) {
      setProfileDeleteTargetId(null);
    }
  }, [profileDeleteTargetId, profiles]);

  useEffect(() => {
    if (formulaDeleteTargetId && !formulaGroups.some((group) => group.id === formulaDeleteTargetId)) {
      setFormulaDeleteTargetId(null);
    }
  }, [formulaDeleteTargetId, formulaGroups]);

  useEffect(() => {
    if (formulaGroups.length === 0) {
      setSelectedFormulaGroupId(null);
      setFormulaKeyDraft("");
      setFormulaDefinitionDraft(null);
      return;
    }
    setSelectedFormulaGroupId((current) =>
      formulaGroups.some((group) => group.id === current)
        ? current
        : formulaGroups[0]?.id ?? null,
    );
  }, [formulaGroups]);

  useEffect(() => {
    if (!selectedFormulaGroup) {
      setFormulaKeyDraft("");
      setFormulaDefinitionDraft(null);
      return;
    }
    setFormulaKeyDraft(selectedFormulaGroup.displayKey);
    setFormulaDefinitionDraft(selectedFormulaGroup.definition);
  }, [selectedFormulaGroup]);

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

  const persistFormulaRegistry = async (nextRegistry: FormulaRegistryEntry[]) => {
    settings.setFormulaAttributeRegistry(nextRegistry);
    const saved = await settings.persistSettings({
      formulaAttributeRegistry: nextRegistry,
    });
    if (!saved) {
      setStatusError("Formel-Registry konnte nicht gespeichert werden.");
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

  const handleDeleteProfile = async (profileId: string) => {
    if (!profileId) {
      return;
    }
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    const saved = await persistProfiles(nextProfiles);
    if (!saved) {
      return;
    }
    setPreviewRawByProfileId((current) => {
      if (!(profileId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    setSelectedId((current) =>
      current === profileId ? (nextProfiles[0]?.id ?? null) : current,
    );
    setProfileDeleteTargetId(null);
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

  const handleSaveFormulaAttribute = async () => {
    if (!selectedFormulaGroup || !formulaDefinitionDraft) {
      return;
    }
    const nextKey = formulaKeyDraft.trim();
    if (!nextKey) {
      setStatusMessage("");
      setStatusError("Formelname darf nicht leer sein.");
      return;
    }
    if (!isFormulaPropertyKey(nextKey)) {
      setStatusMessage("");
      setStatusError("Formelname muss mit f- beginnen.");
      return;
    }
    const normalizedDefinition = normalizeDatabaseFormulaDefinitionV1(formulaDefinitionDraft);
    if (!normalizedDefinition) {
      setStatusMessage("");
      setStatusError("Formeldefinition ist unvollstaendig oder ungueltig.");
      return;
    }

    setFormulaSavePending(true);
    try {
      const renameRequested = normalizeLower(nextKey) !== selectedFormulaGroup.normalizedKey;
      const registryWithoutSelected = removeFormulaRegistryEntryByKey(
        formulaAttributeRegistry,
        selectedFormulaGroup.displayKey,
      );
      const nextRegistry = upsertFormulaRegistryEntry(
        registryWithoutSelected,
        { key: nextKey, definition: normalizedDefinition },
      );
      const frontmatterOccurrences = selectedFormulaGroup.occurrences.filter(
        (occurrence) => occurrence.source === "frontmatter",
      );
      const occurrencesByFile = frontmatterOccurrences.reduce(
        (map, occurrence) => {
          const current = map.get(occurrence.filePath) ?? [];
          current.push(occurrence);
          map.set(occurrence.filePath, current);
          return map;
        },
        new Map<string, FormulaOccurrence[]>(),
      );

      const preparedWrites = new Map<string, { nextMarkdown: string }>();
      for (const [filePath, occurrences] of occurrencesByFile.entries()) {
        const markdown = await invoke<string>("read_text_file", { path: filePath });
        let nextMarkdown = markdown;
        const sourceKeys = Array.from(new Set(occurrences.map((entry) => entry.key)));
        if (renameRequested) {
          const addResult = addFrontmatterProperty({
            markdown: nextMarkdown,
            key: nextKey,
            kind: "formula",
            value: normalizedDefinition,
          });
          if (addResult.error) {
            setStatusMessage("");
            setStatusError(`${occurrences[0]?.fileRelativePath ?? filePath}: ${addResult.error}`);
            return;
          }
          nextMarkdown = addResult.markdown;
          for (const sourceKey of sourceKeys) {
            const removeResult = removeFrontmatterProperty({
              markdown: nextMarkdown,
              key: sourceKey,
            });
            if (removeResult.error) {
              setStatusMessage("");
              setStatusError(`${occurrences[0]?.fileRelativePath ?? filePath}: ${removeResult.error}`);
              return;
            }
            nextMarkdown = removeResult.markdown;
          }
        } else {
          for (const sourceKey of sourceKeys) {
            const updateResult = updateFrontmatterProperty({
              markdown: nextMarkdown,
              key: sourceKey,
              kind: "formula",
              value: normalizedDefinition,
            });
            if (updateResult.error) {
              setStatusMessage("");
              setStatusError(`${occurrences[0]?.fileRelativePath ?? filePath}: ${updateResult.error}`);
              return;
            }
            nextMarkdown = updateResult.markdown;
          }
        }
        preparedWrites.set(filePath, {
          nextMarkdown,
        });
      }

      const savedRegistry = await persistFormulaRegistry(nextRegistry);
      if (!savedRegistry) {
        return;
      }

      await Promise.all(
        Array.from(preparedWrites.entries()).map(([filePath, prepared]) =>
          invoke("write_text_file", {
            path: filePath,
            contents: prepared.nextMarkdown,
          })
        ),
      );
      await loadFormulaGroups(nextRegistry);
      setSelectedFormulaGroupId(buildFormulaGroupId(nextKey));
      setStatusError("");
      setStatusMessage(
        `Formel ${nextKey} gespeichert (${preparedWrites.size} Datei${preparedWrites.size === 1 ? "" : "en"} aktualisiert).`,
      );
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        `Formel konnte nicht gespeichert werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setFormulaSavePending(false);
    }
  };

  const handleCreateFormulaAttribute = async () => {
    const defaultAttributeKey = attributeAliasSuggestions.find((entry) => !isFormulaPropertyKey(entry))
      ?? draft?.attributeAliases[0]
      ?? "score";
    const nextKey = buildNextFormulaKey(formulaGroups);
    const defaultDefinition: DatabaseFormulaDefinitionV1 = {
      version: 1,
      operation: "count",
      attributeKeys: [defaultAttributeKey],
      source: { type: "current-folder" },
      shortTextRule: { ...DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE },
    };

    try {
      const nextRegistry = upsertFormulaRegistryEntry(
        formulaAttributeRegistry,
        {
          key: nextKey,
          definition: defaultDefinition,
        },
      );
      const saved = await persistFormulaRegistry(nextRegistry);
      if (!saved) {
        return;
      }
      await loadFormulaGroups(nextRegistry);
      setSelectedFormulaGroupId(buildFormulaGroupId(nextKey));
      setFormulaKeyDraft(nextKey);
      setFormulaDefinitionDraft(defaultDefinition);
      setStatusError("");
      setStatusMessage(`Formel ${nextKey} erstellt (unzugeordnet).`);
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        `Formel konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleDeleteFormulaAttribute = async (group: FormulaGroup) => {
    const occurrencesByFile = group.occurrences.reduce(
      (map, occurrence) => {
        const current = map.get(occurrence.filePath) ?? [];
        current.push(occurrence);
        map.set(occurrence.filePath, current);
        return map;
      },
      new Map<string, FormulaOccurrence[]>(),
    );
    const preparedWrites = new Map<string, { nextMarkdown: string }>();
    for (const [filePath, occurrences] of occurrencesByFile.entries()) {
      const markdown = await invoke<string>("read_text_file", { path: filePath });
      let nextMarkdown = markdown;
      const frontmatterSourceKeys = Array.from(
        new Set(
          occurrences
            .filter((entry) => entry.source === "frontmatter")
            .map((entry) => entry.key),
        ),
      );
      for (const sourceKey of frontmatterSourceKeys) {
        const removeResult = removeFrontmatterProperty({
          markdown: nextMarkdown,
          key: sourceKey,
        });
        if (removeResult.error) {
          setStatusMessage("");
          setStatusError(`${occurrences[0]?.fileRelativePath ?? filePath}: ${removeResult.error}`);
          return;
        }
        nextMarkdown = removeResult.markdown;
      }

      const databaseCleanupResult = removeFormulaFromDatabaseBlocks({
        markdown: nextMarkdown,
        formulaKey: group.displayKey,
      });
      nextMarkdown = databaseCleanupResult.markdown;

      if (nextMarkdown === markdown) {
        continue;
      }

      preparedWrites.set(filePath, { nextMarkdown });
    }

    const nextRegistry = removeFormulaRegistryEntryByKey(
      formulaAttributeRegistry,
      group.displayKey,
    );
    const savedRegistry = await persistFormulaRegistry(nextRegistry);
    if (!savedRegistry) {
      return;
    }

    await Promise.all(
      Array.from(preparedWrites.entries()).map(([filePath, prepared]) =>
        invoke("write_text_file", {
          path: filePath,
          contents: prepared.nextMarkdown,
        }),
      ),
    );
    await loadFormulaGroups(nextRegistry);
    setSelectedFormulaGroupId((current) =>
      current === group.id ? null : current,
    );
    setFormulaDeleteTargetId(null);
    setStatusError("");
    setStatusMessage(
      `Formel ${group.displayKey} entfernt (${preparedWrites.size} Datei${preparedWrites.size === 1 ? "" : "en"} bereinigt).`,
    );
  };

  const handleConfirmDeleteFormulaAttribute = async () => {
    if (!formulaDeleteTarget || formulaDeletePending) {
      return;
    }
    setFormulaDeletePending(true);
    try {
      await handleDeleteFormulaAttribute(formulaDeleteTarget);
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        `Formel konnte nicht entfernt werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setFormulaDeletePending(false);
    }
  };

  const handleConfirmDeleteProfile = async () => {
    if (!profileDeleteTarget || profileDeletePending) {
      return;
    }
    setProfileDeletePending(true);
    try {
      await handleDeleteProfile(profileDeleteTarget.id);
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        `Profil konnte nicht entfernt werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setProfileDeletePending(false);
    }
  };

  const handleFormulaOperationChange = (nextOperation: DatabaseFormulaDefinitionV1["operation"]) => {
    setFormulaDefinitionDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        operation: nextOperation,
      };
    });
  };

  const handleFormulaSourceTypeChange = (nextType: DatabaseFormulaDefinitionV1["source"]["type"]) => {
    setFormulaDefinitionDraft((current) => {
      if (!current) {
        return current;
      }
      const nextSource = {
        type: nextType,
      } as DatabaseFormulaDefinitionV1["source"];
      if (nextType === "explicit-folder") {
        nextSource.path = current.source.path?.trim() ?? "";
      }
      if (nextType === "multi-folder") {
        nextSource.paths = current.source.type === "multi-folder"
          ? [...(current.source.paths ?? [])]
          : [];
      }
      return {
        ...current,
        source: nextSource,
      };
    });
  };

  return (
    <section className="panel monitoring-rules-panel">
      <div
        className="monitoring-rules-view-switch"
        role="tablist"
        aria-label="Attribute Rules Ansicht"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSubview === "attribute-pools"}
          className={`ghost small ${activeSubview === "attribute-pools" ? "active" : ""}`}
          onClick={() => setActiveSubview("attribute-pools")}
        >
          Attributpools
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubview === "formula-attributes"}
          className={`ghost small ${activeSubview === "formula-attributes" ? "active" : ""}`}
          onClick={() => setActiveSubview("formula-attributes")}
        >
          Formelattribute
        </button>
      </div>
      <div className="panel-header">
        <div>
          <h2>Attribute Rules</h2>
          <p className="muted">
            Globales Attribut-Regelwerk fuer Score/Percent/Status-Rendering mit Live-Preview.
          </p>
        </div>
        <div className="monitoring-rules-header-actions">
          {activeSubview === "attribute-pools" ? (
            <>
              <button type="button" className="ghost small" onClick={() => void handleCreateProfile()}>
                Neues Profil
              </button>
              <button
                type="button"
                className="primary small"
                disabled={!draft}
                onClick={() => void handleSaveDraft()}
              >
                Speichern
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghost small"
                disabled={formulaGroupsState === "loading" || formulaDeletePending}
                onClick={() => void loadFormulaGroups()}
              >
                Neu laden
              </button>
              <button
                type="button"
                className="ghost small"
                disabled={formulaGroupsState === "loading" || formulaSavePending || formulaDeletePending}
                onClick={() => void handleCreateFormulaAttribute()}
              >
                Formel erstellen
              </button>
              <button
                type="button"
                className="primary small"
                disabled={!selectedFormulaGroup || !formulaDefinitionDraft || formulaSavePending || formulaDeletePending}
                onClick={() => void handleSaveFormulaAttribute()}
              >
                Formel speichern
              </button>
            </>
          )}
        </div>
      </div>
      {statusError ? <div className="error">{statusError}</div> : null}
      {statusMessage ? <p className="muted">{statusMessage}</p> : null}

      {activeSubview === "attribute-pools" ? (
        <div className="monitoring-rules-layout">
          <aside className="monitoring-rules-list" aria-label="Attribute rules profile list">
            {profiles.map((profile) => (
              <div key={profile.id} className="monitoring-rules-list-entry">
                <button
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
                {profile.id === selectedId ? (
                  <button
                    type="button"
                    className="monitoring-rules-list-item-delete"
                    aria-label={`Profil ${profile.name} loeschen`}
                    disabled={profiles.length <= 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      setProfileDeleteTargetId(profile.id);
                    }}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </div>
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
                        {entry.previewResult?.progressVisual ? (
                          <span className="monitoring-rules-rule-button-indicator" aria-hidden="true">
                            <MonitoringRenderValue
                              result={entry.previewResult}
                              compact
                              showText={false}
                            />
                          </span>
                        ) : entry.previewResult?.symbol ? (
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

                    {activeRule.type === "progress-visual" ? (
                      <div className="monitoring-rules-rule-fields monitoring-rules-rule-fields--progress-visual">
                        <label>
                          Visual Style
                          <select
                            value={activeRule.visualStyle ?? "bar"}
                            onChange={(event) => {
                              const nextStyle: "bar" | "ring" | "pie" = event.target.value === "ring"
                                ? "ring"
                                : event.target.value === "pie"
                                  ? "pie"
                                  : "bar";
                              updateRule(activeRule.id, (current) =>
                                current.type === "progress-visual"
                                  ? { ...current, visualStyle: nextStyle }
                                  : current,
                              );
                            }}
                          >
                            <option value="bar">▭ Balken</option>
                            <option value="ring">◌ Ring</option>
                            <option value="pie">◔ Torte</option>
                          </select>
                        </label>
                        <label>
                          Min
                          <input
                            type="number"
                            value={activeRule.min ?? 0}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              updateRule(activeRule.id, (current) =>
                                current.type === "progress-visual"
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
                                current.type === "progress-visual"
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
      ) : (
        <div className="monitoring-rules-layout monitoring-rules-layout--formula">
          <aside className="monitoring-rules-list" aria-label="Formula attributes list">
            {formulaGroupsState === "loading" ? (
              <div className="database-view-empty">Formelattribute werden geladen...</div>
            ) : formulaGroups.length === 0 ? (
              <div className="database-view-empty">
                Keine Formelattribute gefunden. Weder Registry-Eintraege noch Frontmatter-Keys mit `f-` verfuegbar.
              </div>
            ) : (
              formulaGroups.map((group) => (
                <div key={group.id} className="monitoring-rules-list-entry">
                  <button
                    type="button"
                    className={`monitoring-rules-list-item${group.id === selectedFormulaGroupId ? " is-active" : ""}`}
                    onClick={() => {
                      setSelectedFormulaGroupId(group.id);
                      setStatusMessage("");
                      setStatusError("");
                    }}
                  >
                    <strong>{group.displayKey}</strong>
                    <span>
                      {group.occurrences.length === 0
                        ? "Unzugeordnet"
                        : `${group.occurrences.length} Fundstelle${group.occurrences.length === 1 ? "" : "n"}`}
                    </span>
                    <span>
                      {toLabel(group.definition.operation)}
                      {group.hasConflict ? " - Konflikt" : ""}
                    </span>
                  </button>
                  {group.id === selectedFormulaGroupId ? (
                    <button
                      type="button"
                      className="monitoring-rules-list-item-delete"
                      aria-label={`Formel ${group.displayKey} loeschen`}
                      disabled={formulaDeletePending}
                      onClick={(event) => {
                        event.stopPropagation();
                        setFormulaDeleteTargetId(group.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </aside>

          <div className="monitoring-rules-editor">
            {selectedFormulaGroup && formulaDefinitionDraft ? (
              <>
                {selectedFormulaGroup.hasConflict ? (
                  <div className="monitoring-rules-formula-conflict-warning" role="status">
                    Abweichende Definitionen gefunden. Speichern ueberschreibt alle Fundstellen mit der aktuellen
                    Definition.
                  </div>
                ) : null}
                <section className="monitoring-rules-section">
                  <h3>Formel-Metadaten</h3>
                  <div className="monitoring-rules-grid monitoring-rules-formula-meta-grid">
                    <label>
                      Name
                      <input
                        className="text-input"
                        type="text"
                        value={formulaKeyDraft}
                        onChange={(event) => setFormulaKeyDraft(event.target.value)}
                      />
                    </label>
                    <label>
                      Operation
                      <select
                        value={formulaDefinitionDraft.operation}
                        onChange={(event) =>
                          handleFormulaOperationChange(
                            event.target.value as DatabaseFormulaDefinitionV1["operation"],
                          )
                        }
                      >
                        {FORMULA_OPERATION_OPTIONS.map((operation) => (
                          <option key={operation} value={operation}>
                            {FORMULA_OPERATION_LABELS[operation]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quelle
                      <select
                        value={formulaDefinitionDraft.source.type}
                        onChange={(event) =>
                          handleFormulaSourceTypeChange(
                            event.target.value as DatabaseFormulaDefinitionV1["source"]["type"],
                          )
                        }
                      >
                        {FORMULA_SOURCE_TYPE_OPTIONS.map((sourceType) => (
                          <option key={sourceType} value={sourceType}>
                            {FORMULA_SOURCE_TYPE_LABELS[sourceType]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Zielattribute
                      <input
                        className="text-input"
                        type="text"
                        value={formulaDefinitionDraft.attributeKeys.join(", ")}
                        readOnly
                      />
                    </label>
                  </div>
                </section>

                <section className="monitoring-rules-section monitoring-rules-formula-builder-section">
                  <h3>Formeldefinition</h3>
                  <div className="monitoring-rules-formula-builder-shell">
                    <FormulaAttributeBuilder
                      idPrefix={`monitoring-formula-${selectedFormulaGroup.id}`}
                      value={formulaDefinitionDraft}
                      attributes={formulaAttributeOptions}
                      showOperationField={false}
                      showSourceTypeField={false}
                      folderSuggestions={formulaFolderSuggestions}
                      onChange={(next) => {
                        setFormulaDefinitionDraft((current) => {
                          if (!current) {
                            return current;
                          }
                          return typeof next === "function" ? next(current) : next;
                        });
                      }}
                    />
                  </div>
                </section>
              </>
            ) : (
              <div className="database-view-empty">Kein Formelattribut ausgewaehlt.</div>
            )}
          </div>

          <aside className="monitoring-rules-section monitoring-rules-formula-info" aria-label="Formula references">
            {selectedFormulaGroup ? (
              <>
                <h3>Fundstellen</h3>
                <p className="muted">
                  Diese Formel wird in {selectedFormulaGroup.occurrences.length} Datei
                  {selectedFormulaGroup.occurrences.length === 1 ? "" : "en"} verwendet.
                </p>
                {selectedFormulaGroup.occurrences.length === 0 ? (
                  <p className="muted">
                    Keine Dateizuordnung. Die Formel ist nur in der Registry gespeichert.
                  </p>
                ) : null}
                {selectedFormulaGroup.hasConflict ? (
                  <p className="monitoring-rules-formula-conflict-text">
                    Konfliktstatus: Uneinheitliche Definitionen vorhanden.
                  </p>
                ) : null}
                {selectedFormulaGroup.occurrences.length > 0 ? (
                  <ul className="monitoring-rules-formula-occurrence-list">
                    {selectedFormulaGroup.occurrences.map((occurrence) => (
                      <li key={`${occurrence.filePath}::${occurrence.key}::${occurrence.source}`}>
                        <button
                          type="button"
                          className="monitoring-rules-formula-occurrence-link"
                          title={`${occurrence.fileRelativePath} oeffnen`}
                          aria-label={`${occurrence.fileRelativePath} oeffnen`}
                          onClick={(event) => {
                            handleOpenFormulaOccurrence(occurrence, {
                              openInNewTab: event.metaKey || event.ctrlKey,
                            });
                          }}
                          onAuxClick={(event) => {
                            if (event.button !== 1) {
                              return;
                            }
                            handleOpenFormulaOccurrence(occurrence, { openInNewTab: true });
                          }}
                        >
                          <code>
                            {occurrence.fileRelativePath}
                            {occurrence.source === "database-block" ? " (DB-Block)" : ""}
                          </code>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <div className="database-view-empty">Keine Fundstellen verfuegbar.</div>
            )}
          </aside>
        </div>
      )}
      <ModalShell
        isOpen={Boolean(profileDeleteTarget)}
        title="Profil loeschen"
        onClose={() => setProfileDeleteTargetId(null)}
        className="monitoring-rules-confirm-modal"
      >
        <div className="monitoring-rules-confirm-content">
          <p>
            Soll das Profil <strong>{profileDeleteTarget?.name ?? ""}</strong> wirklich geloescht werden?
          </p>
          <div className="monitoring-rules-confirm-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => setProfileDeleteTargetId(null)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="ghost small monitoring-rules-danger-action"
              disabled={profileDeletePending}
              onClick={() => void handleConfirmDeleteProfile()}
            >
              Profil loeschen
            </button>
          </div>
        </div>
      </ModalShell>
      <ModalShell
        isOpen={Boolean(formulaDeleteTarget)}
        title="Formel loeschen"
        onClose={() => setFormulaDeleteTargetId(null)}
        className="monitoring-rules-confirm-modal"
      >
        <div className="monitoring-rules-confirm-content">
          <p>
            Soll die Formel <strong>{formulaDeleteTarget?.displayKey ?? ""}</strong> global geloescht werden?
          </p>
          <p className="muted">
            Registry-Eintrag und alle Fundstellen in Markdown-Dateien werden entfernt.
          </p>
          <div className="monitoring-rules-confirm-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => setFormulaDeleteTargetId(null)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="ghost small monitoring-rules-danger-action"
              disabled={formulaDeletePending}
              onClick={() => void handleConfirmDeleteFormulaAttribute()}
            >
              Formel loeschen
            </button>
          </div>
        </div>
      </ModalShell>
    </section>
  );
};

export default MonitoringRulesPage;
