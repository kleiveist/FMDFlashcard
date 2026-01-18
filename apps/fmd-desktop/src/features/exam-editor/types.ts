/**
 * @file apps/fmd-desktop/src/features/exam-editor/types.ts
 *
 * Zweck:
 * - Definiert Exam-Editor Blueprint-Typen.
 */

export type CardType = "qa" | "tf" | "m1" | "m2" | "cl" | "cd" | "cld";

export type ChoiceOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type BaseCardBlueprint = {
  id: string;
  type: CardType;
  helpText?: string;
};

export type QaCardBlueprint = BaseCardBlueprint & {
  type: "qa";
  prompt: string;
  answer: string;
};

export type TfCardBlueprint = BaseCardBlueprint & {
  type: "tf";
  prompt: string;
  correct: "true" | "false" | null;
};

export type MultipleChoiceCardBlueprint = BaseCardBlueprint & {
  type: "m1" | "m2";
  prompt: string;
  options: ChoiceOption[];
};

export type ClozeCardBlueprint = BaseCardBlueprint & {
  type: "cl" | "cd" | "cld";
  prompt: string;
};

export type CardBlueprint =
  | QaCardBlueprint
  | TfCardBlueprint
  | MultipleChoiceCardBlueprint
  | ClozeCardBlueprint;

export type ExamTaskBlueprint = {
  id: string;
  order: number;
  title: string;
  helpText?: string;
  useCardWrapper: boolean;
  cards: CardBlueprint[];
};

export type ExamBlueprint = {
  id: string;
  title: string;
  description: string;
  tasks: ExamTaskBlueprint[];
};
