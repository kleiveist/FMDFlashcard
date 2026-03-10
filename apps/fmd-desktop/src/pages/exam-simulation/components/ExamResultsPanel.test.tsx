// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamResultsPanel.test.tsx
 *
 * Zweck:
 * - UI-Smoke-Tests fuer das Exam Results Popup inkl. Card-Wrap Toggle.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ExamSessionTask } from "../../../lib/examMixedSession";
import { ExamResultsPanel } from "./ExamResultsPanel";

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
      document.body.querySelectorAll(".modal-backdrop").forEach((node) => node.remove());
    },
  };
};

const buildSessionTask = (overrides: Partial<ExamSessionTask> = {}): ExamSessionTask => ({
  id: "exam-task-1",
  index: 0,
  rawLines: ["1) Define key", "Answer: Foreign key"],
  prompt: "1) Define key",
  officialAnswer: "Foreign key",
  gradingMode: "manual",
  sourceRange: { startLine: 0, endLine: 1 },
  cardWrapper: false,
  cardLines: ["1) Define key", "Answer: Foreign key"],
  warnings: [],
  card: {
    kind: "composite",
    parts: [
      {
        kind: "free-text",
        front: "Define key",
        back: "Foreign key",
      },
    ],
    primaryType: "qa",
    detectedTypes: ["qa"],
    isMixed: false,
  },
  sessionTaskId: "session-task-1",
  sourceExamPath: "/vault/exam.md",
  sourceTitle: "exam.md",
  originalTaskNumber: 1,
  sourceTaskIndex: 0,
  sessionIndex: 1,
  ...overrides,
});

const buildResultsProps = (taskOverrides: Partial<ExamSessionTask> = {}) => {
  const task = buildSessionTask(taskOverrides);
  return {
    results: {
      breakdown: [
        {
          index: 1,
          sessionTaskId: task.sessionTaskId,
          sourceTitle: task.sourceTitle,
          originalTaskNumber: task.originalTaskNumber,
          awardedPoints: 3,
          maxPoints: 5,
          isCorrect: null,
          detail: {
            task,
            partStates: [{}],
            awardedPoints: 3,
          },
        },
      ],
      totalAwarded: 3,
      totalMax: 5,
      percentage: 60,
    },
    helpEnabled: false,
    onToggleTaskCardWrapper: vi.fn(),
    taskCardWrapPendingById: {},
    taskCardWrapErrorById: {},
    taskCardWrapNoticeById: {},
    getTaskCardWrapDisabledReason: () => "",
  };
};

describe("ExamResultsPanel", () => {
  it("renders the correction action without corrected summary values", () => {
    const onCorrection = vi.fn();
    const props = {
      ...buildResultsProps(),
      correctionAction: {
        label: "Correction",
        onClick: onCorrection,
      },
    };
    const { container, cleanup } = render(createElement(ExamResultsPanel, props));

    expect(container.textContent).toContain("Score");
    expect(container.textContent).toContain("3 / 5");
    expect(container.textContent).not.toContain("Corrected");

    const correctionButton = container.querySelector<HTMLButtonElement>(
      "button.ghost.small",
    );
    expect(correctionButton?.textContent).toContain("Correction");

    act(() => {
      correctionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCorrection).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("disables the correction action when requested", () => {
    const props = {
      ...buildResultsProps(),
      correctionAction: {
        label: "Correction",
        onClick: vi.fn(),
        disabled: true,
        title: "No incorrect cards",
      },
    };
    const { container, cleanup } = render(createElement(ExamResultsPanel, props));

    const correctionButton = container.querySelector<HTMLButtonElement>(
      "button.ghost.small",
    );
    expect(correctionButton?.disabled).toBe(true);
    expect(correctionButton?.title).toBe("No incorrect cards");

    cleanup();
  });

  it("opens task details in popup and renders card-wrap toggle in modal header", () => {
    const props = buildResultsProps();
    const { container, cleanup } = render(createElement(ExamResultsPanel, props));

    const taskButton = container.querySelector<HTMLButtonElement>(
      "button.exam-results-task-trigger",
    );
    expect(taskButton).not.toBeNull();

    act(() => {
      taskButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("Task 1 Result");
    expect(document.body.textContent).toContain("Task 1 of 1");

    const toggle = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Wrap task in #card block"]',
    );
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(false);

    act(() => {
      if (toggle) {
        toggle.checked = true;
      }
      toggle?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(props.onToggleTaskCardWrapper).toHaveBeenCalledWith("session-task-1", true);

    const closeButton = document.body.querySelector<HTMLButtonElement>(
      "button.modal-panel-close",
    );
    act(() => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.textContent ?? "").not.toContain("Task 1 Result");

    cleanup();
  });

  it("shows disabled reason and disables popup toggle when source is unavailable", () => {
    const props = {
      ...buildResultsProps(),
      getTaskCardWrapDisabledReason: () => "Task source file is not uniquely available in this exam session.",
    };
    const { container, cleanup } = render(createElement(ExamResultsPanel, props));

    const taskButton = container.querySelector<HTMLButtonElement>(
      "button.exam-results-task-trigger",
    );
    act(() => {
      taskButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const toggle = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Wrap task in #card block"]',
    );
    expect(toggle?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Task source file is not uniquely available in this exam session.",
    );

    cleanup();
  });

  it("renders task media between the question heading and body in the results modal", () => {
    const props = {
      ...buildResultsProps({
        prompt: "Pick one",
        card: {
          kind: "composite",
          parts: [
            {
              kind: "multiple-choice",
              question: "Pick one",
              options: [
                { key: "a", text: "Alpha" },
                { key: "b", text: "Beta" },
              ],
              correctKeys: ["a"],
              media: [
                {
                  id: "media-1",
                  type: "svg",
                  src: "inline",
                  inlineSvg:
                    "<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>",
                  rawBlock:
                    "```svg\n<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>\n```",
                },
              ],
            },
          ],
          primaryType: "multiple-choice",
          detectedTypes: ["multiple-choice"],
          isMixed: false,
        },
      }),
      vaultPath: "/vault",
    };
    const { container, cleanup } = render(createElement(ExamResultsPanel, props));

    const taskButton = container.querySelector<HTMLButtonElement>(
      "button.exam-results-task-trigger",
    );
    act(() => {
      taskButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const card = document.body.querySelector(".flashcard-item");
    const heading = card?.querySelector(".flashcard-question");
    const mediaGroup = heading?.nextElementSibling;
    expect(mediaGroup?.classList.contains("flashcard-media-group")).toBe(true);
    expect(mediaGroup?.querySelector(".svg-preview-surface svg")).toBeTruthy();

    cleanup();
  });
});
