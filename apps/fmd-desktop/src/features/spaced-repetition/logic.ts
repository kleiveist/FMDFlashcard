import type { Flashcard } from "../../lib/flashcards";
import type {
  FlashcardResult,
  FlashcardSelfGrade,
  TrueFalseSelection,
} from "../flashcards/logic";

export const MAX_SPACED_REPETITION_BOX = 8;
export type SpacedRepetitionRepetitionStrength = "weak" | "medium" | "strong";

// Index 0..7 maps to boxes 1..8 for weighted repetition order.
const REPETITION_WEIGHTS: Record<SpacedRepetitionRepetitionStrength, number[]> = {
  weak: [6, 5, 4, 3, 2, 2, 1, 1],
  medium: [8, 5, 3, 2, 1, 1, 1, 1],
  strong: [12, 6, 3, 2, 1, 1, 1, 1],
};

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
  textResponses: Record<number, string>;
  textRevealed: Record<number, boolean>;
  selfGrades: Record<number, FlashcardSelfGrade>;
  submissions: Record<number, boolean>;
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>;
  clozeResponses: Record<number, Record<string, string>>;
  page: number;
  cardProgressById: Record<string, SpacedRepetitionCardProgress>;
  completedPerDay: Record<string, number>;
};

export type SpacedRepetitionUser = {
  id: string;
  name: string;
  createdAt: string;
};

export type SpacedRepetitionUserState = {
  cardStates: Record<string, SpacedRepetitionCardProgress>;
  lastLoadedAt: string | null;
  completedPerDay: Record<string, number>;
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

  if (card.kind === "free-text") {
    return {
      kind: card.kind,
      front: card.front,
      back: card.back,
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
  textResponses: {},
  textRevealed: {},
  selfGrades: {},
  submissions: {},
  trueFalseSelections: {},
  clozeResponses: {},
  page: 0,
  cardProgressById: {},
  completedPerDay: {},
});

export const createEmptySpacedRepetitionUserState = (): SpacedRepetitionUserState => ({
  cardStates: {},
  lastLoadedAt: null,
  completedPerDay: {},
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

const shuffleEntries = <T>(entries: T[]) => {
  const copy = [...entries];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildWeightedOrder = <T extends { progress: SpacedRepetitionCardProgress }>(
  entries: T[],
  boxCount: number,
  strength: SpacedRepetitionRepetitionStrength,
) => {
  const weights = REPETITION_WEIGHTS[strength];
  const candidates = entries
    .map((entry) => {
      const effectiveBox = getSpacedRepetitionEffectiveBox(entry.progress, boxCount);
      return {
        entry,
        effectiveBox,
        weight: Math.max(1, weights[effectiveBox - 1] ?? 1),
      };
    })
    .filter((candidate) => candidate.effectiveBox < boxCount);

  const ordered: T[] = [];
  while (candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let threshold = Math.random() * totalWeight;
    const index = candidates.findIndex((candidate) => {
      threshold -= candidate.weight;
      return threshold <= 0;
    });
    const pickedIndex = index >= 0 ? index : candidates.length - 1;
    const [picked] = candidates.splice(pickedIndex, 1);
    ordered.push(picked.entry);
  }
  return ordered;
};

export const buildSpacedRepetitionSession = (
  flashcards: Flashcard[],
  existingCardStates: Record<string, SpacedRepetitionCardProgress> = {},
  options?: {
    order?: "in-order" | "random" | "repetition";
    boxCount?: number;
    repetitionStrength?: SpacedRepetitionRepetitionStrength;
  },
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

  const entries = flashcards.map((card, index) => ({
    card,
    cardId: cardIds[index],
    progress: nextCardStates[cardIds[index]],
  }));
  const order = options?.order ?? "in-order";
  const boxCount = options?.boxCount ?? MAX_SPACED_REPETITION_BOX;
  const orderedEntries =
    order === "random"
      ? shuffleEntries(entries)
      : order === "repetition"
        ? buildWeightedOrder(
            entries,
            boxCount,
            options?.repetitionStrength ?? "medium",
          )
        : entries;

  return {
    ...createEmptySpacedRepetitionSession(),
    flashcards: orderedEntries.map((entry) => entry.card),
    cardIds: orderedEntries.map((entry) => entry.cardId),
    cardProgressById: nextCardStates,
  };
};
