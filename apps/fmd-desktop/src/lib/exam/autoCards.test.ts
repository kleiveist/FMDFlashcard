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
  isExamTaskWrapped,
  normalizeCardWrapperPlacement,
  removeExamTaskWrapper,
  unwrapExamTask,
  wrapExamTask,
} from "./autoCards";

const baseExamContent = [
  "#exam",
  "1) First task",
  "2) Second task",
  "#endexam",
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

describe("normalizeCardWrapperPlacement", () => {
  it("keeps canonical wrappers stable", () => {
    const markdown = [
      "#exam",
      "#card",
      "1) Canonical",
      "Question?",
      "Answer: A",
      "#endcard",
      "#endexam",
    ].join("\n");

    const normalized = normalizeCardWrapperPlacement(markdown).content;
    expect(normalized).toBe(markdown);
    expect(parseExamTasks(normalized).tasks[0]?.cardWrapper).toBe(true);
  });

  it("moves internal #card before task start", () => {
    const markdown = [
      "#exam",
      "1) Legacy",
      "#card",
      "Question?",
      "Answer: A",
      "#endcard",
      "#endexam",
    ].join("\n");

    const normalized = normalizeCardWrapperPlacement(markdown).content;
    expect(normalized).toContain("#card\n1) Legacy");
    expect(normalized).toContain("#endcard");
    expect((normalized.match(/^#card$/gm) ?? []).length).toBe(1);
    expect(parseExamTasks(normalized).tasks[0]?.cardWrapper).toBe(true);
  });

  it("removes duplicated #card markers and keeps one canonical opener", () => {
    const markdown = [
      "#exam",
      "#card",
      "1) Duplicate",
      "#card",
      "Question?",
      "Answer: A",
      "#endcard",
      "#endexam",
    ].join("\n");

    const normalized = normalizeCardWrapperPlacement(markdown).content;
    expect((normalized.match(/^#card$/gm) ?? []).length).toBe(1);
    expect(normalized).toContain("#card\n1) Duplicate");
    expect(parseExamTasks(normalized).tasks[0]?.cardWrapper).toBe(true);
  });

  it("does not auto-complete partial wrappers without a closing marker", () => {
    const markdown = [
      "#exam",
      "1) Partial",
      "#card",
      "Question?",
      "Answer: A",
      "#endexam",
    ].join("\n");

    const normalized = normalizeCardWrapperPlacement(markdown).content;
    expect(normalized).not.toMatch(/\n#endcard\n#endexam$/);
    expect(parseExamTasks(normalized).tasks[0]?.cardWrapper).toBe(false);
  });

  it("does not treat markdown headings as wrapper closers", () => {
    const markdown = [
      "#exam",
      "1) Wrong close",
      "#card",
      "Question?",
      "Answer: A",
      "# Title",
      "#endexam",
    ].join("\n");

    const normalized = normalizeCardWrapperPlacement(markdown).content;
    expect(parseExamTasks(normalized).tasks[0]?.cardWrapper).toBe(false);
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

  it("writes canonical wrappers on add and removes canonical pair on remove", () => {
    const source = [
      "#exam",
      "1) Task",
      "#help",
      "Hint",
      "#helpend",
      "#card",
      "Question?",
      "Answer: A",
      "#endcard",
      "#endexam",
    ].join("\n");

    const addResult = applyExamCardWrapperActions(
      source,
      parseExamTasks(source).tasks,
      () => "add",
    ).content;
    expect(addResult).toContain("#card\n1) Task");
    expect((addResult.match(/^#card$/gm) ?? []).length).toBe(1);
    expect(addResult).toMatch(/\n#endcard\n#endexam$/);

    const removeResult = applyExamCardWrapperActions(
      addResult,
      parseExamTasks(addResult).tasks,
      () => "remove",
    ).content;
    expect(removeResult).not.toMatch(/^#card$/m);
    expect(removeResult).not.toMatch(/\n#endcard\n#endexam$/);
    expect(removeResult).toContain("#help\nHint\n#helpend");
  });
});

describe("shared wrapper aliases", () => {
  it("exposes wrap/isWrapped/unwrap behavior via exported aliases", () => {
    const tasks = parseExamTasks(baseExamContent).tasks;
    const firstTask = tasks[0]!;
    const wrapped = wrapExamTask(baseExamContent.split("\n"), firstTask.sourceRange);
    expect(wrapped.changed).toBe(true);
    const wrappedMarkdown = wrapped.lines.join("\n");
    expect(wrappedMarkdown).toContain("#card\n1) First task");
    expect(wrappedMarkdown).toContain("#endcard");
    const wrappedTask = parseExamTasks(wrappedMarkdown).tasks[0]!;
    expect(isExamTaskWrapped(wrapped.lines, wrappedTask.sourceRange)).not.toBeNull();

    const unwrapped = unwrapExamTask(wrapped.lines, wrappedTask.sourceRange);
    expect(unwrapped.lines.join("\n")).toBe(baseExamContent);
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
      "#endexam",
    ].join("\n");
    const tasks = parseExamTasks(tableContent).tasks;
    const wrapped = applyExamCardWrapperActions(tableContent, tasks, () => "add").content;

    const tableBlock = ["| A | B |", "| - | - |", "| 1 | 2 |"].join("\n");
    expect(wrapped).toContain(tableBlock);
  });
});
