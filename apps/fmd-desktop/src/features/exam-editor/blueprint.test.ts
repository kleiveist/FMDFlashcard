/**
 * @file apps/fmd-desktop/src/features/exam-editor/blueprint.test.ts
 */

import { describe, expect, it } from "vitest";
import { cloneTaskBlueprint, reorderCardsByIndex, reorderTasksByIndex } from "./blueprint";
import type { CardBlueprint, ExamTaskBlueprint } from "./types";

const buildTask = (id: string, order: number): ExamTaskBlueprint => ({
  id,
  order,
  title: "",
  useCardWrapper: false,
  cards: [],
});

const buildCard = (id: string): CardBlueprint => ({
  id,
  type: "qa",
  prompt: "",
  answer: "",
});

describe("reorderTasksByIndex", () => {
  it("moves a task from one index to another", () => {
    const tasks = [buildTask("t1", 0), buildTask("t2", 1), buildTask("t3", 2)];
    const reordered = reorderTasksByIndex(tasks, 0, 2);
    expect(reordered.map((task) => task.id)).toEqual(["t2", "t3", "t1"]);
  });

  it("returns original list when indices are invalid", () => {
    const tasks = [buildTask("t1", 0), buildTask("t2", 1)];
    const reordered = reorderTasksByIndex(tasks, -1, 1);
    expect(reordered).toBe(tasks);
  });
});

describe("reorderCardsByIndex", () => {
  it("moves a card within the list", () => {
    const cards = [buildCard("c1"), buildCard("c2"), buildCard("c3")];
    const reordered = reorderCardsByIndex(cards, 2, 0);
    expect(reordered.map((card) => card.id)).toEqual(["c3", "c1", "c2"]);
  });

  it("returns original list when indices are invalid", () => {
    const cards = [buildCard("c1"), buildCard("c2")];
    const reordered = reorderCardsByIndex(cards, 0, 5);
    expect(reordered).toBe(cards);
  });
});

describe("cloneTaskBlueprint", () => {
  it("preserves rawBody and sourceMeta while assigning new ids", () => {
    const sourceTask: ExamTaskBlueprint = {
      id: "task-source",
      order: 0,
      title: "Choice",
      useCardWrapper: false,
      cards: [
        {
          id: "card-source",
          type: "m1",
          prompt: "Question",
          options: [
            { id: "opt-a", text: "Alpha", isCorrect: true },
            { id: "opt-b", text: "Beta", isCorrect: false },
          ],
          rawBody: "Question\na) Alpha\nb) Beta\n-a",
        },
      ],
      sourceMeta: {
        sourceTaskIndex: 0,
        sourceRange: { startLine: 1, endLine: 6 },
        sourceChunk: "1) Choice\nQuestion\na) Alpha\nb) Beta\n-a\n---",
        sourceFingerprint: "task-abc",
      },
    };

    const clone = cloneTaskBlueprint(sourceTask);
    const sourceCard = sourceTask.cards[0];
    if (!sourceCard || sourceCard.type !== "m1") {
      throw new Error("Expected source task to have one M1 card.");
    }
    expect(clone.id).not.toBe(sourceTask.id);
    expect(clone.sourceMeta).toEqual(sourceTask.sourceMeta);
    expect(clone.cards[0]?.id).not.toBe(sourceTask.cards[0]?.id);
    expect(clone.cards[0]?.type).toBe("m1");
    if (clone.cards[0]?.type === "m1") {
      expect(clone.cards[0].rawBody).toBe(sourceTask.cards[0]?.rawBody);
      expect(clone.cards[0].options[0]?.id).not.toBe(sourceCard.options[0]?.id);
    }
  });
});
