// @vitest-environment jsdom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarkdownHybridEditor } from "./MarkdownHybridEditor";

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
            clientX: 5,
            clientY: 5,
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
            clientX: 16,
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
        }),
      );
    });

    act(() => {
      blocks[2]?.dispatchEvent(
        new MouseEvent("mouseover", {
          bubbles: true,
          cancelable: true,
          button: 2,
          buttons: 2,
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

      currentPointerTarget = nestedListNode;
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
            clientX: 30,
            clientY: 30,
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
});
