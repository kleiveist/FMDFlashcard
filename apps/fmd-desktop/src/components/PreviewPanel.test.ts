// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/components/PreviewPanel.test.ts
 *
 * Zweck:
 * - Tests fuer PreviewPanel Markdown-Hilfslogik.
 */

import { describe, expect, it } from "vitest";
import {
  applyInteractionSpacing,
  canStartPreviewEdit,
  serializeMarkdownFromHtml,
} from "./PreviewPanel";

describe("applyInteractionSpacing", () => {
  it("preserves hard breaks and keeps markers on their own lines", () => {
    const source = [
      "#exam",
      "1) Prompt line",
      "a) Option A  ",
      "b) Option B  ",
      "-b",
      "---",
      "2) Inline markers -a #card final #",
      "#examend",
    ].join("\n");

    const output = applyInteractionSpacing(source);
    const lines = output.split("\n");

    expect(lines).toContain("---");
    expect(lines).toContain("-b");
    expect(lines.some((line) => line.trim() === "#card")).toBe(true);
    expect(lines.some((line) => line.trim() === "#")).toBe(true);

    const promptLine = lines.find((line) => line.startsWith("1\\) Prompt line"));
    expect(promptLine).toBe("1\\) Prompt line  ");

    const optionLine = lines.find((line) => line.startsWith("a) Option A"));
    expect(optionLine).toBe("a) Option A  ");

    const inlineIndex = lines.findIndex((line) =>
      line.startsWith("2\\) Inline markers"),
    );
    expect(inlineIndex).toBeGreaterThan(-1);
    expect(lines[inlineIndex].endsWith("  ")).toBe(true);
    expect(lines[inlineIndex + 1].trim()).toBe("-a");
  });
});

describe("serializeMarkdownFromHtml", () => {
  it("serializes contentEditable div lines without extra blank lines", () => {
    const container = document.createElement("div");
    ["a) A", "b) B", "-b", "-c"].forEach((line) => {
      const div = document.createElement("div");
      div.textContent = line;
      container.appendChild(div);
    });

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("a) A\nb) B\n-b\n-c\n");
  });

  it("serializes contentEditable p lines without extra blank lines", () => {
    const container = document.createElement("div");
    ["a) A", "b) B", "-b", "-c"].forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      container.appendChild(p);
    });

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("a) A\nb) B\n-b\n-c\n");
  });

  it("keeps intentional blank lines from empty paragraphs", () => {
    const container = document.createElement("div");
    const first = document.createElement("p");
    first.textContent = "a) A";
    const gap = document.createElement("p");
    gap.appendChild(document.createElement("br"));
    const second = document.createElement("p");
    second.textContent = "b) B";
    container.appendChild(first);
    container.appendChild(gap);
    container.appendChild(second);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("a) A\n\nb) B\n");
  });

  it("preserves FMD directive markers without escaping", () => {
    const container = document.createElement("div");
    ["#exam", "1) Prompt", "#examend"].forEach((line) => {
      const div = document.createElement("div");
      div.textContent = line;
      container.appendChild(div);
    });

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("#exam\n1) Prompt\n#examend\n");
    expect(result).not.toContain("\\#");
  });
});

describe("canStartPreviewEdit", () => {
  it("allows raw preview editing when markdown view editing is disabled", () => {
    expect(
      canStartPreviewEdit({
        rawPreview: true,
        markdownViewEditEnabled: false,
      }),
    ).toBe(true);
  });

  it("blocks markdown preview editing when disabled", () => {
    expect(
      canStartPreviewEdit({
        rawPreview: false,
        markdownViewEditEnabled: false,
      }),
    ).toBe(false);
  });
});
