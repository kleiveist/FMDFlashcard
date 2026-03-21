/**
 * @file apps/fmd-desktop/src/features/preview/database/database-formulas.ts
 *
 * Lightweight evaluator for local database formula fields.
 */

const comparatorOperators = [">=", "<=", "!=", "==", ">", "<", "="] as const;

type FormulaValue = unknown;

export type DatabaseFormulaContext = {
  getFieldValue: (key: string) => unknown;
  now?: () => Date;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return Number.NaN;
    }
    const percentMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (percentMatch?.[1]) {
      const parsedPercent = Number(percentMatch[1]);
      return Number.isFinite(parsedPercent) ? parsedPercent : Number.NaN;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  if (value && typeof value === "object") {
    const candidate = value as { ratio?: unknown; value?: unknown; rank?: unknown };
    if (typeof candidate.ratio === "number" && Number.isFinite(candidate.ratio)) {
      return candidate.ratio * 100;
    }
    if (typeof candidate.value === "number" && Number.isFinite(candidate.value)) {
      return candidate.value;
    }
    if (typeof candidate.rank === "number" && Number.isFinite(candidate.rank)) {
      return candidate.rank;
    }
  }
  return Number.NaN;
};

const toText = (value: unknown): string => {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toText(entry)).join(", ");
  }
  if (typeof value === "object") {
    if ("raw" in (value as Record<string, unknown>)) {
      return String((value as { raw?: unknown }).raw ?? "");
    }
    return JSON.stringify(value);
  }
  return String(value);
};

const isTruthy = (value: unknown) => {
  if (value === null || typeof value === "undefined") {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
};

const isEmpty = (value: unknown) => {
  if (value === null || typeof value === "undefined") {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
};

const isWrappedByParens = (input: string) => {
  if (!input.startsWith("(") || !input.endsWith(")")) {
    return false;
  }
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char as '"' | "'";
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0 && index < input.length - 1) {
        return false;
      }
    }
  }
  return depth === 0;
};

const findTopLevelComparator = (source: string): { operator: (typeof comparatorOperators)[number]; index: number } | null => {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";

    if (quote) {
      if (char === quote && source[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char as '"' | "'";
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth > 0) {
      continue;
    }

    for (const operator of comparatorOperators) {
      if (source.slice(index, index + operator.length) === operator) {
        return { operator, index };
      }
    }
  }

  return null;
};

const splitTopLevelArgs = (source: string) => {
  const args: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (quote) {
      if (char === quote && source[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char as '"' | "'";
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === "," && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  const tail = source.slice(start).trim();
  if (tail) {
    args.push(tail);
  }

  return args;
};

const compareValues = (
  left: unknown,
  right: unknown,
  operator: (typeof comparatorOperators)[number],
) => {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    switch (operator) {
      case ">=":
        return leftNumber >= rightNumber;
      case "<=":
        return leftNumber <= rightNumber;
      case ">":
        return leftNumber > rightNumber;
      case "<":
        return leftNumber < rightNumber;
      case "=":
      case "==":
        return leftNumber === rightNumber;
      case "!=":
        return leftNumber !== rightNumber;
      default:
        return false;
    }
  }

  const leftText = toText(left).trim().toLowerCase();
  const rightText = toText(right).trim().toLowerCase();
  switch (operator) {
    case "=":
    case "==":
      return leftText === rightText;
    case "!=":
      return leftText !== rightText;
    case ">":
      return leftText > rightText;
    case ">=":
      return leftText >= rightText;
    case "<":
      return leftText < rightText;
    case "<=":
      return leftText <= rightText;
    default:
      return false;
  }
};

const evaluateFunction = (
  functionName: string,
  args: FormulaValue[],
  context: DatabaseFormulaContext,
): FormulaValue => {
  const normalizedName = functionName.trim().toLowerCase();

  if (normalizedName === "concat") {
    return args.map((arg) => toText(arg)).join("");
  }

  if (normalizedName === "if") {
    return isTruthy(args[0]) ? (args[1] ?? null) : (args[2] ?? null);
  }

  if (normalizedName === "empty") {
    return isEmpty(args[0]);
  }

  if (normalizedName === "lower") {
    return toText(args[0]).toLowerCase();
  }

  if (normalizedName === "upper") {
    return toText(args[0]).toUpperCase();
  }

  if (normalizedName === "slice") {
    const source = toText(args[0]);
    const start = Math.trunc(toNumber(args[1]));
    const end = Math.trunc(toNumber(args[2]));
    if (!Number.isFinite(start)) {
      return source;
    }
    if (!Number.isFinite(end)) {
      return source.slice(start);
    }
    return source.slice(start, end);
  }

  if (normalizedName === "percent" || normalizedName === "progress") {
    const value = args[0];
    if (value && typeof value === "object" && "ratio" in (value as Record<string, unknown>)) {
      const ratio = Number((value as { ratio?: unknown }).ratio);
      return Number.isFinite(ratio) ? ratio * 100 : null;
    }
    const numeric = toNumber(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (normalizedName === "now") {
    return (context.now?.() ?? new Date()).toISOString();
  }

  if (normalizedName === "datediff") {
    const leftDate = Date.parse(toText(args[0]));
    const rightDate = Date.parse(toText(args[1]));
    if (!Number.isFinite(leftDate) || !Number.isFinite(rightDate)) {
      return null;
    }
    const unit = toText(args[2] ?? "days").toLowerCase();
    const diffMs = leftDate - rightDate;
    if (unit === "hours") {
      return diffMs / (1000 * 60 * 60);
    }
    return diffMs / (1000 * 60 * 60 * 24);
  }

  return null;
};

const evaluateExpressionInternal = (source: string, context: DatabaseFormulaContext): FormulaValue => {
  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  if (isWrappedByParens(trimmed)) {
    return evaluateExpressionInternal(trimmed.slice(1, -1), context);
  }

  const quotedSingle = trimmed.match(/^'(.*)'$/);
  if (quotedSingle) {
    return quotedSingle[1]?.replace(/\\'/g, "'") ?? "";
  }

  const quotedDouble = trimmed.match(/^"(.*)"$/);
  if (quotedDouble) {
    return quotedDouble[1]?.replace(/\\"/g, '"') ?? "";
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true";
  }

  if (/^(null|undefined)$/i.test(trimmed)) {
    return null;
  }

  if (/^[-+]?\d+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const comparator = findTopLevelComparator(trimmed);
  if (comparator) {
    const left = trimmed.slice(0, comparator.index).trim();
    const right = trimmed.slice(comparator.index + comparator.operator.length).trim();
    return compareValues(
      evaluateExpressionInternal(left, context),
      evaluateExpressionInternal(right, context),
      comparator.operator,
    );
  }

  const functionMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/s);
  if (functionMatch?.[1] && typeof functionMatch[2] === "string") {
    const args = splitTopLevelArgs(functionMatch[2]).map((arg) => evaluateExpressionInternal(arg, context));
    return evaluateFunction(functionMatch[1], args, context);
  }

  return context.getFieldValue(trimmed);
};

export const evaluateDatabaseFormula = (
  formula: string,
  context: DatabaseFormulaContext,
): FormulaValue => {
  try {
    return evaluateExpressionInternal(formula, context);
  } catch {
    return null;
  }
};
