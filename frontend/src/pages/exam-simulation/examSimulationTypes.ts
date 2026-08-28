import type { CompositePartState } from "../../features/flashcards/logic";
import type { ExamSessionTask } from "../../lib/examMixedSession";

export type ExamStage =
  | "idle"
  | "running"
  | "review"
  | "scoring_manual"
  | "finish_scoring"
  | "correction"
  | "finished";

export type ExamTaskResultDetail = {
  task: ExamSessionTask;
  partStates: CompositePartState[];
  awardedPoints: number | null;
  autoGradeDecision?: boolean;
};

export type ExamTaskBreakdown = {
  index: number;
  sessionTaskId: string;
  sourceTitle: string;
  originalTaskNumber: number;
  awardedPoints: number;
  maxPoints: number;
  isCorrect: boolean | null;
  detail: ExamTaskResultDetail;
};

export type ExamResults = {
  breakdown: ExamTaskBreakdown[];
  totalAwarded: number;
  totalMax: number;
  percentage: number;
};

export type ExamCorrectionEntry = {
  sessionTaskId: string;
  queueIndex: number;
  sourceTaskIndex: number;
};

export type ExamCorrectionState = {
  queue: ExamCorrectionEntry[];
  activeIndex: number;
  partStates: Record<string, CompositePartState[]>;
  submissions: Record<string, boolean>;
};

export type ExamManualTaskEntry = {
  task: ExamSessionTask;
  taskIndex: number;
  manualIndex: number;
  manualCount: number;
  maxPoints: number;
  partStates: CompositePartState[];
  awardedPoints: number | null;
};
