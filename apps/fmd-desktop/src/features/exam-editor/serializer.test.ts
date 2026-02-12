/**
 * @file apps/fmd-desktop/src/features/exam-editor/serializer.test.ts
 */

import { describe, expect, it } from "vitest";
import { serializeExamBlueprint } from "./serializer";
import type { ExamBlueprint } from "./types";

const buildExam = (): ExamBlueprint => ({
  id: "exam-1",
  title: "Sample Exam",
  description: "Short description.",
  tasks: [
    {
      id: "task-qa",
      order: 0,
      title: "QA",
      useCardWrapper: true,
      cards: [
        {
          id: "card-qa",
          type: "qa",
          prompt: "What is 2+2?",
          answer: "4",
        },
      ],
    },
    {
      id: "task-tf",
      order: 1,
      title: "TF",
      useCardWrapper: true,
      cards: [
        {
          id: "card-tf",
          type: "tf",
          prompt: "The sky is blue.",
          correct: "true",
        },
      ],
    },
    {
      id: "task-m1",
      order: 2,
      title: "M1",
      useCardWrapper: true,
      cards: [
        {
          id: "card-m1",
          type: "m1",
          prompt: "Pick one.",
          options: [
            { id: "opt-a", text: "Alpha", isCorrect: true },
            { id: "opt-b", text: "Beta", isCorrect: false },
          ],
        },
      ],
    },
    {
      id: "task-m2",
      order: 3,
      title: "M2",
      useCardWrapper: true,
      cards: [
        {
          id: "card-m2",
          type: "m2",
          prompt: "Pick two.",
          options: [
            { id: "opt-a", text: "One", isCorrect: true },
            { id: "opt-b", text: "Two", isCorrect: true },
            { id: "opt-c", text: "Three", isCorrect: false },
          ],
        },
      ],
    },
    {
      id: "task-cl",
      order: 4,
      title: "CL",
      useCardWrapper: true,
      cards: [
        {
          id: "card-cl",
          type: "cl",
          prompt: "Paris is the capital of %France%.",
        },
      ],
    },
    {
      id: "task-cd",
      order: 5,
      title: "CD",
      useCardWrapper: true,
      cards: [
        {
          id: "card-cd",
          type: "cd",
          prompt: 'Tokens: "alpha", "beta".',
        },
      ],
    },
    {
      id: "task-cld",
      order: 6,
      title: "CLD",
      useCardWrapper: true,
      cards: [
        {
          id: "card-cld",
          type: "cld",
          prompt: 'Mix %one% with "token".',
        },
      ],
    },
  ],
});

describe("serializeExamBlueprint", () => {
  it("serializes all card types with core markers", () => {
    const markdown = serializeExamBlueprint(buildExam());

    expect(markdown).toContain("#exam");
    expect(markdown).toContain("#examend");
    expect(markdown).toContain("#card\n1) QA");
    expect(markdown).toContain("1) QA");
    expect(markdown).toContain("Answer: 4");
    expect(markdown).toContain("-true");
    expect(markdown).toContain("a) Alpha");
    expect(markdown).toContain("-a");
    expect(markdown).toContain("-b");
    expect(markdown).toContain("%France%");
    expect(markdown).toContain('"alpha"');
    expect(markdown).toContain('Mix %one% with "token".');
  });

  it("places help blocks in task and card scopes", () => {
    const exam: ExamBlueprint = {
      id: "exam-help",
      title: "Help Test",
      description: "",
      tasks: [
        {
          id: "task-1",
          order: 0,
          title: "Hints",
          helpText: "Task hint",
          useCardWrapper: true,
          cards: [
            {
              id: "card-1",
              type: "qa",
              prompt: "Question",
              answer: "Answer",
              helpText: "Card hint",
            },
          ],
        },
      ],
    };

    const markdown = serializeExamBlueprint(exam);
    const taskHelpIndex = markdown.indexOf("#help\nTask hint\n#helpend");
    const cardStartIndex = markdown.indexOf("#card");
    const cardHelpIndex = markdown.indexOf("#help\nCard hint\n#helpend");
    const cardEndIndex = markdown.indexOf("\n#\n");

    expect(taskHelpIndex).toBeGreaterThan(-1);
    expect(cardStartIndex).toBeGreaterThan(-1);
    expect(cardHelpIndex).toBeGreaterThan(-1);
    expect(cardStartIndex).toBeLessThan(taskHelpIndex);
    expect(cardHelpIndex).toBeGreaterThan(cardStartIndex);
    expect(cardHelpIndex).toBeLessThan(cardEndIndex);
  });

  it("omits #card wrapper when disabled", () => {
    const exam: ExamBlueprint = {
      id: "exam-nowrap",
      title: "",
      description: "",
      tasks: [
        {
          id: "task-1",
          order: 0,
          title: "No wrapper",
          useCardWrapper: false,
          cards: [
            {
              id: "card-1",
              type: "qa",
              prompt: "Prompt",
              answer: "Answer",
            },
          ],
        },
      ],
    };

    const markdown = serializeExamBlueprint(exam);
    expect(markdown).not.toMatch(/^#card$/m);
    expect(markdown).not.toMatch(/^#$/m);
  });

  it("adds task separators after every task", () => {
    const exam: ExamBlueprint = {
      id: "exam-separators",
      title: "",
      description: "",
      tasks: [
        {
          id: "task-1",
          order: 0,
          title: "First",
          useCardWrapper: false,
          cards: [
            {
              id: "card-1",
              type: "qa",
              prompt: "Prompt",
              answer: "Answer",
            },
          ],
        },
        {
          id: "task-2",
          order: 1,
          title: "Second",
          useCardWrapper: false,
          cards: [
            {
              id: "card-2",
              type: "qa",
              prompt: "Another",
              answer: "Answer",
            },
          ],
        },
      ],
    };

    const markdown = serializeExamBlueprint(exam);
    const separatorLines = markdown.split("\n").filter((line) => line === "---");
    expect(separatorLines).toHaveLength(2);
    expect(markdown).toMatch(/1\)[\s\S]*---\n2\)/);
    expect(markdown).toContain("---\n#examend");
  });

  it("strips leading task numbers from card content", () => {
    const exam: ExamBlueprint = {
      id: "exam-numbering",
      title: "",
      description: "",
      tasks: [
        {
          id: "task-1",
          order: 0,
          title: "Numbered",
          useCardWrapper: false,
          cards: [
            {
              id: "card-1",
              type: "qa",
              prompt: "2) Already numbered",
              answer: "Answer",
            },
          ],
        },
      ],
    };

    const markdown = serializeExamBlueprint(exam);
    const numberLines = markdown.split("\n").filter((line) => /^\d+\)/.test(line));
    expect(numberLines).toHaveLength(1);
    expect(markdown).toContain("Already numbered");
    expect(markdown).not.toContain("\n2) Already numbered");
  });
});
