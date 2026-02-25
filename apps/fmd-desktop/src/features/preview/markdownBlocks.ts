/**
 * @file apps/fmd-desktop/src/features/preview/markdownBlocks.ts
 *
 * Zweck:
 * - Zerlegt Markdown in editierbare Bloecke fuer den Hybrid-Editor.
 * - Stellt Helfer fuer Block-Replacement und Listen-Normalisierung bereit.
 */

export type MarkdownBlockKind =
  | "blank"
  | "heading"
  | "paragraph"
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
const isHeadingLine = (line: string) => /^\s{0,3}#{1,6}(?:\s+|$)/.test(line);
const isBlockquoteLine = (line: string) => /^\s*>/.test(line);
const isHorizontalRuleLine = (line: string) =>
  /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,})$/.test(line);
const isHelpBlockStartLine = (line: string) => line.trim().toLowerCase() === "#help";
const isHelpBlockEndLine = (line: string) => line.trim().toLowerCase() === "#helpend";

const isMarkdownTableRowLine = (line: string) =>
  /^\|(?:[^|]*\|)+\s*$/.test(line.trim());

const isMarkdownTableSeparatorLine = (line: string) =>
  /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line.trim());

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
  if (isHelpBlockStartLine(line)) {
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
  if (isMarkdownTableRowLine(line) && isMarkdownTableSeparatorLine(next)) {
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
    if (isHorizontalRuleLine(line)) {
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

    if (isMarkdownTableRowLine(line) && isMarkdownTableSeparatorLine(nextLine)) {
      let end = i + 1;
      while (end + 1 < lines.length && isMarkdownTableRowLine(lines[end + 1] ?? "")) {
        end += 1;
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "table", i, end));
      blockIndex += 1;
      i = end + 1;
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
    block.kind === "help-block" ||
    block.kind === "ordered-list" ||
    block.kind === "unordered-list" ||
    block.kind === "blockquote"
  );
};
