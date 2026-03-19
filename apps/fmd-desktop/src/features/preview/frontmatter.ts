/**
 * @file apps/fmd-desktop/src/features/preview/frontmatter.ts
 *
 * Zweck:
 * - Erkennung, Parsing und Serialisierung von YAML-Frontmatter
 *   fuer das Markdown-Preview-Properties-Panel.
 */

export type FrontmatterPropertyKind =
  | "text"
  | "task"
  | "number"
  | "boolean"
  | "tags"
  | "link"
  | "cover"
  | "unknown";

export type FrontmatterPropertyIcon =
  | "text"
  | "task"
  | "number"
  | "boolean"
  | "tags"
  | "link"
  | "cover"
  | "unknown";

export type FrontmatterPropertyValue = string | number | boolean | string[] | null;

export type FrontmatterProperty = {
  key: string;
  kind: FrontmatterPropertyKind;
  value: FrontmatterPropertyValue;
  icon: FrontmatterPropertyIcon;
};

export type FrontmatterDocument = {
  hasFrontmatter: boolean;
  error: string | null;
  body: string;
  bodyStartOffset: number;
  lineEnding: "\n" | "\r\n";
  properties: FrontmatterProperty[];
};

export type FrontmatterLinksLayout = "link-keys" | "links-array";

export type FrontmatterLinksDocument = {
  hasFrontmatter: boolean;
  error: string | null;
  links: string[];
  layout: FrontmatterLinksLayout;
};

export type FrontmatterSuggestionIndex = {
  keyIndex: Record<string, number>;
  valueIndex: Record<string, Record<string, number>>;
};

type FrontmatterSchemaEntry = {
  kind?: FrontmatterPropertyKind;
  icon?: FrontmatterPropertyIcon;
};

type ScalarValue = string | number | boolean | null;

type ParsedYamlValue =
  | { type: "scalar"; value: ScalarValue }
  | { type: "string-array"; value: string[] }
  | { type: "unknown"; rawValue: string };

type ParsedFrontmatterProperty = FrontmatterProperty & {
  rawLines: string[];
  preserveRaw: boolean;
  hidden?: boolean;
};

type ParsedFrontmatterDocumentInternal = FrontmatterDocument & {
  frontmatterPrefix: string;
  parsedProperties: ParsedFrontmatterProperty[];
};

const FRONTMATTER_PATTERN =
  /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|svg)$/i;
const LINK_KEY_PATTERN = /^link\d+$/i;

const PROPERTY_SCHEMA: Record<string, FrontmatterSchemaEntry> = {
  task: { kind: "task", icon: "task" },
  tags: { kind: "tags", icon: "tags" },
  tag: { kind: "tags", icon: "tags" },
  cover: { kind: "cover", icon: "cover" },
  image: { kind: "cover", icon: "cover" },
  thumbnail: { kind: "cover", icon: "cover" },
};

const asMarkdownString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const detectLineEnding = (value: string | null | undefined): "\n" | "\r\n" =>
  typeof value === "string" && value.includes("\r\n") ? "\r\n" : "\n";

const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, "\n");

const stripIndent = (line: string, amount: number) => {
  if (amount <= 0) {
    return line;
  }
  let index = 0;
  let consumed = 0;
  while (
    index < line.length &&
    consumed < amount &&
    (line[index] === " " || line[index] === "\t")
  ) {
    index += 1;
    consumed += 1;
  }
  return line.slice(index);
};

const parseSingleQuoted = (value: string): string | null => {
  if (!value.startsWith("'") || !value.endsWith("'")) {
    return null;
  }
  return value.slice(1, -1).replace(/''/g, "'");
};

const parseDoubleQuoted = (value: string): string | null => {
  if (!value.startsWith("\"") || !value.endsWith("\"")) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
};

const numberPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

const parseScalar = (rawValue: string): ScalarValue => {
  const value = rawValue.trim();
  if (value === "") {
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
  if (numberPattern.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return value;
};

const parseFlowStringArray = (rawValue: string): string[] | null => {
  const trimmed = rawValue.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  if (inner.trim() === "") {
    return [];
  }

  const tokens: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index] ?? "";
    if (quote === "\"") {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      current += char;
      if (char === "'") {
        quote = null;
      }
      continue;
    }

    if (char === ",") {
      tokens.push(current.trim());
      current = "";
      continue;
    }
    current += char;
    if (char === "\"" || char === "'") {
      quote = char;
    }
  }
  if (quote) {
    return null;
  }
  tokens.push(current.trim());

  const parsedItems: string[] = [];
  for (const token of tokens) {
    if (token === "") {
      return null;
    }
    const scalar = parseScalar(token);
    if (typeof scalar !== "string") {
      return null;
    }
    parsedItems.push(scalar);
  }
  return parsedItems;
};

const parseBlockValue = (lines: string[]): ParsedYamlValue => {
  const nonEmptyLines = lines.filter((line) => line.trim() !== "");
  if (nonEmptyLines.length === 0) {
    return { type: "scalar", value: null };
  }

  const indentLevels = nonEmptyLines.map((line) => {
    const match = line.match(/^[ \t]*/);
    return match ? match[0].length : 0;
  });
  const minIndent = Math.min(...indentLevels);
  const normalizedLines = lines.map((line) => stripIndent(line, minIndent));
  const normalizedNonEmpty = normalizedLines.filter((line) => line.trim() !== "");

  const isList = normalizedNonEmpty.every((line) => /^-\s*/.test(line));
  if (!isList) {
    return { type: "unknown", rawValue: normalizedLines.join("\n").trim() };
  }

  const values: string[] = [];
  for (const line of normalizedNonEmpty) {
    const itemSource = line.replace(/^-\s*/, "");
    const parsedItem = parseScalar(itemSource);
    if (typeof parsedItem !== "string") {
      return { type: "unknown", rawValue: normalizedLines.join("\n").trim() };
    }
    values.push(parsedItem);
  }
  return { type: "string-array", value: values };
};

const parsePropertyValue = (tail: string, continuationLines: string[]): ParsedYamlValue => {
  const normalizedTail = tail.trim();
  if (continuationLines.length > 0) {
    if (normalizedTail === "") {
      return parseBlockValue(continuationLines);
    }
    const rawValue = [normalizedTail, ...continuationLines].join("\n").trim();
    return { type: "unknown", rawValue };
  }

  if (normalizedTail === "") {
    return { type: "scalar", value: null };
  }
  if (normalizedTail.startsWith("{") && normalizedTail.endsWith("}")) {
    return { type: "unknown", rawValue: normalizedTail };
  }
  if (/^\[\[[^\]]+\]\]$/.test(normalizedTail)) {
    // Treat wikilinks as scalar strings, not YAML flow arrays.
    return { type: "scalar", value: normalizedTail };
  }
  if (normalizedTail.startsWith("[") && normalizedTail.endsWith("]")) {
    const flowArray = parseFlowStringArray(normalizedTail);
    if (flowArray) {
      return { type: "string-array", value: flowArray };
    }
    return { type: "unknown", rawValue: normalizedTail };
  }
  return { type: "scalar", value: parseScalar(normalizedTail) };
};

const isWikilink = (value: string) => /^\[\[[^\]]+\]\]$/.test(value.trim());

const getWikilinkTarget = (value: string) => {
  const trimmed = value.trim();
  if (!isWikilink(trimmed)) {
    return null;
  }
  const inner = trimmed.slice(2, -2);
  const [target] = inner.split("|");
  return target?.trim() ?? null;
};

const isImageWikilink = (value: string) => {
  const target = getWikilinkTarget(value);
  if (!target) {
    return false;
  }
  const [pathPart] = target.split(/[?#]/);
  return IMAGE_EXTENSION_PATTERN.test(pathPart ?? "");
};

const normalizeSchemaKey = (key: string) => key.trim().toLowerCase();

const resolvePropertyKind = ({
  key,
  value,
  yamlValueType,
}: {
  key: string;
  value: FrontmatterPropertyValue;
  yamlValueType: ParsedYamlValue["type"];
}): FrontmatterPropertyKind => {
  const schemaEntry = PROPERTY_SCHEMA[normalizeSchemaKey(key)];
  if (schemaEntry?.kind) {
    return schemaEntry.kind;
  }
  if (yamlValueType === "unknown") {
    return "unknown";
  }
  if (Array.isArray(value) || normalizeSchemaKey(key) === "tags") {
    return "tags";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "string" && isWikilink(value)) {
    return isImageWikilink(value) ? "cover" : "link";
  }
  return "text";
};

const resolvePropertyIcon = (
  key: string,
  kind: FrontmatterPropertyKind,
): FrontmatterPropertyIcon => {
  const schemaEntry = PROPERTY_SCHEMA[normalizeSchemaKey(key)];
  if (schemaEntry?.icon) {
    return schemaEntry.icon;
  }
  switch (kind) {
    case "cover":
      return "cover";
    case "task":
      return "task";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "tags":
      return "tags";
    case "link":
      return "link";
    case "unknown":
      return "unknown";
    default:
      return "text";
  }
};

const normalizeUnknownValue = (rawValue: string) => {
  const trimmed = rawValue.trim();
  return trimmed === "" ? null : trimmed;
};

const parseYamlFrontmatter = (
  rawYaml: string,
): { properties: ParsedFrontmatterProperty[]; error: string | null } => {
  const normalizedYaml = normalizeNewlines(rawYaml);
  if (normalizedYaml.trim() === "") {
    return { properties: [], error: null };
  }
  const lines = normalizedYaml.split("\n");
  const properties: ParsedFrontmatterProperty[] = [];
  const seenKeys = new Set<string>();
  let looseLinkCounter = 1;

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    if (line.trim() === "") {
      lineIndex += 1;
      continue;
    }
    if (/^\s/.test(line)) {
      return {
        properties: [],
        error: `Unsupported indentation near YAML line ${lineIndex + 1}.`,
      };
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      const looseCandidate = line.trim();
      if (isWikilink(looseCandidate)) {
        const kind = isImageWikilink(looseCandidate) ? "cover" : "link";
        properties.push({
          key: `__loose_link_${looseLinkCounter}`,
          kind,
          value: looseCandidate,
          icon: resolvePropertyIcon("link", kind),
          rawLines: [line],
          preserveRaw: true,
          hidden: true,
        });
        looseLinkCounter += 1;
        lineIndex += 1;
        continue;
      }
      return {
        properties: [],
        error: `Invalid YAML key/value pair at line ${lineIndex + 1}.`,
      };
    }

    const key = line.slice(0, separatorIndex).trim();
    const tail = line.slice(separatorIndex + 1);
    if (!key) {
      return {
        properties: [],
        error: `Empty YAML key at line ${lineIndex + 1}.`,
      };
    }
    if (seenKeys.has(key)) {
      return {
        properties: [],
        error: `Duplicate YAML key "${key}" found.`,
      };
    }
    seenKeys.add(key);

    const continuationLines: string[] = [];
    const allowLooseListContinuation = tail.trim() === "";
    let cursor = lineIndex + 1;
    while (cursor < lines.length) {
      const nextLine = lines[cursor] ?? "";
      if (nextLine.trim() === "") {
        if (continuationLines.length === 0) {
          break;
        }
        continuationLines.push(nextLine);
        cursor += 1;
        continue;
      }
      if (/^\s/.test(nextLine)) {
        continuationLines.push(nextLine);
        cursor += 1;
        continue;
      }
      if (allowLooseListContinuation && /^-\s+/.test(nextLine)) {
        continuationLines.push(nextLine);
        cursor += 1;
        continue;
      }
      break;
    }

    const rawLines = [line, ...continuationLines];
    const parsedValue = parsePropertyValue(tail, continuationLines);
    const value: FrontmatterPropertyValue =
      parsedValue.type === "scalar"
        ? parsedValue.value
        : parsedValue.type === "string-array"
          ? parsedValue.value
          : normalizeUnknownValue(parsedValue.rawValue);

    const kind = resolvePropertyKind({
      key,
      value,
      yamlValueType: parsedValue.type,
    });
    properties.push({
      key,
      kind,
      value,
      icon: resolvePropertyIcon(key, kind),
      rawLines,
      preserveRaw: parsedValue.type === "unknown",
    });

    lineIndex = cursor;
  }

  return { properties, error: null };
};

const parseFrontmatterDocumentInternal = (
  markdown: string,
): ParsedFrontmatterDocumentInternal => {
  const safeMarkdown = asMarkdownString(markdown);
  const lineEnding = detectLineEnding(safeMarkdown);
  const match = safeMarkdown.match(FRONTMATTER_PATTERN);
  if (!match) {
    return {
      hasFrontmatter: false,
      error: null,
      body: safeMarkdown,
      bodyStartOffset: 0,
      lineEnding,
      properties: [],
      frontmatterPrefix: "",
      parsedProperties: [],
    };
  }

  const rawBlock = match[0] ?? "";
  const rawYaml = match[1] ?? "";
  const bodyStartOffset = rawBlock.length;
  const body = safeMarkdown.slice(bodyStartOffset);
  const parsed = parseYamlFrontmatter(rawYaml);

  return {
    hasFrontmatter: true,
    error: parsed.error,
    body,
    bodyStartOffset,
    lineEnding: detectLineEnding(rawBlock),
    properties: parsed.properties
      .filter((property) => !property.hidden)
      .map(({ rawLines, preserveRaw, hidden: _hidden, ...property }) => property),
    frontmatterPrefix: safeMarkdown.slice(0, bodyStartOffset),
    parsedProperties: parsed.properties,
  };
};

const isAmbiguousPlainString = (value: string) => {
  return /^(true|false|null|~)$/i.test(value) || numberPattern.test(value);
};

const shouldKeepAsPlainString = (value: string) => {
  if (value === "") {
    return false;
  }
  if (isWikilink(value)) {
    // Keep wikilinks quoted in YAML to force string semantics.
    return false;
  }
  if (value.trim() !== value) {
    return false;
  }
  if (isAmbiguousPlainString(value)) {
    return false;
  }
  return /^[A-Za-z0-9 ._/\-]+$/.test(value);
};

const serializeString = (value: string) => {
  if (shouldKeepAsPlainString(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "''")}'`;
};

const serializeScalar = (value: ScalarValue) => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }
  return serializeString(value);
};

const normalizePropertyUpdateValue = (
  kind: FrontmatterPropertyKind,
  value: FrontmatterPropertyValue,
): FrontmatterPropertyValue => {
  if (kind === "tags") {
    if (!Array.isArray(value)) {
      return null;
    }
    const unique = new Set<string>();
    value.forEach((item) => {
      const normalized = item.trim();
      if (normalized) {
        unique.add(normalized);
      }
    });
    const list = Array.from(unique);
    return list.length > 0 ? list : null;
  }

  if (kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  if (kind === "boolean") {
    return typeof value === "boolean" ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }
  return value.trim() === "" ? null : value;
};

const inferKindFromValue = (
  key: string,
  value: FrontmatterPropertyValue,
): FrontmatterPropertyKind => {
  const normalizedKey = normalizeSchemaKey(key);
  const schemaKind = PROPERTY_SCHEMA[normalizedKey]?.kind;
  if (schemaKind) {
    return schemaKind;
  }
  if (Array.isArray(value) || normalizedKey === "tags") {
    return "tags";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "string" && isWikilink(value)) {
    return isImageWikilink(value) ? "cover" : "link";
  }
  return "text";
};

const parseDraftValue = (input: string): FrontmatterPropertyValue => {
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }
  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true";
  }
  if (/^(null|~)$/i.test(trimmed)) {
    return null;
  }
  if (numberPattern.test(trimmed)) {
    const parsedNumber = Number(trimmed);
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber;
    }
  }
  return trimmed;
};

const coerceValueForKind = (
  kind: FrontmatterPropertyKind,
  value: FrontmatterPropertyValue,
): FrontmatterPropertyValue => {
  if (kind !== "tags") {
    return value;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
  return tags.length > 0 ? tags : null;
};

const applyFrontmatterUpdate = ({
  parsed,
  markdown,
  properties,
}: {
  parsed: ParsedFrontmatterDocumentInternal;
  markdown: string;
  properties: ParsedFrontmatterProperty[];
}) => {
  const nextFrontmatterBlock = serializeFrontmatterBlock({
    properties,
    lineEnding: parsed.lineEnding,
    includeBodySeparator: parsed.body.length > 0,
  });
  const bom = markdown.startsWith("\uFEFF") ? "\uFEFF" : "";
  const nextMarkdown = `${bom}${nextFrontmatterBlock}${parsed.body}`;
  return { markdown: nextMarkdown, error: null };
};

const serializeProperty = (property: ParsedFrontmatterProperty): string[] => {
  if (property.preserveRaw && property.rawLines.length > 0) {
    return property.rawLines;
  }

  const key = property.key;
  const value = property.value;

  if (property.kind === "tags") {
    if (!Array.isArray(value) || value.length === 0) {
      return [`${key}: null`];
    }
    return [
      `${key}:`,
      ...value.map((tag) => `  - ${serializeString(tag)}`),
    ];
  }

  if (value === null) {
    return [`${key}: null`];
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return [`${key}: ${serializeScalar(value)}`];
  }

  return [`${key}: ${serializeString(String(value))}`];
};

const serializeFrontmatterBlock = ({
  properties,
  lineEnding,
  includeBodySeparator,
}: {
  properties: ParsedFrontmatterProperty[];
  lineEnding: "\n" | "\r\n";
  includeBodySeparator: boolean;
}) => {
  const lines: string[] = ["---"];
  properties.forEach((property) => {
    lines.push(...serializeProperty(property));
  });
  lines.push("---");
  let block = lines.join(lineEnding);
  if (includeBodySeparator) {
    block += lineEnding;
  }
  return block;
};

export const parseFrontmatterDocument = (
  markdown: string,
): FrontmatterDocument => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  return {
    hasFrontmatter: parsed.hasFrontmatter,
    error: parsed.error,
    body: parsed.body,
    bodyStartOffset: parsed.bodyStartOffset,
    lineEnding: parsed.lineEnding,
    properties: parsed.properties,
  };
};

const extractLeadingFrontmatterBlock = (markdown: string) => {
  const match = markdown.match(FRONTMATTER_PATTERN);
  if (!match) {
    return null;
  }
  const rawBlock = match[0] ?? "";
  return {
    rawBlock,
    normalizedYaml: normalizeNewlines(match[1] ?? ""),
    consumedLength: rawBlock.length,
  };
};

const collapseLeadingIdenticalFrontmatterBlocks = (markdown: string) => {
  const first = extractLeadingFrontmatterBlock(markdown);
  if (!first) {
    return markdown;
  }

  let cursor = first.consumedLength;
  while (cursor < markdown.length) {
    const next = extractLeadingFrontmatterBlock(markdown.slice(cursor));
    if (!next || next.normalizedYaml !== first.normalizedYaml) {
      break;
    }
    cursor += next.consumedLength;
  }

  if (cursor === first.consumedLength) {
    return markdown;
  }
  return `${first.rawBlock}${markdown.slice(cursor)}`;
};

export const composeMarkdownWithBody = (markdown: string, body: string) => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  if (!parsed.hasFrontmatter) {
    return body;
  }
  if (!extractLeadingFrontmatterBlock(body)) {
    return `${parsed.frontmatterPrefix}${body}`;
  }
  return collapseLeadingIdenticalFrontmatterBlocks(body);
};

export const normalizeWikilinkValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (isWikilink(trimmed)) {
    return trimmed;
  }
  const cleaned = trimmed.replace(/^\[\[|\]\]$/g, "").trim();
  return `[[${cleaned}]]`;
};

const parseDraftValueForKind = (
  kind: FrontmatterPropertyKind,
  input: string,
): { value: FrontmatterPropertyValue; error: string | null } => {
  const trimmed = input.trim();

  if (kind === "number") {
    if (trimmed === "") {
      return { value: null, error: null };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return { value: null, error: "Nur Zahlen erlaubt." };
    }
    return { value: parsed, error: null };
  }

  if (kind === "boolean") {
    if (trimmed === "") {
      return { value: null, error: null };
    }
    if (/^(true|false)$/i.test(trimmed)) {
      return { value: trimmed.toLowerCase() === "true", error: null };
    }
    return { value: null, error: "Nur true oder false erlaubt." };
  }

  if (kind === "tags") {
    if (trimmed === "") {
      return { value: null, error: null };
    }
    const tags = input
      .split(/[\n,]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    return { value: tags.length > 0 ? tags : null, error: null };
  }

  if (kind === "link") {
    if (trimmed === "") {
      return { value: null, error: null };
    }
    return { value: normalizeWikilinkValue(trimmed), error: null };
  }

  if (kind === "cover") {
    if (trimmed === "") {
      return { value: null, error: null };
    }
    const normalized = normalizeWikilinkValue(trimmed);
    if (!normalized || !isImageWikilink(normalized)) {
      return { value: null, error: "Cover erwartet Bild-Link." };
    }
    return { value: normalized, error: null };
  }

  if (trimmed === "") {
    return { value: null, error: null };
  }
  return { value: input, error: null };
};

const isLinksArrayKey = (key: string) => normalizeSchemaKey(key) === "links";
const isLinkSequenceKey = (key: string) => LINK_KEY_PATTERN.test(key.trim());

export const isLinkPropertyKey = (key: string) =>
  isLinkSequenceKey(key) || isLinksArrayKey(key);

export const extractWikilinkTarget = (value: string) => getWikilinkTarget(value);

const dedupeStable = (values: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    next.push(value);
  });
  return next;
};

const normalizeWikilinkList = (values: string[]) =>
  dedupeStable(
    values
      .map((value) => normalizeWikilinkValue(value))
      .filter((value) => value.trim() !== ""),
  );

const collectWikilinksFromProperty = (property: ParsedFrontmatterProperty) => {
  if (typeof property.value === "string") {
    const normalized = normalizeWikilinkValue(property.value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(property.value)) {
    return normalizeWikilinkList(property.value);
  }
  return [];
};

const resolveLinkInsertionIndex = ({
  removedIndices,
  insertionSourceIndex,
}: {
  removedIndices: Set<number>;
  insertionSourceIndex: number;
}) => {
  let index = 0;
  for (let sourceIndex = 0; sourceIndex < insertionSourceIndex; sourceIndex += 1) {
    if (!removedIndices.has(sourceIndex)) {
      index += 1;
    }
  }
  return index;
};

const normalizeSuggestionValue = (value: FrontmatterPropertyValue): string[] => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? [String(value)] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "true" : "false"];
  }
  return [];
};

const isNumericSuggestionValue = (value: string) => numberPattern.test(value.trim());

const sortSuggestionValuesByCount = (valueCounts: Record<string, number>) => {
  const values = Object.keys(valueCounts);
  const allNumeric = values.length > 0 && values.every(isNumericSuggestionValue);
  const sorted = values.slice();
  if (allNumeric) {
    sorted.sort((left, right) => Number(left) - Number(right));
    return sorted;
  }
  sorted.sort((left, right) => {
    const leftCount = valueCounts[left] ?? 0;
    const rightCount = valueCounts[right] ?? 0;
    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }
    return left.localeCompare(right, undefined, { sensitivity: "base" });
  });
  return sorted;
};

const sortKeySuggestionsByCount = (keyCounts: Record<string, number>) =>
  Object.keys(keyCounts).sort((left, right) => {
    const leftCount = keyCounts[left] ?? 0;
    const rightCount = keyCounts[right] ?? 0;
    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }
    return left.localeCompare(right, undefined, { sensitivity: "base" });
  });

const collectSuggestionIndexFromProperties = (
  keyIndex: Map<string, number>,
  valueIndex: Map<string, Map<string, number>>,
  properties: FrontmatterProperty[],
) => {
  properties.forEach((property) => {
    const currentKeyCount = keyIndex.get(property.key) ?? 0;
    keyIndex.set(property.key, currentKeyCount + 1);

    const nextValues = normalizeSuggestionValue(property.value);
    if (nextValues.length === 0) {
      return;
    }
    let bucket = valueIndex.get(property.key);
    if (!bucket) {
      bucket = new Map<string, number>();
      valueIndex.set(property.key, bucket);
    }
    nextValues.forEach((value) => {
      const currentValueCount = bucket?.get(value) ?? 0;
      bucket?.set(value, currentValueCount + 1);
    });
  });
};

const toSuggestionIndexRecord = ({
  keyIndex,
  valueIndex,
}: {
  keyIndex: Map<string, number>;
  valueIndex: Map<string, Map<string, number>>;
}): FrontmatterSuggestionIndex => {
  const keyRecord: Record<string, number> = {};
  keyIndex.forEach((count, key) => {
    keyRecord[key] = count;
  });

  const valueRecord: Record<string, Record<string, number>> = {};
  valueIndex.forEach((values, key) => {
    const next: Record<string, number> = {};
    values.forEach((count, value) => {
      next[value] = count;
    });
    valueRecord[key] = next;
  });

  return {
    keyIndex: keyRecord,
    valueIndex: valueRecord,
  };
};

export const sortFrontmatterKeySuggestions = (keyCounts: Record<string, number>) =>
  sortKeySuggestionsByCount(keyCounts);

export const buildFrontmatterValueSuggestionMapFromIndex = (
  valueCountsByKey: Record<string, Record<string, number>>,
) => {
  const output: Record<string, string[]> = {};
  Object.entries(valueCountsByKey).forEach(([key, valueCounts]) => {
    output[key] = sortSuggestionValuesByCount(valueCounts);
  });
  return output;
};

export const collectFrontmatterSuggestionIndex = (properties: FrontmatterProperty[]) => {
  const keyIndex = new Map<string, number>();
  const valueIndex = new Map<string, Map<string, number>>();
  collectSuggestionIndexFromProperties(keyIndex, valueIndex, properties);
  return toSuggestionIndexRecord({ keyIndex, valueIndex });
};

export const buildFrontmatterSuggestionIndex = (markdownDocuments: string[]) => {
  const keyIndex = new Map<string, number>();
  const valueIndex = new Map<string, Map<string, number>>();
  markdownDocuments.forEach((markdown) => {
    const parsed = parseFrontmatterDocument(markdown);
    if (!parsed.hasFrontmatter || parsed.error) {
      return;
    }
    collectSuggestionIndexFromProperties(keyIndex, valueIndex, parsed.properties);
  });
  return toSuggestionIndexRecord({ keyIndex, valueIndex });
};

export const buildFrontmatterKeySuggestionList = (markdownDocuments: string[]) =>
  sortFrontmatterKeySuggestions(buildFrontmatterSuggestionIndex(markdownDocuments).keyIndex);

export const collectFrontmatterValueSuggestions = (
  properties: FrontmatterProperty[],
) => {
  const index = collectFrontmatterSuggestionIndex(properties);
  return buildFrontmatterValueSuggestionMapFromIndex(index.valueIndex);
};

export const buildFrontmatterValueSuggestionMap = (markdownDocuments: string[]) => {
  const index = buildFrontmatterSuggestionIndex(markdownDocuments);
  return buildFrontmatterValueSuggestionMapFromIndex(index.valueIndex);
};

export const parseFrontmatterLinks = (markdown: string): FrontmatterLinksDocument => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  if (!parsed.hasFrontmatter) {
    return {
      hasFrontmatter: false,
      error: null,
      links: [],
      layout: "link-keys",
    };
  }
  if (parsed.error) {
    return {
      hasFrontmatter: true,
      error: parsed.error,
      links: [],
      layout: "link-keys",
    };
  }

  const links: string[] = [];
  let hasLinkSequence = false;
  let hasLinksArray = false;
  parsed.parsedProperties.forEach((property) => {
    if (property.hidden) {
      links.push(...collectWikilinksFromProperty(property));
      return;
    }
    if (isLinkSequenceKey(property.key)) {
      hasLinkSequence = true;
      links.push(...collectWikilinksFromProperty(property));
      return;
    }
    if (isLinksArrayKey(property.key)) {
      hasLinksArray = true;
      links.push(...collectWikilinksFromProperty(property));
    }
  });

  return {
    hasFrontmatter: true,
    error: null,
    links: normalizeWikilinkList(links),
    layout: hasLinksArray && !hasLinkSequence ? "links-array" : "link-keys",
  };
};

export const updateFrontmatterLinks = ({
  markdown,
  links,
}: {
  markdown: string;
  links: string[];
}): { markdown: string; error: string | null } => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  if (!parsed.hasFrontmatter) {
    return {
      markdown,
      error: "No YAML frontmatter block found at document start.",
    };
  }
  if (parsed.error) {
    return {
      markdown,
      error: parsed.error,
    };
  }

  const normalizedLinks = normalizeWikilinkList(links);
  const linkSequenceIndices: number[] = [];
  const linksArrayIndices: number[] = [];
  const looseLinkIndices: number[] = [];

  parsed.parsedProperties.forEach((property, index) => {
    if (property.hidden) {
      looseLinkIndices.push(index);
      return;
    }
    if (isLinkSequenceKey(property.key)) {
      linkSequenceIndices.push(index);
      return;
    }
    if (isLinksArrayKey(property.key)) {
      linksArrayIndices.push(index);
    }
  });

  const layout: FrontmatterLinksLayout =
    linksArrayIndices.length > 0 && linkSequenceIndices.length === 0
      ? "links-array"
      : "link-keys";
  const sourceIndices = [...linkSequenceIndices, ...linksArrayIndices, ...looseLinkIndices];
  const removedIndices = new Set(sourceIndices);
  const nextProperties = parsed.parsedProperties.filter(
    (_property, index) => !removedIndices.has(index),
  );
  const insertionSourceIndex = sourceIndices.length > 0
    ? Math.min(...sourceIndices)
    : parsed.parsedProperties.length;
  const insertionIndex = resolveLinkInsertionIndex({
    removedIndices,
    insertionSourceIndex,
  });

  const linkProperties: ParsedFrontmatterProperty[] = [];
  if (normalizedLinks.length > 0) {
    if (layout === "links-array") {
      linkProperties.push({
        key: "links",
        kind: "tags",
        value: normalizedLinks,
        icon: "link",
        rawLines: [],
        preserveRaw: false,
      });
    } else {
      normalizedLinks.forEach((link, index) => {
        const key = `link${index + 1}`;
        const kind = inferKindFromValue(key, link);
        linkProperties.push({
          key,
          kind,
          value: link,
          icon: resolvePropertyIcon(key, kind),
          rawLines: [],
          preserveRaw: false,
        });
      });
    }
  }

  const mergedProperties = [
    ...nextProperties.slice(0, insertionIndex),
    ...linkProperties,
    ...nextProperties.slice(insertionIndex),
  ];

  return applyFrontmatterUpdate({
    parsed,
    markdown,
    properties: mergedProperties,
  });
};

export const updateFrontmatterProperty = ({
  markdown,
  key,
  kind,
  value,
}: {
  markdown: string;
  key: string;
  kind: FrontmatterPropertyKind;
  value: FrontmatterPropertyValue;
}): { markdown: string; error: string | null } => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  if (!parsed.hasFrontmatter) {
    return {
      markdown,
      error: "No YAML frontmatter block found at document start.",
    };
  }
  if (parsed.error) {
    return {
      markdown,
      error: parsed.error,
    };
  }

  const propertyIndex = parsed.parsedProperties.findIndex(
    (property) => property.key === key,
  );
  if (propertyIndex === -1) {
    return {
      markdown,
      error: `Frontmatter key "${key}" was not found.`,
    };
  }

  const normalizedValue = normalizePropertyUpdateValue(kind, value);
  const nextProperties = parsed.parsedProperties.slice();
  const current = nextProperties[propertyIndex];
  nextProperties[propertyIndex] = {
    ...current,
    kind,
    value: normalizedValue,
    icon: resolvePropertyIcon(current.key, kind),
    preserveRaw: false,
    rawLines: [],
  };

  return applyFrontmatterUpdate({
    parsed,
    markdown,
    properties: nextProperties,
  });
};

export const removeFrontmatterProperty = ({
  markdown,
  key,
}: {
  markdown: string;
  key: string;
}): { markdown: string; error: string | null } => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  if (!parsed.hasFrontmatter) {
    return {
      markdown,
      error: "No YAML frontmatter block found at document start.",
    };
  }
  if (parsed.error) {
    return {
      markdown,
      error: parsed.error,
    };
  }

  const propertyIndex = parsed.parsedProperties.findIndex(
    (property) => property.key === key,
  );
  if (propertyIndex === -1) {
    return {
      markdown,
      error: `Frontmatter key "${key}" was not found.`,
    };
  }

  const nextProperties = parsed.parsedProperties.filter(
    (_property, index) => index !== propertyIndex,
  );

  return applyFrontmatterUpdate({
    parsed,
    markdown,
    properties: nextProperties,
  });
};

export const addFrontmatterProperty = ({
  markdown,
  key,
  value,
  kind,
}: {
  markdown: string;
  key: string;
  value: string;
  kind?: FrontmatterPropertyKind;
}): { markdown: string; error: string | null } => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  if (!parsed.hasFrontmatter) {
    return {
      markdown,
      error: "No YAML frontmatter block found at document start.",
    };
  }
  if (parsed.error) {
    return {
      markdown,
      error: parsed.error,
    };
  }

  const nextKey = key.trim();
  if (!nextKey) {
    return {
      markdown,
      error: "Property key is required.",
    };
  }
  const hasDuplicate = parsed.parsedProperties.some(
    (property) => property.key === nextKey,
  );
  if (hasDuplicate) {
    return {
      markdown,
      error: `Frontmatter key "${nextKey}" already exists.`,
    };
  }

  const resolvedKind = kind;
  const typedDraft = resolvedKind
    ? parseDraftValueForKind(resolvedKind, value)
    : { value: parseDraftValue(value), error: null };
  if (typedDraft.error) {
    return {
      markdown,
      error: typedDraft.error,
    };
  }
  const parsedDraftValue = typedDraft.value;
  const inferredKind = resolvedKind ?? inferKindFromValue(nextKey, parsedDraftValue);
  const normalizedValue = normalizePropertyUpdateValue(
    inferredKind,
    coerceValueForKind(inferredKind, parsedDraftValue),
  );
  const nextProperty: ParsedFrontmatterProperty = {
    key: nextKey,
    kind: inferredKind,
    value: normalizedValue,
    icon: resolvePropertyIcon(nextKey, inferredKind),
    rawLines: [],
    preserveRaw: false,
  };

  return applyFrontmatterUpdate({
    parsed,
    markdown,
    properties: [...parsed.parsedProperties, nextProperty],
  });
};

export const reorderFrontmatterProperties = ({
  markdown,
  fromKey,
  toKey,
  position,
}: {
  markdown: string;
  fromKey: string;
  toKey: string;
  position: "before" | "after";
}): { markdown: string; error: string | null } => {
  const parsed = parseFrontmatterDocumentInternal(markdown);
  if (!parsed.hasFrontmatter) {
    return {
      markdown,
      error: "No YAML frontmatter block found at document start.",
    };
  }
  if (parsed.error) {
    return {
      markdown,
      error: parsed.error,
    };
  }

  const sourceIndex = parsed.parsedProperties.findIndex(
    (property) => property.key === fromKey,
  );
  if (sourceIndex === -1) {
    return {
      markdown,
      error: `Frontmatter key "${fromKey}" was not found.`,
    };
  }

  const nextProperties = parsed.parsedProperties.slice();
  const [moved] = nextProperties.splice(sourceIndex, 1);
  if (!moved) {
    return { markdown, error: "Failed to resolve dragged property." };
  }

  const targetIndex = nextProperties.findIndex(
    (property) => property.key === toKey,
  );
  if (targetIndex === -1) {
    return {
      markdown,
      error: `Frontmatter key "${toKey}" was not found.`,
    };
  }

  const insertionIndex = position === "after" ? targetIndex + 1 : targetIndex;
  nextProperties.splice(insertionIndex, 0, {
    ...moved,
    preserveRaw: moved.rawLines.length > 0,
  });

  return applyFrontmatterUpdate({
    parsed,
    markdown,
    properties: nextProperties,
  });
};
