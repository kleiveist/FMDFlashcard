/**
 * @file apps/fmd-desktop/src/lib/exam/autoCards.ts
 *
 * Zweck:
 * - Utilities zum Hinzufuegen/Entfernen von #card Wrappern in Exam-Tasks.
 */

import type { ExamTask, ExamTaskSourceRange } from "../exam";
import type { FlashcardPart } from "../flashcards";

export type ExamCardWrapperAction = "add" | "remove" | "keep";

export const AUTO_CARD_TYPES = ["qa", "tf", "m1", "m2", "cl", "cd", "cld"] as const;
export type AutoCardType = (typeof AUTO_CARD_TYPES)[number];
export type AutoCardTypeMap = Record<AutoCardType, boolean>;

type WrapperMatch = {
  startIndex: number;
  endIndex: number;
};

const normalizeLines = (content: string) => content.replace(/\r\n?/g, "\n").split("\n");

const isWrapperStart = (line: string) => line.trim() === "#card";
const isWrapperEnd = (line: string) => line.trim() === "#";

const findPreviousNonEmptyIndex = (lines: string[], startIndex: number) => {
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    if (lines[i]?.trim() !== "") {
      return i;
    }
  }
  return null;
};

const findNextNonEmptyIndex = (lines: string[], startIndex: number) => {
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() !== "") {
      return i;
    }
  }
  return null;
};

const findFirstNonEmptyInRange = (
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

const resolveAutoCardType = (part: FlashcardPart): AutoCardType | null => {
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

export const resolveExamTaskAutoCardTypes = (task: ExamTask): AutoCardType[] => {
  const detected = new Set<AutoCardType>();
  task.card.parts.forEach((part) => {
    const resolved = resolveAutoCardType(part);
    if (resolved) {
      detected.add(resolved);
    }
  });
  return Array.from(detected);
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

  const beforeIndex = findPreviousNonEmptyIndex(lines, startLine);
  const afterIndex = findNextNonEmptyIndex(lines, endLine);
  const firstInside = findFirstNonEmptyInRange(lines, startLine, endLine);
  const lastInside = findLastNonEmptyInRange(lines, startLine, endLine);

  const startIndex =
    (beforeIndex !== null && isWrapperStart(lines[beforeIndex])
      ? beforeIndex
      : null) ??
    (firstInside !== null && isWrapperStart(lines[firstInside])
      ? firstInside
      : null);
  const endIndex =
    (afterIndex !== null && isWrapperEnd(lines[afterIndex])
      ? afterIndex
      : null) ??
    (lastInside !== null && isWrapperEnd(lines[lastInside]) ? lastInside : null);

  if (startIndex === null || endIndex === null || startIndex >= endIndex) {
    return null;
  }

  return { startIndex, endIndex };
};

export const addExamTaskWrapper = (
  lines: string[],
  range: ExamTaskSourceRange,
) => {
  const match = findExamTaskWrapper(lines, range);
  if (match) {
    return { lines, delta: 0, changed: false };
  }
  const next = [...lines];
  const start = Math.max(0, Math.min(next.length, range.startLine));
  const end = Math.max(start, Math.min(next.length - 1, range.endLine));
  next.splice(start, 0, "#card");
  next.splice(end + 2, 0, "#");
  return { lines: next, delta: 2, changed: true };
};

export const removeExamTaskWrapper = (
  lines: string[],
  range: ExamTaskSourceRange,
) => {
  const match = findExamTaskWrapper(lines, range);
  if (!match) {
    return { lines, delta: 0, changed: false };
  }
  const next = [...lines];
  next.splice(match.endIndex, 1);
  next.splice(match.startIndex, 1);
  return { lines: next, delta: -2, changed: true };
};

export const applyExamCardWrapperActions = (
  content: string,
  tasks: ExamTask[],
  getAction: (task: ExamTask, index: number) => ExamCardWrapperAction,
) => {
  const sortedTasks = [...tasks].sort(
    (a, b) => a.sourceRange.startLine - b.sourceRange.startLine,
  );
  let lines = normalizeLines(content);
  let offset = 0;
  let changed = false;

  sortedTasks.forEach((task) => {
    const action = getAction(task, task.index);
    if (action === "keep") {
      return;
    }
    const startLine = task.sourceRange.startLine + offset;
    const endLine = task.sourceRange.endLine + offset;
    const range = { startLine, endLine };
    if (action === "add") {
      const result = addExamTaskWrapper(lines, range);
      lines = result.lines;
      offset += result.delta;
      changed = changed || result.changed;
      return;
    }
    const result = removeExamTaskWrapper(lines, range);
    lines = result.lines;
    offset += result.delta;
    changed = changed || result.changed;
  });

  return { content: lines.join("\n"), changed };
};
