// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { CursorAccessoryOverlay } from "./CursorAccessoryOverlay";

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

type RenderHandle = {
  cleanup: () => void;
};

const mockRect = (
  element: HTMLElement,
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => ({}),
    }),
  });
};

const renderOverlay = (enabled = true): RenderHandle => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(CursorAccessoryOverlay, { enabled }));
  });
  return {
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
};

let cleanup: (() => void) | null = null;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

beforeEach(() => {
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: () => {},
  });
});

afterEach(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  const overlayRoot = document.getElementById("cursor-accessory-overlay-root");
  overlayRoot?.remove();
  document
    .querySelectorAll("input, textarea, [role=\"textbox\"], [contenteditable=\"true\"]")
    .forEach((node) => node.remove());
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1024,
  });
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: originalRequestAnimationFrame,
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: originalCancelAnimationFrame,
  });
});

describe("CursorAccessoryOverlay", () => {
  it("shows one global cursor button for focused editable fields on compact viewports", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 980,
    });
    cleanup = renderOverlay(true).cleanup;

    const input = document.createElement("input");
    input.type = "text";
    mockRect(input, { left: 100, top: 120, width: 220, height: 44 });
    document.body.appendChild(input);

    act(() => {
      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    const button = document.querySelector(".cursor-accessory-button");
    expect(button).toBeTruthy();
    expect(document.querySelectorAll(".cursor-accessory-button")).toHaveLength(1);
    expect(button?.querySelector(".cursor-accessory-icon")).toBeTruthy();
  });

  it("does not render on viewports >= 1200px", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1300,
    });
    cleanup = renderOverlay(true).cleanup;

    const input = document.createElement("input");
    input.type = "search";
    mockRect(input, { left: 80, top: 90, width: 240, height: 40 });
    document.body.appendChild(input);

    act(() => {
      input.focus();
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    expect(document.querySelector(".cursor-accessory-button")).toBeNull();
  });

  it("keeps focus on the active field and deletes backward on tap", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 980,
    });
    cleanup = renderOverlay(true).cleanup;

    const textarea = document.createElement("textarea");
    textarea.value = "abc";
    textarea.setSelectionRange(2, 2);
    mockRect(textarea, { left: 140, top: 200, width: 260, height: 120 });
    document.body.appendChild(textarea);

    act(() => {
      textarea.focus();
      textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    const button = document.querySelector(
      ".cursor-accessory-button",
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
      );
    });

    expect(document.activeElement).toBe(textarea);
    expect(textarea.value).toBe("ac");
  });

  it("supports role=textbox targets", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 980,
    });
    cleanup = renderOverlay(true).cleanup;

    const textbox = document.createElement("div");
    textbox.setAttribute("role", "textbox");
    textbox.setAttribute("aria-multiline", "true");
    textbox.tabIndex = 0;
    mockRect(textbox, { left: 40, top: 300, width: 320, height: 80 });
    document.body.appendChild(textbox);

    act(() => {
      textbox.focus();
      textbox.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    expect(document.querySelector(".cursor-accessory-button")).toBeTruthy();
  });
});
