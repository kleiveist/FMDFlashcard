import {
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument,
  type CanvasParseResult,
} from "./document";

export type CanvasMarkdownBlockFormat = "directive" | "fenced";

export type CanvasMarkdownBlock = {
  raw: string;
  source: string;
  format: CanvasMarkdownBlockFormat;
  openLine: string;
  closeLine: string;
};

export type CanvasMarkdownBlockParseResult =
  | { ok: true; block: CanvasMarkdownBlock; document: CanvasDocument }
  | { ok: false; block?: CanvasMarkdownBlock; error: string };

export const CANVAS_BLOCK_START = "#canvas";
export const CANVAS_BLOCK_END = "#canvasend";

const canvasDirectiveStartLinePattern = /^\s*#canvas\s*$/i;
const canvasDirectiveEndLinePattern = /^\s*#canvasend\s*$/i;
const codeFenceStartLinePattern = /^\s*(`{3,}|~{3,})(.*)$/;

const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, "\n");

const getLines = (value: string) => normalizeNewlines(value).split("\n");

export const isCanvasDirectiveStartLine = (line: string) =>
  canvasDirectiveStartLinePattern.test(line);

export const isCanvasDirectiveEndLine = (line: string) =>
  canvasDirectiveEndLinePattern.test(line);

export const parseCanvasFenceStartLine = (line: string) => {
  const match = line.match(codeFenceStartLinePattern);
  if (!match) {
    return null;
  }
  const marker = match[1] ?? "";
  const info = (match[2] ?? "").trim().toLowerCase();
  if (!/^canvas(?:\s|$)/.test(info)) {
    return null;
  }
  return {
    marker,
    closePattern: new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`),
  };
};

const parseAnyFenceStartLine = (line: string) => {
  const match = line.match(codeFenceStartLinePattern);
  if (!match) {
    return null;
  }
  const marker = match[1] ?? "";
  return {
    marker,
    closePattern: new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`),
  };
};

export const resolveCanvasBlockRangeAt = (
  lines: string[],
  startLine: number,
): { startLine: number; endLine: number } | null => {
  const line = lines[startLine] ?? "";
  if (isCanvasDirectiveStartLine(line)) {
    let endLine = startLine;
    for (let index = startLine + 1; index < lines.length; index += 1) {
      endLine = index;
      if (isCanvasDirectiveEndLine(lines[index] ?? "")) {
        break;
      }
    }
    return { startLine, endLine };
  }

  const fence = parseCanvasFenceStartLine(line);
  if (!fence) {
    return null;
  }
  let endLine = startLine;
  for (let index = startLine + 1; index < lines.length; index += 1) {
    endLine = index;
    if (fence.closePattern.test(lines[index] ?? "")) {
      break;
    }
  }
  return { startLine, endLine };
};

export const extractCanvasBlockLineRanges = (lines: string[]) => {
  const ranges: Array<{ startLine: number; endLine: number }> = [];
  let inFence: { closePattern: RegExp } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (inFence) {
      if (inFence.closePattern.test(line)) {
        inFence = null;
      }
      continue;
    }

    const canvasRange = resolveCanvasBlockRangeAt(lines, index);
    if (canvasRange) {
      ranges.push(canvasRange);
      index = canvasRange.endLine;
      continue;
    }

    const fence = parseAnyFenceStartLine(line);
    if (fence) {
      inFence = { closePattern: fence.closePattern };
    }
  }

  return ranges;
};

export const maskCanvasBlockLines = (lines: string[]) => {
  const masked = [...lines];
  for (const range of extractCanvasBlockLineRanges(lines)) {
    for (let lineIndex = range.startLine; lineIndex <= range.endLine; lineIndex += 1) {
      masked[lineIndex] = "";
    }
  }
  return masked;
};

export const parseMarkdownCanvasBlock = (
  raw: string,
): CanvasMarkdownBlockParseResult => {
  const normalized = normalizeNewlines(raw);
  const lines = getLines(normalized);
  const firstLine = lines[0] ?? "";
  const lastLine = lines[lines.length - 1] ?? "";
  let block: CanvasMarkdownBlock | null = null;

  if (isCanvasDirectiveStartLine(firstLine)) {
    const closeLineIndex = lines.findIndex((line, index) =>
      index > 0 && isCanvasDirectiveEndLine(line)
    );
    const sourceEndLine = closeLineIndex >= 0 ? closeLineIndex : lines.length;
    const source = lines.slice(1, sourceEndLine).join("\n").trim();
    block = {
      raw: normalized,
      source,
      format: "directive",
      openLine: firstLine,
      closeLine: closeLineIndex >= 0 ? lines[closeLineIndex] ?? CANVAS_BLOCK_END : CANVAS_BLOCK_END,
    };
  } else {
    const fence = parseCanvasFenceStartLine(firstLine);
    if (fence) {
      const closeLineIndex = lines.findIndex((line, index) =>
        index > 0 && fence.closePattern.test(line)
      );
      const sourceEndLine = closeLineIndex >= 0 ? closeLineIndex : lines.length;
      const source = lines.slice(1, sourceEndLine).join("\n").trim();
      block = {
        raw: normalized,
        source,
        format: "fenced",
        openLine: firstLine,
        closeLine: closeLineIndex >= 0 ? lines[closeLineIndex] ?? lastLine : "```",
      };
    }
  }

  if (!block) {
    return { ok: false, error: "Canvas block must start with #canvas or a canvas code fence." };
  }

  const parsed: CanvasParseResult = parseCanvasDocument(block.source);
  if (!parsed.ok) {
    return { ok: false, block, error: parsed.error };
  }

  return {
    ok: true,
    block,
    document: parsed.document,
  };
};

export const serializeMarkdownCanvasBlock = (
  document: CanvasDocument,
  format: CanvasMarkdownBlockFormat = "directive",
) => {
  const source = serializeCanvasDocument(document).trimEnd();
  if (format === "fenced") {
    return ["```canvas", source, "```"].join("\n");
  }
  return [CANVAS_BLOCK_START, source, CANVAS_BLOCK_END].join("\n");
};

export const replaceMarkdownCanvasBlockSource = (
  raw: string,
  nextSource: string,
) => {
  const parsed = parseMarkdownCanvasBlock(raw);
  const format = parsed.ok ? parsed.block.format : parsed.block?.format ?? "directive";
  if (format === "fenced") {
    const block = parsed.ok ? parsed.block : parsed.block;
    return [
      block?.openLine ?? "```canvas",
      nextSource.trimEnd(),
      block?.closeLine ?? "```",
    ].join("\n");
  }
  return [CANVAS_BLOCK_START, nextSource.trimEnd(), CANVAS_BLOCK_END].join("\n");
};
