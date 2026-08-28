import katex from "katex";
import "katex/dist/katex.min.css";
import { type ReactNode } from "react";

export type MathToken =
  | {
    type: "text";
    value: string;
    start: number;
    end: number;
  }
  | {
    type: "inline-math" | "display-math";
    value: string;
    raw: string;
    start: number;
    end: number;
  };

export type MathRenderResult =
  | {
    status: "success";
    html: string;
  }
  | {
    status: "error";
    source: string;
    message: string;
  };

type Segment = {
  kind: "text" | "code";
  start: number;
  end: number;
  value: string;
};

type Range = {
  start: number;
  end: number;
};

const trimTrailingCarriageReturn = (line: string) =>
  line.endsWith("\r") ? line.slice(0, -1) : line;

const resolveFenceOpening = (line: string) => {
  const trimmed = trimTrailingCarriageReturn(line).trimStart();
  const match = trimmed.match(/^(`{3,}|~{3,})/);
  if (!match) {
    return null;
  }
  const marker = match[1] ?? "";
  if (!marker) {
    return null;
  }
  return {
    char: marker[0] ?? "`",
    length: marker.length,
  };
};

const isFenceClosingLine = (line: string, char: string, minLength: number) => {
  const trimmed = trimTrailingCarriageReturn(line).trimStart();
  if (!trimmed.startsWith(char.repeat(minLength))) {
    return false;
  }
  let index = 0;
  while (trimmed[index] === char) {
    index += 1;
  }
  return trimmed.slice(index).trim().length === 0;
};

const splitFenceCodeSegments = (source: string) => {
  if (!source) {
    return [] as Segment[];
  }

  const segments: Segment[] = [];
  let cursor = 0;
  let bufferStart = 0;
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  const pushSegment = (kind: Segment["kind"], start: number, end: number) => {
    if (end <= start) {
      return;
    }
    segments.push({
      kind,
      start,
      end,
      value: source.slice(start, end),
    });
  };

  while (cursor < source.length) {
    const lineBreakIndex = source.indexOf("\n", cursor);
    const lineEnd = lineBreakIndex === -1 ? source.length : lineBreakIndex;
    const nextCursor = lineBreakIndex === -1 ? source.length : lineBreakIndex + 1;
    const line = source.slice(cursor, lineEnd);

    if (!inFence) {
      const opening = resolveFenceOpening(line);
      if (opening) {
        pushSegment("text", bufferStart, cursor);
        inFence = true;
        fenceChar = opening.char;
        fenceLength = opening.length;
        bufferStart = cursor;
      }
    } else if (isFenceClosingLine(line, fenceChar, fenceLength)) {
      pushSegment("code", bufferStart, nextCursor);
      inFence = false;
      fenceChar = "";
      fenceLength = 0;
      bufferStart = nextCursor;
    }

    cursor = nextCursor;
  }

  if (bufferStart < source.length) {
    pushSegment(inFence ? "code" : "text", bufferStart, source.length);
  }

  return segments;
};

const findMatchingBacktickRun = (
  source: string,
  fromIndex: number,
  markerLength: number,
) => {
  const marker = "`".repeat(markerLength);
  let searchFrom = fromIndex;
  while (searchFrom < source.length) {
    const index = source.indexOf(marker, searchFrom);
    if (index < 0) {
      return -1;
    }
    const before = source[index - 1];
    const after = source[index + markerLength];
    if (before !== "`" && after !== "`") {
      return index;
    }
    searchFrom = index + 1;
  }
  return -1;
};

const splitInlineCodeSegments = (source: string, offset = 0) => {
  if (!source) {
    return [] as Segment[];
  }

  const segments: Segment[] = [];
  let cursor = 0;
  let textStart = 0;

  const pushSegment = (kind: Segment["kind"], start: number, end: number) => {
    if (end <= start) {
      return;
    }
    segments.push({
      kind,
      start: offset + start,
      end: offset + end,
      value: source.slice(start, end),
    });
  };

  while (cursor < source.length) {
    if (source[cursor] !== "`") {
      cursor += 1;
      continue;
    }

    let markerLength = 1;
    while (source[cursor + markerLength] === "`") {
      markerLength += 1;
    }
    const closeIndex = findMatchingBacktickRun(source, cursor + markerLength, markerLength);
    if (closeIndex < 0) {
      cursor += markerLength;
      continue;
    }

    pushSegment("text", textStart, cursor);
    pushSegment("code", cursor, closeIndex + markerLength);
    cursor = closeIndex + markerLength;
    textStart = cursor;
  }

  pushSegment("text", textStart, source.length);
  return segments;
};

const isEscapedAt = (source: string, index: number) => {
  let slashCount = 0;
  let cursor = index - 1;
  while (cursor >= 0 && source[cursor] === "\\") {
    slashCount += 1;
    cursor -= 1;
  }
  return slashCount % 2 === 1;
};

const findClosingMathDelimiter = (
  source: string,
  fromIndex: number,
  delimiter: "$" | "$$",
) => {
  let searchFrom = fromIndex;
  while (searchFrom <= source.length - delimiter.length) {
    const closeIndex = source.indexOf(delimiter, searchFrom);
    if (closeIndex < 0) {
      return -1;
    }
    if (!isEscapedAt(source, closeIndex)) {
      return closeIndex;
    }
    searchFrom = closeIndex + 1;
  }
  return -1;
};

const appendTextToken = (tokens: MathToken[], start: number, end: number, value: string) => {
  if (!value || end <= start) {
    return;
  }
  const previous = tokens[tokens.length - 1];
  if (previous && previous.type === "text" && previous.end === start) {
    previous.end = end;
    previous.value += value;
    return;
  }
  tokens.push({
    type: "text",
    value,
    start,
    end,
  });
};

const tokenizeMathSegment = (source: string, offset: number) => {
  const tokens: MathToken[] = [];
  let cursor = 0;
  let textStart = 0;

  while (cursor < source.length) {
    if (source[cursor] !== "$" || isEscapedAt(source, cursor)) {
      cursor += 1;
      continue;
    }

    const isDisplay = source[cursor + 1] === "$";
    const delimiter = isDisplay ? "$$" : "$";
    const openLength = isDisplay ? 2 : 1;
    const closeIndex = findClosingMathDelimiter(source, cursor + openLength, delimiter);

    if (closeIndex < 0) {
      cursor += openLength;
      continue;
    }

    appendTextToken(
      tokens,
      offset + textStart,
      offset + cursor,
      source.slice(textStart, cursor),
    );

    const tokenStart = cursor;
    const tokenEnd = closeIndex + openLength;
    tokens.push({
      type: isDisplay ? "display-math" : "inline-math",
      value: source.slice(cursor + openLength, closeIndex),
      raw: source.slice(tokenStart, tokenEnd),
      start: offset + tokenStart,
      end: offset + tokenEnd,
    });

    cursor = tokenEnd;
    textStart = cursor;
  }

  appendTextToken(
    tokens,
    offset + textStart,
    offset + source.length,
    source.slice(textStart),
  );

  return tokens;
};

const collectCodeContextSegments = (source: string) => {
  const codeSegments: Segment[] = [];
  const fenceSegments = splitFenceCodeSegments(source);
  for (const fenceSegment of fenceSegments) {
    if (fenceSegment.kind === "code") {
      codeSegments.push(fenceSegment);
      continue;
    }
    const inlineSegments = splitInlineCodeSegments(fenceSegment.value, fenceSegment.start);
    for (const inlineSegment of inlineSegments) {
      if (inlineSegment.kind === "code") {
        codeSegments.push(inlineSegment);
      }
    }
  }
  return codeSegments;
};

const clampRange = (source: string, range: Range) => {
  const max = source.length;
  const start = Math.max(0, Math.min(range.start, max));
  const end = Math.max(0, Math.min(range.end, max));
  return start <= end ? { start, end } : { start: end, end: start };
};

const rangesOverlap = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) =>
  leftStart < rightEnd && rightStart < leftEnd;

type KatexRuntime = {
  renderToString: (
    source: string,
    options: {
      displayMode: boolean;
      throwOnError: boolean;
      output: "html";
      trust: boolean;
      strict: "warn";
    },
  ) => string;
};

const katexRuntime = katex as KatexRuntime;
const mathRenderCache = new Map<string, MathRenderResult>();

const renderMathMarkup = (source: string, displayMode: boolean): MathRenderResult => {
  const cacheKey = `${displayMode ? "display" : "inline"}::${source}`;
  const cached = mathRenderCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const html = katexRuntime.renderToString(source, {
      displayMode,
      throwOnError: true,
      output: "html",
      trust: false,
      strict: "warn",
    });
    const result: MathRenderResult = {
      status: "success",
      html,
    };
    mathRenderCache.set(cacheKey, result);
    return result;
  } catch (error) {
    const result: MathRenderResult = {
      status: "error",
      source,
      message: error instanceof Error ? error.message : "Unable to render LaTeX.",
    };
    mathRenderCache.set(cacheKey, result);
    return result;
  }
};

export const tokenizeMarkdownMath = (source: string): MathToken[] => {
  if (!source) {
    return [];
  }

  const tokens: MathToken[] = [];
  const fenceSegments = splitFenceCodeSegments(source);
  for (const fenceSegment of fenceSegments) {
    if (fenceSegment.kind === "code") {
      appendTextToken(tokens, fenceSegment.start, fenceSegment.end, fenceSegment.value);
      continue;
    }

    const inlineSegments = splitInlineCodeSegments(fenceSegment.value, fenceSegment.start);
    for (const inlineSegment of inlineSegments) {
      if (inlineSegment.kind === "code") {
        appendTextToken(tokens, inlineSegment.start, inlineSegment.end, inlineSegment.value);
        continue;
      }
      const mathTokens = tokenizeMathSegment(inlineSegment.value, inlineSegment.start);
      if (mathTokens.length === 0) {
        appendTextToken(tokens, inlineSegment.start, inlineSegment.end, inlineSegment.value);
        continue;
      }
      for (const token of mathTokens) {
        if (token.type === "text") {
          appendTextToken(tokens, token.start, token.end, token.value);
        } else {
          tokens.push(token);
        }
      }
    }
  }

  return tokens;
};

export const rangeIntersectsMarkdownCodeContext = (source: string, range: Range) => {
  const normalized = clampRange(source, range);
  const codeSegments = collectCodeContextSegments(source);
  if (normalized.start === normalized.end) {
    return codeSegments.some((segment) =>
      normalized.start >= segment.start && normalized.start < segment.end);
  }
  return codeSegments.some((segment) =>
    rangesOverlap(normalized.start, normalized.end, segment.start, segment.end));
};

export const findMathTokenCoveringRange = (source: string, range: Range) => {
  const normalized = clampRange(source, range);
  if (rangeIntersectsMarkdownCodeContext(source, normalized)) {
    return null;
  }

  const candidates = tokenizeMarkdownMath(source).filter(
    (token): token is Extract<MathToken, { type: "inline-math" | "display-math" }> =>
      (token.type === "inline-math" || token.type === "display-math") &&
      token.start <= normalized.start &&
      token.end >= normalized.end,
  );

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => (left.end - left.start) - (right.end - right.start));
  return candidates[0] ?? null;
};

export const renderMarkdownMathNode = (
  source: string,
  options?: {
    keyPrefix?: string;
    renderText?: (value: string, key: string) => ReactNode;
  },
) => {
  const keyPrefix = options?.keyPrefix ?? "md-math";
  const renderText = options?.renderText;
  const tokens = tokenizeMarkdownMath(source);

  if (tokens.length === 0) {
    return source.length === 0 ? [] : [renderText ? renderText(source, `${keyPrefix}-text-0`) : source];
  }

  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.type === "text") {
      return renderText ? renderText(token.value, `${key}-text`) : token.value;
    }

    const displayMode = token.type === "display-math";
    const renderResult = renderMathMarkup(token.value, displayMode);
    const className = [
      "md-math",
      displayMode ? "md-math-display-in-flow" : "md-math-inline",
      renderResult.status === "success" ? "md-math-success" : "md-math-fallback",
    ].join(" ");

    if (renderResult.status === "success") {
      return (
        <span
          key={key}
          className={className}
          data-md-math-kind={token.type}
        >
          <span
            className="md-math-katex"
            dangerouslySetInnerHTML={{ __html: renderResult.html }}
          />
        </span>
      );
    }

    const fallbackSource = displayMode ? `$$${token.value}$$` : `$${token.value}$`;
    return (
      <span
        key={key}
        className={className}
        data-md-math-kind={token.type}
        title={renderResult.message}
        role="status"
        aria-label="Math rendering failed"
      >
        <span className="md-math-fallback-source">{fallbackSource}</span>
        <span className="md-math-fallback-badge" aria-hidden="true">
          !
        </span>
      </span>
    );
  });
};

export const normalizeMultilineInlineMathOnCommit = (markdownOrDraft: string) => {
  if (!markdownOrDraft) {
    return markdownOrDraft;
  }

  const tokens = tokenizeMarkdownMath(markdownOrDraft);
  if (tokens.length === 0) {
    return markdownOrDraft;
  }

  return tokens
    .map((token) => {
      if (token.type === "text") {
        return token.value;
      }
      if (token.type === "display-math") {
        return token.raw;
      }
      if (!/[\r\n]/.test(token.value)) {
        return token.raw;
      }
      const normalizedContent = token.value.replace(/\s+/g, " ").trim();
      return `$${normalizedContent}$`;
    })
    .join("");
};
