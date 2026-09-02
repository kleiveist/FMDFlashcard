export type BacktickFenceScanMatch = {
  blockIndex: number;
  openLineIndex: number;
  closeLineIndex: number;
  openLineRaw: string;
  closeLineRaw: string;
  openIndent: string;
  closeIndent: string;
  openFenceToken: string;
  closeFenceToken: string;
};

export type BacktickFenceDisplayHint = {
  openSourceLine: string;
  closeSourceLine: string;
  openDisplayLine: string;
  closeDisplayLine: string;
};

const backtickFenceOpenLinePattern = /^([ \t]*)(`{3,})([^\n]*)$/;
const backtickFenceCloseLinePattern = /^([ \t]*)(`{3,})[ \t]*$/;
const listLineMarkerPattern = /^(?:[-+*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/;

const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, "\n");

const resolveLineEnding = (value: string): "\n" | "\r\n" =>
  value.includes("\r\n") ? "\r\n" : "\n";

const resolveIndentWidth = (value: string) =>
  Array.from(value).reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);

const resolveLineIndentAndContent = (line: string) => {
  const match = line.match(/^([ \t]*)(.*)$/);
  return {
    indent: match?.[1] ?? "",
    content: match?.[2] ?? "",
  };
};

const isLikelyListScopedFence = (lines: string[], openLineIndex: number, openIndent: string) => {
  if (openLineIndex <= 0) {
    return false;
  }
  if ((lines[openLineIndex - 1] ?? "").trim() === "") {
    return false;
  }

  const openIndentWidth = resolveIndentWidth(openIndent);
  for (let index = openLineIndex - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      break;
    }
    const { indent, content } = resolveLineIndentAndContent(line);
    if (listLineMarkerPattern.test(content)) {
      return openIndentWidth > resolveIndentWidth(indent);
    }
    if (resolveIndentWidth(indent) < openIndentWidth) {
      break;
    }
  }

  return false;
};

export const scanStandaloneBacktickFences = (markdown: string): BacktickFenceScanMatch[] => {
  if (!markdown) {
    return [];
  }

  const lines = normalizeNewlines(markdown).split("\n");
  const matches: BacktickFenceScanMatch[] = [];
  let blockIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const openLineRaw = lines[lineIndex] ?? "";
    const openMatch = openLineRaw.match(backtickFenceOpenLinePattern);
    if (!openMatch) {
      continue;
    }

    const openIndent = openMatch[1] ?? "";
    const openFenceToken = openMatch[2] ?? "```";
    let closeLineIndex = -1;
    let closeLineRaw = "";
    let closeIndent = "";
    let closeFenceToken = "";

    for (let cursor = lineIndex + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor] ?? "";
      const closeMatch = candidate.match(backtickFenceCloseLinePattern);
      if (!closeMatch) {
        continue;
      }
      const candidateFenceToken = closeMatch[2] ?? "";
      if (candidateFenceToken.length < openFenceToken.length) {
        continue;
      }
      closeLineIndex = cursor;
      closeLineRaw = candidate;
      closeIndent = closeMatch[1] ?? "";
      closeFenceToken = candidateFenceToken;
      break;
    }

    if (closeLineIndex < 0) {
      continue;
    }

    matches.push({
      blockIndex,
      openLineIndex: lineIndex,
      closeLineIndex,
      openLineRaw,
      closeLineRaw,
      openIndent,
      closeIndent,
      openFenceToken,
      closeFenceToken,
    });
    blockIndex += 1;
    lineIndex = closeLineIndex;
  }

  return matches;
};

export const normalizeFenceDisplayForRender = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }

  const lineEnding = resolveLineEnding(markdown);
  const lines = normalizeNewlines(markdown).split("\n");
  const fences = scanStandaloneBacktickFences(markdown);
  if (fences.length === 0) {
    return markdown;
  }

  let changed = false;
  for (const fence of fences) {
    if (isLikelyListScopedFence(lines, fence.openLineIndex, fence.openIndent)) {
      continue;
    }

    const openDisplay = fence.openLineRaw.trimStart();
    const closeDisplay = fence.closeLineRaw.trimStart();

    if ((lines[fence.openLineIndex] ?? "") !== openDisplay) {
      lines[fence.openLineIndex] = openDisplay;
      changed = true;
    }
    if ((lines[fence.closeLineIndex] ?? "") !== closeDisplay) {
      lines[fence.closeLineIndex] = closeDisplay;
      changed = true;
    }
  }

  if (!changed) {
    return markdown;
  }
  return lines.join(lineEnding);
};

export const buildBacktickFenceDisplayHints = (markdown: string): BacktickFenceDisplayHint[] => {
  if (!markdown) {
    return [];
  }

  const sourceFences = scanStandaloneBacktickFences(markdown);
  if (sourceFences.length === 0) {
    return [];
  }
  const displayFences = scanStandaloneBacktickFences(normalizeFenceDisplayForRender(markdown));

  return sourceFences.map((sourceFence, index) => {
    const displayFence = displayFences[index] ?? sourceFence;
    return {
      openSourceLine: sourceFence.openLineRaw,
      closeSourceLine: sourceFence.closeLineRaw,
      openDisplayLine: displayFence.openLineRaw,
      closeDisplayLine: displayFence.closeLineRaw,
    };
  });
};
