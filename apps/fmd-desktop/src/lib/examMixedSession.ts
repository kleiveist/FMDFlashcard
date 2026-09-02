/**
 * @file apps/fmd-desktop/src/lib/examMixedSession.ts
 *
 * Zweck:
 * - Baut Session-Tasks fuer Single- und Combined-Exam-Laeufe.
 */

import { type ExamTask } from "./exam";
import { hashIdentifier, resolveSeed, seededShuffle } from "./seededShuffle";

export type ExamSessionSource = {
  examPath: string;
  sourceTitle: string;
  tasks: ExamTask[];
};

export type ExamSessionSourceRows = ExamSessionSource[][];

export type ExamSessionTask = ExamTask & {
  sessionTaskId: string;
  sourceExamPath: string;
  sourceTitle: string;
  originalTaskNumber: number;
  sourceTaskIndex: number;
  sessionIndex: number;
};

export type ExamCombinationMode = "fully-mixed" | "sequential" | "sequential-shuffled" | "nested";

export type DuplicateTaskNumberWarning = {
  examPath: string;
  sourceTitle: string;
  taskNumber: number;
  count: number;
};

export type BuildCombinedSessionResult = {
  tasks: ExamSessionTask[];
  duplicateTaskNumberWarnings: DuplicateTaskNumberWarning[];
};

type CandidateTask = {
  examPath: string;
  sourceTitle: string;
  task: ExamTask;
  taskNumber: number;
  sourceTaskIndex: number;
};

const taskHeaderPattern = /^\s*(\d+)\)\s*(.*)$/;

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
    candidate.sourceTaskIndex,
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
    sourceTaskIndex: candidate.sourceTaskIndex,
    sessionIndex,
  };
};

const toCandidates = (source: ExamSessionSource): CandidateTask[] =>
  source.tasks.map((task, sourceTaskIndex) => ({
    examPath: source.examPath,
    sourceTitle: source.sourceTitle,
    task,
    taskNumber: resolveExamTaskNumber(task),
    sourceTaskIndex,
  }));

const seedKey = (seed: string | number, suffix: string) => resolveSeed(`${String(seed)}|${suffix}`);

const buildSequentialCandidates = (
  sources: ExamSessionSource[],
  seed: string | number,
  shuffleWithinSource: boolean,
) => {
  const candidates: CandidateTask[] = [];
  sources.forEach((source) => {
    const sourceCandidates = toCandidates(source);
    const nextSourceCandidates = shuffleWithinSource
      ? seededShuffle(sourceCandidates, seedKey(seed, source.examPath))
      : sourceCandidates;
    candidates.push(...nextSourceCandidates);
  });
  return candidates;
};

const buildNestedCandidates = (sources: ExamSessionSource[], seed: string | number) => {
  const groupsByTaskNumber = new Map<number, CandidateTask[]>();
  sources.forEach((source) => {
    toCandidates(source).forEach((candidate) => {
      const bucket = groupsByTaskNumber.get(candidate.taskNumber);
      if (!bucket) {
        groupsByTaskNumber.set(candidate.taskNumber, [candidate]);
        return;
      }
      bucket.push(candidate);
    });
  });

  return Array.from(groupsByTaskNumber.entries())
    .sort(([leftTaskNumber], [rightTaskNumber]) => leftTaskNumber - rightTaskNumber)
    .map(([taskNumber, candidates]) => {
      const shuffledGroup = seededShuffle(candidates, seedKey(seed, `nested:${taskNumber}`));
      return shuffledGroup[0] ?? candidates[0];
    })
    .filter((candidate): candidate is CandidateTask => Boolean(candidate));
};

export const createMixSeed = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

export const buildSingleSessionTasks = (source: ExamSessionSource, seed: string | number) =>
  toCandidates(source).map((candidate, index) => toSessionTask(candidate, index + 1, seed));

export const buildCombinedSessionTasks = (
  sources: ExamSessionSource[],
  seed: string | number,
  mode: ExamCombinationMode,
): BuildCombinedSessionResult => {
  if (sources.length === 0) {
    return {
      tasks: [],
      duplicateTaskNumberWarnings: [],
    };
  }

  const orderedCandidates = (() => {
    if (mode === "fully-mixed") {
      const pool = sources.flatMap((source) => toCandidates(source));
      return seededShuffle(pool, seedKey(seed, "fully-mixed"));
    }
    if (mode === "nested") {
      return buildNestedCandidates(sources, seed);
    }
    if (mode === "sequential-shuffled") {
      return buildSequentialCandidates(sources, seed, true);
    }
    return buildSequentialCandidates(sources, seed, false);
  })();

  return {
    tasks: orderedCandidates.map((candidate, index) => toSessionTask(candidate, index + 1, seed)),
    duplicateTaskNumberWarnings: [],
  };
};

export const buildCombinedSessionTasksFromRows = (
  sourceRows: ExamSessionSourceRows,
  seed: string | number,
  mode: ExamCombinationMode,
): BuildCombinedSessionResult => {
  const rows = sourceRows
    .map((row) => row.filter((source) => Boolean(source)))
    .filter((row) => row.length > 0);
  if (rows.length === 0) {
    return {
      tasks: [],
      duplicateTaskNumberWarnings: [],
    };
  }

  if (mode !== "nested") {
    return buildCombinedSessionTasks(rows.flat(), seed, mode);
  }

  const orderedCandidates = rows.flatMap((row, rowIndex) =>
    buildNestedCandidates(row, seedKey(seed, `nested-row:${rowIndex}`)),
  );

  return {
    tasks: orderedCandidates.map((candidate, index) => toSessionTask(candidate, index + 1, seed)),
    duplicateTaskNumberWarnings: [],
  };
};

export const buildMixedSessionTasks = (
  sources: ExamSessionSource[],
  seed: string | number,
): BuildCombinedSessionResult => buildCombinedSessionTasks(sources, seed, "fully-mixed");
