/**
 * @file apps/fmd-desktop/src/lib/fastFlashcard.ts
 *
 * Zweck:
 * - Typen fuer Fast Flashcard Sessions und Storage.
 */

export type FastFlashcardResult = "correct" | "incorrect" | "timeout";

export type FastFlashcardSessionSummary = {
  id: string;
  endedAt: string;
  score: number;
  correct: number;
  incorrect: number;
  timeout?: number;
  total: number;
  accuracy: number;
  pace: number;
  durationMs: number;
};

export type FastFlashcardStorage = {
  sessions: FastFlashcardSessionSummary[];
};
