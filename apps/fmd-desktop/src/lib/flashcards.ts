/**
 * Flashcard syntax:
 * v1 (multiple choice)
 * #card
 * Question line
 * a) Option text
 * -a
 * #
 *
 * v3 (cloze blanks + tokens)
 * #card
 * Question line
 * Body text with input blanks like %%answer%% and drag tokens like `token`
 * #
 *
 * v4 (true/false)
 * #card
 * Statement Wahr/Falsch?
 * -wahr
 * #
 *
 * Invalid cards (missing end marker, empty question, no options/blanks/tokens) are skipped.
 */
export type FlashcardOption = {
  key: string;
  text: string;
};

export type MultipleChoiceCard = {
  kind: "multiple-choice";
  question: string;
  options: FlashcardOption[];
  correctKeys: string[];
};

export type FreeTextCard = {
  kind: "free-text";
  front: string;
  back: string;
};

export type TrueFalseItem = {
  id: string;
  question: string;
  correct: "wahr" | "falsch";
};

export type TrueFalseCard = {
  kind: "true-false";
  items: TrueFalseItem[];
};

export type ClozeSegment =
  | { type: "text"; value: string }
  | { type: "blank"; id: string; kind: "input" | "drag"; solution: string };

export type ClozeDragToken = {
  id: string;
  value: string;
};

export type ClozeCard = {
  kind: "cloze";
  question: string;
  segments: ClozeSegment[];
  dragTokens: ClozeDragToken[];
};

export type Flashcard = MultipleChoiceCard | FreeTextCard | TrueFalseCard | ClozeCard;

export const normalizeInputAnswer = (value: string) => value.trim().toLowerCase();

export const isInputAnswerMatch = (input: string, solution: string) =>
  normalizeInputAnswer(input) === normalizeInputAnswer(solution);

export const normalizeDragAnswer = (value: string) => value.trim();

export const isDragAnswerMatch = (tokenValue: string, solution: string) =>
  normalizeDragAnswer(tokenValue) === normalizeDragAnswer(solution);

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const optionPattern = /^([A-Za-z])\)\s+(.*)$/;
const markerPattern = /^-([A-Za-z])$/;
const answerMarkerPattern = /^(answer|antwort):\s*/i;
const trueFalseSuffix = "Wahr/Falsch?";
const trueFalseMarkerPattern = /^-(wahr|falsch)$/i;

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

const appendText = (segments: ClozeSegment[], text: string) => {
  if (!text) {
    return;
  }
  const last = segments[segments.length - 1];
  if (last?.type === "text") {
    last.value += text;
  } else {
    segments.push({ type: "text", value: text });
  }
};

const parseClozeSegments = (lines: string[]) => {
  const segments: ClozeSegment[] = [];
  const dragTokens: ClozeDragToken[] = [];
  let blankIndex = 0;
  let tokenIndex = 0;
  let inFence = false;
  const fencePattern = /^(```|~~~)/;

  const handleLine = (line: string) => {
    let cursor = 0;

    while (cursor < line.length) {
      const nextInput = line.indexOf("%%", cursor);
      const nextDrag = line.indexOf("`", cursor);
      const nextMarker = Math.min(
        nextInput === -1 ? Number.POSITIVE_INFINITY : nextInput,
        nextDrag === -1 ? Number.POSITIVE_INFINITY : nextDrag,
      );

      if (!Number.isFinite(nextMarker)) {
        appendText(segments, line.slice(cursor));
        break;
      }

      if (nextMarker > cursor) {
        appendText(segments, line.slice(cursor, nextMarker));
      }

      if (nextMarker === nextInput) {
        const end = line.indexOf("%%", nextInput + 2);
        if (end === -1) {
          appendText(segments, line.slice(nextInput));
          break;
        }
        const rawSolution = line.slice(nextInput + 2, end);
        const solution = rawSolution.trim();
        if (!solution) {
          return null;
        }
        segments.push({
          type: "blank",
          id: `blank-${blankIndex}`,
          kind: "input",
          solution,
        });
        blankIndex += 1;
        cursor = end + 2;
        continue;
      }

      const end = line.indexOf("`", nextDrag + 1);
      if (end === -1) {
        appendText(segments, line.slice(nextDrag));
        break;
      }
      const rawToken = line.slice(nextDrag + 1, end);
      const value = rawToken.trim();
      if (!value) {
        appendText(segments, line.slice(nextDrag, end + 1));
        cursor = end + 1;
        continue;
      }
      segments.push({
        type: "blank",
        id: `blank-${blankIndex}`,
        kind: "drag",
        solution: value,
      });
      dragTokens.push({ id: `token-${tokenIndex}`, value });
      blankIndex += 1;
      tokenIndex += 1;
      cursor = end + 1;
    }

    return true;
  };

  const trimmedLines = trimEmptyLines(lines);
  for (let lineIndex = 0; lineIndex < trimmedLines.length; lineIndex += 1) {
    const line = trimmedLines[lineIndex];
    const trimmed = line.trimStart();
    if (fencePattern.test(trimmed)) {
      inFence = !inFence;
      appendText(segments, line);
    } else if (inFence) {
      appendText(segments, line);
    } else {
      const parsed = handleLine(line);
      if (!parsed) {
        return null;
      }
    }

    if (lineIndex < trimmedLines.length - 1) {
      appendText(segments, "\n");
    }
  }

  return { segments, dragTokens };
};

const normalizeTrueFalseMarker = (value: string) => {
  const match = value.match(trueFalseMarkerPattern);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase() as "wahr" | "falsch";
};

const parseTrueFalseItems = (lines: string[]) => {
  const items: TrueFalseItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const question = lines[index].trim();
    if (!question || !question.endsWith(trueFalseSuffix)) {
      continue;
    }

    let markerIndex = index + 1;
    while (markerIndex < lines.length && lines[markerIndex].trim() === "") {
      markerIndex += 1;
    }
    if (markerIndex >= lines.length) {
      continue;
    }

    const marker = normalizeTrueFalseMarker(lines[markerIndex].trim());
    if (!marker) {
      continue;
    }

    items.push({
      id: `tf-${items.length}`,
      question,
      correct: marker,
    });
    index = markerIndex;
  }

  return items;
};

const splitAnswerCard = (lines: string[]) => {
  const markerIndex = lines.findIndex((line) =>
    answerMarkerPattern.test(line.trim()),
  );
  if (markerIndex === -1) {
    return null;
  }
  const frontLines = trimEmptyLines(lines.slice(0, markerIndex));
  const markerLine = lines[markerIndex] ?? "";
  const trimmedMarkerLine = markerLine.trimStart();
  const markerMatch = trimmedMarkerLine.match(answerMarkerPattern);
  const inlineAnswer = markerMatch
    ? trimmedMarkerLine.slice(markerMatch[0].length)
    : "";
  const backLines = [inlineAnswer, ...lines.slice(markerIndex + 1)];
  const normalizedFront = trimEmptyLines(frontLines).join("\n").trim();
  const normalizedBack = trimEmptyLines(backLines).join("\n").trim();
  if (!normalizedFront || !normalizedBack) {
    return null;
  }
  return {
    front: normalizedFront,
    back: normalizedBack,
  };
};

const pushUnique = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

export const parseFlashcards = (markdown: string): Flashcard[] => {
  const lines = normalizeLines(markdown);
  const cards: Flashcard[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (line !== "#card") {
      index += 1;
      continue;
    }

    const cardLines: string[] = [];
    let foundEnd = false;

    index += 1;

    while (index < lines.length) {
      const trimmed = lines[index].trim();
      if (trimmed === "#") {
        foundEnd = true;
        index += 1;
        break;
      }
      if (trimmed === "#card") {
        break;
      }
      cardLines.push(lines[index]);
      index += 1;
    }

    if (!foundEnd) {
      continue;
    }

    const questionIndex = cardLines.findIndex((entry) => entry.trim() !== "");
    if (questionIndex === -1) {
      continue;
    }
    const question = cardLines[questionIndex].trim();
    const bodyLines = cardLines.slice(questionIndex + 1);
    const contentLines = cardLines.slice(questionIndex);

    const options: FlashcardOption[] = [];
    const correctKeys: string[] = [];
    const clozeLines: string[] = [];

    bodyLines.forEach((rawLine) => {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        clozeLines.push("");
        return;
      }

      const optionMatch = trimmed.match(optionPattern);
      if (optionMatch) {
        const text = optionMatch[2].trim();
        if (text) {
          options.push({
            key: optionMatch[1].toLowerCase(),
            text,
          });
        }
        return;
      }

      const markerMatch = trimmed.match(markerPattern);
      if (markerMatch) {
        pushUnique(correctKeys, markerMatch[1].toLowerCase());
        return;
      }

      clozeLines.push(rawLine);
    });

    if (options.length > 0) {
      cards.push({ kind: "multiple-choice", question, options, correctKeys });
      continue;
    }

    const trueFalseItems = parseTrueFalseItems(cardLines.slice(questionIndex));
    if (trueFalseItems.length > 0) {
      cards.push({ kind: "true-false", items: trueFalseItems });
      continue;
    }

    const answerCard = splitAnswerCard(contentLines);
    if (answerCard) {
      cards.push({ kind: "free-text", ...answerCard });
      continue;
    }

    const parsed = parseClozeSegments(clozeLines);
    if (!parsed) {
      continue;
    }
    const hasBlanks = parsed.segments.some((segment) => segment.type === "blank");
    if (hasBlanks) {
      cards.push({
        kind: "cloze",
        question,
        segments: parsed.segments,
        dragTokens: parsed.dragTokens,
      });
    }
  }

  return cards;
};
