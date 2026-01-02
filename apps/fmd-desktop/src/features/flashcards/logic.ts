import type { DragEvent } from "react";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  type ClozeSegment,
  type Flashcard,
} from "../../lib/flashcards";

export type TrueFalseSelection = "wahr" | "falsch";
export type FlashcardResult = "correct" | "incorrect" | "neutral";

export type FlashcardStats = {
  correctCount: number;
  incorrectCount: number;
  correctPercent: number;
};

export type ClozeDragPayload = {
  cardIndex: number;
  tokenId: string;
};

type ClozeBlankSegment = Extract<ClozeSegment, { type: "blank" }>;

export const CLOZE_TOKEN_DRAG_TYPE = "application/x-cloze-token";

export const setClozeDragPayload = (
  event: DragEvent<HTMLElement>,
  payload: ClozeDragPayload,
) => {
  event.dataTransfer.setData(CLOZE_TOKEN_DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
};

export const getClozeDragPayload = (event: DragEvent<HTMLElement>) => {
  const raw = event.dataTransfer.getData(CLOZE_TOKEN_DRAG_TYPE);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ClozeDragPayload;
    if (typeof parsed.cardIndex !== "number" || typeof parsed.tokenId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const handleClozeTokenDragStart = (
  event: DragEvent<HTMLElement>,
  payload: ClozeDragPayload,
) => {
  event.dataTransfer.clearData();
  setClozeDragPayload(event, payload);
};

export const handleClozeBlankDragOver = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

export const shuffleFlashcards = (cards: Flashcard[]) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const getClozeBlanks = (segments: ClozeSegment[]) =>
  segments.filter((segment): segment is ClozeBlankSegment => segment.type === "blank");

const isClozeBlankFilled = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return value.trim().length > 0;
  }
  return tokenById.has(value);
};

const isClozeBlankCorrect = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return isInputAnswerMatch(value, blank.solution);
  }
  return isDragAnswerMatch(tokenById.get(value) ?? "", blank.solution);
};

export const areClozeBlanksComplete = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankFilled(blank, responses, tokenById));
};

export const isClozeCardCorrect = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankCorrect(blank, responses, tokenById));
};

export const areTrueFalseItemsComplete = (
  card: Extract<Flashcard, { kind: "true-false" }>,
  selections: Record<string, TrueFalseSelection>,
) => {
  if (card.items.length === 0) {
    return false;
  }
  return card.items.every((item) => Boolean(selections[item.id]));
};

export const isTrueFalseCardCorrect = (
  card: Extract<Flashcard, { kind: "true-false" }>,
  selections: Record<string, TrueFalseSelection>,
) => {
  if (card.items.length === 0) {
    return false;
  }
  return card.items.every((item) => selections[item.id] === item.correct);
};

export const evaluateFlashcardResult = (
  card: Flashcard,
  cardIndex: number,
  selections: Record<number, string>,
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>,
  clozeResponses: Record<number, Record<string, string>>,
): FlashcardResult => {
  if (card.kind === "multiple-choice") {
    if (card.correctKeys.length === 0) {
      return "neutral";
    }
    const selected = selections[cardIndex];
    return selected && card.correctKeys.includes(selected) ? "correct" : "incorrect";
  }

  if (card.kind === "true-false") {
    if (card.items.length === 0) {
      return "neutral";
    }
    const selectionsForCard = trueFalseSelections[cardIndex] ?? {};
    return isTrueFalseCardCorrect(card, selectionsForCard) ? "correct" : "incorrect";
  }

  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return "neutral";
  }
  const responses = clozeResponses[cardIndex] ?? {};
  return isClozeCardCorrect(card, responses) ? "correct" : "incorrect";
};

export const calculateFlashcardStats = (
  flashcards: Flashcard[],
  submissions: Record<number, boolean>,
  selections: Record<number, string>,
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>,
  clozeResponses: Record<number, Record<string, string>>,
): FlashcardStats => {
  let correct = 0;
  let incorrect = 0;

  flashcards.forEach((card, index) => {
    if (!submissions[index]) {
      return;
    }
    const result = evaluateFlashcardResult(
      card,
      index,
      selections,
      trueFalseSelections,
      clozeResponses,
    );
    if (result === "correct") {
      correct += 1;
    } else if (result === "incorrect") {
      incorrect += 1;
    }
  });

  const total = correct + incorrect;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correctCount: correct, incorrectCount: incorrect, correctPercent: percent };
};
