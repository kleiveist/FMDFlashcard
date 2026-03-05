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
  normalizeInlineFormattingForPreview,
  normalizeTableSpacingForRender,
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
      "#endexam",
    ].join("\n");

    const output = applyInteractionSpacing(source);
    const lines = output.split("\n");

    expect(lines).toContain("---");
    expect(lines).toContain("-b");
    expect(lines.some((line) => line.trim() === "#card")).toBe(false);
    expect(lines.some((line) => line.trim() === "#")).toBe(false);

    const promptLine = lines.find((line) => line.startsWith("1\\) Prompt line"));
    expect(promptLine).toBe("1\\) Prompt line  ");

    const optionLine = lines.find((line) => line.startsWith("a) Option A"));
    expect(optionLine).toBe("a) Option A  ");

    const inlineIndex = lines.findIndex((line) =>
      line.startsWith("2\\) Inline markers"),
    );
    expect(inlineIndex).toBeGreaterThan(-1);
    expect(lines[inlineIndex].endsWith("  ")).toBe(true);
    expect(lines[inlineIndex + 1].trim()).toBe("-a #card final #");
  });
});

describe("normalizeTableSpacingForRender", () => {
  it("adds blank lines around valid table blocks", () => {
    const source = [
      "sinnvoll sind. Nutzen Sie eine saubere Gliederung.",
      "| Modell | Kerngedanke | Typischer Fokus |",
      "| --- | --- | --- |",
      "| ACID | Strikte Transaktionssicherheit | starke Konsistenz |",
      "| BASE | Eventual Consistency akzeptiert | hohe Verfuegbarkeit |",
      "#help",
    ].join("\n");

    const result = normalizeTableSpacingForRender(source);

    expect(result).toBe([
      "sinnvoll sind. Nutzen Sie eine saubere Gliederung.",
      "",
      "| Modell | Kerngedanke | Typischer Fokus |",
      "| --- | --- | --- |",
      "| ACID | Strikte Transaktionssicherheit | starke Konsistenz |",
      "| BASE | Eventual Consistency akzeptiert | hohe Verfuegbarkeit |",
      "",
      "#help",
    ].join("\n"));
  });

  it("does not change non-table pipe lines", () => {
    const source = [
      "A | B | C",
      "---",
      "| just text",
      "tail",
    ].join("\n");

    const result = normalizeTableSpacingForRender(source);

    expect(result).toBe(source);
  });

  it("adds blank lines around fenced code blocks", () => {
    const source = [
      "Vorher",
      "```http",
      "GET /book/1",
      "200 OK",
      "```",
      "Nachher",
    ].join("\n");

    const result = normalizeTableSpacingForRender(source);

    expect(result).toBe([
      "Vorher",
      "",
      "```http",
      "GET /book/1",
      "200 OK",
      "```",
      "",
      "Nachher",
    ].join("\n"));
  });
});

describe("normalizeInlineFormattingForPreview", () => {
  it("normalizes highlight, italic, underline, and bold+italic inline markers for preview rendering", () => {
    const source = [
      "a) ==OPTION== A",
      "b) *OPTION* B",
      "c) __OPTION__ C",
      "d) $OPTION$ D",
      "e) ***OPTION*** E",
    ].join("\n");

    const result = normalizeInlineFormattingForPreview(source);

    expect(result).toContain("a) <mark class=\"md-inline-highlight\">OPTION</mark> A");
    expect(result).toContain("b) <em>OPTION</em> B");
    expect(result).toContain("c) <u>OPTION</u> C");
    expect(result).toContain("d) $OPTION$ D");
    expect(result).toContain("e) <strong><em>OPTION</em></strong> E");
  });

  it("does not rewrite fenced or inline code segments", () => {
    const source = [
      "Inline `*NO_CHANGE* __NO_CHANGE__ ==NO_CHANGE==` end",
      "```",
      "*NO_CHANGE* __NO_CHANGE__ ==NO_CHANGE== $NO_CHANGE$ ***NO_CHANGE***",
      "```",
      "*CHANGE*",
    ].join("\n");

    const result = normalizeInlineFormattingForPreview(source);

    expect(result).toContain("Inline `*NO_CHANGE* __NO_CHANGE__ ==NO_CHANGE==` end");
    expect(result).toContain("*NO_CHANGE* __NO_CHANGE__ ==NO_CHANGE== $NO_CHANGE$ ***NO_CHANGE***");
    expect(result).toContain("<em>CHANGE</em>");
  });

  it("does not apply non-math inline formatting inside math delimiters", () => {
    const source = "Math $a*b$ and *italic*";
    const result = normalizeInlineFormattingForPreview(source);

    expect(result).toContain("$a*b$");
    expect(result).toContain("<em>italic</em>");
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
    ["#exam", "1) Prompt", "#endexam"].forEach((line) => {
      const div = document.createElement("div");
      div.textContent = line;
      container.appendChild(div);
    });

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("#exam\n1) Prompt\n#endexam\n");
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

  it("keeps edited list marker styles including 1) and task checkboxes", () => {
    const container = document.createElement("div");

    const ordered = document.createElement("ol");
    const orderedItem = document.createElement("li");
    const orderedMarker = document.createElement("span");
    orderedMarker.className = "md-list-marker";
    orderedMarker.textContent = "1) ";
    orderedItem.appendChild(orderedMarker);
    orderedItem.appendChild(document.createTextNode("Ordered"));
    ordered.appendChild(orderedItem);
    container.appendChild(ordered);

    const unordered = document.createElement("ul");
    const taskItem = document.createElement("li");
    const taskMarker = document.createElement("span");
    taskMarker.className = "md-list-marker";
    taskMarker.textContent = "- [x] ";
    taskItem.appendChild(taskMarker);
    taskItem.appendChild(document.createTextNode("Done"));
    unordered.appendChild(taskItem);
    container.appendChild(unordered);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toContain("1) Ordered");
    expect(result).toContain("- [x] Done");
  });

  it("uses ordered delimiter fallback from list data when marker spans are missing", () => {
    const container = document.createElement("div");
    const ordered = document.createElement("ol");
    ordered.setAttribute("data-md-ordered-delimiter", ")");

    const itemA = document.createElement("li");
    itemA.appendChild(document.createTextNode("Alpha"));
    const itemB = document.createElement("li");
    itemB.appendChild(document.createTextNode("Beta"));

    ordered.appendChild(itemA);
    ordered.appendChild(itemB);
    container.appendChild(ordered);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("1) Alpha\n2) Beta\n");
  });

  it("does not inject escaped list markers when serializing editable list marker spans", () => {
    const container = document.createElement("div");
    const list = document.createElement("ul");
    const item = document.createElement("li");
    const marker = document.createElement("span");
    marker.className = "md-list-marker";
    marker.textContent = "- ";
    item.appendChild(marker);
    item.appendChild(document.createTextNode("Alpha"));
    list.appendChild(item);
    container.appendChild(list);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("- Alpha\n");
    expect(result).not.toContain("\\-");
  });

  it("keeps edited code fence markers in markdown edit mode", () => {
    const container = document.createElement("div");
    const pre = document.createElement("pre");
    pre.setAttribute("data-md-code-block", "true");

    const openLine = document.createElement("span");
    openLine.className = "md-code-fence-line md-code-fence-open";
    const openMarker = document.createElement("span");
    openMarker.className = "md-code-fence-marker";
    openMarker.textContent = "```http";
    openLine.appendChild(openMarker);
    pre.appendChild(openLine);

    const code = document.createElement("code");
    code.textContent = "GET /book/1\n200 OK";
    pre.appendChild(code);

    const closeLine = document.createElement("span");
    closeLine.className = "md-code-fence-line md-code-fence-close";
    const closeMarker = document.createElement("span");
    closeMarker.className = "md-code-fence-marker";
    closeMarker.textContent = "```";
    closeLine.appendChild(closeMarker);
    pre.appendChild(closeLine);
    container.appendChild(pre);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("```http\nGET /book/1\n200 OK\n```\n");
  });

  it("serializes empty code blocks without inserting an inner blank line", () => {
    const container = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "";
    pre.appendChild(code);
    container.appendChild(pre);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("```\n```\n");
  });

  it("serializes empty editable code blocks without inner blank lines", () => {
    const container = document.createElement("div");
    const pre = document.createElement("pre");
    pre.setAttribute("data-md-code-block", "true");

    const openLine = document.createElement("span");
    openLine.className = "md-code-fence-line md-code-fence-open";
    const openMarker = document.createElement("span");
    openMarker.className = "md-code-fence-marker";
    openMarker.textContent = "```http";
    openLine.appendChild(openMarker);
    pre.appendChild(openLine);

    const code = document.createElement("code");
    code.textContent = "";
    pre.appendChild(code);

    const closeLine = document.createElement("span");
    closeLine.className = "md-code-fence-line md-code-fence-close";
    const closeMarker = document.createElement("span");
    closeMarker.className = "md-code-fence-marker";
    closeMarker.textContent = "```";
    closeLine.appendChild(closeMarker);
    pre.appendChild(closeLine);
    container.appendChild(pre);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe("```http\n```\n");
  });

  it("keeps a blank line before and after tables", () => {
    const container = document.createElement("div");
    const above = document.createElement("p");
    above.textContent = "Einleitung";
    const table = document.createElement("table");
    table.innerHTML = [
      "<thead><tr><th>Modell</th><th>Fokus</th></tr></thead>",
      "<tbody><tr><td>ACID</td><td>Konsistenz</td></tr></tbody>",
    ].join("");
    const below = document.createElement("p");
    below.textContent = "Nachsatz";
    container.appendChild(above);
    container.appendChild(table);
    container.appendChild(below);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe([
      "Einleitung",
      "",
      "| Modell | Fokus |",
      "| --- | --- |",
      "| ACID | Konsistenz |",
      "",
      "Nachsatz",
      "",
    ].join("\n"));
  });

  it("detaches table lines from numbered items and removes table indentation", () => {
    const container = document.createElement("div");
    const list = document.createElement("ol");
    const item = document.createElement("li");
    item.appendChild(document.createTextNode("Bestimmen Sie die Aussage"));
    item.appendChild(document.createElement("br"));
    item.appendChild(document.createTextNode("| Modell | Fokus |"));
    item.appendChild(document.createElement("br"));
    item.appendChild(document.createTextNode("| --- | --- |"));
    item.appendChild(document.createElement("br"));
    item.appendChild(document.createTextNode("| ACID | Konsistenz |"));
    list.appendChild(item);
    container.appendChild(list);

    const result = serializeMarkdownFromHtml(container);

    expect(result).toBe([
      "1. Bestimmen Sie die Aussage",
      "",
      "| Modell | Fokus |",
      "| --- | --- |",
      "| ACID | Konsistenz |",
      "",
    ].join("\n"));
    expect(result).not.toContain("  |");
    expect(result).not.toContain("\\|");
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

    expect(html).toContain("md-heading-marker");
    expect(html).toContain("## ");
    expect(html).toContain("Heading");
  });

  it("replaces horizontal rules with editable markdown markers", () => {
    const container = document.createElement("div");
    const rule = document.createElement("hr");
    container.appendChild(rule);

    const html = buildEditableMarkdownHtml(container);

    expect(html).toContain('data-md-hr-line="true"');
    expect(html).toContain("md-hr-marker");
    expect(html).toContain("---");
  });

  it("injects editable list markers for unordered, ordered and task list items", () => {
    const container = document.createElement("div");
    container.innerHTML = [
      "<ul><li>Bullet</li></ul>",
      "<ol start=\"3\"><li>Numbered</li></ol>",
      "<ul><li class=\"task-list-item\"><input type=\"checkbox\" checked>Done</li></ul>",
    ].join("");

    const html = buildEditableMarkdownHtml(container);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const markers = Array.from(
      wrapper.querySelectorAll<HTMLElement>("li > .md-list-marker"),
    ).map((marker) => marker.textContent);

    expect(markers).toContain("- ");
    expect(markers).toContain("3. ");
    expect(markers).toContain("- [x] ");
  });

  it("keeps ordered list marker delimiter from markdown source as 1)", () => {
    const container = document.createElement("div");
    container.innerHTML = "<ol><li>First</li></ol>";

    const html = buildEditableMarkdownHtml(container, "1) First");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const marker = wrapper.querySelector<HTMLElement>("li > .md-list-marker");

    expect(marker?.textContent).toBe("1) ");
  });

  it("keeps ordered delimiter attributes in markdown edit html", () => {
    const container = document.createElement("div");
    container.innerHTML = "<ol data-md-ordered-delimiter=\")\"><li>First</li></ol>";

    const html = buildEditableMarkdownHtml(container, "1) First");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const list = wrapper.querySelector("ol");
    const marker = wrapper.querySelector<HTMLElement>("li > .md-list-marker");

    expect(list?.getAttribute("data-md-ordered-delimiter")).toBe(")");
    expect(marker?.textContent).toBe("1) ");
  });

  it("injects editable code fence markers and keeps a copy control", () => {
    const container = document.createElement("div");
    container.innerHTML = [
      "<div class=\"md-code-block\">",
      "<button class=\"md-code-copy-button\" type=\"button\">copy</button>",
      "<pre><code>GET /book/1</code></pre>",
      "</div>",
    ].join("");

    const html = buildEditableMarkdownHtml(container, "```http\nGET /book/1\n```");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    const copyButton = wrapper.querySelector(".md-code-copy-button");
    const pre = wrapper.querySelector("pre[data-md-code-block=\"true\"]");
    const openMarker = wrapper.querySelector(
      "pre > .md-code-fence-open > .md-code-fence-marker",
    ) as HTMLElement | null;
    const closeMarker = wrapper.querySelector(
      "pre > .md-code-fence-close > .md-code-fence-marker",
    ) as HTMLElement | null;

    expect(copyButton).toBeTruthy();
    expect(pre).toBeTruthy();
    expect(openMarker?.textContent).toBe("```http");
    expect(closeMarker?.textContent).toBe("```");
  });
});
