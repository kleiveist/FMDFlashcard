// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamFilePanel.test.tsx
 *
 * Zweck:
 * - UI-Tests fuer ExamFilePanel (Filter, Auswahl, Reorder).
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamFilePanel } from "./ExamFilePanel";
import {
  __resetInternalDragSessionsForTest,
  DRAG_CHANNELS,
  startInternalDrag,
} from "../../../lib/dragDrop";

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

const setChipRect = (chip: HTMLButtonElement, left: number, width = 100) => {
  Object.defineProperty(chip, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: left,
        y: 0,
        left,
        top: 0,
        width,
        height: 40,
        right: left + width,
        bottom: 40,
        toJSON: () => ({}),
      }) as DOMRect,
  });
};

beforeEach(() => {
  __resetInternalDragSessionsForTest();
});

describe("ExamFilePanel", () => {
  it("renders selectable Standard (no profile) option", () => {
    const onProfileChange = vi.fn();
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md"],
        vaultPath: "/vault",
        selectedProfileId: null,
        profileOptions: runProfileOptions,
        onProfileChange,
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const profileSelect = container.querySelector<HTMLSelectElement>(
      ".exam-file-run-profile-field select",
    );
    expect(profileSelect).toBeTruthy();
    expect(profileSelect?.value).toBe("");
    const options = Array.from(profileSelect?.options ?? []).map(
      (option) => option.textContent,
    );
    expect(options).toContain("Standard (no profile)");

    cleanup();
  });

  it("renders compact header KPI chips", () => {
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md"],
        vaultPath: "/vault",
        compactSummary: {
          maxPoints: 42,
          taskCount: 12,
          minDurationMinutes: 18,
        },
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const panelHeader = container.querySelector(".panel-header");
    expect(panelHeader?.querySelectorAll(".exam-file-panel-kpi")).toHaveLength(4);
    expect(container.textContent).toContain("1 selected");
    expect(container.textContent).toContain("42 max points");
    expect(container.textContent).toContain("12 tasks");
    expect(container.textContent).toContain("18 min duration");

    cleanup();
  });

  it("renders combination mode buttons in header status and not in selection summary", () => {
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md"],
        vaultPath: "/vault",
        compactSummary: {
          maxPoints: 42,
          taskCount: 12,
          minDurationMinutes: 18,
        },
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

    const panelStatus = container.querySelector(".exam-file-panel-status");
    expect(panelStatus).not.toBeNull();
    expect(panelStatus?.textContent).toContain("Nested");
    expect(panelStatus?.textContent).toContain("Sequential + internal shuffle");
    expect(panelStatus?.textContent).toContain("Sequential");
    expect(panelStatus?.textContent).toContain("Fully mixed");

    const selectionSummary = container.querySelector(".exam-selected-summary");
    expect(selectionSummary).not.toBeNull();
    expect(selectionSummary?.textContent).not.toContain("Nested");
    expect(selectionSummary?.textContent).not.toContain("Sequential + internal shuffle");
    expect(selectionSummary?.textContent).not.toContain("Sequential");
    expect(selectionSummary?.textContent).not.toContain("Fully mixed");

    cleanup();
  });

  it("hides panel status when hidePanelStatus is enabled without changing default behavior", () => {
    const hidden = render(
      createElement(ExamFilePanel, {
        files,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md"],
        vaultPath: "/vault",
        hidePanelStatus: true,
        compactSummary: {
          maxPoints: 42,
          taskCount: 12,
          minDurationMinutes: 18,
        },
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

    expect(hidden.container.querySelector(".exam-file-panel-status")).toBeNull();
    expect(hidden.container.textContent).not.toContain("Nested");
    expect(hidden.container.textContent).not.toContain("42 max points");
    hidden.cleanup();

    const visible = render(
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

    expect(visible.container.querySelector(".exam-file-panel-status")).not.toBeNull();
    visible.cleanup();
  });

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
    expect(container.textContent).toContain("No file selected");
    expect(container.textContent).toContain("Pick files below to enable reorder.");

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

  it("opens file action popup from filename click and invokes open callback", () => {
    const onOpenFile = vi.fn();
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
        onOpenFile,
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const titleTrigger = container.querySelector<HTMLElement>(
      ".exam-file-row-title.is-open-action",
    );
    expect(titleTrigger).toBeTruthy();
    act(() => {
      titleTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    const popupButton = document.body.querySelector<HTMLButtonElement>(
      ".exam-file-open-menu .context-menu-item",
    );
    expect(popupButton?.textContent).toContain("Open file");
    act(() => {
      popupButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(onOpenFile.mock.calls[0]?.[0]?.path).toBe("/vault/a.md");
    expect(document.body.querySelector(".exam-file-open-menu")).toBeNull();
    cleanup();
  });

  it("closes file action popup on outside click and Escape", () => {
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
        onOpenFile: vi.fn(),
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const titleTrigger = container.querySelector<HTMLElement>(
      ".exam-file-row-title.is-open-action",
    );
    act(() => {
      titleTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(document.body.querySelector(".exam-file-open-menu")).not.toBeNull();

    const backdrop = document.body.querySelector<HTMLElement>(".context-menu-backdrop");
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    });
    expect(document.body.querySelector(".exam-file-open-menu")).toBeNull();

    act(() => {
      titleTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(document.body.querySelector(".exam-file-open-menu")).not.toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.querySelector(".exam-file-open-menu")).toBeNull();
    cleanup();
  });

  it("opens file directly via Ctrl/Cmd + right click", () => {
    const onOpenFile = vi.fn();
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
        onOpenFile,
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const rowButton = container.querySelector<HTMLButtonElement>("button.exam-file-row-button");
    expect(rowButton).toBeTruthy();
    act(() => {
      rowButton?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      );
    });
    act(() => {
      rowButton?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          metaKey: true,
        }),
      );
    });

    expect(onOpenFile).toHaveBeenCalledTimes(2);
    expect(onOpenFile.mock.calls[0]?.[0]?.path).toBe("/vault/a.md");
    expect(onOpenFile.mock.calls[0]?.[1]).toEqual({ openInNewTab: true });
    expect(onOpenFile.mock.calls[1]?.[0]?.path).toBe("/vault/a.md");
    expect(onOpenFile.mock.calls[1]?.[1]).toEqual({ openInNewTab: true });
    expect(document.body.querySelector(".exam-file-open-menu")).toBeNull();
    cleanup();
  });

  it("opens file directly via Ctrl/Cmd + left click on row without toggling selection", () => {
    const onOpenFile = vi.fn();
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
        onOpenFile,
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const rowButton = container.querySelector<HTMLButtonElement>("button.exam-file-row-button");
    expect(rowButton).toBeTruthy();
    act(() => {
      rowButton?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      );
    });
    act(() => {
      rowButton?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          metaKey: true,
        }),
      );
    });

    expect(onOpenFile).toHaveBeenCalledTimes(2);
    expect(onOpenFile.mock.calls[0]?.[0]?.path).toBe("/vault/a.md");
    expect(onOpenFile.mock.calls[0]?.[1]).toEqual({ openInNewTab: true });
    expect(onOpenFile.mock.calls[1]?.[0]?.path).toBe("/vault/a.md");
    expect(onOpenFile.mock.calls[1]?.[1]).toEqual({ openInNewTab: true });
    expect(onToggleFile).not.toHaveBeenCalled();
    expect(document.body.querySelector(".exam-file-open-menu")).toBeNull();
    cleanup();
  });

  it("opens file directly via Ctrl/Cmd + left click on title without opening popup", () => {
    const onOpenFile = vi.fn();
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
        onOpenFile,
        onSetSelectedPaths: vi.fn(),
        onClearSelection: vi.fn(),
        onMoveSelectedFile: vi.fn(),
      }),
    );

    const titleTrigger = container.querySelector<HTMLElement>(
      ".exam-file-row-title.is-open-action",
    );
    expect(titleTrigger).toBeTruthy();
    act(() => {
      titleTrigger?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      );
    });
    act(() => {
      titleTrigger?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          metaKey: true,
        }),
      );
    });

    expect(onOpenFile).toHaveBeenCalledTimes(2);
    expect(onOpenFile.mock.calls[0]?.[0]?.path).toBe("/vault/a.md");
    expect(onOpenFile.mock.calls[0]?.[1]).toEqual({ openInNewTab: true });
    expect(onOpenFile.mock.calls[1]?.[0]?.path).toBe("/vault/a.md");
    expect(onOpenFile.mock.calls[1]?.[1]).toEqual({ openInNewTab: true });
    expect(onToggleFile).not.toHaveBeenCalled();
    expect(document.body.querySelector(".exam-file-open-menu")).toBeNull();
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

  it("sorts numbered files in a group naturally", () => {
    const groupedFiles = [
      {
        path: "/vault/10.md",
        relative_path: "group/10.md",
        status: "valid" as const,
        taskCount: 1,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/2.md",
        relative_path: "group/2.md",
        status: "valid" as const,
        taskCount: 1,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/1.md",
        relative_path: "group/1.md",
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
    expect(firstRowButtons[0]?.textContent).toContain("1.md");
    expect(firstRowButtons[1]?.textContent).toContain("2.md");
    expect(firstRowButtons[2]?.textContent).toContain("10.md");

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

  it("removes active selected chip with Delete key", () => {
    const onToggleFile = vi.fn();
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
        onToggleFile,
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
      chips[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    });

    expect(onToggleFile).toHaveBeenCalledWith("/vault/a.md");
    expect(container.querySelector(".exam-selected-chip.is-move-source")).toBeNull();

    cleanup();
  });

  it("supports mouse drag and drop reorder with insertion indicator", () => {
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
    setChipRect(chips[0]!, 100, 100);

    act(() => {
      chips[2]?.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
    });
    expect(chips[2]?.className).toContain("is-move-source");
    expect(chips[2]?.className).toContain("is-dragging");

    act(() => {
      chips[0]?.dispatchEvent(
        new MouseEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: 110,
        }),
      );
    });
    expect(chips[0]?.className).toContain("drop-before");

    act(() => {
      chips[0]?.dispatchEvent(
        new MouseEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: 190,
        }),
      );
    });
    expect(chips[0]?.className).toContain("drop-after");

    act(() => {
      chips[0]?.dispatchEvent(
        new MouseEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX: 190,
        }),
      );
    });

    expect(onMoveSelectedFile).toHaveBeenCalledWith("/vault/e.md", "/vault/d.md");
    expect(container.querySelector(".exam-selected-chip.drop-before")).toBeNull();
    expect(container.querySelector(".exam-selected-chip.drop-after")).toBeNull();
    expect(container.querySelector(".exam-selected-chip.is-dragging")).toBeNull();
    cleanup();
  });

  it("supports fallback drag session reorder when browser drag payload is unavailable", () => {
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
    setChipRect(chips[0]!, 100, 100);

    const restrictedDataTransfer = {
      effectAllowed: "all",
      dropEffect: "none",
      files: [],
      items: [],
      types: [],
      setData: vi.fn(() => {
        throw new Error("blocked");
      }),
      getData: vi.fn(() => ""),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
    } as unknown as DataTransfer;

    startInternalDrag(
      { dataTransfer: restrictedDataTransfer },
      {
        channel: DRAG_CHANNELS.EXAM_SELECTED_FILE,
        payload: "/vault/e.md",
        plainTextFallback: "/vault/e.md",
        effectAllowed: "move",
      },
    );

    act(() => {
      chips[0]?.dispatchEvent(
        new MouseEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: 190,
        }),
      );
      chips[0]?.dispatchEvent(
        new MouseEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX: 190,
        }),
      );
    });

    expect(onMoveSelectedFile).toHaveBeenCalledWith("/vault/e.md", "/vault/d.md");
    cleanup();
  });

  it("keeps drop indicator while pointer remains inside chip", () => {
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
    setChipRect(chips[1]!, 200, 100);

    act(() => {
      chips[0]?.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
      chips[1]?.dispatchEvent(
        new MouseEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: 210,
        }),
      );
    });
    expect(chips[1]?.className).toContain("drop-before");

    const dragLeaveInside = new Event("dragleave", { bubbles: true, cancelable: true });
    Object.defineProperty(dragLeaveInside, "relatedTarget", {
      configurable: true,
      value: chips[1]?.querySelector(".exam-selected-chip-name") ?? null,
    });
    act(() => {
      chips[1]?.dispatchEvent(dragLeaveInside);
    });
    expect(chips[1]?.className).toContain("drop-before");

    const dragLeaveOutside = new Event("dragleave", { bubbles: true, cancelable: true });
    Object.defineProperty(dragLeaveOutside, "relatedTarget", {
      configurable: true,
      value: document.body,
    });
    act(() => {
      chips[1]?.dispatchEvent(dragLeaveOutside);
    });
    expect(chips[1]?.className).not.toContain("drop-before");

    cleanup();
  });

  it("triggers all combination mode options from header status", () => {
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

    const status = container.querySelector(".exam-file-panel-status");
    const findButton = (label: string) =>
      Array.from(status?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
        (button) => button.textContent?.trim() === label,
      );

    const nestedButton = findButton("Nested");
    const sequentialShuffledButton = findButton("Sequential + internal shuffle");
    const sequentialButton = findButton("Sequential");
    const fullyMixedButton = findButton("Fully mixed");

    act(() => {
      nestedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      sequentialShuffledButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      sequentialButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fullyMixedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCombinationModeChange).toHaveBeenNthCalledWith(1, "nested");
    expect(onCombinationModeChange).toHaveBeenNthCalledWith(2, "sequential-shuffled");
    expect(onCombinationModeChange).toHaveBeenNthCalledWith(3, "sequential");
    expect(onCombinationModeChange).toHaveBeenNthCalledWith(4, "fully-mixed");
    cleanup();
  });

  it("shows the english mode tooltip after hover delay and closes it on leave", () => {
    vi.useFakeTimers();
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
        onCombinationModeChange: vi.fn(),
        language: "en",
      }),
    );

    try {
      const status = container.querySelector(".exam-file-panel-status");
      const nestedButton = Array.from(
        status?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      ).find((button) => button.textContent?.trim() === "Nested");
      const anchor = nestedButton?.closest<HTMLElement>(".ui-tooltip-anchor");
      expect(anchor).toBeTruthy();

      act(() => {
        anchor?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      });
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(449);
      });
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(document.body.textContent).toContain(
        "Runs your selected rows as groups. Inside each group, tasks are matched by task number and one task per number is picked in order.",
      );

      act(() => {
        anchor?.dispatchEvent(
          new MouseEvent("mouseout", {
            bubbles: true,
            relatedTarget: document.body,
          }),
        );
      });
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("renders german mode tooltip copy when language=de", () => {
    vi.useFakeTimers();
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
        onCombinationModeChange: vi.fn(),
        language: "de",
      }),
    );

    try {
      const status = container.querySelector(".exam-file-panel-status");
      const fullyMixedButton = Array.from(
        status?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      ).find((button) => button.textContent?.trim() === "Fully mixed");
      const anchor = fullyMixedButton?.closest<HTMLElement>(".ui-tooltip-anchor");
      expect(anchor).toBeTruthy();

      act(() => {
        anchor?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        vi.advanceTimersByTime(450);
      });

      expect(document.body.textContent).toContain(
        "Legt alle Aufgaben aus allen ausgewählten Dateien in einen gemeinsamen Pool und mischt alles vollständig.",
      );
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("uses start-aligned mode tooltips on viewports below 1200px", () => {
    vi.useFakeTimers();
    const hadMatchMedia = "matchMedia" in window;
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query === "(max-width: 1199.98px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    });
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
        onCombinationModeChange: vi.fn(),
        language: "en",
      }),
    );

    try {
      const status = container.querySelector(".exam-file-panel-status");
      const nestedButton = Array.from(
        status?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      ).find((button) => button.textContent?.trim() === "Nested");
      const anchor = nestedButton?.closest<HTMLElement>(".ui-tooltip-anchor");
      expect(anchor).toBeTruthy();

      act(() => {
        anchor?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        vi.advanceTimersByTime(450);
      });

      const tooltip = document.body.querySelector<HTMLElement>('[role="tooltip"]');
      expect(tooltip).toBeTruthy();
      expect(tooltip?.className).toContain("ui-tooltip-align-start");
    } finally {
      cleanup();
      vi.useRealTimers();
      if (hadMatchMedia) {
        Object.defineProperty(window, "matchMedia", {
          configurable: true,
          writable: true,
          value: originalMatchMedia,
        });
      } else {
        Object.defineProperty(window, "matchMedia", {
          configurable: true,
          writable: true,
          value: undefined,
        });
      }
    }
  });

  it("renders selected order in compact rows without step labels", () => {
    const extendedFiles = [
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
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/c.md",
        relative_path: "folder/C.md",
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
        files: extendedFiles,
        listState: "idle",
        listError: "",
        selectedPaths: ["/vault/a.md", "/vault/d.md", "/vault/b.md", "/vault/c.md"],
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

    const compactRows = container.querySelectorAll(".exam-selected-order-row");
    expect(compactRows.length).toBe(1);
    expect(compactRows[0]?.querySelectorAll(".exam-selected-chip").length ?? 0).toBe(4);
    expect(container.textContent).not.toContain("Step 1");

    cleanup();
  });

  it("supports click placement via explicit row slot", () => {
    const onPlaceSelectedFile = vi.fn();
    const validRowsFiles = [
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
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/c.md",
        relative_path: "folder/C.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
    ];
    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files: validRowsFiles,
        listState: "idle",
        listError: "",
        selectedPathRows: [["/vault/a.md", "/vault/b.md"], ["/vault/c.md"]],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPathRows: vi.fn(),
        onClearSelection: vi.fn(),
        onPlaceSelectedFile,
      }),
    );

    const sourceChip = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".exam-selected-chip"),
    ).find((button) => button.getAttribute("title")?.endsWith("b.md"));
    const targetSlot = container.querySelector<HTMLButtonElement>(
      'button.exam-selected-slot[aria-label="Insert at start of row 2"]',
    );

    act(() => {
      sourceChip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      targetSlot?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPlaceSelectedFile).toHaveBeenCalledWith("/vault/b.md", {
      rowIndex: 1,
      slotIndex: 0,
    });

    cleanup();
  });

  it("does not render row-4 creation slot when three rows already exist", () => {
    const validRowsFiles = [
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
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
      {
        path: "/vault/c.md",
        relative_path: "folder/C.md",
        status: "valid" as const,
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
    ];

    const { container, cleanup } = render(
      createElement(ExamFilePanel, {
        files: validRowsFiles,
        listState: "idle",
        listError: "",
        selectedPathRows: [["/vault/a.md"], ["/vault/b.md"], ["/vault/c.md"]],
        vaultPath: "/vault",
        selectedProfileId: "profile-1",
        profileOptions: runProfileOptions,
        onProfileChange: vi.fn(),
        onToggleFile: vi.fn(),
        onSetSelectedPathRows: vi.fn(),
        onClearSelection: vi.fn(),
        onPlaceSelectedFile: vi.fn(),
      }),
    );

    expect(
      container.querySelector('button.exam-selected-slot[aria-label="Create row 4"]'),
    ).toBeNull();

    cleanup();
  });
});
