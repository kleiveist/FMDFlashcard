/**
 * @file frontend/src/lib/exam/pointsScoring.ts
 *
 * Zweck:
 * - Gemeinsame Hilfsfunktionen fuer Punkteprofile im Exam-Scoring.
 */

import type { ExamTask } from "../exam";
import { resolveExamTaskAutoCardTypeInstances, type AutoCardType } from "./autoCards";
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

export const normalizeTaskTypeList = (detectedTypes: AutoCardType[]) => {
  const unique = Array.from(new Set(detectedTypes));
  return TASK_TYPE_PRIORITY.filter((type) => unique.includes(type));
};

export const resolveExamTaskPointTypes = (task: ExamTask): AutoCardType[] => {
  // Keep one entry per detected card instance so scoring can sum repeated types.
  return resolveExamTaskAutoCardTypeInstances(task);
};

export const resolveTaskTypePointsFromMap = ({
  taskTypes,
  typePoints,
}: {
  taskTypes: AutoCardType[];
  typePoints: Record<AutoCardType, number>;
}) =>
  resolveAutoCardTypeValueSum({
    taskTypes,
    typeValues: typePoints,
  });

export const resolveAutoCardTypeValueSum = ({
  taskTypes,
  typeValues,
}: {
  taskTypes: AutoCardType[];
  typeValues: Record<AutoCardType, number>;
}) => {
  if (taskTypes.length === 0) {
    return 0;
  }
  const allowedTypes = new Set<AutoCardType>(TASK_TYPE_PRIORITY);
  return taskTypes.reduce((sum, type) => {
    if (!allowedTypes.has(type)) {
      return sum;
    }
    return sum + clampNonNegative(typeValues[type] ?? 0);
  }, 0);
};

export const resolveTaskMaxPointsFromProfile = ({
  profile,
  taskIndex,
  taskTypes,
}: {
  profile: ExamPointsProfile;
  taskIndex: number;
  taskTypes: AutoCardType[];
}) => {
  if (profile.distribution === "task-type") {
    return resolveTaskTypePointsFromMap({
      taskTypes,
      typePoints: TASK_TYPE_PRIORITY.reduce(
        (acc, type) => {
          acc[type] = clampNonNegative(profile.typeRules[type]?.points ?? 0);
          return acc;
        },
        {} as Record<AutoCardType, number>,
      ),
    });
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
