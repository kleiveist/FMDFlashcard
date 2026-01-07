import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExamTask } from "../../../lib/exam";
import { ExamTaskRunner } from "./ExamTaskRunner";

type ExamTaskRunnerProps = ComponentProps<typeof ExamTaskRunner>;

const buildTask = (): ExamTask => ({
  id: "exam-task-1",
  index: 0,
  rawLines: ["Define foreign key. Answer: A foreign key is an attribute."],
  sourceRange: { startLine: 0, endLine: 0 },
  warnings: [],
  card: {
    kind: "composite",
    parts: [
      {
        kind: "free-text",
        front: "Define foreign key.",
        back: "A foreign key is an attribute.",
      },
    ],
    primaryType: "qa",
    detectedTypes: ["qa"],
    isMixed: false,
  },
});

const noopOptionSelect: ExamTaskRunnerProps["onOptionSelect"] = (...args) => {
  void args;
};
const noopTrueFalseSelect: ExamTaskRunnerProps["onTrueFalseSelect"] = (...args) => {
  void args;
};
const noopClozeInputChange: ExamTaskRunnerProps["onClozeInputChange"] = (
  ...args
) => {
  void args;
};
const noopClozeTokenDrop: ExamTaskRunnerProps["onClozeTokenDrop"] = (...args) => {
  void args;
};
const noopClozeTokenRemove: ExamTaskRunnerProps["onClozeTokenRemove"] = (
  ...args
) => {
  void args;
};
const noopClozeTokenDragStart: ExamTaskRunnerProps["onClozeTokenDragStart"] = (
  ...args
) => {
  void args;
};
const noopBlankDragOver: ExamTaskRunnerProps["onBlankDragOver"] = (...args) => {
  void args;
};
const noopTextInputChange: ExamTaskRunnerProps["onTextInputChange"] = (
  ...args
) => {
  void args;
};
const noopAwardedPointsChange: ExamTaskRunnerProps["onAwardedPointsChange"] = (
  ...args
) => {
  void args;
};
const noopAutoGradeDecision: ExamTaskRunnerProps["onAutoGradeDecision"] = (
  ...args
) => {
  void args;
};
const noopConversionDecision: ExamTaskRunnerProps["onConversionDecision"] = (
  ...args
) => {
  void args;
};

const buildProps = (
  phase: ExamTaskRunnerProps["phase"],
): ExamTaskRunnerProps => ({
  task: buildTask(),
  taskIndex: 0,
  taskCount: 1,
  maxPoints: 5,
  phase,
  partStates: [{}],
  awardedPoints: null,
  conversionPending: false,
  conversionError: "",
  onOptionSelect: noopOptionSelect,
  onTrueFalseSelect: noopTrueFalseSelect,
  onClozeInputChange: noopClozeInputChange,
  onClozeTokenDrop: noopClozeTokenDrop,
  onClozeTokenRemove: noopClozeTokenRemove,
  onClozeTokenDragStart: noopClozeTokenDragStart,
  onBlankDragOver: noopBlankDragOver,
  onTextInputChange: noopTextInputChange,
  onAwardedPointsChange: noopAwardedPointsChange,
  onAutoGradeDecision: noopAutoGradeDecision,
  onConversionDecision: noopConversionDecision,
  onBack: () => {},
  onNext: () => {},
  canGoBack: false,
  canGoNext: false,
});

describe("ExamTaskRunner", () => {
  it("hides free-text solutions during exam and reveals them after submit", () => {
    const examMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps("exam")),
    );
    expect(examMarkup).toContain("Define foreign key.");
    expect(examMarkup).not.toContain("A foreign key is an attribute.");
    expect(examMarkup).not.toContain("flashcard-answer");

    const reviewMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps("review")),
    );
    expect(reviewMarkup).toContain("Define foreign key.");
    expect(reviewMarkup).toContain("A foreign key is an attribute.");
    expect(reviewMarkup).toContain("flashcard-answer");
  });
});
