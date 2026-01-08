/**
 * @file apps/fmd-desktop/src/features/flashcards/logic.test.ts
 *
 * Zweck:
 * - Testet logic.test und zugehoerige Logik.
 *
 * Verantwortlichkeiten:
 * - Prueft erwartetes Verhalten und Randfaelle.
 * - Sichert Regressionen fuer zentrale Szenarien.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcards.ts: Typen.
 * - apps/fmd-desktop/src/features/flashcards/logic.ts: Feature-Logik oder Hook.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import type { Flashcard } from "../../lib/flashcards";
import {
  calculateFlashcardStats,
  evaluateFlashcardResult,
  type CompositePartState,
} from "./logic";

const buildCompositeCard = (): Flashcard => ({
  kind: "composite",
  parts: [
    {
      kind: "multiple-choice",
      question: "Pick one",
      options: [
        { key: "a", text: "A" },
        { key: "b", text: "B" },
      ],
      correctKeys: ["a"],
    },
  ],
});

describe("evaluateFlashcardResult", () => {
  it("returns incorrect when a composite part is wrong", () => {
    const card = buildCompositeCard();
    const compositeStates: Record<number, CompositePartState[]> = {
      0: [{ selections: ["b"] }],
    };

    const result = evaluateFlashcardResult(
      card,
      0,
      {},
      {},
      {},
      {},
      compositeStates,
    );

    expect(result).toBe("incorrect");
  });
});

describe("calculateFlashcardStats", () => {
  it("counts composite submissions using the same result logic", () => {
    const card = buildCompositeCard();
    const compositeStates: Record<number, CompositePartState[]> = {
      0: [{ selections: ["b"] }],
    };

    const stats = calculateFlashcardStats(
      [card],
      { 0: true },
      {},
      {},
      {},
      {},
      compositeStates,
    );

    expect(stats).toEqual({
      correctCount: 0,
      incorrectCount: 1,
      correctPercent: 0,
    });
  });
});

describe("evaluateFlashcardResult pending QA handling", () => {
  const mixCard: Flashcard = {
    kind: "composite",
    parts: [
      {
        kind: "multiple-choice",
        question: "Pick one",
        options: [
          { key: "a", text: "A" },
          { key: "b", text: "B" },
        ],
        correctKeys: ["a"],
      },
      {
        kind: "free-text",
        front: "Free text?",
        back: "Answer",
      },
    ],
  };

  it("returns pending when QA parts are still unconfirmed", () => {
    const compositeStates: Record<number, CompositePartState[]> = {
      0: [{ selections: ["a"] }, {}],
    };

    const result = evaluateFlashcardResult(
      mixCard,
      0,
      {},
      {},
      {},
      {},
      compositeStates,
    );

    expect(result).toBe("pending");
  });

  it("counts correct only after QA confirmed", () => {
    const compositeStates: Record<number, CompositePartState[]> = {
      0: [{ selections: ["a"] }, { selfGrade: "correct" }],
    };

    const result = evaluateFlashcardResult(
      mixCard,
      0,
      {},
      {},
      {},
      {},
      compositeStates,
    );

    expect(result).toBe("correct");
  });

  it("still reports incorrect when an auto part is wrong even after QA confirmed", () => {
    const compositeStates: Record<number, CompositePartState[]> = {
      0: [{ selections: ["b"] }, { selfGrade: "correct" }],
    };

    const result = evaluateFlashcardResult(
      mixCard,
      0,
      {},
      {},
      {},
      {},
      compositeStates,
    );

    expect(result).toBe("incorrect");
  });
});
