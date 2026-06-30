// @vitest-environment jsdom

import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { FlashcardAreaMenuTrigger } from "./FlashcardAreaMenu";

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
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const Harness = ({
  onToggle,
  locked = false,
}: {
  onToggle: (nextEnabled: boolean) => void;
  locked?: boolean;
}) => {
  const [enabled, setEnabled] = useState(true);
  return createElement(FlashcardAreaMenuTrigger, {
    enabled,
    pending: false,
    locked,
    onToggle: (nextEnabled) => {
      onToggle(nextEnabled);
      setEnabled(nextEnabled);
    },
  });
};

describe("FlashcardAreaMenuTrigger", () => {
  it("renders a direct switch without trigger button or anchored popup", () => {
    const onToggle = vi.fn();
    const { container, cleanup } = render(createElement(Harness, { onToggle }));

    expect(container.querySelector(".flashcard-area-switch-panel")).toBeTruthy();
    expect(container.querySelector(".flashcard-area-menu-trigger")).toBeNull();
    expect(document.querySelector(".anchored-popup-body")).toBeNull();
    expect(document.querySelector(".flashcard-area-dropdown")).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);

    cleanup();
  });

  it("toggles through the full-row switch interaction", () => {
    const onToggle = vi.fn();
    const { container, cleanup } = render(createElement(Harness, { onToggle }));

    const flashcardRow = container.querySelector<HTMLLabelElement>(".flashcard-area-toggle-row");
    expect(flashcardRow).toBeTruthy();

    dispatchClick(flashcardRow);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
    cleanup();
  });

  it("locks the switch and shows a compact notice for incorrect answers", () => {
    const onToggle = vi.fn();
    const { container, cleanup } = render(
      createElement(Harness, { onToggle, locked: true }),
    );

    const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(input?.disabled).toBe(true);
    expect(container.querySelector(".flashcard-area-switch-notice")?.textContent).toContain(
      "Diese Karte bleibt im Kartenpool",
    );

    dispatchClick(container.querySelector(".flashcard-area-toggle-row"));

    expect(onToggle).not.toHaveBeenCalled();
    cleanup();
  });
});
