import { describe, expect, it } from "vitest";
import { parseExamTasks, type ExamTask } from "../../lib/exam";
import type { AutoCardType } from "../../lib/exam/autoCards";
import {
  buildExamPointsProfile,
  createDefaultTypeRules,
  type ExamPointsProfile,
} from "../../lib/exam/pointsProfiles";
import { resolveAutoTaskAwardedPoints } from "./autoScoring";

const defaultTypePoints: Record<AutoCardType, number> = {
  qa: 1,
  tf: 1,
  m1: 1,
  m2: 1,
  cl: 1,
  cd: 1,
  cld: 1,
};

const parseSingleExamTask = (cardLines: string[]) => {
  const markdown = [
    "#exam",
    "1) Composite MC",
    "#card",
    ...cardLines,
    "#endcard",
    "#endexam",
  ].join("\n");
  const parsed = parseExamTasks(markdown);
  expect(parsed.tasks).toHaveLength(1);
  const [task] = parsed.tasks;
  if (!task) {
    throw new Error("Expected one parsed task");
  }
  return task;
};

const buildTaskOrderProfile = (taskPoints: number): ExamPointsProfile =>
  buildExamPointsProfile({
    id: "task-order-profile",
    name: "Task Order Profile",
    distribution: "task-order",
    taskCount: 1,
    maxTotalPoints: taskPoints,
    taskPoints: [taskPoints],
    typeRules: createDefaultTypeRules(1),
  });

const resolvePoints = ({
  task,
  partStates,
  maxPoints,
  profile,
}: {
  task: ExamTask;
  partStates: Array<{ selections: string[] }>;
  maxPoints: number;
  profile: ExamPointsProfile | null;
}) =>
  resolveAutoTaskAwardedPoints({
    task,
    partStates,
    maxPoints,
    pointsProfile: profile,
    defaultTypePoints,
  });

describe("resolveAutoTaskAwardedPoints", () => {
  it("scores a multiple-choice question with two correct options", () => {
    const task = parseSingleExamTask([
      "Select two",
      "a) A",
      "b) B",
      "c) C",
      "d) D",
      "-a",
      "-c",
    ]);

    const profile = buildTaskOrderProfile(4);
    expect(resolvePoints({
      task,
      partStates: [{ selections: ["a", "c"] }],
      maxPoints: 4,
      profile,
    })).toBe(4);
    expect(resolvePoints({
      task,
      partStates: [{ selections: ["a"] }],
      maxPoints: 4,
      profile,
    })).toBe(0);
  });

  it("awards partial points for two m2 subtasks with two correct options each", () => {
    const task = parseSingleExamTask([
      "Part A",
      "a) A1",
      "b) A2",
      "c) A3",
      "d) A4",
      "-a",
      "-c",
      "---",
      "Part B",
      "a) B1",
      "b) B2",
      "c) B3",
      "d) B4",
      "-a",
      "-c",
    ]);

    expect(task.card.parts).toHaveLength(2);
    expect(resolvePoints({
      task,
      partStates: [{ selections: ["a", "c"] }, { selections: ["a"] }],
      maxPoints: 8,
      profile: buildTaskOrderProfile(8),
    })).toBe(4);
  });

  it("awards partial points for two m2 subtasks with three correct options each", () => {
    const task = parseSingleExamTask([
      "Part A",
      "a) A1",
      "b) A2",
      "c) A3",
      "d) A4",
      "-a",
      "-b",
      "-c",
      "---",
      "Part B",
      "a) B1",
      "b) B2",
      "c) B3",
      "d) B4",
      "-a",
      "-b",
      "-c",
    ]);

    expect(resolvePoints({
      task,
      partStates: [{ selections: ["a", "b", "c"] }, { selections: ["a", "b"] }],
      maxPoints: 6,
      profile: buildTaskOrderProfile(6),
    })).toBe(3);
  });

  it("keeps distinct subtask keys independent when correct options differ", () => {
    const task = parseSingleExamTask([
      "Part A",
      "a) A1",
      "b) A2",
      "c) A3",
      "d) A4",
      "-a",
      "-c",
      "---",
      "Part B",
      "a) B1",
      "b) B2",
      "c) B3",
      "d) B4",
      "-b",
      "-d",
    ]);

    expect(resolvePoints({
      task,
      partStates: [{ selections: ["a", "c"] }, { selections: ["a", "c"] }],
      maxPoints: 8,
      profile: buildTaskOrderProfile(8),
    })).toBe(4);
  });

  it("scores subtasks correctly when both use identical correct keys", () => {
    const task = parseSingleExamTask([
      "Part A",
      "a) A1",
      "b) A2",
      "c) A3",
      "d) A4",
      "-a",
      "-b",
      "---",
      "Part B",
      "a) B1",
      "b) B2",
      "c) B3",
      "d) B4",
      "-a",
      "-b",
    ]);

    expect(resolvePoints({
      task,
      partStates: [{ selections: ["a", "b"] }, { selections: ["a", "b"] }],
      maxPoints: 8,
      profile: buildTaskOrderProfile(8),
    })).toBe(8);
  });

  it("supports more than two multiple-choice subtasks in one task", () => {
    const task = parseSingleExamTask([
      "Part A",
      "a) A1",
      "b) A2",
      "c) A3",
      "d) A4",
      "-a",
      "-c",
      "---",
      "Part B",
      "a) B1",
      "b) B2",
      "c) B3",
      "d) B4",
      "-a",
      "-c",
      "---",
      "Part C",
      "a) C1",
      "b) C2",
      "c) C3",
      "d) C4",
      "-a",
      "-c",
    ]);

    expect(task.card.parts).toHaveLength(3);
    expect(resolvePoints({
      task,
      partStates: [
        { selections: ["a", "c"] },
        { selections: ["a", "c"] },
        { selections: ["a"] },
      ],
      maxPoints: 9,
      profile: buildTaskOrderProfile(9),
    })).toBe(6);
  });
});
