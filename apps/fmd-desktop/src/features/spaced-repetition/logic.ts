import type { Flashcard } from "../../lib/flashcards";
import type { FlashcardResult, TrueFalseSelection } from "../flashcards/logic";

export const MAX_SPACED_REPETITION_BOX = 8;

export type SpacedRepetitionCardProgress = {
  boxCanonical: number;
  attempts: number;
  lastResult: FlashcardResult;
  lastReviewedAt: string | null;
};

type SpacedRepetitionCardProgressInput = Partial<SpacedRepetitionCardProgress> & {
  box?: number;
  boxCanonical?: number;
};

export type SpacedRepetitionSession = {
  flashcards: Flashcard[];
  cardIds: string[];
  selections: Record<number, string>;
  submissions: Record<number, boolean>;
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>;
  clozeResponses: Record<number, Record<string, string>>;
  page: number;
  cardProgressById: Record<string, SpacedRepetitionCardProgress>;
};

export type SpacedRepetitionUser = {
  id: string;
  name: string;
  createdAt: string;
};

export type SpacedRepetitionUserState = {
  cardStates: Record<string, SpacedRepetitionCardProgress>;
  lastLoadedAt: string | null;
};

export type SpacedRepetitionStorage = {
  users: SpacedRepetitionUser[];
  userStateById: Record<string, SpacedRepetitionUserState>;
  lastActiveUserId: string | null;
};

export const createSpacedRepetitionUserId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const getFlashcardIdentityPayload = (card: Flashcard) => {
  if (card.kind === "multiple-choice") {
    return {
      kind: card.kind,
      question: card.question,
      options: card.options,
      correctKeys: card.correctKeys,
    };
  }

  if (card.kind === "true-false") {
    return {
      kind: card.kind,
      items: card.items,
    };
  }

  return {
    kind: card.kind,
    question: card.question,
    segments: card.segments,
    dragTokens: card.dragTokens,
  };
};

export const getFlashcardId = (card: Flashcard) =>
  `card-${hashString(JSON.stringify(getFlashcardIdentityPayload(card)))}`;

export const createEmptySpacedRepetitionSession = (): SpacedRepetitionSession => ({
  flashcards: [],
  cardIds: [],
  selections: {},
  submissions: {},
  trueFalseSelections: {},
  clozeResponses: {},
  page: 0,
  cardProgressById: {},
});

export const createEmptySpacedRepetitionUserState = (): SpacedRepetitionUserState => ({
  cardStates: {},
  lastLoadedAt: null,
});

export const normalizeSpacedRepetitionCardProgress = (
  progress?: SpacedRepetitionCardProgressInput | null,
): SpacedRepetitionCardProgress => {
  const rawBoxCanonical =
    typeof progress?.boxCanonical === "number" && Number.isFinite(progress.boxCanonical)
      ? progress.boxCanonical
      : typeof progress?.box === "number" && Number.isFinite(progress.box)
        ? progress.box
        : 1;
  const clampedBoxCanonical = Math.min(
    MAX_SPACED_REPETITION_BOX,
    Math.max(1, rawBoxCanonical),
  );

  return {
    boxCanonical: clampedBoxCanonical,
    attempts:
      typeof progress?.attempts === "number" && Number.isFinite(progress.attempts)
        ? Math.max(0, progress.attempts)
        : 0,
    lastResult:
      progress?.lastResult === "correct" || progress?.lastResult === "incorrect"
        ? progress.lastResult
        : "neutral",
    lastReviewedAt:
      typeof progress?.lastReviewedAt === "string"
        ? progress.lastReviewedAt
        : null,
  };
};

export const getSpacedRepetitionEffectiveBox = (
  progress: SpacedRepetitionCardProgress,
  boxCount: number,
) => Math.min(progress.boxCanonical, boxCount);

export const buildSpacedRepetitionSession = (
  flashcards: Flashcard[],
  existingCardStates: Record<string, SpacedRepetitionCardProgress> = {},
): SpacedRepetitionSession => {
  const cardIds = flashcards.map(getFlashcardId);
  const nextCardStates = Object.fromEntries(
    Object.entries(existingCardStates).map(([cardId, progress]) => [
      cardId,
      normalizeSpacedRepetitionCardProgress(progress),
    ]),
  );

  cardIds.forEach((cardId) => {
    if (!nextCardStates[cardId]) {
      nextCardStates[cardId] = normalizeSpacedRepetitionCardProgress(null);
    }
  });

  return {
    ...createEmptySpacedRepetitionSession(),
    flashcards,
    cardIds,
    cardProgressById: nextCardStates,
  };
};
