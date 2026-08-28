/**
 * @file apps/fmd-desktop/src/lib/markdownMedia.ts
 *
 * Zweck:
 * - Gemeinsame Erkennung fuer Obsidian-Style PNG-Embeds und svg-Codefences.
 */

import { normalizeVaultAssetRelativePath } from "./vaultAssets";

export type MarkdownMediaToken =
  | {
      type: "png";
      src: string;
      label?: string;
      raw: string;
      startIndex: number;
      endIndex: number;
    }
  | {
      type: "svg";
      src: "inline";
      inlineSvg: string;
      raw: string;
      startIndex: number;
      endIndex: number;
    };

export type MarkdownMediaPreviewGroup = {
  index: number;
  raw: string;
  tokens: MarkdownMediaToken[];
};

export type MarkdownMediaPreviewData = {
  markdown: string;
  groups: MarkdownMediaPreviewGroup[];
};

export type MarkdownMediaSourceSegment =
  | {
      kind: "markdown";
      source: string;
    }
  | {
      kind: "media";
      raw: string;
      tokens: MarkdownMediaToken[];
    };

const fencePattern = /^\s*(```|~~~)(.*)$/;
const pngPathPattern = /\.png(?:[?#].*)?$/i;
const mediaPlaceholderText = (index: number) => `__FMD_MEDIA_${index}__`;

const normalizeLines = (value: string) => value.replace(/\r\n?/g, "\n").split("\n");

const parseEmbedInner = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("![[") || !trimmed.endsWith("]]")) {
    return null;
  }
  const inner = trimmed.slice(3, -2).trim();
  if (!inner) {
    return null;
  }
  const separatorIndex = inner.indexOf("|");
  const rawTarget = separatorIndex >= 0 ? inner.slice(0, separatorIndex) : inner;
  const rawLabel = separatorIndex >= 0 ? inner.slice(separatorIndex + 1) : "";
  const target = rawTarget.trim();
  if (!target) {
    return null;
  }
  const pathPart = target.split(/[?#]/)[0]?.trim() ?? "";
  if (!pngPathPattern.test(pathPart)) {
    return null;
  }
  if (!pathPart) {
    return null;
  }
  const label = rawLabel.trim();
  return {
    src: pathPart,
    normalizedSrc: normalizeVaultAssetRelativePath(pathPart),
    label: label || undefined,
  };
};

export const parseStandalonePngEmbedLine = (
  line: string,
  lineIndex = 0,
): MarkdownMediaToken | null => {
  const parsed = parseEmbedInner(line);
  if (!parsed) {
    return null;
  }
  return {
    type: "png",
    src: parsed.normalizedSrc ?? parsed.src,
    label: parsed.label,
    raw: line,
    startIndex: lineIndex,
    endIndex: lineIndex,
  };
};

const parseSvgFenceAt = (lines: string[], startIndex: number): MarkdownMediaToken | null => {
  const opening = lines[startIndex] ?? "";
  const openingMatch = opening.trimStart().match(fencePattern);
  if (!openingMatch || (openingMatch[2]?.trim() ?? "") !== "svg") {
    return null;
  }

  const fenceToken = openingMatch[1] ?? "";
  const bodyLines: string[] = [];
  let cursor = startIndex + 1;

  while (cursor < lines.length) {
    const current = lines[cursor] ?? "";
    const closingMatch = current.trimStart().match(fencePattern);
    if (closingMatch && closingMatch[1] === fenceToken) {
      return {
        type: "svg",
        src: "inline",
        inlineSvg: bodyLines.join("\n").trim(),
        raw: lines.slice(startIndex, cursor + 1).join("\n"),
        startIndex,
        endIndex: cursor,
      };
    }
    bodyLines.push(current);
    cursor += 1;
  }

  return null;
};

export const extractMarkdownMediaTokensFromLines = (lines: string[]): MarkdownMediaToken[] => {
  const tokens: MarkdownMediaToken[] = [];
  let index = 0;
  let inFence = false;
  let activeFenceToken = "";

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const fenceMatch = line.trimStart().match(fencePattern);

    if (inFence) {
      if (fenceMatch && fenceMatch[1] === activeFenceToken) {
        inFence = false;
        activeFenceToken = "";
      }
      index += 1;
      continue;
    }

    if (fenceMatch) {
      const svgToken = parseSvgFenceAt(lines, index);
      if (svgToken) {
        tokens.push(svgToken);
        index = svgToken.endIndex + 1;
        continue;
      }
      inFence = true;
      activeFenceToken = fenceMatch[1] ?? "";
      index += 1;
      continue;
    }

    const pngToken = parseStandalonePngEmbedLine(line, index);
    if (pngToken) {
      tokens.push(pngToken);
      index += 1;
      continue;
    }

    index += 1;
  }

  return tokens;
};

export const extractMarkdownMediaTokensFromText = (value?: string | null) =>
  extractMarkdownMediaTokensFromLines(normalizeLines(value ?? ""));

export const stripMarkdownMediaFromLines = (lines: string[]) => {
  const tokens = extractMarkdownMediaTokensFromLines(lines);
  if (tokens.length === 0) {
    return {
      tokens,
      contentLines: [...lines],
    };
  }

  const removed = new Set<number>();
  tokens.forEach((token) => {
    for (let index = token.startIndex; index <= token.endIndex; index += 1) {
      removed.add(index);
    }
  });

  return {
    tokens,
    contentLines: lines.filter((_line, index) => !removed.has(index)),
  };
};

export const splitMarkdownMediaSource = (source: string): MarkdownMediaSourceSegment[] => {
  const lines = normalizeLines(source);
  const tokens = extractMarkdownMediaTokensFromLines(lines);
  if (tokens.length === 0) {
    return source.length > 0 ? [{ kind: "markdown", source }] : [];
  }

  const segments: MarkdownMediaSourceSegment[] = [];
  let lineIndex = 0;

  tokens.forEach((token) => {
    if (token.startIndex > lineIndex) {
      const markdownSource = lines.slice(lineIndex, token.startIndex).join("\n");
      if (markdownSource.length > 0) {
        segments.push({ kind: "markdown", source: markdownSource });
      }
    }
    segments.push({
      kind: "media",
      raw: token.raw,
      tokens: [token],
    });
    lineIndex = token.endIndex + 1;
  });

  if (lineIndex < lines.length) {
    const markdownSource = lines.slice(lineIndex).join("\n");
    if (markdownSource.length > 0) {
      segments.push({ kind: "markdown", source: markdownSource });
    }
  }

  return segments;
};

export const buildMarkdownMediaPreviewData = (markdown: string): MarkdownMediaPreviewData => {
  const lines = normalizeLines(markdown);
  const tokens = extractMarkdownMediaTokensFromLines(lines);
  if (tokens.length === 0) {
    return {
      markdown,
      groups: [],
    };
  }

  const groups = tokens.map((token, index) => ({
    index,
    raw: token.raw,
    tokens: [token],
  }));
  const groupsByStartLine = new Map<number, (typeof groups)[number]>();
  groups.forEach((group) => {
    const startLine = group.tokens[0]?.startIndex;
    if (typeof startLine === "number") {
      groupsByStartLine.set(startLine, group);
    }
  });
  const renderedLines: string[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const group = groupsByStartLine.get(lineIndex) ?? null;
    if (group) {
      renderedLines.push(
        `<div data-fmd-media-block="true" data-media-index="${group.index}">${mediaPlaceholderText(group.index)}</div>`,
      );
      lineIndex = (group.tokens[0]?.endIndex ?? lineIndex) + 1;
      continue;
    }
    renderedLines.push(lines[lineIndex] ?? "");
    lineIndex += 1;
  }

  return {
    markdown: renderedLines.join("\n"),
    groups,
  };
};
