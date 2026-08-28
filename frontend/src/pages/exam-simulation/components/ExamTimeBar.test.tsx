/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamTimeBar.test.tsx
 *
 * Zweck:
 * - Tests fuer ExamTimeBar.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExamTimeBar } from "./ExamTimeBar";

describe("ExamTimeBar", () => {
  it("renders time limit when idle", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamTimeBar, {
        timeLimitMs: 30 * 60 * 1000,
        timeRemainingMs: null,
        isRunning: false,
        isTimeUp: false,
        isEnabled: true,
      }),
    );
    expect(markup).toContain("Time limit: 30 min");
  });

  it("renders remaining time when running", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamTimeBar, {
        timeLimitMs: 30 * 60 * 1000,
        timeRemainingMs: 90 * 1000,
        isRunning: true,
        isTimeUp: false,
        isEnabled: true,
      }),
    );
    expect(markup).toContain("Remaining: 1:30");
    expect(markup).toContain("Total: 30 min");
  });

  it("renders time up state", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamTimeBar, {
        timeLimitMs: 30 * 60 * 1000,
        timeRemainingMs: 0,
        isRunning: false,
        isTimeUp: true,
        isEnabled: true,
      }),
    );
    expect(markup).toContain("Time up");
  });

  it("renders disabled label", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamTimeBar, {
        timeLimitMs: 0,
        timeRemainingMs: null,
        isRunning: false,
        isTimeUp: false,
        isEnabled: false,
      }),
    );
    expect(markup).toContain("Timer disabled");
  });
});
