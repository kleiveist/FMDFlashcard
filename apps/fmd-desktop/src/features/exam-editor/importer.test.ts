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

  it("imports cld tasks with tables and tokens", () => {
    const markdown = `
#exam
1) Table CLD
#card
Fill %%col%% using \`token\`.
| Col | Value |
| --- | --- |
| A | \`alpha\` |
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
      expect(card.prompt).toContain("`alpha`");
    }
  });
});
