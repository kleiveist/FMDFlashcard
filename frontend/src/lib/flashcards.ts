/**
 * @file apps/fmd-desktop/src/lib/flashcards.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Flashcards.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Flashcards bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcardKeywords.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/components/flashcards/ClozeCard.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

import { answerMarkers, falseTokens, trueTokens } from "./flashcardKeywords";
import { maskDatabaseBlockLines } from "./databaseBlockSyntax";
import { maskCanvasBlockLines } from "../features/canvas/markdownBlockSyntax";
import { findTableLineIndices } from "./markdownTables";
import {
  extractAuxiliaryBlocksFromLines,
} from "./auxiliaryBlocks";
import { extractMediaFromLines, type MediaItem } from "./cardMedia";

export {
  extractHelpBlocksFromLines,
  type HelpBlockExtraction,
} from "./auxiliaryBlocks";

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
 * Body text with input blanks like %answer% and drag tokens like "token"
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
  context?: string;
  options: FlashcardOption[];
  correctKeys: string[];
  media?: MediaItem[];
};

export type FreeTextCard = {
  kind: "free-text";
  front: string;
  back: string;
  media?: MediaItem[];
};

export type TrueFalseItem = {
  id: string;
  question: string;
  correct: "wahr" | "falsch";
};

export type TrueFalseCard = {
  kind: "true-false";
  items: TrueFalseItem[];
  context?: string;
  media?: MediaItem[];
};

export type ClozeSegment =
  | { type: "text"; value: string }
  | {
      type: "blank";
      id: string;
      kind: "input";
      solution: string;
      acceptedSolutions?: string[];
    }
  | { type: "blank"; id: string; kind: "drag"; solution: string };

export type ClozeDragToken = {
  id: string;
  value: string;
};

export type ClozeSubtype = "cl" | "cd" | "cld";

export type ClozeCard = {
  kind: "cloze";
  subtype: ClozeSubtype;
  question: string;
  segments: ClozeSegment[];
  dragTokens: ClozeDragToken[];
  media?: MediaItem[];
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
  helpText?: string[];
};

export type Flashcard = (FlashcardPart | CompositeFlashcard) & FlashcardMetadata;

export type FlashcardSourceRange = {
  startLine: number;
  endLine: number;
};

export type ParsedFlashcardEntry = {
  card: Flashcard;
  sourceRange: FlashcardSourceRange;
};

export type AnswerMatchMode = "anywhere" | "line-start";

export type SplitAnswerCardOptions = {
  answerMatch?: AnswerMatchMode;
};

export type ParseFlashcardsOptions = {
  answerMatch?: AnswerMatchMode;
};

export const normalizeInputAnswer = (value: string) => value.trim().toLowerCase();

export const isInputAnswerMatch = (
  input: string,
  solution: string,
  acceptedSolutions?: string[],
) => {
  const normalizedInput = normalizeInputAnswer(input);
  if (normalizedInput === normalizeInputAnswer(solution)) {
    return true;
  }
  if (!acceptedSolutions || acceptedSolutions.length === 0) {
    return false;
  }
  return acceptedSolutions.some(
    (candidate) => normalizedInput === normalizeInputAnswer(candidate),
  );
};

export const normalizeDragAnswer = (value: string) => value.trim();

export const isDragAnswerMatch = (tokenValue: string, solution: string) =>
  normalizeDragAnswer(tokenValue) === normalizeDragAnswer(solution);

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const resolveAnswerMatch = (options?: { answerMatch?: AnswerMatchMode }) =>
  options?.answerMatch ?? "anywhere";

const optionPattern = /^([A-Za-z])\)\s*(.*)$/;
const markerPattern = /^-([A-Za-z])$/;
const assignmentPattern = /^(.+?)=>\s*(.+)$/;
const fenceLinePattern = /^\s*(```|~~~)/;
const separatorLinePattern = /^\s*---\s*$/;
const cardStartPattern = /^\s*#card\s*$/i;
const cardEndPattern = /^\s*#endcard\s*$/i;

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
  normalized: normalizeAnswerToken(marker.replace(/:\s*$/, "")),
}));
const normalizedAnswerMarkerSet = new Set(
  normalizedAnswerMarkers.map((marker) => marker.normalized),
);

const isWordChar = (value: string) => /[\p{L}\p{N}\p{M}]/u.test(value);
const isWhitespace = (value: string) => /\s/.test(value);

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

const buildFenceMap = (lines: string[]) => {
  const inFenceByLine: boolean[] = [];
  let inFence = false;
  let fenceToken = "";

  lines.forEach((line, index) => {
    const match = line.trimStart().match(fenceLinePattern);
    if (match) {
      inFenceByLine[index] = true;
      if (inFence && match[1] === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = match[1] ?? "";
      }
      return;
    }
    inFenceByLine[index] = inFence;
  });

  return inFenceByLine;
};

const isSeparatorLine = (line: string) => separatorLinePattern.test(line);
const isCardStartLine = (line: string) => cardStartPattern.test(line);
const isCardEndLine = (line: string) => cardEndPattern.test(line);

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
  const dragTokenPattern = /^\s*"(?:[^"\\]|\\.)*"\s*$/;
  const escapeToken = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const normalizedRight = dragTokenPattern.test(right)
    ? right
    : `"${escapeToken(right)}"`;
  return `${left} => ${normalizedRight}`;
};

type OptionHeaderMatch = {
  key: string;
  rest: string;
};

const parseOptionHeader = (line: string): OptionHeaderMatch | null => {
  const match = line.trim().match(optionPattern);
  if (!match) {
    return null;
  }
  return {
    key: match[1].toLowerCase(),
    rest: match[2] ?? "",
  };
};

const isOptionLine = (line: string) => Boolean(parseOptionHeader(line));
const isCorrectMarkerLine = (line: string) => markerPattern.test(line.trim());
const isTrueFalseMarkerLine = (line: string) =>
  normalizeTrueFalseMarker(line.trim()) !== null;
const isAnswerMarkerLine = (line: string, answerMatch: AnswerMatchMode) =>
  Boolean(findAnswerMarkerMatch(line, answerMatch));

type InlineCodeSegment = { type: "text" | "code"; value: string };

const findNextQuoteIndex = (line: string, startIndex: number) => {
  for (let index = startIndex; index < line.length; index += 1) {
    if (line[index] !== "\"") {
      continue;
    }
    let backslashCount = 0;
    let cursor = index - 1;
    while (cursor >= 0 && line[cursor] === "\\") {
      backslashCount += 1;
      cursor -= 1;
    }
    if (backslashCount % 2 === 0) {
      return index;
    }
  }
  return -1;
};

const parseQuotedToken = (line: string, quoteIndex: number) => {
  let value = "";
  let index = quoteIndex + 1;
  while (index < line.length) {
    const char = line[index];
    if (char === "\\") {
      const next = line[index + 1];
      if (next === "\\" || next === "\"") {
        value += next;
        index += 2;
        continue;
      }
      value += char;
      index += 1;
      continue;
    }
    if (char === "\"") {
      return { value, end: index };
    }
    value += char;
    index += 1;
  }
  return null;
};

const splitInlineCodeSegments = (line: string): InlineCodeSegment[] => {
  const segments: InlineCodeSegment[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    const tickIndex = line.indexOf("`", cursor);
    if (tickIndex === -1) {
      segments.push({ type: "text", value: line.slice(cursor) });
      break;
    }
    if (tickIndex > cursor) {
      segments.push({ type: "text", value: line.slice(cursor, tickIndex) });
    }
    let tickEnd = tickIndex;
    while (tickEnd < line.length && line[tickEnd] === "`") {
      tickEnd += 1;
    }
    const tickCount = tickEnd - tickIndex;
    const fence = "`".repeat(tickCount);
    const closingIndex = line.indexOf(fence, tickEnd);
    if (closingIndex === -1) {
      segments.push({ type: "code", value: line.slice(tickIndex) });
      break;
    }
    segments.push({
      type: "code",
      value: line.slice(tickIndex, closingIndex + tickCount),
    });
    cursor = closingIndex + tickCount;
  }

  return segments.filter((segment) => segment.value !== "");
};

export const stripInlineCodeFromLine = (line: string) =>
  splitInlineCodeSegments(line)
    .filter((segment) => segment.type === "text")
    .map((segment) => segment.value)
    .join("");

const hasPercentMarker = (line: string) => {
  let cursor = 0;
  while (cursor < line.length) {
    const start = line.indexOf("%", cursor);
    if (start === -1) {
      return false;
    }
    const end = line.indexOf("%", start + 1);
    if (end === -1) {
      return false;
    }
    return true;
  }
  return false;
};

const hasQuotedToken = (line: string) => {
  let cursor = 0;
  while (cursor < line.length) {
    const quoteIndex = findNextQuoteIndex(line, cursor);
    if (quoteIndex === -1) {
      return false;
    }
    const parsed = parseQuotedToken(line, quoteIndex);
    if (!parsed) {
      return false;
    }
    return true;
  }
  return false;
};

export const hasClozeMarker = (
  line: string,
  options?: { ignoreInlineCode?: boolean },
) => {
  const ignoreInlineCode = options?.ignoreInlineCode ?? true;
  const target = ignoreInlineCode ? stripInlineCodeFromLine(line) : line;
  return hasPercentMarker(target) || hasQuotedToken(target);
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
  const fencePattern = /^(```|~~~)/;
  let inFence = false;
  let fenceToken = "";

  const findNextDragToken = (line: string, startIndex: number) => {
    const quoteIndex = findNextQuoteIndex(line, startIndex);
    if (quoteIndex === -1) {
      return null;
    }
    return { markerStart: quoteIndex, quoteIndex };
  };

  const handleTextSegment = (segmentText: string) => {
    let cursor = 0;

    while (cursor < segmentText.length) {
      const nextInput = segmentText.indexOf("%", cursor);
      const dragMatch = findNextDragToken(segmentText, cursor);
      const nextDrag = dragMatch ? dragMatch.markerStart : -1;
      const nextMarker = Math.min(
        nextInput === -1 ? Number.POSITIVE_INFINITY : nextInput,
        nextDrag === -1 ? Number.POSITIVE_INFINITY : nextDrag,
      );

      if (!Number.isFinite(nextMarker)) {
        appendText(segments, segmentText.slice(cursor));
        break;
      }

      if (nextMarker > cursor) {
        appendText(segments, segmentText.slice(cursor, nextMarker));
      }

      if (nextMarker === nextInput) {
        const end = segmentText.indexOf("%", nextInput + 1);
        if (end === -1) {
          appendText(segments, segmentText.slice(nextInput));
          break;
        }
        const rawPrimarySolution = segmentText.slice(nextInput + 1, end);
        const primarySolution = rawPrimarySolution.trim();
        if (!primarySolution) {
          return null;
        }
        let cursorAfterInput = end + 1;
        const acceptedSolutions: string[] = [];
        while (cursorAfterInput < segmentText.length && segmentText[cursorAfterInput] === "%") {
          const chainedEnd = segmentText.indexOf("%", cursorAfterInput + 1);
          if (chainedEnd === -1) {
            break;
          }
          const rawChainedSolution = segmentText.slice(cursorAfterInput + 1, chainedEnd);
          const chainedSolution = rawChainedSolution.trim();
          if (!chainedSolution) {
            return null;
          }
          acceptedSolutions.push(chainedSolution);
          cursorAfterInput = chainedEnd + 1;
        }
        segments.push({
          type: "blank",
          id: `blank-${blankIndex}`,
          kind: "input",
          solution: primarySolution,
          ...(acceptedSolutions.length > 0
            ? { acceptedSolutions }
            : {}),
        });
        blankIndex += 1;
        cursor = cursorAfterInput;
        continue;
      }

      if (!dragMatch) {
        appendText(segments, segmentText.slice(cursor));
        break;
      }
      const parsed = parseQuotedToken(segmentText, dragMatch.quoteIndex);
      if (!parsed) {
        appendText(segments, segmentText.slice(dragMatch.markerStart));
        break;
      }
      const value = parsed.value.trim();
      if (!value) {
        appendText(
          segments,
          segmentText.slice(dragMatch.markerStart, parsed.end + 1),
        );
        cursor = parsed.end + 1;
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
      cursor = parsed.end + 1;
    }

    return true;
  };

  const handleLine = (line: string, allowInlineCode: boolean) => {
    const parts = allowInlineCode
      ? splitInlineCodeSegments(line)
      : [{ type: "text", value: line }];

    for (const part of parts) {
      if (part.type === "code") {
        appendText(segments, part.value);
        continue;
      }
      const parsed = handleTextSegment(part.value);
      if (!parsed) {
        return null;
      }
    }

    return true;
  };

  const trimmedLines = trimEmptyLines(lines);
  for (let lineIndex = 0; lineIndex < trimmedLines.length; lineIndex += 1) {
    const line = trimmedLines[lineIndex];
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
      appendText(segments, line);
    } else {
      const parsed = handleLine(line, !inFence);
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

const resolveClozeSubtype = (hasInput: boolean, hasDrag: boolean): ClozeSubtype => {
  if (hasInput && hasDrag) {
    return "cld";
  }
  if (hasInput) {
    return "cl";
  }
  return "cd";
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
  let firstQuestionIndex: number | null = null;
  const fenceMap = buildFenceMap(lines);

  for (let index = 0; index < lines.length; index += 1) {
    if (fenceMap[index]) {
      continue;
    }
    const question = lines[index].trim();
    if (!question) {
      continue;
    }

    let markerIndex = index + 1;
    while (markerIndex < lines.length) {
      if (fenceMap[markerIndex]) {
        markerIndex += 1;
        continue;
      }
      if (lines[markerIndex].trim() === "") {
        markerIndex += 1;
        continue;
      }
      break;
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
    if (firstQuestionIndex === null) {
      firstQuestionIndex = index;
    }
    index = markerIndex;
  }

  return { items, firstQuestionIndex };
};

type AnswerMarkerMatch = {
  line: string;
  markerStartIndex: number;
  markerEndIndex: number;
};

const findAnswerMarkerAtColon = (
  line: string,
  colonIndex: number,
): AnswerMarkerMatch | null => {
  let prefixEnd = colonIndex;
  while (prefixEnd > 0 && isWhitespace(line[prefixEnd - 1] ?? "")) {
    prefixEnd -= 1;
  }
  if (prefixEnd <= 0) {
    return null;
  }

  let boldClosedBeforeColon = false;
  if (prefixEnd >= 2 && line.slice(prefixEnd - 2, prefixEnd) === "**") {
    boldClosedBeforeColon = true;
    prefixEnd -= 2;
    while (prefixEnd > 0 && isWhitespace(line[prefixEnd - 1] ?? "")) {
      prefixEnd -= 1;
    }
  }

  let wordEnd = prefixEnd;
  let wordStart = wordEnd;
  while (wordStart > 0 && isWordChar(line[wordStart - 1] ?? "")) {
    wordStart -= 1;
  }
  if (wordStart === wordEnd) {
    return null;
  }
  const word = line.slice(wordStart, wordEnd);
  if (!normalizedAnswerMarkerSet.has(normalizeAnswerToken(word))) {
    return null;
  }

  let markerStartIndex = wordStart;
  let hasBoldPrefix = false;
  if (wordStart >= 2 && line.slice(wordStart - 2, wordStart) === "**") {
    hasBoldPrefix = true;
    markerStartIndex = wordStart - 2;
  }

  const boundaryChar = line[markerStartIndex - 1];
  if (boundaryChar && isWordChar(boundaryChar)) {
    return null;
  }

  let markerEndIndex = colonIndex + 1;
  if (hasBoldPrefix && !boldClosedBeforeColon) {
    let suffixIndex = markerEndIndex;
    while (suffixIndex < line.length && isWhitespace(line[suffixIndex] ?? "")) {
      suffixIndex += 1;
    }
    if (line.slice(suffixIndex, suffixIndex + 2) === "**") {
      markerEndIndex = suffixIndex + 2;
    }
  }

  return { line, markerStartIndex, markerEndIndex };
};

const findAnswerMarkerMatch = (
  line: string,
  answerMatch: AnswerMatchMode = "anywhere",
) => {
  if (!line.trim()) {
    return null;
  }
  for (
    let colonIndex = line.indexOf(":");
    colonIndex !== -1;
    colonIndex = line.indexOf(":", colonIndex + 1)
  ) {
    const match = findAnswerMarkerAtColon(line, colonIndex);
    if (match) {
      if (
        answerMatch === "line-start" &&
        line.slice(0, match.markerStartIndex).trim() !== ""
      ) {
        continue;
      }
      return match;
    }
  }
  return null;
};

const findAnswerMarkerLine = (lines: string[], answerMatch: AnswerMatchMode) => {
  const fenceMap = buildFenceMap(lines);
  for (let index = 0; index < lines.length; index += 1) {
    if (fenceMap[index]) {
      continue;
    }
    const match = findAnswerMarkerMatch(lines[index] ?? "", answerMatch);
    if (match) {
      return { index, match };
    }
  }
  return null;
};

export const splitAnswerCard = (lines: string[], options?: SplitAnswerCardOptions) => {
  const answerMatch = resolveAnswerMatch(options);
  const markerInfo = findAnswerMarkerLine(lines, answerMatch);
  if (!markerInfo) {
    return null;
  }
  const markerLine = markerInfo.match.line;
  const inlineFront = markerLine.slice(0, markerInfo.match.markerStartIndex);
  const inlineBack = markerLine.slice(markerInfo.match.markerEndIndex).trimStart();

  const frontLines = [...lines.slice(0, markerInfo.index)];
  if (inlineFront.trim()) {
    frontLines.push(inlineFront.trimEnd());
  }

  const backLines = [inlineBack, ...lines.slice(markerInfo.index + 1)];
  const normalizedFront = trimEmptyLines(frontLines).join("\n").trim();
  const normalizedBack = trimEmptyLines(backLines).join("\n").trim();
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

export const splitCardLines = (lines: string[], answerMatch: AnswerMatchMode) => {
  const blocks: string[][] = [];
  let current: string[] = [];
  let state = createSplitState();
  const tableLineIndices = findTableLineIndices(lines);
  let inFence = false;
  let fenceToken = "";
  const fencePattern = /^\s*(```|~~~)/;

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

  const updateState = (line: string, inFenceState: boolean) => {
    const trimmed = line.trim();
    if (!state.hasQuestion && trimmed) {
      state.hasQuestion = true;
    }
    if (!inFenceState && isOptionLine(line)) {
      state.hasOption = true;
    }
    if (!inFenceState && isCorrectMarkerLine(line)) {
      state.hasCorrectMarker = true;
    }
    if (!inFenceState && isAnswerMarkerLine(line, answerMatch)) {
      state.hasAnswerMarker = true;
    }
    if (!inFenceState && isTrueFalseMarkerLine(line)) {
      state.hasTrueFalseMarker = true;
    }
    if (hasClozeMarker(line, { ignoreInlineCode: !inFenceState })) {
      state.hasClozeMarker = true;
    }
    if (!inFenceState && isAssignmentLine(line)) {
      state.hasAssignmentLine = true;
    }
  };

  const isComplete = () =>
    state.hasTrueFalseMarker ||
    (state.hasOption && state.hasCorrectMarker) ||
    state.hasAnswerMarker ||
    state.hasClozeMarker ||
    state.hasAssignmentLine;

  const findNextNonEmpty = (
    startIndex: number,
    fenceState: { inFence: boolean; fenceToken: string },
  ) => {
    let nextInFence = fenceState.inFence;
    let nextFenceToken = fenceState.fenceToken;
    for (let i = startIndex; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        continue;
      }
      const fenceMatch = lines[i].trimStart().match(fencePattern);
      if (fenceMatch) {
        if (nextInFence && fenceMatch[1] === nextFenceToken) {
          nextInFence = false;
          nextFenceToken = "";
        } else if (!nextInFence) {
          nextInFence = true;
          nextFenceToken = fenceMatch[1] ?? "";
        }
      }
      if (!nextInFence && isSeparatorLine(lines[i]) && !tableLineIndices.has(i)) {
        continue;
      }
      return trimmed;
    }
    return null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const fenceMatch = line.trimStart().match(fencePattern);
    if (fenceMatch) {
      if (inFence && fenceMatch[1] === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[1] ?? "";
      }
    }

    if (!inFence && isSeparatorLine(line) && !tableLineIndices.has(index)) {
      flush();
      continue;
    }

    const isOption = !inFence && isOptionLine(line);
    const isMarker = !inFence && isCorrectMarkerLine(line);

    if (
      current.length > 0 &&
      state.hasOption &&
      state.hasCorrectMarker &&
      trimmed &&
      !isOption &&
      !isMarker
    ) {
      flush();
    }

    current.push(line);
    updateState(line, inFence);

    if (!fenceMatch && !inFence) {
      const optionHeader = parseOptionHeader(line);
      if (optionHeader?.rest) {
        const inlineFenceMatch = optionHeader.rest.trimStart().match(fencePattern);
        if (inlineFenceMatch) {
          inFence = true;
          fenceToken = inlineFenceMatch[1] ?? "";
        }
      }
    }

    if (
      !inFence &&
      state.hasTrueFalseMarker &&
      state.hasQuestion &&
      isTrueFalseMarkerLine(line)
    ) {
      flush();
      continue;
    }

    if (!trimmed && isComplete() && !inFence) {
      const nextNonEmpty = findNextNonEmpty(index + 1, { inFence, fenceToken });
      if (nextNonEmpty) {
        flush();
      }
    }
  }

  flush();
  return blocks;
};

const findOptionStartIndex = (lines: string[]) => {
  let inFence = false;
  let fenceToken = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = line.trimStart().match(fenceLinePattern);
    if (fenceMatch) {
      if (inFence && fenceMatch[1] === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[1] ?? "";
      }
      continue;
    }
    if (!inFence && isOptionLine(line)) {
      return index;
    }
  }

  return -1;
};

const parseCardLines = (
  cardLines: string[],
  answerMatch: AnswerMatchMode,
): { part: FlashcardPart; detectedTypes: FlashcardDetectedType[] } | null => {
  const questionIndex = cardLines.findIndex((entry) => entry.trim() !== "");
  if (questionIndex === -1) {
    return null;
  }
  const questionLine = cardLines[questionIndex];
  const questionOption = parseOptionHeader(questionLine);
  const questionIsOption = Boolean(questionOption);
  const question = questionIsOption ? "" : questionLine.trim();
  const bodyLines = questionIsOption
    ? cardLines.slice(questionIndex)
    : cardLines.slice(questionIndex + 1);
  const contentLines = cardLines.slice(questionIndex);
  const tableLineIndices = findTableLineIndices(contentLines);

  const options: FlashcardOption[] = [];
  const correctKeys: string[] = [];
  const includeQuestionLine =
    !questionIsOption &&
    (hasClozeMarker(questionLine) || tableLineIndices.has(0));
  const clozeLines: string[] = includeQuestionLine ? [questionLine] : [];
  const nonOptionLines: string[] = questionIsOption ? [] : [questionLine];
  let hasAssignmentLines = false;
  const fencePattern = fenceLinePattern;
  let inFence = false;
  let fenceToken = "";
  let currentOption: { key: string; lines: string[] } | null = null;

  const toggleFence = (token: string) => {
    if (inFence && token === fenceToken) {
      inFence = false;
      fenceToken = "";
      return;
    }
    if (!inFence) {
      inFence = true;
      fenceToken = token;
    }
  };

  const flushOption = () => {
    if (!currentOption) {
      return;
    }
    const trimmedLines = trimEmptyLines(currentOption.lines);
    const text = trimmedLines.join("\n");
    if (text.trim()) {
      options.push({
        key: currentOption.key,
        text,
      });
    }
    currentOption = null;
  };

  bodyLines.forEach((rawLine) => {
    const trimmed = rawLine.trim();

    if (!inFence) {
      const optionHeader = parseOptionHeader(rawLine);
      if (optionHeader) {
        flushOption();
        currentOption = { key: optionHeader.key, lines: [] };
        if (optionHeader.rest) {
          currentOption.lines.push(optionHeader.rest);
          const inlineFenceMatch = optionHeader.rest
            .trimStart()
            .match(fencePattern);
          if (inlineFenceMatch) {
            toggleFence(inlineFenceMatch[1] ?? "");
          }
        }
        return;
      }

      const markerMatch = trimmed.match(markerPattern);
      if (markerMatch) {
        flushOption();
        pushUnique(correctKeys, markerMatch[1].toLowerCase());
        return;
      }
    }

    if (currentOption) {
      currentOption.lines.push(rawLine);
    } else {
      nonOptionLines.push(rawLine);
      if (!trimmed) {
        clozeLines.push("");
      } else {
        const assignmentLine = !inFence ? normalizeAssignmentLine(rawLine) : null;
        if (assignmentLine) {
          hasAssignmentLines = true;
          clozeLines.push(assignmentLine);
        } else {
          clozeLines.push(rawLine);
        }
      }
    }

    const fenceMatch = rawLine.trimStart().match(fencePattern);
    if (fenceMatch) {
      toggleFence(fenceMatch[1] ?? "");
    }
  });

  flushOption();

  const detectedTypes: FlashcardDetectedType[] = [];
  if (options.length > 0) {
    pushUnique(detectedTypes, "multiple-choice");
  }

  const scanLines = options.length > 0 ? nonOptionLines : contentLines;
  const { items: trueFalseItems, firstQuestionIndex } =
    parseTrueFalseItems(scanLines);
  if (trueFalseItems.length > 0) {
    pushUnique(detectedTypes, "true-false");
  }

  const answerCard = splitAnswerCard(scanLines, { answerMatch });
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
  const hasDragContent = hasDragBlanks || hasAssignmentLines;
  if (hasInputBlanks) {
    pushUnique(detectedTypes, "fill-blank");
  }
  if (hasDragContent) {
    pushUnique(detectedTypes, "assignment");
  }

  if (options.length > 0) {
    let context: string | undefined;
    const optionStartIndex = findOptionStartIndex(contentLines);
    if (optionStartIndex > 1) {
      const contextLines = trimEmptyLines(
        contentLines.slice(1, optionStartIndex),
      );
      if (contextLines.length > 0) {
        context = contextLines.join("\n");
      }
    }
    return {
      part: {
        kind: "multiple-choice",
        question,
        context,
        options,
        correctKeys,
      },
      detectedTypes,
    };
  }

  if (trueFalseItems.length > 0) {
    let context: string | undefined;
    if (firstQuestionIndex !== null) {
      const contextLines = trimEmptyLines(
        contentLines.slice(0, firstQuestionIndex),
      );
      if (contextLines.length > 0) {
        context = contextLines.join("\n");
      }
    }
    return {
      part: {
        kind: "true-false",
        items: trueFalseItems,
        context,
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
  if (hasInputBlanks || hasDragContent) {
    return {
      part: {
        kind: "cloze",
        subtype: resolveClozeSubtype(hasInputBlanks, hasDragContent),
        question,
        segments: parsed.segments,
        dragTokens: parsed.dragTokens,
      },
      detectedTypes,
    };
  }

  return null;
};

export const parseFlashcardEntries = (
  markdown: string,
  options?: ParseFlashcardsOptions,
): ParsedFlashcardEntry[] => {
  const answerMatch = resolveAnswerMatch(options);
  const lines = maskCanvasBlockLines(maskDatabaseBlockLines(normalizeLines(markdown)));
  const entries: ParsedFlashcardEntry[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!isCardStartLine(line)) {
      index += 1;
      continue;
    }
    const cardStartLine = index;

    const cardLines: string[] = [];
    let foundEnd = false;

    index += 1;

    while (index < lines.length) {
      const currentLine = lines[index];
      if (isCardEndLine(currentLine)) {
        foundEnd = true;
        index += 1;
        break;
      }
      cardLines.push(lines[index]);
      index += 1;
    }

    if (!foundEnd) {
      continue;
    }
    const cardEndLine = Math.max(cardStartLine, index - 1);

    const { helpText, contentLines } = extractAuxiliaryBlocksFromLines(cardLines);
    const blocks = splitCardLines(contentLines, answerMatch);
    const parts: FlashcardPart[] = [];
    const detectedTypes: FlashcardDetectedType[] = [];

    blocks.forEach((block) => {
      const extractedMedia = extractMediaFromLines(block, "flashcard-part-media");
      const parsed = parseCardLines(extractedMedia.contentLines, answerMatch);
      if (!parsed) {
        return;
      }
      const media = extractedMedia.items;
      parts.push(media.length > 0 ? { ...parsed.part, media } : parsed.part);
      parsed.detectedTypes.forEach((detected) => {
        pushUnique(detectedTypes, detected);
      });
    });

    if (parts.length === 0) {
      continue;
    }

    const isMixed = detectedTypes.length >= 2;
    const primaryType = detectedTypes.length === 1 ? detectedTypes[0] : undefined;

    entries.push({
      card: {
        kind: "composite",
        parts,
        primaryType,
        detectedTypes,
        isMixed,
        helpText: helpText.length > 0 ? helpText : undefined,
      },
      sourceRange: {
        startLine: cardStartLine,
        endLine: cardEndLine,
      },
    });
  }

  return entries;
};

export const parseFlashcards = (
  markdown: string,
  options?: ParseFlashcardsOptions,
): Flashcard[] =>
  parseFlashcardEntries(markdown, options).map((entry) => entry.card);
