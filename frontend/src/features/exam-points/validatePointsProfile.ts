/**
 * @file frontend/src/features/exam-points/validatePointsProfile.ts
 *
 * Zweck:
 * - Validiert ein Points-Profil fuer die Exam-Simulation.
 */

import type { MissingExamSetting } from "../settings/validateExamSettings";
import type { ExamPointsProfile } from "../../lib/exam/pointsProfiles";

const clampInteger = (value: number) =>
  Number.isFinite(value) ? Math.floor(value) : 0;

export const validatePointsProfile = (
  profile: ExamPointsProfile | null,
): MissingExamSetting[] => {
  if (!profile) {
    return [
      {
        id: "exam.points.profile.missing",
        label: "Points-Profil fehlt",
        description: "Waehle im Exam Editor ein gueltiges Points-Profil (Task).",
        severity: "blocker",
      },
    ];
  }
  if (profile.distribution === "task-type") {
    const hasAnyPositiveRule = Object.values(profile.typeRules).some(
      (rule) => clampInteger(rule.points) > 0,
    );
    if (!hasAnyPositiveRule) {
      return [
        {
          id: "exam.points.rules.empty",
          label: "Points-Profil hat keine aktiven Typ-Regeln",
          description: "Lege im Points-Tab mindestens einen positiven Punktewert fest.",
          severity: "blocker",
        },
      ];
    }
    return [];
  }
  const taskCount = clampInteger(profile.taskCount);
  const maxTotal = clampInteger(profile.maxTotalPoints);
  const taskPoints = profile.taskPoints.slice(0, Math.max(0, taskCount));
  const assignedSum = taskPoints.reduce((sum, points) => sum + clampInteger(points), 0);
  const missing: MissingExamSetting[] = [];
  if (taskCount < 1) {
    missing.push({
      id: "exam.points.task.count",
      label: "Anzahl Aufgaben fehlt",
      description: "Setze im Points-Profil eine Zahl zwischen 1 und 20.",
      severity: "blocker",
    });
  }
  if (maxTotal <= 0) {
    missing.push({
      id: "exam.points.max",
      label: "Maximalpunktzahl fehlt",
      description: "Maximalpunkte muessen groesser als 0 sein.",
      severity: "blocker",
    });
  }
  if (taskCount > 0 && maxTotal > 0 && assignedSum !== maxTotal) {
    missing.push({
      id: "exam.points.sum",
      label: "Task-Punkte passen nicht zur Maximalpunktzahl",
      description: "Summe der Task-Punkte muss der Maximalpunktzahl entsprechen.",
      severity: "blocker",
    });
  }
  return missing;
};
