/**
 * @file apps/fmd-desktop/src/features/exam-editor/choiceRawBody.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  mergeChoiceOptions,
  parseChoiceRawBody,
  serializeChoiceRawBody,
} from "./choiceRawBody";

describe("choiceRawBody", () => {
  it("serializes prompt/options into raw choice syntax", () => {
    const raw = serializeChoiceRawBody({
      prompt: "Pick one",
      options: [
        { id: "a", text: "Alpha", isCorrect: true },
        { id: "b", text: "Beta", isCorrect: false },
      ],
    });

    expect(raw).toContain("Pick one");
    expect(raw).toContain("a) Alpha");
    expect(raw).toContain("b) Beta");
    expect(raw).toContain("-a");
  });

  it("parses valid raw syntax and detects recommended type", () => {
    const parsed = parseChoiceRawBody([
      "Question",
      "a) Alpha",
      "b) Beta",
      "-a",
      "-b",
    ].join("\n"));

    expect(parsed.error).toBeUndefined();
    expect(parsed.parsed?.prompt).toBe("Question");
    expect(parsed.parsed?.options).toHaveLength(2);
    expect(parsed.parsed?.recommendedType).toBe("m2");
  });

  it("keeps existing option ids when merging parsed options", () => {
    const merged = mergeChoiceOptions(
      [
        { id: "opt-1", text: "Old A", isCorrect: false },
        { id: "opt-2", text: "Old B", isCorrect: true },
      ],
      [
        { text: "New A", isCorrect: true },
        { text: "New B", isCorrect: false },
        { text: "New C", isCorrect: false },
      ],
    );

    expect(merged[0]?.id).toBe("opt-1");
    expect(merged[1]?.id).toBe("opt-2");
    expect(merged[2]?.id).toBeDefined();
    expect(merged[2]?.id).not.toBe("opt-1");
    expect(merged[2]?.id).not.toBe("opt-2");
  });
});
