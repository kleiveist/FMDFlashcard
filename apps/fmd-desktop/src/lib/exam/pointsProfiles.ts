/**
 * @file apps/fmd-desktop/src/lib/exam/pointsProfiles.ts
 *
 * Zweck:
 * - Typen und Normalisierung fuer Exam Points-Profile.
 */

import { AUTO_CARD_TYPES, type AutoCardType } from "./autoCards";

export const EXAM_POINTS_PROFILE_SCHEMA_VERSION = 2;
export const EXAM_POINTS_FRONTMATTER_KEY = "Task";
export const EXAM_POINTS_DEFAULT_PROFILE_NAME = "Exam";
export const EXAM_POINTS_MAX_TASK_COUNT = 30;
export const EXAM_POINTS_DEFAULT_DURATION_MINUTES = 45;
export const EXAM_POINTS_MAX_DURATION_MINUTES = 240;

export type ExamPointsDistribution = "task-order" | "task-type";
export type ExamPointsRuleMode = "all-or-nothing" | "partial";

export type ExamPointsTypeRule = {
  points: number;
  mode: ExamPointsRuleMode;
  penalty: number;
};

export type ExamPointsTypeRuleMap = Record<AutoCardType, ExamPointsTypeRule>;

export type ExamPointsProfile = {
  id: string;
  name: string;
  distribution: ExamPointsDistribution;
  durationMinutes: number;
  maxTotalPoints: number;
  taskCount: number;
  taskPoints: number[];
  typeRules: ExamPointsTypeRuleMap;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ExamPointsProfilesStore = {
  schemaVersion: number;
  defaultProfileId: string | null;
  profiles: ExamPointsProfile[];
};

const parseInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const clampTaskCount = (value: unknown) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    return 1;
  }
  return Math.min(EXAM_POINTS_MAX_TASK_COUNT, Math.max(1, parsed));
};

const clampNonNegative = (value: unknown, fallback = 0) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    return fallback;
  }
  return Math.max(0, parsed);
};

const clampDurationMinutes = (value: unknown, fallback: number) => {
  const normalized = clampNonNegative(value, fallback);
  return Math.min(EXAM_POINTS_MAX_DURATION_MINUTES, normalized);
};

export const buildDefaultTaskPoints = (
  taskCount: number,
  maxTotalPoints: number,
) => {
  if (taskCount <= 0) {
    return [];
  }
  const even = Math.floor(maxTotalPoints / taskCount);
  const remainder = maxTotalPoints % taskCount;
  return Array.from({ length: taskCount }, (_, index) =>
    even + (index < remainder ? 1 : 0),
  );
};

export const normalizeTaskPoints = (
  value: unknown,
  taskCount: number,
  maxTotalPoints: number,
) => {
  const defaults = buildDefaultTaskPoints(taskCount, maxTotalPoints);
  const raw = Array.isArray(value) ? value : [];
  const normalized: number[] = [];
  for (let index = 0; index < EXAM_POINTS_MAX_TASK_COUNT; index += 1) {
    const candidate = raw[index];
    if (typeof candidate !== "undefined") {
      normalized.push(clampNonNegative(candidate, 0));
    } else {
      normalized.push(index < defaults.length ? defaults[index] : 0);
    }
  }
  return normalized;
};

export const createDefaultTypeRules = (defaultPoints = 1): ExamPointsTypeRuleMap =>
  AUTO_CARD_TYPES.reduce(
    (acc, type) => {
      acc[type] = {
        points: clampNonNegative(defaultPoints, 1),
        mode: "all-or-nothing",
        penalty: 0,
      };
      return acc;
    },
    {} as ExamPointsTypeRuleMap,
  );

export const normalizeTypeRules = (
  value: unknown,
  fallbackPoints = 1,
): ExamPointsTypeRuleMap => {
  const fallback = createDefaultTypeRules(fallbackPoints);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const candidate = value as Partial<Record<AutoCardType, Partial<ExamPointsTypeRule>>>;
  const next = { ...fallback };
  AUTO_CARD_TYPES.forEach((type) => {
    const rule = candidate[type];
    if (!rule || typeof rule !== "object") {
      return;
    }
    next[type] = {
      points: clampNonNegative(rule.points, fallback[type].points),
      mode: rule.mode === "partial" ? "partial" : "all-or-nothing",
      penalty: clampNonNegative(rule.penalty, 0),
    };
  });
  return next;
};

const buildFallbackProfileId = (index: number) => `points-profile-${index + 1}`;

const normalizeTimestamp = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

export const normalizeProfileNameKey = (value: string) =>
  value.trim().toLocaleLowerCase();

export const normalizeExamPointsProfile = (
  value: unknown,
  index = 0,
): ExamPointsProfile => {
  const now = new Date().toISOString();
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<ExamPointsProfile>)
      : {};
  const id =
    typeof candidate.id === "string" && candidate.id.trim()
      ? candidate.id.trim()
      : buildFallbackProfileId(index);
  const name =
    typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name.trim()
      : EXAM_POINTS_DEFAULT_PROFILE_NAME;
  const durationMinutes = clampDurationMinutes(
    candidate.durationMinutes,
    EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  );
  const maxTotalPoints = clampNonNegative(candidate.maxTotalPoints, 20);
  const taskCount = clampTaskCount(candidate.taskCount ?? 5);
  const distribution: ExamPointsDistribution =
    candidate.distribution === "task-type" ? "task-type" : "task-order";
  const taskPoints = normalizeTaskPoints(candidate.taskPoints, taskCount, maxTotalPoints);
  const fallbackTypePoints =
    taskCount > 0
      ? Math.max(1, Math.round(taskPoints.slice(0, taskCount).reduce((sum, points) => sum + points, 0) / taskCount))
      : 1;
  const typeRules = normalizeTypeRules(candidate.typeRules, fallbackTypePoints);
  const createdAt = normalizeTimestamp(candidate.createdAt, now);
  const updatedAt = normalizeTimestamp(candidate.updatedAt, createdAt);
  const version = Math.max(1, clampNonNegative(candidate.version, 1));
  return {
    id,
    name,
    distribution,
    durationMinutes,
    maxTotalPoints,
    taskCount,
    taskPoints,
    typeRules,
    createdAt,
    updatedAt,
    version,
  };
};

export const createEmptyExamPointsProfilesStore = (): ExamPointsProfilesStore => ({
  schemaVersion: EXAM_POINTS_PROFILE_SCHEMA_VERSION,
  defaultProfileId: null,
  profiles: [],
});

export const normalizeExamPointsProfilesStore = (
  value: unknown,
): ExamPointsProfilesStore => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyExamPointsProfilesStore();
  }
  const candidate = value as Partial<ExamPointsProfilesStore>;
  const rawProfiles = Array.isArray(candidate.profiles) ? candidate.profiles : [];
  const profiles = rawProfiles.map((profile, index) =>
    normalizeExamPointsProfile(profile, index),
  );
  const uniqueById = new Map<string, ExamPointsProfile>();
  profiles.forEach((profile) => {
    if (!uniqueById.has(profile.id)) {
      uniqueById.set(profile.id, profile);
    }
  });
  const dedupedProfiles = Array.from(uniqueById.values());
  const defaultProfileIdRaw =
    typeof candidate.defaultProfileId === "string" && candidate.defaultProfileId.trim()
      ? candidate.defaultProfileId
      : null;
  const defaultProfileId =
    defaultProfileIdRaw &&
    dedupedProfiles.some((profile) => profile.id === defaultProfileIdRaw)
      ? defaultProfileIdRaw
      : dedupedProfiles[0]?.id ?? null;
  return {
    schemaVersion: EXAM_POINTS_PROFILE_SCHEMA_VERSION,
    defaultProfileId,
    profiles: dedupedProfiles,
  };
};

export const buildExamPointsProfile = ({
  id,
  name,
  distribution = "task-type",
  durationMinutes = EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  taskCount = 5,
  maxTotalPoints = 20,
  taskPoints,
  typeRules,
  createdAt,
  updatedAt,
  version = 1,
}: {
  id: string;
  name: string;
  distribution?: ExamPointsDistribution;
  durationMinutes?: number;
  taskCount?: number;
  maxTotalPoints?: number;
  taskPoints?: number[];
  typeRules?: Partial<ExamPointsTypeRuleMap>;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}): ExamPointsProfile => {
  const now = new Date().toISOString();
  const normalizedTaskCount = clampTaskCount(taskCount);
  const normalizedDurationMinutes = clampDurationMinutes(
    durationMinutes,
    EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  );
  const normalizedMax = clampNonNegative(maxTotalPoints, 20);
  const normalizedTaskPoints = normalizeTaskPoints(
    taskPoints ?? [],
    normalizedTaskCount,
    normalizedMax,
  );
  const fallbackPoints =
    normalizedTaskCount > 0
      ? Math.max(
          1,
          Math.round(
            normalizedTaskPoints
              .slice(0, normalizedTaskCount)
              .reduce((sum, points) => sum + points, 0) / normalizedTaskCount,
          ),
        )
      : 1;
  const baseRules = createDefaultTypeRules(fallbackPoints);
  const mergedRules = normalizeTypeRules(
    typeRules ? ({ ...baseRules, ...typeRules } as ExamPointsTypeRuleMap) : baseRules,
    fallbackPoints,
  );
  return {
    id,
    name: name.trim() || EXAM_POINTS_DEFAULT_PROFILE_NAME,
    distribution,
    durationMinutes: normalizedDurationMinutes,
    taskCount: normalizedTaskCount,
    maxTotalPoints: normalizedMax,
    taskPoints: normalizedTaskPoints,
    typeRules: mergedRules,
    createdAt: createdAt?.trim() || now,
    updatedAt: updatedAt?.trim() || now,
    version: Math.max(1, clampNonNegative(version, 1)),
  };
};

export const isExamPointsProfileNameTaken = (
  profiles: ExamPointsProfile[],
  name: string,
  excludeProfileId?: string | null,
) => {
  const normalized = normalizeProfileNameKey(name);
  if (!normalized) {
    return false;
  }
  return profiles.some((profile) => {
    if (excludeProfileId && profile.id === excludeProfileId) {
      return false;
    }
    return normalizeProfileNameKey(profile.name) === normalized;
  });
};

export const getExamPointsProfileByName = (
  profiles: ExamPointsProfile[],
  name: string | null | undefined,
) => {
  if (!name || !name.trim()) {
    return null;
  }
  const normalized = normalizeProfileNameKey(name);
  return (
    profiles.find((profile) => normalizeProfileNameKey(profile.name) === normalized) ??
    null
  );
};
