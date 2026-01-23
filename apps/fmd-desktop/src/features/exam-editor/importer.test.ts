/**
 * @file apps/fmd-desktop/src/features/exam-editor/importer.test.ts
 */

import { describe, expect, it } from "vitest";
import { importExamMarkdown } from "./importer";
import { serializeExamBlueprint } from "./serializer";

const compositeMarkdown = `
#exam
1) Composite
#card
#help
Use formula.
#helpend
Question one
Answer: One
---
Statement two
-true
#
2) Solo
Question two
Answer: Two
#examend
`.trim();

describe("importExamMarkdown", () => {
  it("preserves composite tasks and task-level wrapper", () => {
    const imported = importExamMarkdown(compositeMarkdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    const [first, second] = imported.blueprint.tasks;
    if (!first || !second) {
      throw new Error("Expected two tasks after import.");
    }
    expect(first.cards).toHaveLength(2);
    expect(first.useCardWrapper).toBe(true);
    expect(first.cards[0]?.type).toBe("qa");
    expect(first.cards[1]?.type).toBe("tf");
    expect(first.cards[0]?.helpText).toBe("Use formula.");
    expect(second.useCardWrapper).toBe(false);
  });

  it("roundtrips composite tasks without splitting parts", () => {
    const imported = importExamMarkdown(compositeMarkdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const serialized = serializeExamBlueprint(imported.blueprint);
    const roundtrip = importExamMarkdown(serialized);
    expect(roundtrip).not.toBeNull();
    if (!roundtrip) {
      return;
    }

    expect(roundtrip.blueprint.tasks).toHaveLength(2);
    expect(roundtrip.blueprint.tasks[0]?.cards).toHaveLength(2);
    expect(roundtrip.blueprint.tasks[0]?.useCardWrapper).toBe(true);
    expect(serialized.match(/^#card$/gm)?.length ?? 0).toBe(1);
    expect(serialized).toContain("---");
  });

  it("removes duplicated task numbers from content on roundtrip", () => {
    const markdown = `
#exam
1) First task
1) Question line
Answer: A
2) Second task
2) Another question
Answer: B
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const serialized = serializeExamBlueprint(imported.blueprint);
    const numberLines = serialized.split("\n").filter((line) => /^\d+\)/.test(line));
    expect(numberLines).toHaveLength(2);
    expect(serialized).toContain("Question line");
    expect(serialized).toContain("Another question");
    expect(serialized).not.toContain("\n1) Question line");
    expect(serialized).not.toContain("\n2) Another question");
  });

  it("imports cld tasks with tables and tokens", () => {
    const markdown = `
#exam
1) Table CLD
#card
Fill %%col%% using tocken "token".
| Col | Value |
| --- | --- |
| A | tocken "alpha" |
#
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    if (!task) {
      throw new Error("Expected task after import.");
    }
    expect(task.cards).toHaveLength(1);
    const card = task.cards[0];
    expect(card?.type).toBe("cld");
    if (card?.type === "cld") {
      expect(card.prompt).toContain("| Col | Value |");
      expect(card.prompt).toContain('tocken "alpha"');
    }
  });

  it("imports task help at start and end of tasks", () => {
    const markdown = `
#exam
1) Start help
#help
Start hint
#helpend
Question?
Answer: A
---
2) End help
Question?
Answer: B
#help
End hint
#helpend
---
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    expect(imported.blueprint.tasks[0]?.helpText).toBe("Start hint");
    expect(imported.blueprint.tasks[1]?.helpText).toBe("End hint");
  });

  it("ignores task help markers inside fenced code blocks", () => {
    const markdown = `
#exam
1) Task with fence
\`\`\`sql
#help
Not help
#helpend
\`\`\`
Question?
Answer: A
---
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(1);
    expect(imported.blueprint.tasks[0]?.helpText).toBeUndefined();
  });

  it("skips context blocks between tasks separated by ---", () => {
    const markdown = `
#exam
8) Some task
Antwort: Some answer
---
## Abschnitt 3: Erlaeuterungsfrage (qa)
9) Next task
Antwort: Next answer
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    expect(imported.blueprint.tasks[0]?.cards).toHaveLength(1);
    expect(imported.blueprint.tasks[1]?.cards).toHaveLength(1);
    const hasHeadingCard = imported.blueprint.tasks.some((task) =>
      task.cards.some(
        (card) => card.type === "qa" && card.prompt.includes("Abschnitt 3"),
      ),
    );
    expect(hasHeadingCard).toBe(false);
  });

  it("does not create QA cards from headings without separators", () => {
    const markdown = `
#exam
1) First task
Question?
Answer: A
## Abschnitt heading
2) Second task
Answer: B
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    expect(imported.blueprint.tasks[0]?.cards).toHaveLength(1);
    expect(imported.blueprint.tasks[1]?.cards).toHaveLength(1);
  });

  it("does not split on --- inside fenced code blocks", () => {
    const markdown = `
#exam
1) Task with fence
#card
Question?
\`\`\`md
---
\`\`\`
Answer: A
#
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    const card = task?.cards[0];
    if (card?.type === "qa") {
      expect(card.prompt).toContain("```");
      expect(card.prompt).toContain("---");
    }
  });

  it("does not split on --- inside tables", () => {
    const markdown = `
#exam
1) Table task
#card
Question?
| Key | Value |
| --- | --- |
| A | --- |
Answer: A
#
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    const card = task?.cards[0];
    if (card?.type === "qa") {
      expect(card.prompt).toContain("| Key | Value |");
      expect(card.prompt).toContain("| A | --- |");
    }
  });

  it("skips blocks without answer markers", () => {
    const markdown = `
#exam
1) Task
Question?
Answer: A
---
Just context without an answer marker.
---
#examend
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    expect(task?.cards[0]?.type).toBe("qa");
  });
});
