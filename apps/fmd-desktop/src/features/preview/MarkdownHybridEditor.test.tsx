// @vitest-environment jsdom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MarkdownHybridEditor } from "./MarkdownHybridEditor";
import { ADVANCED_INSERT_TEMPLATE_CATALOG } from "./insertTemplates";

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

const findButtonByExactText = (container: ParentNode, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label,
  ) ?? null;

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

  it("inserts every Advanced template and selects the first placeholder", () => {
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
        dispatchClick(templateButton);

        const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
        expect(markdownValue).toBe(template.payload);

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

  it("continues a quote block with Enter and keeps the quote prefix", () => {
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
      expect(textarea?.value).toBe("> Quote text\n> ");
      expect(readMarkdown()).toBe("> Quote text\n> ");
      expect(textarea?.selectionStart).toBe("> Quote text\n> ".length);
      expect(textarea?.selectionEnd).toBe("> Quote text\n> ".length);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blockquote']"),
      ).toHaveLength(1);

      cleanup();
    });
  });

  it("exits quote mode only when pressing Enter on an empty quote line", () => {
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

      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds[0]).toBe("blockquote");
      expect(blockKinds[1]).toBe("blank");

      textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='1'] .markdown-hybrid-block-editor",
      );
      expect(textarea).toBeTruthy();
      expect(textarea?.value).toBe("");

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue.startsWith("> Quote text\n")).toBe(true);
      expect(markdownValue).not.toContain("\n> \n");

      cleanup();
    });
  });

  it("continues a nested quote block with Enter and preserves the >> prefix", () => {
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
      expect(textarea?.value).toBe(">> Nested quote text\n>> ");
      expect(textarea?.selectionStart).toBe(">> Nested quote text\n>> ".length);
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blockquote']"),
      ).toHaveLength(1);

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
      expect(textarea?.value).toBe("> Quote\n> ");
      applyTextareaInput(textarea, "> Quote\n> A");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "Enter", { shiftKey: true });
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      applyTextareaInput(textarea, "> Quote\n> A\n> B");

      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "Enter", { shiftKey: true });
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      applyTextareaInput(textarea, "> Quote\n> A\n> B\n> C");

      expect(readMarkdown()).toBe("> Quote\n> A\n> B\n> C");
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blockquote']"),
      ).toHaveLength(1);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

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
      expect(readMarkdown()).toContain("[[Alpha]]");
      expect(textarea?.value).toBe("[[Alpha]]");
      expect(textarea?.selectionStart).toBe("[[Alpha]]".length);
      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeNull();

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
      expect(readMarkdown()).toBe("Alpha [[Folder/Beta]]");
      expect(textarea?.value).toBe("Alpha [[Folder/Beta]]");
      expect(textarea?.selectionStart).toBe("Alpha [[Folder/Beta]]".length);
      expect(container.querySelector(".markdown-hybrid-page-link-picker")).toBeNull();

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
      expect(readMarkdown()).toBe("A  B");

      applyTextareaInput(textarea, initialMarkdown, beforeIndex);
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      dispatchKeyDown(textarea, "Delete");
      textarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-block-editor");
      expect(textarea?.value).toBe("A  B");
      expect(readMarkdown()).toBe("A  B");

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
});
