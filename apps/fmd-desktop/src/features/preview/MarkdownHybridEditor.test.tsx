// @vitest-environment jsdom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
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

  it("renders insert menu without a Page entry and keeps Code/Formula as grid menu items in Advanced", () => {
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
      expect(codeButtons).toHaveLength(1);
      expect(formulaButtons).toHaveLength(1);
      expect(codeButtons[0]?.parentElement).toBe(list);
      expect(formulaButtons[0]?.parentElement).toBe(list);
      expect(codeButtons[0]?.getAttribute("role")).toBe("menuitem");
      expect(formulaButtons[0]?.getAttribute("role")).toBe("menuitem");
      expect(findMenuItemButtonByLabel(container, "Flashcard Block")).toBeNull();

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
});
