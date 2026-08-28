/**
 * @file frontend/src/lib/examMixedSession.test.ts
 *
 * Zweck:
 * - Tests fuer den Combined-Exam-Session Aggregator.
 */

import { describe, expect, it } from "vitest";
import { parseExamTasks } from "./exam";
import {
  buildCombinedSessionTasks,
  buildCombinedSessionTasksFromRows,
  buildMixedSessionTasks,
  buildSingleSessionTasks,
  type ExamSessionSource,
} from "./examMixedSession";

const buildSource = (
  examPath: string,
  sourceTitle: string,
  taskNumbers: number[],
): ExamSessionSource => {
  const lines = ["#exam"];
  taskNumbers.forEach((taskNumber) => {
    lines.push(`${taskNumber}) ${sourceTitle} task ${taskNumber}`);
  });
  lines.push("#endexam");

  const tasks = parseExamTasks(lines.join("\n")).tasks;
  return {
    examPath,
    sourceTitle,
    tasks,
  };
};

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe("buildCombinedSessionTasks", () => {
  it("aggregates all tasks in fully mixed mode", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", range(1, 5)),
      buildSource("/vault/exam-b.md", "Exam B", range(1, 5)),
    ];

    const mixed = buildCombinedSessionTasks(sources, "seed-fixed", "fully-mixed");

    expect(mixed.tasks).toHaveLength(10);
    expect(mixed.tasks.map((task) => task.sessionIndex)).toEqual(range(1, 10));
  });

  it("aggregates all tasks for three files", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", range(1, 5)),
      buildSource("/vault/exam-b.md", "Exam B", range(1, 5)),
      buildSource("/vault/exam-c.md", "Exam C", range(1, 5)),
    ];

    const mixed = buildCombinedSessionTasks(sources, "seed-fixed", "fully-mixed");

    expect(mixed.tasks).toHaveLength(15);
    expect(mixed.tasks.map((task) => task.sessionIndex)).toEqual(range(1, 15));
  });

  it("is deterministic with the same seed and changes with a different seed", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", range(1, 5)),
      buildSource("/vault/exam-b.md", "Exam B", range(1, 5)),
      buildSource("/vault/exam-c.md", "Exam C", range(1, 5)),
    ];

    const first = buildCombinedSessionTasks(sources, "seed-a", "fully-mixed");
    const second = buildCombinedSessionTasks(sources, "seed-a", "fully-mixed");
    const third = buildCombinedSessionTasks(sources, "seed-b", "fully-mixed");

    expect(first.tasks.map((task) => task.sessionTaskId)).toEqual(
      second.tasks.map((task) => task.sessionTaskId),
    );
    expect(first.tasks.map((task) => task.sessionTaskId)).not.toEqual(
      third.tasks.map((task) => task.sessionTaskId),
    );
  });

  it("keeps file order and task order in sequential mode", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", [1, 2, 3]),
      buildSource("/vault/exam-b.md", "Exam B", [1, 2, 3]),
    ];

    const sequential = buildCombinedSessionTasks(sources, "seed-fixed", "sequential");

    expect(sequential.tasks).toHaveLength(6);
    expect(sequential.tasks.map((task) => task.sourceExamPath)).toEqual([
      "/vault/exam-a.md",
      "/vault/exam-a.md",
      "/vault/exam-a.md",
      "/vault/exam-b.md",
      "/vault/exam-b.md",
      "/vault/exam-b.md",
    ]);
    expect(sequential.tasks.map((task) => task.originalTaskNumber)).toEqual([
      1,
      2,
      3,
      1,
      2,
      3,
    ]);
  });

  it("keeps file order but shuffles within files in sequential-shuffled mode", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", [1, 2, 3, 4, 5]),
      buildSource("/vault/exam-b.md", "Exam B", [1, 2, 3, 4, 5]),
    ];

    const shuffled = buildCombinedSessionTasks(
      sources,
      "seed-fixed",
      "sequential-shuffled",
    );

    expect(shuffled.tasks).toHaveLength(10);
    expect(shuffled.tasks.slice(0, 5).every((task) => task.sourceExamPath === "/vault/exam-a.md")).toBe(
      true,
    );
    expect(shuffled.tasks.slice(5).every((task) => task.sourceExamPath === "/vault/exam-b.md")).toBe(
      true,
    );

    const firstFileNumbers = shuffled.tasks
      .slice(0, 5)
      .map((task) => task.originalTaskNumber)
      .sort((left, right) => left - right);
    const secondFileNumbers = shuffled.tasks
      .slice(5)
      .map((task) => task.originalTaskNumber)
      .sort((left, right) => left - right);

    expect(firstFileNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(secondFileNumbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows each task number only once in nested mode", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", [1, 2, 3, 4, 5]),
      buildSource("/vault/exam-b.md", "Exam B", [1, 2, 3, 4, 5]),
      buildSource("/vault/exam-c.md", "Exam C", [1, 2, 3, 4, 5]),
    ];

    const nested = buildCombinedSessionTasks(sources, "seed-fixed", "nested");

    expect(nested.tasks).toHaveLength(5);
    expect(new Set(nested.tasks.map((task) => task.originalTaskNumber)).size).toBe(5);
    expect(
      [...nested.tasks.map((task) => task.originalTaskNumber)].sort((left, right) => left - right),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps nested mode deterministic with the same seed", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", [1, 2, 3, 4, 5]),
      buildSource("/vault/exam-b.md", "Exam B", [1, 2, 3, 4, 5]),
      buildSource("/vault/exam-c.md", "Exam C", [1, 2, 3, 4, 5]),
    ];

    const first = buildCombinedSessionTasks(sources, "seed-a", "nested");
    const second = buildCombinedSessionTasks(sources, "seed-a", "nested");

    expect(first.tasks.map((task) => task.sessionTaskId)).toEqual(
      second.tasks.map((task) => task.sessionTaskId),
    );
  });

  it("includes task numbers that exist in only one file in nested mode", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", [1, 2, 3]),
      buildSource("/vault/exam-b.md", "Exam B", [2, 3, 4]),
    ];

    const nested = buildCombinedSessionTasks(sources, "seed-fixed", "nested");
    const taskNumbers = nested.tasks
      .map((task) => task.originalTaskNumber)
      .sort((left, right) => left - right);

    expect(nested.tasks).toHaveLength(4);
    expect(taskNumbers).toEqual([1, 2, 3, 4]);
  });

  it("keeps backwards compatible mixed helper", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", range(1, 5)),
      buildSource("/vault/exam-b.md", "Exam B", range(1, 5)),
    ];

    const mixed = buildMixedSessionTasks(sources, "seed-fixed");

    expect(mixed.tasks).toHaveLength(10);
  });
});

describe("buildSingleSessionTasks", () => {
  it("keeps task order and enriches source/session metadata", () => {
    const source = buildSource("/vault/exam-a.md", "Exam A", [1, 2, 3]);
    const single = buildSingleSessionTasks(source, "single-seed");

    expect(single).toHaveLength(3);
    expect(single.map((task) => task.sessionIndex)).toEqual([1, 2, 3]);
    expect(single.map((task) => task.sourceExamPath)).toEqual([
      "/vault/exam-a.md",
      "/vault/exam-a.md",
      "/vault/exam-a.md",
    ]);
    expect(single.map((task) => task.originalTaskNumber)).toEqual([1, 2, 3]);
  });
});

describe("buildCombinedSessionTasksFromRows", () => {
  it("treats nested rows as sequential nested groups", () => {
    const examA = buildSource("/vault/exam-a.md", "Exam A", [1, 2, 3]);
    const examB = buildSource("/vault/exam-b.md", "Exam B", [1, 2, 3]);
    const examC = buildSource("/vault/exam-c.md", "Exam C", [1, 2, 3]);

    const nested = buildCombinedSessionTasksFromRows(
      [[examA], [examB, examC]],
      "seed-fixed",
      "nested",
    );

    expect(nested.tasks).toHaveLength(6);
    expect(nested.tasks.slice(0, 3).every((task) => task.sourceExamPath === "/vault/exam-a.md")).toBe(
      true,
    );
    expect(nested.tasks.slice(3).every((task) => task.sourceExamPath !== "/vault/exam-a.md")).toBe(
      true,
    );
  });

  it("flattens rows deterministically for non-nested modes", () => {
    const examA = buildSource("/vault/exam-a.md", "Exam A", [1, 2]);
    const examB = buildSource("/vault/exam-b.md", "Exam B", [1, 2]);
    const examC = buildSource("/vault/exam-c.md", "Exam C", [1, 2]);

    const sequential = buildCombinedSessionTasksFromRows(
      [[examA, examB], [examC]],
      "seed-fixed",
      "sequential",
    );

    expect(sequential.tasks.map((task) => task.sourceExamPath)).toEqual([
      "/vault/exam-a.md",
      "/vault/exam-a.md",
      "/vault/exam-b.md",
      "/vault/exam-b.md",
      "/vault/exam-c.md",
      "/vault/exam-c.md",
    ]);
  });
});
