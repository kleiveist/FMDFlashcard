/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ContentMode.test.ts
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExamBlueprint } from "../../../features/exam-editor/types";
import type { CardValidation, ExamValidation } from "../../../features/exam-editor/validation";
import { ContentMode } from "./ContentMode";

const createValidCardValidation = (): CardValidation => ({
  valid: true,
  errors: [],
  fieldErrors: {},
  optionErrors: {},
});

const buildExam = (): ExamBlueprint => ({
  id: "exam-1",
  title: "Exam",
  description: "",
  tasks: [
    {
      id: "task-1",
      order: 0,
      title: "Task",
      useCardWrapper: false,
      cards: [
        {
          id: "card-qa-1",
          type: "qa",
          prompt: "Question 1",
          answer: "Answer 1",
        },
        {
          id: "card-tf-1",
          type: "tf",
          prompt: "Question 2",
          correct: "true",
        },
      ],
    },
  ],
});

const buildValidation = (): ExamValidation => ({
  valid: true,
  errors: [],
  taskValidations: [
    {
      taskId: "task-1",
      valid: true,
      errors: [],
      cardValidations: [createValidCardValidation(), createValidCardValidation()],
    },
  ],
});

const noop = (..._args: unknown[]) => {};

describe("ContentMode", () => {
  it("renders one 'Card help / hint' editor per card without an extra task-level help editor", () => {
    const markup = renderToStaticMarkup(
      createElement(ContentMode, {
        exam: buildExam(),
        selection: { type: "task", taskId: "task-1" },
        validation: buildValidation(),
        onSelectTask: noop,
        onTaskUpdate: noop,
        onCardUpdate: noop,
        onCardHelpChange: noop,
        onOptionTextChange: noop,
        onOptionToggle: noop,
        onOptionSelect: noop,
        onOptionAdd: noop,
        onOptionRemove: noop,
        onChoiceRawBodyChange: noop,
      }),
    );

    const helpEditorLabels = markup.match(/aria-label="Card help \/ hint"/g) ?? [];
    expect(helpEditorLabels).toHaveLength(2);
    const mediaEditorSummaries = markup.match(/class="media-editor-summary"/g) ?? [];
    expect(mediaEditorSummaries).toHaveLength(2);
  });
});
