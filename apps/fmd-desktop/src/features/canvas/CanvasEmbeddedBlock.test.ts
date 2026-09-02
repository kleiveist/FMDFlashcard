// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
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

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const clickButton = async (button: HTMLButtonElement | undefined | null) => {
  expect(button).toBeDefined();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
};

const buttonWithText = (container: ParentNode, text: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === text,
  );

const buttonWithLabel = (container: ParentNode, label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const buildCanvasBlock = (text = "# Example") =>
  [
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
  it("renders the full Canvas editor inline without embedded mode buttons", async () => {
    const { container, cleanup } = render(
      createElement(CanvasEmbeddedBlock, {
        raw: buildCanvasBlock(),
        allowEditing: true,
        onCommitRaw: vi.fn(),
      }),
    );
    await flush();

    expect(container.querySelector(".canvas-embedded-block")).not.toBeNull();
    expect(container.querySelector(".business-canvas-editor")).not.toBeNull();
    expect(container.querySelector(".business-canvas-viewport")).not.toBeNull();
    expect(container.querySelector(".business-canvas-content")).not.toBeNull();
    expect(container.querySelector(".business-canvas-card-node")).not.toBeNull();
    expect(container.textContent).toContain("Example");
    expect(buttonWithText(container, "View")).toBeUndefined();
    expect(buttonWithText(container, "Edit")).toBeUndefined();
    expect(buttonWithText(container, "Code")).toBeUndefined();
    expect(buttonWithText(container, "Duplicate")).toBeUndefined();
    expect(buttonWithLabel(container, "Canvas view mode")).toBeNull();
    expect(buttonWithLabel(container, "Canvas edit mode")).toBeNull();
    expect(buttonWithLabel(container, "Canvas JSON mode")).toBeNull();

    cleanup();
  });

  it("shows Canvas read-only when Markdown editing is not allowed", async () => {
    const { container, cleanup } = render(
      createElement(CanvasEmbeddedBlock, {
        raw: buildCanvasBlock(),
        allowEditing: false,
        onCommitRaw: vi.fn(),
      }),
    );
    await flush();

    expect(
      container.querySelector(".business-canvas-editor")?.getAttribute("data-canvas-mode"),
    ).toBe("view");
    expect(buttonWithLabel(container, "Add card")?.disabled).toBe(true);
    expect(buttonWithLabel(container, "Delete canvas block")?.disabled).toBe(true);

    cleanup();
  });

  it("edits immediately in Markdown edit mode and commits back to the same raw block", async () => {
    const onCommitRaw = vi.fn();
    const { container, cleanup } = render(
      createElement(CanvasEmbeddedBlock, {
        raw: buildCanvasBlock(),
        allowEditing: true,
        onCommitRaw,
      }),
    );
    await flush();

    expect(
      container.querySelector(".business-canvas-editor")?.getAttribute("data-canvas-mode"),
    ).toBe("edit");
    const addCardButton = buttonWithLabel(container, "Add card");
    expect(addCardButton?.disabled).toBe(false);
    await clickButton(addCardButton);
    await flush();

    expect(container.querySelectorAll(".business-canvas-card-node")).toHaveLength(2);
    expect(onCommitRaw).toHaveBeenCalled();
    const committedRaw = onCommitRaw.mock.calls[onCommitRaw.mock.calls.length - 1]?.[0] as string;
    expect(committedRaw).toContain("#canvas");
    expect(committedRaw).toContain("#canvasend");
    expect(committedRaw).toContain('"text": "Neue Karte"');

    cleanup();
  });

  it("confirms before deleting the Markdown Canvas block", async () => {
    const onCommitRaw = vi.fn();
    const { container, cleanup } = render(
      createElement(CanvasEmbeddedBlock, {
        raw: buildCanvasBlock(),
        allowEditing: true,
        onCommitRaw,
      }),
    );
    await flush();

    await clickButton(buttonWithLabel(container, "Delete canvas block"));
    expect(document.body.textContent).toContain("Canvas loeschen?");
    await clickButton(buttonWithText(document.body, "Abbrechen"));
    expect(onCommitRaw).not.toHaveBeenCalled();

    await clickButton(buttonWithLabel(container, "Delete canvas block"));
    await clickButton(buttonWithText(document.body, "Canvas loeschen"));
    expect(onCommitRaw).toHaveBeenCalledWith("");

    cleanup();
  });

  it("shows an error for invalid Canvas JSON", async () => {
    const { container, cleanup } = render(
      createElement(CanvasEmbeddedBlock, {
        raw: ["#canvas", "{ nope", "#canvasend"].join("\n"),
      }),
    );
    await flush();

    expect(container.querySelector(".canvas-embedded-error")?.textContent).toContain(
      "Canvas JSON could not be parsed",
    );

    cleanup();
  });
});
