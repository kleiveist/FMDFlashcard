// @vitest-environment jsdom
/**
 * @file frontend/src/lib/useMobileSafeInput.test.tsx
 *
 * Zweck:
 * - Verifiziert beforeinput/deleteContentBackward Handling fuer virtuelle Tastaturen.
 */

import { act, createElement, useEffect, useState, type ReactElement, type FormEvent } from "react";
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

const buildCompositionEvent = (type: "compositionstart" | "compositionend") => {
  const event =
    typeof CompositionEvent !== "undefined"
      ? new CompositionEvent(type, { bubbles: true, cancelable: true })
      : new Event(type, { bubbles: true, cancelable: true });
  return event;
};

const dispatchFocusIn = (element: HTMLElement | null) => {
  if (!element) {
    return;
  }
  element.dispatchEvent(new Event("focusin", { bubbles: true }));
};

describe("useMobileSafeInput", () => {
  it("updates state on deleteContentBackward beforeinput", () => {
    let latestInputProps: ReturnType<typeof useMobileSafeInput<HTMLInputElement>>["inputProps"] | null = null;
    const Harness = () => {
      const [value, setValue] = useState("Test");
      const { inputProps } = useMobileSafeInput<HTMLInputElement>({
        value,
        onValueChange: setValue,
      });
      latestInputProps = inputProps;
      return createElement("input", { type: "text", ...inputProps });
    };

    const { container, cleanup } = render(createElement(Harness));
    const input = container.querySelector("input");
    expect(input).toBeTruthy();

    act(() => {
      if (!input || !latestInputProps?.onBeforeInput) {
        return;
      }
      input.focus();
      dispatchFocusIn(input);
      input.value = "Test";
      Object.defineProperty(input, "selectionStart", {
        configurable: true,
        get: () => 4,
      });
      Object.defineProperty(input, "selectionEnd", {
        configurable: true,
        get: () => 4,
      });
      latestInputProps.onBeforeInput({
        currentTarget: input,
        nativeEvent: { inputType: "deleteContentBackward" },
        defaultPrevented: false,
      } as unknown as FormEvent<HTMLInputElement>);
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

  it("applies composition text on compositionend without snapping back", () => {
    const Harness = () => {
      const [value, setValue] = useState("Test");
      const { inputProps } = useMobileSafeInput<HTMLInputElement>({
        value,
        onValueChange: setValue,
      });
      return createElement(
        "div",
        null,
        createElement("input", { type: "text", ...inputProps }),
        createElement("span", { "data-testid": "value" }, value),
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const input = container.querySelector("input");
    const valueNode = container.querySelector("[data-testid='value']");
    expect(input).toBeTruthy();
    expect(valueNode?.textContent).toBe("Test");

    act(() => {
      if (!input) {
        return;
      }
      input.focus();
      dispatchFocusIn(input);
      input.dispatchEvent(buildCompositionEvent("compositionstart"));
      input.value = "TestX";
      input.dispatchEvent(buildBeforeInputEvent("insertCompositionText"));
      input.dispatchEvent(buildInputEvent("insertCompositionText"));
    });

    expect(valueNode?.textContent).toBe("Test");

    act(() => {
      input?.dispatchEvent(buildCompositionEvent("compositionend"));
    });

    expect(valueNode?.textContent).toBe("TestX");
    cleanup();
  });

  it("blocks external sync while focused and editing", () => {
    const Harness = () => {
      const [value, setValue] = useState("Alpha");
      const [externalValue, setExternalValue] = useState("Alpha");
      const { inputProps, shouldBlockExternalUpdates } =
        useMobileSafeInput<HTMLInputElement>({
          value,
          onValueChange: setValue,
        });

      useEffect(() => {
        if (shouldBlockExternalUpdates()) {
          return;
        }
        setValue(externalValue);
      }, [externalValue, shouldBlockExternalUpdates]);

      return createElement(
        "div",
        null,
        createElement("input", { type: "text", ...inputProps }),
        createElement(
          "button",
          { type: "button", onClick: () => setExternalValue("Restored") },
          "restore",
        ),
        createElement(
          "button",
          { type: "button", onClick: () => setExternalValue("Synced") },
          "sync",
        ),
        createElement("span", { "data-testid": "value" }, value),
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const input = container.querySelector("input");
    const valueNode = container.querySelector("[data-testid='value']");
    const buttons = container.querySelectorAll("button");
    const restoreButton = buttons.item(0);
    const syncButton = buttons.item(1);

    act(() => {
      if (!input) {
        return;
      }
      input.focus();
      dispatchFocusIn(input);
      input.value = "AlphaX";
      input.dispatchEvent(buildInputEvent("insertText"));
    });

    expect(valueNode?.textContent).toBe("AlphaX");

    act(() => {
      restoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(valueNode?.textContent).toBe("AlphaX");

    act(() => {
      input?.blur();
      syncButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(valueNode?.textContent).toBe("Synced");
    cleanup();
  });
});
