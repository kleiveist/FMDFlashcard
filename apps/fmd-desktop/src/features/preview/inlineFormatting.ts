import type { KeyboardEvent } from "react";

export type InlineFormattingToolbarAction =
  | "highlight"
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "inline-code"
  | "math"
  | "cd"
  | "cl";

export type InlineFormattingMathMenuAction =
  | "wrap-inline"
  | "convert-inline-display"
  | "remove-marking";

export type InlineFormattingToolbarRange = {
  start: number;
  end: number;
};

export type InlineFormattingToggleResult = {
  value: string;
  selection: InlineFormattingToolbarRange;
  changed: boolean;
};

type InlineFormattingWrapper = {
  open: string;
  close: string;
};

export type InlineFormattingToolbarActiveState = {
  highlight: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link: boolean;
  strikethrough: boolean;
  "inline-code": boolean;
  math: boolean;
  cd: boolean;
  cl: boolean;
};

export const INLINE_FORMATTING_WRAPPERS: Record<InlineFormattingToolbarAction, InlineFormattingWrapper> = {
  highlight: { open: "==", close: "==" },
  bold: { open: "**", close: "**" },
  italic: { open: "*", close: "*" },
  underline: { open: "__", close: "__" },
  strikethrough: { open: "~~", close: "~~" },
  "inline-code": { open: "`", close: "`" },
  math: { open: "$", close: "$" },
  cd: { open: "\"", close: "\"" },
  cl: { open: "%", close: "%" },
};

const inlineMarkdownLinkPattern = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;

export const normalizeInlineFormattingRange = (
  value: string,
  range: InlineFormattingToolbarRange,
): InlineFormattingToolbarRange => {
  const max = value.length;
  const start = Math.max(0, Math.min(range.start, max));
  const end = Math.max(0, Math.min(range.end, max));
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
};

const countRepeatedCharBeforeIndex = (
  value: string,
  startIndex: number,
  char: string,
) => {
  let count = 0;
  let index = startIndex - 1;
  while (index >= 0 && value[index] === char) {
    count += 1;
    index -= 1;
  }
  return count;
};

const countRepeatedCharAfterIndex = (
  value: string,
  startIndex: number,
  char: string,
) => {
  let count = 0;
  let index = startIndex;
  while (index < value.length && value[index] === char) {
    count += 1;
    index += 1;
  }
  return count;
};

const resolveRepeatedMarkerRunsAroundSelection = (
  value: string,
  range: InlineFormattingToolbarRange,
  marker: string,
) => {
  const normalized = normalizeInlineFormattingRange(value, range);
  return {
    left: countRepeatedCharBeforeIndex(value, normalized.start, marker),
    right: countRepeatedCharAfterIndex(value, normalized.end, marker),
  };
};

export const toggleInlineFormattingWrapper = (
  value: string,
  range: InlineFormattingToolbarRange,
  wrapper: InlineFormattingWrapper,
): InlineFormattingToggleResult => {
  const normalized = normalizeInlineFormattingRange(value, range);
  if (normalized.start === normalized.end) {
    return { value, selection: normalized, changed: false };
  }

  // Star markers need dedicated handling so bold/italic combinations
  // are stable: ** + italic => *** and toggles remove only their own layer.
  if (wrapper.open === "*" && wrapper.close === "*" && wrapper.open.length <= 2) {
    const starRuns = resolveRepeatedMarkerRunsAroundSelection(value, normalized, "*");
    if (wrapper.open.length === 1) {
      const isItalicActive = starRuns.left >= 1 &&
        starRuns.right >= 1 &&
        starRuns.left % 2 === 1 &&
        starRuns.right % 2 === 1;
      if (isItalicActive) {
        const nextValue = `${value.slice(0, normalized.start - 1)}${value.slice(normalized.start, normalized.end)}${
          value.slice(normalized.end + 1)
        }`;
        return {
          value: nextValue,
          selection: {
            start: normalized.start - 1,
            end: normalized.end - 1,
          },
          changed: nextValue !== value,
        };
      }
      const nextValue = `${value.slice(0, normalized.start)}*${value.slice(normalized.start, normalized.end)}*${
        value.slice(normalized.end)
      }`;
      return {
        value: nextValue,
        selection: {
          start: normalized.start + 1,
          end: normalized.end + 1,
        },
        changed: nextValue !== value,
      };
    }
    const isBoldActive = starRuns.left >= 2 && starRuns.right >= 2;
    if (isBoldActive) {
      const nextValue = `${value.slice(0, normalized.start - 2)}${value.slice(normalized.start, normalized.end)}${
        value.slice(normalized.end + 2)
      }`;
      return {
        value: nextValue,
        selection: {
          start: normalized.start - 2,
          end: normalized.end - 2,
        },
        changed: nextValue !== value,
      };
    }
    const nextValue = `${value.slice(0, normalized.start)}**${value.slice(normalized.start, normalized.end)}**${
      value.slice(normalized.end)
    }`;
    return {
      value: nextValue,
      selection: {
        start: normalized.start + 2,
        end: normalized.end + 2,
      },
      changed: nextValue !== value,
    };
  }

  const selected = value.slice(normalized.start, normalized.end);
  const selectedHasWrapper = selected.length >= wrapper.open.length + wrapper.close.length &&
    selected.startsWith(wrapper.open) &&
    selected.endsWith(wrapper.close);
  if (selectedHasWrapper) {
    const nextSelection = {
      start: normalized.start,
      end: normalized.end - wrapper.open.length - wrapper.close.length,
    };
    const nextValue = `${value.slice(0, normalized.start)}${
      selected.slice(wrapper.open.length, selected.length - wrapper.close.length)
    }${value.slice(normalized.end)}`;
    return {
      value: nextValue,
      selection: nextSelection,
      changed: nextValue !== value,
    };
  }

  const hasWrapperAroundSelection = normalized.start >= wrapper.open.length &&
    normalized.end + wrapper.close.length <= value.length &&
    value.slice(normalized.start - wrapper.open.length, normalized.start) === wrapper.open &&
    value.slice(normalized.end, normalized.end + wrapper.close.length) === wrapper.close;
  if (hasWrapperAroundSelection) {
    const nextValue = `${value.slice(0, normalized.start - wrapper.open.length)}${selected}${
      value.slice(normalized.end + wrapper.close.length)
    }`;
    const nextSelection = {
      start: normalized.start - wrapper.open.length,
      end: normalized.end - wrapper.open.length,
    };
    return {
      value: nextValue,
      selection: nextSelection,
      changed: nextValue !== value,
    };
  }

  const nextValue = `${value.slice(0, normalized.start)}${wrapper.open}${selected}${wrapper.close}${
    value.slice(normalized.end)
  }`;
  return {
    value: nextValue,
    selection: {
      start: normalized.start + wrapper.open.length,
      end: normalized.end + wrapper.open.length,
    },
    changed: nextValue !== value,
  };
};

export type InlineMarkdownLinkMatch = {
  start: number;
  end: number;
  label: string;
  url: string;
};

export const findInlineMarkdownLinkAtRange = (
  value: string,
  range: InlineFormattingToolbarRange,
): InlineMarkdownLinkMatch | null => {
  const normalized = normalizeInlineFormattingRange(value, range);
  inlineMarkdownLinkPattern.lastIndex = 0;
  let match = inlineMarkdownLinkPattern.exec(value);
  while (match) {
    const start = match.index;
    const end = start + (match[0]?.length ?? 0);
    if (start <= normalized.start && end >= normalized.end) {
      return {
        start,
        end,
        label: match[1] ?? "",
        url: match[2] ?? "",
      };
    }
    if (start > normalized.end) {
      break;
    }
    match = inlineMarkdownLinkPattern.exec(value);
  }
  return null;
};

export const applyInlineMarkdownLink = (
  value: string,
  range: InlineFormattingToolbarRange,
  rawUrl: string,
): InlineFormattingToggleResult => {
  const normalized = normalizeInlineFormattingRange(value, range);
  const url = rawUrl.trim();
  const existingLink = findInlineMarkdownLinkAtRange(value, normalized);

  if (existingLink) {
    const replacement = url
      ? `[${existingLink.label}](${url})`
      : existingLink.label;
    const nextValue = `${value.slice(0, existingLink.start)}${replacement}${value.slice(existingLink.end)}`;
    const labelStart = existingLink.start + (url ? 1 : 0);
    return {
      value: nextValue,
      selection: {
        start: labelStart,
        end: labelStart + existingLink.label.length,
      },
      changed: nextValue !== value,
    };
  }

  if (normalized.start === normalized.end || !url) {
    return { value, selection: normalized, changed: false };
  }

  const label = value.slice(normalized.start, normalized.end);
  const token = `[${label}](${url})`;
  const nextValue = `${value.slice(0, normalized.start)}${token}${value.slice(normalized.end)}`;
  return {
    value: nextValue,
    selection: {
      start: normalized.start + 1,
      end: normalized.start + 1 + label.length,
    },
    changed: nextValue !== value,
  };
};

const inlineFormattingClearPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/\[([^\]\n]*)\]\(([^)\n]*)\)/g, "$1"],
  [/(^|[^*])\*\*\*([^*\n]+)\*\*\*(?=[^*]|$)/g, "$1$2"],
  [/(^|[^*])\*\*([^*\n]+)\*\*(?=[^*]|$)/g, "$1$2"],
  [/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, "$1$2"],
  [/(^|[^_])__([^_\n]+)__(?=[^_]|$)/g, "$1$2"],
  [/(^|[^~])~~([^~\n]+)~~(?=[^~]|$)/g, "$1$2"],
  [/(^|[^=])==([^=\n]+)==(?=[^=]|$)/g, "$1$2"],
  [/`([^`\n]+)`/g, "$1"],
  [/\$([^$\n]+)\$/g, "$1"],
  [/"([^"\n]+)"/g, "$1"],
  [/%([^%\n]+)%/g, "$1"],
];

export const stripSupportedInlineMarkdownFormatting = (value: string) => {
  let nextValue = value;
  let previousValue = "";
  while (nextValue !== previousValue) {
    previousValue = nextValue;
    for (const [pattern, replacement] of inlineFormattingClearPatterns) {
      nextValue = nextValue.replace(pattern, replacement);
    }
  }
  return nextValue;
};

const createEmptyInlineFormattingActiveState = (): InlineFormattingToolbarActiveState => ({
  highlight: false,
  bold: false,
  italic: false,
  underline: false,
  link: false,
  strikethrough: false,
  "inline-code": false,
  math: false,
  cd: false,
  cl: false,
});

export const isInlineFormattingWrapperActive = (
  value: string,
  range: InlineFormattingToolbarRange,
  wrapper: InlineFormattingWrapper,
) => {
  const normalized = normalizeInlineFormattingRange(value, range);
  if (normalized.start === normalized.end) {
    return false;
  }

  if (wrapper.open === "*" && wrapper.close === "*" && wrapper.open.length <= 2) {
    const starRuns = resolveRepeatedMarkerRunsAroundSelection(value, normalized, "*");
    if (wrapper.open.length === 1) {
      return starRuns.left >= 1 &&
        starRuns.right >= 1 &&
        starRuns.left % 2 === 1 &&
        starRuns.right % 2 === 1;
    }
    return starRuns.left >= 2 && starRuns.right >= 2;
  }

  const selected = value.slice(normalized.start, normalized.end);
  const selectionContainsWrapper = selected.length >= wrapper.open.length + wrapper.close.length &&
    selected.startsWith(wrapper.open) &&
    selected.endsWith(wrapper.close);
  if (selectionContainsWrapper) {
    return true;
  }
  const hasWrapperAroundSelection = normalized.start >= wrapper.open.length &&
    normalized.end + wrapper.close.length <= value.length &&
    value.slice(normalized.start - wrapper.open.length, normalized.start) === wrapper.open &&
    value.slice(normalized.end, normalized.end + wrapper.close.length) === wrapper.close;
  return hasWrapperAroundSelection;
};

export const resolveInlineFormattingToolbarActiveState = (
  value: string,
  range: InlineFormattingToolbarRange,
): InlineFormattingToolbarActiveState => {
  const normalized = normalizeInlineFormattingRange(value, range);
  if (normalized.start === normalized.end) {
    return createEmptyInlineFormattingActiveState();
  }
  const linkMatch = findInlineMarkdownLinkAtRange(value, normalized);
  return {
    highlight: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.highlight),
    bold: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.bold),
    italic: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.italic),
    underline: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.underline),
    link: Boolean(linkMatch),
    strikethrough: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.strikethrough),
    "inline-code": isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS["inline-code"]),
    math: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.math),
    cd: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.cd),
    cl: isInlineFormattingWrapperActive(value, normalized, INLINE_FORMATTING_WRAPPERS.cl),
  };
};

export const stripInlineFormattingAroundRange = (
  value: string,
  range: InlineFormattingToolbarRange,
  options?: {
    actions?: ReadonlyArray<InlineFormattingToolbarAction>;
    removeLink?: boolean;
  },
): InlineFormattingToggleResult => {
  let nextValue = value;
  let nextRange = normalizeInlineFormattingRange(value, range);
  let hasChanged = false;
  const actions = options?.actions ?? (Object.keys(INLINE_FORMATTING_WRAPPERS) as InlineFormattingToolbarAction[]);

  for (let iteration = 0; iteration < 4; iteration += 1) {
    let iterationChanged = false;
    if (options?.removeLink) {
      const linkAtRange = findInlineMarkdownLinkAtRange(nextValue, nextRange);
      if (linkAtRange) {
        const linkResult = applyInlineMarkdownLink(nextValue, nextRange, "");
        if (linkResult.changed) {
          nextValue = linkResult.value;
          nextRange = normalizeInlineFormattingRange(linkResult.value, linkResult.selection);
          hasChanged = true;
          iterationChanged = true;
        }
      }
    }
    for (const action of actions) {
      const wrapper = INLINE_FORMATTING_WRAPPERS[action];
      if (!wrapper || !isInlineFormattingWrapperActive(nextValue, nextRange, wrapper)) {
        continue;
      }
      const toggleResult = toggleInlineFormattingWrapper(nextValue, nextRange, wrapper);
      if (!toggleResult.changed) {
        continue;
      }
      nextValue = toggleResult.value;
      nextRange = normalizeInlineFormattingRange(toggleResult.value, toggleResult.selection);
      hasChanged = true;
      iterationChanged = true;
    }
    if (!iterationChanged) {
      break;
    }
  }

  return {
    value: nextValue,
    selection: nextRange,
    changed: hasChanged,
  };
};

export const resolveInlineFormattingShortcutAction = (
  event: KeyboardEvent<HTMLElement>,
): InlineFormattingToolbarAction | "link" | null => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return null;
  }
  const lowerKey = event.key.toLowerCase();

  if (!event.shiftKey && lowerKey === "b") {
    return "bold";
  }
  if (!event.shiftKey && lowerKey === "i") {
    return "italic";
  }
  if (!event.shiftKey && lowerKey === "u") {
    return "underline";
  }
  if (!event.shiftKey && lowerKey === "k") {
    return "link";
  }
  if (!event.shiftKey && lowerKey === "h") {
    return "highlight";
  }
  if (event.shiftKey && (lowerKey === "x" || lowerKey === "s")) {
    return "strikethrough";
  }
  if (!event.shiftKey && (lowerKey === "e" || event.code === "Backquote" || event.key === "`")) {
    return "inline-code";
  }
  if (event.shiftKey && lowerKey === "m") {
    return "math";
  }
  return null;
};
