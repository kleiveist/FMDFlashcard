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
  prompt: string;
  warnings: ExamTaskWarning[];
};

export type ExamOption = {
  key: string;
  text: string;
};

export type ExamMultipleChoiceTask = ExamTaskBase & {
  kind: "multiple-choice";
  options: ExamOption[];
  correctKey: string | null;
};

export type ExamTextTask = ExamTaskBase & {
  kind: "text";
  answer: string | null;
};

export type ExamTask = ExamMultipleChoiceTask | ExamTextTask;

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

const answerMarkerLinePattern =
  /^\s*(\*\*)?\s*(answer|antwort)\s*:\s*(\*\*)?\s*$/i;
const inlineAnswerTokenPattern =
  /(\*\*)?\s*\b(answer|antwort)\b\s*:\s*(\*\*)?/i;
const optionPattern = /^([a-z])\)\s+(.+)$/;
const markerPattern = /^-([a-z])$/;

const buildPrompt = (lines: string[]) =>
  trimEmptyLines(lines).join("\n").trim();

const stripInlineAnswerMarker = (line: string) => {
  if (answerMarkerLinePattern.test(line)) {
    return line;
  }
  const match = inlineAnswerTokenPattern.exec(line);
  if (!match || match.index === undefined) {
    return line;
  }
  const before = line.slice(0, match.index);
  const after = line.slice(match.index + match[0].length);
  const needsSpacer =
    before.length > 0 &&
    after.length > 0 &&
    !before.endsWith(" ") &&
    !after.startsWith(" ");
  const spacer = needsSpacer ? " " : "";
  return `${before}${spacer}${after}`.trimEnd();
};

const parseAnswerBlock = (lines: string[]) => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!answerMarkerLinePattern.test(line)) {
      continue;
    }
    const frontLines = trimEmptyLines(
      lines.slice(0, index).map(stripInlineAnswerMarker),
    );
    const backLines = trimEmptyLines(lines.slice(index + 1));
    const prompt = buildPrompt(frontLines);
    const answer = buildPrompt(backLines);
    if (!prompt || !answer) {
      return null;
    }
    return { prompt, answer };
  }
  return null;
};

const parseTaskChunk = (
  chunkLines: string[],
  taskIndex: number,
  sourceRange: ExamTaskSourceRange,
): ExamTask => {
  const options: ExamOption[] = [];
  const markerKeys: string[] = [];
  const optionLineIndices = new Set<number>();
  const markerLineIndices = new Set<number>();
  const warnings: ExamTaskWarning[] = [];

  chunkLines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }
    const optionMatch = trimmed.match(optionPattern);
    if (optionMatch) {
      const text = optionMatch[2]?.trim();
      if (text) {
        options.push({
          key: optionMatch[1].toLowerCase(),
          text,
        });
      }
      optionLineIndices.add(index);
      return;
    }
    const markerMatch = trimmed.match(markerPattern);
    if (markerMatch) {
      markerKeys.push(markerMatch[1].toLowerCase());
      markerLineIndices.add(index);
    }
  });

  if (options.length > 0) {
    const answerMarkerIndices = new Set<number>();
    chunkLines.forEach((line, index) => {
      if (answerMarkerLinePattern.test(line)) {
        answerMarkerIndices.add(index);
      }
    });
    const promptLines = chunkLines.filter((_, index) => {
      if (optionLineIndices.has(index)) {
        return false;
      }
      if (markerLineIndices.has(index)) {
        return false;
      }
      if (answerMarkerIndices.has(index)) {
        return false;
      }
      return true;
    }).map(stripInlineAnswerMarker);
    let correctKey: string | null = null;

    if (markerKeys.length === 1) {
      const candidate = markerKeys[0] ?? null;
      if (candidate && options.some((option) => option.key === candidate)) {
        correctKey = candidate;
      } else {
        warnings.push({
          message: "Answer marker does not match any option. Manual grading required.",
        });
      }
    } else if (markerKeys.length > 1) {
      warnings.push({
        message: "Multiple answer markers found. Manual grading required.",
      });
    } else {
      warnings.push({ message: "No answer marker found. Manual grading required." });
    }

    const prompt = buildPrompt(promptLines);

    return {
      id: `exam-task-${taskIndex + 1}`,
      index: taskIndex,
      rawLines: [...chunkLines],
      sourceRange,
      prompt,
      warnings,
      kind: "multiple-choice",
      options,
      correctKey,
    };
  }

  const answerBlock = parseAnswerBlock(chunkLines);
  if (answerBlock) {
    return {
      id: `exam-task-${taskIndex + 1}`,
      index: taskIndex,
      rawLines: [...chunkLines],
      sourceRange,
      prompt: answerBlock.prompt,
      warnings,
      kind: "text",
      answer: answerBlock.answer,
    };
  }

  return {
    id: `exam-task-${taskIndex + 1}`,
    index: taskIndex,
    rawLines: [...chunkLines],
    sourceRange,
    prompt: buildPrompt(chunkLines.map(stripInlineAnswerMarker)),
    warnings,
    kind: "text",
    answer: null,
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
