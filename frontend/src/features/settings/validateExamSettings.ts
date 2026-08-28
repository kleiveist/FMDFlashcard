/**
 * @file frontend/src/features/settings/validateExamSettings.ts
 *
 * Zweck:
 * - Validiert Exam-Settings und liefert fehlende Anforderungen.
 */

import type { SettingsSnapshot } from "./useAppSettings";

export type MissingExamSetting = {
  id: string;
  label: string;
  description?: string;
  fieldSelector?: string;
  severity?: "blocker" | "warning";
};

export type ExamSettingsValidationInput = Pick<
  SettingsSnapshot,
  | "examMaxTotalPoints"
  | "examTaskCount"
  | "examTaskPoints"
  | "examDurationMinutes"
  | "examTimeLimitEnabled"
>;

export const validateExamSettings = (
  settings: ExamSettingsValidationInput,
): MissingExamSetting[] => {
  const missing: MissingExamSetting[] = [];
  const taskCount = Math.floor(settings.examTaskCount);
  const maxTotalPoints = Math.floor(settings.examMaxTotalPoints);
  const taskPoints = Array.isArray(settings.examTaskPoints)
    ? settings.examTaskPoints.slice(0, Math.max(0, taskCount))
    : [];
  const taskPointsSum = taskPoints.reduce((sum, value) => sum + value, 0);

  if (!Number.isFinite(taskCount) || taskCount < 1) {
    missing.push({
      id: "exam.task.count",
      label: "Anzahl Aufgaben fehlt",
      description: "Setze eine Zahl zwischen 1 und 20.",
      fieldSelector: "#exam-task-count",
      severity: "blocker",
    });
  } else if (taskCount > 20) {
    missing.push({
      id: "exam.task.count.max",
      label: "Anzahl Aufgaben ist zu hoch",
      description: "Maximal 20 Aufgaben erlaubt.",
      fieldSelector: "#exam-task-count",
      severity: "blocker",
    });
  }

  if (!Number.isFinite(maxTotalPoints) || maxTotalPoints <= 0) {
    missing.push({
      id: "exam.points.max",
      label: "Maximalpunktzahl fehlt",
      description: "Maximalpunkte muessen groesser als 0 sein.",
      fieldSelector: "#exam-max-total-points",
      severity: "blocker",
    });
  }

  if (
    Number.isFinite(taskCount) &&
    taskCount >= 1 &&
    Number.isFinite(maxTotalPoints) &&
    maxTotalPoints >= 0 &&
    taskPointsSum !== maxTotalPoints
  ) {
    missing.push({
      id: "exam.points.sum",
      label: "Task-Punkte passen nicht zur Maximalpunktzahl",
      description: "Summe der Task-Punkte muss der Maximalpunktzahl entsprechen.",
      fieldSelector: taskCount > 0 ? "#exam-task-point-1" : "#exam-task-points",
      severity: "blocker",
    });
  }

  if (settings.examTimeLimitEnabled && settings.examDurationMinutes <= 0) {
    missing.push({
      id: "exam.duration",
      label: "Time limit ist aktiv, aber keine Dauer gesetzt",
      description: "Lege eine Dauer in Minuten fest.",
      fieldSelector: "#exam-duration",
      severity: "blocker",
    });
  }

  return missing;
};
