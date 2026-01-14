/**
 * @file apps/fmd-desktop/src/components/HelpButton.test.tsx
 *
 * Zweck:
 * - Testet HelpButton Rendering und HelpPanel Markdown-Ausgabe.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HelpButton, HelpPanel } from "./HelpButton";

describe("HelpButton", () => {
  it("renders the help icon when enabled and content exists", () => {
    const markup = renderToStaticMarkup(
      createElement(HelpButton, { enabled: true, helpText: ["Hint text"] }),
    );

    expect(markup).toContain("help-button");
  });

  it("hides the help icon when disabled", () => {
    const markup = renderToStaticMarkup(
      createElement(HelpButton, { enabled: false, helpText: ["Hint text"] }),
    );

    expect(markup).toBe("");
  });

  it("renders markdown lists and tables in the help panel", () => {
    const helpContent = `- Item one
- Item two

| Key | Value |
| --- | --- |
| A | 1 |`;
    const markup = renderToStaticMarkup(
      createElement(HelpPanel, { helpBlocks: [helpContent] }),
    );

    expect(markup).toContain("<ul>");
    expect(markup).toContain("<table>");
  });
});
