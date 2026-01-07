import {
  parseFlashcards,
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

const buildPrompt = (lines: string[]) =>
  trimEmptyLines(lines).join("\n").trim();

const hasCardWrapper = (lines: string[]) =>
  lines.some((line) => line.trim() === "#card");

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

const buildFallbackCard = (lines: string[]): CompositeFlashcard => ({
  kind: "composite",
  parts: [
    {
      kind: "free-text",
      front: buildPrompt(lines) || "No task content provided.",
      back: "",
    },
  ],
  primaryType: "qa",
  detectedTypes: ["qa"],
  isMixed: false,
});

const parseTaskChunk = (
  chunkLines: string[],
  taskIndex: number,
  sourceRange: ExamTaskSourceRange,
): ExamTask => {
  const warnings: ExamTaskWarning[] = [];
  const body = chunkLines.join("\n");
  const cardSource = hasCardWrapper(chunkLines)
    ? body
    : `#card\n${body}\n#`;
  const parsed = parseFlashcards(cardSource);
  let card: CompositeFlashcard | null = null;

  if (parsed.length === 0) {
    warnings.push({
      message: "No supported flashcard syntax found. Manual grading required.",
    });
    card = buildFallbackCard(chunkLines);
  } else {
    if (parsed.length > 1) {
      warnings.push({
        message: "Multiple cards detected in a single task. Using the first card.",
      });
    }
    card = toCompositeCard(parsed[0]);
  }

  return {
    id: `exam-task-${taskIndex + 1}`,
    index: taskIndex,
    rawLines: [...chunkLines],
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

    if (trimmed === "#" && inCard) {
      inCard = false;
      return;
    }

    if (trimmed === "#" && !inCard) {
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
