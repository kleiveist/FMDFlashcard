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

const buildHarness = (markdown: string) => {
  const onEditExit = vi.fn();

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
      rawPreview: false,
      selectedFile: baseFile,
      canEdit: true,
      onEditChange: setEditDraft,
      onEditCaretApplied: () => setEditCaretIndex(null),
      onEditExit,
      onEditStart: handleEditStart,
      onToggleRawPreview: () => {},
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
});
