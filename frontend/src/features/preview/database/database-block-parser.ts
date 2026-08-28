/**
 * @file frontend/src/features/preview/database/database-block-parser.ts
 *
 * Parser/serializer for the standalone markdown database block.
 */

import {
  DATABASE_BLOCK_MARKER,
  isDatabaseBlockMarkerLine,
} from "../../../lib/databaseBlockSyntax";
import {
  type DatabaseBlockConfig,
  type DatabaseFieldDefinition,
  type DatabaseFieldType,
  type DatabaseFilterGroup,
  type DatabaseFilterGroupOp,
  type DatabaseFilterRule,
  type DatabaseAttributeOrigin,
  type DatabaseGanttZoom,
  type DatabasePropertiesByView,
  type DatabaseProjectMissingPlacement,
  type DatabaseProjectBarFillConfig,
  type DatabaseProjectBarFillMapping,
  type DatabaseProjectBarFillMode,
  type DatabasePieColorSpectrum,
  type DatabaseTimelineMode,
  type DatabaseSortRule,
  type DatabaseSourceSpec,
  type DatabaseSourceType,
  type DatabaseSavedViewConfig,
  type DatabaseSavedViewsConfig,
  type DatabaseViewSpec,
  type DatabaseViewType,
} from "./database-types";
import {
  normalizeDatabaseFormulaDefinitionV1,
  type DatabaseFormulaDefinitionV1,
} from "../formula/database-formula-types";

export const DATABASE_BLOCK_OPEN_MARKER = DATABASE_BLOCK_MARKER;
export const DATABASE_BLOCK_CLOSE_MARKER = DATABASE_BLOCK_MARKER;

export type DatabaseBlockParseResult = {
  config: DatabaseBlockConfig;
  errors: string[];
  isClosed: boolean;
};

type ParsedLine = {
  indent: number;
  trimmed: string;
  lineNumber: number;
};

const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, "\n");

const parseSingleQuoted = (value: string) => {
  if (!value.startsWith("'") || !value.endsWith("'")) {
    return null;
  }
  return value.slice(1, -1).replace(/''/g, "'");
};

const parseDoubleQuoted = (value: string) => {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
};

const parseScalar = (rawValue: string): unknown => {
  const value = rawValue.trim();
  if (value.length === 0) {
    return "";
  }
  const singleQuoted = parseSingleQuoted(value);
  if (singleQuoted !== null) {
    return singleQuoted;
  }
  const doubleQuoted = parseDoubleQuoted(value);
  if (doubleQuoted !== null) {
    return doubleQuoted;
  }
  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === "true";
  }
  if (/^(null|~)$/i.test(value)) {
    return null;
  }
  if (/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner
      .split(",")
      .map((part) => parseScalar(part))
      .filter((part) => part !== null)
      .map((part) => String(part));
  }
  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const asOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return undefined;
};

const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const parseFieldType = (value: unknown): DatabaseFieldType => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (normalized) {
    case "text":
    case "longtext":
    case "number":
    case "unit":
    case "percent":
    case "boolean":
    case "time":
    case "date":
    case "datetime":
    case "select":
    case "multiselect":
    case "tags":
    case "link":
    case "file":
    case "image":
    case "status":
    case "rating":
    case "relation":
    case "formula":
    case "duration":
    case "progress":
    case "score":
      return normalized;
    default:
      return "text";
  }
};

const parseAttributeOrigin = (
  value: unknown,
  fallback: DatabaseAttributeOrigin,
): DatabaseAttributeOrigin => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (normalized) {
    case "system":
    case "computed":
    case "formula":
    case "frontmatter":
      return normalized;
    default:
      return fallback;
  }
};

const toParsedLines = (yamlSource: string) =>
  normalizeNewlines(yamlSource)
    .split("\n")
    .map((line, index): ParsedLine => {
      const indentMatch = line.match(/^[ \t]*/);
      return {
        indent: indentMatch ? indentMatch[0].length : 0,
        trimmed: line.trim(),
        lineNumber: index + 1,
      };
    })
    .filter((line) => line.trimmed.length > 0);

const parseYamlSubset = (yamlSource: string) => {
  const errors: string[] = [];
  const lines = toParsedLines(yamlSource);
  let index = 0;

  const parseNode = (expectedIndent: number): unknown => {
    if (index >= lines.length) {
      return null;
    }
    const current = lines[index]!;
    if (current.indent < expectedIndent) {
      return null;
    }
    if (current.indent > expectedIndent) {
      errors.push(
        `Unexpected indent on config line ${current.lineNumber}: expected ${expectedIndent}, got ${current.indent}.`,
      );
      return parseNode(current.indent);
    }
    if (current.trimmed.startsWith("- ")) {
      return parseSequence(expectedIndent);
    }
    return parseMapping(expectedIndent);
  };

  const parseMapping = (expectedIndent: number): Record<string, unknown> => {
    const output: Record<string, unknown> = {};

    while (index < lines.length) {
      const current = lines[index]!;
      if (current.indent < expectedIndent) {
        break;
      }
      if (current.indent > expectedIndent) {
        errors.push(`Unexpected nested mapping line ${current.lineNumber}.`);
        index += 1;
        continue;
      }
      if (current.trimmed.startsWith("- ")) {
        break;
      }

      const colonIndex = current.trimmed.indexOf(":");
      if (colonIndex <= 0) {
        errors.push(`Invalid mapping line ${current.lineNumber}: ${current.trimmed}`);
        index += 1;
        continue;
      }

      const key = current.trimmed.slice(0, colonIndex).trim();
      const tail = current.trimmed.slice(colonIndex + 1).trim();
      index += 1;

      if (!key) {
        continue;
      }

      if (tail.length > 0) {
        output[key] = parseScalar(tail);
        continue;
      }

      const next = lines[index];
      if (next && next.indent > expectedIndent) {
        output[key] = parseNode(next.indent);
      } else {
        output[key] = null;
      }
    }

    return output;
  };

  const parseSequence = (expectedIndent: number): unknown[] => {
    const output: unknown[] = [];

    while (index < lines.length) {
      const current = lines[index]!;
      if (current.indent < expectedIndent) {
        break;
      }
      if (current.indent > expectedIndent) {
        errors.push(`Unexpected nested list line ${current.lineNumber}.`);
        index += 1;
        continue;
      }
      if (!current.trimmed.startsWith("- ")) {
        break;
      }

      const tail = current.trimmed.slice(2).trim();
      index += 1;

      if (tail.length === 0) {
        const nested = lines[index];
        if (nested && nested.indent > expectedIndent) {
          output.push(parseNode(nested.indent));
        } else {
          output.push(null);
        }
        continue;
      }

      const inlineColon = tail.indexOf(":");
      if (inlineColon > 0) {
        const itemKey = tail.slice(0, inlineColon).trim();
        const itemTail = tail.slice(inlineColon + 1).trim();
        const item: Record<string, unknown> = {};

        if (itemTail.length > 0) {
          item[itemKey] = parseScalar(itemTail);
        } else {
          const nested = lines[index];
          item[itemKey] = nested && nested.indent > expectedIndent
            ? parseNode(nested.indent)
            : null;
        }

        const continuationIndent = expectedIndent + 2;
        while (index < lines.length) {
          const nested = lines[index]!;
          if (nested.indent < continuationIndent) {
            break;
          }
          if (nested.indent === expectedIndent && nested.trimmed.startsWith("- ")) {
            break;
          }
          if (nested.indent !== continuationIndent || nested.trimmed.startsWith("- ")) {
            break;
          }
          const continuation = parseMapping(continuationIndent);
          Object.assign(item, continuation);
        }

        output.push(item);
        continue;
      }

      output.push(parseScalar(tail));
    }

    return output;
  };

  if (lines.length === 0) {
    return {
      value: {},
      errors,
    };
  }

  const rootIndent = lines[0]!.indent;
  const value = parseNode(rootIndent);

  return {
    value,
    errors,
  };
};

const dedupeExact = (values: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    next.push(trimmed);
  });
  return next;
};

const createDefaultFilterGroup = (path = "root"): DatabaseFilterGroup => ({
  id: `filter-group-${path}`,
  op: "and",
  rules: [],
});

const parseFilterGroupOp = (value: unknown): DatabaseFilterGroupOp =>
  typeof value === "string" && value.toLowerCase() === "or" ? "or" : "and";

const parseFilterRule = (
  value: unknown,
  groupPath: string,
  ruleIndex: number,
): DatabaseFilterRule | null => {
  if (!isRecord(value)) {
    return null;
  }
  const field = asString(value.field);
  const op = asString(value.op);
  if (!field || !op) {
    return null;
  }
  const rule: DatabaseFilterRule = {
    id: `filter-rule-${groupPath}-${ruleIndex}`,
    field,
    op,
  };
  if ("value" in value) {
    rule.value = value.value;
  }
  if ("valueTo" in value) {
    rule.valueTo = value.valueTo;
  }
  return rule;
};

const parseFilterGroup = (value: unknown, path = "root"): DatabaseFilterGroup => {
  if (Array.isArray(value)) {
    return {
      id: `filter-group-${path}`,
      op: "and",
      rules: value.reduce<Array<DatabaseFilterRule>>((nextRules, entry, index) => {
        const parsed = parseFilterRule(entry, path, index);
        if (parsed) {
          nextRules.push(parsed);
        }
        return nextRules;
      }, []),
    };
  }

  if (!isRecord(value)) {
    return createDefaultFilterGroup(path);
  }

  const rawRules = Array.isArray(value.rules)
    ? value.rules
    : Array.isArray(value.filters)
    ? value.filters
    : [];

  const rules = rawRules
    .map((entry, index) => {
      if (isRecord(entry) && Array.isArray(entry.rules)) {
        return parseFilterGroup(entry, `${path}-${index}`);
      }
      return parseFilterRule(entry, path, index);
    })
    .filter((entry): entry is DatabaseFilterRule | DatabaseFilterGroup => Boolean(entry));

  return {
    id: `filter-group-${path}`,
    op: parseFilterGroupOp(value.op),
    rules,
  };
};

const parseSortRules = (value: unknown): DatabaseSortRule[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<DatabaseSortRule[]>((nextRules, entry, index) => {
      if (!isRecord(entry)) {
        return nextRules;
      }
      const field = asString(entry.field);
      if (!field) {
        return nextRules;
      }
      const dir = asString(entry.dir, "asc").toLowerCase() === "desc" ? "desc" : "asc";
      const nulls = asString(entry.nulls).toLowerCase();
      nextRules.push({
        id: `sort-rule-${index}`,
        field,
        dir,
        nulls: nulls === "first" || nulls === "last" ? nulls : undefined,
        natural: Boolean(entry.natural),
      });
      return nextRules;
    }, []);
};

const parseFieldDefinitions = (value: unknown): DatabaseFieldDefinition[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedupe = new Set<string>();
  const fields: DatabaseFieldDefinition[] = [];

  value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }
    const key = asString(entry.key);
    if (!key) {
      return;
    }
    const dedupeKey = key.trim().toLowerCase();
    if (dedupe.has(dedupeKey)) {
      return;
    }
    dedupe.add(dedupeKey);

    const formulaDefinition = normalizeDatabaseFormulaDefinitionV1(
      entry.formulaDefinition ?? (isRecord(entry.formula) ? entry.formula : null),
    );
    const formula = typeof entry.formula === "string"
      ? asString(entry.formula) || null
      : null;
    const originFallback: DatabaseAttributeOrigin = formulaDefinition || formula
      ? "formula"
      : "frontmatter";
    const origin = parseAttributeOrigin(entry.origin, originFallback);

    fields.push({
      key,
      label: asString(entry.label) || undefined,
      type: parseFieldType(entry.type),
      origin,
      formulaDefinition,
      formula,
    });
  });

  return fields;
};

const parseSourceType = (value: unknown): DatabaseSourceType => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "explicit-folder" ||
    normalized === "multi-folder" ||
    normalized === "history-folder" ||
    normalized === "tag-query" ||
    normalized === "manual-query" ||
    normalized === "linked-files"
  ) {
    return normalized;
  }
  return "current-folder";
};

const parseSourceSpec = (value: unknown): DatabaseSourceSpec => {
  if (typeof value === "string") {
    return {
      type: parseSourceType(value),
    };
  }
  if (!isRecord(value)) {
    return {
      type: "current-folder",
    };
  }
  const type = parseSourceType(value.type);
  const path = asString(value.path);
  const paths = asStringArray(value.paths);
  const includeHistory = asOptionalBoolean(value.includeHistory);
  const tags = asStringArray(value.tags);
  const query = asString(value.query);
  return {
    type,
    ...(path ? { path } : {}),
    ...(paths.length > 0 ? { paths } : {}),
    ...(type === "multi-folder" && typeof includeHistory === "boolean" ? { includeHistory } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(query ? { query } : {}),
  };
};

const parseViewType = (value: unknown): DatabaseViewType => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "kanban" || normalized === "gantt" || normalized === "pie" || normalized === "project") {
    return normalized;
  }
  return "table";
};

const DATABASE_VIEW_TYPES: DatabaseViewType[] = ["table", "kanban", "gantt", "project", "pie"];

const DEFAULT_PROJECT_START_FIELD = "unitsstart";
const DEFAULT_PROJECT_UNIT_FIELD = "units";
const DEFAULT_PROJECT_BLOCK_RESOLUTION = 1;
const DEFAULT_PROJECT_DEFAULT_UNITS = 1;
const DEFAULT_PROJECT_MISSING_PLACEMENT: DatabaseProjectMissingPlacement = "show-unplaced";
const PROJECT_BLOCK_RESOLUTION_OPTIONS = [1, 2, 4] as const;

const dedupeCaseInsensitive = (keys: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  keys.forEach((key) => {
    const normalized = key.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(key.trim());
  });
  return next;
};

const createDefaultPropertiesByView = (tableColumns: string[]): DatabasePropertiesByView => ({
  table: dedupeCaseInsensitive(tableColumns),
  kanban: [],
  gantt: [],
  project: [],
  pie: [],
});

const parsePropertiesByView = (
  value: unknown,
  tableColumns: string[],
): DatabasePropertiesByView => {
  const defaults = createDefaultPropertiesByView(tableColumns);
  if (!isRecord(value)) {
    return defaults;
  }

  const next: DatabasePropertiesByView = { ...defaults };
  DATABASE_VIEW_TYPES.forEach((view) => {
    if (!(view in value)) {
      return;
    }
    next[view] = dedupeCaseInsensitive(asStringArray(value[view]));
  });
  next.table = dedupeCaseInsensitive(next.table ?? tableColumns);
  return next;
};

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string"
    ? Number(value.trim())
    : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Number.isInteger(numeric) && numeric >= 1 ? numeric : fallback;
};

const parseProjectBlockResolution = (value: unknown, fallback = DEFAULT_PROJECT_BLOCK_RESOLUTION) => {
  const parsed = parsePositiveInteger(value, fallback);
  return PROJECT_BLOCK_RESOLUTION_OPTIONS.includes(parsed as typeof PROJECT_BLOCK_RESOLUTION_OPTIONS[number])
    ? parsed
    : fallback;
};

const parseFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseProjectMissingPlacement = (value: unknown): DatabaseProjectMissingPlacement => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "hide-unplaced" ? "hide-unplaced" : "show-unplaced";
};

const parseProjectBarFillMode = (value: unknown): DatabaseProjectBarFillMode => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "text-code" ? "text-code" : "numeric";
};

const normalizeProjectBarFillMappings = (
  value: unknown,
): DatabaseProjectBarFillMapping[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const from = asString(entry.from);
      const to = parseFiniteNumber(entry.to);
      if (!from || to === null) {
        return null;
      }
      return {
        from,
        to,
      };
    })
    .filter((entry): entry is DatabaseProjectBarFillMapping => Boolean(entry));
};

const normalizeProjectBarFillConfigs = (
  value: unknown,
): DatabaseProjectBarFillConfig[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const byRecordId = new Map<string, DatabaseProjectBarFillConfig>();
  value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }
    const recordId = asString(entry.recordId);
    const attributeKey = asString(entry.attributeKey);
    if (!recordId || !attributeKey) {
      return;
    }
    const mode = parseProjectBarFillMode(entry.mode);
    if (mode === "text-code") {
      byRecordId.set(recordId, {
        recordId,
        attributeKey,
        mode,
        mappings: normalizeProjectBarFillMappings(entry.mappings),
      });
      return;
    }
    const min = parseFiniteNumber(entry.min);
    const max = parseFiniteNumber(entry.max);
    const hasValidRange = min !== null && max !== null && max > min;
    byRecordId.set(recordId, {
      recordId,
      attributeKey,
      mode,
      ...(hasValidRange ? { min, max } : {}),
    });
  });
  return Array.from(byRecordId.values());
};

const parseGanttZoom = (value: unknown): DatabaseGanttZoom => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "year" ||
    normalized === "minute" ||
    normalized === "hour" ||
    normalized === "day" ||
    normalized === "week" ||
    normalized === "month" ||
    normalized === "quarter"
  ) {
    return normalized;
  }
  return "month";
};

const parseTimelineMode = (value: unknown): DatabaseTimelineMode => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "time" || normalized === "datetime") {
    return normalized;
  }
  return "date";
};

const parseKanbanOrderByGroup = (value: unknown): Record<string, string[]> => {
  const next: Record<string, string[]> = {};

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!isRecord(entry)) {
        return;
      }
      const group = asString(entry.group);
      if (!group) {
        return;
      }
      const order = dedupeExact(asStringArray(entry.order));
      if (order.length === 0) {
        return;
      }
      next[group] = order;
    });
    return next;
  }

  if (!isRecord(value)) {
    return next;
  }

  Object.entries(value).forEach(([groupRaw, orderRaw]) => {
    const group = groupRaw.trim();
    if (!group) {
      return;
    }
    const order = dedupeExact(asStringArray(orderRaw));
    if (order.length === 0) {
      return;
    }
    next[group] = order;
  });

  return next;
};

const cloneKanbanOrderByGroup = (
  value: Record<string, string[]> | undefined,
): Record<string, string[]> => {
  const next: Record<string, string[]> = {};
  Object.entries(value ?? {}).forEach(([groupRaw, orderRaw]) => {
    const group = groupRaw.trim();
    if (!group) {
      return;
    }
    const order = dedupeExact((orderRaw ?? []).map((entry) => String(entry ?? "")));
    if (order.length === 0) {
      return;
    }
    next[group] = order;
  });
  return next;
};

const parsePieExcludedValues = (value: unknown): string[] =>
  dedupeExact(asStringArray(value));

const parsePieColorSpectrum = (value: unknown): DatabasePieColorSpectrum => {
  const normalized = asString(value, "standard").toLowerCase();
  switch (normalized) {
    case "ocean":
    case "sunset":
    case "forest":
    case "pastel":
    case "standard":
      return normalized;
    default:
      return "standard";
  }
};

const parseKanbanExcludedValues = (value: unknown): string[] =>
  dedupeExact(asStringArray(value));

const parseViewSpec = (value: unknown): DatabaseViewSpec => {
  if (typeof value === "string") {
    return {
      type: parseViewType(value),
      timelineMode: "date",
      timelineBaseDate: null,
      ganttZoom: "month",
      kanbanShowCover: false,
      kanbanOrderByGroup: {},
      kanbanExcludedValues: [],
      projectStartField: DEFAULT_PROJECT_START_FIELD,
      projectUnitField: DEFAULT_PROJECT_UNIT_FIELD,
      blockResolution: DEFAULT_PROJECT_BLOCK_RESOLUTION,
      defaultUnits: DEFAULT_PROJECT_DEFAULT_UNITS,
      projectMissingPlacement: DEFAULT_PROJECT_MISSING_PLACEMENT,
      projectBarFillConfigs: [],
      pieExcludedValues: [],
      pieColorSpectrum: "standard",
    };
  }
  if (!isRecord(value)) {
    return {
      type: "table",
      timelineMode: "date",
      timelineBaseDate: null,
      ganttZoom: "month",
      kanbanShowCover: false,
      kanbanOrderByGroup: {},
      kanbanExcludedValues: [],
      projectStartField: DEFAULT_PROJECT_START_FIELD,
      projectUnitField: DEFAULT_PROJECT_UNIT_FIELD,
      blockResolution: DEFAULT_PROJECT_BLOCK_RESOLUTION,
      defaultUnits: DEFAULT_PROJECT_DEFAULT_UNITS,
      projectMissingPlacement: DEFAULT_PROJECT_MISSING_PLACEMENT,
      projectBarFillConfigs: [],
      pieExcludedValues: [],
      pieColorSpectrum: "standard",
    };
  }
  const type = parseViewType(value.type);
  const pieAggregateRaw = asString(value.pieAggregate, "count").toLowerCase();
  return {
    type,
    groupBy: asString(value.groupBy) || null,
    kanbanShowCover: Boolean(value.kanbanShowCover),
    kanbanOrderByGroup: parseKanbanOrderByGroup(value.kanbanOrderByGroup),
    kanbanExcludedValues: parseKanbanExcludedValues(value.kanbanExcludedValues),
    timelineStartField: asString(value.timelineStartField) || null,
    timelineEndField: asString(value.timelineEndField) || null,
    timelineMode: parseTimelineMode(value.timelineMode),
    timelineBaseDate: asString(value.timelineBaseDate) || null,
    ganttZoom: parseGanttZoom(value.ganttZoom),
    projectStartField: asString(value.projectStartField) || DEFAULT_PROJECT_START_FIELD,
    projectUnitField: asString(value.projectUnitField) || DEFAULT_PROJECT_UNIT_FIELD,
    blockResolution: parseProjectBlockResolution(value.blockResolution),
    defaultUnits: parsePositiveInteger(value.defaultUnits, DEFAULT_PROJECT_DEFAULT_UNITS),
    projectMissingPlacement: parseProjectMissingPlacement(value.projectMissingPlacement),
    projectBarFillConfigs: normalizeProjectBarFillConfigs(value.projectBarFillConfigs),
    pieGroupField: asString(value.pieGroupField) || null,
    pieAggregate:
      pieAggregateRaw === "sum" || pieAggregateRaw === "avg"
        ? pieAggregateRaw
        : "count",
    pieAggregateField: asString(value.pieAggregateField) || null,
    pieExcludedValues: parsePieExcludedValues(value.pieExcludedValues),
    pieColorSpectrum: parsePieColorSpectrum(value.pieColorSpectrum),
  };
};

const cloneFilterGroup = (group: DatabaseFilterGroup): DatabaseFilterGroup => ({
  ...group,
  rules: group.rules.map((entry) =>
    "rules" in entry
      ? cloneFilterGroup(entry)
      : { ...entry }),
});

const cloneSortRules = (rules: DatabaseSortRule[]) => rules.map((rule) => ({ ...rule }));

const cloneProjectBarFillConfigs = (
  configs: DatabaseProjectBarFillConfig[] | undefined,
): DatabaseProjectBarFillConfig[] =>
  (configs ?? []).map((entry) => {
    if (entry.mode === "text-code") {
      return {
        recordId: entry.recordId,
        attributeKey: entry.attributeKey,
        mode: entry.mode,
        mappings: (entry.mappings ?? []).map((mapping) => ({ ...mapping })),
      };
    }
    return {
      recordId: entry.recordId,
      attributeKey: entry.attributeKey,
      mode: entry.mode,
      ...(typeof entry.min === "number" ? { min: entry.min } : {}),
      ...(typeof entry.max === "number" ? { max: entry.max } : {}),
    };
  });

const cloneViewSpec = (view: DatabaseViewSpec): DatabaseViewSpec => ({
  ...view,
  kanbanOrderByGroup: cloneKanbanOrderByGroup(view.kanbanOrderByGroup),
  kanbanExcludedValues: dedupeExact(view.kanbanExcludedValues ?? []),
  projectBarFillConfigs: cloneProjectBarFillConfigs(view.projectBarFillConfigs),
  pieExcludedValues: dedupeExact(view.pieExcludedValues ?? []),
  pieColorSpectrum: parsePieColorSpectrum(view.pieColorSpectrum),
});

const cloneSavedViewConfig = (view: DatabaseSavedViewConfig): DatabaseSavedViewConfig => ({
  ...view,
  view: cloneViewSpec(view.view),
  properties: dedupeCaseInsensitive(view.properties),
  filters: cloneFilterGroup(view.filters),
  sort: cloneSortRules(view.sort),
});

const cloneSavedViewsConfig = (views: DatabaseSavedViewsConfig): DatabaseSavedViewsConfig => ({
  activeViewId: views.activeViewId,
  items: views.items.map((item) => cloneSavedViewConfig(item)),
});

const createLegacyPropertiesMirror = (properties: string[]): DatabasePropertiesByView => {
  const normalized = dedupeCaseInsensitive(properties);
  return {
    table: [...normalized],
    kanban: [...normalized],
    gantt: [...normalized],
    project: [...normalized],
    pie: [...normalized],
  };
};

const resolveSavedViewForId = (
  views: DatabaseSavedViewsConfig,
  preferredId: string | null | undefined,
): DatabaseSavedViewConfig => {
  if (preferredId) {
    const match = views.items.find((item) => item.id === preferredId);
    if (match) {
      return match;
    }
  }
  return views.items[0]!;
};

const createGeneratedSavedViewId = (index: number) => `view-generated-${index + 1}`;

const normalizeSavedViewId = (
  preferredId: string,
  fallbackIndex: number,
  seenIds: Set<string>,
) => {
  const base = preferredId.trim() || createGeneratedSavedViewId(fallbackIndex);
  if (!seenIds.has(base)) {
    seenIds.add(base);
    return base;
  }
  let sequence = 2;
  let candidate = `${base}-${sequence}`;
  while (seenIds.has(candidate)) {
    sequence += 1;
    candidate = `${base}-${sequence}`;
  }
  seenIds.add(candidate);
  return candidate;
};

const createMigratedSavedViews = (legacy: {
  name: string;
  view: DatabaseViewSpec;
  properties: string[];
  filters: DatabaseFilterGroup;
  sort: DatabaseSortRule[];
}): DatabaseSavedViewsConfig => {
  const id = "view-migrated-1";
  const migrated: DatabaseSavedViewConfig = {
    id,
    name: legacy.name,
    view: cloneViewSpec(legacy.view),
    properties: dedupeCaseInsensitive(legacy.properties),
    filters: cloneFilterGroup(legacy.filters),
    sort: cloneSortRules(legacy.sort),
  };
  return {
    activeViewId: id,
    items: [migrated],
  };
};

const parseSavedViews = (
  value: unknown,
  legacy: {
    name: string;
    view: DatabaseViewSpec;
    properties: string[];
    filters: DatabaseFilterGroup;
    sort: DatabaseSortRule[];
  },
): DatabaseSavedViewsConfig => {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return createMigratedSavedViews(legacy);
  }

  const parsedItems = value.items
    .map((entry, index): DatabaseSavedViewConfig | null => {
      if (!isRecord(entry)) {
        return null;
      }
      const parsedView = parseViewSpec(entry.view ?? legacy.view);
      const explicitProperties = dedupeCaseInsensitive(asStringArray(entry.properties));
      const fallbackPropertiesByView = parsePropertiesByView(
        entry.propertiesByView,
        legacy.properties,
      );
      const scopedFallback = dedupeCaseInsensitive(fallbackPropertiesByView[parsedView.type] ?? []);
      const fallbackProperties = scopedFallback.length > 0
        ? scopedFallback
        : dedupeCaseInsensitive(legacy.properties);
      const properties = explicitProperties.length > 0 ? explicitProperties : fallbackProperties;

      const parsedSort = parseSortRules("sort" in entry ? entry.sort : legacy.sort);
      const parsedFilters = parseFilterGroup("filters" in entry ? entry.filters : legacy.filters);

      return {
        id: asString(entry.id) || createGeneratedSavedViewId(index),
        name: asString(entry.name) || `View ${index + 1}`,
        view: parsedView,
        properties,
        filters: parsedFilters,
        sort: parsedSort,
      };
    })
    .filter((entry): entry is DatabaseSavedViewConfig => Boolean(entry));

  if (parsedItems.length === 0) {
    return createMigratedSavedViews(legacy);
  }

  const seenIds = new Set<string>();
  const normalizedItems = parsedItems.map((item, index) => {
    const id = normalizeSavedViewId(item.id, index, seenIds);
    return {
      ...item,
      id,
      name: item.name.trim() || "View",
      properties: dedupeCaseInsensitive(item.properties),
      filters: cloneFilterGroup(item.filters),
      sort: cloneSortRules(item.sort),
      view: cloneViewSpec(item.view),
    };
  });

  const activeViewId = asString(value.activeViewId);
  const hasActive = normalizedItems.some((item) => item.id === activeViewId);

  return {
    activeViewId: hasActive ? activeViewId : normalizedItems[0]!.id,
    items: normalizedItems,
  };
};

export const createDefaultDatabaseBlockConfig = (): DatabaseBlockConfig => {
  const defaultView = parseViewSpec({
    type: "table",
    kanbanShowCover: false,
    timelineMode: "date",
    timelineBaseDate: null,
    ganttZoom: "month",
    projectStartField: DEFAULT_PROJECT_START_FIELD,
    projectUnitField: DEFAULT_PROJECT_UNIT_FIELD,
    blockResolution: DEFAULT_PROJECT_BLOCK_RESOLUTION,
    defaultUnits: DEFAULT_PROJECT_DEFAULT_UNITS,
    projectMissingPlacement: DEFAULT_PROJECT_MISSING_PLACEMENT,
  });
  const defaultProperties = [
    "Dateiname",
    "Dateipfad",
  ];
  const defaultFilters = createDefaultFilterGroup();
  const defaultSort: DatabaseSortRule[] = [];
  const defaultSavedViewId = "view-default";
  const views: DatabaseSavedViewsConfig = {
    activeViewId: defaultSavedViewId,
    items: [
      {
        id: defaultSavedViewId,
        name: "Database",
        view: cloneViewSpec(defaultView),
        properties: [...defaultProperties],
        filters: cloneFilterGroup(defaultFilters),
        sort: cloneSortRules(defaultSort),
      },
    ],
  };

  return {
    title: "Database",
    source: {
      type: "current-folder",
    },
    view: cloneViewSpec(defaultView),
    fields: [],
    columns: [...defaultProperties],
    propertiesByView: createLegacyPropertiesMirror(defaultProperties),
    filters: cloneFilterGroup(defaultFilters),
    sort: cloneSortRules(defaultSort),
    options: {
      editable: false,
      showSearch: true,
      showToolbar: true,
    },
    views,
  };
};

const parseOptions = (value: unknown) => {
  if (!isRecord(value)) {
    return {
      editable: false,
      showSearch: true,
      showToolbar: true,
    };
  }
  return {
    editable: Boolean(value.editable),
    showSearch: "showSearch" in value ? Boolean(value.showSearch) : true,
    showToolbar: "showToolbar" in value ? Boolean(value.showToolbar) : true,
  };
};

const parseConfigObject = (value: unknown): DatabaseBlockConfig => {
  const defaults = createDefaultDatabaseBlockConfig();
  const record = isRecord(value) ? value : {};
  const hasExplicitColumns = Array.isArray(record.columns);
  const parsedColumns = hasExplicitColumns
    ? dedupeCaseInsensitive(asStringArray(record.columns))
    : dedupeCaseInsensitive(defaults.columns);
  const legacyView = parseViewSpec(record.view);
  const legacyPropertiesByView = parsePropertiesByView(record.propertiesByView, parsedColumns);
  const scopedLegacyProperties = dedupeCaseInsensitive(legacyPropertiesByView[legacyView.type] ?? []);
  const legacyViewProperties = scopedLegacyProperties.length > 0
    ? scopedLegacyProperties
    : parsedColumns;
  const legacyColumns = legacyViewProperties.length > 0 ? legacyViewProperties : parsedColumns;
  const legacyFilters = parseFilterGroup(record.filters);
  const legacySort = parseSortRules(record.sort);
  const legacyName = asString(record.title, defaults.title);
  const parsedViews = parseSavedViews(record.views, {
    name: legacyName,
    view: legacyView,
    properties: legacyColumns,
    filters: legacyFilters,
    sort: legacySort,
  });
  const activeSavedView = resolveSavedViewForId(parsedViews, parsedViews.activeViewId);
  const activeProperties = dedupeCaseInsensitive(activeSavedView.properties);
  const activeFilters = cloneFilterGroup(activeSavedView.filters);
  const activeSort = cloneSortRules(activeSavedView.sort);

  return {
    title: activeSavedView.name,
    source: parseSourceSpec(record.source),
    view: cloneViewSpec(activeSavedView.view),
    fields: parseFieldDefinitions(record.fields),
    columns: activeProperties,
    propertiesByView: createLegacyPropertiesMirror(activeProperties),
    filters: activeFilters,
    sort: activeSort,
    options: parseOptions(record.options),
    views: cloneSavedViewsConfig(parsedViews),
  };
};

const escapeYamlString = (value: string) => {
  if (value.length === 0) {
    return "''";
  }
  if (/^[A-Za-z0-9_./-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "''")}'`;
};

const formatYamlScalar = (value: unknown) => {
  if (typeof value === "string") {
    return escapeYamlString(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (value === null || typeof value === "undefined") {
    return "null";
  }
  return escapeYamlString(String(value));
};

function writeFilterGroupYaml(
  group: DatabaseFilterGroup,
  indent: number,
  lines: string[],
) {
  const indentText = " ".repeat(indent);
  lines.push(`${indentText}op: ${group.op}`);
  if (group.rules.length === 0) {
    lines.push(`${indentText}rules: []`);
    return;
  }
  lines.push(`${indentText}rules:`);
  writeFilterGroupRulesYaml(group.rules, indent + 2, lines);
}

function writeFilterGroupRulesYaml(
  rules: DatabaseFilterGroup["rules"],
  indent: number,
  lines: string[],
) {
  const indentText = " ".repeat(indent);
  for (const rule of rules) {
    if ("rules" in rule) {
      lines.push(`${indentText}- op: ${rule.op}`);
      if (rule.rules.length === 0) {
        lines.push(`${indentText}  rules: []`);
      } else {
        lines.push(`${indentText}  rules:`);
        writeFilterGroupRulesYaml(rule.rules, indent + 4, lines);
      }
      continue;
    }

    lines.push(`${indentText}- field: ${formatYamlScalar(rule.field)}`);
    lines.push(`${indentText}  op: ${formatYamlScalar(rule.op)}`);
    if (typeof rule.value !== "undefined") {
      lines.push(`${indentText}  value: ${formatYamlScalar(rule.value)}`);
    }
    if (typeof rule.valueTo !== "undefined") {
      lines.push(`${indentText}  valueTo: ${formatYamlScalar(rule.valueTo)}`);
    }
  }
}

function writeSortRulesYaml(
  rules: DatabaseSortRule[],
  indent: number,
  lines: string[],
) {
  const indentText = " ".repeat(indent);
  if (rules.length === 0) {
    lines.push(`${indentText}sort: []`);
    return;
  }
  lines.push(`${indentText}sort:`);
  rules.forEach((sortRule) => {
    lines.push(`${indentText}  - field: ${formatYamlScalar(sortRule.field)}`);
    lines.push(`${indentText}    dir: ${formatYamlScalar(sortRule.dir)}`);
    if (sortRule.nulls) {
      lines.push(`${indentText}    nulls: ${formatYamlScalar(sortRule.nulls)}`);
    }
    if (sortRule.natural) {
      lines.push(`${indentText}    natural: true`);
    }
  });
}

function writeProjectBarFillConfigsYaml(
  configs: DatabaseProjectBarFillConfig[],
  indent: number,
  lines: string[],
) {
  const indentText = " ".repeat(indent);
  if (configs.length === 0) {
    return;
  }
  lines.push(`${indentText}projectBarFillConfigs:`);
  configs.forEach((config) => {
    lines.push(`${indentText}  - recordId: ${formatYamlScalar(config.recordId)}`);
    lines.push(`${indentText}    attributeKey: ${formatYamlScalar(config.attributeKey)}`);
    lines.push(`${indentText}    mode: ${formatYamlScalar(config.mode)}`);
    if (config.mode === "text-code") {
      const mappings = normalizeProjectBarFillMappings(config.mappings);
      if (mappings.length === 0) {
        lines.push(`${indentText}    mappings: []`);
      } else {
        lines.push(`${indentText}    mappings:`);
        mappings.forEach((mapping) => {
          lines.push(`${indentText}      - from: ${formatYamlScalar(mapping.from)}`);
          lines.push(`${indentText}        to: ${formatYamlScalar(mapping.to)}`);
        });
      }
      return;
    }
    if (typeof config.min === "number" && Number.isFinite(config.min)) {
      lines.push(`${indentText}    min: ${formatYamlScalar(config.min)}`);
    }
    if (typeof config.max === "number" && Number.isFinite(config.max)) {
      lines.push(`${indentText}    max: ${formatYamlScalar(config.max)}`);
    }
  });
}

function writeViewSpecYaml(
  view: DatabaseViewSpec,
  indent: number,
  lines: string[],
) {
  const indentText = " ".repeat(indent);
  const kanbanOrderByGroup = cloneKanbanOrderByGroup(view.kanbanOrderByGroup);
  lines.push(`${indentText}type: ${formatYamlScalar(view.type)}`);
  if (view.groupBy) {
    lines.push(`${indentText}groupBy: ${formatYamlScalar(view.groupBy)}`);
  }
  if (view.kanbanShowCover) {
    lines.push(`${indentText}kanbanShowCover: ${formatYamlScalar(view.kanbanShowCover)}`);
  }
  const kanbanExcludedValues = dedupeExact(view.kanbanExcludedValues ?? []);
  if (kanbanExcludedValues.length > 0) {
    lines.push(`${indentText}kanbanExcludedValues:`);
    kanbanExcludedValues.forEach((value) => {
      lines.push(`${indentText}  - ${formatYamlScalar(value)}`);
    });
  }
  const kanbanOrderEntries = Object.entries(kanbanOrderByGroup);
  if (kanbanOrderEntries.length > 0) {
    lines.push(`${indentText}kanbanOrderByGroup:`);
    kanbanOrderEntries.forEach(([group, order]) => {
      lines.push(`${indentText}  - group: ${formatYamlScalar(group)}`);
      if (order.length === 0) {
        lines.push(`${indentText}    order: []`);
        return;
      }
      lines.push(`${indentText}    order:`);
      order.forEach((recordId) => {
        lines.push(`${indentText}      - ${formatYamlScalar(recordId)}`);
      });
    });
  }
  if (view.timelineStartField) {
    lines.push(`${indentText}timelineStartField: ${formatYamlScalar(view.timelineStartField)}`);
  }
  if (view.timelineEndField) {
    lines.push(`${indentText}timelineEndField: ${formatYamlScalar(view.timelineEndField)}`);
  }
  if (view.timelineMode) {
    lines.push(`${indentText}timelineMode: ${formatYamlScalar(view.timelineMode)}`);
  }
  if (view.timelineBaseDate) {
    lines.push(`${indentText}timelineBaseDate: ${formatYamlScalar(view.timelineBaseDate)}`);
  }
  if (view.ganttZoom) {
    lines.push(`${indentText}ganttZoom: ${formatYamlScalar(view.ganttZoom)}`);
  }
  if (
    view.projectStartField &&
    (view.type === "project" || view.projectStartField !== DEFAULT_PROJECT_START_FIELD)
  ) {
    lines.push(`${indentText}projectStartField: ${formatYamlScalar(view.projectStartField)}`);
  }
  if (
    view.projectUnitField &&
    (view.type === "project" || view.projectUnitField !== DEFAULT_PROJECT_UNIT_FIELD)
  ) {
    lines.push(`${indentText}projectUnitField: ${formatYamlScalar(view.projectUnitField)}`);
  }
  if (
    typeof view.blockResolution === "number" &&
    Number.isFinite(view.blockResolution) &&
    (view.type === "project" || view.blockResolution !== DEFAULT_PROJECT_BLOCK_RESOLUTION)
  ) {
    lines.push(`${indentText}blockResolution: ${formatYamlScalar(view.blockResolution)}`);
  }
  if (
    typeof view.defaultUnits === "number" &&
    Number.isFinite(view.defaultUnits) &&
    (view.type === "project" || view.defaultUnits !== DEFAULT_PROJECT_DEFAULT_UNITS)
  ) {
    lines.push(`${indentText}defaultUnits: ${formatYamlScalar(view.defaultUnits)}`);
  }
  if (
    view.projectMissingPlacement &&
    (view.type === "project" || view.projectMissingPlacement !== DEFAULT_PROJECT_MISSING_PLACEMENT)
  ) {
    lines.push(`${indentText}projectMissingPlacement: ${formatYamlScalar(view.projectMissingPlacement)}`);
  }
  writeProjectBarFillConfigsYaml(
    normalizeProjectBarFillConfigs(view.projectBarFillConfigs),
    indent,
    lines,
  );
  if (view.pieGroupField) {
    lines.push(`${indentText}pieGroupField: ${formatYamlScalar(view.pieGroupField)}`);
  }
  if (view.pieAggregate) {
    lines.push(`${indentText}pieAggregate: ${formatYamlScalar(view.pieAggregate)}`);
  }
  if (view.pieAggregateField) {
    lines.push(`${indentText}pieAggregateField: ${formatYamlScalar(view.pieAggregateField)}`);
  }
  const pieExcludedValues = dedupeExact(view.pieExcludedValues ?? []);
  if (pieExcludedValues.length > 0) {
    lines.push(`${indentText}pieExcludedValues:`);
    pieExcludedValues.forEach((value) => {
      lines.push(`${indentText}  - ${formatYamlScalar(value)}`);
    });
  }
  if (view.pieColorSpectrum && view.pieColorSpectrum !== "standard") {
    lines.push(`${indentText}pieColorSpectrum: ${formatYamlScalar(view.pieColorSpectrum)}`);
  }
}

const writeFormulaDefinitionYaml = (
  definition: DatabaseFormulaDefinitionV1,
  indent: number,
  lines: string[],
) => {
  const indentText = " ".repeat(indent);
  lines.push(`${indentText}version: ${formatYamlScalar(definition.version)}`);
  lines.push(`${indentText}operation: ${formatYamlScalar(definition.operation)}`);
  if (definition.attributeKeys.length === 0) {
    lines.push(`${indentText}attributeKeys: []`);
  } else {
    lines.push(`${indentText}attributeKeys:`);
    definition.attributeKeys.forEach((key) => {
      lines.push(`${indentText}  - ${formatYamlScalar(key)}`);
    });
  }
  lines.push(`${indentText}source:`);
  lines.push(`${indentText}  type: ${formatYamlScalar(definition.source.type)}`);
  if (definition.source.path) {
    lines.push(`${indentText}  path: ${formatYamlScalar(definition.source.path)}`);
  }
  if (definition.source.paths && definition.source.paths.length > 0) {
    lines.push(`${indentText}  paths:`);
    definition.source.paths.forEach((path) => {
      lines.push(`${indentText}    - ${formatYamlScalar(path)}`);
    });
  }
  lines.push(`${indentText}shortTextRule:`);
  lines.push(`${indentText}  maxChars: ${formatYamlScalar(definition.shortTextRule.maxChars)}`);
  lines.push(`${indentText}  maxTokens: ${formatYamlScalar(definition.shortTextRule.maxTokens)}`);
  lines.push(
    `${indentText}  requireSingleNumericCore: ${formatYamlScalar(definition.shortTextRule.requireSingleNumericCore)}`,
  );
};

export const serializeDatabaseBlockConfig = (config: DatabaseBlockConfig) => {
  const normalizedViews = cloneSavedViewsConfig(config.views);
  const activeSavedView = resolveSavedViewForId(normalizedViews, normalizedViews.activeViewId);
  const lines: string[] = [];
  lines.push(DATABASE_BLOCK_OPEN_MARKER);
  lines.push(`title: ${formatYamlScalar(activeSavedView.name || config.title)}`);
  lines.push("source:");
  lines.push(`  type: ${formatYamlScalar(config.source.type)}`);
  if (config.source.path) {
    lines.push(`  path: ${formatYamlScalar(config.source.path)}`);
  }
  if (config.source.paths && config.source.paths.length > 0) {
    lines.push("  paths:");
    config.source.paths.forEach((path) => {
      lines.push(`    - ${formatYamlScalar(path)}`);
    });
  }
  if (config.source.type === "multi-folder" && config.source.includeHistory === true) {
    lines.push("  includeHistory: true");
  }
  if (config.source.tags && config.source.tags.length > 0) {
    lines.push("  tags:");
    config.source.tags.forEach((tag) => {
      lines.push(`    - ${formatYamlScalar(tag)}`);
    });
  }
  if (config.source.query) {
    lines.push(`  query: ${formatYamlScalar(config.source.query)}`);
  }

  const fields = config.fields ?? [];
  if (fields.length === 0) {
    lines.push("fields: []");
  } else {
    lines.push("fields:");
    fields.forEach((field) => {
      lines.push(`  - key: ${formatYamlScalar(field.key)}`);
      if (field.label) {
        lines.push(`    label: ${formatYamlScalar(field.label)}`);
      }
      lines.push(`    type: ${formatYamlScalar(field.type)}`);
      lines.push(`    origin: ${formatYamlScalar(field.origin)}`);
      if (field.formulaDefinition) {
        lines.push("    formulaDefinition:");
        writeFormulaDefinitionYaml(field.formulaDefinition, 6, lines);
      } else if (field.formula) {
        lines.push(`    formula: ${formatYamlScalar(field.formula)}`);
      }
    });
  }

  lines.push("views:");
  lines.push(`  activeViewId: ${formatYamlScalar(normalizedViews.activeViewId)}`);
  if (normalizedViews.items.length === 0) {
    lines.push("  items: []");
  } else {
    lines.push("  items:");
    normalizedViews.items.forEach((item) => {
      const normalizedProperties = dedupeCaseInsensitive(item.properties);
      lines.push(`    - id: ${formatYamlScalar(item.id)}`);
      lines.push(`      name: ${formatYamlScalar(item.name)}`);
      lines.push("      view:");
      writeViewSpecYaml(item.view, 8, lines);
      if (normalizedProperties.length === 0) {
        lines.push("      properties: []");
      } else {
        lines.push("      properties:");
        normalizedProperties.forEach((property) => {
          lines.push(`        - ${formatYamlScalar(property)}`);
        });
      }
      lines.push("      filters:");
      writeFilterGroupYaml(item.filters, 8, lines);
      writeSortRulesYaml(item.sort, 6, lines);
    });
  }

  lines.push("options:");
  lines.push(`  editable: ${formatYamlScalar(config.options.editable)}`);
  lines.push(`  showSearch: ${formatYamlScalar(config.options.showSearch)}`);
  lines.push(`  showToolbar: ${formatYamlScalar(config.options.showToolbar)}`);
  lines.push(DATABASE_BLOCK_CLOSE_MARKER);

  return lines.join("\n");
};

export const parseDatabaseBlockConfigFromRaw = (blockRaw: string): DatabaseBlockParseResult => {
  const defaults = createDefaultDatabaseBlockConfig();
  const normalizedRaw = normalizeNewlines(blockRaw);
  const lines = normalizedRaw.split("\n");
  const errors: string[] = [];

  if (lines.length === 0 || !isDatabaseBlockMarkerLine(lines[0] ?? "")) {
    return {
      config: defaults,
      errors: ["Database block must start with a standalone :::: marker."],
      isClosed: false,
    };
  }

  let closingLineIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (isDatabaseBlockMarkerLine(lines[index] ?? "")) {
      closingLineIndex = index;
      break;
    }
  }

  const isClosed = closingLineIndex >= 0;
  if (!isClosed) {
    errors.push("Database block is missing the closing :::: marker.");
  }

  const bodyLines = lines.slice(1, isClosed ? closingLineIndex : lines.length);
  const bodySource = bodyLines.join("\n").trim();
  if (!bodySource) {
    return {
      config: defaults,
      errors,
      isClosed,
    };
  }

  const parsedYaml = parseYamlSubset(bodySource);
  errors.push(...parsedYaml.errors);

  return {
    config: parseConfigObject(parsedYaml.value),
    errors,
    isClosed,
  };
};
