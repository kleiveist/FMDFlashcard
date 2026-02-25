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
});
