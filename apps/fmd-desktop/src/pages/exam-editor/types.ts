/**
 * @file apps/fmd-desktop/src/pages/exam-editor/types.ts
 */

export type ExamEditorSelection =
  | { type: "exam" }
  | { type: "task"; taskId: string }
  | { type: "card"; taskId: string; cardId: string };

export type ExamEditorMode = "structure" | "content";

export type ExamEditorControlsState = {
  mode: ExamEditorMode;
  canSave: boolean;
  isSaving: boolean;
  onModeChange: (mode: ExamEditorMode) => void;
  onNewExam: () => void;
  onSaveAs: () => void;
  onSave: () => void;
};
