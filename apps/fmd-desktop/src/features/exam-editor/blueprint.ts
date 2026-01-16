/**
 * @file apps/fmd-desktop/src/features/exam-editor/blueprint.ts
 *
 * Zweck:
 * - Factory-Funktionen fuer Exam-Editor Blueprints.
 */

import type {
  CardBlueprint,
  CardType,
  ChoiceOption,
  ExamBlueprint,
  ExamTaskBlueprint,
} from "./types";

const buildId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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
        prompt: "",
        answer: "",
      };
    case "tf":
      return {
        id: buildId("card"),
        type,
        prompt: "",
        correct: null,
      };
    case "m1":
    case "m2":
      return {
        id: buildId("card"),
        type,
        prompt: "",
        options: [createChoiceOption(), createChoiceOption()],
      };
    case "cl":
    case "cd":
    case "cld":
      return {
        id: buildId("card"),
        type,
        prompt: "",
      };
    default: {
      const _exhaustive: never = type;
      return {
        id: buildId("card"),
        type: _exhaustive,
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
  };

  switch (card.type) {
    case "qa":
      return {
        ...base,
        type: "qa",
        prompt: card.prompt,
        answer: card.answer,
      };
    case "tf":
      return {
        ...base,
        type: "tf",
        prompt: card.prompt,
        correct: card.correct,
      };
    case "m1":
    case "m2":
      return {
        ...base,
        type: card.type,
        prompt: card.prompt,
        options: card.options.map(cloneChoiceOption),
      };
    case "cl":
    case "cd":
    case "cld":
      return {
        ...base,
        type: card.type,
        prompt: card.prompt,
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
  cards: task.cards.map(cloneCardBlueprint),
});
