/**
 * @file frontend/src/lib/examRuns.test.ts
 *
 * Zweck:
 * - Testet Exam-Run Hilfsfunktionen fuer Prozent, Status und Filter.
 */

import { describe, expect, it } from "vitest";
import {
  calculateExamPercent,
  filterExamRuns,
  isExamPassed,
  resolveExamStatusDescriptor,
  type ExamRun,
} from "./examRuns";

const buildRun = (overrides: Partial<ExamRun>): ExamRun => ({
  id: "run",
  startedAt: "2024-01-01T10:00:00.000Z",
  endedAt: "2024-01-01T10:10:00.000Z",
  durationMs: 600000,
  userId: "user",
  userName: "User",
  examFilePath: "exam.md",
  tasksDetected: 5,
  maxPoints: 20,
  achievedPoints: 10,
  percent: 50,
  passed: true,
  grade: "5",
  gradeScaleId: "standard-1-6",
  ...overrides,
});

describe("calculateExamPercent", () => {
  it("rounds percentage based on achieved points", () => {
    expect(calculateExamPercent(9, 20)).toBe(45);
    expect(calculateExamPercent(10, 20)).toBe(50);
  });

  it("returns 0 when max points is zero", () => {
    expect(calculateExamPercent(5, 0)).toBe(0);
  });
});

describe("isExamPassed", () => {
  it("passes at 50 percent or higher", () => {
    expect(isExamPassed(50)).toBe(true);
    expect(isExamPassed(49)).toBe(false);
  });
});

describe("resolveExamStatusDescriptor", () => {
  it("returns status tokens in '<number> <emoji>' format with correct thresholds", () => {
    expect(resolveExamStatusDescriptor(100).token).toBe("1 💎");
    expect(resolveExamStatusDescriptor(95).token).toBe("1 🔵");
    expect(resolveExamStatusDescriptor(85).token).toBe("2 🟢");
    expect(resolveExamStatusDescriptor(80).token).toBe("3 🟡");
    expect(resolveExamStatusDescriptor(70).token).toBe("4 🟠");
    expect(resolveExamStatusDescriptor(10).token).toBe("5 🔴");
    expect(resolveExamStatusDescriptor(0).token).toBe("0 ⚪");
  });
});

describe("filterExamRuns", () => {
  const runs = [
    buildRun({
      id: "run-1",
      userId: "user-a",
      userName: "Alice",
      examFilePath: "math.md",
      passed: true,
      endedAt: "2024-01-02T10:00:00.000Z",
    }),
    buildRun({
      id: "run-2",
      userId: "user-b",
      userName: "Bob",
      examFilePath: "chemistry.md",
      passed: false,
      endedAt: "2024-01-03T10:00:00.000Z",
    }),
  ];

  it("filters by user id", () => {
    const filtered = filterExamRuns(runs, {
      userId: "user-a",
      status: "all",
      query: "",
    });
    expect(filtered.map((run) => run.id)).toEqual(["run-1"]);
  });

  it("filters by status and sorts by newest", () => {
    const filtered = filterExamRuns(runs, {
      userId: "",
      status: "failed",
      query: "",
    });
    expect(filtered.map((run) => run.id)).toEqual(["run-2"]);
  });

  it("filters by exam file query", () => {
    const filtered = filterExamRuns(runs, {
      userId: "",
      status: "all",
      query: "math",
    });
    expect(filtered.map((run) => run.id)).toEqual(["run-1"]);
  });
});
