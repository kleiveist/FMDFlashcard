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

const findMathToolboxItemByLabel = (container: ParentNode, label: string) => {
  const labelNode = Array.from(
    container.querySelectorAll<HTMLElement>(".markdown-hybrid-math-toolbox-item-label"),
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
      expect(readMarkdown()).toBe(["#card", "QUESTION TEXT", "", "#endcard"].join("\n"));
      expect(
        container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='card-block']"),
      ).toHaveLength(1);
      expect(container.querySelectorAll(".markdown-hybrid-block[data-md-block-index]")).toHaveLength(1);

      cleanup();
    });
  });

  it("exits a card on Enter at #endcard and creates exactly one new empty text block", () => {
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

      expect(readMarkdown()).toBe(`${initialMarkdown}\n`);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["card-block", "blank"]);

      textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='1'] .markdown-hybrid-block-editor",
      );
      expect(textarea).toBeTruthy();
      expect(textarea?.value).toBe("");
      expect(textarea?.selectionStart).toBe(0);
      expect(textarea?.selectionEnd).toBe(0);

      dispatchKeyDown(textarea, "Enter");
      let blankBlocks = container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blank']");
      expect(blankBlocks).toHaveLength(2);
      textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='2'] .markdown-hybrid-block-editor",
      );
      expect(textarea).toBeTruthy();

      dispatchKeyDown(textarea, "Enter");
      blankBlocks = container.querySelectorAll(".markdown-hybrid-block[data-md-block-kind='blank']");
      expect(blankBlocks).toHaveLength(3);

      cleanup();
    });
  });

  it("uses the same exit behavior for Shift+Enter at #endcard", () => {
    withImmediateRaf(() => {
      const initialMarkdown = ["#card", "QUESTION TEXT", "#endcard"].join("\n");

      const Harness = () => {
        const [markdown, setMarkdown] = useState(initialMarkdown);
        return (
          <MarkdownHybridEditor
            historyKey="card-shift-enter-exit"
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
      setTextareaSelection(textarea, textarea?.value.length ?? 0);
      dispatchKeyDown(textarea, "Enter", { shiftKey: true });

      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["card-block", "blank"]);
      expect(
        container.querySelector(".markdown-hybrid-block[data-md-block-index='1'] .markdown-hybrid-block-editor"),
      ).toBeTruthy();

      cleanup();
    });
  });

  it("exits a math block on Enter at the closing $$ line and focuses a new empty text block", () => {
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

      expect(readMarkdown()).toBe(`${initialMarkdown}\n`);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["math-block", "blank"]);

      textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='1'] .markdown-hybrid-block-editor",
      );
      expect(textarea).toBeTruthy();
      expect(textarea?.value).toBe("");
      expect(textarea?.selectionStart).toBe(0);
      expect(textarea?.selectionEnd).toBe(0);

      cleanup();
    });
  });

  it("inserts math templates into the current math block from the toolbox", () => {
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
      setTextareaSelection(textarea, 3, 3);

      dispatchClick(container.querySelector(".markdown-hybrid-math-toolbox-trigger"));
      const fracButton = findMathToolboxItemByLabel(document.body, "\\frac{a}{b}");
      expect(fracButton).toBeTruthy();
      dispatchClick(fracButton);

      expect(readMarkdown()).toBe("$$\n\\frac{a}{b}\n$$");
      const nextTextarea = container.querySelector<HTMLTextAreaElement>(".markdown-hybrid-math-editor");
      expect(nextTextarea).toBeTruthy();
      const selectedText = nextTextarea?.value.slice(
        nextTextarea.selectionStart ?? 0,
        nextTextarea.selectionEnd ?? 0,
      );
      expect(selectedText).toBe("a");

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

  it("moves typed letters or digits after #endcard into the next text block", () => {
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
      dispatchKeyDown(textarea, "a");

      expect(readMarkdown()).toBe(`${initialMarkdown}\na`);
      const blockKinds = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-block[data-md-block-index]"),
      ).map((block) => block.getAttribute("data-md-block-kind"));
      expect(blockKinds).toEqual(["card-block", "paragraph"]);

      textarea = container.querySelector<HTMLTextAreaElement>(
        ".markdown-hybrid-block[data-md-block-index='1'] .markdown-hybrid-block-editor",
      );
      expect(textarea).toBeTruthy();
      expect(textarea?.value).toBe("a");
      expect(textarea?.selectionStart).toBe(1);
      expect(textarea?.selectionEnd).toBe(1);

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

  it("renders markdown inline formatting tokens only outside the active editor line", () => {
    const initialMarkdown = [
      "QUESTION TEXT",
      "a) ==OPTION== A",
      "b) **OPTION** B",
      "c) *OPTION* C",
      "d) __OPTION__ D",
      "e) ~~OPTION~~ A",
      "f) `OPTION` B",
      "g) $OPTION$ C",
      "h) ***OPTION*** D",
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
      { kind: "markdown-highlight", text: "==OPTION==" },
      { kind: "markdown-bold", text: "**OPTION**" },
      { kind: "markdown-italic", text: "*OPTION*" },
      { kind: "markdown-underline", text: "__OPTION__" },
      { kind: "markdown-strikethrough", text: "~~OPTION~~" },
      { kind: "markdown-inline-code", text: "`OPTION`" },
      { kind: "markdown-math", text: "$OPTION$" },
      { kind: "markdown-bold-italic", text: "***OPTION***" },
    ]);

    const italicLineStart = textarea?.value.indexOf("c) *OPTION* C") ?? -1;
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
      { kind: "markdown-highlight", text: "==OPTION==" },
      { kind: "markdown-bold", text: "**OPTION**" },
      { kind: "markdown-underline", text: "__OPTION__" },
      { kind: "markdown-strikethrough", text: "~~OPTION~~" },
      { kind: "markdown-inline-code", text: "`OPTION`" },
      { kind: "markdown-math", text: "$OPTION$" },
      { kind: "markdown-bold-italic", text: "***OPTION***" },
    ]);

    const codeLineStart = textarea?.value.indexOf("f) `OPTION` B") ?? -1;
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
      { kind: "markdown-highlight", text: "==OPTION==" },
      { kind: "markdown-bold", text: "**OPTION**" },
      { kind: "markdown-italic", text: "*OPTION*" },
      { kind: "markdown-underline", text: "__OPTION__" },
      { kind: "markdown-strikethrough", text: "~~OPTION~~" },
      { kind: "markdown-inline-code", text: "`OPTION`" },
      { kind: "markdown-math", text: "$OPTION$" },
      { kind: "markdown-bold-italic", text: "***OPTION***" },
    ]);
    const activeCodeNode = container.querySelector<HTMLElement>(
      ".markdown-hybrid-block-editor-overlay .md-inline-syntax-markdown-inline-code.is-active-line",
    );
    expect(activeCodeNode?.textContent).toBe("`OPTION`");

    const boldLineStart = textarea?.value.indexOf("b) **OPTION** B") ?? -1;
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
      { kind: "markdown-highlight", text: "==OPTION==" },
      { kind: "markdown-italic", text: "*OPTION*" },
      { kind: "markdown-underline", text: "__OPTION__" },
      { kind: "markdown-strikethrough", text: "~~OPTION~~" },
      { kind: "markdown-inline-code", text: "`OPTION`" },
      { kind: "markdown-math", text: "$OPTION$" },
      { kind: "markdown-bold-italic", text: "***OPTION***" },
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
        expect(readMarkdown()).toBe("Alpha **Beta**");

        dispatchClick(boldButton);
        expect(readMarkdown()).toBe("Alpha Beta");

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
        expect(readMarkdown()).toBe("Alpha **Beta**");

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

        expect(document.body.querySelector(".markdown-hybrid-inline-toolbar-menu")).toBeTruthy();
        expect(container.querySelector(".markdown-hybrid-insert-menu")).toBeNull();

        cleanup();
      } finally {
        vi.useRealTimers();
      }
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

        expect(readMarkdown()).toBe("c) OPTION C");

        cleanup();
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
      expect(readMarkdown()).toBe("Alpha **Beta**");

      dispatchKeyDown(textarea, "b", { ctrlKey: true });
      expect(readMarkdown()).toBe("Alpha Beta");

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
      expect(readMarkdown()).toBe("**OPTION**");

      dispatchKeyDown(textarea, "i", { ctrlKey: true });
      expect(readMarkdown()).toBe("***OPTION***");

      dispatchKeyDown(textarea, "i", { ctrlKey: true });
      expect(readMarkdown()).toBe("**OPTION**");

      dispatchKeyDown(textarea, "b", { ctrlKey: true });
      expect(readMarkdown()).toBe("OPTION");

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
});
