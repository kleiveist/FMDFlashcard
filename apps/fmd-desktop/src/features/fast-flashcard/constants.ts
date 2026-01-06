export const FAST_FLASHCARD_DURATIONS = [3, 6, 12, 24, 48] as const;

export type FastFlashcardDuration = (typeof FAST_FLASHCARD_DURATIONS)[number];
