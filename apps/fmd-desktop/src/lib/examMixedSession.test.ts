/**
 * @file apps/fmd-desktop/src/lib/examMixedSession.test.ts
 *
 * Zweck:
 * - Tests fuer den Mixed-Exam-Session Aggregator.
 */

import { describe, expect, it } from "vitest";
import { parseExamTasks } from "./exam";
import {
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

describe("buildMixedSessionTasks", () => {
  it("builds one task per task number and is deterministic with a fixed seed", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", range(1, 10)),
      buildSource("/vault/exam-b.md", "Exam B", range(1, 10)),
      buildSource("/vault/exam-c.md", "Exam C", range(1, 10)),
    ];

    const first = buildMixedSessionTasks(sources, "seed-fixed");
    const second = buildMixedSessionTasks(sources, "seed-fixed");
    const reshuffled = buildMixedSessionTasks(sources, "seed-other");

    expect(first.tasks).toHaveLength(10);
    expect(first.tasks.map((task) => task.originalTaskNumber)).toEqual(range(1, 10));
    expect(second.tasks.map((task) => task.sessionTaskId)).toEqual(
      first.tasks.map((task) => task.sessionTaskId),
    );
    expect(
      reshuffled.tasks.some(
        (task, index) =>
          task.sourceExamPath !== first.tasks[index]?.sourceExamPath,
      ),
    ).toBe(true);
  });

  it("includes trailing task numbers when only one exam provides them", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", range(1, 10)),
      buildSource("/vault/exam-b.md", "Exam B", range(1, 10)),
      buildSource("/vault/exam-c.md", "Exam C", range(1, 11)),
    ];

    const mixed = buildMixedSessionTasks(sources, "seed-fixed");
    const taskEleven = mixed.tasks.find((task) => task.originalTaskNumber === 11);

    expect(mixed.tasks).toHaveLength(11);
    expect(taskEleven?.sourceExamPath).toBe("/vault/exam-c.md");
    expect(taskEleven?.sessionIndex).toBe(11);
  });

  it("skips missing numbers without creating session gaps", () => {
    const sources = [
      buildSource("/vault/exam-a.md", "Exam A", [1, 2, 4]),
      buildSource("/vault/exam-b.md", "Exam B", [1, 2, 4]),
    ];

    const mixed = buildMixedSessionTasks(sources, "seed-fixed");

    expect(mixed.tasks.map((task) => task.originalTaskNumber)).toEqual([1, 2, 4]);
    expect(mixed.tasks.map((task) => task.sessionIndex)).toEqual([1, 2, 3]);
  });

  it("reports duplicate task numbers inside the same source exam", () => {
    const sources = [
      buildSource("/vault/exam-dup.md", "Exam Dup", [1, 2, 1]),
      buildSource("/vault/exam-ok.md", "Exam Ok", [1, 2]),
    ];

    const mixed = buildMixedSessionTasks(sources, "seed-fixed");

    expect(mixed.duplicateTaskNumberWarnings).toContainEqual({
      examPath: "/vault/exam-dup.md",
      sourceTitle: "Exam Dup",
      taskNumber: 1,
      count: 2,
    });
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
