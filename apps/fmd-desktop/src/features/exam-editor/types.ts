/**
 * @file apps/fmd-desktop/src/features/exam-editor/types.ts
 *
 * Zweck:
 * - Definiert Exam-Editor Blueprint-Typen.
 */

import type { EditorMediaDraft } from "../../lib/cardMedia";

export type CardType = "qa" | "tf" | "m1" | "m2" | "cl" | "cd" | "cld";

export type ChoiceOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type ExamTaskSourceMeta = {
  sourceTaskIndex: number;
  sourceRange: {
    startLine: number;
    endLine: number;
  };
  sourceChunk: string;
  sourceFingerprint: string;
};

export type BaseCardBlueprint = {
  id: string;
  type: CardType;
  helpText?: string;
  mediaItems?: EditorMediaDraft[];
  rawBody?: string;
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
  QaCardBlueprint | TfCardBlueprint | MultipleChoiceCardBlueprint | ClozeCardBlueprint;

export type ExamTaskBlueprint = {
  id: string;
  order: number;
  title: string;
  helpText?: string;
  mediaItems?: EditorMediaDraft[];
  useCardWrapper: boolean;
  cards: CardBlueprint[];
  sourceMeta?: ExamTaskSourceMeta;
};

export type ExamPassiveSegment = {
  slotIndex: number;
  text: string;
};

export type ExamBlueprint = {
  id: string;
  title: string;
  description: string;
  tasks: ExamTaskBlueprint[];
};
