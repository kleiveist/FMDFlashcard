import { describe, expect, it } from "vitest";
import type { ExamManualTaskEntry } from "./examSimulationTypes";
import { buildAiEvaluationMarkdown, hasAiEvaluationQaTasks } from "./aiEvaluationExport";

const buildManualEntry = (overrides: Partial<ExamManualTaskEntry> = {}): ExamManualTaskEntry =>
  ({
    taskIndex: 0,
    manualIndex: 0,
    manualCount: 1,
    maxPoints: 10,
    awardedPoints: null,
    partStates: [{ textResponse: "User answer" }],
    task: {
      id: "task-1",
      index: 0,
      rawLines: ["Question"],
      prompt: "Question",
      gradingMode: "manual",
      sourceRange: { startLine: 0, endLine: 0 },
      cardWrapper: false,
      cardLines: ["Question"],
      warnings: [],
      sourceTitle: "exam.md",
      sessionTaskId: "session-task-1",
      sourceExamPath: "/vault/exam.md",
      originalTaskNumber: 1,
      sourceTaskIndex: 0,
      sessionIndex: 1,
      card: {
        kind: "composite",
        parts: [
          {
            kind: "free-text",
            front: "Question text",
            back: "Official answer",
          },
        ],
        primaryType: "qa",
        detectedTypes: ["qa"],
      },
    },
    ...overrides,
  }) as ExamManualTaskEntry;

describe("aiEvaluationExport", () => {
  it("builds prompt-ready markdown for QA tasks with answers and max points", () => {
    const markdown = buildAiEvaluationMarkdown([
      buildManualEntry({
        maxPoints: 10,
        partStates: [{ textResponse: "First answer" }],
      }),
      buildManualEntry({
        maxPoints: 8,
        partStates: [{ textResponse: "Second answer" }],
        task: {
          ...buildManualEntry().task,
          sessionTaskId: "session-task-2",
          card: {
            kind: "composite",
            parts: [
              {
                kind: "free-text",
                front: "Second question",
                back: "Second official answer",
              },
            ],
            primaryType: "qa",
            detectedTypes: ["qa"],
          },
        },
      }),
    ]);

    expect(markdown).toBe(
      [
        "# AI Evaluation Request",
        "",
        "Please evaluate the following QA exam answers.  ",
        "Award points for each task based on the max score.",
        "",
        "---",
        "",
        "## Task 1",
        "",
        "### Question",
        "Question text",
        "",
        "### User Answer",
        "First answer",
        "",
        "### Max Points",
        "10",
        "",
        "### Awarded",
        "__ / 10",
        "",
        "---",
        "",
        "## Task 2",
        "",
        "### Question",
        "Second question",
        "",
        "### User Answer",
        "Second answer",
        "",
        "### Max Points",
        "8",
        "",
        "### Awarded",
        "__ / 8",
      ].join("\n"),
    );
  });

  it("uses textResponse from part state, preserves empty answers, and normalizes line endings", () => {
    const markdown = buildAiEvaluationMarkdown([
      buildManualEntry({
        maxPoints: 6,
        partStates: [{ textResponse: "Line 1\r\nLine 2\rLine 3" }],
        task: {
          ...buildManualEntry().task,
          card: {
            kind: "composite",
            parts: [
              {
                kind: "free-text",
                front: "Question\r\nwith line break",
                back: "Official answer",
              },
            ],
            primaryType: "qa",
            detectedTypes: ["qa"],
          },
        },
      }),
      buildManualEntry({
        maxPoints: 4,
        partStates: [{}],
      }),
    ]);

    expect(markdown).toContain("Question\nwith line break");
    expect(markdown).toContain("Line 1\nLine 2\nLine 3");
    expect(markdown).toContain(["### User Answer", "", "### Max Points", "4"].join("\n"));
  });

  it("exports only free-text QA parts from mixed tasks", () => {
    const entry = buildManualEntry({
      maxPoints: 12,
      partStates: [{ selections: ["a"] }, { textResponse: "QA response" }],
      task: {
        ...buildManualEntry().task,
        card: {
          kind: "composite",
          parts: [
            {
              kind: "multiple-choice",
              question: "Ignored multiple choice",
              options: [{ key: "a", text: "A" }],
              correctKeys: ["a"],
            },
            {
              kind: "free-text",
              front: "Included QA question",
              back: "Included answer",
            },
          ],
          detectedTypes: ["multiple-choice", "qa"],
          isMixed: true,
        },
      },
    });

    expect(hasAiEvaluationQaTasks([entry])).toBe(true);
    const markdown = buildAiEvaluationMarkdown([entry]);
    expect(markdown).toContain("Included QA question");
    expect(markdown).toContain("QA response");
    expect(markdown).not.toContain("Ignored multiple choice");
  });

  it("returns no markdown when no QA free-text parts are exportable", () => {
    const entry = buildManualEntry({
      partStates: [{ selections: ["a"] }],
      task: {
        ...buildManualEntry().task,
        card: {
          kind: "composite",
          parts: [
            {
              kind: "multiple-choice",
              question: "Only multiple choice",
              options: [{ key: "a", text: "A" }],
              correctKeys: ["a"],
            },
          ],
          primaryType: "multiple-choice",
          detectedTypes: ["multiple-choice"],
        },
      },
    });

    expect(hasAiEvaluationQaTasks([entry])).toBe(false);
    expect(buildAiEvaluationMarkdown([entry])).toBe("");
  });
});
