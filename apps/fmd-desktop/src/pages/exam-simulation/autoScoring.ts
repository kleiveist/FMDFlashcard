import {
  evaluateFlashcardPartResult,
  type CompositePartState,
} from "../../features/flashcards/logic";
import type { ExamTask } from "../../lib/exam";
import { type AutoCardType, resolveFlashcardPartAutoCardType } from "../../lib/exam/autoCards";
import type { ExamPointsProfile } from "../../lib/exam/pointsProfiles";

type AutoTaskTypePoints = Record<AutoCardType, number>;

type ResolveAutoTaskAwardedPointsInput = {
  task: ExamTask;
  partStates: CompositePartState[];
  maxPoints: number;
  overrideDecision?: boolean;
  pointsProfile: ExamPointsProfile | null;
  defaultTypePoints: Record<AutoCardType, number>;
};

const clampNonNegativeInt = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const clampAwardedPoints = (value: number, maxPoints: number) =>
  Math.min(clampNonNegativeInt(maxPoints), Math.max(0, Math.floor(value)));

const resolveAutoTaskTypePoints = (
  pointsProfile: ExamPointsProfile | null,
  defaultTypePoints: Record<AutoCardType, number>,
): AutoTaskTypePoints => {
  if (pointsProfile) {
    return {
      qa: clampNonNegativeInt(pointsProfile.typeRules.qa.points),
      tf: clampNonNegativeInt(pointsProfile.typeRules.tf.points),
      m1: clampNonNegativeInt(pointsProfile.typeRules.m1.points),
      m2: clampNonNegativeInt(pointsProfile.typeRules.m2.points),
      cl: clampNonNegativeInt(pointsProfile.typeRules.cl.points),
      cd: clampNonNegativeInt(pointsProfile.typeRules.cd.points),
      cld: clampNonNegativeInt(pointsProfile.typeRules.cld.points),
    };
  }

  return {
    qa: clampNonNegativeInt(defaultTypePoints.qa),
    tf: clampNonNegativeInt(defaultTypePoints.tf),
    m1: clampNonNegativeInt(defaultTypePoints.m1),
    m2: clampNonNegativeInt(defaultTypePoints.m2),
    cl: clampNonNegativeInt(defaultTypePoints.cl),
    cd: clampNonNegativeInt(defaultTypePoints.cd),
    cld: clampNonNegativeInt(defaultTypePoints.cld),
  };
};

const resolveTaskAutoRawPoints = (
  task: ExamTask,
  partStates: CompositePartState[],
  typePoints: AutoTaskTypePoints,
) => {
  return task.card.parts.reduce(
    (acc, part, partIndex) => {
      const type = resolveFlashcardPartAutoCardType(part);
      if (!type) {
        return acc;
      }

      const points = clampNonNegativeInt(typePoints[type]);
      const result = evaluateFlashcardPartResult(part, partStates[partIndex] ?? {});
      return {
        maxRaw: acc.maxRaw + points,
        awardedRaw: result === "correct" ? acc.awardedRaw + points : acc.awardedRaw,
      };
    },
    { awardedRaw: 0, maxRaw: 0 },
  );
};

export const resolveAutoTaskAwardedPoints = ({
  task,
  partStates,
  maxPoints,
  overrideDecision,
  pointsProfile,
  defaultTypePoints,
}: ResolveAutoTaskAwardedPointsInput) => {
  const normalizedMaxPoints = clampNonNegativeInt(maxPoints);
  if (typeof overrideDecision === "boolean") {
    return overrideDecision ? normalizedMaxPoints : 0;
  }

  const typePoints = resolveAutoTaskTypePoints(pointsProfile, defaultTypePoints);
  const { awardedRaw, maxRaw } = resolveTaskAutoRawPoints(task, partStates, typePoints);
  if (maxRaw <= 0 || normalizedMaxPoints <= 0) {
    return 0;
  }

  if (awardedRaw <= 0) {
    return 0;
  }
  if (awardedRaw >= maxRaw) {
    return normalizedMaxPoints;
  }

  // Keep task-order profiles partial by mapping raw part points onto task max points.
  const scaledAward = Math.round((awardedRaw / maxRaw) * normalizedMaxPoints);
  return clampAwardedPoints(scaledAward, normalizedMaxPoints);
};
