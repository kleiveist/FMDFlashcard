/**
 * @file apps/fmd-desktop/src/features/exam-editor/validation.test.ts
 */

import { describe, expect, it } from "vitest";
import { validateCard, validateExamBlueprint } from "./validation";
import type { ExamBlueprint } from "./types";

describe("validateCard", () => {
  it("flags missing QA fields", () => {
    const result = validateCard({
      id: "qa-1",
      type: "qa",
      prompt: "",
      answer: "",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.prompt).toBe("Prompt is required.");
    expect(result.fieldErrors.answer).toBe("Answer is required.");
  });

  it("flags missing TF selection", () => {
    const result = validateCard({
      id: "tf-1",
      type: "tf",
      prompt: "Statement",
      correct: null,
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.correct).toBe("Select true or false.");
  });

  it("flags M1 option count and correct count", () => {
    const result = validateCard({
      id: "m1-1",
      type: "m1",
      prompt: "Pick one",
      options: [
        { id: "opt-a", text: "", isCorrect: true },
        { id: "opt-b", text: "", isCorrect: false },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.options).toBe("At least two options are required.");
    expect(result.fieldErrors.correct).toBe("Select exactly one correct option.");
    expect(result.optionErrors["opt-a"]).toBe("Option text is required.");
  });

  it("flags M2 correct count", () => {
    const result = validateCard({
      id: "m2-1",
      type: "m2",
      prompt: "Pick two",
      options: [
        { id: "opt-a", text: "Alpha", isCorrect: true },
        { id: "opt-b", text: "Beta", isCorrect: false },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.correct).toBe("Select at least two correct options.");
  });

  it("flags invalid M1/M2 raw body syntax", () => {
    const result = validateCard({
      id: "m1-raw-invalid",
      type: "m1",
      prompt: "Pick one",
      options: [
        { id: "opt-a", text: "Alpha", isCorrect: true },
        { id: "opt-b", text: "Beta", isCorrect: false },
      ],
      rawBody: "this is not valid multiple-choice syntax",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.syntax).toBeDefined();
  });

  it("accepts valid M1/M2 raw body syntax", () => {
    const result = validateCard({
      id: "m2-raw-valid",
      type: "m2",
      prompt: "Pick two",
      options: [
        { id: "opt-a", text: "Alpha", isCorrect: true },
        { id: "opt-b", text: "Beta", isCorrect: true },
      ],
      rawBody: ["Pick two", "a) Alpha", "b) Beta", "-a", "-b"].join("\n"),
    });

    expect(result.fieldErrors.syntax).toBeUndefined();
  });

  it("flags cloze prompts without blanks", () => {
    const result = validateCard({
      id: "cl-1",
      type: "cl",
      prompt: "No blanks here",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.syntax).toContain("cloze blank");
  });

  it("flags drag prompts without tokens", () => {
    const result = validateCard({
      id: "cd-1",
      type: "cd",
      prompt: "No tokens here",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.syntax).toContain("drag token");
  });

  it("ignores drag tokens inside inline code spans", () => {
    const result = validateCard({
      id: "cd-inline",
      type: "cd",
      prompt: 'Use `"token"` as inline code.',
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.syntax).toContain("drag token");
  });

  it("flags cld prompts without both blanks and tokens", () => {
    const result = validateCard({
      id: "cld-1",
      type: "cld",
      prompt: "Only %blank%.",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.syntax).toContain("drag token");
  });

  it("ignores fenced code blocks when validating cld prompts", () => {
    const result = validateCard({
      id: "cld-2",
      type: "cld",
      prompt: ["```sql", 'SELECT "token" FROM table', "WHERE column = %value%", "```"].join("\n"),
    });

    expect(result.valid).toBe(true);
  });
});

describe("validateExamBlueprint", () => {
  it("requires at least one task", () => {
    const result = validateExamBlueprint({
      id: "exam-1",
      title: "Empty",
      description: "",
      tasks: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBe("Exam requires at least one task.");
  });

  it("marks exam valid when all tasks are valid", () => {
    const exam: ExamBlueprint = {
      id: "exam-2",
      title: "Valid",
      description: "",
      tasks: [
        {
          id: "task-1",
          order: 0,
          title: "QA",
          useCardWrapper: false,
          cards: [
            {
              id: "card-1",
              type: "qa",
              prompt: "Question",
              answer: "Answer",
            },
          ],
        },
      ],
    };

    const result = validateExamBlueprint(exam);

    expect(result.valid).toBe(true);
  });
});
