export type NormalizeLegacyUnorderedListIndentationOptions = {
  indentWidth?: number;
  normalizedMarker?: "-" | "+" | "*";
};

const unorderedListLinePattern = /^([ \t]*)([-+*])(?:\s*(.*))$/;
const taskListLinePattern = /^[ \t]*[-+*]\s+\[[ xX]\](?:\s|$)/;
const fencedCodeLinePattern = /^\s*`{3,}/;
const mathBlockDelimiterLinePattern = /^\s*\$\$\s*$/;

const normalizeLineEndings = (value: string) => value.replace(/\r\n?/g, "\n");
const resolveLineEnding = (value: string) => (value.includes("\r\n") ? "\r\n" : "\n");
const normalizeIndentWhitespace = (value: string) => value.replace(/\u00a0/g, " ");
const isEditorWhitespaceOnly = (value: string) =>
  value.replace(/[\s\u200b\u200c\u200d\ufeff]/g, "").length === 0;

const resolveIndentWidthFromWhitespace = (indent: string) =>
  Array.from(indent).reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);

const isInteractionMarkerLine = (line: string) => {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "-true" ||
    trimmed === "-false" ||
    (trimmed.length === 2 &&
      trimmed[0] === "-" &&
      trimmed[1] >= "a" &&
      trimmed[1] <= "d");
};

const isHorizontalRuleLine = (line: string) => /^-{3,}\s*$/.test(line.trim());
const isUnorderedListLine = (line: string) =>
  unorderedListLinePattern.test(normalizeIndentWhitespace(line));

export const normalizeLegacyUnorderedListIndentation = (
  markdown: string,
  options?: NormalizeLegacyUnorderedListIndentationOptions,
) => {
  if (!markdown) {
    return markdown;
  }

  const indentWidth = Math.max(1, options?.indentWidth ?? 4);
  const normalizedMarker = options?.normalizedMarker ?? "-";
  const lineEnding = resolveLineEnding(markdown);
  const lines = normalizeLineEndings(markdown).split("\n");

  let changed = false;
  let inCodeFence = false;
  let inMathBlock = false;

  const levelStack: Array<{ level: number; rawIndentWidth: number }> = [];
  const clearStack = () => {
    levelStack.length = 0;
  };
  const findNextNonBlankIndex = (startIndex: number) => {
    for (let cursor = startIndex; cursor < lines.length; cursor += 1) {
      if (!isEditorWhitespaceOnly(lines[cursor] ?? "")) {
        return cursor;
      }
    }
    return -1;
  };
  const findPreviousNonBlankIndex = (startIndex: number) => {
    for (let cursor = startIndex; cursor >= 0; cursor -= 1) {
      if (!isEditorWhitespaceOnly(lines[cursor] ?? "")) {
        return cursor;
      }
    }
    return -1;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const normalizedLine = normalizeIndentWhitespace(line);

    if (!inMathBlock && fencedCodeLinePattern.test(normalizedLine)) {
      inCodeFence = !inCodeFence;
      clearStack();
      continue;
    }
    if (!inCodeFence && mathBlockDelimiterLinePattern.test(normalizedLine)) {
      inMathBlock = !inMathBlock;
      clearStack();
      continue;
    }
    if (inCodeFence || inMathBlock) {
      continue;
    }

    if (isEditorWhitespaceOnly(normalizedLine)) {
      const previousNonBlankIndex = findPreviousNonBlankIndex(index - 1);
      const nextNonBlankIndex = findNextNonBlankIndex(index + 1);
      const previousNonBlankLine = previousNonBlankIndex >= 0
        ? normalizeIndentWhitespace(lines[previousNonBlankIndex] ?? "")
        : "";
      const nextNonBlankLine = nextNonBlankIndex >= 0
        ? normalizeIndentWhitespace(lines[nextNonBlankIndex] ?? "")
        : "";
      const hasPreviousUnorderedListLine = isUnorderedListLine(previousNonBlankLine);
      const hasFollowingUnorderedListLine = isUnorderedListLine(nextNonBlankLine);
      if (hasPreviousUnorderedListLine && hasFollowingUnorderedListLine) {
        // Keep nested list descendants contiguous even when contentEditable
        // inserts spacer lines between two list lines.
        lines.splice(index, 1);
        changed = true;
        index -= 1;
        continue;
      }
      if (levelStack.length > 0 && hasFollowingUnorderedListLine) {
        // Editor serialization can inject spacer lines between nested list items.
        // Drop them and keep the current stack so deeper descendants stay anchored.
        lines.splice(index, 1);
        changed = true;
        index -= 1;
        continue;
      }
      clearStack();
      if (line.length > 0) {
        lines[index] = "";
        changed = true;
      }
      continue;
    }

    if (taskListLinePattern.test(normalizedLine)) {
      clearStack();
      continue;
    }

    const listMatch = normalizedLine.match(unorderedListLinePattern);
    if (!listMatch) {
      clearStack();
      continue;
    }

    const rawIndent = listMatch[1] ?? "";
    const marker = normalizedMarker;
    const rawContent = listMatch[3] ?? "";
    const normalizedContent = rawContent.trimStart().trimEnd();
    const compactLine = `${marker}${normalizedContent}`;

    if (isInteractionMarkerLine(compactLine) || isHorizontalRuleLine(compactLine)) {
      clearStack();
      continue;
    }

    const rawIndentWidth = resolveIndentWidthFromWhitespace(rawIndent);
    let nextLevel = 0;

    if (levelStack.length === 0 || rawIndentWidth <= 1) {
      nextLevel = 0;
    } else {
      const previous = levelStack[levelStack.length - 1];
      if (rawIndentWidth > previous.rawIndentWidth) {
        nextLevel = previous.level + 1;
      } else if (rawIndentWidth === previous.rawIndentWidth) {
        nextLevel = previous.level;
      } else {
        while (
          levelStack.length > 0 &&
          levelStack[levelStack.length - 1].rawIndentWidth > rawIndentWidth
        ) {
          levelStack.pop();
        }
        nextLevel = levelStack.length === 0
          ? 0
          : levelStack[levelStack.length - 1].level;
      }
    }

    while (
      levelStack.length > 0 &&
      levelStack[levelStack.length - 1].level >= nextLevel
    ) {
      levelStack.pop();
    }
    levelStack.push({ level: nextLevel, rawIndentWidth });

    const normalizedIndent = " ".repeat(nextLevel * indentWidth);
    const normalizedLine = normalizedContent.length > 0
      ? `${normalizedIndent}${marker} ${normalizedContent}`
      : `${normalizedIndent}${marker} `;

    if (normalizedLine !== line) {
      lines[index] = normalizedLine;
      changed = true;
    }
  }

  if (!changed) {
    return markdown;
  }
  return lines.join(lineEnding);
};
