// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { Tooltip } from "./Tooltip";

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

describe("Tooltip", () => {
  it("opens only after the configured hover delay and closes on leave", () => {
    vi.useFakeTimers();
    const { container, cleanup } = render(
      createElement(
        Tooltip,
        { content: "Delayed tooltip", openDelayMs: 450 },
        createElement("button", { type: "button" }, "Trigger"),
      ),
    );

    try {
      const anchor = container.querySelector<HTMLElement>(".ui-tooltip-anchor");
      expect(anchor).toBeTruthy();

      act(() => {
        anchor?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      });
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(449);
      });
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(document.body.textContent).toContain("Delayed tooltip");

      act(() => {
        anchor?.dispatchEvent(
          new MouseEvent("mouseout", {
            bubbles: true,
            relatedTarget: document.body,
          }),
        );
      });
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("does not open when hover ends before delay elapses", () => {
    vi.useFakeTimers();
    const { container, cleanup } = render(
      createElement(
        Tooltip,
        { content: "Should not open", openDelayMs: 450 },
        createElement("button", { type: "button" }, "Trigger"),
      ),
    );

    try {
      const anchor = container.querySelector<HTMLElement>(".ui-tooltip-anchor");
      expect(anchor).toBeTruthy();

      act(() => {
        anchor?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        anchor?.dispatchEvent(
          new MouseEvent("mouseout", {
            bubbles: true,
            relatedTarget: document.body,
          }),
        );
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("opens immediately on focus and closes on blur", () => {
    const { container, cleanup } = render(
      createElement(
        Tooltip,
        { content: "Focus tooltip", openDelayMs: 450 },
        createElement("button", { type: "button" }, "Trigger"),
      ),
    );

    try {
      const trigger = container.querySelector<HTMLButtonElement>("button");
      expect(trigger).toBeTruthy();

      act(() => {
        trigger?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      });
      expect(document.body.textContent).toContain("Focus tooltip");

      act(() => {
        trigger?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      cleanup();
    }
  });
});
