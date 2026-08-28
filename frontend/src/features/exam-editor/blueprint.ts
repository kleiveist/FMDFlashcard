/**
 * @file apps/fmd-desktop/src/features/exam-editor/blueprint.ts
 *
 * Zweck:
 * - Factory-Funktionen fuer Exam-Editor Blueprints.
 */

import { cloneEditorMediaDraft } from "../../lib/cardMedia";
import type {
  CardBlueprint,
  CardType,
  ChoiceOption,
  ExamBlueprint,
  ExamTaskBlueprint,
} from "./types";

export const createBlueprintId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildId = createBlueprintId;

export const createExamBlueprint = (): ExamBlueprint => ({
  id: buildId("exam"),
  title: "",
  description: "",
  tasks: [],
});

export const createChoiceOption = (text = ""): ChoiceOption => ({
  id: buildId("option"),
  text,
  isCorrect: false,
});

export const createCardBlueprint = (type: CardType): CardBlueprint => {
  switch (type) {
    case "qa":
      return {
        id: buildId("card"),
        type,
        mediaItems: [],
        prompt: "",
        answer: "",
      };
    case "tf":
      return {
        id: buildId("card"),
        type,
        mediaItems: [],
        prompt: "",
        correct: null,
      };
    case "m1":
    case "m2":
      return {
        id: buildId("card"),
        type,
        mediaItems: [],
        prompt: "",
        options: [createChoiceOption(), createChoiceOption()],
      };
    case "cl":
    case "cd":
    case "cld":
      return {
        id: buildId("card"),
        type,
        mediaItems: [],
        prompt: "",
      };
    default: {
      const _exhaustive: never = type;
      return {
        id: buildId("card"),
        type: _exhaustive,
        mediaItems: [],
        prompt: "",
        answer: "",
      };
    }
  }
};

export const createTaskBlueprint = (
  order: number,
  cardType: CardType,
): ExamTaskBlueprint => ({
  id: buildId("task"),
  order,
  title: "",
  mediaItems: [],
  useCardWrapper: false,
  cards: [createCardBlueprint(cardType)],
});

const cloneChoiceOption = (option: ChoiceOption): ChoiceOption => ({
  id: buildId("option"),
  text: option.text,
  isCorrect: option.isCorrect,
});

export const cloneCardBlueprint = (card: CardBlueprint): CardBlueprint => {
  const base = {
    id: buildId("card"),
    type: card.type,
    helpText: card.helpText,
    mediaItems: (card.mediaItems ?? []).map(cloneEditorMediaDraft),
  };

  switch (card.type) {
    case "qa":
      return {
        ...base,
        type: "qa",
        prompt: card.prompt,
        answer: card.answer,
        rawBody: card.rawBody,
      };
    case "tf":
      return {
        ...base,
        type: "tf",
        prompt: card.prompt,
        correct: card.correct,
        rawBody: card.rawBody,
      };
    case "m1":
    case "m2":
      return {
        ...base,
        type: card.type,
        prompt: card.prompt,
        options: card.options.map(cloneChoiceOption),
        rawBody: card.rawBody,
      };
    case "cl":
    case "cd":
    case "cld":
      return {
        ...base,
        type: card.type,
        prompt: card.prompt,
        rawBody: card.rawBody,
      };
    default: {
      const _exhaustive: never = card;
      return {
        ...base,
        type: _exhaustive,
        prompt: "",
      };
    }
  }
};

export const cloneTaskBlueprint = (task: ExamTaskBlueprint): ExamTaskBlueprint => ({
  id: buildId("task"),
  order: task.order,
  title: task.title,
  helpText: task.helpText,
  mediaItems: (task.mediaItems ?? []).map(cloneEditorMediaDraft),
  useCardWrapper: task.useCardWrapper,
  cards: task.cards.map(cloneCardBlueprint),
  sourceMeta: task.sourceMeta
    ? {
        sourceTaskIndex: task.sourceMeta.sourceTaskIndex,
        sourceRange: {
          startLine: task.sourceMeta.sourceRange.startLine,
          endLine: task.sourceMeta.sourceRange.endLine,
        },
        sourceChunk: task.sourceMeta.sourceChunk,
        sourceFingerprint: task.sourceMeta.sourceFingerprint,
      }
    : undefined,
});

const reorderByIndex = <T>(items: T[], sourceIndex: number, targetIndex: number) => {
  if (sourceIndex === targetIndex) {
    return items;
  }
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex >= items.length
  ) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

export const reorderTasksByIndex = (
  tasks: ExamTaskBlueprint[],
  sourceIndex: number,
  targetIndex: number,
) => {
  if (
    sourceIndex === targetIndex ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= tasks.length ||
    targetIndex >= tasks.length
  ) {
    return tasks;
  }
  const ordered = tasks.slice().sort((a, b) => a.order - b.order);
  return reorderByIndex(ordered, sourceIndex, targetIndex);
};

export const reorderCardsByIndex = (
  cards: CardBlueprint[],
  sourceIndex: number,
  targetIndex: number,
) => reorderByIndex(cards, sourceIndex, targetIndex);
