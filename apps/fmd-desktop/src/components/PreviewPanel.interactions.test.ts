// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/components/PreviewPanel.interactions.test.ts
 *
 * Zweck:
 * - Tests fuer edit-sichere Preview-Interaktionen und HTML-Sanitizing.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  createElement,
  useCallback,
  useState,
  type ReactElement,
} from "react";
import { createRoot } from "react-dom/client";
import { openUrl } from "@tauri-apps/plugin-opener";
import { PreviewPanel } from "./PreviewPanel";
import { type VaultFile } from "../lib/tree";

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

const openUrlMock = vi.mocked(openUrl);

const baseFile: VaultFile = {
  path: "/vault/Note.md",
  relative_path: "Note.md",
};

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

const buildHarness = (
  markdown: string,
  options: {
    markdownViewEditEnabled?: boolean;
    rawPreview?: boolean;
    onFrontmatterSave?: (nextPreview: string) => Promise<boolean>;
  } = {},
) => {
  const onEditExit = vi.fn();
  const {
    markdownViewEditEnabled = true,
    rawPreview = false,
    onFrontmatterSave,
  } = options;

  const Harness = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState(markdown);
    const [editCaretIndex, setEditCaretIndex] = useState<number | null>(null);

    const handleEditStart = useCallback(
      (options?: { caretIndex?: number | null }) => {
        setEditDraft(markdown);
        setEditCaretIndex(
          typeof options?.caretIndex === "number" ? options.caretIndex : null,
        );
        setIsEditing(true);
      },
      [markdown],
    );

    return createElement(PreviewPanel, {
      editDraft,
      editError: "",
      editCaretIndex,
      isEditing,
      emptyPreview: "",
      preview: markdown,
      previewError: "",
      previewState: "idle",
      rawPreview,
      markdownViewEditEnabled,
      selectedFile: baseFile,
      canEdit: true,
      onEditChange: setEditDraft,
      onEditCaretApplied: () => setEditCaretIndex(null),
      onEditExit,
      onEditStart: handleEditStart,
      onToggleRawPreview: () => {},
      onFrontmatterSave,
    });
  };

  const rendered = render(createElement(Harness));
  return { ...rendered, onEditExit };
};

let cleanup: (() => void) | null = null;

afterEach(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  openUrlMock.mockClear();
});

describe("PreviewPanel edit-safe interactions", () => {
  it("prevents normal link clicks from navigating while editing", () => {
    const { container, cleanup: localCleanup, onEditExit } = buildHarness(
      "Link: [Example](https://example.com)",
    );
    cleanup = localCleanup;

    const previewContent = container.querySelector(".preview-content");
    expect(previewContent).toBeTruthy();
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    const editor = container.querySelector(".preview.preview-editor.markdown");
    expect(editor).toBeTruthy();
    const editorLink = editor?.querySelector("a");
    expect(editorLink).toBeTruthy();

    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const dispatched = editorLink?.dispatchEvent(clickEvent);

    expect(dispatched).toBe(false);
    expect(openUrlMock).not.toHaveBeenCalled();
    expect(onEditExit).not.toHaveBeenCalled();
  });

  it("opens links with ctrl/cmd click", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      "Link: [Example](https://example.com)",
    );
    cleanup = localCleanup;

    const previewLink = container.querySelector(".preview.markdown a");
    expect(previewLink).toBeTruthy();

    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    const dispatched = previewLink?.dispatchEvent(clickEvent);

    expect(dispatched).toBe(false);
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/");
  });

  it("keeps image interactions from ending the edit session", () => {
    const { container, cleanup: localCleanup, onEditExit } = buildHarness(
      "![Alt](https://example.com/image.png)",
    );
    cleanup = localCleanup;

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    const editor = container.querySelector(".preview.preview-editor.markdown");
    const image = editor?.querySelector("img");

    expect(editor).toBeTruthy();
    expect(image).toBeTruthy();
    expect(image?.getAttribute("draggable")).toBe("false");

    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    image?.dispatchEvent(clickEvent);

    expect(openUrlMock).not.toHaveBeenCalled();
    expect(onEditExit).not.toHaveBeenCalled();
  });

  it("does not enter markdown edit mode when disabled", () => {
    const { container, cleanup: localCleanup } = buildHarness("Plain text", {
      markdownViewEditEnabled: false,
    });
    cleanup = localCleanup;

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    const editor = container.querySelector(".preview.preview-editor.markdown");
    expect(editor).toBeNull();
  });

  it("renders inline HTML tags after sanitization", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      "Inline <span class=\"tag\">Span</span><br>Line <sup>sup</sup> <sub>sub</sub> <kbd>Ctrl</kbd>",
    );
    cleanup = localCleanup;

    expect(container.querySelector("span")).toBeTruthy();
    expect(container.querySelector("br")).toBeTruthy();
    expect(container.querySelector("sup")).toBeTruthy();
    expect(container.querySelector("sub")).toBeTruthy();
    expect(container.querySelector("kbd")).toBeTruthy();
  });

  it("renders table blocks even when surrounding blank lines are missing", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      [
        "Before text",
        "| Modell | Fokus |",
        "| --- | --- |",
        "| ACID | Konsistenz |",
        "After text",
      ].join("\n"),
    );
    cleanup = localCleanup;

    const preview = container.querySelector(".preview.markdown");
    const table = preview?.querySelector("table");
    const paragraphs = Array.from(preview?.querySelectorAll("p") ?? []);

    expect(table).toBeTruthy();
    expect(paragraphs.some((paragraph) => paragraph.textContent?.trim() === "Before text")).toBe(
      true,
    );
    expect(paragraphs.some((paragraph) => paragraph.textContent?.trim() === "After text")).toBe(
      true,
    );
  });

  it("shows a properties panel and hides frontmatter text in markdown view", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      [
        "---",
        "title: Demo",
        "tags:",
        "  - alpha",
        "---",
        "# Body",
        "Visible text",
      ].join("\n"),
    );
    cleanup = localCleanup;

    const propertiesPanel = container.querySelector(".frontmatter-panel");
    const previewText = container.querySelector(".preview.markdown")?.textContent ?? "";

    expect(propertiesPanel).toBeTruthy();
    expect(previewText).toContain("Body");
    expect(previewText).toContain("Visible text");
    expect(previewText).not.toContain("title: Demo");
    expect(previewText).not.toContain("tags:");
  });

  it("keeps properties panel visible in markdown edit mode", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    expect(container.querySelector(".frontmatter-panel")).toBeTruthy();

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    const editor = container.querySelector(".preview.preview-editor.markdown");
    const panelWhileEditing = container.querySelector(".frontmatter-panel");

    expect(editor).toBeTruthy();
    expect(panelWhileEditing).toBeTruthy();
    expect(panelWhileEditing?.textContent ?? "").toContain("title");
  });

  it("applies edited heading level after leaving the heading line", async () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["## Titel", "", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    const editable = container.querySelector(
      ".preview-markdown-editable",
    ) as HTMLDivElement | null;
    const heading = editable?.querySelector("h2") as HTMLHeadingElement | null;
    const marker = heading?.querySelector(".md-heading-marker") as HTMLSpanElement | null;
    const headingTextNode = heading?.childNodes.item(1) ?? null;
    expect(editable).toBeTruthy();
    expect(heading).toBeTruthy();
    expect(marker).toBeTruthy();
    expect(headingTextNode).toBeTruthy();

    act(() => {
      if (!headingTextNode) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart(headingTextNode, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });

    act(() => {
      if (!marker) {
        return;
      }
      marker.textContent = "# ";
      marker.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(editable?.querySelector("h2")).toBeTruthy();
    expect(editable?.querySelector("h1")).toBeNull();

    const bodyParagraph = editable?.querySelector("p")?.firstChild ?? null;
    act(() => {
      if (!bodyParagraph) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart(bodyParagraph, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const promotedHeading = editable?.querySelector("h1") as HTMLHeadingElement | null;
    expect(promotedHeading).toBeTruthy();
    expect(promotedHeading?.textContent ?? "").toContain("Titel");
    expect(editable?.querySelector("h2")).toBeNull();
  });

  it("shows editable --- marker when a separator line is focused", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["A", "", "---", "", "B"].join("\n"),
    );
    cleanup = localCleanup;

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    const editable = container.querySelector(
      ".preview-markdown-editable",
    ) as HTMLDivElement | null;
    const hrLine = editable?.querySelector(
      '[data-md-hr-line="true"]',
    ) as HTMLParagraphElement | null;
    const marker = hrLine?.querySelector(".md-hr-marker") as HTMLSpanElement | null;

    expect(hrLine).toBeTruthy();
    expect(marker?.textContent).toBe("---");
    expect(hrLine?.hasAttribute("data-md-hr-active")).toBe(false);

    act(() => {
      const markerText = marker?.firstChild;
      if (!markerText) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart(markerText, markerText.textContent?.length ?? 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });

    expect(hrLine?.getAttribute("data-md-hr-active")).toBe("true");
  });

  it("keeps frontmatter collapsed when switching to markdown edit mode", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    const collapseButton = container.querySelector(
      ".frontmatter-collapse-button",
    ) as HTMLButtonElement | null;
    expect(collapseButton).toBeTruthy();

    act(() => {
      collapseButton?.click();
    });

    expect(container.querySelector(".frontmatter-grid")).toBeNull();
    expect(container.querySelector(".frontmatter-collapsed-hint")).toBeTruthy();

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    expect(container.querySelector(".preview.preview-editor.markdown")).toBeTruthy();
    expect(container.querySelector(".frontmatter-grid")).toBeNull();
    expect(container.querySelector(".frontmatter-collapsed-hint")).toBeTruthy();
  });

  it("shows an error panel for invalid frontmatter", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "Title: A", "Title: B", "---", "Body"].join("\n"),
    );
    cleanup = localCleanup;

    const errorPanel = container.querySelector(".frontmatter-panel-error");
    expect(errorPanel).toBeTruthy();
    expect(errorPanel?.textContent ?? "").toContain(
      "YAML-Frontmatter konnte nicht gelesen werden.",
    );
  });

  it("writes updated frontmatter values through save callback", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
    });
    cleanup = localCleanup;

    const input = container.querySelector(
      'input[aria-label="title value"]',
    ) as HTMLInputElement | null;
    expect(input).toBeTruthy();

    act(() => {
      if (!input) {
        return;
      }
      input.value = "Changed title";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      input?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onFrontmatterSave).toHaveBeenCalledTimes(1);
    const nextMarkdown = onFrontmatterSave.mock.calls[0]?.[0] ?? "";
    expect(nextMarkdown).toContain("title: Changed title");
    expect(nextMarkdown).toContain("---\nBody line");
  });

  it("can collapse and expand the properties panel", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    const collapseButton = container.querySelector(
      ".frontmatter-collapse-button",
    ) as HTMLButtonElement | null;
    expect(collapseButton).toBeTruthy();
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();

    act(() => {
      collapseButton?.click();
    });

    expect(container.querySelector(".frontmatter-grid")).toBeNull();
    expect(container.querySelector(".frontmatter-collapsed-hint")).toBeTruthy();

    act(() => {
      collapseButton?.click();
    });

    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();
  });

  it("collapses when clicking the Eigenschaften title", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    const titleButton = container.querySelector(
      ".frontmatter-title-button",
    ) as HTMLButtonElement | null;
    expect(titleButton).toBeTruthy();
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();

    act(() => {
      titleButton?.click();
    });

    expect(container.querySelector(".frontmatter-grid")).toBeNull();
    expect(container.querySelector(".frontmatter-collapsed-hint")).toBeTruthy();
  });

  it("reorders properties via drag and drop", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = [
      "---",
      "title: Demo",
      "rank: SE1",
      "section: IUFS",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
    });
    cleanup = localCleanup;

    const rankRow = container.querySelector(
      '[data-frontmatter-key="rank"]',
    ) as HTMLDivElement | null;
    const titleRow = container.querySelector(
      '[data-frontmatter-key="title"]',
    ) as HTMLDivElement | null;
    const rankHandle = rankRow?.querySelector(
      ".frontmatter-key",
    ) as HTMLDivElement | null;
    expect(rankRow).toBeTruthy();
    expect(titleRow).toBeTruthy();
    expect(rankHandle).toBeTruthy();

    act(() => {
      rankHandle?.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      titleRow?.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
      titleRow?.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      rankHandle?.dispatchEvent(new Event("dragend", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onFrontmatterSave).toHaveBeenCalledTimes(1);
    const nextMarkdown = onFrontmatterSave.mock.calls[0]?.[0] ?? "";
    expect(nextMarkdown).toContain("rank: SE1\ntitle: Demo\nsection: IUFS");
    expect(nextMarkdown).toContain("---\nBody line");
  });

  it("adds a new property via add button", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
    });
    cleanup = localCleanup;

    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    const valueInput = container.querySelector(
      'input[aria-label="Neuer Wert"]',
    ) as HTMLInputElement | null;
    const addButton = container.querySelector(
      ".frontmatter-add-button",
    ) as HTMLButtonElement | null;

    expect(keyInput).toBeTruthy();
    expect(valueInput).toBeTruthy();
    expect(addButton).toBeTruthy();

    act(() => {
      if (!keyInput || !valueInput) {
        return;
      }
      keyInput.value = "Section";
      keyInput.dispatchEvent(new Event("input", { bubbles: true }));
      valueInput.value = "IUFS";
      valueInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      addButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onFrontmatterSave).toHaveBeenCalledTimes(1);
    const nextMarkdown = onFrontmatterSave.mock.calls[0]?.[0] ?? "";
    expect(nextMarkdown).toContain("Section: IUFS");
    expect(nextMarkdown).toContain("---\nBody line");
  });
});
