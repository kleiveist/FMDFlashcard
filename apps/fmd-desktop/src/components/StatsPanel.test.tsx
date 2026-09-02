// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { StatsPanel } from "./StatsPanel";

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

describe("StatsPanel", () => {
  it("renders header actions aligned in the statistics header", () => {
    const { container, cleanup } = render(
      createElement(StatsPanel, {
        correctCount: 1,
        correctPercent: 50,
        incorrectCount: 1,
        totalQuestions: 2,
        headerActions: createElement(
          "button",
          {
            type: "button",
            className: "probe-stats-action",
          },
          "Action",
        ),
      }),
    );

    const header = container.querySelector(".stats-panel-header");
    const heading = header?.querySelector("h2");
    const action = header?.querySelector(".stats-panel-header-actions .probe-stats-action");

    expect(heading?.textContent).toBe("Statistics");
    expect(action).toBeTruthy();

    cleanup();
  });
});
