// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamSimulationPage } from "./ExamSimulationPage";
import { useExamSimulationViewModel } from "./hooks/useExamSimulationViewModel";

const capturedExamFilePanelProps: Array<Record<string, unknown>> = [];
const capturedNoteModalProps: Array<Record<string, unknown>> = [];
const capturedExamResultsPanelProps: Array<Record<string, unknown>> = [];

vi.mock("./hooks/useExamSimulationViewModel", () => ({
  useExamSimulationViewModel: vi.fn(),
}));

vi.mock("./components/ExamCorrectionHost", () => ({
  ExamCorrectionHost: () => null,
}));

vi.mock("./components/ExamFilePanel", () => ({
  ExamFilePanel: (props: Record<string, unknown>) => {
    capturedExamFilePanelProps.push(props);
    return null;
  },
}));

vi.mock("../../components/NoteModal", () => ({
  NoteModal: (props: Record<string, unknown>) => {
    capturedNoteModalProps.push(props);
    if (!props.isOpen) {
      return null;
    }
    return createElement(
      "div",
      { "data-testid": "note-modal-mock" },
      createElement("h2", { "data-testid": "note-modal-title" }, props.title as never),
      createElement(
        "div",
        { "data-testid": "note-modal-header-actions" },
        props.headerActions as never,
      ),
      props.children as never,
    );
  },
}));

vi.mock("./components/ExamIdlePanel", () => ({
  ExamIdlePanel: () => null,
}));

vi.mock("./components/ExamManualScoringPanel", () => ({
  ExamManualScoringPanel: () => null,
}));

vi.mock("./components/ExamResultsPanel", () => ({
  ExamResultsPanel: (props: Record<string, unknown>) => {
    capturedExamResultsPanelProps.push(props);
    return null;
  },
}));

vi.mock("./components/ExamStatisticsPanel", () => ({
  ExamStatisticsPanel: () => null,
}));

vi.mock("./components/ExamTaskRunner", () => ({
  ExamTaskRunner: () => null,
}));

vi.mock("./components/ExamTimeBar", () => ({
  ExamTimeBar: () => null,
}));

vi.mock("../../components/UserToolsPanel", () => ({
  resolveExamPhaseButton: () => ({
    label: "Start",
    disabled: false,
    onClick: vi.fn(),
  }),
}));

vi.mock("../../lib/layoutMode", () => ({
  useLayoutMode: () => "stack",
}));

vi.mock("../../features/settings/settingsDeepLink", () => ({
  requestSettingsFocus: vi.fn(),
}));

vi.mock("../../lib/shortcuts/bindings", () => ({
  formatBinding: () => "",
  getEffectiveBinding: () => null,
  getShortcutPlatform: () => "linux",
  isEditableTarget: () => false,
  matchesBinding: () => false,
}));

vi.mock("../../lib/shortcuts/registry", () => ({
  getShortcutById: () => null,
}));

const mockUseExamSimulationViewModel = vi.mocked(useExamSimulationViewModel);

const render = (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    rerender: (next: ReactElement) => {
      act(() => {
        root.render(next);
      });
    },
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const createViewModel = () => {
  const noop = vi.fn();
  return {
    settings: {
      keyboardShortcuts: { bindings: {} },
      examHelpEnabled: true,
      examShowTimeline: true,
      examShowTaskSources: true,
      examTimeLimitEnabled: true,
      examAiEvaluation: { enabled: false, provider: null },
      examGradeScale: "standard-1-6",
      setExamTimeLimitEnabled: noop,
      setExamShowTimeline: noop,
      setExamHelpEnabled: noop,
      setExamShowTaskSources: noop,
    },
    vault: {
      vaultPath: "/vault",
      pngAssets: [],
    },
    examFiles: [
      {
        path: "/vault/a.md",
        relative_path: "a.md",
        status: "valid",
        taskCount: 5,
        hasExamBlock: true,
        error: null,
      },
    ],
    examFilesState: "idle",
    examFilesError: "",
    examRuns: [],
    examRunDeleteError: "",
    selectedExamPathRows: [["/vault/a.md", "/vault/b.md", "/vault/c.md"]],
    selectedExamPaths: ["/vault/a.md", "/vault/b.md", "/vault/c.md"],
    selectedExamCount: 3,
    selectedIncludedExamCount: 3,
    selectedExamParseState: "idle",
    selectedExamParseError: "",
    combinationMode: "fully-mixed",
    runProfileOptions: [{ id: "profile-1", name: "Profile 1" }],
    selectedRunProfileId: "profile-1",
    previewDurationMinutes: 24,
    plannedTaskCount: 15,
    plannedMaxPoints: 72,
    stage: "idle",
    examRunning: false,
    activeTaskIndex: 0,
    activeTask: null,
    activeTaskMaxPoints: 0,
    activeTaskPartStates: [],
    activeTaskAwardedPoints: null,
    activeTaskAutoDecision: undefined,
    activeManualTaskEntry: null,
    canGoManualScoringBack: false,
    canGoManualScoringNext: false,
    incorrectTaskResults: [],
    correctionActiveEntry: null,
    correctionActiveTask: null,
    correctionActiveMaxPoints: 0,
    correctionActivePartStates: [],
    correctionActiveSubmitted: false,
    correctionCanGoBack: false,
    correctionCanGoNext: false,
    correctionQueueLength: 0,
    runTasks: [],
    examTimeLimitMs: 0,
    examTimeRemainingMs: null,
    examTimeUp: false,
    examTimerEnabled: false,
    examShowTimeline: false,
    canStartExam: true,
    missingExamSettings: [],
    examEmptyState: null,
    results: null,
    resultTaskCardWrapPendingById: {},
    resultTaskCardWrapErrorById: {},
    resultTaskCardWrapNoticeById: {},
    handleDeleteExamRun: noop,
    handleToggleExamSelection: noop,
    handleSelectVisibleExamFiles: noop,
    handleSetSelectedExamRows: noop,
    handleClearExamSelection: noop,
    handlePlaceSelectedExamFile: noop,
    handleMoveSelectedExamFile: noop,
    handleCombinationModeChange: noop,
    handleRunProfileChange: noop,
    handleStartExam: noop,
    handleResetExam: noop,
    handleSubmitExam: noop,
    handleStartScoring: noop,
    handleFinishManualScoring: noop,
    handleStartCorrection: noop,
    handleBackToFinishScoring: noop,
    handleFinalizeExam: noop,
    handleOptionSelect: noop,
    handleTrueFalseSelect: noop,
    handleClozeInputChange: noop,
    handleClozeTokenDrop: noop,
    handleClozeTokenRemove: noop,
    handleTextInputChange: noop,
    handleClozeBlankDragOver: noop,
    handleClozeTokenDragStart: noop,
    handleAwardedPointsChange: noop,
    handleAutoGradeDecision: noop,
    handleTaskBack: noop,
    handleTaskNext: noop,
    handleManualScoringBack: noop,
    handleManualScoringNext: noop,
    handleCorrectionOptionSelect: noop,
    handleCorrectionTrueFalseSelect: noop,
    handleCorrectionClozeInputChange: noop,
    handleCorrectionClozeTokenDrop: noop,
    handleCorrectionClozeTokenRemove: noop,
    handleCorrectionTextInputChange: noop,
    handleCorrectionSubmit: noop,
    handleCorrectionTaskBack: noop,
    handleCorrectionTaskNext: noop,
    handleResultTaskCardWrapperToggle: noop,
    getTaskCardWrapDisabledReason: vi.fn().mockReturnValue(""),
  };
};

describe("ExamSimulationPage popup sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedExamFilePanelProps.length = 0;
    capturedNoteModalProps.length = 0;
    capturedExamResultsPanelProps.length = 0;
  });

  it("passes shared mode/profile handlers to sidebar and popup, renders panel header KPIs, and splits run summary tasks", () => {
    const viewModel = createViewModel();
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);
    const openMarkdownSpy = vi.fn();

    const { container, cleanup } = render(
      createElement(ExamSimulationPage, {
        runSummaryNoteActionEnabled: true,
        onRunSummaryNoteAction: vi.fn(),
        isRunSummaryNoteActionActive: true,
        isExamFilesNoteOpen: true,
        onCloseExamFilesNote: vi.fn(),
        onOpenExamFileInMarkdownEditor: openMarkdownSpy,
      }),
    );

    const sidebarProps = [...capturedExamFilePanelProps]
      .reverse()
      .find((entry) => entry.className === "exam-files-panel");
    const popupProps = [...capturedExamFilePanelProps]
      .reverse()
      .find((entry) => typeof entry.className === "undefined");

    expect(sidebarProps).toBeTruthy();
    expect(popupProps).toBeTruthy();
    expect(sidebarProps?.className).toBe("exam-files-panel");
    expect(popupProps?.className).toBeUndefined();
    expect(sidebarProps?.selectedProfileId).toBe("profile-1");
    expect(popupProps?.selectedProfileId).toBe("profile-1");
    expect(sidebarProps?.combinationMode).toBe("fully-mixed");
    expect(popupProps?.combinationMode).toBe("fully-mixed");
    expect(sidebarProps?.hidePanelStatus).toBeUndefined();
    expect(popupProps?.hidePanelStatus).toBeUndefined();
    expect(sidebarProps?.compactSummary).toEqual({
      maxPoints: 72,
      taskCount: 15,
      minDurationMinutes: 24,
    });
    expect(popupProps?.compactSummary).toEqual({
      maxPoints: 72,
      taskCount: 15,
      minDurationMinutes: 24,
    });
    expect(sidebarProps?.onProfileChange).toBe(popupProps?.onProfileChange);
    expect(sidebarProps?.onCombinationModeChange).toBe(
      popupProps?.onCombinationModeChange,
    );
    expect(sidebarProps?.onOpenFile).toBe(popupProps?.onOpenFile);
    const openFileHandler = sidebarProps?.onOpenFile as
      | ((entry: { path: string; relative_path: string }) => void)
      | undefined;
    expect(openFileHandler).toBeTruthy();
    act(() => {
      openFileHandler?.({
        path: "/vault/from-exam.md",
        relative_path: "from-exam.md",
      });
    });
    expect(openMarkdownSpy).toHaveBeenCalledWith({
      path: "/vault/from-exam.md",
      relative_path: "from-exam.md",
    });
    const examNoteModalProps = capturedNoteModalProps.find(
      (entry) => entry.title === "Exam Files",
    );
    expect(examNoteModalProps?.panelClassName).toBe("note-modal-panel-exam");
    expect(examNoteModalProps?.bodyClassName).toBe("note-modal-body-exam");
    expect(examNoteModalProps?.headerActions).toBeUndefined();
    expect(container.textContent).toContain("3 selected");
    expect(container.textContent).toContain("15 tasks");
    expect(container.textContent).toContain("72 max points");
    expect(container.textContent).toContain("24 min duration");
    expect(container.textContent).toContain("Selection");
    expect(container.textContent).toContain("3 selected, 3 included");
    expect(container.textContent).not.toContain("3 selected, 3 included, 15 tasks total");
    expect(container.textContent).toContain("Tasks total");
    expect(container.textContent).toContain("15 tasks total");

    cleanup();
  });

  it("keeps run summary trigger interactive in idle stage", () => {
    const noteActionSpy = vi.fn();
    const viewModel = createViewModel();
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(
      createElement(ExamSimulationPage, {
        runSummaryNoteActionEnabled: true,
        onRunSummaryNoteAction: noteActionSpy,
      }),
    );

    const runSummary = container.querySelector<HTMLDivElement>(".exam-mix-info");
    expect(runSummary).toBeTruthy();
    expect(runSummary?.classList.contains("is-note-trigger")).toBe(true);
    expect(runSummary?.getAttribute("tabindex")).toBe("0");
    expect(runSummary?.getAttribute("aria-haspopup")).toBe("dialog");

    act(() => {
      runSummary?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      runSummary?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(noteActionSpy).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("disables run summary trigger outside idle stage and does not open exam files popup", () => {
    const noteActionSpy = vi.fn();
    const viewModel = {
      ...createViewModel(),
      stage: "running",
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(
      createElement(ExamSimulationPage, {
        runSummaryNoteActionEnabled: true,
        onRunSummaryNoteAction: noteActionSpy,
      }),
    );

    const runSummary = container.querySelector<HTMLDivElement>(".exam-mix-info");
    expect(runSummary).toBeTruthy();
    expect(runSummary?.classList.contains("is-note-trigger")).toBe(false);
    expect(runSummary?.getAttribute("tabindex")).toBeNull();
    expect(runSummary?.getAttribute("aria-haspopup")).toBeNull();
    expect(runSummary?.getAttribute("title")).toBeNull();

    act(() => {
      runSummary?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      runSummary?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(noteActionSpy).toHaveBeenCalledTimes(0);
    cleanup();
  });

  it("auto-closes exam files popup when stage is not idle", () => {
    const closeSpy = vi.fn();
    const viewModel = {
      ...createViewModel(),
      stage: "running",
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { cleanup } = render(
      createElement(ExamSimulationPage, {
        isExamFilesNoteOpen: true,
        onCloseExamFilesNote: closeSpy,
      }),
    );

    expect(closeSpy).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("does not render sidebar exam files outside idle stage", () => {
    const viewModel = {
      ...createViewModel(),
      stage: "running",
      examRunning: true,
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { cleanup } = render(createElement(ExamSimulationPage));

    expect(capturedExamFilePanelProps).toHaveLength(0);
    cleanup();
  });

  it("opens exam toggles popup from the toolbar settings button", () => {
    const viewModel = createViewModel();
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(createElement(ExamSimulationPage));

    const settingsButton = container.querySelector<HTMLButtonElement>(
      '.exam-panel-toolbar button[aria-label="Settings"]',
    );
    expect(settingsButton).toBeTruthy();

    act(() => {
      settingsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Exam Toggles");
    expect(container.textContent).toContain("TIME LIMIT");
    expect(container.textContent).toContain("TASK SOURCES");
    cleanup();
  });

  it("exits focus mode when stage switches to finished", () => {
    let viewModel = {
      ...createViewModel(),
      stage: "running",
      examRunning: true,
    };
    mockUseExamSimulationViewModel.mockImplementation(() => viewModel as never);

    const { container, rerender, cleanup } = render(createElement(ExamSimulationPage));

    const focusToggle = container.querySelector<HTMLButtonElement>(".focus-toggle");
    expect(focusToggle).toBeTruthy();

    act(() => {
      focusToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.classList.contains("focus-mode")).toBe(true);

    viewModel = {
      ...viewModel,
      stage: "finished",
      examRunning: true,
    };
    rerender(createElement(ExamSimulationPage));

    expect(document.body.classList.contains("focus-mode")).toBe(false);
    cleanup();
  });

  it("does not render reset button in idle exam toolbar", () => {
    const viewModel = {
      ...createViewModel(),
      stage: "idle",
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(createElement(ExamSimulationPage));

    const toolbarButtons = Array.from(container.querySelectorAll(".exam-panel-toolbar button")).map(
      (button) => button.textContent?.trim() ?? "",
    );
    expect(toolbarButtons).toContain("Start");
    expect(toolbarButtons).not.toContain("Reset");

    cleanup();
  });

  it("opens reset confirmation on reset click, confirms via 'Abort exam', and can be canceled", () => {
    const resetSpy = vi.fn();
    const viewModel = {
      ...createViewModel(),
      stage: "running",
      handleResetExam: resetSpy,
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(createElement(ExamSimulationPage));

    const resetButton = Array.from(container.querySelectorAll(".exam-panel-toolbar button")).find(
      (button) => button.textContent?.trim() === "Reset",
    );
    expect(resetButton).toBeTruthy();

    act(() => {
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetSpy).toHaveBeenCalledTimes(0);
    expect(container.textContent).toContain("Abort current exam?");
    expect(container.textContent).toContain(
      "Do you really want to abort this exam? Your current progress will be lost.",
    );

    const abortButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Abort exam",
    );
    expect(abortButton).toBeTruthy();

    act(() => {
      abortButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Abort current exam?");

    act(() => {
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Abort current exam?");

    const cancelButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Cancel",
    );
    expect(cancelButton).toBeTruthy();

    act(() => {
      cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Abort current exam?");

    cleanup();
  });

  it("renders two 'Back to Exam Menu' buttons in finished layout and both reset immediately without confirmation", () => {
    const resetSpy = vi.fn();
    const viewModel = {
      ...createViewModel(),
      stage: "finished",
      results: { runId: "run-1" } as never,
      handleResetExam: resetSpy,
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(createElement(ExamSimulationPage));

    const resetButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Back to Exam Menu",
    );
    expect(resetButtons).toHaveLength(2);
    expect(container.querySelector('[data-testid="note-modal-mock"]')).toBeNull();
    expect(
      capturedExamFilePanelProps.some((entry) => typeof entry.compactSummary !== "undefined"),
    ).toBe(false);

    act(() => {
      resetButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Abort current exam?");
    expect(container.textContent).not.toContain("Abort exam");

    act(() => {
      resetButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(resetSpy).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Abort current exam?");
    expect(container.textContent).not.toContain("Abort exam");

    cleanup();
  });

  it("renders Correction in finish-scoring toolbar, triggers correction, and does not pass correctionAction to results panel", () => {
    const startCorrectionSpy = vi.fn();
    const viewModel = {
      ...createViewModel(),
      stage: "finish_scoring",
      results: { runId: "run-1" } as never,
      incorrectTaskResults: [{ id: "incorrect-1" }] as never,
      handleStartCorrection: startCorrectionSpy,
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(createElement(ExamSimulationPage));

    const correctionButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Correction",
    );
    expect(correctionButton).toBeTruthy();
    expect(correctionButton?.classList.contains("primary")).toBe(true);
    expect(correctionButton?.classList.contains("small")).toBe(true);
    expect(correctionButton?.classList.contains("finish-scoring-correction-button")).toBe(true);
    expect(correctionButton?.disabled).toBe(false);

    const toolbarButtons = Array.from(container.querySelectorAll(".exam-panel-toolbar button")).map(
      (button) => button.textContent?.trim() ?? "",
    );
    expect(toolbarButtons).toEqual(["Start", "Reset", "Correction"]);

    act(() => {
      correctionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(startCorrectionSpy).toHaveBeenCalledTimes(1);

    const finishScoringResultsProps =
      capturedExamResultsPanelProps[capturedExamResultsPanelProps.length - 1];
    expect(finishScoringResultsProps).toBeTruthy();
    expect(finishScoringResultsProps?.correctionAction).toBeUndefined();

    cleanup();
  });

  it("disables Correction in finish-scoring toolbar when no incorrect cards exist", () => {
    const startCorrectionSpy = vi.fn();
    const viewModel = {
      ...createViewModel(),
      stage: "finish_scoring",
      results: { runId: "run-1" } as never,
      incorrectTaskResults: [],
      handleStartCorrection: startCorrectionSpy,
    };
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { container, cleanup } = render(createElement(ExamSimulationPage));

    const correctionButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Correction",
    );
    expect(correctionButton).toBeTruthy();
    expect(correctionButton?.classList.contains("finish-scoring-correction-button")).toBe(true);
    expect(correctionButton?.disabled).toBe(true);
    expect(correctionButton?.getAttribute("title")).toBe("No incorrect cards");

    const finishScoringResultsProps =
      capturedExamResultsPanelProps[capturedExamResultsPanelProps.length - 1];
    expect(finishScoringResultsProps?.correctionAction).toBeUndefined();
    expect(startCorrectionSpy).toHaveBeenCalledTimes(0);

    cleanup();
  });
});
