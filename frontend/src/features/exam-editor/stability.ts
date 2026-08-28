/**
 * @file frontend/src/features/exam-editor/stability.ts
 *
 * Zweck:
 * - Stabile Fingerprints fuer Exam-Task-Inhalte.
 */

import type { CardBlueprint, ExamTaskBlueprint } from "./types";

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
};

const normalizeCardForFingerprint = (card: CardBlueprint) => {
  const base = {
    type: card.type,
    helpText: card.helpText?.trim() ?? "",
    prompt: "prompt" in card ? card.prompt : "",
    rawBody: card.rawBody?.trim() ?? "",
    mediaItems: (card.mediaItems ?? []).map((item) => ({
      type: item.type,
      src: item.src,
      inlineSvg: item.inlineSvg,
      label: item.label,
    })),
  };

  switch (card.type) {
    case "qa":
      return {
        ...base,
        answer: card.answer,
      };
    case "tf":
      return {
        ...base,
        correct: card.correct,
      };
    case "m1":
    case "m2":
      return {
        ...base,
        options: card.options.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      };
    case "cl":
    case "cd":
    case "cld":
      return base;
    default: {
      const exhaustive: never = card;
      return exhaustive;
    }
  }
};

export const buildTaskFingerprint = (task: ExamTaskBlueprint) => {
  const normalized = {
    title: task.title.trim(),
    helpText: task.helpText?.trim() ?? "",
    useCardWrapper: task.useCardWrapper,
    cards: task.cards.map(normalizeCardForFingerprint),
  };
  return `task-${hashString(JSON.stringify(normalized))}`;
};

