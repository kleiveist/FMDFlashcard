/**
 * @file apps/fmd-desktop/src/lib/examMixedSession.ts
 *
 * Zweck:
 * - Baut Session-Tasks fuer Single- und Mixed-Exam-Laeufe.
 */

import { type ExamTask } from "./exam";
import { hashIdentifier } from "./seededShuffle";

export type ExamSessionSource = {
  examPath: string;
  sourceTitle: string;
  tasks: ExamTask[];
};

export type ExamSessionTask = ExamTask & {
  sessionTaskId: string;
  sourceExamPath: string;
  sourceTitle: string;
  originalTaskNumber: number;
  sessionIndex: number;
};

export type DuplicateTaskNumberWarning = {
  examPath: string;
  sourceTitle: string;
  taskNumber: number;
  count: number;
};

export type BuildMixedSessionResult = {
  tasks: ExamSessionTask[];
  duplicateTaskNumberWarnings: DuplicateTaskNumberWarning[];
  maxTaskNumber: number;
};

type CandidateTask = {
  examPath: string;
  sourceTitle: string;
  task: ExamTask;
  taskNumber: number;
};

const taskHeaderPattern = /^\s*(\d+)\)\s*(.*)$/;

const normalizeSeed = (seed: string | number) => {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    const normalized = Math.floor(Math.abs(seed));
    return normalized > 0 ? normalized : 1;
  }
  const raw = String(seed);
  return hashIdentifier(raw) || 1;
};

const createSeededRandom = (seed: string | number) => {
  let value = normalizeSeed(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const resolveTaskNumberFromLine = (line: string) => {
  const match = line.match(taskHeaderPattern);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const resolveExamTaskNumber = (task: ExamTask) => {
  for (const line of task.rawLines) {
    const number = resolveTaskNumberFromLine(line.trimStart());
    if (number !== null) {
      return number;
    }
  }
  const promptFirstLine = task.prompt.split("\n")[0] ?? "";
  const promptNumber = resolveTaskNumberFromLine(promptFirstLine.trimStart());
  if (promptNumber !== null) {
    return promptNumber;
  }
  return task.index + 1;
};

const buildSessionTaskId = (
  seed: string | number,
  candidate: CandidateTask,
  sessionIndex: number,
) => {
  const fingerprint = [
    String(seed),
    candidate.examPath,
    candidate.sourceTitle,
    candidate.taskNumber,
    candidate.task.id,
    candidate.task.index,
    candidate.task.sourceRange.startLine,
    candidate.task.sourceRange.endLine,
    sessionIndex,
  ].join("|");
  const hash = hashIdentifier(fingerprint).toString(16).padStart(8, "0");
  return `session-task-${hash}-${sessionIndex}`;
};

const toSessionTask = (
  candidate: CandidateTask,
  sessionIndex: number,
  seed: string | number,
): ExamSessionTask => {
  const sessionTaskId = buildSessionTaskId(seed, candidate, sessionIndex);
  return {
    ...candidate.task,
    sessionTaskId,
    sourceExamPath: candidate.examPath,
    sourceTitle: candidate.sourceTitle,
    originalTaskNumber: candidate.taskNumber,
    sessionIndex,
  };
};

export const createMixSeed = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

export const buildSingleSessionTasks = (
  source: ExamSessionSource,
  seed: string | number,
) =>
  source.tasks.map((task, index) =>
    toSessionTask(
      {
        examPath: source.examPath,
        sourceTitle: source.sourceTitle,
        task,
        taskNumber: resolveExamTaskNumber(task),
      },
      index + 1,
      seed,
    ),
  );

export const buildMixedSessionTasks = (
  sources: ExamSessionSource[],
  seed: string | number,
): BuildMixedSessionResult => {
  if (sources.length === 0) {
    return {
      tasks: [],
      duplicateTaskNumberWarnings: [],
      maxTaskNumber: 0,
    };
  }

  const bucketByTaskNumber = new Map<number, CandidateTask[]>();
  const duplicateTaskNumberWarnings: DuplicateTaskNumberWarning[] = [];

  sources.forEach((source) => {
    const localTaskCounts = new Map<number, number>();

    source.tasks.forEach((task) => {
      const taskNumber = resolveExamTaskNumber(task);
      localTaskCounts.set(taskNumber, (localTaskCounts.get(taskNumber) ?? 0) + 1);

      const bucket = bucketByTaskNumber.get(taskNumber) ?? [];
      bucket.push({
        examPath: source.examPath,
        sourceTitle: source.sourceTitle,
        task,
        taskNumber,
      });
      bucketByTaskNumber.set(taskNumber, bucket);
    });

    localTaskCounts.forEach((count, taskNumber) => {
      if (count > 1) {
        duplicateTaskNumberWarnings.push({
          examPath: source.examPath,
          sourceTitle: source.sourceTitle,
          taskNumber,
          count,
        });
      }
    });
  });

  const taskNumbers = Array.from(bucketByTaskNumber.keys()).sort((a, b) => a - b);
  const maxTaskNumber = taskNumbers[taskNumbers.length - 1] ?? 0;
  const random = createSeededRandom(seed);
  const tasks: ExamSessionTask[] = [];

  for (let taskNumber = 1; taskNumber <= maxTaskNumber; taskNumber += 1) {
    const candidates = bucketByTaskNumber.get(taskNumber);
    if (!candidates || candidates.length === 0) {
      continue;
    }
    const randomIndex = Math.floor(random() * candidates.length);
    const picked = candidates[randomIndex] ?? candidates[0];
    if (!picked) {
      continue;
    }
    const sessionIndex = tasks.length + 1;
    tasks.push(toSessionTask(picked, sessionIndex, seed));
  }

  duplicateTaskNumberWarnings.sort((left, right) => {
    const pathCompare = left.examPath.localeCompare(right.examPath);
    if (pathCompare !== 0) {
      return pathCompare;
    }
    return left.taskNumber - right.taskNumber;
  });

  return {
    tasks,
    duplicateTaskNumberWarnings,
    maxTaskNumber,
  };
};
