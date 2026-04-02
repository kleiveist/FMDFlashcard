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

const Harness = ({
  onToggle,
}: {
  onToggle: (nextEnabled: boolean) => void;
}) => {
  const [enabled, setEnabled] = useState(true);
  return (
    <FlashcardAreaMenuTrigger
      enabled={enabled}
      pending={false}
      onToggle={(nextEnabled) => {
        onToggle(nextEnabled);
        setEnabled(nextEnabled);
      }}
    />
  );
};

describe("FlashcardAreaMenuTrigger", () => {
  it("opens and closes via trigger reclick and escape", () => {
    const onToggle = vi.fn();
    const { container, cleanup } = render(createElement(Harness, { onToggle }));
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle flashcard area"]',
    );

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".flashcard-area-dropdown")).toBeTruthy();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".flashcard-area-dropdown")).toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector(".flashcard-area-dropdown")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".flashcard-area-dropdown")).toBeNull();
    cleanup();
  });

  it("closes on outside click", () => {
    const onToggle = vi.fn();
    const { container, cleanup } = render(createElement(Harness, { onToggle }));
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle flashcard area"]',
    );

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector(".flashcard-area-dropdown")).toBeTruthy();

    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".flashcard-area-dropdown")).toBeNull();
    cleanup();
  });

  it("toggles through the full-row switch interaction", () => {
    const onToggle = vi.fn();
    const { container, cleanup } = render(createElement(Harness, { onToggle }));
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle flashcard area"]',
    );

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const flashcardRow = Array.from(
      document.querySelectorAll<HTMLLabelElement>(".flashcard-area-toggle-row"),
    ).find((row) => row.textContent?.includes("Flashcard"));
    expect(document.querySelectorAll(".flashcard-area-toggle-row")).toHaveLength(1);
    expect(flashcardRow).toBeTruthy();

    act(() => {
      flashcardRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
    cleanup();
  });
});
