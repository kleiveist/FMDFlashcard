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

  it("keeps dot-delimited numeric lines as plain text", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamMarkdown, {
        content: ["1. Alpha", "2. Beta"].join("\n"),
      }),
    );

    expect(markup).not.toContain("<ol>");
    expect(markup).toContain("1. Alpha");
    expect(markup).toContain("2. Beta");
  });
});
