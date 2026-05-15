// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CanvasEmbeddedBlock } from "./CanvasEmbeddedBlock";

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

const buildCanvasBlock = (text = "# Example") => [
  "#canvas",
  JSON.stringify(
    {
      nodes: [
        {
          id: "node-1",
          type: "text",
          text,
          x: 0,
          y: 0,
          width: 240,
          height: 120,
        },
      ],
      edges: [],
    },
    null,
    2,
  ),
  "#canvasend",
].join("\n");

describe("CanvasEmbeddedBlock", () => {
  it("renders a Canvas block inline", () => {
    const { container, cleanup } = render(
      <CanvasEmbeddedBlock raw={buildCanvasBlock()} />,
    );

    expect(container.querySelector(".canvas-embedded-block")).not.toBeNull();
    expect(container.querySelector(".canvas-content-node")).not.toBeNull();
    expect(container.textContent).toContain("Example");

    cleanup();
  });

  it("commits valid Code mode changes only for the current block", () => {
    const onCommitRaw = vi.fn();
    const { container, cleanup } = render(
      <CanvasEmbeddedBlock
        raw={buildCanvasBlock()}
        allowEditing
        onCommitRaw={onCommitRaw}
      />,
    );

    const codeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Code",
    );
    expect(codeButton).toBeDefined();
    act(() => {
      codeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    act(() => {
      if (!textarea) {
        return;
      }
      textarea.value = JSON.stringify({ nodes: [], edges: [] }, null, 2);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const applyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Apply",
    );
    act(() => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCommitRaw).toHaveBeenCalledTimes(1);
    expect(onCommitRaw.mock.calls[0]?.[0]).toContain("#canvas");
    expect(onCommitRaw.mock.calls[0]?.[0]).toContain("\"nodes\": []");

    cleanup();
  });

  it("switches to visual Edit mode for movable nodes", () => {
    const { container, cleanup } = render(
      <CanvasEmbeddedBlock raw={buildCanvasBlock()} allowEditing />,
    );

    const editButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Edit",
    );
    act(() => {
      editButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(".canvas-content-node.is-editable")).not.toBeNull();

    cleanup();
  });

  it("shows an error for invalid Canvas JSON", () => {
    const { container, cleanup } = render(
      <CanvasEmbeddedBlock raw={["#canvas", "{ nope", "#canvasend"].join("\n")} />,
    );

    expect(container.querySelector(".canvas-embedded-error")?.textContent).toContain(
      "Canvas JSON could not be parsed",
    );

    cleanup();
  });
});
