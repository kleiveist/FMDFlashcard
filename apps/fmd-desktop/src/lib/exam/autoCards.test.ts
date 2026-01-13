/**
 * @file apps/fmd-desktop/src/lib/exam/autoCards.test.ts
 *
 * Zweck:
 * - Tests fuer Auto-Card Wrapper Utilities.
 */

import { describe, expect, it } from "vitest";
import { parseExamTasks } from "../exam";
import {
  applyExamCardWrapperActions,
  removeExamTaskWrapper,
} from "./autoCards";

const baseExamContent = [
  "#exam",
  "1) First task",
  "---",
  "2) Second task",
  "#examend",
].join("\n");

describe("addExamTaskWrapper", () => {
  it("is idempotent when applied twice", () => {
    const tasks = parseExamTasks(baseExamContent).tasks;
    const firstPass = applyExamCardWrapperActions(
      baseExamContent,
      tasks,
      () => "add",
    ).content;
    const secondPass = applyExamCardWrapperActions(
      firstPass,
      parseExamTasks(firstPass).tasks,
      () => "add",
    ).content;

    expect(secondPass).toBe(firstPass);
  });
});

describe("removeExamTaskWrapper", () => {
  it("does nothing when no wrapper exists", () => {
    const tasks = parseExamTasks(baseExamContent).tasks;
    const result = removeExamTaskWrapper(
      baseExamContent.split("\n"),
      tasks[0].sourceRange,
    );

    expect(result.changed).toBe(false);
    expect(result.lines.join("\n")).toBe(baseExamContent);
  });
});

describe("auto cards return-on-correct", () => {
  it("keeps only incorrect tasks wrapped", () => {
    const tasks = parseExamTasks(baseExamContent).tasks;
    const incorrectOnly = applyExamCardWrapperActions(
      baseExamContent,
      tasks,
      (_task, index) => (index === 0 ? "remove" : "add"),
    ).content;

    const wrapperCount = (incorrectOnly.match(/^#card$/gm) ?? []).length;
    expect(wrapperCount).toBe(1);
    expect(incorrectOnly).toContain("#card\n2) Second task");
    expect(incorrectOnly).not.toContain("#card\n1) First task");
  });
});

describe("markdown tables", () => {
  it("keeps table row structure intact when wrapping", () => {
    const tableContent = [
      "#exam",
      "1) Table task",
      "| A | B |",
      "| - | - |",
      "| 1 | 2 |",
      "#examend",
    ].join("\n");
    const tasks = parseExamTasks(tableContent).tasks;
    const wrapped = applyExamCardWrapperActions(tableContent, tasks, () => "add").content;

    const tableBlock = ["| A | B |", "| - | - |", "| 1 | 2 |"].join("\n");
    expect(wrapped).toContain(tableBlock);
  });
});
