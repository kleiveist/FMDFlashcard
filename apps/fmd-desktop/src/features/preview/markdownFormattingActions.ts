export type MarkdownFormattingSelection = {
  start: number;
  end: number;
};

export type MarkdownFormattingApplyResult = {
  handled: boolean;
  value: string;
  selection: MarkdownFormattingSelection;
};

const normalizeSelection = (
  value: string,
  selection: MarkdownFormattingSelection,
): MarkdownFormattingSelection => {
  const max = value.length;
  const start = Math.max(0, Math.min(selection.start, max));
  const end = Math.max(0, Math.min(selection.end, max));
  return start <= end ? { start, end } : { start: end, end: start };
};

const WRAPPER_BY_TOKEN = new Map<string, string>([
  ["****", "**"],
  ["**", "**"],
  ["*", "*"],
  ["__", "__"],
  ["~~", "~~"],
  ["==", "=="],
  ["``", "`"],
  ["`", "`"],
  ["$$", "$"],
  ["$", "$"],
  ["%%", "%%"],
  ["%", "%"],
  ["\"\"", "\""],
  ["\"", "\""],
  ["''", "\""],
]);

const resolvePrefixToken = (rawToken: string) => {
  const trimmed = rawToken.trim();
  if (trimmed === ">") {
    return "> ";
  }
  if (/^#{1,6}$/.test(trimmed)) {
    return `${trimmed} `;
  }
  return null;
};

const applyWrapper = (
  value: string,
  selection: MarkdownFormattingSelection,
  marker: string,
): MarkdownFormattingApplyResult => {
  const normalized = normalizeSelection(value, selection);
  if (normalized.start === normalized.end) {
    const nextValue = `${value.slice(0, normalized.start)}${marker}${marker}${value.slice(normalized.end)}`;
    const caret = normalized.start + marker.length;
    return {
      handled: true,
      value: nextValue,
      selection: {
        start: caret,
        end: caret,
      },
    };
  }
  const selected = value.slice(normalized.start, normalized.end);
  const nextValue = `${value.slice(0, normalized.start)}${marker}${selected}${marker}${
    value.slice(normalized.end)
  }`;
  return {
    handled: true,
    value: nextValue,
    selection: {
      start: normalized.start + marker.length,
      end: normalized.end + marker.length,
    },
  };
};

const applyPrefix = (
  value: string,
  selection: MarkdownFormattingSelection,
  prefix: string,
): MarkdownFormattingApplyResult => {
  const normalized = normalizeSelection(value, selection);
  if (normalized.start === normalized.end) {
    const lineStart = value.lastIndexOf("\n", normalized.start - 1) + 1;
    const nextValue = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    const caret = normalized.start + prefix.length;
    return {
      handled: true,
      value: nextValue,
      selection: {
        start: caret,
        end: caret,
      },
    };
  }

  const lineStart = value.lastIndexOf("\n", normalized.start - 1) + 1;
  const effectiveEnd = normalized.end > normalized.start
    ? Math.max(normalized.start, normalized.end - 1)
    : normalized.end;
  const lineEndMarker = value.indexOf("\n", effectiveEnd);
  const lineEnd = lineEndMarker === -1 ? value.length : lineEndMarker;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const prefixedBlock = lines.map((line) => `${prefix}${line}`).join("\n");
  const nextValue = `${value.slice(0, lineStart)}${prefixedBlock}${value.slice(lineEnd)}`;
  const prefixCountUntilStart = block.slice(0, normalized.start - lineStart).split("\n").length;
  const prefixCountUntilEnd = block.slice(0, normalized.end - lineStart).split("\n").length;
  return {
    handled: true,
    value: nextValue,
    selection: {
      start: normalized.start + prefix.length * prefixCountUntilStart,
      end: normalized.end + prefix.length * prefixCountUntilEnd,
    },
  };
};

export const applyMarkdownFormattingInsertion = (
  value: string,
  selection: MarkdownFormattingSelection,
  rawToken: string | null | undefined,
): MarkdownFormattingApplyResult => {
  const token = rawToken ?? "";
  if (!token) {
    return {
      handled: false,
      value,
      selection: normalizeSelection(value, selection),
    };
  }

  const directWrapper = WRAPPER_BY_TOKEN.get(token) ??
    WRAPPER_BY_TOKEN.get(token.trim());
  if (directWrapper) {
    return applyWrapper(value, selection, directWrapper);
  }

  const prefix = resolvePrefixToken(token);
  if (prefix) {
    return applyPrefix(value, selection, prefix);
  }

  return {
    handled: false,
    value,
    selection: normalizeSelection(value, selection),
  };
};
