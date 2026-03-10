// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { FastToolsPanel } from "./FastToolsPanel";

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

const buildProps = (autoTimeEnabled: boolean) => {
  const setFastFlashcardAutoTimeEnabled = vi.fn();
  return {
    fastFlashcards: {
      handleFlashcardScan: vi.fn(),
      isFlashcardScanning: false,
    },
    settings: {
      fastFlashcardOrder: "in-order" as const,
      fastFlashcardMode: "all" as const,
      fastFlashcardScope: "current" as const,
      fastFlashcardAutoTimeEnabled: autoTimeEnabled,
      setFastFlashcardOrder: vi.fn(),
      setFastFlashcardMode: vi.fn(),
      setFastFlashcardScope: vi.fn(),
      setFastFlashcardAutoTimeEnabled,
    },
    selectedDuration: 24,
    setSelectedDuration: vi.fn(),
    isTimeModeEnabled: false,
    setFastFlashcardAutoTimeEnabled,
  };
};

describe("FastToolsPanel", () => {
  it("shows Auto Time and manual durations when auto mode is off", () => {
    const props = buildProps(false);
    const { container, cleanup } = render(
      createElement(FastToolsPanel, {
        fastFlashcards: props.fastFlashcards,
        settings: props.settings,
        selectedDuration: props.selectedDuration,
        setSelectedDuration: props.setSelectedDuration,
        isTimeModeEnabled: props.isTimeModeEnabled,
      }),
    );

    expect(container.textContent).toContain("Auto Time");
    expect(container.textContent).toContain("12s");
    expect(container.textContent).toContain("24s");
    expect(container.textContent).toContain("48s");

    const autoButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Auto Time"),
    );
    act(() => {
      autoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.setFastFlashcardAutoTimeEnabled).toHaveBeenCalledWith(true);
    cleanup();
  });

  it("hides manual durations when auto mode is on", () => {
    const props = buildProps(true);
    const { container, cleanup } = render(
      createElement(FastToolsPanel, {
        fastFlashcards: props.fastFlashcards,
        settings: props.settings,
        selectedDuration: props.selectedDuration,
        setSelectedDuration: props.setSelectedDuration,
        isTimeModeEnabled: props.isTimeModeEnabled,
      }),
    );

    expect(container.textContent).toContain("Auto Time");
    expect(container.textContent).not.toContain("12s");
    expect(container.textContent).not.toContain("24s");
    expect(container.textContent).not.toContain("48s");

    cleanup();
  });
});
