// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { FastStatsPanel } from "./FastStatsPanel";

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

const buildProps = () => ({
  isTimeModeEnabled: false,
  timeModeActive: false,
  timeStatusLabel: "Idle",
  timeProgressStyle: {},
  selectedDuration: 24,
  statsChartClass: "stats-chart",
  statsChartStyle: {},
  statsCorrect: 0,
  statsIncorrect: 0,
  statsTotal: 0,
  sessionStats: {
    correct: 0,
    incorrect: 0,
    timeout: 0,
  },
  sessionHistory: [],
  topSessions: [],
  lastSessions: [],
  sessionCompleted: 0,
  sessionMissed: 0,
  sessionAccuracy: 0,
  sessionPace: "0.0",
  sessionScore: 0,
  sessionMultiplier: 1,
  handleTimeToggle: vi.fn(),
});

describe("FastStatsPanel", () => {
  it("renders header actions in the panel header", () => {
    const props = buildProps();
    const { container, cleanup } = render(
      createElement(FastStatsPanel, {
        ...props,
        headerActions: createElement(
          "button",
          {
            type: "button",
            className: "probe-fast-action",
          },
          "Action",
        ),
      }),
    );

    const headerActions = container.querySelector(".fast-panel-header-actions");
    expect(headerActions).toBeTruthy();
    expect(headerActions?.querySelector(".probe-fast-action")).toBeTruthy();

    cleanup();
  });
});
