/**
 * @file monitoring-render-rules.ts
 *
 * Global monitoring render-rule model + engine.
 */

export type MonitoringRenderScope =
  | "monitoring-page"
  | "database"
  | "properties";

export type MonitoringInputFormat =
  | "ratio"
  | "numeric-percent"
  | "code"
  | "text"
  | "short-structured-text-with-number";

export type MonitoringValueMapEntry = {
  from: string;
  to: string;
};

export type MonitoringGroupedLabelMapEntry = {
  label: string;
  values: string[];
  symbol?: string | null;
};

export type MonitoringThresholdOperator = ">=" | ">" | "<=" | "<" | "=";

export type MonitoringThresholdRuleEntry = {
  op: MonitoringThresholdOperator;
  value: number;
  symbol: string;
};

export type MonitoringRenderRule =
  | {
      id: string;
      type: "value-map";
      mappings: MonitoringValueMapEntry[];
      caseSensitive?: boolean;
      displayMode?: "append" | "replace";
      separator?: string;
    }
  | {
      id: string;
      type: "ratio-derived-percent";
      decimals?: number;
      showBase?: boolean;
      wrapInParentheses?: boolean;
    }
  | {
      id: string;
      type: "percent-format";
      decimals?: number;
      clamp?: boolean;
    }
  | {
      id: string;
      type: "progress-bar";
      min?: number;
      max?: number;
    }
  | {
      id: string;
      type: "progress-ring";
      min?: number;
      max?: number;
    }
  | {
      id: string;
      type: "threshold-symbol";
      thresholds: MonitoringThresholdRuleEntry[];
      appendToText?: boolean;
      separator?: string;
    }
  | {
      id: string;
      type: "grouped-label-map";
      groups: MonitoringGroupedLabelMapEntry[];
      caseSensitive?: boolean;
      replaceText?: boolean;
      separator?: string;
    };

export type MonitoringRenderProfile = {
  id: string;
  name: string;
  attributeAliases: string[];
  inputFormat: MonitoringInputFormat;
  previewRawValue?: string;
  scopes: MonitoringRenderScope[];
  rules: MonitoringRenderRule[];
  enabled?: boolean;
};

export type MonitoringRenderResult = {
  profileId: string;
  rawText: string;
  displayText: string;
  symbol: string | null;
  badge: string | null;
  percentValue: number | null;
  progressBar: boolean;
  progressRing: boolean;
  compactText: string;
};

export const formatMonitoringCompactText = (
  result: MonitoringRenderResult | null,
  fallbackValue: unknown,
) => {
  if (result && result.compactText.trim().length > 0) {
    return result.compactText;
  }
  const fallback = toRawText(fallbackValue).trim();
  return fallback || "";
};

const DEFAULT_STATUS_MAP: MonitoringValueMapEntry[] = [
  { from: "0", to: "⚪" },
  { from: "1", to: "💎" },
  { from: "2", to: "🟢" },
  { from: "3", to: "🟡" },
  { from: "4", to: "🟠" },
  { from: "5", to: "🔴" },
  { from: "6", to: "⚫" },
  { from: "J", to: "✅" },
  { from: "X", to: "❌" },
  { from: "!", to: "⚠️" },
  { from: "A", to: "🔷" },
  { from: "B", to: "🔶" },
];

export const MONITORING_SCORE_ALIASES = ["score", "corrected score"];
export const MONITORING_PERCENT_ALIASES = ["percent", "corrected percent"];
export const MONITORING_STATUS_ALIASES = ["status", "corrected status"];

export const resolveMonitoringPreviewRawDefault = (
  inputFormat: MonitoringInputFormat,
) => {
  if (inputFormat === "ratio") {
    return "59/69";
  }
  if (inputFormat === "numeric-percent") {
    return "86";
  }
  if (inputFormat === "code") {
    return "2";
  }
  if (inputFormat === "short-structured-text-with-number") {
    return "2 Status";
  }
  return "";
};

const DEFAULT_SCOPES: MonitoringRenderScope[] = [
  "monitoring-page",
  "database",
  "properties",
];

const createRuleId = (prefix: string) =>
  `${prefix}-${Math.random().toString(16).slice(2, 10)}`;

export const createMonitoringRenderRule = (
  type: MonitoringRenderRule["type"],
): MonitoringRenderRule => {
  if (type === "value-map") {
    return {
      id: createRuleId("rule"),
      type,
      mappings: [],
      displayMode: "append",
      separator: " ",
    };
  }
  if (type === "ratio-derived-percent") {
    return {
      id: createRuleId("rule"),
      type,
      decimals: 0,
      showBase: true,
      wrapInParentheses: true,
    };
  }
  if (type === "percent-format") {
    return {
      id: createRuleId("rule"),
      type,
      decimals: 0,
      clamp: true,
    };
  }
  if (type === "progress-bar") {
    return {
      id: createRuleId("rule"),
      type,
      min: 0,
      max: 100,
    };
  }
  if (type === "progress-ring") {
    return {
      id: createRuleId("rule"),
      type,
      min: 0,
      max: 100,
    };
  }
  if (type === "threshold-symbol") {
    return {
      id: createRuleId("rule"),
      type,
      thresholds: [],
      appendToText: true,
      separator: " ",
    };
  }
  return {
    id: createRuleId("rule"),
    type: "grouped-label-map",
    groups: [],
    caseSensitive: false,
    replaceText: false,
    separator: " ",
  };
};

export const DEFAULT_MONITORING_RENDER_PROFILES: MonitoringRenderProfile[] = [
  {
    id: "monitoring-score",
    name: "Score",
    attributeAliases: [...MONITORING_SCORE_ALIASES],
    inputFormat: "ratio",
    previewRawValue: resolveMonitoringPreviewRawDefault("ratio"),
    scopes: [...DEFAULT_SCOPES],
    rules: [
      {
        id: "monitoring-score-ratio",
        type: "ratio-derived-percent",
        decimals: 0,
        showBase: true,
        wrapInParentheses: true,
      },
    ],
    enabled: true,
  },
  {
    id: "monitoring-percent",
    name: "Percent",
    attributeAliases: [...MONITORING_PERCENT_ALIASES],
    inputFormat: "numeric-percent",
    previewRawValue: resolveMonitoringPreviewRawDefault("numeric-percent"),
    scopes: [...DEFAULT_SCOPES],
    rules: [
      {
        id: "monitoring-percent-format",
        type: "percent-format",
        decimals: 0,
        clamp: true,
      },
      {
        id: "monitoring-percent-bar",
        type: "progress-bar",
        min: 0,
        max: 100,
      },
    ],
    enabled: true,
  },
  {
    id: "monitoring-status",
    name: "Status",
    attributeAliases: [...MONITORING_STATUS_ALIASES],
    inputFormat: "code",
    previewRawValue: resolveMonitoringPreviewRawDefault("code"),
    scopes: [...DEFAULT_SCOPES],
    rules: [
      {
        id: "monitoring-status-map",
        type: "value-map",
        mappings: DEFAULT_STATUS_MAP,
        caseSensitive: false,
        displayMode: "append",
        separator: " ",
      },
    ],
    enabled: true,
  },
];

const toLower = (value: string) => value.trim().toLowerCase();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const dedupeAliases = (aliases: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  aliases.forEach((alias) => {
    const trimmed = alias.trim();
    const normalized = toLower(trimmed);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(trimmed);
  });
  return next;
};

const cloneDefaultProfiles = () =>
  DEFAULT_MONITORING_RENDER_PROFILES.map((profile) => ({
    ...profile,
    previewRawValue: profile.previewRawValue ?? "",
    attributeAliases: [...profile.attributeAliases],
    scopes: [...profile.scopes],
    rules: profile.rules.map((rule) => {
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
    }),
  }));

const normalizeScopes = (value: unknown): MonitoringRenderScope[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_SCOPES];
  }
  const next: MonitoringRenderScope[] = [];
  value.forEach((entry) => {
    if (
      entry === "monitoring-page" ||
      entry === "database" ||
      entry === "properties"
    ) {
      if (!next.includes(entry)) {
        next.push(entry);
      }
    }
  });
  return next.length > 0 ? next : [...DEFAULT_SCOPES];
};

const normalizeInputFormat = (value: unknown): MonitoringInputFormat => {
  if (
    value === "ratio" ||
    value === "numeric-percent" ||
    value === "code" ||
    value === "text" ||
    value === "short-structured-text-with-number"
  ) {
    return value;
  }
  return "text";
};

const normalizeValueMappings = (value: unknown): MonitoringValueMapEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const from = String(entry.from ?? "").trim();
      const to = String(entry.to ?? "").trim();
      if (!from || !to) {
        return null;
      }
      return { from, to };
    })
    .filter((entry): entry is MonitoringValueMapEntry => Boolean(entry));
};

const normalizeThresholds = (value: unknown): MonitoringThresholdRuleEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const op = String(entry.op ?? "") as MonitoringThresholdOperator;
      if (![">=", ">", "<=", "<", "="].includes(op)) {
        return null;
      }
      const numeric = Number(entry.value ?? Number.NaN);
      const symbol = String(entry.symbol ?? "").trim();
      if (!Number.isFinite(numeric) || !symbol) {
        return null;
      }
      return { op, value: numeric, symbol };
    })
    .filter((entry): entry is MonitoringThresholdRuleEntry => Boolean(entry));
};

const normalizeGroupedMaps = (value: unknown): MonitoringGroupedLabelMapEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const label = String(entry.label ?? "").trim();
      const symbol = entry.symbol === undefined || entry.symbol === null
        ? null
        : String(entry.symbol).trim() || null;
      const values = Array.isArray(entry.values)
        ? entry.values
            .map((item) => String(item ?? "").trim())
            .filter((item) => item.length > 0)
        : [];
      if (!label || values.length === 0) {
        return null;
      }
      return { label, values, symbol };
    })
    .filter((entry): entry is MonitoringGroupedLabelMapEntry => Boolean(entry));
};

const normalizeRule = (value: unknown): MonitoringRenderRule | null => {
  if (!isRecord(value)) {
    return null;
  }
  const type = String(value.type ?? "").trim() as MonitoringRenderRule["type"];
  const id = String(value.id ?? "").trim() || createRuleId("rule");

  if (type === "value-map") {
    return {
      id,
      type,
      mappings: normalizeValueMappings(value.mappings),
      caseSensitive: Boolean(value.caseSensitive),
      displayMode: value.displayMode === "replace" ? "replace" : "append",
      separator: String(value.separator ?? " "),
    };
  }
  if (type === "ratio-derived-percent") {
    const decimals = Number(value.decimals ?? Number.NaN);
    return {
      id,
      type,
      decimals: Number.isFinite(decimals) ? Math.max(0, Math.min(6, Math.floor(decimals))) : 0,
      showBase: value.showBase !== false,
      wrapInParentheses: value.wrapInParentheses !== false,
    };
  }
  if (type === "percent-format") {
    const decimals = Number(value.decimals ?? Number.NaN);
    return {
      id,
      type,
      decimals: Number.isFinite(decimals) ? Math.max(0, Math.min(6, Math.floor(decimals))) : 0,
      clamp: value.clamp !== false,
    };
  }
  if (type === "progress-bar") {
    const min = Number(value.min ?? Number.NaN);
    const max = Number(value.max ?? Number.NaN);
    return {
      id,
      type,
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 100,
    };
  }
  if (type === "progress-ring") {
    const min = Number(value.min ?? Number.NaN);
    const max = Number(value.max ?? Number.NaN);
    return {
      id,
      type,
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 100,
    };
  }
  if (type === "threshold-symbol") {
    return {
      id,
      type,
      thresholds: normalizeThresholds(value.thresholds),
      appendToText: value.appendToText !== false,
      separator: String(value.separator ?? " "),
    };
  }
  if (type === "grouped-label-map") {
    return {
      id,
      type,
      groups: normalizeGroupedMaps(value.groups),
      caseSensitive: Boolean(value.caseSensitive),
      replaceText: Boolean(value.replaceText),
      separator: String(value.separator ?? " "),
    };
  }
  return null;
};

export const normalizeMonitoringRenderProfiles = (
  value: unknown,
): MonitoringRenderProfile[] => {
  if (!Array.isArray(value)) {
    return cloneDefaultProfiles();
  }

  const next = value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const id = String(entry.id ?? "").trim() || createRuleId("profile");
      const name = String(entry.name ?? "").trim() || "Profile";
      const aliases = Array.isArray(entry.attributeAliases)
        ? entry.attributeAliases.map((alias) => String(alias ?? ""))
        : [];
      const inputFormat = normalizeInputFormat(entry.inputFormat);
      const previewRawValue = typeof entry.previewRawValue === "string"
        ? entry.previewRawValue
        : resolveMonitoringPreviewRawDefault(inputFormat);
      const rules = Array.isArray(entry.rules)
        ? entry.rules
            .map((rule) => normalizeRule(rule))
            .filter((rule): rule is MonitoringRenderRule => Boolean(rule))
        : [];
      const profile: MonitoringRenderProfile = {
        id,
        name,
        attributeAliases: dedupeAliases(aliases),
        inputFormat,
        previewRawValue,
        scopes: normalizeScopes(entry.scopes),
        rules,
        enabled: entry.enabled !== false,
      };
      if (profile.attributeAliases.length === 0) {
        return null;
      }
      return profile;
    })
    .filter((entry): entry is MonitoringRenderProfile => Boolean(entry));

  if (next.length === 0) {
    return cloneDefaultProfiles();
  }
  return next;
};

export const resolveMonitoringProfileForAttribute = (
  profiles: MonitoringRenderProfile[],
  attributeKey: string,
) => {
  const normalizedKey = toLower(attributeKey);
  if (!normalizedKey) {
    return null;
  }
  return (
    profiles.find(
      (profile) =>
        profile.enabled !== false &&
        profile.attributeAliases.some((alias) => toLower(alias) === normalizedKey),
    ) ?? null
  );
};

const toRawText = (value: unknown): string => {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "")).join(", ");
  }
  if (isRecord(value) && "raw" in value) {
    return String(value.raw ?? "");
  }
  return String(value);
};

type ParsedValueState = {
  rawText: string;
  textValue: string;
  codeValue: string;
  numericValue: number | null;
  ratioNumerator: number | null;
  ratioDenominator: number | null;
  ratioPercent: number | null;
};

const shortTextPattern = /[-+]?(?:\d+(?:[.,]\d+)?|\.\d+)/g;

const parseRatioParts = (value: unknown) => {
  if (isRecord(value) && typeof value.value === "number" && typeof value.max === "number") {
    const numerator = Number(value.value);
    const denominator = Number(value.max);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return {
        numerator,
        denominator,
        percent: (numerator / denominator) * 100,
      };
    }
  }

  const text = toRawText(value).trim();
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) {
    return null;
  }
  const numerator = Number(match[1] ?? Number.NaN);
  const denominator = Number(match[2] ?? Number.NaN);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return {
    numerator,
    denominator,
    percent: (numerator / denominator) * 100,
  };
};

const parseNumericPercent = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (isRecord(value) && typeof value.value === "number") {
    const numeric = Number(value.value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const text = toRawText(value).trim();
  if (!text) {
    return null;
  }
  const normalized = text.endsWith("%") ? text.slice(0, -1).trim() : text;
  const numeric = Number(normalized.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
};

const parseShortStructuredNumeric = (value: unknown): number | null => {
  const text = toRawText(value).trim();
  if (!text || text.length > 32) {
    return null;
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) {
    return null;
  }
  const matches = text.match(shortTextPattern) ?? [];
  if (matches.length !== 1) {
    return null;
  }
  const parsed = Number(matches[0]!.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseProfileInput = (
  inputFormat: MonitoringInputFormat,
  raw: unknown,
): ParsedValueState => {
  const rawText = toRawText(raw);
  const textValue = rawText.trim();
  const ratio = parseRatioParts(raw);
  const parsedPercent = parseNumericPercent(raw);
  const numericFromShort = parseShortStructuredNumeric(raw);

  let numericValue: number | null = null;
  if (inputFormat === "ratio") {
    numericValue = ratio ? ratio.percent : null;
  } else if (inputFormat === "numeric-percent") {
    numericValue = parsedPercent;
  } else if (inputFormat === "short-structured-text-with-number") {
    numericValue = numericFromShort;
  } else if (inputFormat === "code") {
    const fromCode = Number(textValue.replace(",", "."));
    numericValue = Number.isFinite(fromCode) ? fromCode : null;
  } else {
    numericValue = parsedPercent;
  }

  const codeValue = (() => {
    if (inputFormat === "ratio") {
      return textValue;
    }
    if (textValue) {
      const firstToken = textValue.split(/\s+/)[0] ?? "";
      return firstToken.trim();
    }
    if (typeof raw === "number") {
      return String(raw);
    }
    return "";
  })();

  return {
    rawText,
    textValue,
    codeValue,
    numericValue,
    ratioNumerator: ratio?.numerator ?? null,
    ratioDenominator: ratio?.denominator ?? null,
    ratioPercent: ratio?.percent ?? null,
  };
};

const clampPercent = (value: number, min = 0, max = 100) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (max <= min) {
    return Math.max(0, Math.min(100, value));
  }
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
};

const compareThreshold = (
  left: number,
  op: MonitoringThresholdOperator,
  right: number,
) => {
  if (op === ">=") {
    return left >= right;
  }
  if (op === ">") {
    return left > right;
  }
  if (op === "<=") {
    return left <= right;
  }
  if (op === "<") {
    return left < right;
  }
  return left === right;
};

const formatNumber = (value: number, decimals: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: Math.max(0, decimals),
    maximumFractionDigits: Math.max(0, decimals),
  });

export const resolveMonitoringAliasType = (
  key: string,
): "score" | "percent" | "status" | null => {
  const normalized = toLower(key);
  if (MONITORING_SCORE_ALIASES.some((alias) => alias === normalized)) {
    return "score";
  }
  if (MONITORING_PERCENT_ALIASES.some((alias) => alias === normalized)) {
    return "percent";
  }
  if (MONITORING_STATUS_ALIASES.some((alias) => alias === normalized)) {
    return "status";
  }
  return null;
};

export const renderMonitoringValue = ({
  attributeKey,
  value,
  profiles,
}: {
  attributeKey: string;
  value: unknown;
  profiles: MonitoringRenderProfile[];
}): MonitoringRenderResult | null => {
  const profile = resolveMonitoringProfileForAttribute(profiles, attributeKey);
  if (!profile) {
    return null;
  }

  const parsed = parseProfileInput(profile.inputFormat, value);
  let displayText = parsed.textValue || parsed.rawText.trim();
  let symbol: string | null = null;
  let badge: string | null = null;
  let percentValue: number | null = null;
  let progressBar = false;
  let progressRing = false;

  profile.rules.forEach((rule) => {
    if (rule.type === "value-map") {
      if (!parsed.codeValue && !parsed.textValue) {
        return;
      }
      const sourceValue = parsed.codeValue || parsed.textValue;
      const match = rule.mappings.find((mapping) =>
        rule.caseSensitive
          ? mapping.from === sourceValue
          : toLower(mapping.from) === toLower(sourceValue));
      if (!match) {
        return;
      }
      symbol = match.to;
      if ((rule.displayMode ?? "append") === "replace") {
        displayText = match.to;
      } else {
        const separator = rule.separator ?? " ";
        displayText = `${sourceValue}${separator}${match.to}`.trim();
      }
      return;
    }

    if (rule.type === "ratio-derived-percent") {
      if (parsed.ratioPercent === null) {
        return;
      }
      const decimals = Number.isFinite(rule.decimals ?? Number.NaN)
        ? Math.max(0, Math.min(6, Math.floor(rule.decimals ?? 0)))
        : 0;
      const formattedPercent = `${formatNumber(parsed.ratioPercent, decimals)}%`;
      percentValue = parsed.ratioPercent;
      const baseText =
        rule.showBase !== false &&
        parsed.ratioNumerator !== null &&
        parsed.ratioDenominator !== null
          ? `${formatNumber(parsed.ratioNumerator, 0)}/${formatNumber(parsed.ratioDenominator, 0)}`
          : "";
      if (baseText) {
        displayText = rule.wrapInParentheses === false
          ? `${baseText} ${formattedPercent}`.trim()
          : `${baseText} (${formattedPercent})`;
      } else {
        displayText = formattedPercent;
      }
      return;
    }

    if (rule.type === "percent-format") {
      if (parsed.numericValue === null) {
        return;
      }
      let next = parsed.numericValue;
      if (rule.clamp !== false) {
        next = Math.max(0, Math.min(100, next));
      }
      const decimals = Number.isFinite(rule.decimals ?? Number.NaN)
        ? Math.max(0, Math.min(6, Math.floor(rule.decimals ?? 0)))
        : 0;
      percentValue = next;
      displayText = `${formatNumber(next, decimals)}%`;
      return;
    }

    if (rule.type === "progress-bar") {
      const basis = percentValue ?? parsed.numericValue;
      if (basis === null) {
        return;
      }
      const min = Number.isFinite(rule.min ?? Number.NaN) ? Number(rule.min) : 0;
      const max = Number.isFinite(rule.max ?? Number.NaN) ? Number(rule.max) : 100;
      percentValue = clampPercent(basis, min, max);
      progressBar = true;
      return;
    }

    if (rule.type === "progress-ring") {
      const basis = percentValue ?? parsed.numericValue;
      if (basis === null) {
        return;
      }
      const min = Number.isFinite(rule.min ?? Number.NaN) ? Number(rule.min) : 0;
      const max = Number.isFinite(rule.max ?? Number.NaN) ? Number(rule.max) : 100;
      percentValue = clampPercent(basis, min, max);
      progressRing = true;
      return;
    }

    if (rule.type === "threshold-symbol") {
      const basis = percentValue ?? parsed.numericValue;
      if (basis === null) {
        return;
      }
      const match = rule.thresholds.find((threshold) =>
        compareThreshold(basis, threshold.op, threshold.value));
      if (!match) {
        return;
      }
      badge = match.symbol;
      if (rule.appendToText !== false) {
        displayText = `${displayText}${rule.separator ?? " "}${match.symbol}`.trim();
      }
      return;
    }

    if (rule.type === "grouped-label-map") {
      if (!parsed.textValue) {
        return;
      }
      const matchedGroup = rule.groups.find((group) =>
        group.values.some((entry) =>
          rule.caseSensitive
            ? entry === parsed.textValue
            : toLower(entry) === toLower(parsed.textValue)));
      if (!matchedGroup) {
        return;
      }
      const labelText = matchedGroup.symbol
        ? `${matchedGroup.label}${rule.separator ?? " "}${matchedGroup.symbol}`.trim()
        : matchedGroup.label;
      if (rule.replaceText) {
        displayText = labelText;
      } else {
        displayText = `${displayText}${rule.separator ?? " "}${labelText}`.trim();
      }
      if (matchedGroup.symbol) {
        symbol = matchedGroup.symbol;
      }
    }
  });

  const compactText = (() => {
    if (displayText) {
      return displayText;
    }
    if (parsed.textValue) {
      return parsed.textValue;
    }
    return parsed.rawText.trim();
  })();

  return {
    profileId: profile.id,
    rawText: parsed.rawText,
    displayText: compactText,
    symbol,
    badge,
    percentValue,
    progressBar,
    progressRing,
    compactText,
  };
};
