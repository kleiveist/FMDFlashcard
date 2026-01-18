/**
 * @file apps/fmd-desktop/src/features/exam-editor/blueprint.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  reorderCardsByIndex,
  reorderTasksByIndex,
} from "./blueprint";
import type { CardBlueprint, ExamTaskBlueprint } from "./types";

const buildTask = (id: string, order: number): ExamTaskBlueprint => ({
  id,
  order,
  title: "",
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
