// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SrStatsAndChart } from "./SrStatsAndChart";

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
  statsView: "boxes" as const,
  setSpacedRepetitionStatsView: vi.fn(),
  spacedRepetitionBoxCounts: [0, 0, 0, 0, 0, 0, 0, 0],
  maxBoxCount: 0,
  activeBoxFilter: null,
  toggleBoxFilter: vi.fn(),
  vaultName: "Test Vault",
  vaultFilesCount: 0,
  spacedRepetitionFlashcardsLength: 0,
  spacedRepetitionCompletedChartData: [0, 0, 0, 0, 0, 0, 0],
  spacedRepetitionCompletedChartLabels: ["M", "T", "W", "T", "F", "S", "S"],
  statsChartClass: "stats-chart",
  statsChartStyle: {},
  spacedRepetitionCorrectCount: 0,
  spacedRepetitionIncorrectCount: 0,
  spacedRepetitionTotalQuestions: 0,
  kpiItems: [],
});

describe("SrStatsAndChart", () => {
  it("renders header actions in the panel header", () => {
    const props = buildProps();
    const { container, cleanup } = render(
      createElement(SrStatsAndChart, {
        ...props,
        headerActions: createElement(
          "button",
          {
            type: "button",
            className: "probe-sr-action",
          },
          "Action",
        ),
      }),
    );

    const headerActions = container.querySelector(".sr-panel-header-actions");
    expect(headerActions).toBeTruthy();
    expect(headerActions?.querySelector(".probe-sr-action")).toBeTruthy();

    cleanup();
  });
});
