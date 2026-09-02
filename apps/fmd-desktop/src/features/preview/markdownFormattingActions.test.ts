import { describe, expect, it } from "vitest";
import { applyMarkdownFormattingInsertion } from "./markdownFormattingActions";

describe("applyMarkdownFormattingInsertion", () => {
  it("wraps selected text for inline actions", () => {
    const result = applyMarkdownFormattingInsertion("Alpha Beta", { start: 6, end: 10 }, "****");

    expect(result.handled).toBe(true);
    expect(result.value).toBe("Alpha **Beta**");
    expect(result.selection).toEqual({ start: 8, end: 12 });
  });

  it("inserts a marker pair and places the caret inside for collapsed selections", () => {
    const result = applyMarkdownFormattingInsertion("Alpha", { start: 5, end: 5 }, "****");

    expect(result.handled).toBe(true);
    expect(result.value).toBe("Alpha****");
    expect(result.selection).toEqual({ start: 7, end: 7 });
  });

  it("applies heading prefixes line-based without losing selected text", () => {
    const result = applyMarkdownFormattingInsertion("Alpha Beta", { start: 6, end: 10 }, "##");

    expect(result.handled).toBe(true);
    expect(result.value).toBe("## Alpha Beta");
    expect(result.selection).toEqual({ start: 9, end: 13 });
  });

  it("applies prefix to each selected line in multiline selections", () => {
    const result = applyMarkdownFormattingInsertion(
      "Alpha\nBeta\nGamma",
      { start: 0, end: 10 },
      ">",
    );

    expect(result.handled).toBe(true);
    expect(result.value).toBe("> Alpha\n> Beta\nGamma");
    expect(result.selection).toEqual({ start: 2, end: 14 });
  });

  it("wraps selected text for code/math/cloze/quote wrappers", () => {
    const cases: Array<{ token: string; expected: string }> = [
      { token: "=", expected: "==Text==" },
      { token: "_", expected: "__Text__" },
      { token: "~", expected: "~~Text~~" },
      { token: "`", expected: "`Text`" },
      { token: "``", expected: "`Text`" },
      { token: "$", expected: "$Text$" },
      { token: "$$", expected: "$Text$" },
      { token: "%", expected: "%Text%" },
      { token: "%%", expected: "%%Text%%" },
      { token: '"', expected: '"Text"' },
      { token: '""', expected: '"Text"' },
      { token: "''", expected: '"Text"' },
    ];

    cases.forEach(({ token, expected }) => {
      const result = applyMarkdownFormattingInsertion("Text", { start: 0, end: 4 }, token);
      expect(result.handled).toBe(true);
      expect(result.value).toBe(expected);
    });
  });
});
