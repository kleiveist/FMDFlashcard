/**
 * @file apps/fmd-desktop/src/features/preview/markdownBlocks.ts
 *
 * Zweck:
 * - Zerlegt Markdown in editierbare Bloecke fuer den Hybrid-Editor.
 * - Stellt Helfer fuer Block-Replacement und Listen-Normalisierung bereit.
 */

import { parseMarkdownPipeTableAt } from "../../lib/markdownTables";
import { parseStandalonePngEmbedLine } from "../../lib/markdownMedia";
import { isDatabaseBlockMarkerLine } from "../../lib/databaseBlockSyntax";

export type MarkdownBlockKind =
  | "blank"
  | "heading"
  | "paragraph"
  | "math-block"
  | "database-block"
  | "card-start"
  | "card-end"
  | "help-block"
  | "image-embed"
  | "ordered-list"
  | "unordered-list"
  | "table"
  | "code-fence"
  | "blockquote"
  | "hr";

export type MarkdownBlockParseProfile = "default" | "hybrid-list-items";

export type ParseMarkdownBlocksOptions = {
  profile?: MarkdownBlockParseProfile;
};

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
    unorderedMarker?: "-" | "+" | "*";
    listGroupId?: string;
    listDepth?: number;
    listIndentWidth?: number;
    listParentStartLine?: number;
    listItemType?: "ordered" | "unordered";
    cardGroupId?: string;
    cardGroupRole?: "start" | "inner" | "end";
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
const frontmatterPrefixPattern =
  /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;
const leadingBlockquoteMarkersPattern = /^\s*(?:>\s*)+/;
const quotePrefixedHashLinePattern = /^(\s*)(?:>\s*)+(#.*)$/;
const quotedStructuralDirectivePattern = /^\s*(?:>\s*)+(#(?:card|endcard|help|helpend))\s*$/i;

const stripLeadingBlockquoteMarkers = (line: string) =>
  line.replace(leadingBlockquoteMarkersPattern, "");

const resolveStructuralDirectiveToken = (line: string) => {
  const quotedMatch = line.match(quotedStructuralDirectivePattern);
  const candidate = (quotedMatch?.[1] ?? line.trim()).toLowerCase();
  if (
    candidate === "#card" ||
    candidate === "#endcard" ||
    candidate === "#help" ||
    candidate === "#helpend"
  ) {
    return candidate;
  }
  return null;
};

const isQuotedStructuralDirectiveLine = (
  line: string,
  directive: "#card" | "#endcard" | "#help" | "#helpend",
) => {
  const quotedMatch = line.match(quotedStructuralDirectivePattern);
  if (!quotedMatch?.[1]) {
    return false;
  }
  return quotedMatch[1].toLowerCase() === directive;
};

const isHelpBlockStartLine = (line: string) => resolveStructuralDirectiveToken(line) === "#help";
const isHelpBlockEndLine = (line: string) => resolveStructuralDirectiveToken(line) === "#helpend";
const isStandaloneImageEmbedLine = (line: string) => parseStandalonePngEmbedLine(line) !== null;
const isDatabaseBlockMarker = (line: string) => isDatabaseBlockMarkerLine(line);
const isCardBlockStartLine = (line: string) => resolveStructuralDirectiveToken(line) === "#card";
const isCardBlockEndLine = (line: string) => resolveStructuralDirectiveToken(line) === "#endcard";

const resolveOrderedDelimiter = (raw: string): "." | ")" =>
  raw === "." ? "." : ")";

const matchOrderedListLine = (line: string) => line.match(orderedListLinePattern);
const matchUnorderedListLine = (line: string) =>
  line.match(taskListLinePattern) ?? line.match(unorderedListLinePattern);

const isOrderedListLine = (line: string) => Boolean(matchOrderedListLine(line));

const isUnorderedListLine = (line: string) =>
  Boolean(matchUnorderedListLine(line));

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
  if (isStandaloneImageEmbedLine(line)) {
    return false;
  }
  if (isDatabaseBlockMarker(line)) {
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
  if (isStandaloneImageEmbedLine(line)) {
    return true;
  }
  if (isDatabaseBlockMarker(line)) {
    return true;
  }
  if (isCardBlockStartLine(line)) {
    return true;
  }
  if (isCardBlockEndLine(line)) {
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

export const assignCardGroupMeta = (blocks: MarkdownBlock[]): MarkdownBlock[] => {
  if (blocks.length === 0) {
    return blocks;
  }

  const nextBlocks = blocks.map((block) => ({
    ...block,
    meta: block.meta ? { ...block.meta } : undefined,
  }));
  let openCardGroupId: string | null = null;
  let nextGroupSequence = 1;

  for (let index = 0; index < nextBlocks.length; index += 1) {
    const block = nextBlocks[index]!;
    if (block.kind === "card-start") {
      const hasOpenCardGroup = openCardGroupId !== null;
      const cardGroupId: string = openCardGroupId ?? `card-group-${nextGroupSequence}`;
      if (!openCardGroupId) {
        nextGroupSequence += 1;
        openCardGroupId = cardGroupId;
      }
      block.meta = {
        ...(block.meta ?? {}),
        cardGroupId,
        cardGroupRole: hasOpenCardGroup ? "inner" : "start",
      };
      continue;
    }

    if (block.kind === "card-end") {
      if (!openCardGroupId) {
        continue;
      }
      block.meta = {
        ...(block.meta ?? {}),
        cardGroupId: openCardGroupId,
        cardGroupRole: "end",
      };
      openCardGroupId = null;
      continue;
    }

    if (!openCardGroupId) {
      continue;
    }
    block.meta = {
      ...(block.meta ?? {}),
      cardGroupId: openCardGroupId,
      cardGroupRole: "inner",
    };
  }

  return nextBlocks;
};

export const assignListGroupMeta = (blocks: MarkdownBlock[]): MarkdownBlock[] => {
  if (blocks.length === 0) {
    return blocks;
  }

  const hasHybridListMeta = blocks.some((block) =>
    (block.kind === "ordered-list" || block.kind === "unordered-list") &&
    (
      typeof block.meta?.listDepth === "number" ||
      typeof block.meta?.listIndentWidth === "number" ||
      typeof block.meta?.listParentStartLine === "number" ||
      typeof block.meta?.listItemType === "string" ||
      typeof block.meta?.listGroupId === "string"
    ));
  if (!hasHybridListMeta) {
    return blocks;
  }

  const nextBlocks = blocks.map((block) => ({
    ...block,
    meta: block.meta ? { ...block.meta } : undefined,
  }));
  let activeListGroupId: string | null = null;
  let nextGroupSequence = 1;

  for (let index = 0; index < nextBlocks.length; index += 1) {
    const block = nextBlocks[index]!;
    const isListBlock = block.kind === "ordered-list" || block.kind === "unordered-list";
    if (!isListBlock) {
      activeListGroupId = null;
      continue;
    }
    if (!activeListGroupId) {
      activeListGroupId = `list-group-${nextGroupSequence}`;
      nextGroupSequence += 1;
    }
    block.meta = {
      ...(block.meta ?? {}),
      listGroupId: activeListGroupId,
    };
  }

  return nextBlocks;
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

type ListLineMatch = {
  kind: "ordered-list" | "unordered-list";
  itemType: "ordered" | "unordered";
  indentWidth: number;
  orderedDelimiter?: "." | ")";
  unorderedMarker?: "-" | "+" | "*";
};

const resolveListLineMatch = (line: string): ListLineMatch | null => {
  const orderedMatch = matchOrderedListLine(line);
  if (orderedMatch) {
    return {
      kind: "ordered-list",
      itemType: "ordered",
      indentWidth: getIndentWidth(orderedMatch[1] ?? ""),
      orderedDelimiter: resolveOrderedDelimiter(orderedMatch[3] ?? "."),
    };
  }

  const unorderedMatch = matchUnorderedListLine(line);
  if (unorderedMatch) {
    const marker = unorderedMatch[2];
    const unorderedMarker: "-" | "+" | "*" =
      marker === "+" || marker === "*" ? marker : "-";
    return {
      kind: "unordered-list",
      itemType: "unordered",
      indentWidth: getIndentWidth(unorderedMatch[1] ?? ""),
      unorderedMarker,
    };
  }

  return null;
};

const resolveParseProfile = (options?: ParseMarkdownBlocksOptions): MarkdownBlockParseProfile =>
  options?.profile ?? "default";

export const parseMarkdownBlocks = (
  markdown: string,
  options?: ParseMarkdownBlocksOptions,
): MarkdownBlock[] => {
  if (markdown.length === 0) {
    return [];
  }

  const parseProfile = resolveParseProfile(options);
  const lines = markdown.split("\n");
  const lineStarts = buildLineStarts(markdown, lines);
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  let blockIndex = 0;
  let nextListGroupSequence = 1;
  let activeListGroupId: string | null = null;
  const listParentStack: Array<{ indentWidth: number; startLine: number }> = [];
  const resetListContext = () => {
    activeListGroupId = null;
    listParentStack.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const nextLine = lines[i + 1] ?? "";
    const structuralDirective = resolveStructuralDirectiveToken(line);
    const listLineMatch = resolveListLineMatch(line);
    if (!listLineMatch) {
      resetListContext();
    }

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

    if (isDatabaseBlockMarker(line)) {
      let end = i;
      for (let j = i + 1; j < lines.length; j += 1) {
        end = j;
        if (isDatabaseBlockMarker(lines[j] ?? "")) {
          break;
        }
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "database-block", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (structuralDirective === "#card") {
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "card-start", i, i));
      blockIndex += 1;
      i += 1;
      continue;
    }

    if (structuralDirective === "#endcard") {
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "card-end", i, i));
      blockIndex += 1;
      i += 1;
      continue;
    }

    if (structuralDirective === "#help") {
      let end = i;
      for (let j = i + 1; j < lines.length; j += 1) {
        end = j;
        if (resolveStructuralDirectiveToken(lines[j] ?? "") === "#helpend") {
          break;
        }
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "help-block", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (isStandaloneImageEmbedLine(line)) {
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "image-embed", i, i));
      blockIndex += 1;
      i += 1;
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
      while (end + 1 < lines.length) {
        const nextBlockquoteLine = lines[end + 1] ?? "";
        if (!isBlockquoteLine(nextBlockquoteLine)) {
          break;
        }
        if (resolveStructuralDirectiveToken(nextBlockquoteLine) !== null) {
          break;
        }
        end += 1;
      }
      blocks.push(buildBlock(markdown, lines, lineStarts, blockIndex, "blockquote", i, end));
      blockIndex += 1;
      i = end + 1;
      continue;
    }

    if (listLineMatch) {
      if (parseProfile === "hybrid-list-items") {
        if (!activeListGroupId) {
          activeListGroupId = `list-group-${nextListGroupSequence}`;
          nextListGroupSequence += 1;
        }
        while (
          listParentStack.length > 0 &&
          (listParentStack[listParentStack.length - 1]?.indentWidth ?? 0) >= listLineMatch.indentWidth
        ) {
          listParentStack.pop();
        }
        const parent = listParentStack[listParentStack.length - 1] ?? null;
        const listDepth = listParentStack.length;
        let end = i;
        while (end + 1 < lines.length && isListContinuationLine(lines[end + 1] ?? "")) {
          if (isListStartLine(lines[end + 1] ?? "")) {
            break;
          }
          end += 1;
        }

        blocks.push(
          buildBlock(markdown, lines, lineStarts, blockIndex, listLineMatch.kind, i, end, {
            orderedDelimiter: listLineMatch.orderedDelimiter,
            unorderedMarker: listLineMatch.unorderedMarker,
            listGroupId: activeListGroupId,
            listDepth,
            listIndentWidth: listLineMatch.indentWidth,
            listParentStartLine: parent?.startLine,
            listItemType: listLineMatch.itemType,
          }),
        );
        listParentStack.push({
          indentWidth: listLineMatch.indentWidth,
          startLine: i,
        });
        blockIndex += 1;
        i = end + 1;
        continue;
      }

      let end = i;
      while (end + 1 < lines.length && isListContinuationLine(lines[end + 1] ?? "")) {
        end += 1;
      }
      blocks.push(
        buildBlock(markdown, lines, lineStarts, blockIndex, listLineMatch.kind, i, end, {
          orderedDelimiter: listLineMatch.orderedDelimiter,
          unorderedMarker: listLineMatch.unorderedMarker,
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

  return assignCardGroupMeta(assignListGroupMeta(blocks));
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

export const normalizeQuotePrefixedHashLines = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }

  const sourceLines = markdown.split("\n");
  const normalizedLines: string[] = [];
  let inCodeFence = false;

  for (const sourceLine of sourceLines) {
    const trimmed = sourceLine.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      normalizedLines.push(sourceLine);
      continue;
    }
    if (inCodeFence) {
      normalizedLines.push(sourceLine);
      continue;
    }
    const match = sourceLine.match(quotePrefixedHashLinePattern);
    if (!match) {
      normalizedLines.push(sourceLine);
      continue;
    }
    normalizedLines.push(`${match[1] ?? ""}${match[2] ?? ""}`);
  }

  return normalizedLines.join("\n");
};

export const normalizeHelpBlockSource = (blockRaw: string) => {
  if (!blockRaw) {
    return blockRaw;
  }
  const sourceLines = blockRaw.split("\n");
  const firstNonBlankLine = sourceLines.find((line) => line.trim().length > 0) ?? "";
  const shouldStripQuoteMarkers = isQuotedStructuralDirectiveLine(firstNonBlankLine, "#help");
  const normalizedLines: string[] = [];
  for (const sourceLine of sourceLines) {
    const line = shouldStripQuoteMarkers
      ? stripLeadingBlockquoteMarkers(sourceLine)
      : sourceLine;
    const directive = resolveStructuralDirectiveToken(line);
    if (directive === "#help") {
      normalizedLines.push("#help");
      continue;
    }
    if (directive !== "#helpend") {
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

  const sourceLines = blockRaw.split("\n");
  const firstNonBlankLine = sourceLines.find((line) => line.trim().length > 0) ?? "";
  const shouldStripQuoteMarkers = isQuotedStructuralDirectiveLine(firstNonBlankLine, "#card");
  const lines = sourceLines.map((sourceLine) => {
    const line = shouldStripQuoteMarkers
      ? stripLeadingBlockquoteMarkers(sourceLine)
      : sourceLine;
    const directive = resolveStructuralDirectiveToken(line);
    if (directive === "#card") {
      return "#card";
    }
    if (directive === "#endcard") {
      return "#endcard";
    }
    return line;
  });
  const normalizedCardLines = lines.join("\n");
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
    return normalizedCardLines;
  }

  if (closingLineSuffix.trim().length === 0) {
    return normalizedCardLines;
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

const splitLeadingFrontmatterPrefix = (markdown: string) => {
  const match = markdown.match(frontmatterPrefixPattern);
  if (!match) {
    return null;
  }
  const frontmatterPrefix = match[0] ?? "";
  return {
    frontmatterPrefix,
    body: markdown.slice(frontmatterPrefix.length),
  };
};

const normalizeHorizontalRuleSpacingInBody = (markdown: string) => {
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

export const normalizeHorizontalRuleSpacingInMarkdown = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }

  const frontmatterSlice = splitLeadingFrontmatterPrefix(markdown);
  if (!frontmatterSlice) {
    return normalizeHorizontalRuleSpacingInBody(markdown);
  }

  const normalizedBody = normalizeHorizontalRuleSpacingInBody(frontmatterSlice.body);
  if (normalizedBody === frontmatterSlice.body) {
    return markdown;
  }
  return `${frontmatterSlice.frontmatterPrefix}${normalizedBody}`;
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
    block.kind === "database-block" ||
    block.kind === "help-block" ||
    block.kind === "image-embed" ||
    block.kind === "ordered-list" ||
    block.kind === "unordered-list" ||
    block.kind === "blockquote"
  );
};
