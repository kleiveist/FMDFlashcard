// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamFilePanel.test.tsx
 *
 * Zweck:
 * - UI-Smoke-Tests fuer Multi-Select im ExamFilePanel.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ExamFilePanel } from "./ExamFilePanel";

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

const files = [
  { path: "/vault/exam-a.md", relative_path: "Exam A.md" },
  { path: "/vault/exam-b.md", relative_path: "Exam B.md" },
  { path: "/vault/exam-c.md", relative_path: "Exam C.md" },
];

describe("ExamFilePanel", () => {
  it("renders selected count and visual selected state", () => {
    const onToggleFile = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/exam-a.md", "/vault/exam-c.md"],
        vaultPath: "/vault",
        onToggleFile,
      }),
    );

    expect(container.textContent).toContain("2 ausgewaehlt");
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.exam-file-item"),
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
    expect(buttons[2]?.getAttribute("aria-pressed")).toBe("true");

    cleanup();
  });

  it("emits toggle callback on click for selected and unselected files", () => {
    const onToggleFile = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/exam-a.md"],
        vaultPath: "/vault",
        onToggleFile,
      }),
    );

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.exam-file-item"),
    );
    const first = buttons[0];
    const second = buttons[1];
    act(() => {
      first?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      second?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggleFile).toHaveBeenCalledTimes(2);
    expect(onToggleFile).toHaveBeenNthCalledWith(1, files[0]);
    expect(onToggleFile).toHaveBeenNthCalledWith(2, files[1]);

    cleanup();
  });
});
