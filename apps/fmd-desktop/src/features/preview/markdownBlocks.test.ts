import { describe, expect, it } from "vitest";
import {
  normalizeOrderedListBlockSource,
  parseMarkdownBlocks,
} from "./markdownBlocks";

describe("markdownBlocks", () => {
  it("parses headings, lists, tables and code fences as separate blocks", () => {
    const markdown = [
      "# Titel",
      "",
      "1) Eins",
      "7) Zwei",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const a = 1;",
      "```",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "blank",
      "ordered-list",
      "blank",
      "table",
      "blank",
      "code-fence",
    ]);
  });

  it("keeps non-table pipe lines as paragraphs", () => {
    const blocks = parseMarkdownBlocks("A | B\nNo separator");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe("paragraph");
  });

  it("groups ordered list continuation lines into one block", () => {
    const markdown = ["1. Alpha", "   continuation", "2. Beta"].join("\n");
    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe("ordered-list");
    expect(blocks[0]?.raw).toContain("continuation");
  });
});

describe("normalizeOrderedListBlockSource", () => {
  it("renumbers ordered lists while preserving the first delimiter style", () => {
    const input = ["9) Erste", "1) Zweite", "12.) Dritte"].join("\n");
    const normalized = normalizeOrderedListBlockSource(input);
    expect(normalized).toBe(["1) Erste", "2) Zweite", "3) Dritte"].join("\n"));
  });

  it("renumbers nested ordered list items per indentation level", () => {
    const input = [
      "7. Root",
      "   9. Child A",
      "   4. Child B",
      "8. Root 2",
    ].join("\n");
    const normalized = normalizeOrderedListBlockSource(input);
    expect(normalized).toBe(
      [
        "1. Root",
        "   1. Child A",
        "   2. Child B",
        "2. Root 2",
      ].join("\n"),
    );
  });
});

