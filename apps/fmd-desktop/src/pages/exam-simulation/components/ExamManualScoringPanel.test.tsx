// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamManualScoringPanel.test.tsx
 *
 * Zweck:
 * - Tests fuer Header-Layout und Finish-Interaktion im Manual Scoring.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ExamManualScoringPanel } from "./ExamManualScoringPanel";

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

describe("ExamManualScoringPanel", () => {
  it("renders header actions with 'Go to Correction' and 'Reset' and triggers both handlers", () => {
    const onFinishScoring = vi.fn();
    const onReset = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamManualScoringPanel, {
        task: null,
        finishDisabled: false,
        canGoBack: false,
        canGoNext: false,
        onAwardedPointsChange: vi.fn(),
        onBack: vi.fn(),
        onNext: vi.fn(),
        onFinishScoring,
        onReset,
      }),
    );

    const headerMain = container.querySelector(".scoring-panel-header-main");
    expect(headerMain).not.toBeNull();
    const headerActions = container.querySelector(".scoring-panel-header-actions");
    expect(headerActions).not.toBeNull();

    const finishButton = headerActions?.querySelector<HTMLButtonElement>("button.primary.small");
    const resetButton = headerActions?.querySelector<HTMLButtonElement>("button.ghost.small");
    expect(finishButton?.textContent).toBe("Go to Correction");
    expect(finishButton?.classList.contains("primary")).toBe(true);
    expect(finishButton?.classList.contains("small")).toBe(true);
    expect(resetButton?.textContent).toBe("Reset");
    expect(resetButton?.classList.contains("ghost")).toBe(true);
    expect(resetButton?.classList.contains("small")).toBe(true);
    expect(container.textContent).not.toContain("SCORING");
    expect(container.querySelector(".exam-task-header-actions")).toBeNull();

    act(() => {
      finishButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onFinishScoring).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("disables only 'Go to Correction' when finishDisabled is true and keeps Reset active", () => {
    const onReset = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamManualScoringPanel, {
        task: null,
        finishDisabled: true,
        canGoBack: false,
        canGoNext: false,
        onAwardedPointsChange: vi.fn(),
        onBack: vi.fn(),
        onNext: vi.fn(),
        onFinishScoring: vi.fn(),
        onReset,
      }),
    );

    const finishButton = container.querySelector<HTMLButtonElement>(
      ".scoring-panel-header-main button.primary.small",
    );
    const resetButton = container.querySelector<HTMLButtonElement>(
      ".scoring-panel-header-main button.ghost.small",
    );
    expect(finishButton?.disabled).toBe(true);
    expect(resetButton?.disabled).toBe(false);

    act(() => {
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onReset).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("hides task source badge when showSourceBadge is false", () => {
    const task = {
      taskIndex: 0,
      manualIndex: 0,
      manualCount: 1,
      maxPoints: 5,
      partStates: [{}],
      awardedPoints: 0,
      task: {
        id: "task-1",
        index: 0,
        rawLines: ["Question"],
        prompt: "Question",
        gradingMode: "manual",
        sourceRange: { startLine: 0, endLine: 0 },
        cardWrapper: false,
        cardLines: ["Question"],
        warnings: [],
        sourceTitle: "exam.md",
        card: {
          kind: "composite",
          parts: [
            {
              kind: "free-text",
              front: "Question",
              back: "Answer",
            },
          ],
        },
      },
    } as never;

    const { container, cleanup } = render(
      createElement(ExamManualScoringPanel, {
        task,
        showSourceBadge: false,
        finishDisabled: false,
        canGoBack: false,
        canGoNext: false,
        onAwardedPointsChange: vi.fn(),
        onBack: vi.fn(),
        onNext: vi.fn(),
        onFinishScoring: vi.fn(),
        onReset: vi.fn(),
      }),
    );

    expect(container.textContent).not.toContain("Quelle: exam.md");
    cleanup();
  });

  it("renders task navigation in panel-wide nav container", () => {
    const task = {
      taskIndex: 0,
      manualIndex: 0,
      manualCount: 1,
      maxPoints: 5,
      partStates: [{}],
      awardedPoints: 0,
      task: {
        id: "task-1",
        index: 0,
        rawLines: ["Question"],
        prompt: "Question",
        gradingMode: "manual",
        sourceRange: { startLine: 0, endLine: 0 },
        cardWrapper: false,
        cardLines: ["Question"],
        warnings: [],
        sourceTitle: "exam.md",
        card: {
          kind: "composite",
          parts: [
            {
              kind: "free-text",
              front: "Question",
              back: "Answer",
            },
          ],
        },
      },
    } as never;

    const { container, cleanup } = render(
      createElement(ExamManualScoringPanel, {
        task,
        finishDisabled: false,
        canGoBack: false,
        canGoNext: true,
        onAwardedPointsChange: vi.fn(),
        onBack: vi.fn(),
        onNext: vi.fn(),
        onFinishScoring: vi.fn(),
        onReset: vi.fn(),
      }),
    );

    expect(container.querySelector(".exam-panel-nav")).toBeTruthy();
    expect(container.querySelector(".exam-task-footer-actions")).toBeNull();
    const navButtons = container.querySelectorAll(".exam-panel-nav button.ghost.small");
    expect(navButtons).toHaveLength(2);
    expect(navButtons[0]?.textContent).toBe("Previous");
    expect(navButtons[1]?.textContent).toBe("Next");
    cleanup();
  });
});
