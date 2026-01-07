import { answerMarkers, falseTokens, trueTokens } from "./flashcardKeywords";

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

export type FlashcardPart = MultipleChoiceCard | FreeTextCard | TrueFalseCard | ClozeCard;

export type CompositeFlashcard = {
  kind: "composite";
  parts: FlashcardPart[];
};

export type FlashcardDetectedType =
  | "qa"
  | "multiple-choice"
  | "fill-blank"
  | "assignment"
  | "true-false";

export type FlashcardMetadata = {
  primaryType?: FlashcardDetectedType;
  detectedTypes?: FlashcardDetectedType[];
  isMixed?: boolean;
};

export type Flashcard = (FlashcardPart | CompositeFlashcard) & FlashcardMetadata;

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
const assignmentPattern = /^(.+?)=>\s*(.+)$/;
const separatorLine = "---";

const normalizeKeyword = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizedTrueTokens = new Set(trueTokens.map(normalizeKeyword));
const normalizedFalseTokens = new Set(falseTokens.map(normalizeKeyword));
const normalizeAnswerToken = (value: string) =>
  normalizeKeyword(value).replace(/\s+/g, "");

const normalizedAnswerMarkers = answerMarkers.map((marker) => ({
  raw: marker,
  normalized: normalizeAnswerToken(marker.replace(/:\\s*$/, "")),
}));

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

const isSeparatorLine = (line: string) => line.trim() === separatorLine;

const isAssignmentLine = (line: string) => {
  const match = line.match(assignmentPattern);
  if (!match) {
    return false;
  }
  const left = match[1].trim();
  const right = match[2].trim();
  return Boolean(left && right);
};

const normalizeAssignmentLine = (line: string) => {
  const match = line.match(assignmentPattern);
  if (!match) {
    return null;
  }
  const left = match[1].trimEnd();
  const right = match[2].trim();
  if (!left || !right) {
    return null;
  }
  const normalizedRight =
    right.startsWith("`") && right.endsWith("`") ? right : `\`${right}\``;
  return `${left} => ${normalizedRight}`;
};

const isOptionLine = (line: string) => optionPattern.test(line.trim());
const isCorrectMarkerLine = (line: string) => markerPattern.test(line.trim());
const isTrueFalseMarkerLine = (line: string) =>
  normalizeTrueFalseMarker(line.trim()) !== null;
const isAnswerMarkerLine = (line: string) => Boolean(findAnswerMarkerMatch(line));
const hasClozeMarker = (line: string) => line.includes("%%") || line.includes("`");

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
  const trimmed = value.trim();
  if (!trimmed.startsWith("-")) {
    return null;
  }
  const rawToken = trimmed.slice(1).trim();
  if (!rawToken) {
    return null;
  }
  const cleaned = rawToken.replace(/[.,;:!?]+$/g, "");
  const normalized = normalizeKeyword(cleaned);
  if (normalizedTrueTokens.has(normalized)) {
    return "wahr";
  }
  if (normalizedFalseTokens.has(normalized)) {
    return "falsch";
  }
  return null;
};

const parseTrueFalseItems = (lines: string[]) => {
  const items: TrueFalseItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const question = lines[index].trim();
    if (!question) {
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

const findAnswerMarkerMatch = (line: string) => {
  const trimmedLine = line.trimStart();
  const hasBoldPrefix = trimmedLine.startsWith("**");
  const candidate = hasBoldPrefix ? trimmedLine.slice(2).trimStart() : trimmedLine;
  const colonIndex = candidate.indexOf(":");
  if (colonIndex < 0) {
    return null;
  }
  const prefix = candidate.slice(0, colonIndex);
  const normalizedPrefix = normalizeAnswerToken(prefix);
  const match = normalizedAnswerMarkers.find(
    (marker) => normalizedPrefix === marker.normalized,
  );
  if (!match) {
    return null;
  }
  const offset = trimmedLine.length - candidate.length;
  const markerEndIndex = offset + colonIndex + 1;
  return { trimmedLine, markerEndIndex, hasBoldPrefix };
};

const findAnswerMarkerLine = (lines: string[]) => {
  for (let index = 0; index < lines.length; index += 1) {
    const match = findAnswerMarkerMatch(lines[index] ?? "");
    if (match) {
      return { index, match };
    }
  }
  return null;
};

const splitAnswerCard = (lines: string[]) => {
  const markerInfo = findAnswerMarkerLine(lines);
  if (!markerInfo) {
    return null;
  }
  const frontLines = trimEmptyLines(lines.slice(0, markerInfo.index));
  const inlineAnswerRaw = markerInfo.match.trimmedLine
    .slice(markerInfo.match.markerEndIndex)
    .trimStart();
  const inlineAnswer =
    markerInfo.match.hasBoldPrefix && inlineAnswerRaw.startsWith("**")
      ? inlineAnswerRaw.slice(2).trimStart()
      : inlineAnswerRaw;
  const backLines = [inlineAnswer, ...lines.slice(markerInfo.index + 1)];
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

type CardSplitState = {
  hasQuestion: boolean;
  hasOption: boolean;
  hasCorrectMarker: boolean;
  hasAnswerMarker: boolean;
  hasTrueFalseMarker: boolean;
  hasClozeMarker: boolean;
  hasAssignmentLine: boolean;
};

const createSplitState = (): CardSplitState => ({
  hasQuestion: false,
  hasOption: false,
  hasCorrectMarker: false,
  hasAnswerMarker: false,
  hasTrueFalseMarker: false,
  hasClozeMarker: false,
  hasAssignmentLine: false,
});

const splitCardLines = (lines: string[]) => {
  const blocks: string[][] = [];
  let current: string[] = [];
  let state = createSplitState();

  const reset = () => {
    current = [];
    state = createSplitState();
  };

  const flush = () => {
    const trimmed = trimEmptyLines(current);
    if (trimmed.length > 0) {
      blocks.push(trimmed);
    }
    reset();
  };

  const updateState = (line: string) => {
    const trimmed = line.trim();
    if (!state.hasQuestion && trimmed) {
      state.hasQuestion = true;
    }
    if (isOptionLine(line)) {
      state.hasOption = true;
    }
    if (isCorrectMarkerLine(line)) {
      state.hasCorrectMarker = true;
    }
    if (isAnswerMarkerLine(line)) {
      state.hasAnswerMarker = true;
    }
    if (isTrueFalseMarkerLine(line)) {
      state.hasTrueFalseMarker = true;
    }
    if (hasClozeMarker(line)) {
      state.hasClozeMarker = true;
    }
    if (isAssignmentLine(line)) {
      state.hasAssignmentLine = true;
    }
  };

  const isComplete = () =>
    state.hasTrueFalseMarker ||
    (state.hasOption && state.hasCorrectMarker) ||
    state.hasAnswerMarker ||
    state.hasClozeMarker ||
    state.hasAssignmentLine;

  const findNextNonEmpty = (startIndex: number) => {
    for (let i = startIndex; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (!trimmed || isSeparatorLine(lines[i])) {
        continue;
      }
      return trimmed;
    }
    return null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (isSeparatorLine(line)) {
      flush();
      continue;
    }

    if (
      current.length > 0 &&
      state.hasOption &&
      state.hasCorrectMarker &&
      trimmed &&
      !isOptionLine(line) &&
      !isCorrectMarkerLine(line)
    ) {
      flush();
    }

    current.push(line);
    updateState(line);

    if (state.hasTrueFalseMarker && state.hasQuestion && isTrueFalseMarkerLine(line)) {
      flush();
      continue;
    }

    if (!trimmed && isComplete()) {
      const nextNonEmpty = findNextNonEmpty(index + 1);
      if (nextNonEmpty) {
        flush();
      }
    }
  }

  flush();
  return blocks;
};

const parseCardLines = (
  cardLines: string[],
): { part: FlashcardPart; detectedTypes: FlashcardDetectedType[] } | null => {
  const questionIndex = cardLines.findIndex((entry) => entry.trim() !== "");
  if (questionIndex === -1) {
    return null;
  }
  const question = cardLines[questionIndex].trim();
  const bodyLines = cardLines.slice(questionIndex + 1);
  const contentLines = cardLines.slice(questionIndex);

  const options: FlashcardOption[] = [];
  const correctKeys: string[] = [];
  const clozeLines: string[] = [];
  let hasAssignmentLines = false;

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

    const assignmentLine = normalizeAssignmentLine(rawLine);
    if (assignmentLine) {
      hasAssignmentLines = true;
      clozeLines.push(assignmentLine);
      return;
    }

    clozeLines.push(rawLine);
  });

  const detectedTypes: FlashcardDetectedType[] = [];
  if (options.length > 0) {
    pushUnique(detectedTypes, "multiple-choice");
  }

  const trueFalseItems = parseTrueFalseItems(cardLines.slice(questionIndex));
  if (trueFalseItems.length > 0) {
    pushUnique(detectedTypes, "true-false");
  }

  const answerCard = splitAnswerCard(contentLines);
  if (answerCard) {
    pushUnique(detectedTypes, "qa");
  }

  const parsed = parseClozeSegments(clozeLines);
  let hasInputBlanks = false;
  let hasDragBlanks = false;
  if (parsed) {
    parsed.segments.forEach((segment) => {
      if (segment.type !== "blank") {
        return;
      }
      if (segment.kind === "input") {
        hasInputBlanks = true;
      } else {
        hasDragBlanks = true;
      }
    });
  }
  if (hasInputBlanks) {
    pushUnique(detectedTypes, "fill-blank");
  }
  if (hasDragBlanks || hasAssignmentLines) {
    pushUnique(detectedTypes, "assignment");
  }

  if (options.length > 0) {
    return {
      part: {
        kind: "multiple-choice",
        question,
        options,
        correctKeys,
      },
      detectedTypes,
    };
  }

  if (trueFalseItems.length > 0) {
    return {
      part: {
        kind: "true-false",
        items: trueFalseItems,
      },
      detectedTypes,
    };
  }

  if (answerCard) {
    return {
      part: {
        kind: "free-text",
        ...answerCard,
      },
      detectedTypes,
    };
  }

  if (!parsed) {
    return null;
  }
  if (hasInputBlanks || hasDragBlanks || hasAssignmentLines) {
    return {
      part: {
        kind: "cloze",
        question,
        segments: parsed.segments,
        dragTokens: parsed.dragTokens,
      },
      detectedTypes,
    };
  }

  return null;
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

    const blocks = splitCardLines(cardLines);
    const parts: FlashcardPart[] = [];
    const detectedTypes: FlashcardDetectedType[] = [];

    blocks.forEach((block) => {
      const parsed = parseCardLines(block);
      if (!parsed) {
        return;
      }
      parts.push(parsed.part);
      parsed.detectedTypes.forEach((detected) => {
        pushUnique(detectedTypes, detected);
      });
    });

    if (parts.length === 0) {
      continue;
    }

    const isMixed = detectedTypes.length >= 2;
    const primaryType = detectedTypes.length === 1 ? detectedTypes[0] : undefined;

    cards.push({
      kind: "composite",
      parts,
      primaryType,
      detectedTypes,
      isMixed,
    });
  }

  return cards;
};
