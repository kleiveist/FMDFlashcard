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
import { type VaultFile, type VaultPngAsset } from "../lib/tree";

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

const openUrlMock = vi.mocked(openUrl);
const originalMatchMedia = window.matchMedia;

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

const withImmediateRaf = <T,>(run: () => T) => {
  const originalRaf = window.requestAnimationFrame;
  const originalCancelRaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;
  const restore = () => {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  };
  try {
    const result = run();
    if (result instanceof Promise) {
      return result.finally(() => {
        restore();
      }) as T;
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
};

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const activateHybridBlockEditor = (container: ParentNode, index = 0) => {
  const block = container.querySelector<HTMLElement>(
    `.markdown-hybrid-block[data-md-block-index='${index}']`,
  );
  act(() => {
    block?.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
      }),
    );
  });
  return container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
};

const applyTextareaInput = (
  textarea: HTMLTextAreaElement | null,
  nextValue: string,
  caret = nextValue.length,
) => {
  act(() => {
    if (!textarea) {
      return;
    }
    textarea.value = nextValue;
    textarea.setSelectionRange(caret, caret);
    textarea.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  });
};

const flushAsyncInteraction = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

const buildHarness = (
  markdown: string,
  options: {
    markdownViewEditEnabled?: boolean;
    rawPreview?: boolean;
    onFrontmatterSave?: (nextPreview: string) => Promise<boolean>;
    onNavigateWikilink?: (wikilink: string) => void;
    valueSuggestionsByKey?: Record<string, string[]>;
    keySuggestions?: string[];
    vaultFiles?: VaultFile[];
    vaultPngAssets?: VaultPngAsset[];
    vaultPath?: string;
  } = {},
) => {
  const onEditExit = vi.fn();
  const {
    markdownViewEditEnabled = true,
    rawPreview = false,
    onFrontmatterSave,
    onNavigateWikilink,
    valueSuggestionsByKey,
    keySuggestions,
    vaultFiles,
    vaultPngAssets,
    vaultPath = "/vault",
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
      vaultPath,
      sourceRelativePath: baseFile.relative_path,
      vaultFiles,
      vaultPngAssets,
      canEdit: true,
      onEditChange: setEditDraft,
      onEditCaretApplied: () => setEditCaretIndex(null),
      onEditExit,
      onEditStart: handleEditStart,
      onToggleRawPreview: () => {},
      onFrontmatterSave,
      onNavigateWikilink,
      valueSuggestionsByKey,
      keySuggestions,
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
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
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

  it("keeps the hybrid edit mode toggle state when switching markdown files", async () => {
    const secondFile: VaultFile = {
      path: "/vault/Second.md",
      relative_path: "Second.md",
    };

    const Harness = () => {
      const [selectedFile, setSelectedFile] = useState<VaultFile>(baseFile);
      const [previewMarkdown, setPreviewMarkdown] = useState("First note");
      const [editDraft, setEditDraft] = useState("First note");

      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "switch-file",
            onClick: () => {
              setSelectedFile(secondFile);
              setPreviewMarkdown("Second note");
              setEditDraft("Second note");
            },
          },
          "Switch file",
        ),
        createElement(PreviewPanel, {
          editDraft,
          editError: "",
          editCaretIndex: null,
          isEditing: false,
          emptyPreview: "",
          preview: previewMarkdown,
          previewError: "",
          previewState: "idle",
          rawPreview: false,
          markdownViewEditEnabled: true,
          markdownHybridEnabled: true,
          selectedFile,
          vaultPath: "/vault",
          sourceRelativePath: selectedFile.relative_path,
          canEdit: true,
          onEditChange: setEditDraft,
          onEditCaretApplied: () => {},
          onEditExit: async () => {},
          onEditStart: () => {},
          onToggleRawPreview: () => {},
        }),
      );
    };

    const { container, cleanup: localCleanup } = render(createElement(Harness));
    cleanup = localCleanup;

    const editToggleBefore = container.querySelector(
      'button[aria-label="Edit mode"]',
    ) as HTMLButtonElement | null;
    expect(editToggleBefore).toBeTruthy();
    expect(editToggleBefore?.disabled).toBe(false);
    expect(editToggleBefore?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      editToggleBefore?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsyncInteraction();

    const editToggleAfterDisable = container.querySelector(
      'button[aria-label="Edit mode"]',
    ) as HTMLButtonElement | null;
    expect(editToggleAfterDisable?.getAttribute("aria-pressed")).toBe("false");

    const switchFileButton = container.querySelector(
      'button[data-testid="switch-file"]',
    ) as HTMLButtonElement | null;
    expect(switchFileButton).toBeTruthy();

    act(() => {
      switchFileButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const editToggleAfterSwitch = container.querySelector(
      'button[aria-label="Edit mode"]',
    ) as HTMLButtonElement | null;
    expect(editToggleAfterSwitch).toBeTruthy();
    expect(editToggleAfterSwitch?.getAttribute("aria-pressed")).toBe("false");
  });

  it("commits the active hybrid draft before write-save runs", async () => {
    await withImmediateRaf(async () => {
      const saveCalls: string[] = [];

      const Harness = () => {
        const [editDraft, setEditDraft] = useState("Alpha");
        return createElement(
          "div",
          null,
          createElement("div", { "data-testid": "draft" }, editDraft),
          createElement(PreviewPanel, {
            editDraft,
            editError: "",
            editCaretIndex: null,
            isEditing: false,
            emptyPreview: "",
            preview: "Alpha",
            previewError: "",
            previewState: "idle",
            rawPreview: false,
            markdownViewEditEnabled: true,
            markdownHybridEnabled: true,
            documentMode: "write",
            selectedFile: baseFile,
            vaultPath: "/vault",
            sourceRelativePath: baseFile.relative_path,
            canEdit: true,
            onEditChange: setEditDraft,
            onHybridDirtyChange: () => {},
            onEditCaretApplied: () => {},
            onEditExit: async () => true,
            onEditStart: () => {},
            onToggleRawPreview: () => {},
            onWriteSave: () => {
              saveCalls.push(editDraft);
            },
          }),
        );
      };

      const { container, cleanup: localCleanup } = render(createElement(Harness));
      cleanup = localCleanup;

      const draftValue = () => container.querySelector("[data-testid='draft']")?.textContent ?? "";
      const textarea = activateHybridBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha\nBeta");
      expect(draftValue()).toBe("Alpha");

      const saveButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Save",
      );
      expect(saveButton).toBeTruthy();

      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await flushAsyncInteraction();

      expect(draftValue()).toBe("Alpha\nBeta");
      expect(saveCalls).toEqual(["Alpha\nBeta"]);
    });
  });

  it("commits the active hybrid draft before toggling hybrid edit mode off", async () => {
    await withImmediateRaf(async () => {
      const Harness = () => {
        const [editDraft, setEditDraft] = useState("Alpha");
        return createElement(
          "div",
          null,
          createElement("div", { "data-testid": "draft" }, editDraft),
          createElement(PreviewPanel, {
            editDraft,
            editError: "",
            editCaretIndex: null,
            isEditing: false,
            emptyPreview: "",
            preview: "Alpha",
            previewError: "",
            previewState: "idle",
            rawPreview: false,
            markdownViewEditEnabled: true,
            markdownHybridEnabled: true,
            selectedFile: baseFile,
            vaultPath: "/vault",
            sourceRelativePath: baseFile.relative_path,
            canEdit: true,
            onEditChange: setEditDraft,
            onHybridDirtyChange: () => {},
            onEditCaretApplied: () => {},
            onEditExit: async () => true,
            onEditStart: () => {},
            onToggleRawPreview: () => {},
          }),
        );
      };

      const { container, cleanup: localCleanup } = render(createElement(Harness));
      cleanup = localCleanup;

      const draftValue = () => container.querySelector("[data-testid='draft']")?.textContent ?? "";
      const textarea = activateHybridBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha\nBeta");
      expect(draftValue()).toBe("Alpha");

      const editToggle = container.querySelector(
        'button[aria-label="Edit mode"]',
      ) as HTMLButtonElement | null;
      expect(editToggle?.getAttribute("aria-pressed")).toBe("true");

      await act(async () => {
        editToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await flushAsyncInteraction();

      expect(draftValue()).toBe("Alpha\nBeta");
      expect(editToggle?.getAttribute("aria-pressed")).toBe("false");
      expect(container.querySelector(".markdown-hybrid-block-editor")).toBeNull();
    });
  });

  it("commits the active hybrid draft before switching from markdown view to code view", async () => {
    await withImmediateRaf(async () => {
      const Harness = () => {
        const [editDraft, setEditDraft] = useState("Alpha");
        const [rawPreview, setRawPreview] = useState(false);
        const [isEditing, setIsEditing] = useState(false);
        return createElement(
          "div",
          null,
          createElement("div", { "data-testid": "draft" }, editDraft),
          createElement(PreviewPanel, {
            editDraft,
            editError: "",
            editCaretIndex: null,
            isEditing,
            emptyPreview: "",
            preview: "Alpha",
            previewError: "",
            previewState: "idle",
            rawPreview,
            markdownViewEditEnabled: true,
            markdownHybridEnabled: true,
            selectedFile: baseFile,
            vaultPath: "/vault",
            sourceRelativePath: baseFile.relative_path,
            canEdit: true,
            onEditChange: setEditDraft,
            onHybridDirtyChange: () => {},
            onEditCaretApplied: () => {},
            onEditExit: async () => {
              setIsEditing(false);
              return true;
            },
            onEditStart: () => {
              setIsEditing(true);
            },
            onToggleRawPreview: () => {
              setRawPreview((current) => !current);
            },
          }),
        );
      };

      const { container, cleanup: localCleanup } = render(createElement(Harness));
      cleanup = localCleanup;

      const draftValue = () => container.querySelector("[data-testid='draft']")?.textContent ?? "";
      const textarea = activateHybridBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha\nBeta");
      expect(draftValue()).toBe("Alpha");

      const codeViewButton = container.querySelector(
        'button[aria-label="Code view"]',
      ) as HTMLButtonElement | null;
      expect(codeViewButton).toBeTruthy();

      await act(async () => {
        codeViewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await flushAsyncInteraction();
      await flushAsyncInteraction();

      expect(draftValue()).toBe("Alpha\nBeta");
      const rawEditor = container.querySelector<HTMLTextAreaElement>("textarea.preview-editor");
      expect(rawEditor?.value).toBe("Alpha\nBeta");
    });
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

  it("renders svg fences as preview blocks with a code toggle", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      [
        "```svg",
        "<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>",
        "```",
      ].join("\n"),
    );
    cleanup = localCleanup;

    expect(container.querySelector(".svg-preview-surface svg")).toBeTruthy();
    const toggleButton = container.querySelector<HTMLButtonElement>(
      ".svg-preview-toolbar button",
    );
    expect(toggleButton?.textContent).toBe("Code");

    act(() => {
      toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const codeBlock = container.querySelector(".flashcard-code-block.language-svg");
    expect(codeBlock?.textContent ?? "").toContain("<svg viewBox=\"0 0 10 10\">");
  });

  it("falls back to code with a visible invalid badge for invalid svg fences", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["```svg", "<div>bad</div>", "```"].join("\n"),
    );
    cleanup = localCleanup;

    expect(container.querySelector(".svg-preview-surface svg")).toBeNull();
    expect(container.textContent).toContain("SVG invalid");
    expect(container.querySelector(".flashcard-code-block.language-svg")?.textContent).toContain(
      "<div>bad</div>",
    );
  });

  it("renders preview-mode table cells with the shared table cell wrapper", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      [
        "| A | B |",
        "| --- | --- |",
        "| Erste Zeile<br>Zweite Zeile | Wert |",
      ].join("\n"),
    );
    cleanup = localCleanup;

    const firstBodyCell = container.querySelector(".markdown-table tbody td");
    expect(firstBodyCell).toBeTruthy();
    expect(firstBodyCell?.querySelector(".markdown-table-cell-preview")).toBeTruthy();
    expect(firstBodyCell?.querySelectorAll(".markdown-table-cell-paragraph")).toHaveLength(1);
    expect(firstBodyCell?.querySelectorAll("br")).toHaveLength(1);
  });

  it("renders double table cell breaks as separate paragraphs in preview mode", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      [
        "| A | B |",
        "| --- | --- |",
        "| Erste Zeile<br><br>Zweite Zeile | Wert |",
      ].join("\n"),
    );
    cleanup = localCleanup;

    const firstBodyCell = container.querySelector(".markdown-table tbody td");
    expect(firstBodyCell).toBeTruthy();
    const paragraphs = firstBodyCell?.querySelectorAll(".markdown-table-cell-paragraph");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs?.[0]?.textContent).toContain("Erste Zeile");
    expect(paragraphs?.[1]?.textContent).toContain("Zweite Zeile");
  });

  it("renders details/summary blocks after sanitization", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      "<details><summary>Toggle title</summary>Toggle content</details>",
    );
    cleanup = localCleanup;

    const preview = container.querySelector(".preview.markdown");
    expect(preview?.querySelector("details")).toBeTruthy();
    expect(preview?.querySelector("summary")).toBeTruthy();
    expect(preview?.textContent ?? "").toContain("Toggle title");
    expect(preview?.textContent ?? "").toContain("Toggle content");
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

  it("renders 1) markers as ordered list items", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["1) Erste", "2) Zweite"].join("\n"),
    );
    cleanup = localCleanup;

    const orderedList = container.querySelector('.preview.markdown ol[data-md-ordered-delimiter=")"]');
    const orderedItems = container.querySelectorAll(".preview.markdown ol > li");
    expect(orderedList).toBeTruthy();
    expect(orderedItems.length).toBe(2);
    expect(orderedItems[0]?.textContent ?? "").toContain("Erste");
    expect(orderedItems[1]?.textContent ?? "").toContain("Zweite");
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

  it("toggles the properties panel on desktop", () => {
    mockMatchMedia(false);
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    const collapseButton = container.querySelector(
      'button[aria-label="Eigenschaften einklappen"]',
    ) as HTMLButtonElement | null;
    expect(collapseButton).toBeTruthy();
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();

    act(() => {
      collapseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".frontmatter-grid")).toBeNull();

    const expandButton = container.querySelector(
      'button[aria-label="Eigenschaften aufklappen"]',
    ) as HTMLButtonElement | null;
    expect(expandButton).toBeTruthy();

    act(() => {
      expandButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();
  });

  it("starts collapsed on mobile and opens/closes via the collapse button", () => {
    mockMatchMedia(true);
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    expect(container.querySelector(".frontmatter-grid")).toBeNull();

    const expandButton = container.querySelector(
      'button[aria-label="Eigenschaften aufklappen"]',
    ) as HTMLButtonElement | null;
    expect(expandButton).toBeTruthy();

    act(() => {
      expandButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();

    const collapseButton = container.querySelector(
      'button[aria-label="Eigenschaften einklappen"]',
    ) as HTMLButtonElement | null;
    expect(collapseButton).toBeTruthy();

    act(() => {
      collapseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".frontmatter-grid")).toBeNull();
  });

  it("toggles the mobile properties panel via the title button", () => {
    mockMatchMedia(true);
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    const titleButton = container.querySelector(
      ".frontmatter-title-button",
    ) as HTMLButtonElement | null;
    expect(titleButton).toBeTruthy();
    expect(titleButton?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      titleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(titleButton?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();

    act(() => {
      titleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(titleButton?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".frontmatter-grid")).toBeNull();
  });

  it("keeps the mobile properties toggle interactive after entering markdown edit mode", () => {
    mockMatchMedia(true);
    const { container, cleanup: localCleanup } = buildHarness(
      ["---", "title: Demo", "---", "Body line"].join("\n"),
    );
    cleanup = localCleanup;

    const titleButton = container.querySelector(
      ".frontmatter-title-button",
    ) as HTMLButtonElement | null;
    expect(titleButton).toBeTruthy();

    act(() => {
      titleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 }),
      );
    });

    expect(container.querySelector(".preview.preview-editor.markdown")).toBeTruthy();
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();

    const editModeTitleButton = container.querySelector(
      ".frontmatter-title-button",
    ) as HTMLButtonElement | null;
    expect(editModeTitleButton).toBeTruthy();

    act(() => {
      editModeTitleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".frontmatter-grid")).toBeNull();

    const reopenedTitleButton = container.querySelector(
      ".frontmatter-title-button",
    ) as HTMLButtonElement | null;
    expect(reopenedTitleButton).toBeTruthy();

    act(() => {
      reopenedTitleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".frontmatter-grid")).toBeTruthy();
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

  it("shows editable ``` markers when a code block is focused", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["```http", "GET /book/1", "200 OK", "```", "", "Tail"].join("\n"),
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
    const codeBlock = editable?.querySelector(
      'pre[data-md-code-block="true"]',
    ) as HTMLElement | null;
    const openMarker = codeBlock?.querySelector(
      ".md-code-fence-open > .md-code-fence-marker",
    ) as HTMLElement | null;
    const closeMarker = codeBlock?.querySelector(
      ".md-code-fence-close > .md-code-fence-marker",
    ) as HTMLElement | null;
    const codeTextNode = codeBlock?.querySelector("code")?.firstChild ?? null;
    const paragraphTextNode = editable?.querySelector("p")?.firstChild ?? null;

    expect(codeBlock).toBeTruthy();
    expect(openMarker?.textContent).toBe("```http");
    expect(closeMarker?.textContent).toBe("```");
    expect(codeBlock?.hasAttribute("data-md-code-active")).toBe(false);

    act(() => {
      if (!codeTextNode) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart(codeTextNode, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });

    expect(codeBlock?.getAttribute("data-md-code-active")).toBe("true");

    act(() => {
      if (!paragraphTextNode) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart(paragraphTextNode, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });

    expect(codeBlock?.hasAttribute("data-md-code-active")).toBe(false);
  });

  it("moves Enter inside a list item to a root paragraph in markdown edit mode", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["1) Alpha", "2) Beta"].join("\n"),
    );
    cleanup = localCleanup;

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    });

    const editable = container.querySelector(
      ".preview-markdown-editable",
    ) as HTMLDivElement | null;
    const firstItem = editable?.querySelector("ol > li") as HTMLLIElement | null;
    const firstTextNode = firstItem?.childNodes.item(1) as Text | null;

    expect(editable).toBeTruthy();
    expect(firstItem).toBeTruthy();
    expect(firstTextNode).toBeTruthy();

    act(() => {
      if (!firstTextNode) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart(firstTextNode, 2);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      editable?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
    });

    const rootOrderedList = editable?.firstElementChild;
    const rootParagraph = editable?.lastElementChild;

    expect(rootOrderedList).toBeTruthy();
    expect(rootParagraph).toBeTruthy();
    expect(rootParagraph?.textContent ?? "").toContain("pha");
  });

  it("indents selected list items with Tab in markdown edit mode", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["1) Alpha", "2) Beta", "3) Gamma"].join("\n"),
    );
    cleanup = localCleanup;

    const previewContent = container.querySelector(".preview-content");
    act(() => {
      previewContent?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    });

    const editable = container.querySelector(
      ".preview-markdown-editable",
    ) as HTMLDivElement | null;
    const items = Array.from(editable?.querySelectorAll("ol > li") ?? []);
    const secondText = items[1]?.childNodes.item(1) as Text | null;
    const thirdText = items[2]?.childNodes.item(1) as Text | null;

    expect(items).toHaveLength(3);

    act(() => {
      if (!secondText || !thirdText) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart(secondText, 0);
      range.setEnd(thirdText, thirdText.nodeValue?.length ?? 0);
      selection.removeAllRanges();
      selection.addRange(range);
      editable?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Tab",
        }),
      );
    });

    const rootList = editable?.querySelector("ol");
    const topItems = Array.from(rootList?.children ?? []).filter((node): node is HTMLLIElement =>
      node instanceof HTMLLIElement
    );
    expect(topItems).toHaveLength(1);
    expect(topItems[0]?.querySelector("ol")?.children.length ?? 0).toBe(2);
  });

  it("shows a copy control in markdown edit mode outside the code element", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["```http", "GET /book/1", "200 OK", "```"].join("\n"),
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
    const copyButton = editable?.querySelector(
      ".md-code-block > .md-code-copy-button",
    ) as HTMLButtonElement | null;
    const pre = editable?.querySelector(".md-code-block > pre");

    expect(copyButton).toBeTruthy();
    expect(pre).toBeTruthy();
    expect(copyButton?.closest("pre")).toBeNull();
  });

  it("shows editable list markers when a list line is focused", () => {
    const { container, cleanup: localCleanup } = buildHarness(
      [
        "- Bullet",
        "",
        "1. Numbered",
        "2) Numbered alt",
        "",
        "- [ ] Open",
        "- [x] Done",
      ].join("\n"),
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
    const markers = Array.from(
      editable?.querySelectorAll<HTMLElement>("li > .md-list-marker") ?? [],
    );
    const markerToActivate = markers[0] ?? null;
    expect(markers.length).toBeGreaterThanOrEqual(4);
    expect(markers.some((marker) => marker.textContent?.includes("2)"))).toBe(true);
    expect(markers.some((marker) => marker.textContent?.includes("[ ]"))).toBe(true);
    expect(markers.some((marker) => marker.textContent?.includes("[x]"))).toBe(true);
    expect(markerToActivate).toBeTruthy();

    act(() => {
      const markerText = markerToActivate?.firstChild;
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

    const activeListItem = markerToActivate?.closest("li");
    expect(activeListItem?.getAttribute("data-md-list-active")).toBe("true");
  });

  it("shows a copy control on code blocks without forcing edit mode", async () => {
    const { container, cleanup: localCleanup } = buildHarness(
      ["```http", "GET /book/1", "200 OK", "```"].join("\n"),
    );
    cleanup = localCleanup;

    const copyButton = container.querySelector(
      ".preview.markdown .md-code-copy-button",
    ) as HTMLButtonElement | null;
    expect(copyButton).toBeTruthy();

    act(() => {
      copyButton?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      copyButton?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector(".preview.preview-editor.markdown")).toBeNull();
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
      input?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
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

  it("opens suggestions on first click without immediate commit", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = ["---", "Section: IUFS", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
      valueSuggestionsByKey: {
        Section: ["IUFS", "DBA"],
      },
    });
    cleanup = localCleanup;

    const input = container.querySelector(
      'input[aria-label="Section value"]',
    ) as HTMLInputElement | null;
    expect(input).toBeTruthy();

    act(() => {
      input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      input?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const suggestionList = container.querySelector(
      ".frontmatter-suggestions",
    ) as HTMLUListElement | null;
    expect(suggestionList).toBeTruthy();
    expect(suggestionList?.textContent ?? "").toContain("IUFS");
    expect(onFrontmatterSave).not.toHaveBeenCalled();
  });

  it("keeps suggestions strictly separated by property key", async () => {
    const markdown = ["---", "Section: IUFS", "Rank: SE1", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      valueSuggestionsByKey: {
        Section: ["IUFS", "DBA"],
        Rank: ["SE1", "SE2"],
      },
    });
    cleanup = localCleanup;

    const sectionInput = container.querySelector(
      'input[aria-label="Section value"]',
    ) as HTMLInputElement | null;
    const rankInput = container.querySelector(
      'input[aria-label="Rank value"]',
    ) as HTMLInputElement | null;
    expect(sectionInput).toBeTruthy();
    expect(rankInput).toBeTruthy();

    act(() => {
      sectionInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      sectionInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    let suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("IUFS");
    expect(suggestionText).not.toContain("SE1");

    act(() => {
      rankInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      rankInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("SE1");
    expect(suggestionText).not.toContain("IUFS");
  });

  it("adds links via links input and writes link keys", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = ["---", "title: Demo", "link1: [[IDBS01-TestL5]]", "---", "Body line"].join(
      "\n",
    );
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
    });
    cleanup = localCleanup;

    const linkInput = container.querySelector(
      'input[aria-label="Link hinzufuegen"]',
    ) as HTMLInputElement | null;
    expect(linkInput).toBeTruthy();

    act(() => {
      if (!linkInput) {
        return;
      }
      linkInput.value = "IDBS01-TestL7";
      linkInput.dispatchEvent(new Event("input", { bubbles: true }));
      linkInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onFrontmatterSave).toHaveBeenCalledTimes(1);
    const nextMarkdown = onFrontmatterSave.mock.calls[0]?.[0] ?? "";
    expect(nextMarkdown).toContain("link1: '[[IDBS01-TestL5]]'");
    expect(nextMarkdown).toContain("link2: '[[IDBS01-TestL7]]'");
  });

  it("navigates and removes links from the links section", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const onNavigateWikilink = vi.fn();
    const markdown = [
      "---",
      "title: Demo",
      "link1: [[IDBS01-TestL5]]",
      "link2: [[IDBS01-TestL6]]",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
      onNavigateWikilink,
    });
    cleanup = localCleanup;

    const firstLinkButton = container.querySelector(
      ".frontmatter-inline-link",
    ) as HTMLButtonElement | null;
    const firstRemoveButton = container.querySelector(
      ".frontmatter-link-remove",
    ) as HTMLButtonElement | null;
    expect(firstLinkButton).toBeTruthy();
    expect(firstRemoveButton).toBeTruthy();

    act(() => {
      firstLinkButton?.click();
    });
    expect(onNavigateWikilink).toHaveBeenCalledWith("[[IDBS01-TestL5]]");

    act(() => {
      firstRemoveButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onFrontmatterSave).toHaveBeenCalledTimes(1);
    const nextMarkdown = onFrontmatterSave.mock.calls[0]?.[0] ?? "";
    expect(nextMarkdown).toContain("link1: '[[IDBS01-TestL6]]'");
    expect(nextMarkdown).not.toContain("IDBS01-TestL5");
  });

  it("removes all links via the links attribute remove button", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = [
      "---",
      "title: Demo",
      "link1: [[IDBS01-TestL5]]",
      "link2: [[IDBS01-TestL6]]",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
    });
    cleanup = localCleanup;

    const linksRow = container.querySelector(
      '[data-frontmatter-key="__links__"]',
    ) as HTMLDivElement | null;
    const removeButton = linksRow?.querySelector(
      '.frontmatter-property-remove[aria-label="Links entfernen"]',
    ) as HTMLButtonElement | null;
    expect(removeButton).toBeTruthy();

    act(() => {
      removeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onFrontmatterSave).toHaveBeenCalledTimes(1);
    const nextMarkdown = onFrontmatterSave.mock.calls[0]?.[0] ?? "";
    expect(nextMarkdown).not.toContain("link1:");
    expect(nextMarkdown).not.toContain("link2:");
    expect(nextMarkdown).toContain("title: Demo");
    expect(nextMarkdown).toContain("---\nBody line");
  });

  it("shows links editor when an empty links attribute exists", () => {
    const markdown = [
      "---",
      "title: Demo",
      "links: null",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown);
    cleanup = localCleanup;

    const linksRow = container.querySelector(
      '[data-frontmatter-key="__links__"]',
    ) as HTMLDivElement | null;
    const linkInput = container.querySelector(
      'input[aria-label="Link hinzufuegen"]',
    ) as HTMLInputElement | null;

    expect(linksRow).toBeTruthy();
    expect(linkInput).toBeTruthy();
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

  it("removes an attribute row and persists frontmatter", async () => {
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
    const removeButton = rankRow?.querySelector(
      ".frontmatter-property-remove",
    ) as HTMLButtonElement | null;
    expect(rankRow).toBeTruthy();
    expect(removeButton).toBeTruthy();

    act(() => {
      removeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onFrontmatterSave).toHaveBeenCalledTimes(1);
    const nextMarkdown = onFrontmatterSave.mock.calls[0]?.[0] ?? "";
    expect(nextMarkdown).toContain("title: Demo");
    expect(nextMarkdown).toContain("section: IUFS");
    expect(nextMarkdown).not.toContain("rank: SE1");
    expect(nextMarkdown).toContain("---\nBody line");
  });

  it("opens add-row key suggestions on first click without changing input", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
      keySuggestions: ["Section", "Rank", "tags"],
    });
    cleanup = localCleanup;

    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    expect(keyInput).toBeTruthy();
    expect(keyInput?.value ?? "").toBe("");

    act(() => {
      keyInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      keyInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("Section");
    expect(suggestionText).toContain("Rank");
    expect(keyInput?.value ?? "").toBe("");
    expect(onFrontmatterSave).not.toHaveBeenCalled();
  });

  it("hides already existing keys from add-row key suggestions", async () => {
    const markdown = ["---", "title: Demo", "Section: IUFS", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      keySuggestions: ["Section", "Rank", "title"],
    });
    cleanup = localCleanup;

    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    expect(keyInput).toBeTruthy();

    act(() => {
      keyInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      keyInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("Rank");
    expect(suggestionText).not.toContain("Section");
    expect(suggestionText).not.toContain("title");
  });

  it("scopes add-row value suggestions to the selected key only", async () => {
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      keySuggestions: ["Section", "Rank"],
      valueSuggestionsByKey: {
        Section: ["IUFS", "DBA"],
        Rank: ["SE1", "SE2"],
      },
    });
    cleanup = localCleanup;

    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    const valueInput = container.querySelector(
      'input[aria-label="Neuer Wert"]',
    ) as HTMLInputElement | null;
    expect(keyInput).toBeTruthy();
    expect(valueInput).toBeTruthy();

    act(() => {
      keyInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      keyInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const clickSuggestionByLabel = (label: string) => {
      const button = Array.from(
        container.querySelectorAll<HTMLButtonElement>(".frontmatter-suggestion-option"),
      ).find((option) => option.textContent?.trim() === label);
      act(() => {
        button?.click();
      });
    };

    clickSuggestionByLabel("Section");
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      valueInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      valueInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    let suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("IUFS");
    expect(suggestionText).not.toContain("SE1");

    act(() => {
      keyInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      keyInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    clickSuggestionByLabel("Rank");
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      valueInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      valueInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("SE1");
    expect(suggestionText).not.toContain("IUFS");
  });

  it("does not open add-row value suggestions when key is empty", async () => {
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      valueSuggestionsByKey: {
        Section: ["IUFS"],
      },
    });
    cleanup = localCleanup;

    const valueInput = container.querySelector(
      'input[aria-label="Neuer Wert"]',
    ) as HTMLInputElement | null;
    expect(valueInput).toBeTruthy();

    act(() => {
      valueInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      valueInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector(".frontmatter-suggestions")).toBeNull();
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
      keyInput?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!keyInput) {
        return;
      }
      keyInput.value = "Section";
      keyInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!valueInput) {
        return;
      }
      valueInput.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!valueInput) {
        return;
      }
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

  it("shows add-row type selector with available options", async () => {
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown);
    cleanup = localCleanup;

    const typeButton = container.querySelector(
      'button[aria-label="Attribut-Typ"]',
    ) as HTMLButtonElement | null;
    expect(typeButton).toBeTruthy();
    expect(typeButton?.textContent ?? "").toContain("Text");

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const typeSuggestionText =
      container.querySelector(".frontmatter-type-suggestions")?.textContent ?? "";
    expect(typeSuggestionText).toContain("Text");
    expect(typeSuggestionText).toContain("Task");
    expect(typeSuggestionText).toContain("Links");
    expect(typeSuggestionText).toContain("Nur Zahlen");
    expect(typeSuggestionText).toContain("Cover");
    expect(typeSuggestionText).toContain("Tags");
  });

  it("validates number type before adding a property", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
    });
    cleanup = localCleanup;

    const typeButton = container.querySelector(
      'button[aria-label="Attribut-Typ"]',
    ) as HTMLButtonElement | null;
    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    const valueInput = container.querySelector(
      'input[aria-label="Neuer Wert"]',
    ) as HTMLInputElement | null;
    const addButton = container.querySelector(
      ".frontmatter-add-button",
    ) as HTMLButtonElement | null;
    expect(typeButton).toBeTruthy();
    expect(keyInput).toBeTruthy();
    expect(valueInput).toBeTruthy();
    expect(addButton).toBeTruthy();

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const numberOption = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".frontmatter-type-option"),
    ).find((button) => (button.textContent ?? "").includes("Nur Zahlen"));
    act(() => {
      numberOption?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      keyInput?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!keyInput) {
        return;
      }
      keyInput.value = "Punkte";
      keyInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      valueInput?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!valueInput) {
        return;
      }
      valueInput.value = "abc";
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

    expect(onFrontmatterSave).not.toHaveBeenCalled();
    expect(container.textContent ?? "").toContain("Nur Zahlen erlaubt.");

    act(() => {
      if (!valueInput) {
        return;
      }
      valueInput.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!valueInput) {
        return;
      }
      valueInput.value = "42";
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
    expect(nextMarkdown).toContain("Punkte: 42");
  });

  it("normalizes plain values when adding a links-typed property", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      onFrontmatterSave,
    });
    cleanup = localCleanup;

    const typeButton = container.querySelector(
      'button[aria-label="Attribut-Typ"]',
    ) as HTMLButtonElement | null;
    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    const valueInput = container.querySelector(
      'input[aria-label="Neuer Wert"]',
    ) as HTMLInputElement | null;
    const addButton = container.querySelector(
      ".frontmatter-add-button",
    ) as HTMLButtonElement | null;

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const linkOption = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".frontmatter-type-option"),
    ).find((button) => (button.textContent ?? "").includes("Links"));
    act(() => {
      linkOption?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(keyInput?.value ?? "").toBe("links");
    expect(keyInput?.readOnly).toBe(true);

    act(() => {
      valueInput?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!valueInput) {
        return;
      }
      valueInput.value = "IDBS01-TestL7";
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
    expect(nextMarkdown).toContain("links: '[[IDBS01-TestL7]]'");
  });

  it("auto-fills and locks key name for links and tags types", async () => {
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown);
    cleanup = localCleanup;

    const typeButton = container.querySelector(
      'button[aria-label="Attribut-Typ"]',
    ) as HTMLButtonElement | null;
    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    expect(typeButton).toBeTruthy();
    expect(keyInput).toBeTruthy();

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const linkOption = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".frontmatter-type-option"),
    ).find((button) => (button.textContent ?? "").includes("Links"));
    act(() => {
      linkOption?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(keyInput?.value ?? "").toBe("links");
    expect(keyInput?.readOnly).toBe(true);

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const tagsOption = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".frontmatter-type-option"),
    ).find((button) => (button.textContent ?? "").includes("Tags"));
    act(() => {
      tagsOption?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(keyInput?.value ?? "").toBe("tags");
    expect(keyInput?.readOnly).toBe(true);
  });

  it("auto-fills and locks key name for cover type", async () => {
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      vaultFiles: [
        {
          path: "/vault/assets/new-cover.png",
          relative_path: "assets/new-cover.png",
        },
      ],
      vaultPngAssets: [
        {
          path: "/vault/assets/new-cover.png",
          relative_path: "assets/new-cover.png",
          file_name: "new-cover.png",
          extension: "png",
        },
      ],
    });
    cleanup = localCleanup;

    const typeButton = container.querySelector(
      'button[aria-label="Attribut-Typ"]',
    ) as HTMLButtonElement | null;
    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    const valueInput = container.querySelector(
      'input[aria-label="Neuer Wert"]',
    ) as HTMLInputElement | null;
    expect(typeButton).toBeTruthy();
    expect(keyInput).toBeTruthy();
    expect(valueInput).toBeTruthy();

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const coverOption = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".frontmatter-type-option"),
    ).find((button) => (button.textContent ?? "").includes("Cover"));
    act(() => {
      coverOption?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(keyInput?.value ?? "").toBe("Cover");
    expect(keyInput?.readOnly).toBe(true);
    expect(valueInput?.getAttribute("placeholder")).toBe("Bild aus Vault waehlen ...");

    act(() => {
      valueInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      valueInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("new-cover.png");
  });

  it("hides links and tags from type selection when already present", async () => {
    const markdown = [
      "---",
      "title: Demo",
      "link1: [[IDBS01-TestL1]]",
      "tags:",
      "  - alpha",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown);
    cleanup = localCleanup;

    const typeButton = container.querySelector(
      'button[aria-label="Attribut-Typ"]',
    ) as HTMLButtonElement | null;

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const typeSuggestionText =
      container.querySelector(".frontmatter-type-suggestions")?.textContent ?? "";
    expect(typeSuggestionText).toContain("Text");
    expect(typeSuggestionText).toContain("Task");
    expect(typeSuggestionText).toContain("Nur Zahlen");
    expect(typeSuggestionText).toContain("Cover");
    expect(typeSuggestionText).not.toContain("Links");
    expect(typeSuggestionText).not.toContain("Tags");
  });

  it("hides cover from type selection when a cover attribute already exists", async () => {
    const markdown = [
      "---",
      "title: Demo",
      "Cover: '[[assets/cover.png]]'",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown);
    cleanup = localCleanup;

    const typeButton = container.querySelector(
      'button[aria-label="Attribut-Typ"]',
    ) as HTMLButtonElement | null;
    expect(typeButton).toBeTruthy();

    act(() => {
      typeButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const typeSuggestionText =
      container.querySelector(".frontmatter-type-suggestions")?.textContent ?? "";
    expect(typeSuggestionText).toContain("Text");
    expect(typeSuggestionText).toContain("Task");
    expect(typeSuggestionText).toContain("Links");
    expect(typeSuggestionText).toContain("Nur Zahlen");
    expect(typeSuggestionText).not.toContain("Cover");
  });

  it("filters cover key suggestions when cover already exists", async () => {
    const markdown = [
      "---",
      "title: Demo",
      "Cover: '[[assets/cover.png]]'",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      keySuggestions: ["Section", "Cover", "Rank"],
    });
    cleanup = localCleanup;

    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    expect(keyInput).toBeTruthy();

    act(() => {
      keyInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      keyInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("Section");
    expect(suggestionText).toContain("Rank");
    expect(suggestionText).not.toContain("Cover");
  });

  it("blocks creating a second cover via manual key input", async () => {
    const onFrontmatterSave = vi.fn().mockResolvedValue(true);
    const markdown = [
      "---",
      "title: Demo",
      "Cover: '[[assets/cover.png]]'",
      "---",
      "Body line",
    ].join("\n");
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
      keyInput?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!keyInput) {
        return;
      }
      keyInput.value = "Cover";
      keyInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      valueInput?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      if (!valueInput) {
        return;
      }
      valueInput.value = "assets/other.png";
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

    expect(onFrontmatterSave).not.toHaveBeenCalled();
    expect(container.textContent ?? "").toContain(
      "Cover existiert bereits - nur ein Cover moeglich.",
    );
  });

  it("renders cover thumbnail and shows PNG vault images in the picker", async () => {
    const markdown = [
      "---",
      "title: Demo",
      "Cover: '[[assets/cover.png]]'",
      "---",
      "Body line",
    ].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      vaultFiles: [
        {
          path: "/vault/assets/cover.png",
          relative_path: "assets/cover.png",
        },
        {
          path: "/vault/assets/alt.jpg",
          relative_path: "assets/alt.jpg",
        },
        {
          path: "/vault/Note.md",
          relative_path: "Note.md",
        },
      ],
      vaultPngAssets: [
        {
          path: "/vault/assets/cover.png",
          relative_path: "assets/cover.png",
          file_name: "cover.png",
          extension: "png",
        },
      ],
    });
    cleanup = localCleanup;

    const coverThumb = container.querySelector(
      ".frontmatter-cover-thumbnail",
    ) as HTMLImageElement | null;
    expect(coverThumb).toBeTruthy();
    expect(coverThumb?.getAttribute("src") ?? "").toContain("cover.png");
    expect(coverThumb?.closest(".frontmatter-cover-thumbnail-button")).toBeTruthy();

    const coverValueInput = container.querySelector(
      'input[aria-label="Cover value"]',
    ) as HTMLInputElement | null;
    expect(coverValueInput).toBeNull();

    const coverNameText = (
      container.querySelector(".frontmatter-cover-name") as HTMLSpanElement | null
    )?.textContent?.trim();
    const coverTargetText = (
      container.querySelector(".frontmatter-cover-target") as HTMLSpanElement | null
    )?.textContent?.trim();
    expect(coverNameText).toBe("[[assets/cover.png]]");
    expect(coverTargetText).toBe("[[assets/cover.png]]");

    const coverRow = container.querySelector(
      '[data-frontmatter-key="Cover"]',
    ) as HTMLDivElement | null;
    const coverLabel = coverRow?.querySelector(".frontmatter-label") as HTMLSpanElement | null;
    expect(coverRow).toBeTruthy();
    expect(coverLabel).toBeTruthy();

    act(() => {
      coverRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      container.querySelector('[aria-label="Cover Dateityp Auswahl"]'),
    ).toBeNull();
    expect(container.textContent ?? "").not.toContain("Typ: PNG");

    act(() => {
      coverRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      container.querySelector('[aria-label="Cover Dateityp Auswahl"]'),
    ).toBeNull();

    act(() => {
      coverThumb?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const pickerButton = container.querySelector(
      'button[aria-label="Cover Bild aus Vault waehlen"]',
    ) as HTMLButtonElement | null;
    expect(pickerButton).toBeNull();

    const pickerText = container.querySelector(".frontmatter-cover-picker")?.textContent ?? "";
    expect(pickerText).toContain("cover.png");
    expect(pickerText).not.toContain("alt.jpg");
    expect(pickerText).not.toContain("Note.md");
  });

  it("never suggests links/tags keys in text attribute key suggestions", async () => {
    const markdown = ["---", "title: Demo", "---", "Body line"].join("\n");
    const { container, cleanup: localCleanup } = buildHarness(markdown, {
      keySuggestions: ["Section", "Rank", "links", "link1", "tags"],
    });
    cleanup = localCleanup;

    const keyInput = container.querySelector(
      'input[aria-label="Neues Attribut"]',
    ) as HTMLInputElement | null;
    expect(keyInput).toBeTruthy();

    act(() => {
      keyInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      keyInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const suggestionText = container.querySelector(".frontmatter-suggestions")?.textContent ?? "";
    expect(suggestionText).toContain("Section");
    expect(suggestionText).toContain("Rank");
    expect(suggestionText).not.toContain("links");
    expect(suggestionText).not.toContain("link1");
    expect(suggestionText).not.toContain("tags");
  });
});
