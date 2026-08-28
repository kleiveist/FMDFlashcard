/**
 * @file frontend/src/lib/markdownTables.ts
 *
 * Zweck:
 * - Hilfsfunktionen fuer Markdown-Tabellen und -Blockaufteilung.
 *
 * Verantwortlichkeiten:
 * - Erkennt pipe-basierte Markdown-Tabellen.
 * - Liefert ein gemeinsames Parse-/Repair-/Serialize-Modell fuer Editor und Preview.
 */

export type MarkdownPipeTableCell = {
  raw: string;
};

export type MarkdownPipeTableRowBand = "header" | "body";

export type MarkdownPipeTableModel = {
  header: MarkdownPipeTableCell[];
  separator: string[];
  bodyRows: MarkdownPipeTableCell[][];
  columnCount: number;
};

export type MarkdownTableBlock = {
  type: "table";
  header: string[];
  separator: string[];
  rows: string[][];
  startLine: number;
  endLine: number;
};

export type MarkdownTextBlock = {
  type: "text";
  text: string;
  startLine: number;
  endLine: number;
};

export type MarkdownBlock = MarkdownTableBlock | MarkdownTextBlock;

export type IndexedSelectionState = {
  anchorIndex: number;
  selectedIndices: number[];
};

export type SelectionMoveMutation = {
  kind: "move";
  fromIndex: number;
  toIndex: number;
};

export type SelectionDeleteMutation = {
  kind: "delete";
  removedIndices: number[];
};

export type IndexedSelectionMutation = SelectionMoveMutation | SelectionDeleteMutation;

export type NormalizeMarkdownPipeTablesOptions = {
  unescapeEscapedBoundaryPipes?: boolean;
};

type ParsedMarkdownPipeTableAt = {
  model: MarkdownPipeTableModel;
  startLine: number;
  endLine: number;
  changed: boolean;
};

type SplitPipeRowOptions = NormalizeMarkdownPipeTablesOptions & {
  requirePipeDelimiter?: boolean;
};

type ParseMarkdownPipeTableOptions = SplitPipeRowOptions & {
  repair?: boolean;
};

const normalizeLineBreaks = (value: string) => value.replace(/\r\n?/g, "\n");

type InlinePipeState = {
  bracketDepth: number;
  inCodeSpan: boolean;
  inWikiLink: boolean;
  linkDestinationDepth: number;
  pendingLinkDestination: boolean;
};

const createInlinePipeState = (): InlinePipeState => ({
  bracketDepth: 0,
  inCodeSpan: false,
  inWikiLink: false,
  linkDestinationDepth: 0,
  pendingLinkDestination: false,
});

const isEscapedAt = (value: string, index: number) => {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

const isPipeDelimiter = (value: string, index: number, state: InlinePipeState) =>
  value[index] === "|" &&
  !isEscapedAt(value, index) &&
  !state.inCodeSpan &&
  !state.inWikiLink &&
  state.bracketDepth === 0 &&
  state.linkDestinationDepth === 0;

const updateInlinePipeState = (
  value: string,
  index: number,
  state: InlinePipeState,
) => {
  const char = value[index] ?? "";
  if (!char || isEscapedAt(value, index)) {
    return;
  }

  if (char === "`") {
    state.inCodeSpan = !state.inCodeSpan;
    state.pendingLinkDestination = false;
    return;
  }
  if (state.inCodeSpan) {
    return;
  }

  if (state.inWikiLink) {
    if (char === "]" && value[index + 1] === "]") {
      state.inWikiLink = false;
    }
    return;
  }

  if (state.linkDestinationDepth > 0) {
    if (char === "(") {
      state.linkDestinationDepth += 1;
    } else if (char === ")") {
      state.linkDestinationDepth -= 1;
    }
    return;
  }

  if (state.pendingLinkDestination) {
    if (char === "(") {
      state.linkDestinationDepth = 1;
      state.pendingLinkDestination = false;
      return;
    }
    if (!/\s/.test(char)) {
      state.pendingLinkDestination = false;
    }
  }

  if (char === "[" && value[index + 1] === "[") {
    state.inWikiLink = true;
    state.pendingLinkDestination = false;
    return;
  }

  if (char === "[") {
    state.bracketDepth += 1;
    state.pendingLinkDestination = false;
    return;
  }

  if (char === "]" && state.bracketDepth > 0) {
    state.bracketDepth -= 1;
    state.pendingLinkDestination = state.bracketDepth === 0;
  }
};

export const normalizeMarkdownTableCellPreviewValue = (value: string) =>
  normalizeLineBreaks(value)
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\n{3,}/g, "\n\n");

const normalizeBoundaryEscapes = (
  line: string,
  options?: NormalizeMarkdownPipeTablesOptions,
) => {
  const trimmed = line.trim();
  if (!options?.unescapeEscapedBoundaryPipes) {
    return trimmed;
  }
  // contentEditable table rows can escape every pipe character. In that case,
  // recover the full row before parsing so list-detached tables normalize back
  // into regular pipe-table markdown.
  if (/^\\\|.*\\\|$/.test(trimmed) && !/(?<!\\)\|/.test(trimmed)) {
    return trimmed.replace(/\\\|/g, "|");
  }
  return trimmed.replace(/^\\\|/, "|").replace(/\\\|$/, "|");
};

const splitPipeRow = (
  line: string,
  options?: SplitPipeRowOptions,
) => {
  const normalized = normalizeBoundaryEscapes(line, options);
  if (!normalized) {
    return null;
  }

  const segments: string[] = [];
  let current = "";
  let hasDelimiter = false;
  let inlineState = createInlinePipeState();
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] ?? "";
    if (isPipeDelimiter(normalized, index, inlineState)) {
      hasDelimiter = true;
      segments.push(current);
      current = "";
      inlineState = createInlinePipeState();
      continue;
    }
    current += char;
    updateInlinePipeState(normalized, index, inlineState);
  }
  segments.push(current);

  if (!hasDelimiter && options?.requirePipeDelimiter !== false) {
    return null;
  }
  if (!hasDelimiter && options?.requirePipeDelimiter === false) {
    return [normalized.trim()];
  }

  if (segments.length <= 1) {
    return null;
  }

  let start = 0;
  let end = segments.length;
  if (normalized.startsWith("|")) {
    start += 1;
  }
  if (normalized.endsWith("|")) {
    end -= 1;
  }
  const cells = segments.slice(start, end).map((cell) => cell.trim());
  if (cells.length === 0) {
    return null;
  }
  return cells;
};

const isSeparatorToken = (value: string) => /^:?-{3,}:?$/.test(value.trim());

const normalizeSeparatorToken = (value: string) =>
  isSeparatorToken(value) ? value.trim() : "---";

const cloneCell = (cell: MarkdownPipeTableCell): MarkdownPipeTableCell => ({ raw: cell.raw });

const cloneRow = (row: MarkdownPipeTableCell[]) => row.map(cloneCell);

const cloneModel = (model: MarkdownPipeTableModel): MarkdownPipeTableModel => ({
  header: cloneRow(model.header),
  separator: [...model.separator],
  bodyRows: model.bodyRows.map(cloneRow),
  columnCount: model.columnCount,
});

const makeEmptyCells = (count: number) =>
  Array.from({ length: Math.max(0, count) }, () => ({ raw: "" }));

const padCellRow = (row: MarkdownPipeTableCell[], columnCount: number) => {
  const nextRow = cloneRow(row);
  while (nextRow.length < columnCount) {
    nextRow.push({ raw: "" });
  }
  return nextRow.slice(0, columnCount);
};

const normalizeModel = (model: MarkdownPipeTableModel): MarkdownPipeTableModel => {
  const columnCount = Math.max(
    1,
    model.columnCount,
    model.header.length,
    model.separator.length,
    ...model.bodyRows.map((row) => row.length),
  );
  return {
    header: padCellRow(model.header, columnCount),
    separator: Array.from({ length: columnCount }, (_, index) =>
      normalizeSeparatorToken(model.separator[index] ?? "---")),
    bodyRows: model.bodyRows.map((row) => padCellRow(row, columnCount)),
    columnCount,
  };
};

const buildModel = (parts: {
  header: string[];
  separator: string[];
  bodyRows: string[][];
}): MarkdownPipeTableModel =>
  normalizeModel({
    header: parts.header.map((raw) => ({ raw })),
    separator: parts.separator,
    bodyRows: parts.bodyRows.map((row) => row.map((raw) => ({ raw }))),
    columnCount: Math.max(parts.header.length, parts.separator.length, ...parts.bodyRows.map((row) => row.length)),
  });

const parseMarkdownPipeTableAtInternal = (
  lines: string[],
  startIndex: number,
  options?: ParseMarkdownPipeTableOptions,
): ParsedMarkdownPipeTableAt | null => {
  const header = splitPipeRow(lines[startIndex] ?? "", options);
  if (!header || header.length === 0) {
    return null;
  }

  const separatorLine = lines[startIndex + 1] ?? "";
  const separator = splitPipeRow(separatorLine, options);
  if (!separator || separator.length === 0) {
    return null;
  }

  const separatorValid = separator.every(isSeparatorToken);
  if (!options?.repair && !separatorValid) {
    return null;
  }

  const bodyRows: string[][] = [];
  let endLine = startIndex + 1;
  let changed = false;
  let cursor = startIndex + 2;

  while (cursor < lines.length) {
    const row = splitPipeRow(lines[cursor] ?? "", {
      ...options,
      requirePipeDelimiter: options?.repair ? false : options?.requirePipeDelimiter,
    });
    if (!row || row.length === 0) {
      break;
    }
    if (!options?.repair && row.length !== header.length) {
      break;
    }
    bodyRows.push(row);
    endLine = cursor;
    cursor += 1;
  }

  const model = buildModel({
    header,
    separator,
    bodyRows,
  });
  if (
    header.length !== model.columnCount ||
    separator.length !== model.columnCount ||
    bodyRows.some((row) => row.length !== model.columnCount) ||
    !separatorValid
  ) {
    changed = true;
  }
  return {
    model,
    startLine: startIndex,
    endLine,
    changed,
  };
};

export const parseMarkdownPipeTableAt = (
  lines: string[],
  startIndex: number,
  options?: NormalizeMarkdownPipeTablesOptions,
) => parseMarkdownPipeTableAtInternal(lines, startIndex, options);

export const parseMarkdownPipeTable = (raw: string): MarkdownPipeTableModel | null => {
  const lines = normalizeLineBreaks(raw)
    .split("\n")
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return null;
  }
  const parsed = parseMarkdownPipeTableAtInternal(lines, 0);
  if (!parsed || parsed.endLine !== lines.length - 1) {
    return null;
  }
  return parsed.model;
};

const escapeMarkdownPipeCell = (value: string) => {
  const normalized = value.replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
  let output = "";
  const inlineState = createInlinePipeState();
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] ?? "";
    if (isPipeDelimiter(normalized, index, inlineState)) {
      output += "\\|";
      continue;
    }
    output += char;
    updateInlinePipeState(normalized, index, inlineState);
  }
  return output.trim();
};

const serializeCellRow = (row: MarkdownPipeTableCell[]) =>
  `| ${row.map((cell) => escapeMarkdownPipeCell(cell.raw)).join(" | ")} |`;

const serializeSeparatorRow = (separator: string[]) =>
  `| ${separator.map((token) => normalizeSeparatorToken(token)).join(" | ")} |`;

export const serializeMarkdownPipeTable = (model: MarkdownPipeTableModel) => {
  const normalized = normalizeModel(model);
  return [
    serializeCellRow(normalized.header),
    serializeSeparatorRow(normalized.separator),
    ...normalized.bodyRows.map(serializeCellRow),
  ].join("\n");
};

export const repairMarkdownPipeTable = (raw: string) => {
  const source = normalizeLineBreaks(raw);
  const lines = source.split("\n");
  if (lines.length < 2) {
    return {
      ok: false as const,
      error: "A markdown pipe table needs at least a header and separator row.",
    };
  }

  const parsed = parseMarkdownPipeTableAtInternal(lines, 0, {
    repair: true,
    unescapeEscapedBoundaryPipes: true,
  });
  if (!parsed) {
    return {
      ok: false as const,
      error: "The current code view content cannot be repaired into a pipe table.",
    };
  }

  const trailingContent = lines.slice(parsed.endLine + 1).filter((line) => line.trim().length > 0);
  if (trailingContent.length > 0) {
    return {
      ok: false as const,
      error: "The current code view contains non-table lines after the pipe table.",
    };
  }

  const markdown = serializeMarkdownPipeTable(parsed.model);
  return {
    ok: true as const,
    markdown,
    changed: parsed.changed || markdown !== source.trim(),
    model: parsed.model,
  };
};

export const insertTableRow = (
  model: MarkdownPipeTableModel,
  rowIndex: number,
  band: MarkdownPipeTableRowBand = "body",
) => {
  if (band === "header") {
    return normalizeModel({
      ...cloneModel(model),
      header: makeEmptyCells(model.columnCount),
    });
  }
  const next = cloneModel(model);
  const insertIndex = Math.max(0, Math.min(rowIndex, next.bodyRows.length));
  next.bodyRows.splice(insertIndex, 0, makeEmptyCells(next.columnCount));
  return normalizeModel(next);
};

export const deleteTableRows = (model: MarkdownPipeTableModel, rowIndices: number[]) => {
  const next = cloneModel(model);
  const indices = [...new Set(rowIndices)].filter((index) => index >= 0 && index < next.bodyRows.length)
    .sort((left, right) => right - left);
  indices.forEach((index) => {
    next.bodyRows.splice(index, 1);
  });
  return normalizeModel(next);
};

export const moveTableRow = (
  model: MarkdownPipeTableModel,
  fromIndex: number,
  toIndex: number,
) => {
  const next = cloneModel(model);
  if (fromIndex < 0 || fromIndex >= next.bodyRows.length) {
    return next;
  }
  const [row] = next.bodyRows.splice(fromIndex, 1);
  if (!row) {
    return next;
  }
  const insertIndex = Math.max(0, Math.min(toIndex, next.bodyRows.length));
  next.bodyRows.splice(insertIndex, 0, row);
  return normalizeModel(next);
};

export const insertTableColumn = (model: MarkdownPipeTableModel, columnIndex: number) => {
  const next = cloneModel(model);
  const insertIndex = Math.max(0, Math.min(columnIndex, next.columnCount));
  next.header.splice(insertIndex, 0, { raw: "" });
  next.separator.splice(insertIndex, 0, "---");
  next.bodyRows = next.bodyRows.map((row) => {
    const nextRow = cloneRow(row);
    nextRow.splice(insertIndex, 0, { raw: "" });
    return nextRow;
  });
  next.columnCount += 1;
  return normalizeModel(next);
};

export const deleteTableColumns = (model: MarkdownPipeTableModel, columnIndices: number[]) => {
  const next = cloneModel(model);
  const indices = [...new Set(columnIndices)].filter((index) => index >= 0 && index < next.columnCount)
    .sort((left, right) => right - left);
  if (next.columnCount - indices.length < 1) {
    return next;
  }
  indices.forEach((index) => {
    next.header.splice(index, 1);
    next.separator.splice(index, 1);
    next.bodyRows.forEach((row) => {
      row.splice(index, 1);
    });
  });
  next.columnCount -= indices.length;
  return normalizeModel(next);
};

export const moveTableColumn = (
  model: MarkdownPipeTableModel,
  fromIndex: number,
  toIndex: number,
) => {
  const next = cloneModel(model);
  if (fromIndex < 0 || fromIndex >= next.columnCount) {
    return next;
  }
  const insertIndex = Math.max(0, Math.min(toIndex, next.columnCount));
  const moveInArray = <T,>(items: T[]) => {
    const clone = [...items];
    const [moved] = clone.splice(fromIndex, 1);
    if (typeof moved === "undefined") {
      return clone;
    }
    const targetIndex = insertIndex > fromIndex ? insertIndex - 1 : insertIndex;
    clone.splice(Math.max(0, Math.min(targetIndex, clone.length)), 0, moved);
    return clone;
  };

  next.header = moveInArray(next.header);
  next.separator = moveInArray(next.separator);
  next.bodyRows = next.bodyRows.map((row) => moveInArray(row));
  return normalizeModel(next);
};

const sortUniqueIndices = (values: number[]) =>
  [...new Set(values)].sort((left, right) => left - right);

const normalizeIndexedSelection = (
  selection: IndexedSelectionState | null,
  maxCount: number,
) => {
  if (!selection || maxCount <= 0) {
    return null;
  }
  const selectedIndices = sortUniqueIndices(
    selection.selectedIndices.filter((index) => index >= 0 && index < maxCount),
  );
  if (selectedIndices.length === 0) {
    return null;
  }
  const anchorIndex = selectedIndices.includes(selection.anchorIndex)
    ? selection.anchorIndex
    : selectedIndices[0]!;
  return {
    anchorIndex,
    selectedIndices,
  };
};

const applyMoveMutationToIndex = (
  index: number,
  mutation: SelectionMoveMutation,
) => {
  if (index === mutation.fromIndex) {
    const targetIndex = mutation.toIndex > mutation.fromIndex ? mutation.toIndex - 1 : mutation.toIndex;
    return targetIndex;
  }
  if (mutation.fromIndex < mutation.toIndex) {
    if (index > mutation.fromIndex && index < mutation.toIndex) {
      return index - 1;
    }
    return index;
  }
  if (index >= mutation.toIndex && index < mutation.fromIndex) {
    return index + 1;
  }
  return index;
};

const applyMutationToSelection = (
  selection: IndexedSelectionState | null,
  mutation: IndexedSelectionMutation,
  maxCount: number,
) => {
  if (!selection) {
    return null;
  }
  let nextSelection = selection;
  if (mutation.kind === "delete") {
    const removed = new Set(mutation.removedIndices);
    nextSelection = {
      anchorIndex: selection.anchorIndex,
      selectedIndices: selection.selectedIndices
        .filter((index) => !removed.has(index))
        .map((index) =>
          index - mutation.removedIndices.filter((removedIndex) => removedIndex < index).length),
    };
  } else {
    nextSelection = {
      anchorIndex: applyMoveMutationToIndex(selection.anchorIndex, mutation),
      selectedIndices: selection.selectedIndices.map((index) => applyMoveMutationToIndex(index, mutation)),
    };
  }
  return normalizeIndexedSelection(nextSelection, maxCount);
};

export const normalizeRowSelectionAfterMutation = (
  selection: IndexedSelectionState | null,
  mutation: IndexedSelectionMutation,
  maxCount: number,
) => applyMutationToSelection(selection, mutation, maxCount);

export const normalizeColumnSelectionAfterMutation = (
  selection: IndexedSelectionState | null,
  mutation: IndexedSelectionMutation,
  maxCount: number,
) => applyMutationToSelection(selection, mutation, maxCount);

export const findTableLineIndices = (lines: string[]) => {
  const tableLines = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseMarkdownPipeTableAtInternal(lines, index);
    if (!parsed) {
      continue;
    }
    for (let lineIndex = parsed.startLine; lineIndex <= parsed.endLine; lineIndex += 1) {
      tableLines.add(lineIndex);
    }
    index = parsed.endLine;
  }
  return tableLines;
};

export const splitMarkdownBlocks = (rawText: string) => {
  const lines = normalizeLineBreaks(rawText).split("\n");
  const blocks: MarkdownBlock[] = [];
  let textStart = 0;
  let textBuffer: string[] = [];

  const flushText = (endIndex: number) => {
    if (textBuffer.length === 0) {
      textStart = endIndex + 1;
      return;
    }
    blocks.push({
      type: "text",
      text: textBuffer.join("\n"),
      startLine: textStart,
      endLine: endIndex,
    });
    textBuffer = [];
    textStart = endIndex + 1;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseMarkdownPipeTableAtInternal(lines, index);
    if (parsed) {
      flushText(index - 1);
      blocks.push({
        type: "table",
        header: parsed.model.header.map((cell) => cell.raw),
        separator: [...parsed.model.separator],
        rows: parsed.model.bodyRows.map((row) => row.map((cell) => cell.raw)),
        startLine: parsed.startLine,
        endLine: parsed.endLine,
      });
      index = parsed.endLine;
      textStart = index + 1;
      continue;
    }
    textBuffer.push(lines[index] ?? "");
  }

  flushText(lines.length - 1);
  return blocks;
};

export const normalizeMarkdownPipeTables = (
  markdown: string,
  options?: NormalizeMarkdownPipeTablesOptions,
) => {
  if (!markdown) {
    return markdown;
  }
  const sourceLines = normalizeLineBreaks(markdown).split("\n");
  const normalized: string[] = [];
  let inCodeFence = false;

  const isMarkdownCodeFenceLine = (line: string) => /^\s*`{3,}/.test(line);
  const isMarkdownCodeFenceClosingLine = (line: string) => /^\s*`{3,}\s*$/.test(line);

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index] ?? "";
    if (!inCodeFence && isMarkdownCodeFenceLine(line)) {
      const lastLine = normalized[normalized.length - 1] ?? "";
      if (normalized.length > 0 && lastLine.trim() !== "") {
        normalized.push("");
      }
      normalized.push(line);
      inCodeFence = true;
      continue;
    }
    if (inCodeFence) {
      normalized.push(line);
      if (isMarkdownCodeFenceClosingLine(line)) {
        inCodeFence = false;
        const nextLine = sourceLines[index + 1] ?? "";
        if (nextLine.trim() !== "") {
          normalized.push("");
        }
      }
      continue;
    }

    const parsed = parseMarkdownPipeTableAtInternal(sourceLines, index, options);
    if (!parsed) {
      normalized.push(line);
      continue;
    }

    const lastLine = normalized[normalized.length - 1] ?? "";
    if (normalized.length > 0 && lastLine.trim() !== "") {
      normalized.push("");
    }
    normalized.push(serializeMarkdownPipeTable(parsed.model));
    index = parsed.endLine;
    const nextLine = sourceLines[index + 1] ?? "";
    if (nextLine.trim() !== "") {
      normalized.push("");
    }
  }

  return normalized.join("\n");
};
