/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamTaskRunner.test.ts
 *
 * Zweck:
 * - Testet Exam Task Runner.test und zugehoerige Logik.
 *
 * Verantwortlichkeiten:
 * - Prueft erwartetes Verhalten und Randfaelle.
 * - Sichert Regressionen fuer zentrale Szenarien.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/exam.ts: Typen.
 * - apps/fmd-desktop/src/pages/exam-simulation/components/ExamTaskRunner.tsx: UI-Komponente.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseFlashcards } from "../../../lib/flashcards";
import type { ExamTask } from "../../../lib/exam";
import { ExamTaskRunner } from "./ExamTaskRunner";

type ExamTaskRunnerProps = ComponentProps<typeof ExamTaskRunner>;

const buildTask = (): ExamTask => ({
  id: "exam-task-1",
  index: 0,
  rawLines: ["Define foreign key. Answer: A foreign key is an attribute."],
  prompt: "Define foreign key.",
  officialAnswer: "A foreign key is an attribute.",
  gradingMode: "manual",
  sourceRange: { startLine: 0, endLine: 0 },
  cardWrapper: false,
  cardLines: ["Define foreign key. Answer: A foreign key is an attribute."],
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

const buildTaskWithParts = (
  parts: ExamTask["card"]["parts"],
  gradingMode: ExamTask["gradingMode"],
): ExamTask => ({
  id: "exam-task-1",
  index: 0,
  rawLines: ["Task line"],
  prompt: "Task line",
  gradingMode,
  sourceRange: { startLine: 0, endLine: 0 },
  cardWrapper: false,
  cardLines: ["Task line"],
  warnings: [],
  card: {
    kind: "composite",
    parts,
  },
});

const buildTaskFromMarkdown = (
  markdown: string,
  gradingMode: ExamTask["gradingMode"] = "auto",
) => {
  const cards = parseFlashcards(markdown);
  expect(cards).toHaveLength(1);
  const card = cards[0];
  expect(card?.kind).toBe("composite");
  if (!card || card.kind !== "composite") {
    throw new Error("Expected composite card");
  }
  return buildTaskWithParts(card.parts, gradingMode);
};

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
const buildProps = (
  overrides: Partial<ExamTaskRunnerProps> = {},
): ExamTaskRunnerProps => ({
  task: buildTask(),
  taskIndex: 0,
  taskCount: 1,
  maxPoints: 5,
  phase: "exam",
  partStates: [{}],
  awardedPoints: null,
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
  onBack: () => {},
  onNext: () => {},
  canGoBack: false,
  canGoNext: false,
  ...overrides,
});

const autoScoringCases: Array<
  [string, ExamTask, ExamTaskRunnerProps["partStates"]]
> = [
  [
    "multiple-choice",
    buildTaskWithParts(
      [
        {
          kind: "multiple-choice",
          question: "Pick one",
          options: [{ key: "a", text: "Answer" }],
          correctKeys: ["a"],
        },
      ],
      "auto",
    ),
    [{ selections: ["a"] }],
  ],
  [
    "true-false",
    buildTaskWithParts(
      [
        {
          kind: "true-false",
          items: [
            {
              id: "tf-0",
              question: "Statement",
              correct: "wahr",
            },
          ],
        },
      ],
      "auto",
    ),
    [{ trueFalseSelections: { "tf-0": "wahr" } }],
  ],
  [
    "cloze-input",
    buildTaskWithParts(
      [
        {
          kind: "cloze",
          subtype: "cl",
          question: "Fill the blank",
          segments: [
            { type: "text", value: "Answer is " },
            { type: "blank", id: "blank-0", kind: "input", solution: "text" },
          ],
          dragTokens: [],
        },
      ],
      "auto",
    ),
    [{ clozeResponses: { "blank-0": "text" } }],
  ],
  [
    "cloze-drag",
    buildTaskWithParts(
      [
        {
          kind: "cloze",
          subtype: "cd",
          question: "Drag the token",
          segments: [
            { type: "text", value: "Token is " },
            { type: "blank", id: "blank-0", kind: "drag", solution: "token" },
          ],
          dragTokens: [{ id: "token-0", value: "token" }],
        },
      ],
      "auto",
    ),
    [{ clozeResponses: { "blank-0": "token-0" } }],
  ],
];

describe("ExamTaskRunner", () => {
  it("toggles the source badge via showSourceBadge", () => {
    const task = {
      ...buildTask(),
      sourceTitle: "exam.md",
    };

    const withSourceMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ task })),
    );
    expect(withSourceMarkup).toContain("Quelle: exam.md");

    const withoutSourceMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ task, showSourceBadge: false })),
    );
    expect(withoutSourceMarkup).not.toContain("Quelle: exam.md");
  });

  it("hides free-text solutions during exam and reveals them after submit", () => {
    const examMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "exam" })),
    );
    expect(examMarkup).toContain("Define foreign key.");
    expect(examMarkup).not.toContain("A foreign key is an attribute.");
    expect(examMarkup).not.toContain("flashcard-answer");

    const reviewMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "review" })),
    );
    expect(reviewMarkup).toContain("Define foreign key.");
    expect(reviewMarkup).toContain("A foreign key is an attribute.");
    expect(reviewMarkup).toContain("flashcard-answer");

    const scoringMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "scoring" })),
    );
    expect(scoringMarkup).toContain("Define foreign key.");
    expect(scoringMarkup).toContain("A foreign key is an attribute.");
    expect(scoringMarkup).toContain("flashcard-answer");

    const correctionMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "correction" })),
    );
    expect(correctionMarkup).toContain("Define foreign key.");
    expect(correctionMarkup).toContain("A foreign key is an attribute.");
    expect(correctionMarkup).toContain("flashcard-answer");
  });

  it("renders tables for free-text parts with scroll fallback", () => {
    const task = buildTaskFromMarkdown(`#card
| Term | Answer |
| --- | --- |
| Alpha | Beta |
Answer: Done
#endcard`, "manual");

    const markup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "review", task })),
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("flashcard-table scrollable");
  });

  it("renders png embeds inside table cells as images in exam task cards", () => {
    const task = buildTaskFromMarkdown(`#card
| Visual | Description |
| --- | --- |
| ![[images/example.png]] | Diagram |
Answer: Done
#endcard`, "manual");

    const markup = renderToStaticMarkup(
      createElement(
        ExamTaskRunner,
        buildProps({
          phase: "review",
          task,
          vaultPngAssets: [
            {
              path: "/vault/images/example.png",
              relative_path: "images/example.png",
              file_name: "example.png",
              extension: "png",
            },
          ],
        }),
      ),
    );

    expect(markup).toContain("flashcard-media-image");
    expect(markup).toContain("flashcard-table-cell-media");
    expect(markup).not.toContain("![[images/example.png]]");
  });

  it("renders cloze tables without scroll wrappers and keeps tokens in cells", () => {
    const task = buildTaskFromMarkdown(`#card
| Term | Answer |
| --- | --- |
| Alpha | %one% |
| Beta | "two" |
#endcard`);

    const markup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "exam", task })),
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("cloze-input");
    expect(markup).toContain("cloze-placeholder");
    expect(markup).toContain("flashcard-table no-scroll");
    expect(markup).not.toContain("flashcard-table scrollable");
  });

  it("renders tables in multiple-choice context blocks", () => {
    const task = buildTaskFromMarkdown(`#card
Pick one using the context table.

| Method | Intent |
| --- | --- |
| GET | Read |
| POST | Create |

Which method reads data?
a) POST
b) GET
-b
#endcard`);

    const markup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "exam", task })),
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("flashcard-table scrollable");
  });

  it("renders tables in true/false context blocks", () => {
    const task = buildTaskFromMarkdown(`#card
Decide if the statement is true or false.

| Term | Meaning |
| --- | --- |
| Star | Produces its own light |

Statement: The Sun is a star.
-true
#endcard`);

    const markup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "exam", task })),
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("flashcard-table scrollable");
  });

  it.each(autoScoringCases)(
    "hides manual scoring controls for %s tasks",
    (_label, task, partStates) => {
      void _label;
      const scoringMarkup = renderToStaticMarkup(
        createElement(
          ExamTaskRunner,
          buildProps({ phase: "scoring", task, partStates }),
        ),
      );

      expect(scoringMarkup).toContain("RESULT");
      expect(scoringMarkup).toContain("POINTS");
      expect(scoringMarkup).toContain("Correct");
      expect(scoringMarkup).not.toContain("AUTO RESULT");
      expect(scoringMarkup).not.toContain("CONFIRM");
      expect(scoringMarkup).not.toContain("AWARDED");
    },
  );

  it("shows manual scoring controls for free-text tasks", () => {
    const task = buildTaskWithParts(
      [
        {
          kind: "free-text",
          front: "Explain",
          back: "Response",
        },
      ],
      "manual",
    );

    const scoringMarkup = renderToStaticMarkup(
      createElement(
        ExamTaskRunner,
        buildProps({ phase: "scoring", task, partStates: [{}] }),
      ),
    );

    expect(scoringMarkup).toContain("AWARDED");
    expect(scoringMarkup).toContain('aria-label="Awarded points"');
    expect(scoringMarkup).not.toContain("RESULT");
    expect(scoringMarkup).not.toContain("POINTS");
  });

  it("shows manual scoring controls for hybrid tasks", () => {
    const task = buildTaskWithParts(
      [
        {
          kind: "multiple-choice",
          question: "Pick one",
          options: [{ key: "a", text: "Answer" }],
          correctKeys: ["a"],
        },
        {
          kind: "free-text",
          front: "Explain",
          back: "Response",
        },
      ],
      "hybrid",
    );

    const scoringMarkup = renderToStaticMarkup(
      createElement(
        ExamTaskRunner,
        buildProps({
          phase: "scoring",
          task,
          partStates: [{ selections: ["a"] }, {}],
        }),
      ),
    );

    expect(scoringMarkup).toContain("AWARDED");
    expect(scoringMarkup).not.toContain("RESULT");
    expect(scoringMarkup).not.toContain("POINTS");
  });

  it("renders correction banner and header actions in correction mode", () => {
    const correctionMarkup = renderToStaticMarkup(
      createElement(
        ExamTaskRunner,
        buildProps({
          phase: "correction",
          headerActions: createElement("button", { type: "button" }, "Back to Results"),
        }),
      ),
    );

    expect(correctionMarkup).toContain("CORRECTION");
    expect(correctionMarkup).toContain("Correction Mode");
    expect(correctionMarkup).toContain("Update your answers and return to results.");
    expect(correctionMarkup).toContain("Back to Results");
  });

  it("keeps manual scoring inputs visible in correction mode", () => {
    const task = buildTaskWithParts(
      [
        {
          kind: "free-text",
          front: "Explain",
          back: "Response",
        },
      ],
      "manual",
    );

    const correctionMarkup = renderToStaticMarkup(
      createElement(
        ExamTaskRunner,
        buildProps({ phase: "correction", task, partStates: [{}] }),
      ),
    );

    expect(correctionMarkup).toContain("AWARDED");
    expect(correctionMarkup).toContain('aria-label="Awarded points"');
  });

  it("does not render legacy convert-to-flashcard controls in scoring view", () => {
    const scoringMarkup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "scoring" })),
    );

    expect(scoringMarkup).not.toContain("Convert to flashcard");
  });

  it("renders math in exam text fields and ignores inline-code math delimiters", () => {
    const task = buildTaskFromMarkdown(`#card
Context $c$ and code \`$no$\`.

What is $x+y$?
a) Result is $z$
b) Keep code \`$keep$\`
-a
#endcard`);

    const markup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "exam", task })),
    );

    const inlineMathOccurrences = (markup.match(/md-math-inline/g) ?? []).length;
    expect(inlineMathOccurrences).toBe(3);
    expect(markup).toContain("$keep$");
  });

  it("shows math fallback source and indicator on KaTeX errors", () => {
    const task = buildTaskWithParts(
      [
        {
          kind: "multiple-choice",
          question: "Broken $\\frac{1$",
          options: [{ key: "a", text: "Answer" }],
          correctKeys: ["a"],
        },
      ],
      "auto",
    );

    const markup = renderToStaticMarkup(
      createElement(ExamTaskRunner, buildProps({ phase: "exam", task })),
    );

    expect(markup).toContain("md-math-fallback");
    expect(markup).toContain("md-math-fallback-source");
    expect(markup).toContain("md-math-fallback-badge");
  });
});
