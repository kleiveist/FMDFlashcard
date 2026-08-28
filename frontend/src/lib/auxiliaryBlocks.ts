/**
 * @file frontend/src/lib/auxiliaryBlocks.ts
 *
 * Zweck:
 * - Extrahiert Help-Bloecke, ohne regulaere Syntaxerkennung zu stoeren.
 */

export type AuxiliaryBlockKind = "help";

export type AuxiliaryBlockInfo = {
  kind: AuxiliaryBlockKind;
  startIndex: number;
  endIndex: number;
  text: string;
};

export type AuxiliaryBlockExtraction = {
  helpText: string[];
  contentLines: string[];
  blocks: AuxiliaryBlockInfo[];
};

const helpStartPattern = /^\s*#help\s*$/i;
const helpEndPattern = /^\s*#helpend\s*$/i;
const fencePattern = /^\s*(```|~~~)/;
const separatorLinePattern = /^\s*---\s*$/;

const normalizeLines = (value: string) => value.replace(/\r\n?/g, "\n").split("\n");

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

export const extractAuxiliaryBlocksFromLines = (lines: string[]): AuxiliaryBlockExtraction => {
  const helpText: string[] = [];
  const contentLines: string[] = [];
  const blocks: AuxiliaryBlockInfo[] = [];
  let activeStartIndex = -1;
  let activeLines: string[] = [];
  let inFence = false;
  let fenceToken = "";

  const flushActive = (endIndex: number) => {
    if (activeStartIndex < 0) {
      return;
    }
    const text = trimEmptyLines(activeLines).join("\n").trim();
    if (text.length > 0) {
      const block = {
        kind: "help" as const,
        startIndex: activeStartIndex,
        endIndex,
        text,
      };
      helpText.push(text);
      blocks.push(block);
    }
    activeStartIndex = -1;
    activeLines = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(fencePattern);

    if (activeStartIndex >= 0) {
      if (fenceMatch) {
        if (inFence && fenceMatch[1] === fenceToken) {
          inFence = false;
          fenceToken = "";
        } else if (!inFence) {
          inFence = true;
          fenceToken = fenceMatch[1] ?? "";
        }
        activeLines.push(line);
        return;
      }

      if (!inFence && helpEndPattern.test(line)) {
        flushActive(index);
        return;
      }

      if (!inFence && separatorLinePattern.test(line)) {
        flushActive(index - 1);
        contentLines.push(line);
        return;
      }

      activeLines.push(line);
      return;
    }

    if (fenceMatch) {
      if (inFence && fenceMatch[1] === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[1] ?? "";
      }
      contentLines.push(line);
      return;
    }

    if (!inFence && helpStartPattern.test(line)) {
      activeStartIndex = index;
      activeLines = [];
      return;
    }

    contentLines.push(line);
  });

  if (activeStartIndex >= 0) {
    flushActive(Math.max(lines.length - 1, activeStartIndex));
  }

  return {
    helpText,
    contentLines,
    blocks,
  };
};

export type HelpBlockExtraction = {
  helpText: string[];
  contentLines: string[];
};

export const extractHelpBlocksFromLines = (lines: string[]): HelpBlockExtraction => {
  const extracted = extractAuxiliaryBlocksFromLines(lines);
  return {
    helpText: extracted.helpText,
    contentLines: extracted.contentLines,
  };
};

export const stripAuxiliaryBlocksFromLines = (lines: string[]) =>
  extractAuxiliaryBlocksFromLines(lines).contentLines;

export const extractAuxiliaryBlocksFromText = (value: string) =>
  extractAuxiliaryBlocksFromLines(normalizeLines(value));
