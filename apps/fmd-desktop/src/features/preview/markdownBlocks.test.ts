import { describe, expect, it } from "vitest";
import {
  normalizeCardBlockSource,
  normalizeHelpBlockSource,
  normalizeHorizontalRuleBlockSource,
  normalizeHorizontalRuleSpacingInMarkdown,
  normalizeOrderedListBlockSource,
  normalizeQuotePrefixedHashLines,
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

  it("splits list markers into one block per item in hybrid-list-items profile", () => {
    const markdown = [
      "1. Alpha",
      "   continuation",
      "2. Beta",
      "   - child A",
      "     child continuation",
      "   - child B",
      "3. Gamma",
    ].join("\n");
    const blocks = parseMarkdownBlocks(markdown, { profile: "hybrid-list-items" });

    expect(blocks.map((block) => block.kind)).toEqual([
      "ordered-list",
      "ordered-list",
      "unordered-list",
      "unordered-list",
      "ordered-list",
    ]);

    const firstGroupId = blocks[0]?.meta?.listGroupId;
    expect(firstGroupId).toBeTruthy();
    expect(blocks.every((block) => block.meta?.listGroupId === firstGroupId)).toBe(true);

    expect(blocks[0]?.raw).toBe(["1. Alpha", "   continuation"].join("\n"));
    expect(blocks[0]?.meta?.listDepth).toBe(0);
    expect(blocks[0]?.meta?.listParentStartLine).toBeUndefined();
    expect(blocks[0]?.meta?.listItemType).toBe("ordered");
    expect(blocks[0]?.meta?.orderedDelimiter).toBe(".");

    expect(blocks[1]?.raw).toBe("2. Beta");
    expect(blocks[1]?.meta?.listDepth).toBe(0);
    expect(blocks[1]?.meta?.listParentStartLine).toBeUndefined();
    expect(blocks[1]?.meta?.listIndentWidth).toBe(0);

    expect(blocks[2]?.raw).toBe(["   - child A", "     child continuation"].join("\n"));
    expect(blocks[2]?.meta?.listDepth).toBe(1);
    expect(blocks[2]?.meta?.listParentStartLine).toBe(2);
    expect(blocks[2]?.meta?.listIndentWidth).toBe(3);
    expect(blocks[2]?.meta?.unorderedMarker).toBe("-");
    expect(blocks[2]?.meta?.listItemType).toBe("unordered");

    expect(blocks[3]?.raw).toBe("   - child B");
    expect(blocks[3]?.meta?.listDepth).toBe(1);
    expect(blocks[3]?.meta?.listParentStartLine).toBe(2);
    expect(blocks[3]?.meta?.listIndentWidth).toBe(3);

    expect(blocks[4]?.raw).toBe("3. Gamma");
    expect(blocks[4]?.meta?.listDepth).toBe(0);
    expect(blocks[4]?.meta?.listParentStartLine).toBeUndefined();
    expect(blocks[4]?.meta?.listIndentWidth).toBe(0);
  });

  it("resets hybrid list groups across non-list boundary blocks", () => {
    const markdown = [
      "1. One",
      "2. Two",
      "#help",
      "hint",
      "#helpend",
      "3. Three",
    ].join("\n");
    const blocks = parseMarkdownBlocks(markdown, { profile: "hybrid-list-items" });

    expect(blocks.map((block) => block.kind)).toEqual([
      "ordered-list",
      "ordered-list",
      "help-block",
      "ordered-list",
    ]);

    const firstGroup = blocks[0]?.meta?.listGroupId;
    const secondGroup = blocks[3]?.meta?.listGroupId;
    expect(firstGroup).toBeTruthy();
    expect(secondGroup).toBeTruthy();
    expect(blocks[1]?.meta?.listGroupId).toBe(firstGroup);
    expect(secondGroup).not.toBe(firstGroup);
  });

  it("treats #help ... #helpend as a single special block", () => {
    const markdown = [
      "Vorher",
      "#help",
      "# Testtitel",
      "1. Liste",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "#helpend",
      "Nachher",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "help-block",
      "paragraph",
    ]);
    expect(blocks[1]?.raw).toBe(
      [
        "#help",
        "# Testtitel",
        "1. Liste",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "#helpend",
      ].join("\n"),
    );
  });

  it("treats quote-prefixed #help/#helpend markers as one top-level help block", () => {
    const markdown = [
      "> #help",
      "> Hinweis",
      "> #helpend",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual(["help-block"]);
    expect(
      normalizeHelpBlockSource(blocks[0]?.raw ?? ""),
    ).toBe(["#help", "Hinweis", "#helpend"].join("\n"));
  });

  it("treats quote-prefixed #card/#endcard markers as top-level card blocks", () => {
    const markdown = [
      "> #card",
      "> Frage",
      "> #endcard",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "card-start",
      "blockquote",
      "card-end",
    ]);
    expect(normalizeCardBlockSource(blocks[0]?.raw ?? "")).toBe("#card");
    expect(normalizeCardBlockSource(blocks[2]?.raw ?? "")).toBe("#endcard");

    const cardGroupId = blocks[0]?.meta?.cardGroupId;
    expect(cardGroupId).toBeTruthy();
    expect(blocks[1]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[2]?.meta?.cardGroupId).toBe(cardGroupId);
  });

  it("parses standalone png embeds as isolated blocks", () => {
    const markdown = ["Intro", "", "![[images/example.png]]", "", "Outro"].join("\n");
    const blocks = parseMarkdownBlocks(markdown);

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "blank",
      "image-embed",
      "blank",
      "paragraph",
    ]);
    expect(blocks[2]?.raw).toBe("![[images/example.png]]");
  });

  it("treats :::: ... :::: as a single database block", () => {
    const markdown = [
      "Vorher",
      "::::",
      "title: Demo",
      "view:",
      "  type: table",
      "::::",
      "Nachher",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "database-block",
      "paragraph",
    ]);
    expect(blocks[1]?.raw).toBe(
      [
        "::::",
        "title: Demo",
        "view:",
        "  type: table",
        "::::",
      ].join("\n"),
    );
  });

  it("keeps markers inside database blocks parser-isolated", () => {
    const markdown = [
      "Vorher",
      "::::",
      "#card",
      "a) Option",
      "-a",
      "#endcard",
      "#exam",
      "1) Task",
      "#endexam",
      "::::",
      "Nachher",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "database-block",
      "paragraph",
    ]);
    expect(blocks[1]?.raw).toContain("#card");
    expect(blocks[1]?.raw).toContain("#exam");
  });

  it("splits #card wrappers into marker blocks and keeps inner blocks grouped", () => {
    const markdown = [
      "Vorher",
      "#card",
      "Frage",
      "",
      "#help",
      "Hinweis",
      "#helpend",
      "",
      "Answer: Antwort",
      "#endcard",
      "Nachher",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "card-start",
      "paragraph",
      "blank",
      "help-block",
      "blank",
      "paragraph",
      "card-end",
      "paragraph",
    ]);
    expect(blocks[1]?.raw).toBe("#card");
    expect(blocks[7]?.raw).toBe("#endcard");

    const cardGroupId = blocks[1]?.meta?.cardGroupId;
    expect(cardGroupId).toBeTruthy();
    expect(blocks[1]?.meta?.cardGroupRole).toBe("start");
    expect(blocks[2]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[2]?.meta?.cardGroupRole).toBe("inner");
    expect(blocks[3]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[4]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[5]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[6]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[7]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[7]?.meta?.cardGroupRole).toBe("end");
    expect(blocks[0]?.meta?.cardGroupId).toBeUndefined();
    expect(blocks[8]?.meta?.cardGroupId).toBeUndefined();
  });

  it("keeps an empty #card/#endcard pair as two marker blocks in the same card group", () => {
    const blocks = parseMarkdownBlocks(["#card", "#endcard"].join("\n"));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.kind).toBe("card-start");
    expect(blocks[0]?.raw).toBe("#card");
    expect(blocks[1]?.kind).toBe("card-end");
    expect(blocks[1]?.raw).toBe("#endcard");
    expect(blocks[0]?.meta?.cardGroupRole).toBe("start");
    expect(blocks[1]?.meta?.cardGroupRole).toBe("end");
    expect(blocks[0]?.meta?.cardGroupId).toBe(blocks[1]?.meta?.cardGroupId);
  });

  it("keeps an unclosed #card group open through EOF", () => {
    const blocks = parseMarkdownBlocks(
      [
        "Before",
        "#card",
        "Inside paragraph",
        "",
        "1. item",
      ].join("\n"),
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "card-start",
      "paragraph",
      "blank",
      "ordered-list",
    ]);
    const cardGroupId = blocks[1]?.meta?.cardGroupId;
    expect(cardGroupId).toBeTruthy();
    expect(blocks[1]?.meta?.cardGroupRole).toBe("start");
    expect(blocks[2]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[3]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[4]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[4]?.meta?.cardGroupRole).toBe("inner");
  });

  it("keeps mixed inner card content granular while preserving one card group id", () => {
    const markdown = [
      "#card",
      "## Heading",
      "",
      "1. item",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      "#help",
      "hint",
      "#helpend",
      "",
      "![[images/example.png]]",
      "#endcard",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "card-start",
      "heading",
      "blank",
      "ordered-list",
      "blank",
      "table",
      "blank",
      "code-fence",
      "blank",
      "help-block",
      "blank",
      "image-embed",
      "card-end",
    ]);

    const cardGroupId = blocks[0]?.meta?.cardGroupId;
    expect(cardGroupId).toBeTruthy();
    expect(blocks[0]?.meta?.cardGroupRole).toBe("start");
    for (let i = 1; i < blocks.length - 1; i += 1) {
      expect(blocks[i]?.meta?.cardGroupId).toBe(cardGroupId);
      expect(blocks[i]?.meta?.cardGroupRole).toBe("inner");
    }
    expect(blocks[blocks.length - 1]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[blocks.length - 1]?.meta?.cardGroupRole).toBe("end");
  });

  it("does not assign a card group to unmatched #endcard markers", () => {
    const blocks = parseMarkdownBlocks(["Before", "#endcard", "After"].join("\n"));

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "card-end", "paragraph"]);
    expect(blocks[1]?.meta?.cardGroupId).toBeUndefined();
    expect(blocks[1]?.meta?.cardGroupRole).toBeUndefined();
  });

  it("closes an open card at the first #endcard and leaves trailing #endcard unmatched", () => {
    const blocks = parseMarkdownBlocks(
      ["#card", "Outer", "#card", "Inner", "#endcard", "#endcard"].join("\n"),
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      "card-start",
      "paragraph",
      "card-start",
      "paragraph",
      "card-end",
      "card-end",
    ]);

    const cardGroupId = blocks[0]?.meta?.cardGroupId;
    expect(cardGroupId).toBeTruthy();
    expect(blocks[0]?.meta?.cardGroupRole).toBe("start");
    expect(blocks[1]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[1]?.meta?.cardGroupRole).toBe("inner");
    expect(blocks[2]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[2]?.meta?.cardGroupRole).toBe("inner");
    expect(blocks[3]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[3]?.meta?.cardGroupRole).toBe("inner");
    expect(blocks[4]?.meta?.cardGroupId).toBe(cardGroupId);
    expect(blocks[4]?.meta?.cardGroupRole).toBe("end");
    expect(blocks[5]?.meta?.cardGroupId).toBeUndefined();
    expect(blocks[5]?.meta?.cardGroupRole).toBeUndefined();
  });

  it("parses an unclosed database opener as one trailing database block", () => {
    const markdown = [
      "Heading",
      "",
      "::::",
      "title: Incomplete",
      "source:",
      "  type: current-folder",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "blank",
      "database-block",
    ]);
    expect(blocks[2]?.raw).toContain("title: Incomplete");
  });

  it("only normalizes same-line suffix content on #endcard", () => {
    expect(
      normalizeCardBlockSource(["#card", "Frage", "#endcardAntwort"].join("\n")),
    ).toBe(["#card", "Frage", "Antwort", "#endcard"].join("\n"));
    expect(
      normalizeCardBlockSource(["#card", "Frage", "#endcard", "Danach"].join("\n")),
    ).toBe(["#card", "Frage", "#endcard", "Danach"].join("\n"));
    expect(
      normalizeCardBlockSource(["#card", "Frage", "#endcardAntwort", "Danach"].join("\n")),
    ).toBe(["#card", "Frage", "Antwort", "#endcard", "Danach"].join("\n"));
  });

  it("treats $$ ... $$ as a single math block", () => {
    const markdown = [
      "Intro",
      "$$",
      "\\frac{a}{b}",
      "\\int_{0}^{1} x^2 dx",
      "$$",
      "Outro",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "math-block",
      "paragraph",
    ]);
    expect(blocks[1]?.raw).toBe([
      "$$",
      "\\frac{a}{b}",
      "\\int_{0}^{1} x^2 dx",
      "$$",
    ].join("\n"));
  });

  it("keeps math blocks isolated from surrounding list parsing", () => {
    const markdown = [
      "1. First",
      "$$",
      "\\sum_{i=1}^{n}",
      "$$",
      "2. Second",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "ordered-list",
      "math-block",
      "ordered-list",
    ]);
  });

  it("recognizes single-line $$ ... $$ syntax as a math block", () => {
    const blocks = parseMarkdownBlocks(
      String.raw`$$ \text{RECHNUNGSADRESSE.PK} = \text{KUNDEID} + \text{ADRESSEID} $$`,
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe("math-block");
  });

  it("splits lists around an indented help block and keeps help as its own block", () => {
    const markdown = [
      "1. Erste Zeile",
      "   Fortsetzung",
      "   #help",
      "   1. bleibt im help-block roh",
      "   #helpend   ",
      "2. Zweite Zeile",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "ordered-list",
      "help-block",
      "ordered-list",
    ]);
    expect(blocks[0]?.raw).toBe(["1. Erste Zeile", "   Fortsetzung"].join("\n"));
    expect(blocks[1]?.raw).toBe(
      [
        "   #help",
        "   1. bleibt im help-block roh",
        "   #helpend   ",
      ].join("\n"),
    );
    expect(blocks[2]?.raw).toBe("2. Zweite Zeile");
  });

  it("treats blank + hr + blank as a single hr block without separate blank rows", () => {
    const markdown = ["Text davor", "", "---", "", "Text danach"].join("\n");
    const blocks = parseMarkdownBlocks(markdown);

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "hr", "paragraph"]);
    expect(blocks[1]?.raw).toBe(["", "---", ""].join("\n"));
  });

  it("keeps hr as one block even when only one side already has a blank line", () => {
    const withLeadingBlank = parseMarkdownBlocks(["Text", "", "---", "Text"].join("\n"));
    expect(withLeadingBlank.map((block) => block.kind)).toEqual(["paragraph", "hr", "paragraph"]);

    const withTrailingBlank = parseMarkdownBlocks(["Text", "---", "", "Text"].join("\n"));
    expect(withTrailingBlank.map((block) => block.kind)).toEqual(["paragraph", "hr", "paragraph"]);
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

describe("normalizeHelpBlockSource", () => {
  it("forces #helpend to be left-aligned without spaces or tabs", () => {
    const input = [
      "#help",
      "Inhalt",
      "   #helpend   ",
      "\t#helpend\t",
    ].join("\n");

    const normalized = normalizeHelpBlockSource(input);
    expect(normalized).toBe(
      [
        "#help",
        "Inhalt",
        "#helpend",
        "#helpend",
      ].join("\n"),
    );
  });

  it("removes blank lines directly before #helpend", () => {
    const input = [
      "#help",
      "Hint Zeile",
      "",
      "   ",
      "\t",
      "  #helpend  ",
    ].join("\n");

    const normalized = normalizeHelpBlockSource(input);
    expect(normalized).toBe(
      [
        "#help",
        "Hint Zeile",
        "#helpend",
      ].join("\n"),
    );
  });

  it("strips leading quote markers when #help/#helpend were quote-prefixed", () => {
    const input = [
      "> #help",
      "> Hinweis",
      "> #helpend",
    ].join("\n");

    const normalized = normalizeHelpBlockSource(input);
    expect(normalized).toBe(
      [
        "#help",
        "Hinweis",
        "#helpend",
      ].join("\n"),
    );
  });
});

describe("normalizeCardBlockSource", () => {
  it("normalizes quote-prefixed card markers to root-level markers", () => {
    expect(normalizeCardBlockSource("> #card")).toBe("#card");
    expect(normalizeCardBlockSource("> #endcard")).toBe("#endcard");
  });
});

describe("normalizeHorizontalRuleBlockSource", () => {
  it("normalizes hr blocks to exactly one blank line above and below", () => {
    expect(normalizeHorizontalRuleBlockSource("---")).toBe(["", "---", ""].join("\n"));
    expect(normalizeHorizontalRuleBlockSource(["", "", "---", "", ""].join("\n"))).toBe(
      ["", "---", ""].join("\n"),
    );
  });

  it("preserves the delimiter style while trimming outer whitespace", () => {
    expect(normalizeHorizontalRuleBlockSource("  ***  ")).toBe(["", "***", ""].join("\n"));
    expect(normalizeHorizontalRuleBlockSource(" ___ ")).toBe(["", "___", ""].join("\n"));
  });
});

describe("normalizeHorizontalRuleSpacingInMarkdown", () => {
  it("preserves leading frontmatter while normalizing body horizontal rules", () => {
    const input = [
      "---",
      "Section: IUFS",
      "Rank: SE1",
      "---",
      "A",
      "---",
      "B",
    ].join("\n");
    const normalized = normalizeHorizontalRuleSpacingInMarkdown(input);
    expect(normalized).toBe(
      [
        "---",
        "Section: IUFS",
        "Rank: SE1",
        "---",
        "A",
        "",
        "---",
        "",
        "B",
      ].join("\n"),
    );
    expect(normalized.startsWith("\n---")).toBe(false);
  });

  it("inserts missing blank lines around a horizontal rule", () => {
    const input = ["A", "---", "B"].join("\n");
    const normalized = normalizeHorizontalRuleSpacingInMarkdown(input);
    expect(normalized).toBe(["A", "", "---", "", "B"].join("\n"));
  });

  it("collapses multiple blank lines directly around a horizontal rule", () => {
    const input = ["A", "", "", "---", "", "", "B"].join("\n");
    const normalized = normalizeHorizontalRuleSpacingInMarkdown(input);
    expect(normalized).toBe(["A", "", "---", "", "B"].join("\n"));
  });

  it("does not treat --- inside code fences as horizontal rules", () => {
    const input = ["```txt", "---", "```"].join("\n");
    const normalized = normalizeHorizontalRuleSpacingInMarkdown(input);
    expect(normalized).toBe(input);
  });
});

describe("normalizeQuotePrefixedHashLines", () => {
  it("removes leading blockquote markers from lines starting with #", () => {
    const input = [
      "> # Überschrift",
      "> #helpHinweis",
      ">> #text",
      "> normal quote",
    ].join("\n");

    const normalized = normalizeQuotePrefixedHashLines(input);
    expect(normalized).toBe(
      [
        "# Überschrift",
        "#helpHinweis",
        "#text",
        "> normal quote",
      ].join("\n"),
    );
  });

  it("keeps quote-prefixed # lines unchanged inside fenced code blocks", () => {
    const input = [
      "```md",
      "> # heading in code",
      "```",
      "> # outside",
    ].join("\n");

    const normalized = normalizeQuotePrefixedHashLines(input);
    expect(normalized).toBe(
      [
        "```md",
        "> # heading in code",
        "```",
        "# outside",
      ].join("\n"),
    );
  });
});

describe("markdownBlocks Canvas blocks", () => {
  it("parses directive Canvas blocks as standalone hybrid blocks", () => {
    const markdown = [
      "Before",
      "#canvas",
      "{",
      "  \"nodes\": [],",
      "  \"edges\": []",
      "}",
      "#canvasend",
      "After",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "canvas-block",
      "paragraph",
    ]);
  });

  it("parses fenced canvas code blocks as Canvas hybrid blocks", () => {
    const markdown = [
      "```canvas",
      "{ \"nodes\": [], \"edges\": [] }",
      "```",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe("canvas-block");
  });
});
