// @vitest-environment jsdom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MarkdownHybridEditor } from "./MarkdownHybridEditor";
import {
  ADVANCED_INSERT_TEMPLATE_CATALOG,
  buildAdvancedInsertTemplateVariant,
} from "./insertTemplates";
import { ExamMarkdown } from "../../pages/exam-simulation/components/ExamMarkdown";

const INTERNAL_BLOCK_CLIPBOARD_MIME = "application/x-fmd-markdown-hybrid-blocks+json";

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

const dispatchClick = (element: Element | null) => {
  act(() => {
    element?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
  });
};

const dispatchMouseDown = (
  element: Element | null,
  options: Partial<MouseEventInit> = {},
) => {
  act(() => {
    element?.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        ...options,
      }),
    );
  });
};

const dispatchWindowMouseMove = (options: Partial<MouseEventInit> = {}) => {
  act(() => {
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        ...options,
      }),
    );
  });
};

const dispatchWindowMouseUp = (options: Partial<MouseEventInit> = {}) => {
  act(() => {
    window.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...options,
      }),
    );
  });
};

const dispatchKeyDown = (
  element: Element | null,
  key: string,
  options: Partial<KeyboardEventInit> = {},
) => {
  act(() => {
    element?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
        ...options,
      }),
    );
  });
};

const dispatchWindowKeyDown = (key: string, options: Partial<KeyboardEventInit> = {}) => {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
        ...options,
      }),
    );
  });
};

const dispatchCompositionEvent = (
  element: Element | null,
  type: "compositionstart" | "compositionend",
) => {
  act(() => {
    const event =
      typeof CompositionEvent !== "undefined"
        ? new CompositionEvent(type, { bubbles: true, cancelable: true })
        : new Event(type, { bubbles: true, cancelable: true });
    element?.dispatchEvent(event);
  });
};

const dispatchContextMenu = (
  element: Element | null,
  options: Partial<MouseEventInit> = {},
) => {
  act(() => {
    element?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons: 2,
        ...options,
      }),
    );
  });
};

const createClipboardDataMock = (initialData: Record<string, string> = {}) => {
  const store = new Map<string, string>(Object.entries(initialData));
  const clipboard = {
    clearData: (format?: string) => {
      if (format) {
        store.delete(format);
        return;
      }
      store.clear();
    },
    getData: (format: string) => store.get(format) ?? "",
    setData: (format: string, value: string) => {
      store.set(format, value);
    },
  };
  return clipboard as unknown as DataTransfer;
};

const dispatchClipboardEvent = (
  element: Element | null,
  type: "copy" | "cut" | "paste",
  clipboardData: DataTransfer,
): ClipboardEvent => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    value: clipboardData,
    configurable: true,
  });
  act(() => {
    element?.dispatchEvent(event);
  });
  return event;
};

const activateBlockEditor = (container: ParentNode, index = 0) => {
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

const ctrlSelectBlock = (block: Element | null) => {
  act(() => {
    block?.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        ctrlKey: true,
      }),
    );
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
};

const setTextareaSelection = (
  textarea: HTMLTextAreaElement | null,
  start: number,
  end = start,
) => {
  act(() => {
    textarea?.setSelectionRange(start, end);
    textarea?.dispatchEvent(new Event("select", { bubbles: true }));
  });
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

const applyInputValue = (input: HTMLInputElement | null, nextValue: string) => {
  act(() => {
    if (!input) {
      return;
    }
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  });
};

const blurTextarea = (textarea: HTMLTextAreaElement | null) => {
  act(() => {
    textarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
  });
};

const findButtonByExactText = (container: ParentNode, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label,
  ) ?? null;

const findButtonByAriaLabel = (container: ParentNode, label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const findMenuItemButtonByLabel = (container: ParentNode, label: string) => {
  const labelNode = Array.from(
    container.querySelectorAll<HTMLElement>(".markdown-hybrid-insert-menu-item-label"),
  ).find((node) => node.textContent?.trim() === label);
  if (labelNode) {
    return labelNode.closest<HTMLButtonElement>("button");
  }
  return findButtonByExactText(container, label);
};

const findPageLinkPickerOptionByLabel = (container: ParentNode, label: string) => {
  const labelNode = Array.from(
    container.querySelectorAll<HTMLElement>(".markdown-hybrid-page-link-picker-option-label"),
  ).find((node) => node.textContent?.trim() === label);
  return labelNode?.closest<HTMLButtonElement>("button") ?? null;
};

const findImageEmbedReplaceTrigger = (container: ParentNode, blockIndex: number) =>
  container.querySelector<HTMLButtonElement>(
    `.markdown-hybrid-block[data-md-block-index='${blockIndex}'] .markdown-hybrid-image-embed-replace-trigger`,
  );

const findTableCellImageReplaceTrigger = (container: ParentNode) =>
  container.querySelector<HTMLButtonElement>(".markdown-hybrid-table-cell-image-replace-trigger");

const applyTextInput = (
  input: HTMLInputElement | HTMLTextAreaElement | null,
  nextValue: string,
  caret = nextValue.length,
) => {
  act(() => {
    if (!input) {
      return;
    }
    input.value = nextValue;
    if ("setSelectionRange" in input) {
      input.setSelectionRange(caret, caret);
    }
    input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  });
};

const applySelectValue = (select: HTMLSelectElement | null, nextValue: string) => {
  act(() => {
    if (!select) {
      return;
    }
    select.value = nextValue;
    select.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  });
};

const withImmediateRaf = <T,>(run: () => T) => {
  const originalRaf = window.requestAnimationFrame;
  const originalCancelRaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;
  try {
    return run();
  } finally {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  }
};

const createMockRect = (height: number, width = 320): DOMRect =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

describe("MarkdownHybridEditor", () => {
  it("selects a range with Shift+click without opening a textarea and returns to edit on plain click", () => {
    const initialMarkdown = ["# One", "# Two", "# Three"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="shift-click-range"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    expect(blocks).toHaveLength(3);

    act(() => {
      blocks[0]?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          shiftKey: true,
        }),
      );
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(1);
    expect(container.querySelectorAll("textarea.markdown-hybrid-block-editor")).toHaveLength(0);

    act(() => {
      blocks[2]?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          shiftKey: true,
        }),
      );
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(3);
    expect(container.querySelectorAll("textarea.markdown-hybrid-block-editor")).toHaveLength(0);

    act(() => {
      blocks[1]?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
        }),
      );
    });

    expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(0);
    expect(
      container.querySelectorAll(".markdown-hybrid-block[data-md-block-index='1'] textarea"),
    ).toHaveLength(1);

    cleanup();
  });

  it("supports Shift+drag range selection across blocks using global mouse tracking", () => {
    const initialMarkdown = ["Alpha", "Beta", "Gamma", "Delta"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="shift-drag-range"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    expect(blocks).toHaveLength(4);

    const originalElementFromPoint = document.elementFromPoint;
    let currentPointerTarget: Element | null = null;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => currentPointerTarget,
    });

    try {
      act(() => {
        blocks[0]?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            shiftKey: true,
            clientX: 2,
            clientY: 0,
          }),
        );
      });

      currentPointerTarget = blocks[2] ?? null;
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            cancelable: true,
            buttons: 1,
            clientX: 18,
            clientY: 16,
          }),
        );
      });

      act(() => {
        window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(3);
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
    }

    cleanup();
  });

  it("toggles disjoint block selection with Ctrl+click and deletes only selected blocks", () => {
    const initialMarkdown = ["# One", "# Two", "# Three", "# Four"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <div>
          <div data-testid="markdown-value">{markdown}</div>
          <MarkdownHybridEditor
            historyKey="ctrl-click-disjoint-selection"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        </div>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const editor = container.querySelector(".markdown-hybrid-editor");
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    const readMarkdown = () =>
      container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

    expect(editor).toBeTruthy();
    expect(blocks).toHaveLength(4);

    act(() => {
      blocks[0]?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          ctrlKey: true,
        }),
      );
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    act(() => {
      blocks[2]?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          ctrlKey: true,
        }),
      );
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    const selectedBlocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block.is-range-selected"),
    );
    expect(selectedBlocks).toHaveLength(2);
    expect(blocks[0]?.classList.contains("is-range-selected")).toBe(true);
    expect(blocks[1]?.classList.contains("is-range-selected")).toBe(false);
    expect(blocks[2]?.classList.contains("is-range-selected")).toBe(true);
    expect(container.querySelectorAll("textarea.markdown-hybrid-block-editor")).toHaveLength(0);

    act(() => {
      editor?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Delete",
        }),
      );
    });

    expect(readMarkdown()).toBe(["# Two", "# Four"].join("\n"));
    cleanup();
  });

  it("supports right-click drag range selection with delete and undo", () => {
    const initialMarkdown = ["# Alpha", "# Beta", "# Gamma", "# Delta"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <div>
          <div data-testid="markdown-value">{markdown}</div>
          <MarkdownHybridEditor
            historyKey="test-file"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        </div>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const editor = container.querySelector(".markdown-hybrid-editor");
    expect(editor).toBeTruthy();
    const getBlocks = () =>
      Array.from(container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"));
    const readMarkdown = () =>
      container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

    const blocks = getBlocks();
    expect(blocks).toHaveLength(4);

    act(() => {
      blocks[0]?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 2,
          buttons: 2,
          clientX: 2,
          clientY: 0,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          buttons: 2,
          clientX: 20,
          clientY: 16,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    const selectedBlocks = container.querySelectorAll(".markdown-hybrid-block.is-range-selected");
    expect(selectedBlocks).toHaveLength(3);

    act(() => {
      editor?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Delete",
        }),
      );
    });

    expect(readMarkdown()).toBe("# Delta");
    expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(0);

    act(() => {
      editor?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "z",
          ctrlKey: true,
        }),
      );
    });

    expect(readMarkdown()).toBe(initialMarkdown);
    cleanup();
  });

  it("copies selected blocks as markdown plain text and internal block payload in document order", () => {
    const initialMarkdown = ["# One", "# Two", "# Three", "# Four"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="block-copy-clipboard"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    expect(editor).toBeTruthy();
    expect(blocks).toHaveLength(4);

    ctrlSelectBlock(blocks[2]);
    ctrlSelectBlock(blocks[0]);

    const clipboardData = createClipboardDataMock();
    const copyEvent = dispatchClipboardEvent(editor, "copy", clipboardData);
    expect(copyEvent.defaultPrevented).toBe(true);
    expect(clipboardData.getData("text/plain")).toBe(["# One", "# Three"].join("\n"));

    const payloadRaw = clipboardData.getData(INTERNAL_BLOCK_CLIPBOARD_MIME);
    const payload = JSON.parse(payloadRaw) as {
      version: number;
      source: string;
      blocks: Array<{ raw: string }>;
    };
    expect(payload.version).toBe(1);
    expect(payload.source).toBe("fmd-markdown-hybrid-editor");
    expect(payload.blocks.map((block) => block.raw)).toEqual(["# One", "# Three"]);

    cleanup();
  });

  it("cuts selected blocks, keeps clipboard data, and focuses an editable empty block when all blocks were removed", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["# One", "# Two", "# Three"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="block-cut-empty-focus"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
      const blocks = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      );
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      expect(editor).toBeTruthy();
      expect(blocks).toHaveLength(3);

      blocks.forEach((block) => {
        ctrlSelectBlock(block);
      });

      const clipboardData = createClipboardDataMock();
      const cutEvent = dispatchClipboardEvent(editor, "cut", clipboardData);
      expect(cutEvent.defaultPrevented).toBe(true);
      expect(clipboardData.getData("text/plain")).toBe(initialMarkdown);
      expect(readMarkdown()).toBe("");

      const emptyEditor = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block-empty .markdown-hybrid-block-editor",
      );
      expect(emptyEditor).toBeTruthy();

      dispatchKeyDown(emptyEditor, "z", { ctrlKey: true });
      expect(readMarkdown()).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("cuts selected blocks and focuses the next remaining block", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["# One", "# Two", "# Three"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="block-cut-next-focus"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
      const blocks = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      );
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      expect(editor).toBeTruthy();
      expect(blocks).toHaveLength(3);
      ctrlSelectBlock(blocks[1]);

      const clipboardData = createClipboardDataMock();
      const cutEvent = dispatchClipboardEvent(editor, "cut", clipboardData);
      expect(cutEvent.defaultPrevented).toBe(true);
      expect(readMarkdown()).toBe(["# One", "# Three"].join("\n"));

      const focusedTextarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='1'] .markdown-hybrid-block-editor",
      );
      expect(focusedTextarea?.value).toBe("# Three");

      cleanup();
    });
  });

  it("replaces an active block selection with internal clipboard blocks on paste", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["# A", "# B", "# C"].join("\n");
      const internalBlocks = [
        {
          kind: "card-block",
          raw: [
            "#card",
            "Question",
            "Answer: 42",
            "-true",
            "a) option",
            "-a",
            "%%cloze%%",
            "tocken \"drag\"",
            "#endcard",
          ].join("\n"),
        },
        {
          kind: "table",
          raw: [
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
          ].join("\n"),
        },
      ];
      const pastedMarkdown = internalBlocks.map((block) => block.raw).join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="block-paste-selection-internal"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
      const blocks = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      );
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      expect(editor).toBeTruthy();
      expect(blocks).toHaveLength(3);
      blocks.forEach((block) => {
        ctrlSelectBlock(block);
      });

      const clipboardData = createClipboardDataMock({
        "text/plain": pastedMarkdown,
        [INTERNAL_BLOCK_CLIPBOARD_MIME]: JSON.stringify({
          version: 1,
          source: "fmd-markdown-hybrid-editor",
          createdAt: new Date().toISOString(),
          blocks: internalBlocks,
        }),
      });
      const pasteEvent = dispatchClipboardEvent(editor, "paste", clipboardData);
      expect(pasteEvent.defaultPrevented).toBe(true);
      expect(readMarkdown()).toBe(pastedMarkdown);

      const activeTextarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='0'] .markdown-hybrid-block-editor",
      );
      expect(activeTextarea?.value).toBe(internalBlocks[0]?.raw);
      dispatchKeyDown(activeTextarea, "z", { ctrlKey: true });
      expect(readMarkdown()).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("replaces an active block selection with plain text markdown when no internal clipboard payload exists", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["# A", "# B", "# C"].join("\n");
      const externalMarkdown = ["#exam", "1) Aufgabe", "Answer: Text", "#endexam"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="block-paste-selection-external"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
      const blocks = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      );
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      expect(editor).toBeTruthy();
      blocks.forEach((block) => {
        ctrlSelectBlock(block);
      });

      const clipboardData = createClipboardDataMock({
        "text/plain": externalMarkdown,
      });
      const pasteEvent = dispatchClipboardEvent(editor, "paste", clipboardData);
      expect(pasteEvent.defaultPrevented).toBe(true);
      expect(readMarkdown()).toBe(externalMarkdown);

      cleanup();
    });
  });

  it("pastes internal clipboard blocks after the active clean block and keeps dirty blocks on normal text paste fallback", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["# A", "# B"].join("\n");
      const internalBlocks = [
        { kind: "heading", raw: "# Inserted" },
        {
          kind: "paragraph",
          raw: ["Answer: 42", "-true", "a) one", "-a", "%%hole%%", "tocken \"drag\""].join("\n"),
        },
      ];
      const internalPayload = JSON.stringify({
        version: 1,
        source: "fmd-markdown-hybrid-editor",
        createdAt: new Date().toISOString(),
        blocks: internalBlocks,
      });

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="block-paste-active-cursor"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      expect(editor).toBeTruthy();
      const cleanTextarea = activateBlockEditor(container, 0);
      expect(cleanTextarea?.value).toBe("# A");

      const internalClipboardData = createClipboardDataMock({
        "text/plain": internalBlocks.map((block) => block.raw).join("\n"),
        [INTERNAL_BLOCK_CLIPBOARD_MIME]: internalPayload,
      });
      const internalPasteEvent = dispatchClipboardEvent(cleanTextarea, "paste", internalClipboardData);
      expect(internalPasteEvent.defaultPrevented).toBe(true);

      const pastedMarkdown = readMarkdown();
      expect(pastedMarkdown.indexOf("# A")).toBeLessThan(pastedMarkdown.indexOf("# Inserted"));
      expect(pastedMarkdown.indexOf("# Inserted")).toBeLessThan(pastedMarkdown.indexOf("# B"));
      expect(pastedMarkdown).toContain("Answer: 42");
      expect(pastedMarkdown).toContain("tocken \"drag\"");

      const insertedTextarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(insertedTextarea?.value).toBe("# Inserted");

      const dirtyTextarea = insertedTextarea;
      applyTextareaInput(dirtyTextarea, "# Inserted dirty");
      const dirtyPasteEvent = dispatchClipboardEvent(dirtyTextarea, "paste", internalClipboardData);
      expect(dirtyPasteEvent.defaultPrevented).toBe(false);
      expect(readMarkdown()).toBe(pastedMarkdown);

      cleanup();
    });
  });

  it("auto-scrolls during right-drag and selects blocks beyond the initial viewport", () => {
    withImmediateRaf(() => {
      const initialMarkdown = Array.from({ length: 40 }, (_value, index) => `# Item ${index + 1}`).join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <MarkdownHybridEditor
            historyKey="right-drag-auto-scroll"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
      const scrollHost = editor?.parentElement;
      const blocks = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      );
      expect(editor).toBeTruthy();
      expect(scrollHost).toBeTruthy();
      expect(blocks.length).toBeGreaterThan(10);

      const createRect = (top: number, bottom: number, width = 320) =>
        ({
          x: 0,
          y: top,
          left: 0,
          top,
          right: width,
          bottom,
          width,
          height: bottom - top,
          toJSON: () => ({ top, bottom }),
        }) as DOMRect;

      if (editor && scrollHost) {
        scrollHost.style.overflowY = "auto";
        (scrollHost as HTMLElement).scrollTop = 0;
        Object.defineProperty(scrollHost, "scrollHeight", {
          configurable: true,
          value: 2400,
        });
        Object.defineProperty(scrollHost, "clientHeight", {
          configurable: true,
          value: 180,
        });
        Object.defineProperty(scrollHost, "getBoundingClientRect", {
          configurable: true,
          value: () => createRect(0, 180),
        });
        Object.defineProperty(editor, "getBoundingClientRect", {
          configurable: true,
          value: () => createRect(-(scrollHost as HTMLElement).scrollTop, 1200 - (scrollHost as HTMLElement).scrollTop),
        });
      }

      act(() => {
        blocks[0]?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            button: 2,
            buttons: 2,
            clientX: 8,
            clientY: 0,
          }),
        );
      });

      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            cancelable: true,
            buttons: 2,
            clientX: 18,
            clientY: 176,
          }),
        );
      });

      act(() => {
        window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      expect((scrollHost as HTMLElement | null)?.scrollTop ?? 0).toBeGreaterThan(0);
      expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected").length).toBeGreaterThan(3);

      cleanup();
    });
  });

  it("marks ordered-list rows via right-drag even when hovering nested list content", () => {
    const initialMarkdown = ["Alpha", "1. One", "2. Two", "Omega"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="ordered-list-test"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => {
            if (value.startsWith("1.")) {
              return (
                <ol>
                  <li>
                    <span>List Content</span>
                  </li>
                </ol>
              );
            }
            return <p>{value}</p>;
          }}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const editor = container.querySelector(".markdown-hybrid-editor");
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    expect(editor).toBeTruthy();
    expect(blocks).toHaveLength(3);

    const orderedListBlock = container.querySelector<HTMLElement>(
      ".markdown-hybrid-block[data-md-block-kind='ordered-list']",
    );
    const nestedListNode = orderedListBlock?.querySelector("li");
    expect(orderedListBlock).toBeTruthy();
    expect(nestedListNode).toBeTruthy();

    const originalElementFromPoint = document.elementFromPoint;
    let currentPointerTarget: Element | null = null;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => currentPointerTarget,
    });

    try {
      act(() => {
        blocks[0]?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            button: 2,
            buttons: 2,
          }),
        );
      });

      currentPointerTarget = nestedListNode ?? null;
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            cancelable: true,
            buttons: 2,
            clientX: 10,
            clientY: 10,
          }),
        );
      });

      currentPointerTarget = blocks[2] ?? null;
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            cancelable: true,
            buttons: 2,
            clientX: 20,
            clientY: 20,
          }),
        );
      });

      act(() => {
        window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });

      expect(
        container.querySelectorAll(".markdown-hybrid-block.is-range-selected"),
      ).toHaveLength(3);
      expect(orderedListBlock?.classList.contains("is-range-selected")).toBe(true);
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
    }

    cleanup();
  });

  it("does not start block range selection from gutter controls", () => {
    const Harness = () => {
      const [markdown, setMarkdown] = useState("# One\n# Two");
      return (
        <MarkdownHybridEditor
          historyKey="controls-test"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const dragHandle = container.querySelector<HTMLElement>(".markdown-hybrid-block-drag-handle");
    const insertButton = container.querySelector<HTMLElement>(".markdown-hybrid-block-insert-button");
    expect(dragHandle).toBeTruthy();
    expect(insertButton).toBeTruthy();

    act(() => {
      dragHandle?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 2,
          buttons: 2,
        }),
      );
    });

    act(() => {
      insertButton?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 2,
          buttons: 2,
        }),
      );
    });

    act(() => {
      dragHandle?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          shiftKey: true,
        }),
      );
    });

    act(() => {
      insertButton?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          shiftKey: true,
        }),
      );
    });

    expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(0);
    cleanup();
  });

  it("selects a single block on plain drag-handle click", () => {
    const Harness = () => {
      const [markdown, setMarkdown] = useState("# One\n# Two");
      return (
        <MarkdownHybridEditor
          historyKey="drag-handle-select-single-block"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const dragHandle = container.querySelector<HTMLElement>(".markdown-hybrid-block-drag-handle");
    expect(dragHandle).toBeTruthy();

    dispatchClick(dragHandle);

    const selectedBlocks = container.querySelectorAll(".markdown-hybrid-block.is-range-selected");
    expect(selectedBlocks).toHaveLength(1);
    expect(
      container.querySelector(".markdown-hybrid-block[data-md-block-index='0']")?.classList.contains(
        "is-range-selected",
      ),
    ).toBe(true);
    expect(container.querySelectorAll("textarea.markdown-hybrid-block-editor")).toHaveLength(0);

    cleanup();
  });

  it("opens a block selection context menu on right click and suppresses it after right-drag", () => {
    const Harness = () => {
      const [markdown, setMarkdown] = useState(["# One", "# Two", "# Three"].join("\n"));
      return (
        <MarkdownHybridEditor
          historyKey="selection-context-menu"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    expect(blocks).toHaveLength(3);

    act(() => {
      blocks[1]?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 2,
          buttons: 2,
          clientX: 40,
          clientY: 50,
        }),
      );
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      blocks[1]?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 40,
          clientY: 50,
        }),
      );
    });

    expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(1);
    const selectionMenu = container.querySelector(".markdown-hybrid-selection-menu");
    expect(selectionMenu).toBeTruthy();

    const clearButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-selection-menu-item"),
    ).find((button) => button.textContent?.includes("Auswahl aufheben"));
    expect(clearButton).toBeTruthy();

    act(() => {
      clearButton?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }),
      );
      clearButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(container.querySelector(".markdown-hybrid-selection-menu")).toBeNull();
    expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(0);

    const originalElementFromPoint = document.elementFromPoint;
    let currentPointerTarget: Element | null = null;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => currentPointerTarget,
    });

    try {
      act(() => {
        blocks[0]?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            button: 2,
            buttons: 2,
            clientX: 2,
            clientY: 0,
          }),
        );
      });

      currentPointerTarget = blocks[2] ?? null;
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            cancelable: true,
            buttons: 2,
            clientX: 20,
            clientY: 16,
          }),
        );
      });

      act(() => {
        window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        blocks[2]?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: 30,
            clientY: 30,
          }),
        );
      });

      expect(container.querySelector(".markdown-hybrid-selection-menu")).toBeNull();
      expect(container.querySelectorAll(".markdown-hybrid-block.is-range-selected")).toHaveLength(3);
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
    }

    cleanup();
  });

  it("renders insert menu without removed entries in Advanced and without a Page entry", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("# One");
        return (
          <MarkdownHybridEditor
            historyKey="insert-menu-advanced-layout"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const insertButton = container.querySelector<HTMLButtonElement>(".markdown-hybrid-block-insert-button");
      expect(insertButton).toBeTruthy();

      dispatchClick(insertButton);

      const menu = container.querySelector<HTMLElement>(".markdown-hybrid-insert-menu[role='menu']");
      expect(menu).toBeTruthy();
      const categoryButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-insert-menu-item[role='menuitem']"),
      );
      expect(categoryButtons.some((button) => button.textContent?.trim() === "Page")).toBe(false);
      expect(categoryButtons.some((button) => button.textContent?.trim() === "Text & Headings")).toBe(false);
      expect(categoryButtons.some((button) => button.textContent?.trim() === "Lists")).toBe(false);
      expect(categoryButtons.some((button) => button.textContent?.trim() === "Standard Blocks")).toBe(true);

      const advancedButton = findButtonByExactText(container, "Advanced");
      expect(advancedButton).toBeTruthy();
      dispatchClick(advancedButton);

      const list = container.querySelector<HTMLElement>(".markdown-hybrid-insert-menu-list");
      expect(list).toBeTruthy();

      const codeButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-insert-menu-item"),
      ).filter((button) => button.textContent?.includes("Code Block"));
      const formulaButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-insert-menu-item"),
      ).filter((button) => button.textContent?.includes("Formula Block"));
      const examWrapperButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-insert-menu-item"),
      ).filter((button) => button.textContent?.includes("Exam Wrapper"));
      const examBlueprintButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-insert-menu-item"),
      ).filter((button) => button.textContent?.includes("Exam Task Blueprint"));
      expect(list?.querySelectorAll(".markdown-hybrid-insert-menu-item")).not.toHaveLength(0);
      expect(codeButtons).toHaveLength(0);
      expect(formulaButtons).toHaveLength(0);
      expect(examWrapperButtons).toHaveLength(0);
      expect(examBlueprintButtons).toHaveLength(0);
      expect(findMenuItemButtonByLabel(container, "Flashcard Block")).toBeNull();

      cleanup();
    });
  });

  it("shows merged Standard Blocks items with icons and without a separate Lists category", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("# One");
        return (
          <MarkdownHybridEditor
            historyKey="insert-menu-standard-blocks"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));

      expect(findButtonByExactText(container, "Standard Blocks")).toBeTruthy();
      expect(findButtonByExactText(container, "Text & Headings")).toBeNull();
      expect(findButtonByExactText(container, "Lists")).toBeNull();

      dispatchClick(findButtonByExactText(container, "Standard Blocks"));

      const expectedLabels = [
        "Text",
        "Heading 1",
        "Heading 2",
        "Heading 3",
        "Heading 4",
        "Bulleted List",
        "Numbered List",
        "Numbered List (Exam)",
        "To-do List",
        "Toggle List",
        "Divider",
        "Quote",
        "Nested Quote",
      ];

      const menuButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          ".markdown-hybrid-insert-menu-item[role='menuitem']",
        ),
      );
      expect(menuButtons).toHaveLength(expectedLabels.length);

      const labels = menuButtons.map((button) =>
        button.querySelector(".markdown-hybrid-insert-menu-item-label")?.textContent?.trim() ?? "",
      );
      expect(labels).toEqual(expectedLabels);

      const iconNodes = container.querySelectorAll(
        ".markdown-hybrid-insert-menu-item-icon[data-md-insert-menu-icon]",
      );
      expect(iconNodes).toHaveLength(expectedLabels.length);

      cleanup();
    });
  });

  it("inserts syntactically correct Standard Blocks markdown prefixes", () => {
    withImmediateRaf(() => {
      const expectations: Array<{ label: string; markdown: string }> = [
        { label: "Text", markdown: "Text" },
        { label: "Heading 1", markdown: "# Heading text" },
        { label: "Heading 2", markdown: "## Heading text" },
        { label: "Heading 3", markdown: "### Heading text" },
        { label: "Heading 4", markdown: "#### Heading text" },
        { label: "Bulleted List", markdown: "- List item" },
        { label: "Numbered List", markdown: "1. List item" },
        { label: "Numbered List (Exam)", markdown: "1) Task text" },
        { label: "To-do List", markdown: "- [ ] Task text" },
        {
          label: "Toggle List",
          markdown: "<details>\n<summary>Toggle title</summary>\n\nToggle content\n</details>",
        },
        { label: "Divider", markdown: "---" },
        { label: "Quote", markdown: "> Quote text" },
        { label: "Nested Quote", markdown: ">> Nested quote text" },
      ];

      for (const entry of expectations) {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("");
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey={`insert-standard-${entry.label}`}
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
        dispatchClick(findButtonByExactText(container, "Standard Blocks"));
        dispatchClick(findMenuItemButtonByLabel(container, entry.label));

        const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        expect(markdownValue).toBe(entry.markdown);

        cleanup();
      }
    });
  });

  it("renders an icon for the close menu button and restores Code Block in Structure", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-menu-structure-code-block"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));

      const closeButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Close Menu (Esc)",
      );
      expect(closeButton).toBeTruthy();
      expect(
        closeButton?.querySelector(
          ".markdown-hybrid-insert-menu-item-icon[data-md-insert-menu-icon='close']",
        ),
      ).toBeTruthy();

      dispatchClick(findButtonByExactText(container, "Structure"));

      const codeBlockButton = findMenuItemButtonByLabel(container, "Code Block");
      expect(codeBlockButton).toBeTruthy();
      expect(
        codeBlockButton?.querySelector(
          ".markdown-hybrid-insert-menu-item-icon[data-md-insert-menu-icon='code-block']",
        ),
      ).toBeTruthy();

      dispatchClick(codeBlockButton);

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toBe("```txt\nCODE HERE\n```");

      cleanup();
    });
  });

  it("inserts a Math Block from Structure and places the caret between $$ delimiters", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-menu-structure-math-block"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
      dispatchClick(findButtonByExactText(container, "Structure"));
      dispatchClick(findMenuItemButtonByLabel(container, "Math Block"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toBe("$$\n\n$$");

      const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-math-editor");
      expect(textarea).toBeTruthy();
      expect(textarea?.selectionStart).toBe(3);
      expect(textarea?.selectionEnd).toBe(3);

      cleanup();
    });
  });

  it("supports arrow-key focus navigation inside the insert menu", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("# One");
        return (
          <MarkdownHybridEditor
            historyKey="insert-menu-arrow-nav"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));

      const menu = container.querySelector<HTMLElement>(".markdown-hybrid-insert-menu[role='menu']");
      expect(menu).toBeTruthy();
      const menuItems = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']"),
      );
      expect(menuItems.length).toBeGreaterThan(1);
      expect(document.activeElement).toBe(menuItems[0]);

      act(() => {
        menu?.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "ArrowDown",
          }),
        );
      });

      expect(document.activeElement).toBe(menuItems[1]);
      cleanup();
    });
  });

  it("inserts Advanced templates, including direct single-step templates, and selects the first placeholder", () => {
    withImmediateRaf(() => {
      const expectedVisibleLabels = new Set(
        ADVANCED_INSERT_TEMPLATE_CATALOG.map((template) => template.label),
      );

      for (const template of ADVANCED_INSERT_TEMPLATE_CATALOG) {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("");
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey={`insert-template-${template.id}`}
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
        dispatchClick(findButtonByExactText(container, "Advanced"));

        const labelsInAdvanced = new Set(
          Array.from(
            container.querySelectorAll<HTMLElement>(".markdown-hybrid-insert-menu-item-label"),
          ).map((node) => node.textContent?.trim() ?? ""),
        );
        expectedVisibleLabels.forEach((label) => {
          expect(labelsInAdvanced.has(label)).toBe(true);
        });

        const templateButton = findMenuItemButtonByLabel(container, template.label);
        expect(templateButton).toBeTruthy();
        expect(
          templateButton?.querySelector(".markdown-hybrid-insert-menu-item-icon[data-md-insert-menu-icon]"),
        ).toBeTruthy();
        const markdownBeforeInsert = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        expect(markdownBeforeInsert).toBe("");
        dispatchClick(templateButton);

        if (template.insertBehavior === "direct") {
          expect(findMenuItemButtonByLabel(container, "Task")).toBeNull();
          expect(findMenuItemButtonByLabel(container, "Card")).toBeNull();
          expect(container.querySelector("input[aria-label='Task number']")).toBeNull();

          const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
          expect(markdownValue).toBe(template.payload);

          const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
          expect(textarea).toBeTruthy();
          const selectedText = textarea && textarea.selectionStart !== null && textarea.selectionEnd !== null
            ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)
            : "";
          expect(selectedText).toBe(template.firstPlaceholder);

          cleanup();
          continue;
        }

        const markdownBeforeVariant = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        expect(markdownBeforeVariant).toBe("");
        expect(findMenuItemButtonByLabel(container, "Task")).toBeTruthy();
        expect(findMenuItemButtonByLabel(container, "Card")).toBeTruthy();
        dispatchClick(findMenuItemButtonByLabel(container, "Card"));

        const expectedCardVariant = buildAdvancedInsertTemplateVariant(template, "card", {
          sequenceNumber: 1,
        });
        const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        expect(markdownValue).toBe(expectedCardVariant.payload);
        expect(markdownValue).toContain("1) CARD HEADING");

        const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea).toBeTruthy();
        const selectedText = textarea && textarea.selectionStart !== null && textarea.selectionEnd !== null
          ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)
          : "";
        expect(selectedText).toBe(template.firstPlaceholder);

        cleanup();
      }
    });
  });

  it("inserts every Advanced template as a numbered task and selects the task heading", () => {
    withImmediateRaf(() => {
      for (const template of ADVANCED_INSERT_TEMPLATE_CATALOG.filter((entry) => entry.insertBehavior !== "direct")) {
        const expectedTaskVariant = buildAdvancedInsertTemplateVariant(template, "task", {
          sequenceNumber: 1,
        });

        const Harness = () => {
          const [markdown, setMarkdown] = useState("");
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey={`insert-task-template-${template.id}`}
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
        dispatchClick(findButtonByExactText(container, "Advanced"));
        dispatchClick(findMenuItemButtonByLabel(container, template.label));
        dispatchClick(findMenuItemButtonByLabel(container, "Task"));

        const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        expect(markdownValue).toContain("#exam");
        expect(markdownValue).toContain(expectedTaskVariant.payload);
        expect(markdownValue).toContain("#endexam");
        expect(markdownValue.match(/^#exam$/gm)).toHaveLength(1);
        expect(markdownValue.match(/^#endexam$/gm)).toHaveLength(1);
        expect(markdownValue.startsWith("#exam\n")).toBe(true);
        expect(markdownValue).not.toContain("----------------------------\n#exam");

        const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea).toBeTruthy();
        const selectedText = textarea && textarea.selectionStart !== null && textarea.selectionEnd !== null
          ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)
          : "";
        expect(selectedText).toBe(expectedTaskVariant.firstPlaceholder);

        cleanup();
      }
    });
  });

  it("increments the next task number when inserting an Advanced task into an existing exam", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "#exam",
        "1) Existing task",
        "Answer: Existing answer",
        "---",
        "#endexam",
      ].join("\n");
      const expectedTaskVariant = buildAdvancedInsertTemplateVariant(
        ADVANCED_INSERT_TEMPLATE_CATALOG.find((template) => template.mode === "m2")!,
        "task",
        { sequenceNumber: 2 },
      );

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-task-template-existing-exam-numbering"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const hrInsertButton = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-overlay-row[data-md-block-kind='hr'] .markdown-hybrid-block-insert-button",
      );
      expect(hrInsertButton).toBeTruthy();

      dispatchClick(hrInsertButton);
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, "Multiple Choice (n)"));
      expect(findMenuItemButtonByLabel(container, "Task")?.textContent).toContain("2)");
      dispatchClick(findMenuItemButtonByLabel(container, "Task"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toContain(expectedTaskVariant.payload);
      expect(markdownValue.match(/^2\) TASK HEADING$/m)).toHaveLength(1);
      expect(markdownValue).toContain("#endexam");
      expect(markdownValue.match(/^#exam$/gm)).toHaveLength(1);
      expect(markdownValue.match(/^#endexam$/gm)).toHaveLength(1);

      cleanup();
    });
  });

  it("allows overriding the advanced sequence number down to 1 for task inserts", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "#exam",
        "1) Existing task",
        "Answer: Existing answer",
        "---",
        "#endexam",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-task-template-manual-sequence-override"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const hrInsertButton = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-overlay-row[data-md-block-kind='hr'] .markdown-hybrid-block-insert-button",
      );
      expect(hrInsertButton).toBeTruthy();

      dispatchClick(hrInsertButton);
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, "Answer Marker"));

      const sequenceInput = container.querySelector<HTMLInputElement>("input[aria-label='Task number']");
      const decreaseButton = findButtonByAriaLabel(container, "Decrease task number");
      expect(sequenceInput).toBeTruthy();
      expect(decreaseButton).toBeTruthy();
      expect(sequenceInput?.value).toBe("2");

      dispatchClick(decreaseButton);
      expect(sequenceInput?.value).toBe("1");

      // Sequence numbers are allowed to duplicate and cannot go below 1.
      dispatchClick(decreaseButton);
      expect(sequenceInput?.value).toBe("1");
      expect(findMenuItemButtonByLabel(container, "Task")?.textContent).toContain("1)");
      expect(findMenuItemButtonByLabel(container, "Card")?.textContent).toContain("1)");

      dispatchClick(findMenuItemButtonByLabel(container, "Task"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toContain("1) TASK HEADING");
      expect(markdownValue.match(/^1\) /gm)).toHaveLength(2);
      expect(markdownValue.match(/^#exam$/gm)).toHaveLength(1);
      expect(markdownValue.match(/^#endexam$/gm)).toHaveLength(1);

      cleanup();
    });
  });

  it("uses the manually selected advanced sequence number for card inserts", () => {
    withImmediateRaf(() => {
      const template = ADVANCED_INSERT_TEMPLATE_CATALOG.find((entry) => entry.mode === "cl");
      expect(template).toBeTruthy();
      const expectedCardVariant = buildAdvancedInsertTemplateVariant(template!, "card", {
        sequenceNumber: 4,
      });

      const Harness = () => {
        const [markdown, setMarkdown] = useState("");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-card-template-manual-sequence-override"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, template?.label ?? ""));

      const sequenceInput = container.querySelector<HTMLInputElement>("input[aria-label='Task number']");
      expect(sequenceInput).toBeTruthy();
      expect(sequenceInput?.value).toBe("1");
      applyInputValue(sequenceInput, "4");
      expect(sequenceInput?.value).toBe("4");
      expect(findMenuItemButtonByLabel(container, "Task")?.textContent).toContain("4)");
      expect(findMenuItemButtonByLabel(container, "Card")?.textContent).toContain("4)");

      dispatchClick(findMenuItemButtonByLabel(container, "Card"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toBe(expectedCardVariant.payload);

      cleanup();
    });
  });

  it("wraps first inserted task in existing markdown and keeps insertion order between surrounding content", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "Intro paragraph",
        "",
        "Footer paragraph",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-task-template-first-wrap-existing-content"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const paragraphInsertButton = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-overlay-row[data-md-block-kind='paragraph'] .markdown-hybrid-block-insert-button",
      );
      expect(paragraphInsertButton).toBeTruthy();

      dispatchClick(paragraphInsertButton);
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, "Answer Marker"));
      dispatchClick(findMenuItemButtonByLabel(container, "Task"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue.startsWith("#exam\n")).toBe(true);
      const introIndex = markdownValue.indexOf("Intro paragraph");
      const taskHeadingIndex = markdownValue.indexOf("1) TASK HEADING");
      const footerIndex = markdownValue.indexOf("Footer paragraph");
      expect(introIndex).toBeGreaterThanOrEqual(0);
      expect(taskHeadingIndex).toBeGreaterThan(introIndex);
      expect(footerIndex).toBeGreaterThan(taskHeadingIndex);
      expect(markdownValue.endsWith("\n#endexam")).toBe(true);

      cleanup();
    });
  });

  it("shares sequence numbering between inserted tasks and cards", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-template-shared-sequence-task-card"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, "Multiple Choice (1)"));
      dispatchClick(findMenuItemButtonByLabel(container, "Task"));
      const taskTextarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(taskTextarea).toBeTruthy();
      blurTextarea(taskTextarea);
      const markdownAfterTaskBlur = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownAfterTaskBlur.match(/^1\) TASK HEADING$/m)).toHaveLength(1);

      const hrInsertButton = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-overlay-row[data-md-block-kind='hr'] .markdown-hybrid-block-insert-button",
      );
      expect(hrInsertButton).toBeTruthy();
      dispatchClick(hrInsertButton);
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, "Multiple Choice (1)"));
      expect(findMenuItemButtonByLabel(container, "Card")?.textContent).toContain("2)");
      dispatchClick(findMenuItemButtonByLabel(container, "Card"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue.match(/^1\) TASK HEADING$/m)).toHaveLength(1);
      expect(markdownValue.match(/^2\) CARD HEADING$/m)).toHaveLength(1);
      expect(markdownValue.match(/^#exam$/gm)).toHaveLength(1);
      expect(markdownValue.match(/^#endexam$/gm)).toHaveLength(1);

      cleanup();
    });
  });

  it("uses one global sequence across exam tasks and cards inside/outside exam blocks", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "#exam",
        "#card",
        "1) CARD HEADING",
        "QUESTION TEXT",
        "a) OPTION A",
        "b) OPTION B",
        "c) OPTION C",
        "d) OPTION D",
        "-a",
        "-c",
        "#endcard",
        "",
        "#card",
        "2) CARD HEADING",
        "QUESTION TEXT",
        "a) OPTION A",
        "b) OPTION B",
        "c) OPTION C",
        "-a",
        "#endcard",
        "",
        "1) TASK HEADING",
        "TASK DESCRIPTION WITH %ANSWER1% AND %ANSWER2%",
        "",
        "TOKEN BANK \"TOKENA\", \"TOKENB\", \"TOKENC\"",
        "",
        "---",
        "",
        "#endexam",
        "",
        "#card",
        "3) CARD HEADING",
        "QUESTION TEXT",
        "a) OPTION A",
        "b) OPTION B",
        "c) OPTION C",
        "-a",
        "#endcard",
      ].join("\n");
      const expectedTaskVariant = buildAdvancedInsertTemplateVariant(
        ADVANCED_INSERT_TEMPLATE_CATALOG.find((template) => template.mode === "qa")!,
        "task",
        { sequenceNumber: 4 },
      );
      const expectedCardVariant = buildAdvancedInsertTemplateVariant(
        ADVANCED_INSERT_TEMPLATE_CATALOG.find((template) => template.mode === "m1")!,
        "card",
        { sequenceNumber: 5 },
      );

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-template-global-sequence-across-exam-and-cards"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const hrInsertButton = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-overlay-row[data-md-block-kind='hr'] .markdown-hybrid-block-insert-button",
      );
      expect(hrInsertButton).toBeTruthy();
      dispatchClick(hrInsertButton);
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, "Answer Marker"));
      expect(findMenuItemButtonByLabel(container, "Task")?.textContent).toContain("4)");
      dispatchClick(findMenuItemButtonByLabel(container, "Task"));
      const taskTextarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(taskTextarea).toBeTruthy();
      blurTextarea(taskTextarea);
      const markdownAfterTaskBlur = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownAfterTaskBlur).toContain(expectedTaskVariant.payload);
      expect(markdownAfterTaskBlur.match(/^4\) TASK HEADING$/m)).toHaveLength(1);
      expect(markdownAfterTaskBlur.match(/^1\) TASK HEADING$/m)).toHaveLength(1);

      const cardInsertButtons = container.querySelectorAll<HTMLButtonElement>(
        ".markdown-hybrid-overlay-row[data-md-block-kind='card-block'] .markdown-hybrid-block-insert-button",
      );
      const lastCardInsertButton = cardInsertButtons[cardInsertButtons.length - 1];
      expect(lastCardInsertButton).toBeTruthy();
      dispatchClick(lastCardInsertButton ?? null);
      dispatchClick(findButtonByExactText(container, "Advanced"));
      dispatchClick(findMenuItemButtonByLabel(container, "Multiple Choice (1)"));
      expect(findMenuItemButtonByLabel(container, "Card")?.textContent).toContain("5)");
      dispatchClick(findMenuItemButtonByLabel(container, "Card"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toContain(expectedTaskVariant.payload);
      expect(markdownValue).toContain(expectedCardVariant.payload);
      expect(markdownValue.match(/^4\) TASK HEADING$/m)).toHaveLength(1);
      expect(markdownValue.match(/^5\) CARD HEADING$/m)).toHaveLength(1);

      cleanup();
    });
  });

  it("keeps ordered-list normalization for non-exam dot-delimited lists on blur", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["9. Outside exam A", "5. Outside exam B"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="ordered-list-non-exam-normalization"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      blurTextarea(textarea);

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toBe(["1. Outside exam A", "2. Outside exam B"].join("\n"));

      cleanup();
    });
  });

  it("keeps task-style n) numbering outside exam on blur", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["4) TASK HEADING", "TASK DESCRIPTION", "-true"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="ordered-list-task-style-outside-exam-no-renumber"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      blurTextarea(textarea);

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("inserts Image embed links as standalone isolated blocks from the Insert menu", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["Top paragraph", "", "Bottom paragraph"].join("\n");
      const vaultPngAssets = [
        {
          path: "/vault/images/example.png",
          relative_path: "images/example.png",
          file_name: "example.png",
          extension: "png" as const,
        },
      ];

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="insert-image-embed"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={vaultPngAssets}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
      dispatchClick(findButtonByExactText(container, "Links"));
      dispatchClick(findMenuItemButtonByLabel(container, "Image embed"));
      dispatchClick(container.querySelector<HTMLButtonElement>(".vault-png-picker-item"));

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toContain("![[images/example.png]]");
      expect(/(?:^|\n)!\[\[images\/example\.png\]\](?:\n|$)/.test(markdownValue)).toBe(true);

      const lines = markdownValue.split("\n");
      const embedIndex = lines.findIndex((line) => line === "![[images/example.png]]");
      expect(embedIndex).toBeGreaterThan(0);
      expect(lines[embedIndex - 1]?.trim()).toBe("");
      expect(lines[embedIndex + 1]?.trim()).toBe("");

      cleanup();
    });
  });

  it("renders legacy card-like content from the removed Page insert without crashing", () => {
    const legacyPageMarkdown = "#card\nQuestion or title\nAnswer: Answer or content\n#endcard";
    const Harness = () => {
      const [markdown, setMarkdown] = useState(legacyPageMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="legacy-page-template-content"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    expect(container.querySelector(".markdown-hybrid-editor")).toBeTruthy();
    expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]").length).toBeGreaterThan(0);
    cleanup();
  });

  it("renders #card ... #endcard as one card block and nests #help content inside a subbox", () => {
    const markdown = [
      "Before",
      "#card",
      "QUESTION TEXT",
      "",
      "#help",
      "Hint line",
      "#helpend",
      "",
      "Answer: ANSWER TEXT",
      "#endcard",
      "After",
    ].join("\n");

    const Harness = () => {
      const [value, setValue] = useState(markdown);
      return (
        <MarkdownHybridEditor
          historyKey="card-block-preview-subbox"
          markdown={value}
          mode="edit"
          onChange={setValue}
          renderPreview={(previewValue) => <div>{previewValue}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
    );
    expect(blocks).toHaveLength(3);
    expect(
      container.querySelector(".markdown-hybrid-block[data-md-block-kind='card-block']"),
    ).toBeTruthy();
    const cardFrame = container.querySelector<HTMLElement>(".markdown-hybrid-card-block-frame");
    expect(cardFrame?.textContent ?? "").toContain("#card");
    expect(cardFrame?.textContent ?? "").toContain("#endcard");
    expect(cardFrame?.textContent ?? "").toContain("#help");
    expect(cardFrame?.textContent ?? "").toContain("#helpend");
    const helpSubboxes = container.querySelectorAll<HTMLElement>(".markdown-hybrid-card-help-subbox");
    expect(helpSubboxes).toHaveLength(1);
    expect(helpSubboxes[0]?.textContent ?? "").toContain("#help");
    expect(helpSubboxes[0]?.textContent ?? "").toContain("#helpend");
    const frameChildren = Array.from(cardFrame?.children ?? []);
    expect(frameChildren[1]?.classList.contains("markdown-hybrid-card-help-subbox")).toBe(true);
    cleanup();
  });

  it("renders png embeds and svg fences inside #card previews as resolved media", () => {
    const markdown = [
      "#card",
      "![[images/example.png|Example image]]",
      "",
      "```svg",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#000"/></svg>',
      "```",
      "",
      "Question text",
      "#endcard",
    ].join("\n");

    const { container, cleanup } = render(
      <MarkdownHybridEditor
        historyKey="card-block-media-preview"
        markdown={markdown}
        mode="edit"
        onChange={() => undefined}
        vaultPngAssets={[
          {
            path: "/vault/images/example.png",
            relative_path: "images/example.png",
            file_name: "example.png",
            extension: "png",
          },
        ]}
        renderPreview={(previewValue) => <div>{previewValue}</div>}
      />,
    );

    const image = container.querySelector<HTMLImageElement>(".flashcard-media-image");
    expect(image?.getAttribute("alt")).toBe("Example image");
    expect(container.querySelector(".flashcard-media-svg-surface svg")).toBeTruthy();
    expect(container.querySelector(".markdown-hybrid-card-block-frame")?.textContent ?? "").toContain(
      "Question text",
    );
    cleanup();
  });

  it("renders standalone svg fences as media preview and keeps source on focus with synced height", () => {
    withImmediateRaf(() => {
      const markdown = [
        "```svg",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>',
        "```",
      ].join("\n");

      const Harness = () => {
        const [value, setValue] = useState(markdown);
        return (
          <MarkdownHybridEditor
            historyKey="standalone-svg-fence-preview"
            markdown={value}
            mode="edit"
            onChange={setValue}
            renderPreview={(previewValue) => <div>{previewValue}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));

      expect(container.querySelector(".flashcard-media-svg-surface svg")).toBeTruthy();
      const previewBlock = container.querySelector<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index='0'] .markdown-hybrid-block-preview.markdown-hybrid-media-block-preview",
      );
      expect(previewBlock).toBeTruthy();
      Object.defineProperty(previewBlock!, "getBoundingClientRect", {
        configurable: true,
        value: () => createMockRect(196),
      });

      const textarea = activateBlockEditor(container, 0);
      expect(textarea?.value).toBe(markdown);
      expect(textarea?.classList.contains("markdown-hybrid-code-fence-editor")).toBe(true);
      expect(textarea?.style.height).toBe("196px");
      expect(
        container.querySelector(
          ".markdown-hybrid-block[data-md-block-index='0'][data-md-code-fence-media-preview='true']",
        ),
      ).toBeTruthy();

      cleanup();
    });
  });

  it("keeps default auto-height behavior for non-svg code fences", () => {
    withImmediateRaf(() => {
      const markdown = ["```txt", "line 1", "line 2", "```"].join("\n");

      const Harness = () => {
        const [value, setValue] = useState(markdown);
        return (
          <MarkdownHybridEditor
            historyKey="non-svg-code-fence-height"
            markdown={value}
            mode="edit"
            onChange={setValue}
            renderPreview={(previewValue) => <div>{previewValue}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const textarea = activateBlockEditor(container, 0);
      expect(textarea?.value).toBe(markdown);
      expect(textarea?.classList.contains("markdown-hybrid-code-fence-editor")).toBe(false);
      expect(
        container.querySelector(
          ".markdown-hybrid-block[data-md-block-index='0'][data-md-code-fence-media-preview='true']",
        ),
      ).toBeNull();

      cleanup();
    });
  });

  it("keeps synced svg code-fence editor height while long source remains scrollable", () => {
    withImmediateRaf(() => {
      const markdown = [
        "```svg",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">',
        "  <path d=\"M1 1 L15 1 L15 15 L1 15 Z\" />",
        "  <text x=\"2\" y=\"10\">VERY_LONG_UNBROKEN_LINE_FOR_SCROLL_BEHAVIOR_TEST</text>",
        "</svg>",
        "```",
      ].join("\n");

      const Harness = () => {
        const [value, setValue] = useState(markdown);
        return (
          <MarkdownHybridEditor
            historyKey="svg-code-fence-scroll-height"
            markdown={value}
            mode="edit"
            onChange={setValue}
            renderPreview={(previewValue) => <div>{previewValue}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const previewBlock = container.querySelector<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index='0'] .markdown-hybrid-block-preview.markdown-hybrid-media-block-preview",
      );
      expect(previewBlock).toBeTruthy();
      Object.defineProperty(previewBlock!, "getBoundingClientRect", {
        configurable: true,
        value: () => createMockRect(144),
      });

      const textarea = activateBlockEditor(container, 0);
      expect(textarea?.classList.contains("markdown-hybrid-code-fence-editor")).toBe(true);
      expect(textarea?.style.height).toBe("144px");
      expect(textarea?.value).toContain("VERY_LONG_UNBROKEN_LINE_FOR_SCROLL_BEHAVIOR_TEST");

      cleanup();
    });
  });

  it("shows PNG embed preview when inactive and raw source when the block is focused", () => {
    withImmediateRaf(() => {
      const markdown = "![[images/example.png]]";

      const Harness = () => {
        const [value, setValue] = useState(markdown);
        return (
          <MarkdownHybridEditor
            historyKey="image-embed-focus-source-toggle"
            markdown={value}
            mode="edit"
            onChange={setValue}
            vaultPngAssets={[
              {
                path: "/vault/images/example.png",
                relative_path: "images/example.png",
                file_name: "example.png",
                extension: "png",
              },
            ]}
            renderPreview={(previewValue) => <div>{previewValue}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      expect(container.querySelector(".flashcard-media-image")).toBeTruthy();

      const textarea = activateBlockEditor(container, 0);
      expect(textarea?.value).toBe("![[images/example.png]]");

      cleanup();
    });
  });

  it("shows the replace action only for standalone image-embed blocks", () => {
    const markdown = ["# Heading", "", "![[images/example.png]]", "", "Paragraph"].join("\n");

    const { container, cleanup } = render(
      <MarkdownHybridEditor
        historyKey="image-embed-replace-action-visibility"
        markdown={markdown}
        mode="edit"
        onChange={() => undefined}
        vaultPngAssets={[
          {
            path: "/vault/images/example.png",
            relative_path: "images/example.png",
            file_name: "example.png",
            extension: "png",
          },
        ]}
        renderPreview={(previewValue) => <div>{previewValue}</div>}
      />,
    );

    const triggers = container.querySelectorAll(".markdown-hybrid-image-embed-replace-trigger");
    expect(triggers).toHaveLength(1);
    expect(findImageEmbedReplaceTrigger(container, 2)).toBeTruthy();
    expect(findImageEmbedReplaceTrigger(container, 0)).toBeNull();
    expect(findImageEmbedReplaceTrigger(container, 4)).toBeNull();

    cleanup();
  });

  it("replaces an existing image-embed PNG path in-place, keeps label, and supports undo/redo", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "Top paragraph",
        "",
        "![[images/old.png|Old label]]",
        "",
        "Bottom paragraph",
      ].join("\n");
      const vaultPngAssets = [
        {
          path: "/vault/images/new.png",
          relative_path: "images/new.png",
          file_name: "new.png",
          extension: "png" as const,
        },
        {
          path: "/vault/images/old.png",
          relative_path: "images/old.png",
          file_name: "old.png",
          extension: "png" as const,
        },
      ];

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="image-embed-replace"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={vaultPngAssets}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      const editor = container.querySelector<HTMLElement>(".markdown-hybrid-editor");
      const replaceShell = container.querySelector<HTMLElement>(".markdown-hybrid-image-embed-replace-shell");
      expect(replaceShell).toBeTruthy();
      expect(replaceShell?.classList.contains("is-open")).toBe(false);

      dispatchClick(findImageEmbedReplaceTrigger(container, 2));
      const picker = container.querySelector<HTMLElement>(".markdown-hybrid-image-embed-picker");
      expect(picker).toBeTruthy();
      expect(replaceShell?.classList.contains("is-open")).toBe(true);

      const searchInput = picker?.querySelector<HTMLInputElement>("input[type='search']") ?? null;
      expect(searchInput).toBeTruthy();
      expect(document.activeElement).toBe(searchInput);

      applyTextInput(searchInput, "new");
      dispatchClick(picker?.querySelector<HTMLButtonElement>(".vault-png-picker-item") ?? null);

      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeNull();
      expect(replaceShell?.classList.contains("is-open")).toBe(false);
      expect(readMarkdown()).toContain("![[images/new.png|Old label]]");
      expect(readMarkdown()).not.toContain("![[images/old.png|Old label]]");
      expect(readMarkdown().match(/!\[\[[^\]]+\.png(?:\|[^\]]+)?\]\]/g)).toHaveLength(1);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='image-embed']")).toHaveLength(1);
      expect(container.querySelector(".flashcard-media-image")).toBeTruthy();

      dispatchKeyDown(editor, "z", { ctrlKey: true });
      expect(readMarkdown()).toContain("![[images/old.png|Old label]]");

      dispatchKeyDown(editor, "y", { ctrlKey: true });
      expect(readMarkdown()).toContain("![[images/new.png|Old label]]");

      cleanup();
    });
  });

  it("keeps replace available for missing image-embed previews and replaces in-place", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "![[images/missing.png|Missing label]]";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="image-embed-replace-missing"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/new.png",
                  relative_path: "images/new.png",
                  file_name: "new.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      expect(container.querySelector(".flashcard-media-placeholder")).toBeTruthy();
      dispatchClick(findImageEmbedReplaceTrigger(container, 0));
      const picker = container.querySelector<HTMLElement>(".markdown-hybrid-image-embed-picker");
      expect(picker).toBeTruthy();

      const searchInput = picker?.querySelector<HTMLInputElement>("input[type='search']") ?? null;
      expect(searchInput).toBeTruthy();
      applyTextInput(searchInput, "new");
      dispatchClick(picker?.querySelector<HTMLButtonElement>(".vault-png-picker-item") ?? null);

      expect(readMarkdown()).toContain("![[images/new.png|Missing label]]");
      expect(readMarkdown()).not.toContain("![[images/missing.png|Missing label]]");
      expect(readMarkdown().match(/!\[\[[^\]]+\.png(?:\|[^\]]+)?\]\]/g)).toHaveLength(1);
      cleanup();
    });
  });

  it("closes the image replace picker with Escape and outside click without changing markdown", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "![[images/example.png]]";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="image-embed-replace-dismiss"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/example.png",
                  relative_path: "images/example.png",
                  file_name: "example.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchClick(findImageEmbedReplaceTrigger(container, 0));
      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeTruthy();
      dispatchWindowKeyDown("Escape");
      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeNull();
      expect(readMarkdown()).toBe(initialMarkdown);

      dispatchClick(findImageEmbedReplaceTrigger(container, 0));
      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeTruthy();
      act(() => {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      });
      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeNull();
      expect(readMarkdown()).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("treats selecting the same image in replace picker as no-op and closes cleanly", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "![[images/example.png|Label]]";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="image-embed-replace-same-image"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/example.png",
                  relative_path: "images/example.png",
                  file_name: "example.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchClick(findImageEmbedReplaceTrigger(container, 0));
      dispatchClick(container.querySelector<HTMLButtonElement>(".vault-png-picker-item"));

      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeNull();
      expect(readMarkdown()).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("auto-closes the image replace picker when the target block is removed externally", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "![[images/example.png]]";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <button type="button" data-testid="remove-image-embed" onClick={() => setMarkdown("Removed")}>
              Remove embed
            </button>
            <MarkdownHybridEditor
              historyKey="image-embed-replace-external-remove"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/example.png",
                  relative_path: "images/example.png",
                  file_name: "example.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      dispatchClick(findImageEmbedReplaceTrigger(container, 0));
      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeTruthy();
      dispatchClick(container.querySelector("[data-testid='remove-image-embed']"));
      expect(container.querySelector(".markdown-hybrid-image-embed-picker")).toBeNull();
      cleanup();
    });
  });

  it("keeps Enter inside a card body within the card block and does not create outer page blocks", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "QUESTION TEXT", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-enter-internal-no-leak"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      const caret = textarea?.value.indexOf("QUESTION TEXT") ?? -1;
      expect(caret).toBeGreaterThanOrEqual(0);
      setTextareaSelection(textarea, caret + "QUESTION TEXT".length);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe(["#card", "QUESTION TEXT", "", "#endcard"].join("\n"));
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(["#card", "QUESTION TEXT", "", "#endcard"].join("\n"));

      cleanup();
    });
  });

  it("keeps Shift+Enter at the top of a card block local until commit without duplicating blocks", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "#card",
        "QUESTION TEXT",
        "a) OPTION A",
        "b) OPTION B",
        "c) OPTION C",
        "d) OPTION D",
        "-a",
        "-c",
        "#endcard",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-shift-enter-top-line-no-duplicate"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      const questionLineEnd = textarea?.value.indexOf("QUESTION TEXT") ?? -1;
      expect(questionLineEnd).toBeGreaterThanOrEqual(0);
      setTextareaSelection(textarea, questionLineEnd + "QUESTION TEXT".length);

      dispatchKeyDown(textarea, "Enter", { shiftKey: true });
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "Enter", { shiftKey: true });
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");

      expect(textarea?.value).toBe([
        "#card",
        "QUESTION TEXT",
        "",
        "",
        "a) OPTION A",
        "b) OPTION B",
        "c) OPTION C",
        "d) OPTION D",
        "-a",
        "-c",
        "#endcard",
      ].join("\n"));
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe([
        "#card",
        "QUESTION TEXT",
        "",
        "",
        "a) OPTION A",
        "b) OPTION B",
        "c) OPTION C",
        "d) OPTION D",
        "-a",
        "-c",
        "#endcard",
      ].join("\n"));

      cleanup();
    });
  });

  it("keeps Enter at #endcard local until commit and reparses after blur", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "QUESTION TEXT", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-enter-exit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe(`${initialMarkdown}\n`);
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(`${initialMarkdown}\n`);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["card-block", "blank"]);

      cleanup();
    });
  });

  it("keeps Shift+Enter at #endcard local until commit and reparses after blur", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "QUESTION TEXT", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-shift-enter-exit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter", { shiftKey: true });

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe(`${initialMarkdown}\n`);
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(`${initialMarkdown}\n`);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["card-block", "blank"]);

      cleanup();
    });
  });

  it("keeps Enter inside a math block local until commit and reparses after blur", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["$$", "\\frac{a}{b}", "$$"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="math-enter-exit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe(`${initialMarkdown}\n`);
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(`${initialMarkdown}\n`);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["math-block", "blank"]);

      cleanup();
    });
  });

  it("opens the structural math toolbox and writes back the structured result on Apply", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("$$\n\n$$");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="math-toolbox-insert"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();

      dispatchClick(container.querySelector(".markdown-hybrid-math-toolbox-trigger"));
      const dialog = document.body.querySelector(".markdown-hybrid-structural-math-dialog");
      expect(dialog).toBeTruthy();

      const fracButton = findButtonByAriaLabel(document.body, "Fraction (Bruch)");
      expect(fracButton).toBeTruthy();
      dispatchClick(fracButton);

      expect(readMarkdown()).toBe("$$\n\n$$");
      expect(
        document.body.querySelector(".markdown-hybrid-structural-math-row.is-active"),
      ).toBeTruthy();

      dispatchClick(findButtonByExactText(document.body, "Apply"));
      const committedTextarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(committedTextarea?.value).toBe("$$\n\\frac{}{}\n$$");
      blurTextarea(committedTextarea);
      expect(readMarkdown()).toBe("$$\n\\frac{}{}\n$$");

      cleanup();
    });
  });

  it("restores the opening math snapshot on Cancel", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "$$\na+b\n$$";
      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="math-toolbox-cancel"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      activateBlockEditor(container, 0);
      dispatchClick(container.querySelector(".markdown-hybrid-math-toolbox-trigger"));
      dispatchClick(findButtonByAriaLabel(document.body, "Fraction (Bruch)"));
      dispatchClick(findButtonByExactText(document.body, "Cancel"));

      const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe(initialMarkdown);
      blurTextarea(textarea);
      expect(readMarkdown()).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("restores the opening math snapshot on close icon, backdrop, and Escape", () => {
    withImmediateRaf(() => {
      const runCancelCase = (
        historyKey: string,
        closeDialog: () => void,
      ) => {
        const initialMarkdown = "$$\na+b\n$$";
        const Harness = () => {
          const [markdown, setMarkdown] = useState(initialMarkdown);
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey={historyKey}
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const readMarkdown = () =>
          container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

        activateBlockEditor(container, 0);
        dispatchClick(container.querySelector(".markdown-hybrid-math-toolbox-trigger"));
        dispatchClick(findButtonByAriaLabel(document.body, "Fraction (Bruch)"));
        closeDialog();

        const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe(initialMarkdown);
        blurTextarea(textarea);
        expect(readMarkdown()).toBe(initialMarkdown);

        cleanup();
      };

      runCancelCase("math-toolbox-close-icon", () => {
        dispatchClick(document.body.querySelector(".modal-panel-close"));
      });
      runCancelCase("math-toolbox-backdrop", () => {
        dispatchClick(document.body.querySelector(".modal-backdrop"));
      });
      runCancelCase("math-toolbox-escape", () => {
        dispatchWindowKeyDown("Escape");
      });
    });
  });

  it("starts the canvas at 125% zoom and updates the canvas scale without changing the block content", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "$$\na+b\n$$";
      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="math-toolbox-zoom"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      activateBlockEditor(container, 0);
      dispatchClick(container.querySelector(".markdown-hybrid-math-toolbox-trigger"));

      const zoomSelect = document.body.querySelector<HTMLSelectElement>("select[aria-label='Canvas zoom']");
      expect(zoomSelect?.value).toBe("125");

      const canvas = document.body.querySelector<HTMLElement>(".markdown-hybrid-structural-math-canvas");
      expect(canvas?.style.getPropertyValue("--md-math-canvas-scale")).toBe("1.25");

      applySelectValue(zoomSelect, "150");
      expect(canvas?.style.getPropertyValue("--md-math-canvas-scale")).toBe("1.5");
      expect(readMarkdown()).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("renders display glyphs instead of raw LaTeX commands in structured mode", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("$$\n\\pi\n$$");
        return (
          <MarkdownHybridEditor
            historyKey="math-toolbox-display-glyphs"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      activateBlockEditor(container, 0);
      dispatchClick(container.querySelector(".markdown-hybrid-math-toolbox-trigger"));

      const canvas = document.body.querySelector<HTMLElement>(".markdown-hybrid-structural-math-canvas");
      expect(canvas?.textContent).toContain("π");
      expect(canvas?.textContent).not.toContain("\\pi");

      cleanup();
    });
  });

  it("renders fraction slots and matrix cells as structured grid elements", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("$$\n\n$$");
        return (
          <MarkdownHybridEditor
            historyKey="math-toolbox-grid-cells"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      activateBlockEditor(container, 0);
      dispatchClick(container.querySelector(".markdown-hybrid-math-toolbox-trigger"));

      dispatchClick(findButtonByAriaLabel(document.body, "Fraction (Bruch)"));
      expect(
        document.body.querySelectorAll(
          ".markdown-hybrid-structural-math-node.is-fraction .markdown-hybrid-structural-math-fraction-slot",
        ).length,
      ).toBe(2);

      dispatchClick(findButtonByAriaLabel(document.body, "2x2 Matrix"));
      expect(
        document.body.querySelectorAll(".markdown-hybrid-structural-math-matrix-cell").length,
      ).toBeGreaterThanOrEqual(4);

      cleanup();
    });
  });

  it("does not render a separate math preview while the math block is actively being edited", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("$$\n\\frac{a}{b}\n$$");
        return (
          <MarkdownHybridEditor
            historyKey="math-no-separate-active-preview"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      expect(container.querySelector(".markdown-hybrid-math-editor")).toBeTruthy();
      expect(
        container.querySelector(
          ".markdown-hybrid-block[data-md-block-index='0'] .markdown-hybrid-math-preview-shell",
        ),
      ).toBeNull();

      cleanup();
    });
  });

  it("converts single-line $$ ... $$ input into the persisted multiline math block form", () => {
    withImmediateRaf(() => {
      const initialMarkdown =
        String.raw`$$ \text{RECHNUNGSADRESSE.PK} = \text{KUNDEID} + \text{ADRESSEID} $$`;

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="math-single-line-normalization"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      expect(
        container.querySelector(".markdown-hybrid-block[data-md-block-kind='math-block']"),
      ).toBeTruthy();

      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      expect(textarea?.classList.contains("markdown-hybrid-math-editor")).toBe(true);

      act(() => {
        textarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
      });

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toBe([
        "$$",
        String.raw`\text{RECHNUNGSADRESSE.PK} = \text{KUNDEID} + \text{ADRESSEID}`,
        "$$",
      ].join("\n"));

      cleanup();
    });
  });

  it("keeps typed letters or digits after #endcard inside the current card block", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "QUESTION TEXT", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-endcard-typed-char-exit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      applyTextareaInput(textarea, ["#card", "QUESTION TEXT", "a", "#endcard"].join("\n"));

      expect(readMarkdown()).toBe(initialMarkdown);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["card-block"]);

      textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='0'] .markdown-hybrid-block-editor",
      );
      expect(textarea).toBeTruthy();
      expect(textarea?.value).toBe(["#card", "QUESTION TEXT", "a", "#endcard"].join("\n"));

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(["#card", "QUESTION TEXT", "a", "#endcard"].join("\n"));

      cleanup();
    });
  });

  it("keeps pasted lines after #endcard local while editing and commits them as following blocks", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "QUESTION TEXT", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-endcard-paste-no-duplicate-block"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, `${initialMarkdown}\nPASTED TEXT`);

      expect(readMarkdown()).toBe(initialMarkdown);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='paragraph']"),
      ).toHaveLength(0);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(`${initialMarkdown}\nPASTED TEXT`);
      expect(
        Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
        ).map((block) => block.getAttribute("data-md-block-kind")),
      ).toEqual(["card-block", "paragraph"]);

      cleanup();
    });
  });

  it("commits a heading added after #endcard as a separate heading block", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "QUESTION TEXT", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-endcard-heading-follow-up"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, `${initialMarkdown}\n## Follow up`);

      expect(readMarkdown()).toBe(initialMarkdown);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='heading']"),
      ).toHaveLength(0);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(`${initialMarkdown}\n## Follow up`);
      expect(
        Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
        ).map((block) => block.getAttribute("data-md-block-kind")),
      ).toEqual(["card-block", "heading"]);

      cleanup();
    });
  });

  it("persists removing card wrappers and reparses the result after blur", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "## Heading", "Body text", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-wrapper-removal-persists"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, ["## Heading", "Body text"].join("\n"));

      expect(readMarkdown()).toBe(initialMarkdown);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe(["## Heading", "Body text"].join("\n"));
      expect(
        Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
        ).map((block) => block.getAttribute("data-md-block-kind")),
      ).toEqual(["heading", "paragraph"]);

      cleanup();
    });
  });

  it("normalizes hash heading spacing only when the caret is on that hash line", () => {
    const initialMarkdown = ["##HeadingNoSpace", "Other line"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <div>
          <div data-testid="markdown-value">{markdown}</div>
          <MarkdownHybridEditor
            historyKey="hash-line-normalization-caret"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        </div>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const readMarkdown = () =>
      container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
    const block = container.querySelector<HTMLElement>(".markdown-hybrid-block[data-md-block-index='0']");
    expect(block).toBeTruthy();

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

    const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
    expect(textarea).toBeTruthy();

    act(() => {
      const pos = (textarea?.value.indexOf("Other line") ?? 0) + 1;
      textarea?.setSelectionRange(pos, pos);
      textarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    });

    expect(readMarkdown()).toBe(initialMarkdown);

    act(() => {
      const refreshedBlock = container.querySelector<HTMLElement>(
        ".markdown-hybrid-block[data-md-block-index='0']",
      );
      refreshedBlock?.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
        }),
      );
    });

    const secondTextarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
    expect(secondTextarea).toBeTruthy();

    act(() => {
      secondTextarea?.setSelectionRange(2, 2);
      secondTextarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    });

    expect(readMarkdown()).toBe(["## HeadingNoSpace", "Other line"].join("\n"));
    cleanup();
  });

  it("keeps multi-hash heading markers intact when normalizing spacing", () => {
    const initialMarkdown = "###Titel";

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <div>
          <div data-testid="markdown-value">{markdown}</div>
          <MarkdownHybridEditor
            historyKey="hash-marker-integrity"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        </div>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const readMarkdown = () =>
      container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
    const textarea = activateBlockEditor(container, 0);
    expect(textarea).toBeTruthy();

    act(() => {
      textarea?.setSelectionRange(3, 3);
      textarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    });

    expect(readMarkdown()).toBe("### Titel");
    expect(readMarkdown().includes("## #")).toBe(false);
    cleanup();
  });

  it("keeps pure hash marker lines unchanged when committing from the editor", () => {
    for (const marker of ["#", "##", "###", "####"]) {
      const Harness = () => {
        const [markdown, setMarkdown] = useState(marker);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey={`heading-pure-marker-${marker.length}`}
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();

      act(() => {
        textarea?.setSelectionRange(marker.length, marker.length);
        textarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
      });

      expect(readMarkdown()).toBe(marker);
      if (marker.length >= 3) {
        expect(readMarkdown().includes(`${"#".repeat(marker.length - 1)} #`)).toBe(false);
      }
      cleanup();
    }
  });

  it("escapes hash-only heading content in hybrid preview for supported heading levels", () => {
    const previewValues: string[] = [];
    const { cleanup } = render(
      <MarkdownHybridEditor
        historyKey="preview-heading-hash-only-content"
        markdown={["## #", "### #", "#### #"].join("\n")}
        mode="edit"
        onChange={() => undefined}
        renderPreview={(value) => {
          previewValues.push(value);
          return <div>{value}</div>;
        }}
      />,
    );

    expect(previewValues).toContain("## &#35;");
    expect(previewValues).toContain("### &#35;");
    expect(previewValues).toContain("#### &#35;");
    cleanup();
  });

  it("does not escape non-hash-only heading content in hybrid preview", () => {
    const previewValues: string[] = [];
    const { cleanup } = render(
      <MarkdownHybridEditor
        historyKey="preview-heading-hash-content-guard"
        markdown="## # Titel"
        mode="edit"
        onChange={() => undefined}
        renderPreview={(value) => {
          previewValues.push(value);
          return <div>{value}</div>;
        }}
      />,
    );

    expect(previewValues).toContain("## # Titel");
    expect(previewValues).not.toContain("## &#35; Titel");
    cleanup();
  });

  it("keeps ## # unchanged in persisted markdown when committing from editor", () => {
    const initialMarkdown = "## #";

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <div>
          <div data-testid="markdown-value">{markdown}</div>
          <MarkdownHybridEditor
            historyKey="heading-hash-only-preview-only"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        </div>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const readMarkdown = () =>
      container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
    const textarea = activateBlockEditor(container, 0);
    expect(textarea).toBeTruthy();

    act(() => {
      textarea?.setSelectionRange(4, 4);
      textarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    });

    expect(readMarkdown()).toBe("## #");
    cleanup();
  });

  it("preserves existing unsupported heading marker escaping for level 5 and 6", () => {
    const previewValues: string[] = [];
    const { cleanup } = render(
      <MarkdownHybridEditor
        historyKey="preview-unsupported-heading-escape-guard"
        markdown={["##### Heading", "###### Heading"].join("\n")}
        mode="edit"
        onChange={() => undefined}
        renderPreview={(value) => {
          previewValues.push(value);
          return <div>{value}</div>;
        }}
      />,
    );

    expect(
      previewValues.some((value) => value.includes("&#35;&#35;&#35;&#35;&#35; Heading")),
    ).toBe(true);
    expect(
      previewValues.some((value) => value.includes("&#35;&#35;&#35;&#35;&#35;&#35; Heading")),
    ).toBe(true);
    cleanup();
  });

  it("does not split overlong hash marker runs when normalizing spacing", () => {
    const initialMarkdown = "#######Titel";

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <div>
          <div data-testid="markdown-value">{markdown}</div>
          <MarkdownHybridEditor
            historyKey="hash-marker-overlong-no-split"
            markdown={markdown}
            mode="edit"
            onChange={setMarkdown}
            renderPreview={(value) => <div>{value}</div>}
          />
        </div>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const readMarkdown = () =>
      container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
    const textarea = activateBlockEditor(container, 0);
    expect(textarea).toBeTruthy();

    act(() => {
      textarea?.setSelectionRange(7, 7);
      textarea?.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    });

    expect(readMarkdown()).toBe("#######Titel");
    expect(readMarkdown().includes("###### #")).toBe(false);
    cleanup();
  });

  it("keeps Enter inside a paragraph local until blur commits the draft", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "Alpha Beta";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="paragraph-enter-local-commit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, "Alpha".length);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("Alpha\n Beta");
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe("Alpha\n Beta");

      cleanup();
    });
  });

  it("keeps Enter inside heading and blank blocks local until blur reparses them", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["## Heading", "", "Body"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="heading-blank-enter-local-commit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("## Heading\n");
      expect(readMarkdown()).toBe(initialMarkdown);
      blurTextarea(textarea);

      expect(readMarkdown()).toBe(["## Heading", "", "", "Body"].join("\n"));
      textarea = activateBlockEditor(container, 2);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, 0);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("\n");
      expect(readMarkdown()).toBe(["## Heading", "", "", "Body"].join("\n"));
      blurTextarea(textarea);

      expect(readMarkdown()).toBe(["## Heading", "", "", "", "Body"].join("\n"));

      cleanup();
    });
  });

  it("commits the previous draft exactly once when switching to another block", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["# One", "# Two"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="block-switch-commit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "# One updated");
      expect(readMarkdown()).toBe(initialMarkdown);

      textarea = activateBlockEditor(container, 1);
      expect(readMarkdown()).toBe(["# One updated", "# Two"].join("\n"));
      expect(textarea?.value).toBe("# Two");

      cleanup();
    });
  });

  it("commits via Ctrl+Enter and Cmd+Enter and exits the active block editor", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "Alpha";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="explicit-commit-shortcuts"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha Ctrl");
      dispatchKeyDown(textarea, "Enter", { ctrlKey: true });

      expect(readMarkdown()).toBe("Alpha Ctrl");
      expect(container.querySelector(".markdown-hybrid-block-editor")).toBeNull();

      textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha Cmd");
      dispatchKeyDown(textarea, "Enter", { metaKey: true });

      expect(readMarkdown()).toBe("Alpha Cmd");
      expect(container.querySelector(".markdown-hybrid-block-editor")).toBeNull();

      cleanup();
    });
  });

  it("discards the local draft on Escape and leaves committed markdown untouched", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "Alpha";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="escape-discards-draft"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha draft");
      expect(readMarkdown()).toBe(initialMarkdown);

      dispatchKeyDown(textarea, "Escape");
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(container.querySelector(".markdown-hybrid-block-editor")).toBeNull();

      cleanup();
    });
  });

  it("defers blur commits until compositionend finishes", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "Alpha";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="composition-defers-commit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      dispatchCompositionEvent(textarea, "compositionstart");
      applyTextareaInput(textarea, "Alpha\nBeta");
      blurTextarea(textarea);

      expect(readMarkdown()).toBe(initialMarkdown);
      expect(container.querySelector(".markdown-hybrid-block-editor")).toBeTruthy();

      dispatchCompositionEvent(textarea, "compositionend");
      expect(readMarkdown()).toBe("Alpha\nBeta");
      expect(container.querySelector(".markdown-hybrid-block-editor")).toBeNull();

      cleanup();
    });
  });

  it("keeps Enter in a quote block local until commit without creating new boxes", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "> Quote text";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="quote-enter-continue"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("> Quote text\n");
      expect(readMarkdown()).toBe(initialMarkdown);
      expect(textarea?.selectionStart).toBe("> Quote text\n".length);
      expect(textarea?.selectionEnd).toBe("> Quote text\n".length);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blockquote']"),
      ).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe("> Quote text\n");
      expect(
        Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
        ).map((block) => block.getAttribute("data-md-block-kind")),
      ).toEqual(["blockquote", "blank"]);

      cleanup();
    });
  });

  it("keeps Enter on an empty quote line local until commit", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["> Quote text", "> "].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="quote-enter-exit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe(["> Quote text", "> ", ""].join("\n"));
      const markdownValueBeforeCommit =
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValueBeforeCommit).toBe(initialMarkdown);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds[0]).toBe("blockquote");
      expect(blockKinds[1]).toBe("blank");
      const markdownValueAfterCommit =
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValueAfterCommit).toBe(["> Quote text", "> ", ""].join("\n"));

      cleanup();
    });
  });

  it("keeps Enter inside nested quote blocks local until commit", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ">> Nested quote text";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="nested-quote-enter-continue"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe(">> Nested quote text\n");
      expect(textarea?.selectionStart).toBe(">> Nested quote text\n".length);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blockquote']"),
      ).toHaveLength(1);

      blurTextarea(textarea);
      expect(
        Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
        ).map((block) => block.getAttribute("data-md-block-kind")),
      ).toEqual(["blockquote", "blank"]);

      cleanup();
    });
  });

  it("keeps Shift+Enter inside quote blocks stable without block explosion", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "> Quote";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="quote-shift-enter-stable"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);

      dispatchKeyDown(textarea, "Enter", { shiftKey: true });
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("> Quote\n");
      applyTextareaInput(textarea, "> Quote\n> A");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "Enter", { shiftKey: true });
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("> Quote\n> A\n");
      applyTextareaInput(textarea, "> Quote\n> A\n> B");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "Enter", { shiftKey: true });
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("> Quote\n> A\n> B\n");
      applyTextareaInput(textarea, "> Quote\n> A\n> B\n> C");

      expect(readMarkdown()).toBe(initialMarkdown);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blockquote']"),
      ).toHaveLength(1);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      blurTextarea(textarea);
      expect(readMarkdown()).toBe("> Quote\n> A\n> B\n> C");

      cleanup();
    });
  });

  it("shows inline hash syntax highlighting in non-active editor lines only", () => {
    const initialMarkdown = ["#endcard", "#test", "#irgendwas"].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="editor-inline-syntax-overlay"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const block = container.querySelector<HTMLElement>(".markdown-hybrid-block[data-md-block-index='0']");
    expect(block).toBeTruthy();

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

    const overlay = container.querySelector<HTMLElement>(".markdown-hybrid-block-editor-overlay");
    expect(overlay).toBeTruthy();
    let hashSpans = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block-editor-overlay [data-md-inline-syntax='hash-tag']",
      ),
    );
    // Caret starts at the end of the block, so the last line stays raw.
    expect(hashSpans.map((node) => node.textContent)).toEqual(["#endcard", "#test"]);

    const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
    expect(textarea).toBeTruthy();
    act(() => {
      const line2Start = (textarea?.value.indexOf("#test") ?? 0);
      textarea?.setSelectionRange(line2Start, line2Start);
      textarea?.dispatchEvent(new Event("select", { bubbles: true }));
    });

    hashSpans = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block-editor-overlay [data-md-inline-syntax='hash-tag']",
      ),
    );
    expect(hashSpans.map((node) => node.textContent)).toEqual(["#endcard", "#irgendwas"]);

    cleanup();
  });

  it("renders markdown inline formatting tokens only outside the active editor line", () => {
    const longSegment = "VERYLONGTOKENSEGMENT".repeat(10);
    const highlightToken = `==${longSegment}==`;
    const boldToken = `**${longSegment}**`;
    const italicToken = `*${longSegment}*`;
    const underlineToken = `__${longSegment}__`;
    const strikethroughToken = `~~${longSegment}~~`;
    const inlineCodeToken = `\`${longSegment}\``;
    const mathToken = `$${longSegment}$`;
    const boldItalicToken = `***${longSegment}***`;
    const clozeToken = `%${"CLOZEWRAP".repeat(18)}%`;
    const quotedToken = `"${"QUOTEDWRAP".repeat(16)}"`;
    const singleQuotedText = `'${"SINGLEWRAP".repeat(16)}'`;

    const initialMarkdown = [
      "QUESTION TEXT",
      `a) ${highlightToken} A`,
      `b) ${boldToken} B`,
      `c) ${italicToken} C`,
      `d) ${underlineToken} D`,
      `e) ${strikethroughToken} A`,
      `f) ${inlineCodeToken} B`,
      `g) ${mathToken} C`,
      `h) ${boldItalicToken} D`,
      `i) ${clozeToken} E`,
      `j) ${quotedToken} F`,
      `k) ${singleQuotedText} G`,
      "-a",
      "-c",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(initialMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="editor-markdown-inline-overlay"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const textarea = activateBlockEditor(container, 0);
    expect(textarea).toBeTruthy();

    const minusALineStart = textarea?.value.indexOf("-a") ?? -1;
    expect(minusALineStart).toBeGreaterThanOrEqual(0);
    setTextareaSelection(textarea, minusALineStart, minusALineStart);

    let syntaxNodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block-editor-overlay [data-md-inline-syntax^='markdown-']",
      ),
    );
    expect(
      syntaxNodes.map((node) => ({
        kind: node.dataset.mdInlineSyntax,
        text: node.textContent,
      })),
    ).toEqual([
      { kind: "markdown-highlight", text: highlightToken },
      { kind: "markdown-bold", text: boldToken },
      { kind: "markdown-italic", text: italicToken },
      { kind: "markdown-underline", text: underlineToken },
      { kind: "markdown-strikethrough", text: strikethroughToken },
      { kind: "markdown-inline-code", text: inlineCodeToken },
      { kind: "markdown-math", text: mathToken },
      { kind: "markdown-bold-italic", text: boldItalicToken },
    ]);
    const allInlineSyntaxNodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block-editor-overlay [data-md-inline-syntax]",
      ),
    );
    const allInlineSyntaxPayload = allInlineSyntaxNodes.map((node) => ({
      kind: node.dataset.mdInlineSyntax,
      text: node.textContent,
    }));
    expect(allInlineSyntaxPayload).toContainEqual({ kind: "cloze", text: clozeToken });
    expect(allInlineSyntaxPayload).toContainEqual({ kind: "quoted-token", text: quotedToken });
    expect(allInlineSyntaxPayload.some((entry) => entry.text === singleQuotedText)).toBe(false);
    const overlayText = container.querySelector(".markdown-hybrid-block-editor-overlay")?.textContent ?? "";
    expect(overlayText).toContain(singleQuotedText);

    const italicLineStart = textarea?.value.indexOf(`c) ${italicToken} C`) ?? -1;
    expect(italicLineStart).toBeGreaterThanOrEqual(0);
    setTextareaSelection(textarea, italicLineStart, italicLineStart);

    syntaxNodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block-editor-overlay [data-md-inline-syntax^='markdown-']",
      ),
    );
    expect(
      syntaxNodes.map((node) => ({
        kind: node.dataset.mdInlineSyntax,
        text: node.textContent,
      })),
    ).toEqual([
      { kind: "markdown-highlight", text: highlightToken },
      { kind: "markdown-bold", text: boldToken },
      { kind: "markdown-underline", text: underlineToken },
      { kind: "markdown-strikethrough", text: strikethroughToken },
      { kind: "markdown-inline-code", text: inlineCodeToken },
      { kind: "markdown-math", text: mathToken },
      { kind: "markdown-bold-italic", text: boldItalicToken },
    ]);

    const codeLineStart = textarea?.value.indexOf(`f) ${inlineCodeToken} B`) ?? -1;
    expect(codeLineStart).toBeGreaterThanOrEqual(0);
    setTextareaSelection(textarea, codeLineStart, codeLineStart);

    syntaxNodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block-editor-overlay [data-md-inline-syntax^='markdown-']",
      ),
    );
    expect(
      syntaxNodes.map((node) => ({
        kind: node.dataset.mdInlineSyntax,
        text: node.textContent,
      })),
    ).toEqual([
      { kind: "markdown-highlight", text: highlightToken },
      { kind: "markdown-bold", text: boldToken },
      { kind: "markdown-italic", text: italicToken },
      { kind: "markdown-underline", text: underlineToken },
      { kind: "markdown-strikethrough", text: strikethroughToken },
      { kind: "markdown-inline-code", text: inlineCodeToken },
      { kind: "markdown-math", text: mathToken },
      { kind: "markdown-bold-italic", text: boldItalicToken },
    ]);
    const activeCodeNode = container.querySelector<HTMLElement>(
      ".markdown-hybrid-block-editor-overlay .md-inline-syntax-markdown-inline-code.is-active-line",
    );
    expect(activeCodeNode?.textContent).toBe(inlineCodeToken);

    const boldLineStart = textarea?.value.indexOf(`b) ${boldToken} B`) ?? -1;
    expect(boldLineStart).toBeGreaterThanOrEqual(0);
    act(() => {
      textarea?.setSelectionRange(boldLineStart, boldLineStart);
      textarea?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    });

    syntaxNodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-block-editor-overlay [data-md-inline-syntax^='markdown-']",
      ),
    );
    expect(
      syntaxNodes.map((node) => ({
        kind: node.dataset.mdInlineSyntax,
        text: node.textContent,
      })),
    ).toEqual([
      { kind: "markdown-highlight", text: highlightToken },
      { kind: "markdown-italic", text: italicToken },
      { kind: "markdown-underline", text: underlineToken },
      { kind: "markdown-strikethrough", text: strikethroughToken },
      { kind: "markdown-inline-code", text: inlineCodeToken },
      { kind: "markdown-math", text: mathToken },
      { kind: "markdown-bold-italic", text: boldItalicToken },
    ]);

    cleanup();
  });

  it("opens a page picker for Link Page inserts without adding a [[Page]] placeholder", () => {
    withImmediateRaf(() => {
      const vaultFiles = [
        { path: "/vault/Alpha.md", relative_path: "Alpha.md" },
        { path: "/vault/Folder/Beta.md", relative_path: "Folder/Beta.md" },
      ];

      const Harness = () => {
        const [markdown, setMarkdown] = useState("# One");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="page-link-picker-from-menu"
              markdown={markdown}
              mode="edit"
              vaultFiles={vaultFiles}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));
      dispatchClick(findButtonByExactText(container, "Links"));
      dispatchClick(findMenuItemButtonByLabel(container, "Link Page"));

      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeTruthy();
      expect(readMarkdown()).not.toContain("[[Page]]");
      expect(findPageLinkPickerOptionByLabel(container, "Alpha")).toBeTruthy();
      expect(findPageLinkPickerOptionByLabel(container, "Beta")).toBeTruthy();

      dispatchClick(findPageLinkPickerOptionByLabel(container, "Alpha"));

      const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(readMarkdown()).not.toContain("[[Alpha]]");
      expect(textarea?.value).toBe("[[Alpha]]");
      expect(textarea?.selectionStart).toBe("[[Alpha]]".length);
      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeNull();

      blurTextarea(textarea);
      expect(readMarkdown()).toContain("[[Alpha]]");

      cleanup();
    });
  });

  it("opens the page picker on [[ typing and inserts the selected page link", () => {
    withImmediateRaf(() => {
      const vaultFiles = [
        { path: "/vault/Alpha.md", relative_path: "Alpha.md" },
        { path: "/vault/Folder/Beta.md", relative_path: "Folder/Beta.md" },
      ];

      const Harness = () => {
        const [markdown, setMarkdown] = useState("Alpha ");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="page-link-picker-trigger"
              markdown={markdown}
              mode="edit"
              vaultFiles={vaultFiles}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha [[");

      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeTruthy();

      const searchInput = container.querySelector<HTMLInputElement>(
        ".markdown-hybrid-page-link-picker-search",
      );
      expect(searchInput).toBeTruthy();
      applyTextInput(searchInput, "beta");

      dispatchClick(findPageLinkPickerOptionByLabel(container, "Beta"));

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(readMarkdown()).toBe("Alpha ");
      expect(textarea?.value).toBe("Alpha [[Folder/Beta]]");
      expect(textarea?.selectionStart).toBe("Alpha [[Folder/Beta]]".length);
      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeNull();

      blurTextarea(textarea);
      expect(readMarkdown()).toBe("Alpha [[Folder/Beta]]");

      cleanup();
    });
  });

  it("opens the image picker on ![[ typing and inserts the selected image embed", () => {
    withImmediateRaf(() => {
      const vaultPngAssets = [
        {
          path: "/vault/images/new.png",
          relative_path: "images/new.png",
          file_name: "new.png",
          extension: "png" as const,
        },
      ];

      const Harness = () => {
        const [markdown, setMarkdown] = useState("Alpha ");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="image-link-picker-trigger"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={vaultPngAssets}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      applyTextareaInput(textarea, "Alpha ![[");

      const picker = container.querySelector<HTMLElement>(
        ".markdown-hybrid-insert-menu .vault-png-picker",
      );
      expect(picker).toBeTruthy();

      const searchInput = picker?.querySelector<HTMLInputElement>("input[type='search']") ?? null;
      expect(searchInput).toBeTruthy();
      dispatchClick(picker?.querySelector<HTMLButtonElement>(".vault-png-picker-item") ?? null);

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(readMarkdown()).toBe("Alpha ");
      expect(textarea?.value).toBe("Alpha ![[images/new.png]]");
      expect(textarea?.selectionStart).toBe("Alpha ![[images/new.png]]".length);
      expect(container.querySelector(".markdown-hybrid-insert-menu .vault-png-picker")).toBeNull();

      blurTextarea(textarea);
      expect(readMarkdown()).toBe("Alpha ![[images/new.png]]");

      cleanup();
    });
  });

  it("renders wikilinks as clickable inline page links with missing-page state in preview mode", () => {
    const onNavigateWikilink = vi.fn();
    const vaultFiles = [{ path: "/vault/Docs/Intro.md", relative_path: "Docs/Intro.md" }];

    const { container, cleanup } = render(
      createElement(MarkdownHybridEditor, {
        historyKey: "inline-page-link-preview",
        markdown: "See [[Docs/Intro]] and [[Missing/Page]]",
        mode: "edit",
        vaultFiles,
        onNavigateWikilink,
        onChange: () => undefined,
        renderPreview: (value: string) => <p>{value}</p>,
      }),
    );

    const linkButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-inline-page-link"),
    );
    expect(linkButtons).toHaveLength(2);
    expect(linkButtons[0]?.textContent).toContain("Intro");
    expect(linkButtons[0]?.classList.contains("is-missing")).toBe(false);
    expect(linkButtons[1]?.classList.contains("is-missing")).toBe(true);
    expect(
      container.querySelector(".markdown-hybrid-block-preview code")?.textContent ?? "",
    ).not.toContain("[[");

    dispatchClick(linkButtons[0] ?? null);
    dispatchClick(linkButtons[1] ?? null);

    expect(onNavigateWikilink).toHaveBeenCalledTimes(1);
    expect(onNavigateWikilink).toHaveBeenCalledWith("[[Docs/Intro]]");

    cleanup();
  });

  it("does not transform image embeds into inline page links", () => {
    const { container, cleanup } = render(
      createElement(MarkdownHybridEditor, {
        historyKey: "inline-image-embed-literal",
        markdown: "Text ![[images/example.png]] text",
        mode: "edit",
        onChange: () => undefined,
        renderPreview: (value: string) => <p>{value}</p>,
      }),
    );

    expect(container.querySelector(".markdown-hybrid-inline-page-link")).toBeNull();
    expect(container.querySelector(".markdown-hybrid-block-preview")?.textContent ?? "").toContain(
      "![[images/example.png]]",
    );

    cleanup();
  });

  it("deletes wikilinks atomically with Backspace/Delete and skips them with ArrowLeft/ArrowRight", () => {
    withImmediateRaf(() => {
      const initialMarkdown = "A [[Alpha]] B";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="inline-page-link-atomic-delete"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      const beforeIndex = textarea?.value.indexOf("[[") ?? -1;
      const afterIndex = (textarea?.value.indexOf("]]") ?? -2) + 2;
      expect(beforeIndex).toBeGreaterThanOrEqual(0);
      expect(afterIndex).toBeGreaterThan(beforeIndex);

      setTextareaSelection(textarea, afterIndex);
      dispatchKeyDown(textarea, "Backspace");
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("A  B");
      expect(readMarkdown()).toBe(initialMarkdown);

      applyTextareaInput(textarea, initialMarkdown, beforeIndex);
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "Delete");
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("A  B");
      expect(readMarkdown()).toBe(initialMarkdown);

      applyTextareaInput(textarea, initialMarkdown, beforeIndex);
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "ArrowRight");
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.selectionStart).toBe(afterIndex);

      dispatchKeyDown(textarea, "ArrowLeft");
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.selectionStart).toBe(beforeIndex);

      cleanup();
    });
  });

  it("shows and hides the floating inline toolbar based on text selection state", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("Alpha Beta");
          return (
            <MarkdownHybridEditor
              historyKey="inline-toolbar-visibility"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const textarea = activateBlockEditor(container, 0);
        expect(textarea).toBeTruthy();

        setTextareaSelection(textarea, 0, 5);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeTruthy();

        dispatchKeyDown(textarea, "Escape");
        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeNull();

        setTextareaSelection(textarea, 0, 5);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeTruthy();

        act(() => {
          document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        });
        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeNull();

        setTextareaSelection(textarea, 0, 5);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        setTextareaSelection(textarea, 2, 2);
        act(() => {
          window.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowRight" }));
          vi.advanceTimersByTime(350);
        });

        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeNull();

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("toggles bold formatting from the floating inline toolbar button without duplicate markers", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("Alpha Beta");
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey="inline-toolbar-bold-button"
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        const textarea = activateBlockEditor(container, 0);
        const start = textarea?.value.indexOf("Beta") ?? -1;
        expect(start).toBeGreaterThanOrEqual(0);

        setTextareaSelection(textarea, start, start + 4);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        const boldButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Bold text']",
        );
        dispatchClick(boldButton);
        expect(readMarkdown()).toBe("Alpha Beta");
        expect(textarea?.value).toBe("Alpha **Beta**");

        dispatchClick(boldButton);
        expect(readMarkdown()).toBe("Alpha Beta");
        expect(textarea?.value).toBe("Alpha Beta");

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("keeps the saved selection while the toolbar button is focused and still applies formatting", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("Alpha Beta");
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey="inline-toolbar-bold-focus-preserve"
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        const textarea = activateBlockEditor(container, 0);
        const start = textarea?.value.indexOf("Beta") ?? -1;
        expect(start).toBeGreaterThanOrEqual(0);

        setTextareaSelection(textarea, start, start + 4);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        const boldButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Bold text']",
        );
        expect(boldButton).toBeTruthy();

        setTextareaSelection(textarea, 0, 0);
        act(() => {
          boldButton?.focus();
          document.dispatchEvent(new Event("selectionchange"));
          vi.advanceTimersByTime(350);
        });

        dispatchClick(boldButton);
        expect(readMarkdown()).toBe("Alpha Beta");
        expect(textarea?.value).toBe("Alpha **Beta**");

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("highlights the bold toolbar button when selection is already inside bold markdown markers", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("c) **OPTION** C\nd) **OPTION D**");
          return (
            <MarkdownHybridEditor
              historyKey="inline-toolbar-bold-active"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const textarea = activateBlockEditor(container, 0);
        const optionStart = textarea?.value.indexOf("OPTION") ?? -1;
        expect(optionStart).toBeGreaterThanOrEqual(0);

        setTextareaSelection(textarea, optionStart, optionStart + "OPTION".length);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        const boldButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Bold text']",
        );
        const italicButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Italic text']",
        );
        expect(boldButton?.classList.contains("is-active")).toBe(true);
        expect(italicButton?.classList.contains("is-active")).toBe(false);

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("opens the inline more-menu from toolbar without opening the block insert menu", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("Alpha Beta");
          return (
            <MarkdownHybridEditor
              historyKey="inline-toolbar-more-menu"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const textarea = activateBlockEditor(container, 0);
        expect(textarea).toBeTruthy();
        setTextareaSelection(textarea, 0, 5);

        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        const moreButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='More actions']",
        );
        dispatchClick(moreButton);

        const moreMenu = document.body.querySelector(".markdown-hybrid-inline-toolbar-menu-more");
        expect(moreMenu).toBeTruthy();
        expect(
          moreMenu?.querySelectorAll(".markdown-hybrid-inline-toolbar-menu-item-cdcl"),
        ).toHaveLength(2);
        expect(moreMenu?.querySelector(".markdown-hybrid-inline-toolbar-menu-note")).toBeNull();
        expect(container.querySelector(".markdown-hybrid-insert-menu")).toBeNull();

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("applies CD and CL wrapping from the inline more-menu with toggle behavior", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("Alpha Beta");
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey="inline-toolbar-more-cd-cl-actions"
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        let textarea = activateBlockEditor(container, 0);
        expect(textarea).toBeTruthy();

        const openMoreMenuForSelection = (start: number, end: number) => {
          setTextareaSelection(textarea, start, end);
          act(() => {
            window.dispatchEvent(new Event("pointerup"));
            vi.advanceTimersByTime(350);
          });
          const moreButton = document.body.querySelector<HTMLButtonElement>(
            ".markdown-hybrid-inline-toolbar button[aria-label='More actions']",
          );
          expect(moreButton).toBeTruthy();
          dispatchClick(moreButton);
          expect(document.body.querySelector(".markdown-hybrid-inline-toolbar-menu-more")).toBeTruthy();
          expect(container.querySelector(".markdown-hybrid-insert-menu")).toBeNull();
        };

        const openOnCurrentBeta = () => {
          const betaStart = textarea?.value.indexOf("Beta") ?? -1;
          expect(betaStart).toBeGreaterThanOrEqual(0);
          openMoreMenuForSelection(betaStart, betaStart + 4);
        };

        openOnCurrentBeta();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CD token']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha \"Beta\"");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        expect(document.body.querySelector("button[aria-label='Wrap as CD token']")?.classList.contains("is-active"))
          .toBe(true);
        expect(document.body.querySelector("button[aria-label='Wrap as CL cloze']")?.classList.contains("is-active"))
          .toBe(false);
        dispatchClick(document.body.querySelector(".markdown-hybrid-inline-toolbar button[aria-label='Bold text']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha **Beta**");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CL cloze']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha %Beta%");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        expect(document.body.querySelector("button[aria-label='Wrap as CD token']")?.classList.contains("is-active"))
          .toBe(false);
        expect(document.body.querySelector("button[aria-label='Wrap as CL cloze']")?.classList.contains("is-active"))
          .toBe(true);
        dispatchClick(document.body.querySelector(".markdown-hybrid-inline-toolbar button[aria-label='Bold text']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha **Beta**");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CL cloze']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha %Beta%");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CD token']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha \"Beta\"");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CD token']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha Beta");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CL cloze']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha %Beta%");
        expect(readMarkdown()).toBe("Alpha Beta");

        openOnCurrentBeta();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CL cloze']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha Beta");
        expect(readMarkdown()).toBe("Alpha Beta");

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("opens the inline math menu and applies wrap/convert/remove actions from the floating toolbar", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("Alpha Beta");
          return (
            <MarkdownHybridEditor
              historyKey="inline-toolbar-math-menu"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const getMathMenuItem = (label: string) =>
          Array.from(
            document.body.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-inline-toolbar-menu-item"),
          ).find((button) => button.textContent?.includes(label));
        const openMathMenu = (textarea: HTMLTextAreaElement, start: number, end: number) => {
          setTextareaSelection(textarea, start, end);
          act(() => {
            window.dispatchEvent(new Event("pointerup"));
            vi.advanceTimersByTime(350);
          });
          const mathButton = document.body.querySelector<HTMLButtonElement>(
            ".markdown-hybrid-inline-toolbar button[aria-label='Inline formula']",
          );
          dispatchClick(mathButton);
        };

        let textarea = activateBlockEditor(container, 0);
        expect(textarea).toBeTruthy();

        openMathMenu(textarea as HTMLTextAreaElement, 6, 10);
        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar-menu")).toBeTruthy();
        expect(container.querySelector(".markdown-hybrid-insert-menu")).toBeNull();
        dispatchClick(getMathMenuItem("Mark as Inline Math") ?? null);
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha $Beta$");

        const inlineStart = textarea?.value.indexOf("Beta") ?? -1;
        expect(inlineStart).toBeGreaterThanOrEqual(0);
        openMathMenu(textarea as HTMLTextAreaElement, inlineStart, inlineStart + 4);
        dispatchClick(getMathMenuItem("Convert Inline <-> Display") ?? null);
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha $$Beta$$");

        const displayStart = textarea?.value.indexOf("Beta") ?? -1;
        expect(displayStart).toBeGreaterThanOrEqual(0);
        openMathMenu(textarea as HTMLTextAreaElement, displayStart, displayStart + 4);
        dispatchClick(getMathMenuItem("Remove Math Marking") ?? null);
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
        expect(textarea?.value).toBe("Alpha Beta");

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("does not rewrite inline-code selections with math menu actions", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("Text `a+b`");
          return (
            <MarkdownHybridEditor
              historyKey="inline-toolbar-math-code-guard"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const textarea = activateBlockEditor(container, 0);
        expect(textarea).toBeTruthy();

        setTextareaSelection(textarea, 6, 9);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });
        const mathButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Inline formula']",
        );
        dispatchClick(mathButton);
        const wrapButton = Array.from(
          document.body.querySelectorAll<HTMLButtonElement>(".markdown-hybrid-inline-toolbar-menu-item"),
        ).find((button) => button.textContent?.includes("Mark as Inline Math"));
        dispatchClick(wrapButton ?? null);

        expect(textarea?.value).toBe("Text `a+b`");
        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("normalizes multiline inline math on commit but keeps the draft unchanged while typing", () => {
    withImmediateRaf(() => {
      let latestMarkdown = "Alpha $x$";

      const Harness = () => {
        const [markdown, setMarkdown] = useState(latestMarkdown);
        return (
          <MarkdownHybridEditor
            historyKey="inline-math-commit-normalization"
            markdown={markdown}
            mode="edit"
            onChange={(value) => {
              latestMarkdown = value;
              setMarkdown(value);
            }}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      let textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();

      applyTextareaInput(textarea, "Alpha $x +\n  y$");
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("Alpha $x +\n  y$");
      expect(latestMarkdown).toBe("Alpha $x$");

      blurTextarea(textarea);
      expect(latestMarkdown).toBe("Alpha $x + y$");
      cleanup();
    });
  });

  it("removes supported inline markdown wrappers from the selection when pressing the text button", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const initialMarkdown = [
          "QUESTION TEXT",
          "a) __OPTION__ A",
          "b) *OPTION* B",
          "c) **OPTION** C",
          "d) **OPTION D**",
          "e) OPTION A",
          "f) OPTION B",
          "g) **OPTION** C",
          "h) ==OPTION== D",
          "-a",
          "-c",
        ].join("\n");
        const expectedMarkdown = [
          "QUESTION TEXT",
          "a) OPTION A",
          "b) OPTION B",
          "c) OPTION C",
          "d) OPTION D",
          "e) OPTION A",
          "f) OPTION B",
          "g) OPTION C",
          "h) OPTION D",
          "-a",
          "-c",
        ].join("\n");
        const Harness = () => {
          const [markdown, setMarkdown] = useState(initialMarkdown);
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey="inline-toolbar-text-clear-selection"
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        const textarea = activateBlockEditor(container, 0);
        expect(textarea).toBeTruthy();
        setTextareaSelection(textarea, 0, textarea?.value.length ?? 0);

        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        const textMenuButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Text format menu']",
        );
        dispatchClick(textMenuButton);

        expect(readMarkdown()).toBe(initialMarkdown);
        expect(textarea?.value).toBe(expectedMarkdown);

        blurTextarea(textarea);
        expect(readMarkdown()).toBe(expectedMarkdown);

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("removes wrappers around the current selection when pressing the text button", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const Harness = () => {
          const [markdown, setMarkdown] = useState("c) **OPTION** C");
          return (
            <div>
              <div data-testid="markdown-value">{markdown}</div>
              <MarkdownHybridEditor
                historyKey="inline-toolbar-text-clear-around-selection"
                markdown={markdown}
                mode="edit"
                onChange={setMarkdown}
                renderPreview={(value) => <div>{value}</div>}
              />
            </div>
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        const textarea = activateBlockEditor(container, 0);
        expect(textarea).toBeTruthy();
        const start = textarea?.value.indexOf("OPTION") ?? -1;
        expect(start).toBeGreaterThanOrEqual(0);
        setTextareaSelection(textarea, start, start + "OPTION".length);

        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });

        const textMenuButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Text format menu']",
        );
        dispatchClick(textMenuButton);

        expect(readMarkdown()).toBe("c) **OPTION** C");
        expect(textarea?.value).toBe("c) OPTION C");

        blurTextarea(textarea);
        expect(readMarkdown()).toBe("c) OPTION C");

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("removes CD/CL wrappers around the current selection when pressing the text button", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        for (const initialMarkdown of ["Alpha \"Beta\"", "Alpha %Beta%"]) {
          const Harness = () => {
            const [markdown, setMarkdown] = useState(initialMarkdown);
            return (
              <div>
                <div data-testid="markdown-value">{markdown}</div>
                <MarkdownHybridEditor
                  historyKey={`inline-toolbar-text-clear-cdcl-${initialMarkdown.includes("%") ? "cl" : "cd"}`}
                  markdown={markdown}
                  mode="edit"
                  onChange={setMarkdown}
                  renderPreview={(value) => <div>{value}</div>}
                />
              </div>
            );
          };

          const { container, cleanup } = render(createElement(Harness));
          const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
          const textarea = activateBlockEditor(container, 0);
          expect(textarea).toBeTruthy();
          const start = textarea?.value.indexOf("Beta") ?? -1;
          expect(start).toBeGreaterThanOrEqual(0);
          setTextareaSelection(textarea, start, start + "Beta".length);

          act(() => {
            window.dispatchEvent(new Event("pointerup"));
            vi.advanceTimersByTime(350);
          });

          const textMenuButton = document.body.querySelector<HTMLButtonElement>(
            ".markdown-hybrid-inline-toolbar button[aria-label='Text format menu']",
          );
          dispatchClick(textMenuButton);

          expect(readMarkdown()).toBe(initialMarkdown);
          expect(textarea?.value).toBe("Alpha Beta");

          blurTextarea(textarea);
          expect(readMarkdown()).toBe("Alpha Beta");
          cleanup();
        }
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("applies and removes bold formatting via Ctrl+B in an active textarea selection", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("Alpha Beta");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="inline-toolbar-bold-shortcut"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      const textarea = activateBlockEditor(container, 0);
      const start = textarea?.value.indexOf("Beta") ?? -1;
      expect(start).toBeGreaterThanOrEqual(0);

      setTextareaSelection(textarea, start, start + 4);
      dispatchKeyDown(textarea, "b", { ctrlKey: true });
      expect(readMarkdown()).toBe("Alpha Beta");
      expect(textarea?.value).toBe("Alpha **Beta**");

      dispatchKeyDown(textarea, "b", { ctrlKey: true });
      expect(readMarkdown()).toBe("Alpha Beta");
      expect(textarea?.value).toBe("Alpha Beta");

      cleanup();
    });
  });

  it("supports bold+italic combination as triple-star and toggles each layer independently", () => {
    withImmediateRaf(() => {
      const Harness = () => {
        const [markdown, setMarkdown] = useState("OPTION");
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="inline-toolbar-bold-italic-combo"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      const textarea = activateBlockEditor(container, 0);
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, 0, "OPTION".length);

      dispatchKeyDown(textarea, "b", { ctrlKey: true });
      expect(readMarkdown()).toBe("OPTION");
      expect(textarea?.value).toBe("**OPTION**");

      dispatchKeyDown(textarea, "i", { ctrlKey: true });
      expect(readMarkdown()).toBe("OPTION");
      expect(textarea?.value).toBe("***OPTION***");

      dispatchKeyDown(textarea, "i", { ctrlKey: true });
      expect(readMarkdown()).toBe("OPTION");
      expect(textarea?.value).toBe("**OPTION**");

      dispatchKeyDown(textarea, "b", { ctrlKey: true });
      expect(readMarkdown()).toBe("OPTION");
      expect(textarea?.value).toBe("OPTION");

      cleanup();
    });
  });

  it("does not show the floating inline toolbar for non-editable preview selection", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const { container, cleanup } = render(
          createElement(MarkdownHybridEditor, {
            historyKey: "inline-toolbar-non-editable",
            markdown: "Alpha Beta",
            mode: "edit",
            onChange: () => undefined,
            renderPreview: (value: string) => <p>{value}</p>,
          }),
        );
        const previewTextNode = container.querySelector(".markdown-hybrid-block-preview")?.firstChild;
        const selection = window.getSelection();
        if (previewTextNode && selection) {
          const range = document.createRange();
          range.selectNodeContents(previewTextNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        act(() => {
          document.dispatchEvent(new Event("selectionchange"));
          vi.advanceTimersByTime(350);
        });

        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeNull();

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("renders tables as interactive blocks and commits cell edits", () => {
    let latestMarkdown = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-cell-edit"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    expect(container.querySelector(".markdown-hybrid-table-shell.markdown-table")).toBeTruthy();
    expect(container.querySelector(".markdown-hybrid-table-edge-strip-left")).toBeNull();
    expect(container.querySelector(".markdown-hybrid-table-edge-strip-right")).toBeNull();
    expect(container.querySelector(".markdown-hybrid-table-edge-strip-bottom")).toBeNull();
    const firstHeaderCell = container.querySelector<HTMLElement>(".markdown-hybrid-table-cell-header");
    expect(firstHeaderCell).toBeTruthy();

    dispatchMouseDown(firstHeaderCell);

    const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
    expect(textarea).toBeTruthy();
    applyTextInput(textarea, "Renamed");
    act(() => {
      textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
    });

    expect(latestMarkdown).toContain("| Renamed | B |");
    cleanup();
  });

  it("shows inline toolbar in table cells and applies bold via toolbar and Ctrl+B", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        let latestMarkdown = [
          "| A | B |",
          "| --- | --- |",
          "| one | two |",
        ].join("\n");

        const Harness = () => {
          const [markdown, setMarkdown] = useState(latestMarkdown);
          return (
            <MarkdownHybridEditor
              historyKey="table-inline-toolbar-bold"
              markdown={markdown}
              mode="edit"
              onChange={(value) => {
                latestMarkdown = value;
                setMarkdown(value);
              }}
              renderPreview={(value) => <div>{value}</div>}
            />
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        let bodyCells = Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)"),
        );
        expect(bodyCells.length).toBeGreaterThanOrEqual(2);

        dispatchMouseDown(bodyCells[0] ?? null);
        let textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea).toBeTruthy();
        setTextareaSelection(textarea, 0, 3);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });
        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeTruthy();
        const boldButton = document.body.querySelector<HTMLButtonElement>(
          ".markdown-hybrid-inline-toolbar button[aria-label='Bold text']",
        );
        dispatchClick(boldButton);
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea?.value).toBe("**one**");
        act(() => {
          textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
        });
        expect(latestMarkdown).toContain("| **one** | two |");

        bodyCells = Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)"),
        );
        dispatchMouseDown(bodyCells[1] ?? null);
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea).toBeTruthy();
        setTextareaSelection(textarea, 0, 3);
        dispatchKeyDown(textarea, "b", { ctrlKey: true });
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea?.value).toBe("**two**");
        act(() => {
          textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
        });
        expect(latestMarkdown).toContain("| **one** | **two** |");

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("applies exclusive CD/CL replacement logic in table-cell inline toolbar", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        let latestMarkdown = [
          "| A | B |",
          "| --- | --- |",
          "| **one** | two |",
        ].join("\n");

        const Harness = () => {
          const [markdown, setMarkdown] = useState(latestMarkdown);
          return (
            <MarkdownHybridEditor
              historyKey="table-inline-toolbar-cdcl-exclusive"
              markdown={markdown}
              mode="edit"
              onChange={(value) => {
                latestMarkdown = value;
                setMarkdown(value);
              }}
              renderPreview={(value) => <div>{value}</div>}
            />
          );
        };

        const { container, cleanup } = render(createElement(Harness));
        const bodyCells = Array.from(
          container.querySelectorAll<HTMLElement>(".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)"),
        );
        expect(bodyCells.length).toBeGreaterThanOrEqual(1);

        dispatchMouseDown(bodyCells[0] ?? null);
        let textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea).toBeTruthy();
        const openMoreMenuForSelection = () => {
          const start = textarea?.value.indexOf("one") ?? -1;
          expect(start).toBeGreaterThanOrEqual(0);
          setTextareaSelection(textarea, start, start + 3);
          act(() => {
            window.dispatchEvent(new Event("pointerup"));
            vi.advanceTimersByTime(350);
          });
          dispatchClick(document.body.querySelector(".markdown-hybrid-inline-toolbar button[aria-label='More actions']"));
          expect(document.body.querySelector(".markdown-hybrid-inline-toolbar-menu-more")).toBeTruthy();
        };

        openMoreMenuForSelection();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CD token']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea?.value).toBe("\"one\"");

        dispatchClick(document.body.querySelector(".markdown-hybrid-inline-toolbar button[aria-label='Bold text']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea?.value).toBe("**one**");

        openMoreMenuForSelection();
        dispatchClick(document.body.querySelector("button[aria-label='Wrap as CL cloze']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea?.value).toBe("%one%");

        dispatchClick(document.body.querySelector(".markdown-hybrid-inline-toolbar button[aria-label='Text format menu']"));
        textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea?.value).toBe("one");

        act(() => {
          textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
        });
        expect(latestMarkdown).toContain("| one | two |");
        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("does not show table inline toolbar for empty selection or in table code view", () => {
    withImmediateRaf(() => {
      vi.useFakeTimers();
      try {
        const { container, cleanup } = render(
          createElement(MarkdownHybridEditor, {
            historyKey: "table-inline-toolbar-visibility-guards",
            markdown: ["| A | B |", "| --- | --- |", "| one | two |"].join("\n"),
            mode: "edit",
            onChange: () => undefined,
            renderPreview: (value: string) => <div>{value}</div>,
          }),
        );

        const firstBodyCell = container.querySelector<HTMLElement>(
          ".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)",
        );
        dispatchMouseDown(firstBodyCell);
        const cellEditor = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(cellEditor).toBeTruthy();

        setTextareaSelection(cellEditor, 0, 0);
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });
        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeNull();

        const toggle = container.querySelector<HTMLButtonElement>(".markdown-hybrid-table-view-toggle");
        dispatchClick(toggle);
        const codeEditor = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-code-editor");
        expect(codeEditor).toBeTruthy();
        setTextareaSelection(codeEditor, 0, Math.min(5, codeEditor?.value.length ?? 0));
        act(() => {
          window.dispatchEvent(new Event("pointerup"));
          vi.advanceTimersByTime(350);
        });
        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar")).toBeNull();

        cleanup();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("routes valid pipe tables inside and outside #card through the same table block renderer", () => {
    const markdown = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "#card",
      "| A | B |",
      "| --- | --- |",
      "| 3 | 4 |",
      "#endcard",
    ].join("\n");

    const { container, cleanup } = render(
      <MarkdownHybridEditor
        historyKey="card-table-shared-render-path"
        markdown={markdown}
        mode="edit"
        onChange={() => undefined}
        renderPreview={(value) => <div>{value}</div>}
      />,
    );

    expect(container.querySelectorAll(".markdown-hybrid-table-block")).toHaveLength(2);
    expect(container.querySelector(".markdown-hybrid-card-table-segment .markdown-hybrid-table-block")).toBeTruthy();
    expect(container.querySelector(".markdown-hybrid-card-block-frame")?.textContent ?? "").toContain("#card");
    expect(container.querySelector(".markdown-hybrid-card-block-frame")?.textContent ?? "").toContain("#endcard");

    dispatchMouseDown(
      container.querySelector<HTMLElement>(
        ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell-header",
      ),
    );
    expect(
      container.querySelector(".markdown-hybrid-card-table-segment .markdown-hybrid-table-view-toggle"),
    ).toBeNull();

    cleanup();
  });

  it("commits card-internal table cell edits in-place inside the same #card block", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "#card",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "#endcard",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-table-cell-edit"
              markdown={markdown}
              mode="edit"
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchMouseDown(
        container.querySelector<HTMLElement>(
          ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell-header",
        ),
      );
      const textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell-editor",
      );
      expect(textarea).toBeTruthy();
      applyTextInput(textarea, "Renamed card header");
      act(() => {
        textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
      });

      expect(readMarkdown()).toContain("| Renamed card header | B |");
      expect(readMarkdown().match(/#card/g)).toHaveLength(1);
      expect(readMarkdown().match(/#endcard/g)).toHaveLength(1);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);
      cleanup();
    });
  });

  it("opens the page picker on [[ typing inside a table cell and inserts the selected page link", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "| Visual | Description |",
        "| --- | --- |",
        "| Alpha | Text |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="table-cell-page-link-picker-trigger"
              markdown={markdown}
              mode="edit"
              vaultFiles={[
                { path: "/vault/Alpha.md", relative_path: "Alpha.md" },
                { path: "/vault/Folder/Beta.md", relative_path: "Folder/Beta.md" },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchMouseDown(
        container.querySelector<HTMLElement>(".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)"),
      );
      let textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea).toBeTruthy();

      applyTextareaInput(textarea, "Alpha [[");
      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeTruthy();
      dispatchClick(findPageLinkPickerOptionByLabel(container, "Beta"));

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea?.value).toBe("Alpha [[Folder/Beta]]");
      expect(textarea?.selectionStart).toBe("Alpha [[Folder/Beta]]".length);
      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeNull();

      act(() => {
        textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
      });
      expect(readMarkdown()).toContain("[[Folder/Beta]]");

      cleanup();
    });
  });

  it("opens the image picker on ![[ typing inside a table cell and inserts the selected image embed", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "| Visual | Description |",
        "| --- | --- |",
        "| Alpha | Text |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="table-cell-image-link-picker-trigger"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/new.png",
                  relative_path: "images/new.png",
                  file_name: "new.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchMouseDown(
        container.querySelector<HTMLElement>(".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)"),
      );
      let textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea).toBeTruthy();

      applyTextareaInput(textarea, "Alpha ![[");
      const picker = container.querySelector<HTMLElement>(
        ".markdown-hybrid-table-block .markdown-hybrid-insert-menu .vault-png-picker",
      );
      expect(picker).toBeTruthy();
      dispatchClick(picker?.querySelector<HTMLButtonElement>(".vault-png-picker-item") ?? null);

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea?.value).toBe("Alpha ![[images/new.png]]");
      expect(textarea?.selectionStart).toBe("Alpha ![[images/new.png]]".length);
      expect(container.querySelector(".markdown-hybrid-table-block .markdown-hybrid-insert-menu .vault-png-picker"))
        .toBeNull();

      act(() => {
        textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
      });
      expect(readMarkdown()).toContain("![[images/new.png]]");

      cleanup();
    });
  });

  it("supports [[ typing autocomplete inside #card table segments without creating new blocks", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "#card",
        "| Visual | Description |",
        "| --- | --- |",
        "| Alpha | Text |",
        "#endcard",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-table-cell-page-link-picker-trigger"
              markdown={markdown}
              mode="edit"
              vaultFiles={[
                { path: "/vault/Alpha.md", relative_path: "Alpha.md" },
                { path: "/vault/Folder/Beta.md", relative_path: "Folder/Beta.md" },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () => container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchMouseDown(
        container.querySelector<HTMLElement>(
          ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)",
        ),
      );
      let textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell-editor",
      );
      expect(textarea).toBeTruthy();

      applyTextareaInput(textarea, "Alpha [[");
      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeTruthy();
      dispatchClick(findPageLinkPickerOptionByLabel(container, "Beta"));

      textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell-editor",
      );
      expect(textarea?.value).toBe("Alpha [[Folder/Beta]]");
      expect(textarea?.selectionStart).toBe("Alpha [[Folder/Beta]]".length);

      act(() => {
        textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
      });
      expect(readMarkdown()).toContain("[[Folder/Beta]]");
      expect(readMarkdown().match(/#card/g)).toHaveLength(1);
      expect(readMarkdown().match(/#endcard/g)).toHaveLength(1);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);

      cleanup();
    });
  });

  it("replaces a standalone PNG embed inside a hybrid table cell in-place", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "| Visual | Description |",
        "| --- | --- |",
        "| ![[images/old.png|Cell label]] | Text |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="table-cell-image-replace"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/new.png",
                  relative_path: "images/new.png",
                  file_name: "new.png",
                  extension: "png",
                },
                {
                  path: "/vault/images/old.png",
                  relative_path: "images/old.png",
                  file_name: "old.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchClick(findTableCellImageReplaceTrigger(container));
      const picker = container.querySelector<HTMLElement>(
        ".markdown-hybrid-table-cell-image-replace-picker",
      );
      expect(picker).toBeTruthy();

      const searchInput = picker?.querySelector<HTMLInputElement>("input[type='search']") ?? null;
      expect(searchInput).toBeTruthy();
      expect(document.activeElement).toBe(searchInput);
      applyTextInput(searchInput, "new");
      dispatchClick(picker?.querySelector<HTMLButtonElement>(".vault-png-picker-item") ?? null);

      expect(readMarkdown()).toContain("![[images/new.png|Cell label]]");
      expect(readMarkdown()).not.toContain("![[images/old.png|Cell label]]");
      expect(readMarkdown()).toContain("| Visual | Description |");
      expect(readMarkdown().match(/!\[\[[^\]]+\.png(?:\|[^\]]+)?\]\]/g)).toHaveLength(1);
      cleanup();
    });
  });

  it("replaces a standalone PNG embed inside a #card table cell in-place without creating new blocks", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "#card",
        "| Visual | Description |",
        "| --- | --- |",
        "| ![[images/old.png|Cell label]] | Text |",
        "#endcard",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="card-table-cell-image-replace"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/new.png",
                  relative_path: "images/new.png",
                  file_name: "new.png",
                  extension: "png",
                },
                {
                  path: "/vault/images/old.png",
                  relative_path: "images/old.png",
                  file_name: "old.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      const replaceTrigger = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell-image-replace-trigger",
      );

      dispatchClick(replaceTrigger);
      const picker = container.querySelector<HTMLElement>(
        ".markdown-hybrid-card-table-segment .markdown-hybrid-table-cell-image-replace-picker",
      );
      expect(picker).toBeTruthy();

      const searchInput = picker?.querySelector<HTMLInputElement>("input[type='search']") ?? null;
      expect(searchInput).toBeTruthy();
      applyTextInput(searchInput, "new");
      dispatchClick(picker?.querySelector<HTMLButtonElement>(".vault-png-picker-item") ?? null);

      expect(readMarkdown()).toContain("![[images/new.png|Cell label]]");
      expect(readMarkdown()).not.toContain("![[images/old.png|Cell label]]");
      expect(readMarkdown().match(/!\[\[[^\]]+\.png(?:\|[^\]]+)?\]\]/g)).toHaveLength(1);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);

      cleanup();
    });
  });

  it("keeps invalid pipe-like content inside #card on markdown fallback instead of table mode", () => {
    const markdown = [
      "#card",
      "| A | B |",
      "| not-a-separator |",
      "#endcard",
    ].join("\n");

    const { container, cleanup } = render(
      <MarkdownHybridEditor
        historyKey="card-table-invalid-fallback"
        markdown={markdown}
        mode="edit"
        onChange={() => undefined}
        renderPreview={(value) => <div>{value}</div>}
      />,
    );

    expect(container.querySelector(".markdown-hybrid-card-table-segment .markdown-hybrid-table-block")).toBeNull();
    const cardFrameText = container.querySelector(".markdown-hybrid-card-block-frame")?.textContent ?? "";
    expect(cardFrameText).toContain("| A | B |");
    expect(cardFrameText).toContain("| not-a-separator |");
    cleanup();
  });

  it("closes the table-cell image replace picker via Escape/outside click without markdown changes", () => {
    withImmediateRaf(() => {
      const initialMarkdown = [
        "| Visual |",
        "| --- |",
        "| ![[images/example.png]] |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <div>
            <div data-testid="markdown-value">{markdown}</div>
            <MarkdownHybridEditor
              historyKey="table-cell-image-replace-dismiss"
              markdown={markdown}
              mode="edit"
              vaultPngAssets={[
                {
                  path: "/vault/images/example.png",
                  relative_path: "images/example.png",
                  file_name: "example.png",
                  extension: "png",
                },
              ]}
              onChange={setMarkdown}
              renderPreview={(value) => <div>{value}</div>}
            />
          </div>
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const readMarkdown = () =>
        container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";

      dispatchClick(findTableCellImageReplaceTrigger(container));
      expect(container.querySelector(".markdown-hybrid-table-cell-image-replace-picker")).toBeTruthy();
      dispatchWindowKeyDown("Escape");
      expect(container.querySelector(".markdown-hybrid-table-cell-image-replace-picker")).toBeNull();
      expect(readMarkdown()).toBe(initialMarkdown);

      dispatchClick(findTableCellImageReplaceTrigger(container));
      expect(container.querySelector(".markdown-hybrid-table-cell-image-replace-picker")).toBeTruthy();
      act(() => {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      });
      expect(container.querySelector(".markdown-hybrid-table-cell-image-replace-picker")).toBeNull();
      expect(readMarkdown()).toBe(initialMarkdown);

      cleanup();
    });
  });

  it("does not show a table-cell replace action when a cell contains multiple PNG embeds", () => {
    withImmediateRaf(() => {
      const { container, cleanup } = render(
        <MarkdownHybridEditor
          historyKey="table-cell-image-replace-multi-embed"
          markdown={[
            "| Visual |",
            "| --- |",
            "| ![[images/one.png]]<br>![[images/two.png]] |",
          ].join("\n")}
          mode="edit"
          onChange={() => undefined}
          renderPreview={(value) => <div>{value}</div>}
        />,
      );

      expect(findTableCellImageReplaceTrigger(container)).toBeNull();
      cleanup();
    });
  });

  it("uses weighted responsive column tracks in the hybrid table grid", () => {
    withImmediateRaf(() => {
      const { container, cleanup } = render(
        createElement(MarkdownHybridEditor, {
          historyKey: "table-column-widths",
          markdown: [
            "| Kurz | Sehr lange Zeile<br>kurz | Letzte Spalte |",
            "| --- | --- | --- |",
            "| A | Noch laengerer Text in der mittleren Spalte | Rest |",
          ].join("\n"),
          mode: "edit",
          onChange: () => undefined,
          renderPreview: (value: string) => <div>{value}</div>,
        }),
      );

      const grid = container.querySelector<HTMLElement>(".markdown-hybrid-table-grid");
      expect(grid).toBeTruthy();

      const template = grid?.style.gridTemplateColumns ?? "";
      expect(template.startsWith("36px ")).toBe(true);
      expect(template.includes("minmax(")).toBe(true);
      expect(template).toContain("minmax(0, 1fr)");
      expect(template).toMatch(/minmax\(0,\s*2(\.\d+)?fr\)/);
      cleanup();
    });
  });

  it("renders compact table lane labels as h c1 c2 and r1 r2", () => {
    withImmediateRaf(() => {
      const { container, cleanup } = render(
        createElement(MarkdownHybridEditor, {
          historyKey: "table-compact-lane-labels",
          markdown: [
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
            "| 3 | 4 |",
          ].join("\n"),
          mode: "edit",
          onChange: () => undefined,
          renderPreview: (value: string) => <div>{value}</div>,
        }),
      );

      const headerLane = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-table-row-select-header",
      );
      const firstColumnLane = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-table-column-select[data-md-table-column-index='0']",
      );
      const secondColumnLane = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-table-column-select[data-md-table-column-index='1']",
      );
      const firstRowLane = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-table-row-select[data-md-table-row-index='1']",
      );
      const secondRowLane = container.querySelector<HTMLButtonElement>(
        ".markdown-hybrid-table-row-select[data-md-table-row-index='2']",
      );

      expect(headerLane?.textContent?.trim()).toBe("h");
      expect(firstColumnLane?.textContent?.trim()).toBe("c1");
      expect(secondColumnLane?.textContent?.trim()).toBe("c2");
      expect(firstRowLane?.textContent?.trim()).toBe("r1");
      expect(secondRowLane?.textContent?.trim()).toBe("r2");

      cleanup();
    });
  });

  it("auto-expands the table cell editor for multiline cell content", () => {
    withImmediateRaf(() => {
      const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "scrollHeight");
      Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
        configurable: true,
        get() {
          return 96;
        },
      });

      try {
        const { container, cleanup } = render(
          createElement(MarkdownHybridEditor, {
            historyKey: "table-multiline-cell-height",
            markdown: [
              "| A | B |",
              "| --- | --- |",
              "| Erste Zeile<br>Zweite Zeile<br>Dritte Zeile | 2 |",
            ].join("\n"),
            mode: "edit",
            onChange: () => undefined,
            renderPreview: (value: string) => <div>{value}</div>,
          }),
        );

        const firstBodyCell = container.querySelector<HTMLElement>(
          ".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)",
        );
        expect(firstBodyCell).toBeTruthy();

        dispatchMouseDown(firstBodyCell);

        const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
        expect(textarea).toBeTruthy();
        expect(textarea?.value).toBe("Erste Zeile\nZweite Zeile\nDritte Zeile");
        expect(textarea?.style.height).toBe("96px");
        cleanup();
      } finally {
        if (originalScrollHeight) {
          Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeight);
        } else {
          // jsdom exposes it on the prototype; delete is safe here if we created the descriptor.
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
        }
      }
    });
  });

  it("renders paragraph breaks inside table cells from consecutive line breaks", () => {
    withImmediateRaf(() => {
      const previewValues: string[] = [];
      const { cleanup } = render(
        createElement(MarkdownHybridEditor, {
          historyKey: "table-cell-paragraph-render",
          markdown: [
            "| A | B |",
            "| --- | --- |",
            "| Erste Zeile<br><br>Zweite Zeile | 2 |",
          ].join("\n"),
          mode: "edit",
          onChange: () => undefined,
          renderPreview: (value: string) => {
            previewValues.push(value);
            return <div>{value}</div>;
          },
        }),
      );

      expect(previewValues).toContain("Erste Zeile\n\nZweite Zeile");
      cleanup();
    });
  });

  it("inserts a multiline break inside a table cell on Enter and persists it", () => {
    withImmediateRaf(() => {
      let latestMarkdown = [
        "| A | B |",
        "| --- | --- |",
        "| Erste Zeile | 2 |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(latestMarkdown);
        return (
          <MarkdownHybridEditor
            historyKey="table-cell-enter-paragraph"
            markdown={markdown}
            mode="edit"
            onChange={(value) => {
              latestMarkdown = value;
              setMarkdown(value);
            }}
            renderPreview={(value: string) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const firstBodyCell = container.querySelector<HTMLElement>(
        ".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)",
      );
      expect(firstBodyCell).toBeTruthy();

      dispatchMouseDown(firstBodyCell);

      const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, textarea?.value.length ?? 0);

      dispatchKeyDown(textarea, "Enter");

      expect(textarea?.value).toBe("Erste Zeile\n");

      act(() => {
        textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
      });

      expect(latestMarkdown).toContain("Erste Zeile<br>");
      cleanup();
    });
  });

  it("keeps deleted table cell text removed after the editor loses focus", () => {
    withImmediateRaf(() => {
      let latestMarkdown = [
        "| A | B |",
        "| --- | --- |",
        "| Alpha Beta | 2 |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(latestMarkdown);
        return (
          <MarkdownHybridEditor
            historyKey="table-cell-delete-blur"
            markdown={markdown}
            mode="edit"
            onChange={(value) => {
              latestMarkdown = value;
              setMarkdown(value);
            }}
            renderPreview={(value: string) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const firstBodyCell = container.querySelector<HTMLElement>(
        ".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)",
      );
      expect(firstBodyCell).toBeTruthy();

      dispatchMouseDown(firstBodyCell);

      const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea).toBeTruthy();

      applyTextareaInput(textarea, "Alpha");

      act(() => {
        textarea?.dispatchEvent(new Event("blur", { bubbles: true }));
      });

      expect(latestMarkdown).toContain("| Alpha | 2 |");
      expect(latestMarkdown).not.toContain("Alpha Beta");
      expect(textarea?.value).toBe("Alpha");
      cleanup();
    });
  });

  it("persists multiline table cell edits when switching to another cell", () => {
    withImmediateRaf(() => {
      let latestMarkdown = [
        "| A | B |",
        "| --- | --- |",
        "| Alpha Beta | Ziel |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(latestMarkdown);
        return (
          <MarkdownHybridEditor
            historyKey="table-cell-switch-commit"
            markdown={markdown}
            mode="edit"
            onChange={(value) => {
              latestMarkdown = value;
              setMarkdown(value);
            }}
            renderPreview={(value: string) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const bodyCells = container.querySelectorAll<HTMLElement>(
        ".markdown-hybrid-table-cell:not(.markdown-hybrid-table-cell-header)",
      );
      const firstBodyCell = bodyCells[0] ?? null;
      const secondBodyCell = bodyCells[1] ?? null;
      expect(firstBodyCell).toBeTruthy();
      expect(secondBodyCell).toBeTruthy();

      dispatchMouseDown(firstBodyCell);

      const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea).toBeTruthy();

      applyTextareaInput(textarea, "Alpha\n\nGamma");
      dispatchMouseDown(secondBodyCell);

      expect(latestMarkdown).toContain("| Alpha<br><br>Gamma | Ziel |");
      expect(latestMarkdown).not.toContain("Alpha Beta");

      const activeEditors = container.querySelectorAll(".markdown-hybrid-table-cell-editor");
      expect(activeEditors.length).toBe(1);
      cleanup();
    });
  });

  it("keeps the caret position when clicking inside an already active table cell editor", () => {
    withImmediateRaf(() => {
      let latestMarkdown = [
        "| Alpha | Beta |",
        "| --- | --- |",
        "| 1 | 2 |",
      ].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(latestMarkdown);
        return (
          <MarkdownHybridEditor
            historyKey="table-cell-caret-click"
            markdown={markdown}
            mode="edit"
            onChange={(value) => {
              latestMarkdown = value;
              setMarkdown(value);
            }}
            renderPreview={(value) => <div>{value}</div>}
          />
        );
      };

      const { container, cleanup } = render(createElement(Harness));
      const firstHeaderCell = container.querySelector<HTMLElement>(".markdown-hybrid-table-cell-header");
      expect(firstHeaderCell).toBeTruthy();

      dispatchMouseDown(firstHeaderCell);

      const textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-cell-editor");
      expect(textarea).toBeTruthy();
      setTextareaSelection(textarea, 2);

      dispatchMouseDown(textarea, { clientX: 12, clientY: 12 });

      expect(textarea?.selectionStart).toBe(2);
      expect(textarea?.selectionEnd).toBe(2);
      cleanup();
    });
  });

  it("toggles table code view and repairs boundary pipes on return to grid", () => {
    let latestMarkdown = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-code-toggle"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const firstHeaderCell = container.querySelector<HTMLElement>(".markdown-hybrid-table-cell-header");
    dispatchMouseDown(firstHeaderCell);

    const toggle = container.querySelector<HTMLButtonElement>(".markdown-hybrid-table-view-toggle");
    expect(toggle).toBeTruthy();
    dispatchClick(toggle);

    const codeEditor = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-table-code-editor");
    expect(codeEditor).toBeTruthy();
    applyTextInput(
      codeEditor,
      ["A | B", "--- | ---", "1 | 2"].join("\n"),
    );

    dispatchClick(container.querySelector(".markdown-hybrid-table-view-toggle"));

    expect(container.querySelector(".markdown-hybrid-table-code-editor")).toBeNull();
    expect(latestMarkdown).toBe(
      ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n"),
    );
    cleanup();
  });

  it("keeps tables in grid mode until Code View is clicked when table code policy is button-only", () => {
    withImmediateRaf(() => {
      const markdown = [
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "| C | D |",
        "| --- | --- |",
        "| 3 | 4 |",
      ].join("\n");

      const { container, cleanup } = render(
        <MarkdownHybridEditor
          historyKey="table-code-policy-button-only"
          markdown={markdown}
          mode="edit"
          tableCodeViewPolicy="button-only"
          onChange={() => undefined}
          renderPreview={(value) => <div>{value}</div>}
        />,
      );

      const tableBlocks = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-table-block"),
      );
      expect(tableBlocks).toHaveLength(2);
      const firstTable = tableBlocks[0];
      const secondTable = tableBlocks[1];
      expect(firstTable).toBeTruthy();
      expect(secondTable).toBeTruthy();

      const firstHeaderCell = firstTable?.querySelector<HTMLElement>(".markdown-hybrid-table-cell-header");
      const secondHeaderCell = secondTable?.querySelector<HTMLElement>(".markdown-hybrid-table-cell-header");
      expect(firstHeaderCell).toBeTruthy();
      expect(secondHeaderCell).toBeTruthy();

      dispatchMouseDown(firstHeaderCell);
      expect(firstTable?.querySelector(".markdown-hybrid-table-code-editor")).toBeNull();

      const firstToggle = firstTable?.querySelector<HTMLButtonElement>(".markdown-hybrid-table-view-toggle");
      expect(firstToggle).toBeTruthy();
      dispatchClick(firstToggle);
      expect(firstTable?.querySelector(".markdown-hybrid-table-code-editor")).toBeTruthy();

      dispatchMouseDown(secondHeaderCell);
      expect(firstTable?.querySelector(".markdown-hybrid-table-code-editor")).toBeNull();

      dispatchMouseDown(firstHeaderCell);
      expect(firstTable?.querySelector(".markdown-hybrid-table-code-editor")).toBeNull();

      dispatchClick(firstTable?.querySelector<HTMLButtonElement>(".markdown-hybrid-table-view-toggle") ?? null);
      expect(firstTable?.querySelector(".markdown-hybrid-table-code-editor")).toBeTruthy();

      cleanup();
    });
  });

  it("deletes selected table rows with the Delete key while preserving header and separator", () => {
    let latestMarkdown = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "| 3 | 4 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-row-delete"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    dispatchMouseDown(container.querySelector(".markdown-hybrid-table-cell-header"));

    const firstBodyRowButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-row-select[data-md-table-row-index='1']",
    );
    expect(firstBodyRowButton).toBeTruthy();
    dispatchMouseDown(firstBodyRowButton);
    dispatchKeyDown(container.querySelector(".markdown-hybrid-table-block"), "Delete");

    expect(latestMarkdown).toBe(
      ["| A | B |", "| --- | --- |", "| 3 | 4 |"].join("\n"),
    );
    cleanup();
  });

  it("supports shift-range and ctrl-additive selection from row and column context clicks", () => {
    let latestMarkdown = [
      "| A | B | C |",
      "| --- | --- | --- |",
      "| 1 | 2 | 3 |",
      "| 4 | 5 | 6 |",
      "| 7 | 8 | 9 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-context-multi-select"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    dispatchMouseDown(container.querySelector(".markdown-hybrid-table-cell-header"));

    const firstColumnButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-column-select[data-md-table-column-index='0']",
    );
    const thirdColumnButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-column-select[data-md-table-column-index='2']",
    );
    expect(firstColumnButton).toBeTruthy();
    expect(thirdColumnButton).toBeTruthy();

    dispatchContextMenu(firstColumnButton, { clientX: 220, clientY: 120 });
    dispatchContextMenu(thirdColumnButton, { shiftKey: true, clientX: 360, clientY: 120 });

    expect(container.querySelectorAll(".markdown-hybrid-table-column-lane.is-selected")).toHaveLength(3);

    const firstBodyRowButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-row-select[data-md-table-row-index='1']",
    );
    const thirdBodyRowButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-row-select[data-md-table-row-index='3']",
    );
    expect(firstBodyRowButton).toBeTruthy();
    expect(thirdBodyRowButton).toBeTruthy();

    dispatchContextMenu(firstBodyRowButton, { clientX: 120, clientY: 220 });
    dispatchContextMenu(thirdBodyRowButton, { ctrlKey: true, clientX: 120, clientY: 300 });

    expect(container.querySelectorAll(".markdown-hybrid-table-row-lane.is-selected")).toHaveLength(2);
    expect(container.querySelectorAll(".markdown-hybrid-table-column-lane.is-selected")).toHaveLength(0);
    cleanup();
  });

  it("clears all cells in the selected columns from the table context menu", () => {
    let latestMarkdown = [
      "| H1 | H2 | H3 |",
      "| --- | --- | --- |",
      "| A1 | A2 | A3 |",
      "| B1 | B2 | B3 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-clear-column-contents"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    dispatchMouseDown(container.querySelector(".markdown-hybrid-table-cell-header"));

    const firstColumnButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-column-select[data-md-table-column-index='0']",
    );
    const secondColumnButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-column-select[data-md-table-column-index='1']",
    );
    expect(firstColumnButton).toBeTruthy();
    expect(secondColumnButton).toBeTruthy();

    dispatchContextMenu(firstColumnButton, { clientX: 220, clientY: 120 });
    dispatchContextMenu(secondColumnButton, { ctrlKey: true, clientX: 290, clientY: 120 });
    dispatchClick(findButtonByExactText(container, "Clear column contents"));

    expect(latestMarkdown).toBe(
      ["|  |  | H3 |", "| --- | --- | --- |", "|  |  | A3 |", "|  |  | B3 |"].join("\n"),
    );
    cleanup();
  });

  it("clears all cells in the selected rows from the table context menu", () => {
    let latestMarkdown = [
      "| H1 | H2 |",
      "| --- | --- |",
      "| A1 | A2 |",
      "| B1 | B2 |",
      "| C1 | C2 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-clear-row-contents"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    dispatchMouseDown(container.querySelector(".markdown-hybrid-table-cell-header"));

    const firstBodyRowButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-row-select[data-md-table-row-index='1']",
    );
    const thirdBodyRowButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-row-select[data-md-table-row-index='3']",
    );
    expect(firstBodyRowButton).toBeTruthy();
    expect(thirdBodyRowButton).toBeTruthy();

    dispatchContextMenu(firstBodyRowButton, { clientX: 120, clientY: 220 });
    dispatchContextMenu(thirdBodyRowButton, { ctrlKey: true, clientX: 120, clientY: 300 });
    dispatchClick(findButtonByExactText(container, "Clear row contents"));

    expect(latestMarkdown).toBe(
      ["| H1 | H2 |", "| --- | --- |", "|  |  |", "| B1 | B2 |", "|  |  |"].join("\n"),
    );
    cleanup();
  });

  it("reorders columns by dragging the column label and shows a drop indicator", () => {
    let latestMarkdown = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-column-drag"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const createRect = (left: number, top: number, width: number, height: number) => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => undefined,
    });

    const { container, cleanup } = render(createElement(Harness));
    dispatchMouseDown(container.querySelector(".markdown-hybrid-table-cell-header"));

    expect(container.querySelector(".markdown-hybrid-table-column-move")).toBeNull();
    expect(container.querySelector(".markdown-hybrid-table-row-move")).toBeNull();

    const shell = container.querySelector<HTMLElement>(".markdown-hybrid-table-shell");
    const columnLanes = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-table-column-lane"),
    );
    const firstColumnButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-column-select[data-md-table-column-index='0']",
    );
    expect(shell).toBeTruthy();
    expect(columnLanes).toHaveLength(2);
    expect(firstColumnButton).toBeTruthy();

    Object.defineProperty(shell, "getBoundingClientRect", {
      configurable: true,
      value: () => createRect(100, 200, 420, 180),
    });
    Object.defineProperty(columnLanes[0]!, "getBoundingClientRect", {
      configurable: true,
      value: () => createRect(180, 200, 120, 39),
    });
    Object.defineProperty(columnLanes[1]!, "getBoundingClientRect", {
      configurable: true,
      value: () => createRect(301, 200, 120, 39),
    });

    dispatchMouseDown(firstColumnButton, { clientX: 220, clientY: 220 });
    dispatchWindowMouseMove({ clientX: 380, clientY: 220 });

    expect(container.querySelector(".markdown-hybrid-table-column-drop-indicator")).toBeTruthy();

    dispatchWindowMouseUp({ clientX: 380, clientY: 220 });

    expect(latestMarkdown).toBe(
      ["| B | A |", "| --- | --- |", "| 2 | 1 |"].join("\n"),
    );
    cleanup();
  });

  it("reorders body rows by dragging the row label and shows a drop indicator", () => {
    let latestMarkdown = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "| 3 | 4 |",
    ].join("\n");

    const Harness = () => {
      const [markdown, setMarkdown] = useState(latestMarkdown);
      return (
        <MarkdownHybridEditor
          historyKey="table-row-drag"
          markdown={markdown}
          mode="edit"
          onChange={(value) => {
            latestMarkdown = value;
            setMarkdown(value);
          }}
          renderPreview={(value) => <div>{value}</div>}
        />
      );
    };

    const createRect = (left: number, top: number, width: number, height: number) => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => undefined,
    });

    const { container, cleanup } = render(createElement(Harness));
    dispatchMouseDown(container.querySelector(".markdown-hybrid-table-cell-header"));

    const shell = container.querySelector<HTMLElement>(".markdown-hybrid-table-shell");
    const rowLanes = Array.from(
      container.querySelectorAll<HTMLElement>(".markdown-hybrid-table-row-lane:not(.markdown-hybrid-table-row-lane-header)"),
    );
    const firstRowButton = container.querySelector<HTMLButtonElement>(
      ".markdown-hybrid-table-row-select[data-md-table-row-index='1']",
    );
    expect(shell).toBeTruthy();
    expect(rowLanes).toHaveLength(2);
    expect(firstRowButton).toBeTruthy();

    Object.defineProperty(shell, "getBoundingClientRect", {
      configurable: true,
      value: () => createRect(100, 200, 420, 220),
    });
    Object.defineProperty(rowLanes[0]!, "getBoundingClientRect", {
      configurable: true,
      value: () => createRect(114, 240, 72, 39),
    });
    Object.defineProperty(rowLanes[1]!, "getBoundingClientRect", {
      configurable: true,
      value: () => createRect(114, 280, 72, 39),
    });

    dispatchMouseDown(firstRowButton, { clientX: 130, clientY: 255 });
    dispatchWindowMouseMove({ clientX: 130, clientY: 315 });

    expect(container.querySelector(".markdown-hybrid-table-row-drop-indicator")).toBeTruthy();

    dispatchWindowMouseUp({ clientX: 130, clientY: 315 });

    expect(latestMarkdown).toBe(
      ["| A | B |", "| --- | --- |", "| 3 | 4 |", "| 1 | 2 |"].join("\n"),
    );
    cleanup();
  });

  it("renders exam markdown preview in content layer with inline styles and list metadata", () => {
    const Harness = () => {
      const [markdown, setMarkdown] = useState(
        [
          "1) **Bold**",
          "2) *Italic* and ~~Strike~~ and ==Mark==",
          "",
          "1. Soft line",
          "   break",
        ].join("\n"),
      );
      return (
        <MarkdownHybridEditor
          historyKey="exam-markdown-preview-sync"
          markdown={markdown}
          mode="edit"
          onChange={setMarkdown}
          renderPreview={(value) => <ExamMarkdown content={value} />}
        />
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const contentLayer = container.querySelector(".markdown-hybrid-content-layer");
    expect(contentLayer).toBeTruthy();

    const preview = container.querySelector(".markdown-hybrid-block-preview .exam-markdown");
    expect(preview).toBeTruthy();
    expect(preview?.querySelector("strong")?.textContent).toBe("Bold");
    expect(preview?.querySelector("em")?.textContent).toBe("Italic");
    expect(preview?.querySelector("del")?.textContent).toBe("Strike");
    expect(preview?.querySelector("mark.md-inline-highlight")?.textContent).toBe("Mark");
    expect(preview?.querySelector("ol[data-md-ordered-delimiter=')']")).toBeTruthy();
    expect(preview?.querySelector("li br")).toBeTruthy();

    cleanup();
  });
});
