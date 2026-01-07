/**
 * @file apps/fmd-desktop/src/lib/exam.test.ts
 *
 * Zweck:
 * - Testet exam.test und zugehoerige Logik.
 *
 * Verantwortlichkeiten:
 * - Prueft erwartetes Verhalten und Randfaelle.
 * - Sichert Regressionen fuer zentrale Szenarien.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/exam.ts: Hilfsfunktionen oder Typen.
 * - vitest: Externe Bibliothek.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import {
  parseExamTasks,
  splitAnswerBlock,
  stripExamAndFlashcardWrapperLines,
} from "./exam";

describe("parseExamTasks", () => {
  it("strips wrapper lines while keeping markdown headings", () => {
    const markdown = `#exam
#card
# Title
Answer: Secret solution
#
#endcard
#endexam`;

    const stripped = stripExamAndFlashcardWrapperLines(markdown).split("\n");

    expect(stripped).toContain("# Title");
    expect(stripped).not.toContain("#exam");
    expect(stripped).not.toContain("#card");
    expect(stripped).not.toContain("#endcard");
    expect(stripped).not.toContain("#endexam");
    expect(stripped).not.toContain("#");
  });

  it("splits answer blocks only at line start markers", () => {
    const split = splitAnswerBlock("Answer: Secret solution");
    expect(split.hasAnswerMarker).toBe(true);
    expect(split.prompt).toBe("");
    expect(split.officialAnswer).toBe("Secret solution");

    const boldSplit = splitAnswerBlock("**Answer:** Secret");
    expect(boldSplit.hasAnswerMarker).toBe(true);
    expect(boldSplit.officialAnswer).toBe("Secret");

    const inlineSplit = splitAnswerBlock("This is the answer: maybe");
    expect(inlineSplit.hasAnswerMarker).toBe(false);
    expect(inlineSplit.prompt).toBe("This is the answer: maybe");
  });

  it("keeps inline Answer markers as prompt text", () => {
    const markdown = `#exam
1) Define foreign key. Answer: A foreign key is an attribute.
#`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    const part = task?.card.parts[0];
    expect(part?.kind).toBe("free-text");
    if (part && part.kind === "free-text") {
      expect(part.front).toBe(
        "1) Define foreign key. Answer: A foreign key is an attribute.",
      );
      expect(part.back).toBe("");
    }
    expect(task?.officialAnswer).toBeUndefined();
  });

  it("adds a free-text part for answer blocks alongside multiple choice", () => {
    const markdown = `#exam
#card
1) Question line
a) First
b) Second
-a
Answer: Secret solution
#
#`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.prompt).toContain("1) Question line");
    expect(task?.prompt).toContain("a) First");
    expect(task?.prompt).not.toContain("Answer:");
    expect(task?.prompt).not.toContain("#card");
    expect(task?.officialAnswer).toBe("Secret solution");

    const parts = task?.card.parts ?? [];
    expect(parts.some((part) => part.kind === "multiple-choice")).toBe(true);
    const answerPart = parts.find((part) => part.kind === "free-text");
    expect(answerPart).toBeTruthy();
    if (answerPart && answerPart.kind === "free-text") {
      expect(answerPart.front).toBe("");
      expect(answerPart.back).toBe("Secret solution");
    }
  });
});
