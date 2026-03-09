// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamFilePanel.test.tsx
 *
 * Zweck:
 * - UI-Tests fuer ExamFilePanel (Filter, Auswahl, Reorder).
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
  {
    path: "/vault/a.md",
    relative_path: "folder/A.md",
    status: "valid" as const,
    taskCount: 5,
    hasExamBlock: true,
    error: null,
  },
  {
    path: "/vault/b.md",
    relative_path: "folder/B.md",
    status: "no-tasks" as const,
    taskCount: 0,
    hasExamBlock: false,
    error: null,
  },
  {
    path: "/vault/c.md",
    relative_path: "other/C.md",
    status: "error" as const,
    taskCount: 0,
    hasExamBlock: false,
    error: "Read failed",
  },
];

const runProfileOptions = [
  { id: "profile-1", name: "Exam" },
  { id: "profile-2", name: "Practice" },
];

describe("ExamFilePanel", () => {
  it("shows only valid files and selected summary", () => {
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md", "/vault/b.md"],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    expect(container.textContent).toContain("Exam files");
    expect(container.textContent).not.toContain("Step 1: Select exam files");
    expect(container.textContent).not.toContain("SELECTION:");
    expect(container.textContent).not.toContain("no exam tasks detected");
    expect(container.textContent).not.toContain("error");
    expect(container.textContent).not.toContain("Only valid");

    cleanup();
  });

  it("keeps run-profile and selection block visible without active rows", () => {
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: [],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
        combinationMode: "fully-mixed",
        onCombinationModeChange: vi.fn(),
      }),
    );

    expect(container.querySelector("label.exam-file-run-profile-field")).not.toBeNull();
    expect(container.textContent).toContain("Selection");
    expect(container.textContent).toContain(
      "No exam files selected. Pick files below to enable reorder.",
    );

    cleanup();
  });

  it("emits toggle callback on row click", () => {
    const onToggleFile = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: [],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile,
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.exam-file-row-button"),
    );
    act(() => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggleFile).toHaveBeenCalledWith("/vault/a.md");
    cleanup();
  });

  it("does not render the select-all button", () => {
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md"],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    expect(container.textContent).not.toContain("Alle sichtbaren auswaehlen");
    cleanup();
  });

  it("renders a virtualized subset for long lists", () => {
    const manyFiles = Array.from({ length: 40 }, (_, index) => ({
      path: `/vault/f-${index}.md`,
      relative_path: `folder/f-${index}.md`,
      status: "valid" as const,
      taskCount: 1,
      hasExamBlock: true,
      error: null,
    }));
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files: manyFiles,
        listState: "idle",
        listError: "",
        selectedPaths: [],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const renderedRows = container.querySelectorAll(".exam-file-row").length;
    expect(renderedRows).toBeGreaterThan(0);
    expect(renderedRows).toBeLessThan(manyFiles.length);

    cleanup();
  });

  it("renders file rows in three columns while keeping sorted order in a group", () => {
    const groupedFiles = [
      {
        path: "/vault/c.md",
        relative_path: "group/C.md",
        status: "valid" as const,
        taskCount: 1,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/a.md",
        relative_path: "group/A.md",
        status: "valid" as const,
        taskCount: 1,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/b.md",
        relative_path: "group/B.md",
        status: "valid" as const,
        taskCount: 1,
        hasExamBlock: true,
        error: null,
      },
    ];
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files: groupedFiles,
        listState: "idle",
        listError: "",
        selectedPaths: [],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const firstFileRow = container.querySelector(".exam-file-row");
    const firstRowButtons = firstFileRow?.querySelectorAll(".exam-file-row-button") ?? [];
    expect(firstRowButtons).toHaveLength(3);
    expect(firstRowButtons[0]?.textContent).toContain("A.md");
    expect(firstRowButtons[1]?.textContent).toContain("B.md");
    expect(firstRowButtons[2]?.textContent).toContain("C.md");

    cleanup();
  });

  it("reorders selected files with two taps", () => {
    const onMoveSelectedFile = vi.fn();
    const reorderFiles = [
      {
        path: "/vault/a.md",
        relative_path: "folder/A.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/d.md",
        relative_path: "folder/D.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/e.md",
        relative_path: "folder/E.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
    ];
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files: reorderFiles,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md", "/vault/d.md", "/vault/e.md"],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile,
      }),
    );

    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.exam-selected-chip"),
    );
    act(() => {
      chips[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      chips[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onMoveSelectedFile).toHaveBeenCalledWith("/vault/a.md", "/vault/e.md");
    cleanup();
  });

  it("cancels active reorder selection on outside click", () => {
    const reorderFiles = [
      {
        path: "/vault/a.md",
        relative_path: "folder/A.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/d.md",
        relative_path: "folder/D.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
    ];
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files: reorderFiles,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md", "/vault/d.md"],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.exam-selected-chip"),
    );
    act(() => {
      chips[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".exam-selected-chip.is-move-source")).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(container.querySelector(".exam-selected-chip.is-move-source")).toBeNull();
    cleanup();
  });

  it("supports keyboard pickup and drop for reorder", () => {
    const onMoveSelectedFile = vi.fn();
    const reorderFiles = [
      {
        path: "/vault/a.md",
        relative_path: "folder/A.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/d.md",
        relative_path: "folder/D.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
    ];
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files: reorderFiles,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md", "/vault/d.md"],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile,
      }),
    );

    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.exam-selected-chip"),
    );
    act(() => {
      chips[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      chips[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onMoveSelectedFile).toHaveBeenCalledWith("/vault/a.md", "/vault/d.md");
    cleanup();
  });

  it("renders and triggers nested combination mode option", () => {
    const onCombinationModeChange = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md"],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
        combinationMode: "fully-mixed",
        onCombinationModeChange,
      }),
    );

    const nestedButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Nested"),
    );
    act(() => {
      nestedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCombinationModeChange).toHaveBeenCalledWith("nested");
    cleanup();
  });
});
