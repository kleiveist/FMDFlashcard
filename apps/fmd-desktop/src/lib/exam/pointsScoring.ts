/**
 * @file apps/fmd-desktop/src/lib/exam/pointsScoring.ts
 *
 * Zweck:
 * - Gemeinsame Hilfsfunktionen fuer Punkteprofile im Exam-Scoring.
 */

import type { ExamTask } from "../exam";
import { resolveExamTaskAutoCardTypes, type AutoCardType } from "./autoCards";
import type { ExamPointsProfile } from "./pointsProfiles";

const TASK_TYPE_PRIORITY: AutoCardType[] = [
  "qa",
  "tf",
  "m1",
  "m2",
  "cl",
  "cd",
  "cld",
];

const clampNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const resolvePrimaryAutoCardType = (
  detectedTypes: AutoCardType[],
): AutoCardType => {
  const normalized = Array.from(new Set(detectedTypes));
  const prioritized = TASK_TYPE_PRIORITY.find((type) => normalized.includes(type));
  return prioritized ?? "qa";
};

export const resolveExamTaskPointType = (task: ExamTask): AutoCardType => {
  const detected = resolveExamTaskAutoCardTypes(task);
  return resolvePrimaryAutoCardType(detected);
};

export const resolveTaskMaxPointsFromProfile = ({
  profile,
  taskIndex,
  taskType,
}: {
  profile: ExamPointsProfile;
  taskIndex: number;
  taskType: AutoCardType;
}) => {
  if (profile.distribution === "task-type") {
    const rule = profile.typeRules[taskType];
    return clampNonNegative(rule?.points ?? 0);
  }
  const points = profile.taskPoints[taskIndex] ?? 0;
  return clampNonNegative(points);
};

export const resolveTaskOrderPointsFromProfile = (
  profile: ExamPointsProfile,
  taskCount: number,
) => {
  const count = Math.max(0, Math.floor(taskCount));
  if (profile.distribution === "task-type") {
    return Array.from({ length: count }, () => 0);
  }
  return profile.taskPoints.slice(0, count).map((points) => clampNonNegative(points));
};
