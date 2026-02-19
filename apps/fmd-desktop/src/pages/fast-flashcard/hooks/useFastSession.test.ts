import { describe, expect, it, vi } from "vitest";
import type { FastFlashcardResult } from "../../../../lib/fastFlashcard";
import { processSessionResults } from "./sessionResults";

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
