/**
 * @file apps/fmd-desktop/src/features/preview/markdownBlocks.ts
 *
 * Zweck:
 * - Zerlegt Markdown in editierbare Bloecke fuer den Hybrid-Editor.
 * - Stellt Helfer fuer Block-Replacement und Listen-Normalisierung bereit.
 */

import { parseMarkdownPipeTableAt } from "../../lib/markdownTables";

export type MarkdownBlockKind =
  | "blank"
  | "heading"
  | "paragraph"
  | "math-block"
  | "card-block"
  | "help-block"
  | "ordered-list"
  | "unordered-list"
  | "table"
  | "code-fence"
  | "blockquote"
  | "hr";

export type MarkdownBlock = {
  id: string;
  kind: MarkdownBlockKind;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  raw: string;
  meta?: {
    orderedDelimiter?: "." | ")";
  };
};

const orderedListLinePattern = /^(\s*)(\d+)(\.|\)|\.\))(\s+)(.*)$/;
const unorderedListLinePattern = /^(\s*)([-+*])(?:\s+|$)/;
const taskListLinePattern = /^(\s*)([-+*])\s+\[[ xX]\](?:\s+|$)/;

const isBlankLine = (line: string) => /^\s*$/.test(line);
const isCodeFenceLine = (line: string) => /^\s*`{3,}/.test(line);
const isClosingCodeFenceLine = (line: string) => /^\s*`{3,}\s*$/.test(line);
const isMathBlockDelimiterLine = (line: string) => /^\s*\$\$\s*$/.test(line);
const isSingleLineMathBlockLine = (line: string) =>
  !isMathBlockDelimiterLine(line) && /^\s*\$\$[\s\S]*\$\$\s*$/.test(line);
const isHeadingLine = (line: string) => /^\s{0,3}#{1,4}(?:\s+|$)/.test(line);
const isBlockquoteLine = (line: string) => /^\s*>/.test(line);
const isHorizontalRuleLine = (line: string) =>
  /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,})$/.test(line);
const isHorizontalRuleLineForNormalization = (line: string) =>
  /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line);
const isHelpBlockStartLine = (line: string) => line.trim().toLowerCase() === "#help";
const isHelpBlockEndLine = (line: string) => line.trim().toLowerCase() === "#helpend";
const isCardBlockStartLine = (line: string) => line.trim().toLowerCase() === "#card";
const isCardBlockEndLine = (line: string) => line.trim().toLowerCase() === "#endcard";

const resolveOrderedDelimiter = (raw: string): "." | ")" =>
  raw === "." ? "." : ")";

const matchOrderedListLine = (line: string) => line.match(orderedListLinePattern);

const isOrderedListLine = (line: string) => Boolean(matchOrderedListLine(line));

const isUnorderedListLine = (line: string) =>
  Boolean(line.match(taskListLinePattern) || line.match(unorderedListLinePattern));

const isListStartLine = (line: string) => isOrderedListLine(line) || isUnorderedListLine(line);

const getIndentWidth = (indent: string) =>
  Array.from(indent).reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);

const isListContinuationLine = (line: string) => {
  if (isBlankLine(line)) {
    return false;
  }
  if (isHelpBlockStartLine(line) || isHelpBlockEndLine(line)) {
    return false;
  }
  if (isCardBlockStartLine(line) || isCardBlockEndLine(line)) {
    return false;
  }
  if (isMathBlockDelimiterLine(line)) {
    return false;
  }
  if (isListStartLine(line)) {
    return true;
  }
  return /^\s{2,}\S/.test(line) || /^\t+\S/.test(line);
};

const isSpecialBlockStart = (lines: string[], index: number) => {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  if (isBlankLine(line)) {
    return true;
  }
  if (isCodeFenceLine(line)) {
    return true;
  }
  if (isMathBlockDelimiterLine(line)) {
    return true;
  }
  if (isSingleLineMathBlockLine(line)) {
    return true;
  }
  if (isHelpBlockStartLine(line)) {
    return true;
  }
  if (isCardBlockStartLine(line)) {
    return true;
  }
  if (isHeadingLine(line)) {
    return true;
  }
  if (isHorizontalRuleLine(line)) {
    return true;
  }
  if (isBlockquoteLine(line)) {
    return true;
  }
  if (isListStartLine(line)) {
    return true;
  }
  if (parseMarkdownPipeTableAt([line, next], 0)) {
    return true;
  }
  return false;
};

const buildLineStarts = (markdown: string, lines: string[]) => {
  const starts: number[] = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    starts.push(offset);
    offset += (lines[i] ?? "").length;
    if (offset < markdown.length || i < lines.length - 1) {
      offset += 1;
    }
  }
  return starts;
};

const buildBlock = (
  markdown: string,
  lines: string[],
  lineStarts: number[],
  blockIndex: number,
  kind: MarkdownBlockKind,
  startLine: number,
  endLine: number,
  meta?: MarkdownBlock["meta"],
): MarkdownBlock => {
  const startOffset = lineStarts[startLine] ?? 0;
  const endLineStart = lineStarts[endLine] ?? markdown.length;
  const endOffset = endLineStart + (lines[endLine] ?? "").length;
  const raw = markdown.slice(startOffset, endOffset);
  return {
    id: `${blockIndex}:${kind}:${startLine}:${endLine}`,
    kind,
    startLine,
    endLine,
    startOffset,
    endOffset,
    raw,
    meta,
  };
};

const findHorizontalRuleLineInBlockRaw = (blockRaw: string) => {
  for (const line of blockRaw.split("\n")) {
    if (isHorizontalRuleLineForNormalization(line)) {
      return line.trim();
    }
  }
  return null;
};

export const parseMarkdownBlocks = (markdown: string): MarkdownBlock[] => {
  if (markdown.length === 0) {
    return [];
  }

  const lines = markdown.split("\n");
  const lineStarts = buildLineStarts(markdown, lines);
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const nextLine = lines[i + 1] ?? "";

    // HR-Sonderregel: blank + hr (+ blank) als EIN Block behandeln, damit
    // die impliziten Absaetze nicht als separate blank-Bloecke erscheinen.
    if (isBlankLine(line) && isHorizontalRuleLine(nextLine)) {
      let end = i + 1;
      if (isBlankLine(lines[i + 2] ?? "")) {
        end = i + 2;
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "hr", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (isBlankLine(line)) {
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "blank", i, i));
      blockIndex += 1;
      i += 1;
      continue;
    }

    if (isCodeFenceLine(line)) {
      let end = i;
      for (let j = i + 1; j < lines.length; j += 1) {
        end = j;
        if (isClosingCodeFenceLine(lines[j] ?? "")) {
          break;
        }
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "code-fence", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (isMathBlockDelimiterLine(line)) {
      let end = i;
      for (let j = i + 1; j < lines.length; j += 1) {
        end = j;
        if (isMathBlockDelimiterLine(lines[j] ?? "")) {
          break;
        }
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "math-block", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (isSingleLineMathBlockLine(line)) {
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "math-block", i, i));
      blockIndex += 1;
      i += 1;
      continue;
    }

    if (isCardBlockStartLine(line)) {
      let end = i;
      for (let j = i + 1; j < lines.length; j += 1) {
        end = j;
        if (isCardBlockEndLine(lines[j] ?? "")) {
          break;
        }
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "card-block", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (isHelpBlockStartLine(line)) {
      let end = i;
      for (let j = i + 1; j < lines.length; j += 1) {
        end = j;
        if (isHelpBlockEndLine(lines[j] ?? "")) {
          break;
        }
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "help-block", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    const parsedTable = parseMarkdownPipeTableAt(lines, i);
    if (parsedTable) {
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "table", i, parsedTable.endLine));
      blockIndex += 1;
      i = parsedTable.endLine + 1;
      continue;
    }

    if (isHeadingLine(line)) {
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "heading", i, i));
      blockIndex += 1;
      i += 1;
      continue;
    }

    if (isHorizontalRuleLine(line)) {
      let end = i;
      if (isBlankLine(lines[i + 1] ?? "")) {
        end = i + 1;
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "hr", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (isBlockquoteLine(line)) {
      let end = i;
      while (end + 1 < lines.length && isBlockquoteLine(lines[end + 1] ?? "")) {
        end += 1;
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "blockquote", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (isOrderedListLine(line) || isUnorderedListLine(line)) {
      const orderedMatch = matchOrderedListLine(line);
      let orderedDelimiter: "." | ")" | undefined;
      if (orderedMatch) {
        orderedDelimiter = resolveOrderedDelimiter(orderedMatch[3] ?? ".");
      }
      const kind: MarkdownBlockKind = orderedMatch ? "ordered-list" : "unordered-list";
      let end = i;
      while (end + 1 < lines.length && isListContinuationLine(lines[end + 1] ?? "")) {
        end += 1;
      }
      blocks.push(
        buildBlock(markdown, lines, lineStarts, blockIndex, kind, i, end, {
          orderedDelimiter,
        }),
      );
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    let end = i;
    while (end + 1 < lines.length && !isSpecialBlockStart(lines, end + 1)) {
      end += 1;
    }
    blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "paragraph", i, end));
    blockIndex += 1;
    i = end + 1;
  }

  return blocks;
};

export const replaceMarkdownBlock = (
  markdown: string,
  block: Pick<MarkdownBlock, "startOffset" | "endOffset">,
  nextRaw: string,
) => `${markdown.slice(0, block.startOffset)}${nextRaw}${markdown.slice(block.endOffset)}`;

const normalizeOrderedListLine = (
  line: string,
  counters: Map<number, number>,
  delimiters: Map<number, "." | ")">,
) => {
  const match = line.match(orderedListLinePattern);
  if (!match) {
    return line;
  }
  const indent = match[1] ?? "";
  const rawDelimiter = match[3] ?? ".";
  const spacing = match[4] ?? " ";
  const content = match[5] ?? "";
  const indentWidth = getIndentWidth(indent);

  Array.from(counters.keys()).forEach((key) => {
    if (key > indentWidth) {
      counters.delete(key);
      delimiters.delete(key);
    }
  });

  const nextNumber = (counters.get(indentWidth) ?? 0) + 1;
  counters.set(indentWidth, nextNumber);

  if (!delimiters.has(indentWidth)) {
    delimiters.set(indentWidth, resolveOrderedDelimiter(rawDelimiter));
  }
  const delimiter = delimiters.get(indentWidth) ?? ".";
  return `${indent}${nextNumber}${delimiter}${spacing}${content}`;
};

export const normalizeOrderedListBlockSource = (blockRaw: string) => {
  if (!blockRaw) {
    return blockRaw;
  }
  const lines = blockRaw.split("\n");
  const counters = new Map<number, number>();
  const delimiters = new Map<number, "." | ")">();

  return lines
    .map((line) => normalizeOrderedListLine(line, counters, delimiters))
    .join("\n");
};

export const normalizeHelpBlockSource = (blockRaw: string) => {
  if (!blockRaw) {
    return blockRaw;
  }
  const normalizedLines: string[] = [];
  for (const line of blockRaw.split("\n")) {
    if (line.trim().toLowerCase() !== "#helpend") {
      normalizedLines.push(line);
      continue;
    }

    // Sonderregel: Keine Leerzeile direkt vor dem Endmarker behalten.
    while (normalizedLines.length > 0 && /^\s*$/.test(normalizedLines[normalizedLines.length - 1] ?? "")) {
      normalizedLines.pop();
    }
    // Endmarker immer linksbuendig und ohne zusaetzliche Leerzeichen/Tabs.
    normalizedLines.push("#helpend");
  }
  return normalizedLines.join("\n");
};

export const normalizeCardBlockSource = (blockRaw: string) => {
  if (!blockRaw) {
    return blockRaw;
  }

  const lines = blockRaw.split("\n");
  let closingIndex = -1;
  let closingLineSuffix = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const match = line.match(/^\s*#endcard(.*)$/i);
    if (!match) {
      continue;
    }
    closingIndex = i;
    closingLineSuffix = match[1] ?? "";
    break;
  }

  if (closingIndex < 0) {
    return blockRaw;
  }

  if (closingLineSuffix.trim().length === 0) {
    return blockRaw;
  }

  const normalizedLines = lines.slice(0, closingIndex);
  normalizedLines.push(closingLineSuffix.trimStart());
  normalizedLines.push("#endcard");
  normalizedLines.push(...lines.slice(closingIndex + 1));
  return normalizedLines.join("\n");
};

export const normalizeHorizontalRuleBlockSource = (blockRaw: string) => {
  if (!blockRaw) {
    return blockRaw;
  }
  const hrLine = findHorizontalRuleLineInBlockRaw(blockRaw);
  if (!hrLine) {
    return blockRaw;
  }
  return ["", hrLine, ""].join("\n");
};

export const normalizeHorizontalRuleSpacingInMarkdown = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }
  const blocks = parseMarkdownBlocks(markdown);
  if (blocks.length === 0) {
    return markdown;
  }

  const normalizedRawBlocks: string[] = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    const previousBlock = i > 0 ? blocks[i - 1] : null;
    const nextBlock = i + 1 < blocks.length ? blocks[i + 1] : null;

    if (
      block.kind === "blank" &&
      (previousBlock?.kind === "hr" || nextBlock?.kind === "hr")
    ) {
      // parseMarkdownBlocks already folds one blank line into the hr block itself.
      // Any additional adjacent blank block here is extra spacing and should collapse.
      continue;
    }

    if (block.kind === "hr") {
      normalizedRawBlocks.push(normalizeHorizontalRuleBlockSource(block.raw));
      continue;
    }

    normalizedRawBlocks.push(block.raw);
  }

  return normalizedRawBlocks.join("\n");
};

export const isSingleLineCommitBlock = (block: MarkdownBlock) => {
  if (block.kind === "hr") {
    return true;
  }
  if (block.startLine !== block.endLine) {
    return false;
  }
  return !(
    block.kind === "table" ||
    block.kind === "code-fence" ||
    block.kind === "math-block" ||
    block.kind === "card-block" ||
    block.kind === "help-block" ||
    block.kind === "ordered-list" ||
    block.kind === "unordered-list" ||
    block.kind === "blockquote"
  );
};
