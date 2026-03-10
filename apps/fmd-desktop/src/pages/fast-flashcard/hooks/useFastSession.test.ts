import { describe, expect, it, vi } from "vitest";
import type { FastFlashcardResult } from "../../../lib/fastFlashcard";
import { processSessionResults } from "./sessionResults";
import { resolveFastFlashcardDurationSeconds } from "./duration";

describe("processSessionResults", () => {
  it("only registers a submission once after a pending state", () => {
    const counted = new Set<number>();
    const register = vi.fn<(index: number, result: FastFlashcardResult) => void>();
    const attempts = new Map<number, number>();
    const resolve = (index: number): FastFlashcardResult | null => {
      const attempt = attempts.get(index) ?? 0;
      attempts.set(index, attempt + 1);
      if (attempt === 0) {
        return null;
      }
      return "correct";
    };

    processSessionResults([0], counted, resolve, register);
    expect(register).not.toHaveBeenCalled();
    expect(counted.has(0)).toBe(false);

    processSessionResults([0], counted, resolve, register);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(0, "correct");
    expect(counted.has(0)).toBe(true);

    processSessionResults([0], counted, resolve, register);
    expect(register).toHaveBeenCalledTimes(1);
  });
});

describe("resolveFastFlashcardDurationSeconds", () => {
  it("uses manual duration when auto mode is disabled", () => {
    const duration = resolveFastFlashcardDurationSeconds({
      card: {
        kind: "free-text",
        front: "Q",
        back: "A",
      },
      manualDuration: 24,
      autoTimeEnabled: false,
      examTaskTypeDefaultTimeSeconds: {
        qa: 6,
        tf: 2,
        m1: 3,
        m2: 5,
        cl: 4,
        cd: 5,
        cld: 8,
      },
    });
    expect(duration).toBe(24);
  });

  it("derives auto duration from repeated card type instances", () => {
    const duration = resolveFastFlashcardDurationSeconds({
      card: {
        kind: "composite",
        parts: [
          {
            kind: "free-text",
            front: "Q1",
            back: "A1",
          },
          {
            kind: "free-text",
            front: "Q2",
            back: "A2",
          },
          {
            kind: "true-false",
            items: [{ id: "s1", question: "A", correct: "wahr" }],
          },
        ],
      },
      manualDuration: 12,
      autoTimeEnabled: true,
      examTaskTypeDefaultTimeSeconds: {
        qa: 6,
        tf: 2,
        m1: 3,
        m2: 5,
        cl: 4,
        cd: 5,
        cld: 8,
      },
    });
    expect(duration).toBe(14);
  });
});
