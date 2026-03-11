// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamSimulationPage } from "./ExamSimulationPage";
import { useExamSimulationViewModel } from "./hooks/useExamSimulationViewModel";

const capturedExamFilePanelProps: Array<Record<string, unknown>> = [];
const capturedNoteModalProps: Array<Record<string, unknown>> = [];

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
    return props.children ?? null;
  },
}));

vi.mock("./components/ExamIdlePanel", () => ({
  ExamIdlePanel: () => null,
}));

vi.mock("./components/ExamManualScoringPanel", () => ({
  ExamManualScoringPanel: () => null,
}));

vi.mock("./components/ExamResultsPanel", () => ({
  ExamResultsPanel: () => null,
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
      examGradeScale: "standard-1-6",
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
    handleClearExamSelection: noop,
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
  });

  it("passes shared mode/profile handlers to sidebar and popup and uses compact summary in popup", () => {
    const viewModel = createViewModel();
    mockUseExamSimulationViewModel.mockReturnValue(viewModel as never);

    const { cleanup } = render(
      createElement(ExamSimulationPage, {
        runSummaryNoteActionEnabled: true,
        onRunSummaryNoteAction: vi.fn(),
        isRunSummaryNoteActionActive: true,
        isExamFilesNoteOpen: true,
        onCloseExamFilesNote: vi.fn(),
      }),
    );

    const sidebarProps = [...capturedExamFilePanelProps]
      .reverse()
      .find((entry) => typeof entry.compactSummary === "undefined");
    const popupProps = [...capturedExamFilePanelProps]
      .reverse()
      .find((entry) => typeof entry.compactSummary !== "undefined");

    expect(sidebarProps).toBeTruthy();
    expect(popupProps).toBeTruthy();
    expect(sidebarProps?.className).toBe("exam-files-panel");
    expect(popupProps?.className).toBeUndefined();
    expect(sidebarProps?.selectedProfileId).toBe("profile-1");
    expect(popupProps?.selectedProfileId).toBe("profile-1");
    expect(sidebarProps?.combinationMode).toBe("fully-mixed");
    expect(popupProps?.combinationMode).toBe("fully-mixed");
    expect(popupProps?.compactSummary).toEqual({
      maxPoints: 72,
      minDurationMinutes: 24,
    });
    expect(sidebarProps?.onProfileChange).toBe(popupProps?.onProfileChange);
    expect(sidebarProps?.onCombinationModeChange).toBe(
      popupProps?.onCombinationModeChange,
    );
    const examNoteModalProps = capturedNoteModalProps.find(
      (entry) => entry.title === "Exam Files",
    );
    expect(examNoteModalProps?.panelClassName).toBe("note-modal-panel-exam");
    expect(examNoteModalProps?.bodyClassName).toBe("note-modal-body-exam");

    cleanup();
  });
});
