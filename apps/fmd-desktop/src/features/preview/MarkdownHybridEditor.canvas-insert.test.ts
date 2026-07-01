// @vitest-environment jsdom
import { act, createElement, type ReactElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarkdownHybridEditor } from "./MarkdownHybridEditor";

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

const dispatchClick = (element: Element | null | undefined) => {
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

const withImmediateRaf = (callback: () => void) => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  window.requestAnimationFrame = (frameCallback) => {
    frameCallback(performance.now());
    return 1;
  };
  window.cancelAnimationFrame = () => undefined;
  try {
    callback();
  } finally {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  }
};

const findButtonByExactText = (container: ParentNode, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label,
  ) ?? null;

const findMenuItemButtonByLabel = (container: ParentNode, label: string) => {
  const labelNode = Array.from(
    container.querySelectorAll<HTMLElement>(".markdown-hybrid-insert-menu-item-label"),
  ).find((node) => node.textContent?.trim() === label);
  return labelNode?.closest<HTMLButtonElement>("button") ?? findButtonByExactText(container, label);
};

const CanvasInsertHarness = () => {
  const [markdown, setMarkdown] = useState("");
  return createElement(
    "div",
    null,
    createElement("div", { "data-testid": "markdown-value" }, markdown),
    createElement(MarkdownHybridEditor, {
      historyKey: "markdown-hybrid-canvas-insert",
      markdown,
      mode: "edit",
      onChange: setMarkdown,
      renderPreview: (value) => createElement("div", null, value),
    }),
  );
};

describe("MarkdownHybridEditor Canvas insert menu", () => {
  it("shows Canvas directly below Standard Blocks in the top-level insert menu", () => {
    withImmediateRaf(() => {
      const { container, cleanup } = render(createElement(CanvasInsertHarness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));

      const labels = Array.from(
        container.querySelectorAll<HTMLElement>(".markdown-hybrid-insert-menu-item-label"),
      ).map((node) => node.textContent?.trim() ?? "");
      expect(labels.slice(0, 2)).toEqual(["Standard Blocks", "Canvas"]);
      expect(findMenuItemButtonByLabel(container, "Canvas")).toBeTruthy();

      cleanup();
    });
  });

  it("inserts a valid Canvas markdown block and renders the embedded Canvas field", () => {
    withImmediateRaf(() => {
      const { container, cleanup } = render(createElement(CanvasInsertHarness));
      dispatchClick(container.querySelector(".markdown-hybrid-block-insert-button"));

      const canvasButton = findMenuItemButtonByLabel(container, "Canvas");
      expect(canvasButton).toBeTruthy();
      expect(
        canvasButton?.querySelector(
          ".markdown-hybrid-insert-menu-item-icon[data-md-insert-menu-icon='canvas']",
        ),
      ).toBeTruthy();

      dispatchClick(canvasButton);

      const markdownValue = container.querySelector("[data-testid='markdown-value']")?.textContent ?? "";
      expect(markdownValue).toContain("#canvas");
      expect(markdownValue).toContain("\"id\": \"node-1\"");
      expect(markdownValue).toContain("\"text\": \"Neue Karte\"");
      expect(markdownValue).toContain("#canvasend");
      expect(container.querySelector(".canvas-embedded-block")).not.toBeNull();
      expect(container.querySelector(".business-canvas-editor")).not.toBeNull();
      expect(container.querySelector(".business-canvas-viewport")).not.toBeNull();
      expect(container.querySelector(".business-canvas-card-node")).not.toBeNull();
      expect(container.textContent).toContain("Neue Karte");
      expect(findButtonByExactText(container, "View")).toBeNull();
      expect(findButtonByExactText(container, "Edit")).toBeNull();
      expect(findButtonByExactText(container, "Code")).toBeNull();

      cleanup();
    });
  });
});
