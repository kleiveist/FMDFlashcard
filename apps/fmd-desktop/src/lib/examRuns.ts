/**
 * @file apps/fmd-desktop/src/lib/examRuns.ts
 *
 * Zweck:
 * - Typen und Hilfsfunktionen fuer Exam-Run Historien.
 */

import { invoke } from "@tauri-apps/api/core";
import {
  resetExamRunMarkdownHistory,
} from "../features/user-vault/storage";

export type ExamGradeScaleId = "standard-1-6";

export type ExamRunPointsProfileAssignment = {
  examPath: string;
  sourceTitle: string;
  requestedName: string | null;
  profileId: string | null;
  profileName: string | null;
  profileVersion: number | null;
  missing: boolean;
};

export type ExamRun = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  userId: string | null;
  userName: string;
  examFilePath: string;
  tasksDetected: number;
  maxPoints: number;
  achievedPoints: number;
  percent: number;
  passed: boolean;
  grade: string | null;
  correctedAchievedPoints?: number | null;
  correctedPercent?: number | null;
  correctedPassed?: boolean | null;
  correctedGrade?: string | null;
  statusValue?: string | number;
  filePath?: string;
  gradeScaleId: ExamGradeScaleId;
  pointsProfileId?: string | null;
  pointsProfileName?: string | null;
  pointsProfileVersion?: number | null;
  pointsProfileAssignments?: ExamRunPointsProfileAssignment[];
};

export type ExamRunStorage = {
  runs: ExamRun[];
};

type ExamRunHistoryResetListener = () => void;

const examRunHistoryResetListeners = new Set<ExamRunHistoryResetListener>();

export const subscribeExamRunHistoryReset = (
  listener: ExamRunHistoryResetListener,
) => {
  examRunHistoryResetListeners.add(listener);
  return () => {
    examRunHistoryResetListeners.delete(listener);
  };
};

export const resetExamRunHistory = async (profilePath?: string | null) => {
  try {
    if (profilePath) {
      await resetExamRunMarkdownHistory(profilePath);
    } else {
      const storage: ExamRunStorage = { runs: [] };
      await invoke("save_exam_run_data", { storage });
    }
    examRunHistoryResetListeners.forEach((listener) => listener());
    return true;
  } catch (error) {
    console.warn("Failed to reset exam run history", error);
    return false;
  }
};

export type ExamRunStatusFilter = "all" | "passed" | "failed";

export type ExamStatusTone =
  | "zero"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "diamond";

export type ExamStatusDescriptor = {
  value: number;
  emoji: string;
  token: string;
  tone: ExamStatusTone;
};

export type ExamRunFilters = {
  userId: string;
  status: ExamRunStatusFilter;
  query: string;
};

type ExamGradeScale = {
  id: ExamGradeScaleId;
  label: string;
  ranges: Array<{ minPercent: number; grade: string }>;
};

export const DEFAULT_EXAM_GRADE_SCALE: ExamGradeScaleId = "standard-1-6";

const EXAM_GRADE_SCALES: Record<ExamGradeScaleId, ExamGradeScale> = {
  "standard-1-6": {
    id: "standard-1-6",
    label: "Standard (1-6)",
    ranges: [
      { minPercent: 90, grade: "1" },
      { minPercent: 80, grade: "2" },
      { minPercent: 70, grade: "3" },
      { minPercent: 60, grade: "4" },
      { minPercent: 50, grade: "5" },
      { minPercent: 0, grade: "6" },
    ],
  },
};

export const buildExamRunId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `exam-run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const calculateExamPercent = (achievedPoints: number, maxPoints: number) =>
  maxPoints > 0 ? Math.round((achievedPoints / maxPoints) * 100) : 0;

export const isExamPassed = (percent: number) => percent >= 50;

export const resolveExamStatusDescriptor = (percent: number): ExamStatusDescriptor => {
  const normalized = Math.max(0, Math.min(100, Math.round(percent)));
  if (normalized === 100) {
    return { value: 1, emoji: "💎", token: "1 💎", tone: "diamond" };
  }
  if (normalized >= 91) {
    return { value: 1, emoji: "🔵", token: "1 🔵", tone: "blue" };
  }
  if (normalized >= 82) {
    return { value: 2, emoji: "🟢", token: "2 🟢", tone: "green" };
  }
  if (normalized >= 76) {
    return { value: 3, emoji: "🟡", token: "3 🟡", tone: "yellow" };
  }
  if (normalized >= 51) {
    return { value: 4, emoji: "🟠", token: "4 🟠", tone: "orange" };
  }
  if (normalized >= 1) {
    return { value: 5, emoji: "🔴", token: "5 🔴", tone: "red" };
  }
  return { value: 0, emoji: "⚪", token: "0 ⚪", tone: "zero" };
};

export const resolveExamGradeScale = (scaleId?: ExamGradeScaleId) =>
  EXAM_GRADE_SCALES[scaleId ?? DEFAULT_EXAM_GRADE_SCALE] ??
  EXAM_GRADE_SCALES[DEFAULT_EXAM_GRADE_SCALE];

export const resolveExamGrade = (scaleId: ExamGradeScaleId, percent: number) => {
  const scale = resolveExamGradeScale(scaleId);
  const normalized = Math.max(0, Math.min(100, percent));
  const match = scale.ranges.find((range) => normalized >= range.minPercent);
  return match ? match.grade : null;
};

export const formatExamGradeScale = (scaleId: ExamGradeScaleId) => {
  const scale = resolveExamGradeScale(scaleId);
  const ranges = scale.ranges
    .map((range, index) => {
      const next = scale.ranges[index - 1];
      const max = next ? next.minPercent - 1 : 100;
      return `${range.grade}: ${range.minPercent}-${max}%`;
    })
    .join(", ");
  return `${scale.label} (${ranges})`;
};

export const formatExamDuration = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "0:00";
  }
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getTimestampValue = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const formatExamTimestamp = (value: string) => {
  const timestamp = getTimestampValue(value);
  if (!timestamp) {
    return value;
  }
  return new Date(timestamp).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getExamRunUserKey = (run: ExamRun) =>
  run.userId || run.userName || "";

export const getExamFileName = (path: string) => {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
};

export const sortExamRunsByDateDesc = (runs: ExamRun[]) =>
  [...runs].sort(
    (a, b) => getTimestampValue(b.endedAt) - getTimestampValue(a.endedAt),
  );

export const filterExamRuns = (runs: ExamRun[], filters: ExamRunFilters) => {
  const query = filters.query.trim().toLowerCase();
  const filtered = runs.filter((run) => {
    if (filters.userId && getExamRunUserKey(run) !== filters.userId) {
      return false;
    }
    if (filters.status === "passed" && !run.passed) {
      return false;
    }
    if (filters.status === "failed" && run.passed) {
      return false;
    }
    if (query && !run.examFilePath.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
  return sortExamRunsByDateDesc(filtered);
};
