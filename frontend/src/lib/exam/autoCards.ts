/**
 * @file frontend/src/lib/exam/autoCards.ts
 *
 * Zweck:
 * - Utilities zum Hinzufuegen/Entfernen von #card Wrappern in Exam-Tasks.
 * - Erzwingt eine kanonische Wrapper-Schreibform.
 */

import { parseExamTasks, type ExamTask, type ExamTaskSourceRange } from "../exam";
import type { Flashcard, FlashcardPart } from "../flashcards";

export type ExamCardWrapperAction = "add" | "remove" | "keep";

export const AUTO_CARD_TYPES = ["qa", "tf", "m1", "m2", "cl", "cd", "cld"] as const;
export type AutoCardType = (typeof AUTO_CARD_TYPES)[number];
export type AutoCardTypeMap = Record<AutoCardType, boolean>;

type WrapperMatch = {
  startIndex: number;
  endIndex: number;
};

type TaskChunkNormalizationAction = "add" | "remove" | "keep";

type TaskChunkAnalysis = {
  headerIndex: number | null;
  lastNonEmptyIndex: number | null;
  canonicalCloser: boolean;
  canonicalOpenerIndex: number | null;
  permissiveOpenerIndex: number | null;
  fullyWrappedCanonical: boolean;
  fullyWrappedPermissive: boolean;
  wrapperStartIndices: number[];
  wrapperEndIndices: number[];
};

const normalizeLines = (content: string) => content.replace(/\r\n?/g, "\n").split("\n");

const taskHeaderPattern = /^\s*(\d+)\)\s*(.*)$/;
const helpStartPattern = /^\s*#help\s*$/i;
const helpEndPattern = /^\s*#helpend\s*$/i;

const isWrapperStart = (line: string) => line.trim().toLowerCase() === "#card";
const isWrapperEnd = (line: string) => {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "#endcard";
};
const isTaskHeader = (line: string) => taskHeaderPattern.test(line.trim());
const isHelpStart = (line: string) => helpStartPattern.test(line);
const isHelpEnd = (line: string) => helpEndPattern.test(line);

const findPreviousNonEmptyIndex = (lines: string[], startIndex: number) => {
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    if (lines[i]?.trim() !== "") {
      return i;
    }
  }
  return null;
};

const findLastNonEmptyInRange = (
  lines: string[],
  startIndex: number,
  endIndex: number,
) => {
  for (let i = endIndex; i >= startIndex; i -= 1) {
    if (lines[i]?.trim() !== "") {
      return i;
    }
  }
  return null;
};

const findNextNonEmptyInRange = (
  lines: string[],
  startIndex: number,
  endIndex: number,
) => {
  for (let i = startIndex; i <= endIndex; i += 1) {
    if (lines[i]?.trim() !== "") {
      return i;
    }
  }
  return null;
};

const findTaskHeaderInRange = (
  lines: string[],
  startIndex: number,
  endIndex: number,
) => {
  for (let i = startIndex; i <= endIndex; i += 1) {
    if (isTaskHeader(lines[i] ?? "")) {
      return i;
    }
  }
  return null;
};

const skipRepeatedTaskHeaderLines = (
  lines: string[],
  startIndex: number,
  endIndex: number,
) => {
  let index = startIndex;
  let expectedNumber: string | null = null;

  while (index <= endIndex) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const match = line.trim().match(taskHeaderPattern);
    if (!match) {
      break;
    }
    const number = match[1] ?? "";
    if (!expectedNumber) {
      expectedNumber = number;
    } else if (number !== expectedNumber) {
      break;
    }
    index += 1;
  }

  return index;
};

const skipLeadingTaskHelpBlocks = (
  lines: string[],
  startIndex: number,
  endIndex: number,
) => {
  let index = startIndex;

  while (index <= endIndex) {
    const helpStartIndex = findNextNonEmptyInRange(lines, index, endIndex);
    if (helpStartIndex === null || !isHelpStart(lines[helpStartIndex] ?? "")) {
      return index;
    }

    let cursor = helpStartIndex + 1;
    let foundEnd = false;
    while (cursor <= endIndex) {
      if (isHelpEnd(lines[cursor] ?? "")) {
        foundEnd = true;
        cursor += 1;
        break;
      }
      cursor += 1;
    }

    if (!foundEnd) {
      return startIndex;
    }
    index = cursor;
  }

  return index;
};

const collectWrapperStartIndices = (lines: string[]) =>
  lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isWrapperStart(line))
    .map(({ index }) => index);

const collectWrapperEndIndices = (lines: string[]) =>
  lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isWrapperEnd(line))
    .map(({ index }) => index);

const areLinesEqual = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((line, index) => line === right[index]);

const resolveLegacyInternalOpenerIndex = (
  lines: string[],
  headerIndex: number,
  lastNonEmptyIndex: number,
) => {
  if (headerIndex >= lastNonEmptyIndex) {
    return null;
  }

  const afterHeader = skipRepeatedTaskHeaderLines(lines, headerIndex, lastNonEmptyIndex);
  const afterTaskHelp = skipLeadingTaskHelpBlocks(lines, afterHeader, lastNonEmptyIndex);
  const candidate = findNextNonEmptyInRange(
    lines,
    afterTaskHelp,
    Math.max(afterTaskHelp, lastNonEmptyIndex - 1),
  );
  if (candidate === null || candidate >= lastNonEmptyIndex) {
    return null;
  }
  return isWrapperStart(lines[candidate] ?? "") ? candidate : null;
};

const analyzeTaskChunk = (chunkLines: string[]): TaskChunkAnalysis => {
  const headerIndex =
    chunkLines.length > 0
      ? findTaskHeaderInRange(chunkLines, 0, chunkLines.length - 1)
      : null;
  const lastNonEmptyIndex =
    chunkLines.length > 0
      ? findLastNonEmptyInRange(chunkLines, 0, chunkLines.length - 1)
      : null;
  const canonicalCloser =
    lastNonEmptyIndex !== null && isWrapperEnd(chunkLines[lastNonEmptyIndex] ?? "");
  const directOpenerBeforeHeader =
    headerIndex !== null
      ? findPreviousNonEmptyIndex(chunkLines, headerIndex)
      : null;
  const firstNonEmptyIndex =
    chunkLines.length > 0
      ? findNextNonEmptyInRange(chunkLines, 0, chunkLines.length - 1)
      : null;
  let canonicalOpenerIndex =
    directOpenerBeforeHeader !== null &&
    isWrapperStart(chunkLines[directOpenerBeforeHeader] ?? "") &&
    findPreviousNonEmptyIndex(chunkLines, directOpenerBeforeHeader) === null
      ? directOpenerBeforeHeader
      : null;
  if (
    canonicalOpenerIndex === null &&
    headerIndex === null &&
    firstNonEmptyIndex !== null &&
    isWrapperStart(chunkLines[firstNonEmptyIndex] ?? "") &&
    findPreviousNonEmptyIndex(chunkLines, firstNonEmptyIndex) === null
  ) {
    canonicalOpenerIndex = firstNonEmptyIndex;
  }

  let permissiveOpenerIndex = canonicalOpenerIndex;
  if (
    permissiveOpenerIndex === null &&
    headerIndex !== null &&
    lastNonEmptyIndex !== null
  ) {
    permissiveOpenerIndex = resolveLegacyInternalOpenerIndex(
      chunkLines,
      headerIndex,
      lastNonEmptyIndex,
    );
  }

  const fullyWrappedCanonical =
    canonicalCloser &&
    canonicalOpenerIndex !== null &&
    lastNonEmptyIndex !== null &&
    canonicalOpenerIndex < lastNonEmptyIndex;
  const fullyWrappedPermissive =
    canonicalCloser &&
    permissiveOpenerIndex !== null &&
    lastNonEmptyIndex !== null &&
    permissiveOpenerIndex < lastNonEmptyIndex;

  return {
    headerIndex,
    lastNonEmptyIndex,
    canonicalCloser,
    canonicalOpenerIndex,
    permissiveOpenerIndex,
    fullyWrappedCanonical,
    fullyWrappedPermissive,
    wrapperStartIndices: collectWrapperStartIndices(chunkLines),
    wrapperEndIndices: collectWrapperEndIndices(chunkLines),
  };
};

const removeAllWrapperStartMarkers = (chunkLines: string[]) =>
  chunkLines.filter((line) => !isWrapperStart(line));

const removeAllWrapperEndMarkers = (chunkLines: string[]) =>
  chunkLines.filter((line) => !isWrapperEnd(line));

const dedupeWrapperStartMarkers = (
  chunkLines: string[],
  preferredKeepIndex: number | null,
) => {
  const startIndices = collectWrapperStartIndices(chunkLines);
  if (startIndices.length <= 1) {
    return [...chunkLines];
  }
  const keepIndex =
    preferredKeepIndex !== null && startIndices.includes(preferredKeepIndex)
      ? preferredKeepIndex
      : (startIndices[0] ?? null);
  if (keepIndex === null) {
    return [...chunkLines];
  }
  return chunkLines.filter(
    (line, index) => !isWrapperStart(line) || index === keepIndex,
  );
};

const ensureCanonicalWrapperOpen = (chunkLines: string[]) => {
  const withoutStarts = removeAllWrapperStartMarkers(chunkLines);
  if (withoutStarts.length === 0) {
    return ["#card"];
  }
  const headerIndex = findTaskHeaderInRange(withoutStarts, 0, withoutStarts.length - 1);
  const fallbackInsertIndex =
    findNextNonEmptyInRange(withoutStarts, 0, withoutStarts.length - 1) ?? 0;
  const insertIndex = headerIndex ?? fallbackInsertIndex;
  const next = [...withoutStarts];
  next.splice(insertIndex, 0, "#card");
  return next;
};

const ensureCanonicalWrapperClose = (chunkLines: string[]) => {
  const withoutEnds = removeAllWrapperEndMarkers(chunkLines);
  if (withoutEnds.length === 0) {
    return ["#endcard"];
  }
  const lastNonEmpty = findLastNonEmptyInRange(withoutEnds, 0, withoutEnds.length - 1);
  if (lastNonEmpty === null) {
    return [...withoutEnds, "#endcard"];
  }
  const next = [...withoutEnds];
  next.splice(lastNonEmpty + 1, 0, "#endcard");
  return next;
};

const removeCanonicalWrapperClose = (chunkLines: string[]) => {
  return removeAllWrapperEndMarkers(chunkLines);
};

const normalizeTaskChunk = (
  chunkLines: string[],
  action: TaskChunkNormalizationAction,
) => {
  const analysis = analyzeTaskChunk(chunkLines);

  if (action === "add") {
    return ensureCanonicalWrapperClose(ensureCanonicalWrapperOpen(chunkLines));
  }

  if (action === "remove") {
    const deduped = removeAllWrapperStartMarkers(chunkLines);
    return removeCanonicalWrapperClose(deduped);
  }

  const openerIndex = analysis.permissiveOpenerIndex;
  const hasOpenerAndFollowingCloser =
    typeof openerIndex === "number" &&
    analysis.wrapperEndIndices.some((index) => index > openerIndex);

  if (analysis.fullyWrappedPermissive || hasOpenerAndFollowingCloser) {
    return ensureCanonicalWrapperClose(ensureCanonicalWrapperOpen(chunkLines));
  }

  if (analysis.wrapperStartIndices.length > 1) {
    const preferredKeepIndex =
      analysis.headerIndex !== null
        ? (() => {
            const direct = findPreviousNonEmptyIndex(chunkLines, analysis.headerIndex);
            if (direct === null) {
              return null;
            }
            return isWrapperStart(chunkLines[direct] ?? "") ? direct : null;
          })()
        : null;
    return dedupeWrapperStartMarkers(chunkLines, preferredKeepIndex);
  }

  return [...chunkLines];
};

const replaceRange = (
  lines: string[],
  range: ExamTaskSourceRange,
  nextChunk: string[],
) => {
  if (!lines.length) {
    return { lines, delta: 0, changed: false };
  }

  const startLine = Math.max(0, range.startLine);
  const endLine = Math.min(lines.length - 1, range.endLine);
  if (startLine > endLine) {
    return { lines, delta: 0, changed: false };
  }

  const currentChunk = lines.slice(startLine, endLine + 1);
  if (areLinesEqual(currentChunk, nextChunk)) {
    return { lines, delta: 0, changed: false };
  }

  const next = [...lines];
  next.splice(startLine, endLine - startLine + 1, ...nextChunk);
  return {
    lines: next,
    delta: nextChunk.length - currentChunk.length,
    changed: true,
  };
};

export const resolveFlashcardPartAutoCardType = (
  part: FlashcardPart,
): AutoCardType | null => {
  switch (part.kind) {
    case "free-text":
      return "qa";
    case "true-false":
      return "tf";
    case "multiple-choice":
      return part.correctKeys.length > 1 ? "m2" : "m1";
    case "cloze":
      return part.subtype;
    default: {
      const _exhaustive: never = part;
      void _exhaustive;
      return null;
    }
  }
};

export const resolveFlashcardAutoCardTypeInstances = (card: Flashcard): AutoCardType[] => {
  if (card.kind === "composite") {
    return card.parts
      .map((part) => resolveFlashcardPartAutoCardType(part))
      .filter((type): type is AutoCardType => Boolean(type));
  }
  return [resolveFlashcardPartAutoCardType(card)].filter(
    (type): type is AutoCardType => Boolean(type),
  );
};

export const resolveExamTaskAutoCardTypeInstances = (task: ExamTask): AutoCardType[] =>
  resolveFlashcardAutoCardTypeInstances(task.card);

export const resolveExamTaskAutoCardTypes = (task: ExamTask): AutoCardType[] => {
  const detected = new Set<AutoCardType>();
  resolveExamTaskAutoCardTypeInstances(task).forEach((resolved) => {
    detected.add(resolved);
  });
  return Array.from(detected);
};

export const normalizeCardWrapperPlacement = (content: string) => {
  const parsed = parseExamTasks(content);
  if (!parsed.hasExamBlock || parsed.tasks.length === 0) {
    return { content, changed: false };
  }

  const lines = normalizeLines(content);
  let changed = false;

  const tasksDescending = [...parsed.tasks].sort(
    (a, b) => b.sourceRange.startLine - a.sourceRange.startLine,
  );

  tasksDescending.forEach((task) => {
    const startLine = Math.max(0, task.sourceRange.startLine);
    const endLine = Math.min(lines.length - 1, task.sourceRange.endLine);
    if (startLine > endLine) {
      return;
    }
    const chunk = lines.slice(startLine, endLine + 1);
    const normalizedChunk = normalizeTaskChunk(chunk, "keep");
    if (areLinesEqual(chunk, normalizedChunk)) {
      return;
    }
    lines.splice(startLine, endLine - startLine + 1, ...normalizedChunk);
    changed = true;
  });

  return { content: lines.join("\n"), changed };
};

export const findExamTaskWrapper = (
  lines: string[],
  range: ExamTaskSourceRange,
): WrapperMatch | null => {
  if (!lines.length) {
    return null;
  }

  const startLine = Math.max(0, range.startLine);
  const endLine = Math.min(lines.length - 1, range.endLine);
  if (startLine > endLine) {
    return null;
  }

  const chunk = lines.slice(startLine, endLine + 1);
  const analysis = analyzeTaskChunk(chunk);
  if (
    !analysis.fullyWrappedCanonical ||
    analysis.canonicalOpenerIndex === null ||
    analysis.lastNonEmptyIndex === null
  ) {
    return null;
  }

  return {
    startIndex: startLine + analysis.canonicalOpenerIndex,
    endIndex: startLine + analysis.lastNonEmptyIndex,
  };
};

export const addExamTaskWrapper = (
  lines: string[],
  range: ExamTaskSourceRange,
) => {
  const startLine = Math.max(0, range.startLine);
  const endLine = Math.min(lines.length - 1, range.endLine);
  if (startLine > endLine) {
    return { lines, delta: 0, changed: false };
  }

  const currentChunk = lines.slice(startLine, endLine + 1);
  const nextChunk = normalizeTaskChunk(currentChunk, "add");
  return replaceRange(lines, range, nextChunk);
};

export const removeExamTaskWrapper = (
  lines: string[],
  range: ExamTaskSourceRange,
) => {
  const startLine = Math.max(0, range.startLine);
  const endLine = Math.min(lines.length - 1, range.endLine);
  if (startLine > endLine) {
    return { lines, delta: 0, changed: false };
  }

  const currentChunk = lines.slice(startLine, endLine + 1);
  const nextChunk = normalizeTaskChunk(currentChunk, "remove");
  return replaceRange(lines, range, nextChunk);
};

export const isExamTaskWrapped = findExamTaskWrapper;

export const wrapExamTask = addExamTaskWrapper;

export const unwrapExamTask = removeExamTaskWrapper;

export const findTaskWrapper = findExamTaskWrapper;

export const addTaskWrapper = addExamTaskWrapper;

export const removeTaskWrapper = removeExamTaskWrapper;

export const applyExamCardWrapperActions = (
  content: string,
  tasks: ExamTask[],
  getAction: (task: ExamTask, index: number) => ExamCardWrapperAction,
) => {
  const plannedActions = new Map<number, ExamCardWrapperAction>();
  tasks.forEach((task) => {
    plannedActions.set(task.index, getAction(task, task.index));
  });

  const normalized = normalizeCardWrapperPlacement(content);
  let lines = normalizeLines(normalized.content);
  let changed = normalized.changed;
  let offset = 0;

  const normalizedTasks = parseExamTasks(normalized.content).tasks.sort(
    (a, b) => a.sourceRange.startLine - b.sourceRange.startLine,
  );

  normalizedTasks.forEach((task) => {
    const action = plannedActions.get(task.index) ?? "keep";
    if (action === "keep") {
      return;
    }

    const startLine = task.sourceRange.startLine + offset;
    const endLine = task.sourceRange.endLine + offset;
    const range = { startLine, endLine };
    const result =
      action === "add"
        ? addExamTaskWrapper(lines, range)
        : removeExamTaskWrapper(lines, range);

    lines = result.lines;
    offset += result.delta;
    changed = changed || result.changed;
  });

  return { content: lines.join("\n"), changed };
};
