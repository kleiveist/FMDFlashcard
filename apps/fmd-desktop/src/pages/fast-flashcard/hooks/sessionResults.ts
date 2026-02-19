import type { FastFlashcardResult } from "../../../../lib/fastFlashcard";

export type SessionResultResolver = (
  index: number,
) => FastFlashcardResult | null;

export const processSessionResults = (
  indices: number[],
  counted: Set<number>,
  resolve: SessionResultResolver,
  register: (index: number, result: FastFlashcardResult) => void,
) => {
  indices.forEach((index) => {
    if (counted.has(index)) {
      return;
    }
    const result = resolve(index);
    if (!result) {
      return;
    }
    register(index, result);
    counted.add(index);
  });
};
