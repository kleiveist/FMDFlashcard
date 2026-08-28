/**
 * @file apps/fmd-desktop/src/pages/exam-editor/types.ts
 */

import type { CardType } from "../../features/exam-editor/types";

export type ExamEditorSelection =
  | { type: "exam" }
  | { type: "task"; taskId: string }
  | { type: "card"; taskId: string; cardId: string };

export type ExamEditorMode = "structure" | "content";

export type ExamEditorControlsState = {
  mode: ExamEditorMode;
  canSave: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  savePath: string | null;
  saveState: "idle" | "saving" | "saved";
  validationSummary: {
    count: number;
    messages: string[];
  } | null;
  onModeChange: (mode: ExamEditorMode) => void;
  onNewExam: () => void;
  onSaveAs: () => void;
  onSave: () => void;
  onSaveAndWait: () => Promise<boolean>;
  onQuickAddCard: (type: CardType) => void;
};
