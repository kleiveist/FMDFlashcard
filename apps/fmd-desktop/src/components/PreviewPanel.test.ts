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
  buildEditableMarkdownHtml,
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

  it("ignores whitespace-only newline text nodes between block lines", () => {
    const container = document.createElement("div");
    const first = document.createElement("div");
    first.textContent = "a) A";
    const second = document.createElement("div");
    second.textContent = "b) B";
    const third = document.createElement("div");
    third.textContent = "c) C";

    container.appendChild(first);
    container.appendChild(document.createTextNode("\n"));
    container.appendChild(second);
    container.appendChild(document.createTextNode("\n  "));
    container.appendChild(third);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("a) A\nb) B\nc) C\n");
  });

  it("ignores duplicated newline text nodes around br markers", () => {
    const container = document.createElement("div");
    const paragraph = document.createElement("p");
    paragraph.appendChild(document.createTextNode("a) A"));
    paragraph.appendChild(document.createElement("br"));
    paragraph.appendChild(document.createTextNode("\nb) B"));
    paragraph.appendChild(document.createElement("br"));
    paragraph.appendChild(document.createTextNode("\nc) C"));
    container.appendChild(paragraph);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("a) A\nb) B\nc) C\n");
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

  it("keeps heading marker edits from markdown view", () => {
    const container = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = "# Neue Ebene";
    container.appendChild(heading);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("# Neue Ebene\n");
  });

  it("keeps heading level when marker is not edited", () => {
    const container = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = "Titel";
    container.appendChild(heading);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("### Titel\n");
  });

  it("does not force extra blank lines after lists in contentEditable mode", () => {
    const container = document.createElement("div");
    const list = document.createElement("ul");
    const itemA = document.createElement("li");
    const itemB = document.createElement("li");
    itemA.textContent = "A";
    itemB.textContent = "B";
    list.appendChild(itemA);
    list.appendChild(itemB);
    container.appendChild(list);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("- A\n- B\n");
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

describe("buildEditableMarkdownHtml", () => {
  it("removes frontmatter panel markup from markdown edit html", () => {
    const container = document.createElement("div");
    const panel = document.createElement("section");
    panel.className = "frontmatter-panel";
    panel.textContent = "title: Demo";
    const body = document.createElement("p");
    body.textContent = "Body";
    container.appendChild(panel);
    container.appendChild(body);

    const html = buildEditableMarkdownHtml(container);

    expect(html).not.toContain("frontmatter-panel");
    expect(html).toContain("Body");
  });

  it("injects editable heading markers for markdown edit mode", () => {
    const container = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = "Heading";
    container.appendChild(heading);

    const html = buildEditableMarkdownHtml(container);

    expect(html).toContain("## Heading");
  });
});
