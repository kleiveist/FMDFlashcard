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
  parseFlashcards,
  splitAnswerCard,
  splitCardLines,
  type CompositeFlashcard,
  type Flashcard,
  type FlashcardMetadata,
  type FlashcardPart,
} from "./flashcards";
import { findTableLineIndices } from "./markdownTables";
import { extractAuxiliaryBlocksFromLines } from "./auxiliaryBlocks";
import { extractMediaFromLines, type MediaItem } from "./cardMedia";
import { normalizeExamDotNumberedLines } from "./examDotMarkers";

export type ExamTaskSourceRange = {
  startLine: number;
  endLine: number;
};

export type ExamTaskGradingMode = "auto" | "manual" | "hybrid";

export type ExamTaskWarning = {
  message: string;
};

type ExamCompositeFlashcard = CompositeFlashcard & FlashcardMetadata;

export type ExamTaskBase = {
  id: string;
  index: number;
  rawLines: string[];
  prompt: string;
  officialAnswer?: string;
  helpText?: string[];
  media?: MediaItem[];
  gradingMode: ExamTaskGradingMode;
  sourceRange: ExamTaskSourceRange;
  cardWrapper: boolean;
  cardLines: string[];
  card: ExamCompositeFlashcard;
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

const wrapperLinePattern = /^\s*#(?:endexam|exam|card|endcard)\s*$/i;
const examStartPattern = /^\s*#exam\s*$/i;
const examEndPattern = /^\s*#endexam\s*$/i;
const cardStartPattern = /^\s*#card\s*$/i;
const cardEndPattern = /^\s*#endcard\s*$/i;
const taskSeparatorPattern = /^\s*---\s*$/;
const taskHeaderPattern = /^\s*(\d+)\)\s*(.*)$/;
const fencePattern = /^\s*(```|~~~)/;

const isWrapperLine = (line: string) => wrapperLinePattern.test(line);
const isExamStartLine = (line: string) => examStartPattern.test(line);
const isExamEndLine = (line: string) => examEndPattern.test(line);
const isCardStartLine = (line: string) => cardStartPattern.test(line);
const isCardEndLine = (line: string) => cardEndPattern.test(line);
const isTaskSeparatorLine = (line: string) => taskSeparatorPattern.test(line);
const isStrictCardWrapperStartLine = (line: string) =>
  line.trim().toLowerCase() === "#card";
const isStrictCardWrapperEndLine = (line: string) => {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "#endcard";
};

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

const getExamTaskStartNumber = (line: string) => {
  const numberMatch = line.match(taskHeaderPattern);
  if (!numberMatch) {
    return null;
  }

  const numberRaw = numberMatch[1] ?? "";
  if (numberRaw.length > 1 && numberRaw.startsWith("0")) {
    return null;
  }

  const number = Number.parseInt(numberRaw, 10);
  if (number < 1 || number > 99) {
    return null;
  }

  return number;
};

const normalizeTaskLines = (lines: string[]) => {
  const stripped = stripWrapperLines(lines);
  return trimEmptyLines(stripped);
};

type ExamTaskLineSplit = {
  combinedLines: string[];
  taskLines: string[];
  cardLines: string[];
};

const splitExamTaskLines = (lines: string[]): ExamTaskLineSplit => {
  const combinedLines: string[] = [];
  const taskLines: string[] = [];
  const cardLines: string[] = [];
  let inCard = false;

  lines.forEach((line) => {
    if (isCardStartLine(line)) {
      inCard = true;
      return;
    }
    if (isCardEndLine(line)) {
      inCard = false;
      return;
    }
    if (isWrapperLine(line)) {
      return;
    }
    combinedLines.push(line);
    if (inCard) {
      cardLines.push(line);
      return;
    }
    taskLines.push(line);
  });

  return {
    combinedLines: trimEmptyLines(combinedLines),
    taskLines: trimEmptyLines(taskLines),
    cardLines: trimEmptyLines(cardLines),
  };
};

const findLastNonEmptyIndex = (lines: string[]) => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.trim() !== "") {
      return index;
    }
  }
  return -1;
};

const findPreviousNonEmptyIndex = (lines: string[], startIndex: number) => {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if (lines[index]?.trim() !== "") {
      return index;
    }
  }
  return -1;
};

const findTaskHeaderIndex = (lines: string[]) =>
  lines.findIndex((line) => taskHeaderPattern.test(line.trim()));

const isTaskFullyWrappedInCard = (taskChunkLines: string[]) => {
  const taskHeaderIndex = findTaskHeaderIndex(taskChunkLines);
  if (taskHeaderIndex === -1) {
    return false;
  }

  const openerIndex = findPreviousNonEmptyIndex(taskChunkLines, taskHeaderIndex);
  if (
    openerIndex === -1 ||
    !isStrictCardWrapperStartLine(taskChunkLines[openerIndex] ?? "")
  ) {
    return false;
  }

  if (findPreviousNonEmptyIndex(taskChunkLines, openerIndex) !== -1) {
    return false;
  }

  const lastNonEmpty = findLastNonEmptyIndex(taskChunkLines);
  if (lastNonEmpty === -1) {
    return false;
  }
  if (!isStrictCardWrapperEndLine(taskChunkLines[lastNonEmpty] ?? "")) {
    return false;
  }
  if (openerIndex >= lastNonEmpty) {
    return false;
  }

  return true;
};

const toCompositeCard = (card: Flashcard): ExamCompositeFlashcard => {
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

const buildFallbackCard = (split: ExamAnswerSplit): ExamCompositeFlashcard => {
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
  const normalizedLines = normalizeExamDotNumberedLines(
    normalizeTaskLines(chunkLines),
  );
  const splitLines = splitExamTaskLines(chunkLines);
  const combinedLines = normalizeExamDotNumberedLines(splitLines.combinedLines);
  const taskLines = normalizeExamDotNumberedLines(splitLines.taskLines);
  const cardLines = normalizeExamDotNumberedLines(splitLines.cardLines);
  const hasCardWrapper = isTaskFullyWrappedInCard(chunkLines);
  const taskAuxiliary = extractAuxiliaryBlocksFromLines(taskLines);
  const taskMediaExtraction = extractMediaFromLines(taskAuxiliary.contentLines, "exam-task-media");
  const taskMedia = taskMediaExtraction.items;
  const taskHelpText = taskAuxiliary.helpText;
  const taskContentLines = taskMediaExtraction.contentLines;
  const combinedAuxiliary = extractAuxiliaryBlocksFromLines(
    combinedLines.length > 0 ? combinedLines : normalizedLines,
  );
  const { contentLines: combinedContentLines } = extractMediaFromLines(
    combinedAuxiliary.contentLines,
    "exam-combined-media",
  );
  const cardInputLines =
    cardLines.length > 0 ? cardLines : taskContentLines.length > 0 ? taskContentLines : normalizedLines;
  const answerSplit = splitAnswerBlockLines(combinedContentLines);
  const cardSource = `#card\n${cardInputLines.join("\n")}\n#endcard`;
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
    const answerBlocks = splitCardLines(combinedContentLines, "line-start");
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
    helpText: taskHelpText.length > 0 ? taskHelpText : undefined,
    media: taskMedia.length > 0 ? taskMedia : undefined,
    cardWrapper: hasCardWrapper,
    cardLines: cardInputLines,
  };
};

export const parseExamTasks = (markdown: string): ExamParseResult => {
  const lines = normalizeLines(markdown);
  const tableLineIndices = findTableLineIndices(lines);
  const tasks: ExamTask[] = [];
  let inExam = false;
  let inCardWrapper = false;
  let currentTaskStart: number | null = null;
  let currentTaskNumber: number | null = null;
  let sawExamStart = false;
  let sawExamEnd = false;
  let inFence = false;
  let fenceToken = "";

  const findPreviousNonEmptyLineIndex = (startIndex: number) => {
    for (let index = startIndex - 1; index >= 0; index -= 1) {
      if (lines[index]?.trim() !== "") {
        return index;
      }
    }
    return null;
  };

  const resolveTaskStartLine = (taskHeaderIndex: number) => {
    const previousNonEmpty = findPreviousNonEmptyLineIndex(taskHeaderIndex);
    if (
      previousNonEmpty !== null &&
      isCardStartLine(lines[previousNonEmpty] ?? "")
    ) {
      return previousNonEmpty;
    }
    return taskHeaderIndex;
  };

  const resolveTaskEndLine = (startLine: number, endLine: number) => {
    let last = endLine;
    while (last >= startLine) {
      const line = lines[last] ?? "";
      if (line.trim() === "" || isTaskSeparatorLine(line)) {
        last -= 1;
        continue;
      }
      break;
    }
    return last;
  };

  const flushTask = (endLine: number) => {
    if (currentTaskStart === null || endLine < currentTaskStart) {
      currentTaskStart = null;
      currentTaskNumber = null;
      return;
    }
    const taskEndLine = resolveTaskEndLine(currentTaskStart, endLine);
    if (taskEndLine < currentTaskStart) {
      currentTaskStart = null;
      currentTaskNumber = null;
      return;
    }
    const chunkLines = lines.slice(currentTaskStart, taskEndLine + 1);
    const task = parseTaskChunk(chunkLines, tasks.length, {
      startLine: currentTaskStart,
      endLine: taskEndLine,
    });
    tasks.push(task);
    currentTaskStart = null;
    currentTaskNumber = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(fencePattern);
    if (fenceMatch) {
      if (inFence && fenceMatch[1] === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[1] ?? "";
      }
      return;
    }

    if (inFence || tableLineIndices.has(index)) {
      return;
    }

    if (!inExam) {
      if (isExamStartLine(line)) {
        inExam = true;
        inCardWrapper = false;
        sawExamStart = true;
        currentTaskStart = null;
        currentTaskNumber = null;
      }
      return;
    }

    if (isExamEndLine(line)) {
      flushTask(index - 1);
      inExam = false;
      inCardWrapper = false;
      sawExamEnd = true;
      currentTaskStart = null;
      currentTaskNumber = null;
      return;
    }

    if (isCardStartLine(line)) {
      inCardWrapper = true;
      return;
    }

    if (isCardEndLine(line)) {
      inCardWrapper = false;
      return;
    }

    if (isTaskSeparatorLine(line) && !inCardWrapper) {
      flushTask(index - 1);
      return;
    }

    const taskNumber = getExamTaskStartNumber(line);
    if (taskNumber !== null) {
      const taskStartLine = resolveTaskStartLine(index);
      if (currentTaskStart !== null && currentTaskNumber === taskNumber) {
        return;
      }
      if (currentTaskStart !== null) {
        flushTask(taskStartLine - 1);
      }
      currentTaskStart = taskStartLine;
      currentTaskNumber = taskNumber;
    }
  });

  if (inExam && currentTaskStart !== null) {
    flushTask(lines.length - 1);
  }

  return { tasks, hasExamBlock: sawExamStart && sawExamEnd };
};
