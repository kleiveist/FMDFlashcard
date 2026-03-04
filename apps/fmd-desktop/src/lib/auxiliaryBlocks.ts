/**
 * @file apps/fmd-desktop/src/lib/auxiliaryBlocks.ts
 *
 * Zweck:
 * - Extrahiert Hilfs- und Medien-Bloecke, ohne regulare Syntaxerkennung zu stoeren.
 */

export type AuxiliaryBlockKind = "help" | "media";

export type AuxiliaryBlockInfo = {
  kind: AuxiliaryBlockKind;
  startIndex: number;
  endIndex: number;
  text: string;
};

export type AuxiliaryBlockExtraction = {
  helpText: string[];
  mediaText: string[];
  contentLines: string[];
  blocks: AuxiliaryBlockInfo[];
};

export type ExtractAuxiliaryBlocksOptions = {
  kinds?: AuxiliaryBlockKind[];
};

const helpStartPattern = /^\s*#help\s*$/i;
const helpEndPattern = /^\s*#helpend\s*$/i;
const mediaStartPattern = /^\s*#media\s*$/i;
const mediaEndPattern = /^\s*#mediaend\s*$/i;
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

const matchesStart = (kind: AuxiliaryBlockKind, line: string) =>
  kind === "help" ? helpStartPattern.test(line) : mediaStartPattern.test(line);

const matchesEnd = (kind: AuxiliaryBlockKind, line: string) =>
  kind === "help" ? helpEndPattern.test(line) : mediaEndPattern.test(line);

export const extractAuxiliaryBlocksFromLines = (
  lines: string[],
  options?: ExtractAuxiliaryBlocksOptions,
): AuxiliaryBlockExtraction => {
  const kinds = options?.kinds ?? ["help", "media"];
  const enabledKinds = new Set<AuxiliaryBlockKind>(kinds);
  const helpText: string[] = [];
  const mediaText: string[] = [];
  const contentLines: string[] = [];
  const blocks: AuxiliaryBlockInfo[] = [];
  let activeKind: AuxiliaryBlockKind | null = null;
  let activeStartIndex = -1;
  let activeLines: string[] = [];
  let inFence = false;
  let fenceToken = "";

  const flushActive = (endIndex: number) => {
    if (!activeKind) {
      return;
    }
    const text = trimEmptyLines(activeLines).join("\n").trim();
    if (text.length > 0) {
      blocks.push({
        kind: activeKind,
        startIndex: activeStartIndex,
        endIndex: endIndex,
        text,
      });
      if (activeKind === "help") {
        helpText.push(text);
      } else {
        mediaText.push(text);
      }
    }
    activeKind = null;
    activeStartIndex = -1;
    activeLines = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(fencePattern);

    if (activeKind) {
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

      if (!inFence && matchesEnd(activeKind, line)) {
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

    if (!inFence) {
      const nextKind = Array.from(enabledKinds).find((kind) =>
        matchesStart(kind, line),
      );
      if (nextKind) {
        activeKind = nextKind;
        activeStartIndex = index;
        activeLines = [];
        return;
      }
    }

    contentLines.push(line);
  });

  if (activeKind) {
    flushActive(Math.max(lines.length - 1, activeStartIndex));
  }

  return {
    helpText,
    mediaText,
    contentLines,
    blocks,
  };
};

export type HelpBlockExtraction = {
  helpText: string[];
  contentLines: string[];
};

export const extractHelpBlocksFromLines = (lines: string[]): HelpBlockExtraction => {
  const extracted = extractAuxiliaryBlocksFromLines(lines, { kinds: ["help"] });
  return {
    helpText: extracted.helpText,
    contentLines: extracted.contentLines,
  };
};

export const stripAuxiliaryBlocksFromLines = (
  lines: string[],
  options?: ExtractAuxiliaryBlocksOptions,
) => extractAuxiliaryBlocksFromLines(lines, options).contentLines;

export const extractAuxiliaryBlocksFromText = (
  value: string,
  options?: ExtractAuxiliaryBlocksOptions,
) => extractAuxiliaryBlocksFromLines(normalizeLines(value), options);
