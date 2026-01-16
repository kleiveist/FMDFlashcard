/**
 * @file apps/fmd-desktop/src/pages/exam-editor/types.ts
 */

export type ExamEditorSelection =
  | { type: "exam" }
  | { type: "task"; taskId: string }
  | { type: "card"; taskId: string; cardId: string };
