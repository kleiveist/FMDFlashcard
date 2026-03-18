import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownBlocks } from "./MarkdownBlocks";

describe("MarkdownBlocks math rendering", () => {
  it("renders inline and display math in text blocks", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, { text: "Alpha $x$ Beta $$y$$ Omega" }),
    );

    expect(markup).toContain("md-math-inline");
    expect(markup).toContain("md-math-display-in-flow");
  });

  it("renders math in table cells", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "| A | B |",
          "| --- | --- |",
          "| $x$ | $$y$$ |",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("md-math-inline");
    expect(markup).toContain("md-math-display-in-flow");
  });

  it("renders obsidian PNG embeds in table cells as media blocks", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "| Visual | Description |",
          "| --- | --- |",
          "| ![[images/example.png]] | Diagram |",
        ].join("\n"),
        vaultPngAssets: [
          {
            path: "/vault/images/example.png",
            relative_path: "images/example.png",
            file_name: "example.png",
            extension: "png",
          },
        ],
      }),
    );

    expect(markup).toContain("flashcard-table-cell-media");
    expect(markup).toContain("md-table-cell-media");
    expect(markup).toContain("md-table-wrap");
    expect(markup).toContain("flashcard-media-image");
    expect(markup).not.toContain("![[images/example.png]]");
  });

  it("renders standalone markdown images in table cells", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "| Visual | Description |",
          "| --- | --- |",
          "| ![Alt](https://example.com/a.png) | Diagram |",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("flashcard-table-cell-image");
    expect(markup).toContain("md-table-cell-image");
    expect(markup).toContain("https://example.com/a.png");
  });

  it("does not render math inside inline-code or fenced code", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "Inline `$x$`",
          "",
          "```",
          "$y$",
          "```",
          "",
          "Visible $z$",
        ].join("\n"),
      }),
    );

    const inlineMathOccurrences = (markup.match(/md-math-inline/g) ?? []).length;
    expect(inlineMathOccurrences).toBe(1);
    expect(markup).toContain("flashcard-code-block");
  });

  it("shows fallback source and indicator when KaTeX fails", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, { text: "Broken $\\frac{1$" }),
    );

    expect(markup).toContain("md-math-fallback");
    expect(markup).toContain("md-math-fallback-source");
    expect(markup).toContain("md-math-fallback-badge");
  });

  it("parses language info from fenced code metadata", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "```ts title=demo.ts",
          "const value: number = 1;",
          "```",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("data-md-code-language=\"typescript\"");
    expect(markup).toContain("data-md-code-language-label=\"TypeScript\"");
  });

  it("renders interactive cloze placeholders inside fenced code blocks", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "```sql",
          "SELECT @@@CLOZE:first@@@, @@@CLOZE:second@@@;",
          "```",
        ].join("\n"),
        renderPlaceholder: (id) => createElement("span", { className: "cloze-blank" }, id),
      }),
    );

    expect(markup).toContain("flashcard-code-block");
    expect(markup).toContain("<code");
    expect(markup).toContain("<span class=\"cloze-blank\">first</span>");
    expect(markup).toContain("<span class=\"cloze-blank\">second</span>");
    expect(markup).not.toContain("@@@CLOZE:");
    expect(markup).toContain("data-md-code-highlighted=\"false\"");
  });

  it("keeps svg codeblocks interactive when cloze placeholders are present", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "```svg",
          "<svg><text>@@@CLOZE:token@@@</text></svg>",
          "```",
        ].join("\n"),
        renderPlaceholder: (id) => createElement("span", { className: "cloze-blank" }, id),
      }),
    );

    expect(markup).toContain("flashcard-code-block");
    expect(markup).toContain("<span class=\"cloze-blank\">token</span>");
    expect(markup).not.toContain("md-svg-preview-block");
  });

  it("renders inline markdown styles in text and lists", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "1. **Bold** item",
          "2. *Italic* and ~~Strike~~ and ==Mark==",
          "",
          "- **Nested** style",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("<ol");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<strong>Bold</strong>");
    expect(markup).toContain("<em>Italic</em>");
    expect(markup).toContain("<del>Strike</del>");
    expect(markup).toContain("<mark class=\"md-inline-highlight\">Mark</mark>");
  });

  it("preserves soft line breaks inside list items", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "1. First line",
          "   second line",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("<ol");
    expect(markup).toContain("<br");
  });

  it("preserves ordered-list ) delimiter metadata", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "1) Item A",
          "2) Item B",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("data-md-ordered-delimiter=\")\"");
  });

  it("renders cloze placeholders inside nested markdown lists", () => {
    const markup = renderToStaticMarkup(
      createElement(MarkdownBlocks, {
        text: [
          "1. **Prompt** @@@CLOZE:first@@@",
          "   - Child @@@CLOZE:child@@@",
        ].join("\n"),
        renderPlaceholder: (id) => createElement("span", { className: "cloze-blank" }, id),
      }),
    );

    expect(markup).toContain("<ol");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<strong>Prompt</strong>");
    expect(markup).toContain("<span class=\"cloze-blank\">first</span>");
    expect(markup).toContain("<span class=\"cloze-blank\">child</span>");
    expect(markup).not.toContain("@@@CLOZE:");
  });
});
