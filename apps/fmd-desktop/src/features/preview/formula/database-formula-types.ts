/**
 * @file apps/fmd-desktop/src/features/preview/formula/database-formula-types.ts
 *
 * Shared type system for structured formula attributes (v1).
 */

export type DatabaseFormulaOperation = "avg" | "sum" | "count" | "group_count";

export type DatabaseFormulaSourceType =
  "current-folder" | "explicit-folder" | "multi-folder" | "history";

export type DatabaseFormulaSourceSpec = {
  type: DatabaseFormulaSourceType;
  path?: string;
  paths?: string[];
};

export type DatabaseFormulaShortTextRule = {
  maxChars: number;
  maxTokens: number;
  requireSingleNumericCore: boolean;
};

export type DatabaseFormulaDefinitionV1 = {
  version: 1;
  operation: DatabaseFormulaOperation;
  attributeKeys: string[];
  source: DatabaseFormulaSourceSpec;
  shortTextRule: DatabaseFormulaShortTextRule;
};

export type DatabaseFormulaGroupedCountEntry = {
  value: string;
  count: number;
};

export const DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE: DatabaseFormulaShortTextRule = {
  maxChars: 32,
  maxTokens: 3,
  requireSingleNumericCore: true,
};

export const DEFAULT_DATABASE_FORMULA_SOURCE: DatabaseFormulaSourceSpec = {
  type: "current-folder",
};

export const DEFAULT_DATABASE_FORMULA_OPERATION: DatabaseFormulaOperation = "count";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeSourceType = (value: unknown): DatabaseFormulaSourceType | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "current-folder" ||
    normalized === "explicit-folder" ||
    normalized === "multi-folder" ||
    normalized === "history"
  ) {
    return normalized;
  }
  if (normalized === "history-folder") {
    return "history";
  }
  return null;
};

const normalizeOperation = (value: unknown): DatabaseFormulaOperation | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "avg" ||
    normalized === "sum" ||
    normalized === "count" ||
    normalized === "group_count"
  ) {
    return normalized;
  }
  return null;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

export const normalizeDatabaseFormulaDefinitionV1 = (
  value: unknown,
): DatabaseFormulaDefinitionV1 | null => {
  if (!isRecord(value)) {
    return null;
  }

  const version = value.version;
  if (version !== 1) {
    return null;
  }

  const operation = normalizeOperation(value.operation);
  if (!operation) {
    return null;
  }

  const attributeKeys = normalizeStringArray(value.attributeKeys);
  if (attributeKeys.length === 0) {
    return null;
  }

  if (!isRecord(value.source)) {
    return null;
  }
  const sourceType = normalizeSourceType(value.source.type);
  if (!sourceType) {
    return null;
  }

  const source: DatabaseFormulaSourceSpec = {
    type: sourceType,
  };
  if (sourceType === "explicit-folder") {
    const path = typeof value.source.path === "string" ? value.source.path.trim() : "";
    if (path) {
      source.path = path;
    }
  }
  if (sourceType === "multi-folder") {
    const paths = normalizeStringArray(value.source.paths);
    if (paths.length > 0) {
      source.paths = paths;
    }
  }

  if (!isRecord(value.shortTextRule)) {
    return null;
  }

  const maxChars = Number(value.shortTextRule.maxChars);
  const maxTokens = Number(value.shortTextRule.maxTokens);
  const requireSingleNumericCore = Boolean(value.shortTextRule.requireSingleNumericCore);

  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    return null;
  }
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    return null;
  }

  return {
    version: 1,
    operation,
    attributeKeys,
    source,
    shortTextRule: {
      maxChars,
      maxTokens,
      requireSingleNumericCore,
    },
  };
};

export const isDatabaseFormulaDefinitionV1 = (
  value: unknown,
): value is DatabaseFormulaDefinitionV1 => Boolean(normalizeDatabaseFormulaDefinitionV1(value));

export const buildDefaultDatabaseFormulaDefinitionV1 = (): DatabaseFormulaDefinitionV1 => ({
  version: 1,
  operation: DEFAULT_DATABASE_FORMULA_OPERATION,
  attributeKeys: [],
  source: { ...DEFAULT_DATABASE_FORMULA_SOURCE },
  shortTextRule: { ...DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE },
});
