import { describe, expect, it } from "vitest";
import type { Flashcard } from "../../lib/flashcards";
import {
  buildActiveSpacedRepetitionCardIdSet,
  filterSpacedRepetitionCardStates,
  reconcileSpacedRepetitionUserStateById,
  type SpacedRepetitionCardProgress,
  type SpacedRepetitionUserState,
} from "./logic";

const baseProgress: SpacedRepetitionCardProgress = {
  boxCanonical: 1,
  attempts: 1,
  lastResult: "neutral",
  lastReviewedAt: null,
};

describe("spaced repetition helpers", () => {
  it("prunes ghost cards from stored card states", () => {
    const cardStates = {
      ghost: baseProgress,
      live: { ...baseProgress, attempts: 2 },
    };
    const filtered = filterSpacedRepetitionCardStates(
      cardStates,
      new Set(["live"]),
    );
    expect(Object.keys(filtered)).toEqual(["live"]);
    expect(filtered.live).toBe(cardStates.live);
  });

  it("reconciles every user state to the current card set", () => {
    const userState: SpacedRepetitionUserState = {
      cardStates: {
        ghost: baseProgress,
        live: { ...baseProgress, attempts: 3 },
      },
      completedPerDay: {},
      lastLoadedAt: null,
    };
    const reconciled = reconcileSpacedRepetitionUserStateById(
      { alice: userState },
      new Set(["live"]),
    );
    expect(Object.keys(reconciled.alice.cardStates)).toEqual(["live"]);
  });

  it("generates different IDs for the same card across vaults", () => {
    const card: Flashcard = {
      kind: "free-text",
      front: "Question",
      back: "Answer",
    };
    const setA = buildActiveSpacedRepetitionCardIdSet([card], {
      vaultId: "vault-a",
    });
    const setB = buildActiveSpacedRepetitionCardIdSet([card], {
      vaultId: "vault-b",
    });
    expect([...setA][0]).not.toBe([...setB][0]);
  });
});
