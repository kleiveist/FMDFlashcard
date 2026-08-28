/**
 * @file frontend/src/features/preview/markdownHistory.ts
 *
 * Zweck:
 * - Snapshot-basierte Undo/Redo-History fuer Markdown-Dokumente.
 */

export type MarkdownHistoryReason =
  | "block-commit"
  | "block-delete"
  | "math-toolbox-live"
  | "write-save"
  | "cancel"
  | "external-load";

export type MarkdownHistoryEntry = {
  markdown: string;
  reason: MarkdownHistoryReason;
  timestamp: number;
  mergeKey?: string;
};

export type MarkdownHistoryState = {
  past: MarkdownHistoryEntry[];
  present: MarkdownHistoryEntry;
  future: MarkdownHistoryEntry[];
};

const MAX_MARKDOWN_HISTORY = 200;

const createEntry = (
  markdown: string,
  reason: MarkdownHistoryReason,
  mergeKey?: string,
): MarkdownHistoryEntry => ({
  markdown,
  reason,
  timestamp: Date.now(),
  mergeKey,
});

export const createMarkdownHistory = (
  markdown: string,
  reason: MarkdownHistoryReason = "external-load",
): MarkdownHistoryState => ({
  past: [],
  present: createEntry(markdown, reason),
  future: [],
});

export const resetMarkdownHistory = (
  markdown: string,
  reason: MarkdownHistoryReason = "external-load",
) => createMarkdownHistory(markdown, reason);

export const pushMarkdownHistory = (
  state: MarkdownHistoryState,
  markdown: string,
  reason: MarkdownHistoryReason = "block-commit",
  options?: { mergeKey?: string },
): MarkdownHistoryState => {
  if (markdown === state.present.markdown) {
    return state;
  }
  if (options?.mergeKey && state.present.mergeKey === options.mergeKey) {
    return {
      ...state,
      present: createEntry(markdown, reason, options.mergeKey),
      future: [],
    };
  }
  const nextPast = [...state.past, state.present];
  const cappedPast = nextPast.length > MAX_MARKDOWN_HISTORY
    ? nextPast.slice(nextPast.length - MAX_MARKDOWN_HISTORY)
    : nextPast;
  return {
    past: cappedPast,
    present: createEntry(markdown, reason, options?.mergeKey),
    future: [],
  };
};

export const canUndoMarkdownHistory = (state: MarkdownHistoryState) =>
  state.past.length > 0;

export const canRedoMarkdownHistory = (state: MarkdownHistoryState) =>
  state.future.length > 0;

export const undoMarkdownHistory = (state: MarkdownHistoryState): MarkdownHistoryState => {
  if (state.past.length === 0) {
    return state;
  }
  const previous = state.past[state.past.length - 1];
  if (!previous) {
    return state;
  }
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, MAX_MARKDOWN_HISTORY),
  };
};

export const redoMarkdownHistory = (state: MarkdownHistoryState): MarkdownHistoryState => {
  if (state.future.length === 0) {
    return state;
  }
  const [next, ...rest] = state.future;
  if (!next) {
    return state;
  }
  const nextPast = [...state.past, state.present];
  const cappedPast = nextPast.length > MAX_MARKDOWN_HISTORY
    ? nextPast.slice(nextPast.length - MAX_MARKDOWN_HISTORY)
    : nextPast;
  return {
    past: cappedPast,
    present: next,
    future: rest,
  };
};
