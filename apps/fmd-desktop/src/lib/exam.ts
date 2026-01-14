/**
 * @file apps/fmd-desktop/src/lib/exam.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Exam.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Exam bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcards.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/lib/exam.test.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

import {
  extractHelpBlocksFromLines,
  parseFlashcards,
  splitAnswerCard,
  splitCardLines,
  type CompositeFlashcard,
  type Flashcard,
  type FlashcardPart,
} from "./flashcards";
import { findTableLineIndices } from "./markdownTables";

export type ExamTaskSourceRange = {
  startLine: number;
  endLine: number;
};

export type ExamTaskGradingMode = "auto" | "manual" | "hybrid";

export type ExamTaskWarning = {
  message: string;
};

export type ExamTaskBase = {
  id: string;
  index: number;
  rawLines: string[];
  prompt: string;
  officialAnswer?: string;
  helpText?: string[];
  gradingMode: ExamTaskGradingMode;
  sourceRange: ExamTaskSourceRange;
  card: CompositeFlashcard;
  warnings: ExamTaskWarning[];
};

export type ExamTask = ExamTaskBase;

export type ExamParseResult = {
  tasks: ExamTask[];
  hasExamBlock: boolean;
};

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

const wrapperLinePattern = /^\s*#(?:examend|exam|card|endcard)?\s*$/;
const examStartPattern = /^\s*#exam\s*$/;
const examEndPattern = /^\s*#examend\s*$/;
const separatorLinePattern = /^\s*---\s*$/;

const isWrapperLine = (line: string) => wrapperLinePattern.test(line);
const isExamStartLine = (line: string) => examStartPattern.test(line);
const isExamEndLine = (line: string) => examEndPattern.test(line);
const isSeparatorLine = (line: string) => separatorLinePattern.test(line);

const stripWrapperLines = (lines: string[]) =>
  lines.filter((line) => !isWrapperLine(line));

export const stripExamAndFlashcardWrapperLines = (text: string) =>
  stripWrapperLines(normalizeLines(text)).join("\n");

export type ExamAnswerSplit = {
  prompt: string;
  officialAnswer?: string;
  hasAnswerMarker: boolean;
};

const splitAnswerBlockLines = (lines: string[]): ExamAnswerSplit => {
  const answerSplit = splitAnswerCard(lines, { answerMatch: "line-start" });
  if (!answerSplit) {
    return {
      prompt: trimEmptyLines(lines).join("\n").trim(),
      hasAnswerMarker: false,
    };
  }
  return {
    prompt: answerSplit.front,
    officialAnswer: answerSplit.back,
    hasAnswerMarker: true,
  };
};

export const splitAnswerBlock = (text: string): ExamAnswerSplit =>
  splitAnswerBlockLines(normalizeLines(text));

const isAutoGradablePart = (part: FlashcardPart) => {
  if (part.kind === "multiple-choice") {
    return part.correctKeys.length > 0;
  }
  if (part.kind === "true-false") {
    return part.items.length > 0;
  }
  if (part.kind === "cloze") {
    return part.segments.some((segment) => segment.type === "blank");
  }
  return false;
};

const resolveTaskGradingMode = (
  card: CompositeFlashcard,
): ExamTaskGradingMode => {
  const hasAuto = card.parts.some(isAutoGradablePart);
  const hasManual = card.parts.some((part) => !isAutoGradablePart(part));

  if (hasAuto && hasManual) {
    return "hybrid";
  }
  if (hasManual) {
    return "manual";
  }
  return "auto";
};

const isExamTaskStartLine = (line: string) => {
  let trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("**")) {
    trimmed = trimmed.slice(2).trimStart();
  }

  if (trimmed.startsWith("-")) {
    trimmed = trimmed.slice(1);
  }

  const numberMatch = trimmed.match(/^(\d+)/);
  if (!numberMatch) {
    return false;
  }

  const numberRaw = numberMatch[1] ?? "";
  if (numberRaw.length > 1 && numberRaw.startsWith("0")) {
    return false;
  }

  const number = Number.parseInt(numberRaw, 10);
  if (number < 1 || number > 20) {
    return false;
  }

  let remainder = trimmed.slice(numberRaw.length);
  if (remainder.startsWith(")")) {
    remainder = remainder.slice(1);
  }
  if (remainder.startsWith("**")) {
    remainder = remainder.slice(2);
  }

  return remainder.length === 0 || /^\s/.test(remainder);
};

const normalizeTaskLines = (lines: string[]) => {
  const stripped = stripWrapperLines(lines);
  return trimEmptyLines(stripped);
};

const toCompositeCard = (card: Flashcard): CompositeFlashcard => {
  if (card.kind === "composite") {
    return card;
  }
  return {
    kind: "composite",
    parts: [card],
    primaryType: card.primaryType,
    detectedTypes: card.detectedTypes,
    isMixed: card.isMixed,
  };
};

const buildFallbackCard = (split: ExamAnswerSplit): CompositeFlashcard => {
  const front =
    split.prompt || (split.hasAnswerMarker ? "" : "No task content provided.");
  const back = split.hasAnswerMarker ? split.officialAnswer ?? "" : "";

  return {
    kind: "composite",
    parts: [
      {
        kind: "free-text",
        front,
        back,
      },
    ],
    primaryType: "qa",
    detectedTypes: ["qa"],
    isMixed: false,
  };
};

const parseTaskChunk = (
  chunkLines: string[],
  taskIndex: number,
  sourceRange: ExamTaskSourceRange,
): ExamTask => {
  const warnings: ExamTaskWarning[] = [];
  const normalizedLines = normalizeTaskLines(chunkLines);
  const { helpText, contentLines } = extractHelpBlocksFromLines(normalizedLines);
  const answerSplit = splitAnswerBlockLines(contentLines);
  const cardSource = `#card\n${contentLines.join("\n")}\n#`;
  const parsed = parseFlashcards(cardSource, { answerMatch: "line-start" });
  let card: CompositeFlashcard | null = null;
  let officialAnswer: string | undefined;

  if (parsed.length === 0) {
    warnings.push({
      message: "No supported flashcard syntax found. Manual grading required.",
    });
    card = buildFallbackCard(answerSplit);
    if (answerSplit.hasAnswerMarker) {
      officialAnswer = answerSplit.officialAnswer ?? "";
    }
  } else {
    if (parsed.length > 1) {
      warnings.push({
        message: "Multiple cards detected in a single task. Using the first card.",
      });
    }
    card = toCompositeCard(parsed[0]);
    const answerBlocks = splitCardLines(contentLines, "line-start");
    const qaAnswers = answerBlocks
      .map((block) => splitAnswerCard(block, { answerMatch: "line-start" }))
      .filter(
        (split): split is { front: string; back: string } => Boolean(split),
      )
      .map((split) => split.back);
    if (qaAnswers.length > 0) {
      officialAnswer = qaAnswers.join("\n\n");
    } else if (answerSplit.hasAnswerMarker) {
      officialAnswer = answerSplit.officialAnswer ?? "";
    }
  }
  const gradingMode = resolveTaskGradingMode(card);

  return {
    id: `exam-task-${taskIndex + 1}`,
    index: taskIndex,
    rawLines: [...chunkLines],
    prompt: answerSplit.prompt,
    officialAnswer,
    gradingMode,
    sourceRange,
    card,
    warnings,
    helpText: helpText.length > 0 ? helpText : undefined,
  };
};

export const parseExamTasks = (markdown: string): ExamParseResult => {
  const lines = normalizeLines(markdown);
  const tasks: ExamTask[] = [];
  let inExam = false;
  let currentTaskStart: number | null = null;
  let hasExamBlock = false;
  const tableLineIndices = findTableLineIndices(lines);

  const flushTask = (endLine: number) => {
    if (currentTaskStart === null || endLine < currentTaskStart) {
      currentTaskStart = null;
      return;
    }
    const chunkLines = lines.slice(currentTaskStart, endLine + 1);
    const task = parseTaskChunk(chunkLines, tasks.length, {
      startLine: currentTaskStart,
      endLine,
    });
    tasks.push(task);
    currentTaskStart = null;
  };

  lines.forEach((line, index) => {
    if (!inExam) {
      if (isExamStartLine(line)) {
        inExam = true;
        currentTaskStart = null;
        hasExamBlock = true;
      }
      return;
    }

    if (isExamEndLine(line)) {
      flushTask(index - 1);
      inExam = false;
      currentTaskStart = null;
      return;
    }

    if (isSeparatorLine(line)) {
      if (!tableLineIndices.has(index)) {
        flushTask(index - 1);
        currentTaskStart = null;
      }
      return;
    }

    if (isExamTaskStartLine(line)) {
      if (currentTaskStart !== null) {
        flushTask(index - 1);
      }
      currentTaskStart = index;
    }
  });

  if (inExam && currentTaskStart !== null) {
    flushTask(lines.length - 1);
  }

  return { tasks, hasExamBlock };
};
