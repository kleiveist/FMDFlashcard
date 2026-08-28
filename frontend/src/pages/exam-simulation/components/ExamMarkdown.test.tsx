/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamMarkdown.test.tsx
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExamMarkdown } from "./ExamMarkdown";

describe("ExamMarkdown", () => {
  it("renders obsidian png embeds inside table cells as images", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamMarkdown, {
        content: [
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

    expect(markup).toContain("flashcard-media-image");
    expect(markup).toContain("exam-table-cell-media");
    expect(markup).toContain("md-table-cell-media");
    expect(markup).toContain("md-table-wrap");
    expect(markup).not.toContain("![[images/example.png]]");
  });

  it("renders markdown image syntax inside table cells", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamMarkdown, {
        content: [
          "| Visual | Description |",
          "| --- | --- |",
          "| ![Alt](https://example.com/a.png) | Diagram |",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("exam-table-cell-image");
    expect(markup).toContain("md-table-cell-image");
    expect(markup).toContain("https://example.com/a.png");
  });

  it("renders inline markdown styles and list formatting", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamMarkdown, {
        content: [
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
      createElement(ExamMarkdown, {
        content: [
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
      createElement(ExamMarkdown, {
        content: [
          "1) Item A",
          "2) Item B",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("data-md-ordered-delimiter=\")\"");
  });

  it("hides #exam wrapper directives from rendered output", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamMarkdown, {
        content: [
          "#exam",
          "1) Prompt text",
          "#endexam",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("Prompt text");
    expect(markup).not.toContain("#exam");
    expect(markup).not.toContain("#endexam");
  });

  it("does not render global app navigation markup inside exam content", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamMarkdown, {
        content: [
          "<aside id=\"app-sidebar\" class=\"sidebar\" aria-label=\"Primary navigation\">",
          "<nav>Hidden global nav</nav>",
          "</aside>",
          "",
          "Visible exam content",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("Visible exam content");
    expect(markup).not.toContain("Hidden global nav");
    expect(markup).not.toContain("app-sidebar");
    expect(markup).not.toContain("Primary navigation");
  });
});
