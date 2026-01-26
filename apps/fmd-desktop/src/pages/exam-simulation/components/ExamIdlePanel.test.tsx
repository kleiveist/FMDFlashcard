// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamIdlePanel.test.tsx
 *
 * Zweck:
 * - Tests fuer ExamIdlePanel Missing-Settings UI.
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

describe("ExamIdlePanel", () => {
  it("shows missing settings list and calls CTA handler", () => {
    const onOpenExamSettings = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamIdlePanel, {
        selectedFile: { path: "/exam.md", relative_path: "exam.md" },
        previewState: "idle",
        previewError: "",
        examEmptyState: null,
        availableTaskCount: 2,
        plannedTaskCount: 2,
        plannedMaxPoints: 10,
        hasTaskCountMismatch: false,
        onStartExam: () => {},
        startDisabled: true,
        missingSettings: [
          {
            id: "exam.points.sum",
            label: "Task-Punkte passen nicht zur Maximalpunktzahl",
            severity: "blocker",
          },
        ],
        onOpenExamSettings,
      }),
    );

    expect(container.textContent).toContain("Fehlende Einstellungen");
    expect(container.textContent).toContain("Exam Settings oeffnen");

    const button = container.querySelector("button.primary");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenExamSettings).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
