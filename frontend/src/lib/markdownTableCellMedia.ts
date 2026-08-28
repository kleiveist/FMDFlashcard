/**
 * @file frontend/src/lib/markdownTableCellMedia.ts
 *
 * Zweck:
 * - Zentralisiert die Segmentierung von Tabellenzelleninhalten fuer
 *   Obsidian-PNG-Embeds und standalone Markdown-Bilder.
 */

import {
  splitMarkdownMediaSegments,
  type MediaItem,
} from "./cardMedia";
import { normalizeMarkdownTableCellPreviewValue } from "./markdownTables";

export type MarkdownTableCellSegment =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "media";
      items: MediaItem[];
      raw: string;
    }
  | {
      kind: "markdown-image";
      src: string;
      alt?: string;
      title?: string;
      raw: string;
    };

export const SHARED_TABLE_WRAP_CLASS = "md-table-wrap";
export const SHARED_TABLE_CELL_CONTENT_CLASS = "md-table-cell-content";
export const SHARED_TABLE_CELL_MEDIA_CLASS = "md-table-cell-media";
export const SHARED_TABLE_CELL_IMAGE_CLASS = "md-table-cell-image";

type ParsedMarkdownImage = {
  src: string;
  alt?: string;
  title?: string;
};

const standaloneMarkdownImagePattern = /^\s*!\[([^\]\n]*)\]\((.+)\)\s*$/;

const parseMarkdownImageTarget = (
  rawTarget: string,
): { src: string; title?: string } | null => {
  const target = rawTarget.trim();
  if (!target) {
    return null;
  }

  let src = "";
  let remainder = "";
  if (target.startsWith("<")) {
    const closingIndex = target.indexOf(">");
    if (closingIndex <= 1) {
      return null;
    }
    src = target.slice(1, closingIndex).trim();
    remainder = target.slice(closingIndex + 1).trim();
  } else {
    const whitespaceIndex = target.search(/\s/);
    if (whitespaceIndex < 0) {
      src = target;
      remainder = "";
    } else {
      src = target.slice(0, whitespaceIndex).trim();
      remainder = target.slice(whitespaceIndex).trim();
    }
  }

  if (!src) {
    return null;
  }

  if (!remainder) {
    return { src };
  }

  const quote = remainder[0];
  if ((quote === "\"" || quote === "'") && remainder.endsWith(quote)) {
    const title = remainder.slice(1, -1).trim();
    return title ? { src, title } : { src };
  }
  if (remainder.startsWith("(") && remainder.endsWith(")")) {
    const title = remainder.slice(1, -1).trim();
    return title ? { src, title } : { src };
  }

  return null;
};

const parseStandaloneMarkdownImageLine = (line: string): ParsedMarkdownImage | null => {
  const match = line.match(standaloneMarkdownImagePattern);
  if (!match) {
    return null;
  }
  const altRaw = match[1] ?? "";
  const targetRaw = match[2] ?? "";
  const parsedTarget = parseMarkdownImageTarget(targetRaw);
  if (!parsedTarget) {
    return null;
  }
  const alt = altRaw.trim();
  return {
    src: parsedTarget.src,
    alt: alt || undefined,
    title: parsedTarget.title,
  };
};

const splitMarkdownImageLines = (
  source: string,
): MarkdownTableCellSegment[] => {
  if (!source) {
    return [];
  }

  const lines = source.split("\n");
  const segments: MarkdownTableCellSegment[] = [];
  const textBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length === 0) {
      return;
    }
    const text = textBuffer.join("\n");
    if (text.length > 0) {
      segments.push({
        kind: "text",
        text,
      });
    }
    textBuffer.length = 0;
  };

  lines.forEach((line) => {
    const parsedImage = parseStandaloneMarkdownImageLine(line);
    if (!parsedImage) {
      textBuffer.push(line);
      return;
    }

    flushText();
    segments.push({
      kind: "markdown-image",
      src: parsedImage.src,
      alt: parsedImage.alt,
      title: parsedImage.title,
      raw: line,
    });
  });

  flushText();
  return segments;
};

export const splitMarkdownTableCellSegments = (
  cellRaw: string,
  scope: string,
): MarkdownTableCellSegment[] => {
  const normalizedCell = normalizeMarkdownTableCellPreviewValue(cellRaw);
  if (!normalizedCell) {
    return [];
  }

  const mediaSegments = splitMarkdownMediaSegments(normalizedCell, scope);
  if (mediaSegments.length === 0) {
    return splitMarkdownImageLines(normalizedCell);
  }

  const segments: MarkdownTableCellSegment[] = [];
  mediaSegments.forEach((segment) => {
    if (segment.kind === "media") {
      segments.push({
        kind: "media",
        items: segment.items,
        raw: segment.raw,
      });
      return;
    }
    segments.push(...splitMarkdownImageLines(segment.source));
  });
  return segments;
};

export const resolveMarkdownTableCellSegments = ({
  cellSource,
  cellText,
  scope,
}: {
  cellSource: string;
  cellText: string;
  scope: string;
}): MarkdownTableCellSegment[] => {
  const sourceSegments = splitMarkdownTableCellSegments(cellSource, `${scope}-source`);
  if (sourceSegments.some((segment) => segment.kind !== "text")) {
    return sourceSegments;
  }
  return splitMarkdownTableCellSegments(cellText, `${scope}-fallback`);
};
