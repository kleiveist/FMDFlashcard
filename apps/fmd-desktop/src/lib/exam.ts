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
  type CompositeFlashcard,
  type Flashcard,
} from "./flashcards";

export type ExamTaskSourceRange = {
  startLine: number;
  endLine: number;
};

export type ExamTaskWarning = {
  message: string;
};

export type ExamTaskBase = {
  id: string;
  index: number;
  rawLines: string[];
  prompt: string;
  officialAnswer?: string;
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

const wrapperLineTokens = new Set(["#exam", "#endexam", "#card", "#endcard", "#"]);

const stripWrapperLines = (lines: string[]) =>
  lines.filter((line) => !wrapperLineTokens.has(line.trim()));

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

const appendAnswerPart = (
  card: CompositeFlashcard,
  answer: string,
): CompositeFlashcard => {
  const detectedTypes = [...(card.detectedTypes ?? [])];
  if (!detectedTypes.includes("qa")) {
    detectedTypes.push("qa");
  }

  return {
    ...card,
    parts: [
      ...card.parts,
      {
        kind: "free-text",
        front: "",
        back: answer,
      },
    ],
    detectedTypes,
    isMixed: detectedTypes.length >= 2,
    primaryType: detectedTypes.length === 1 ? detectedTypes[0] : undefined,
  };
};

const parseTaskChunk = (
  chunkLines: string[],
  taskIndex: number,
  sourceRange: ExamTaskSourceRange,
): ExamTask => {
  const warnings: ExamTaskWarning[] = [];
  const normalizedLines = normalizeTaskLines(chunkLines);
  const answerSplit = splitAnswerBlockLines(normalizedLines);
  const prompt = answerSplit.prompt;
  const cardSource = `#card\n${prompt}\n#`;
  const parsed = parseFlashcards(cardSource, { answerMatch: "line-start" });
  let card: CompositeFlashcard | null = null;

  if (parsed.length === 0) {
    warnings.push({
      message: "No supported flashcard syntax found. Manual grading required.",
    });
    card = buildFallbackCard(answerSplit);
  } else {
    if (parsed.length > 1) {
      warnings.push({
        message: "Multiple cards detected in a single task. Using the first card.",
      });
    }
    card = toCompositeCard(parsed[0]);
    if (answerSplit.hasAnswerMarker) {
      card = appendAnswerPart(card, answerSplit.officialAnswer ?? "");
    }
  }

  return {
    id: `exam-task-${taskIndex + 1}`,
    index: taskIndex,
    rawLines: [...chunkLines],
    prompt: answerSplit.prompt,
    officialAnswer: answerSplit.hasAnswerMarker ? answerSplit.officialAnswer ?? "" : undefined,
    sourceRange,
    card,
    warnings,
  };
};

export const parseExamTasks = (markdown: string): ExamParseResult => {
  const lines = normalizeLines(markdown);
  const tasks: ExamTask[] = [];
  let inExam = false;
  let inCard = false;
  let currentTaskStart: number | null = null;
  let hasExamBlock = false;

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
    const trimmed = line.trim();
    if (!inExam) {
      if (trimmed === "#exam") {
        inExam = true;
        inCard = false;
        currentTaskStart = null;
        hasExamBlock = true;
      }
      return;
    }

    if (trimmed === "#card") {
      inCard = true;
      return;
    }

    if ((trimmed === "#" || trimmed === "#endcard") && inCard) {
      inCard = false;
      return;
    }

    if ((trimmed === "#" || trimmed === "#endexam") && !inCard) {
      flushTask(index - 1);
      inExam = false;
      currentTaskStart = null;
      return;
    }

    if (trimmed === "---" && !inCard) {
      flushTask(index - 1);
      currentTaskStart = null;
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
