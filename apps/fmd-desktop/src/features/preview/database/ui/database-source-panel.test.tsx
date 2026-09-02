// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseSourcePanel } from "./database-source-panel";

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

const findHistoryMultiSourceCheckbox = (container: HTMLElement) => {
  const historyRow = Array.from(
    container.querySelectorAll<HTMLLabelElement>(".database-block-source-item"),
  ).find((label) => label.textContent?.includes("History (Exam-Runs)"));
  return historyRow?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
};

describe("DatabaseSourcePanel", () => {
  it("shows the multi-source History entry only for multi-folder sources", () => {
    const explicit = render(
      createElement(DatabaseSourcePanel, {
        source: { type: "explicit-folder", path: "alpha" },
        availableFolders: ["alpha"],
        historyFolderPath: "/vault/.profile/exam-runs",
        onChange: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    expect(explicit.container.textContent).not.toContain("History (Exam-Runs)");
    explicit.cleanup();

    const multi = render(
      createElement(DatabaseSourcePanel, {
        source: { type: "multi-folder", paths: ["alpha"] },
        availableFolders: ["alpha"],
        historyFolderPath: "/vault/.profile/exam-runs",
        onChange: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    expect(multi.container.textContent).toContain("History (Exam-Runs)");
    multi.cleanup();
  });

  it("emits includeHistory=true when multi-source History entry is checked", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseSourcePanel, {
        source: { type: "multi-folder", paths: ["alpha"] },
        availableFolders: ["alpha"],
        historyFolderPath: "/vault/.profile/exam-runs",
        onChange,
        onClose: vi.fn(),
      }),
    );

    const checkbox = findHistoryMultiSourceCheckbox(container);
    act(() => {
      checkbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith({
      type: "multi-folder",
      paths: ["alpha"],
      includeHistory: true,
    });
    cleanup();
  });

  it("emits source without includeHistory when multi-source History entry is unchecked", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseSourcePanel, {
        source: { type: "multi-folder", paths: ["alpha"], includeHistory: true },
        availableFolders: ["alpha"],
        historyFolderPath: "/vault/.profile/exam-runs",
        onChange,
        onClose: vi.fn(),
      }),
    );

    const checkbox = findHistoryMultiSourceCheckbox(container);
    act(() => {
      checkbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith({
      type: "multi-folder",
      paths: ["alpha"],
    });
    cleanup();
  });
});
