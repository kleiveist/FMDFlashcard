/**
 * @file apps/fmd-desktop/src/lib/markdownTables.ts
 *
 * Zweck:
 * - Hilfsfunktionen fuer Markdown-Tabellen und -Blockaufteilung.
 *
 * Verantwortlichkeiten:
 * - Erkennt pipe-basierte Markdown-Tabellen.
 * - Liefert Blockstrukturen fuer Renderer und Parser.
 *
 * Hinweise:
 * - Implementiert bewusst nur pipe tables (| ... |) fuer stabile Erkennung.
 */

export type MarkdownTableBlock = {
  type: "table";
  header: string[];
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

const normalizeLineBreaks = (value: string) => value.replace(/\r\n?/g, "\n");

const splitTableRow = (line: string) => {
  if (!line.includes("|")) {
    return null;
  }
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith("|")) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.split("|").map((cell) => cell.trim());
};

const isTableSeparatorRow = (line: string) => {
  const cells = splitTableRow(line);
  if (!cells || cells.length === 0) {
    return false;
  }
  return cells.every((cell) => /^:?-+:?$/.test(cell));
};

const parseTableAt = (lines: string[], startIndex: number) => {
  const header = splitTableRow(lines[startIndex] ?? "");
  if (!header || header.length === 0) {
    return null;
  }
  const separator = lines[startIndex + 1];
  if (!separator || !isTableSeparatorRow(separator)) {
    return null;
  }
  const columnCount = header.length;
  const rows: string[][] = [];
  let cursor = startIndex + 2;

  while (cursor < lines.length) {
    const row = splitTableRow(lines[cursor] ?? "");
    if (!row || row.length !== columnCount) {
      break;
    }
    rows.push(row);
    cursor += 1;
  }

  return {
    type: "table" as const,
    header,
    rows,
    startLine: startIndex,
    endLine: Math.max(startIndex + 1, cursor - 1),
  };
};

export const findTableLineIndices = (lines: string[]) => {
  const tableLines = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseTableAt(lines, index);
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
    const parsed = parseTableAt(lines, index);
    if (parsed) {
      flushText(index - 1);
      blocks.push(parsed);
      index = parsed.endLine;
      textStart = index + 1;
      continue;
    }
    textBuffer.push(lines[index] ?? "");
  }

  flushText(lines.length - 1);
  return blocks;
};
