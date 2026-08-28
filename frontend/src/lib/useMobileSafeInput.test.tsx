// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/lib/useMobileSafeInput.test.tsx
 *
 * Zweck:
 * - Verifiziert beforeinput/deleteContentBackward Handling fuer virtuelle Tastaturen.
 */

import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useMobileSafeInput } from "./useMobileSafeInput";

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

const buildBeforeInputEvent = (inputType: string) => {
  const event =
    typeof InputEvent !== "undefined"
      ? new InputEvent("beforeinput", { bubbles: true, cancelable: true })
      : new Event("beforeinput", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "inputType", { value: inputType });
  return event;
};

const buildInputEvent = (inputType: string) => {
  const event =
    typeof InputEvent !== "undefined"
      ? new InputEvent("input", { bubbles: true, cancelable: true })
      : new Event("input", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "inputType", { value: inputType });
  return event;
};

describe("useMobileSafeInput", () => {
  it("updates state on deleteContentBackward beforeinput", () => {
    const Harness = () => {
      const [value, setValue] = useState("Test");
      const { inputProps } = useMobileSafeInput<HTMLInputElement>({
        value,
        onValueChange: setValue,
      });
      return createElement("input", { type: "text", ...inputProps });
    };

    const { container, cleanup } = render(createElement(Harness));
    const input = container.querySelector("input");
    expect(input).toBeTruthy();

    act(() => {
      input?.focus();
      input?.setSelectionRange(4, 4);
      input?.dispatchEvent(buildBeforeInputEvent("deleteContentBackward"));
    });

    expect(input?.value).toBe("Tes");
    cleanup();
  });

  it("updates state on deleteContentBackward input events using current DOM value", () => {
    const Harness = () => {
      const [value, setValue] = useState("Test");
      const { inputProps } = useMobileSafeInput<HTMLInputElement>({
        value,
        onValueChange: setValue,
      });
      return createElement("input", { type: "text", ...inputProps });
    };

    const { container, cleanup } = render(createElement(Harness));
    const input = container.querySelector("input");
    expect(input).toBeTruthy();

    act(() => {
      if (!input) {
        return;
      }
      input.focus();
      input.value = "Tes";
      input.dispatchEvent(buildInputEvent("deleteContentBackward"));
    });

    expect(input?.value).toBe("Tes");
    cleanup();
  });
});
