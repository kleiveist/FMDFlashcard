// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamIdlePanel.test.tsx
 *
 * Zweck:
 * - Tests fuer ExamIdlePanel 5-Step Setup.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ExamIdlePanel } from "./ExamIdlePanel";

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

const baseProps = {
  selectedCount: 2,
  previewState: "idle" as const,
  previewError: "",
  examEmptyState: null,
  missingSettings: [],
  onOpenExamSettings: vi.fn(),
};

describe("ExamIdlePanel", () => {
  it("renders ready hint without profile/start controls", () => {
    const { container, cleanup } = render(createElement(ExamIdlePanel, baseProps));

    expect(container.querySelector(".exam-step-panel")).not.toBeNull();
    expect(container.textContent).toContain("Ready");
    expect(container.textContent).toContain('Use "Exam starten" in the toolbar');
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).not.toContain("Schritt");

    cleanup();
  });

  it("shows missing settings list and calls settings CTA", () => {
    const onOpenExamSettings = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamIdlePanel, {
        ...baseProps,
        missingSettings: [
          {
            id: "exam.run.profile.missing",
            label: "Profil fehlt",
            severity: "blocker" as const,
          },
        ],
        onOpenExamSettings,
      }),
    );

    expect(container.textContent).toContain("Exam kann nicht gestartet werden");

    const button = Array.from(container.querySelectorAll("button")).find((entry) =>
      entry.textContent?.includes("Exam Settings oeffnen"),
    );
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenExamSettings).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("shows file selection empty-state text", () => {
    const { container, cleanup } = render(
      createElement(ExamIdlePanel, {
        ...baseProps,
        selectedCount: 0,
      }),
    );

    expect(container.querySelector(".exam-step-panel")).not.toBeNull();
    expect(container.textContent).toContain("Waehle mindestens eine Exam-Datei");

    cleanup();
  });
});
