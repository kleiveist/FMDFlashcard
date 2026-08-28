// @vitest-environment jsdom
/**
 * @file frontend/src/components/HelpButton.test.tsx
 *
 * Zweck:
 * - Testet HelpButton Rendering und HelpPanel Markdown-Ausgabe.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { HelpButton, HelpPanel } from "./HelpButton";

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

const render = (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

let cleanup: (() => void) | null = null;

afterEach(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  document.querySelectorAll(".modal-backdrop").forEach((node) => node.remove());
});

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

  it("renders png embeds and markdown images inside help-table cells", () => {
    const helpContent = `| Visual | Description |
| --- | --- |
| ![[images/example.png]] | Embed |
| ![Alt](https://example.com/a.png) | Markdown image |`;
    const markup = renderToStaticMarkup(
      createElement(HelpPanel, {
        helpBlocks: [helpContent],
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

    expect(markup).toContain("help-table-cell-media");
    expect(markup).toContain("flashcard-media-image");
    expect(markup).toContain("https://example.com/a.png");
    expect(markup).not.toContain("![[images/example.png]]");
  });

  it("masks bracket tokens in normal text and table cells without showing delimiters", () => {
    const helpContent = [
      "Schema: [CREATE TABLE] [ FOREIGN ] [A][B]",
      "",
      "| Feld | Regel |",
      "| --- | --- |",
      "| id | [NOT NULL] [ UNIQUE ] |",
    ].join("\n");
    const markup = renderToStaticMarkup(
      createElement(HelpPanel, { helpBlocks: [helpContent] }),
    );

    expect(markup.match(/class="help-inline-mask/g)?.length ?? 0).toBe(6);
    expect(markup).toContain(">CREATE TABLE<");
    expect(markup).toContain(">FOREIGN<");
    expect(markup).toContain(">NOT NULL<");
    expect(markup).toContain(">UNIQUE<");
    expect(markup).not.toContain("[CREATE TABLE]");
    expect(markup).not.toContain("[NOT NULL]");
  });

  it("masks bracket tokens in headings without showing delimiters", () => {
    const helpContent = "## Hinweis [WICHTIG]";
    const markup = renderToStaticMarkup(
      createElement(HelpPanel, { helpBlocks: [helpContent] }),
    );

    expect(markup).toContain(">WICHTIG<");
    expect(markup).not.toContain("[WICHTIG]");
    expect(markup).toContain("class=\"help-inline-mask");
  });

  it("keeps inline and fenced code with bracket text unchanged", () => {
    const helpContent = [
      "Reveal [VISIBLE]",
      "",
      "`[INLINE_CODE]`",
      "",
      "```txt",
      "[FENCED_CODE]",
      "```",
    ].join("\n");
    const markup = renderToStaticMarkup(
      createElement(HelpPanel, { helpBlocks: [helpContent] }),
    );

    expect(markup).toContain(">VISIBLE<");
    expect(markup).toContain("[INLINE_CODE]");
    expect(markup).toContain("[FENCED_CODE]");
    expect(markup).not.toContain("[VISIBLE]");
  });

  it("supports single-active click reveal, toggle-off and outside close in help modal", () => {
    const { container, cleanup: localCleanup } = render(
      createElement(HelpButton, {
        enabled: true,
        helpText: ["Alpha [ONE] [TWO]"],
      }),
    );
    cleanup = localCleanup;

    const trigger = container.querySelector<HTMLButtonElement>("button.help-button");
    expect(trigger).toBeTruthy();
    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const queryMasks = () =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".help-inline-mask"));
    const getMask = (index: number) => queryMasks()[index];

    expect(queryMasks()).toHaveLength(2);

    expect(getMask(0)).toBeTruthy();
    expect(getMask(1)).toBeTruthy();

    act(() => {
      const firstMask = getMask(0);
      firstMask?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      firstMask?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(queryMasks()[0]?.classList.contains("is-active")).toBe(true);
    expect(queryMasks()[1]?.classList.contains("is-active")).toBe(false);

    act(() => {
      const firstMask = getMask(0);
      firstMask?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      firstMask?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(queryMasks()[0]?.classList.contains("is-active")).toBe(false);

    act(() => {
      const secondMask = getMask(1);
      secondMask?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      secondMask?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(queryMasks()[0]?.classList.contains("is-active")).toBe(false);
    expect(queryMasks()[1]?.classList.contains("is-active")).toBe(true);

    const heading = document.querySelector(".help-modal-panel h3");
    expect(heading).toBeTruthy();
    act(() => {
      heading?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(queryMasks()[1]?.classList.contains("is-active")).toBe(false);

    act(() => {
      const secondMask = getMask(1);
      secondMask?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      secondMask?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(queryMasks()[1]?.classList.contains("is-active")).toBe(true);

    const backdrop = document.querySelector(".help-modal-backdrop");
    expect(backdrop).toBeTruthy();
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(queryMasks()[1]?.classList.contains("is-active")).toBe(false);
  });
});
