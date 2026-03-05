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
});
