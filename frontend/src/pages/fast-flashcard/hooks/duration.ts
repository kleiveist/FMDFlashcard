import type { Flashcard } from "../../../lib/flashcards";
import type { AutoCardType } from "../../../lib/exam/autoCards";
import { resolveFlashcardAutoCardTypeInstances } from "../../../lib/exam/autoCards";
import { resolveAutoCardTypeValueSum } from "../../../lib/exam/pointsScoring";

export const resolveFastFlashcardDurationSeconds = ({
  card,
  manualDuration,
  autoTimeEnabled,
  examTaskTypeDefaultTimeSeconds,
}: {
  card: Flashcard | null;
  manualDuration: number;
  autoTimeEnabled: boolean;
  examTaskTypeDefaultTimeSeconds: Record<AutoCardType, number>;
}) => {
  if (!autoTimeEnabled || !card) {
    return Math.max(0, manualDuration);
  }
  const typeInstances = resolveFlashcardAutoCardTypeInstances(card);
  return resolveAutoCardTypeValueSum({
    taskTypes: typeInstances,
    typeValues: examTaskTypeDefaultTimeSeconds,
  });
};
