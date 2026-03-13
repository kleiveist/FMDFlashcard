/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/ExamSimulationPage.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam Simulation.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/exam-simulation/components/ExamFilePanel.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/pages/exam-simulation/components/ExamIdlePanel.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/pages/exam-simulation/components/ExamResultsPanel.tsx: UI-Komponente.
 *
 * Exportiert:
 * - ExamSimulationPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  resolveExamPhaseButton,
  type ExamStageControls,
} from "../../components/UserToolsPanel";
import { NoteModal } from "../../components/NoteModal";
import { SettingsIcon } from "../../components/icons";
import { ExamCorrectionHost } from "./components/ExamCorrectionHost";
import { ExamFilePanel } from "./components/ExamFilePanel";
import { ExamIdlePanel } from "./components/ExamIdlePanel";
import { ExamManualScoringPanel } from "./components/ExamManualScoringPanel";
import { ExamResultsPanel } from "./components/ExamResultsPanel";
import { ExamStatisticsPanel, type StatsTab } from "./components/ExamStatisticsPanel";
import { ExamTaskRunner } from "./components/ExamTaskRunner";
import { ExamTimeBar } from "./components/ExamTimeBar";
import { useExamSimulationViewModel } from "./hooks/useExamSimulationViewModel";
import { ExamTogglesPanel } from "../../components/settings/ExamSettingsSection";
import { useLayoutMode } from "../../lib/layoutMode";
import { requestSettingsFocus } from "../../features/settings/settingsDeepLink";
import {
  formatBinding,
  getEffectiveBinding,
  getShortcutPlatform,
  isEditableTarget,
  matchesBinding,
} from "../../lib/shortcuts/bindings";
import { getShortcutById } from "../../lib/shortcuts/registry";

const viewToggleCommand = getShortcutById("toggleViewMode");
const studyPrevCommand = getShortcutById("studyPrevious");
const studyNextCommand = getShortcutById("studyNext");
const studySubmitCommand = getShortcutById("studySubmit");
const STANDARD_RUN_PROFILE_LABEL = "Standard (no profile)";

type ExamSimulationPageProps = {
  runSummaryNoteActionEnabled?: boolean;
  onRunSummaryNoteAction?: () => void;
  isRunSummaryNoteActionActive?: boolean;
  isExamFilesNoteOpen?: boolean;
  onCloseExamFilesNote?: () => void;
};

export const ExamSimulationPage = ({
  runSummaryNoteActionEnabled = false,
  onRunSummaryNoteAction,
  isRunSummaryNoteActionActive = false,
  isExamFilesNoteOpen = false,
  onCloseExamFilesNote = () => undefined,
}: ExamSimulationPageProps) => {
  const {
    settings,
    vault,
    examFiles,
    examFilesState,
    examFilesError,
    examRuns,
    examRunDeleteError,
    selectedExamPathRows,
    selectedExamPaths,
    selectedExamCount,
    selectedIncludedExamCount,
    selectedExamParseState,
    selectedExamParseError,
    combinationMode,
    runProfileOptions,
    selectedRunProfileId,
    previewDurationMinutes,
    plannedTaskCount,
    plannedMaxPoints,
    stage,
    examRunning,
    activeTaskIndex,
    activeTask,
    activeTaskMaxPoints,
    activeTaskPartStates,
    activeTaskAwardedPoints,
    activeTaskAutoDecision,
    activeManualTaskEntry,
    canGoManualScoringBack,
    canGoManualScoringNext,
    incorrectTaskResults,
    correctionActiveEntry,
    correctionActiveTask,
    correctionActiveMaxPoints,
    correctionActivePartStates,
    correctionActiveSubmitted,
    correctionCanGoBack,
    correctionCanGoNext,
    correctionQueueLength,
    runTasks,
    examTimeLimitMs,
    examTimeRemainingMs,
    examTimeUp,
    examTimerEnabled,
    examShowTimeline,
    canStartExam,
    missingExamSettings,
    examEmptyState,
    results,
    resultTaskCardWrapPendingById,
    resultTaskCardWrapErrorById,
    resultTaskCardWrapNoticeById,
    handleDeleteExamRun,
    handleToggleExamSelection,
    handleSetSelectedExamRows,
    handleClearExamSelection,
    handlePlaceSelectedExamFile,
    handleCombinationModeChange,
    handleRunProfileChange,
    handleStartExam,
    handleResetExam,
    handleSubmitExam,
    handleStartScoring,
    handleFinishManualScoring,
    handleStartCorrection,
    handleBackToFinishScoring,
    handleFinalizeExam,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleClozeBlankDragOver,
    handleClozeTokenDragStart,
    handleAwardedPointsChange,
    handleAutoGradeDecision,
    handleTaskBack,
    handleTaskNext,
    handleManualScoringBack,
    handleManualScoringNext,
    handleCorrectionOptionSelect,
    handleCorrectionTrueFalseSelect,
    handleCorrectionClozeInputChange,
    handleCorrectionClozeTokenDrop,
    handleCorrectionClozeTokenRemove,
    handleCorrectionTextInputChange,
    handleCorrectionSubmit,
    handleCorrectionTaskBack,
    handleCorrectionTaskNext,
    handleResultTaskCardWrapperToggle,
    getTaskCardWrapDisabledReason,
  } = useExamSimulationViewModel();
  const [isViewMode, setIsViewMode] = useState(false);
  const [overviewTab, setOverviewTab] = useState<"ready" | "statistics">("ready");
  const [overviewStatsTab, setOverviewStatsTab] = useState<StatsTab>("last");
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isExamTogglesOpen, setIsExamTogglesOpen] = useState(false);
  const autoViewModeRef = useRef(false);
  const isTableView = useLayoutMode() === "table";
  const openExamToggles = useCallback(() => {
    setIsExamTogglesOpen(true);
  }, []);
  const closeExamToggles = useCallback(() => {
    setIsExamTogglesOpen(false);
  }, []);
  const handleOpenExamSettings = useCallback(() => {
    const focusTarget =
      missingExamSettings.find((item) => item.severity !== "warning") ??
      missingExamSettings[0];
    requestSettingsFocus({
      pageId: "exam-settings",
      subPageId: "exam-toggles",
      scrollSelector: "#exam-settings-section",
      focusSelector: focusTarget?.fieldSelector,
      highlight: true,
    });
  }, [missingExamSettings]);
  const selectedRunProfileName =
    selectedRunProfileId === null
      ? STANDARD_RUN_PROFILE_LABEL
      : (runProfileOptions.find((profile) => profile.id === selectedRunProfileId)?.name ??
        null);
  const runSummaryModeLabel =
    combinationMode === "fully-mixed"
      ? "Fully mixed"
      : combinationMode === "sequential"
        ? "Sequential"
        : combinationMode === "sequential-shuffled"
          ? "Sequential + internal shuffle"
          : "Nested";
  const runSelectionSummary = `${selectedExamCount} selected, ${selectedIncludedExamCount} included`;
  const runTasksTotalSummary = `${plannedTaskCount} tasks total`;
  const hasSelectedExamFiles = selectedExamCount > 0;
  const runSummarySelectionValue = hasSelectedExamFiles ? runSelectionSummary : "--";
  const runSummaryTasksTotalValue = hasSelectedExamFiles ? runTasksTotalSummary : "--";
  const runSummaryMaxPointsValue = hasSelectedExamFiles ? String(plannedMaxPoints) : "--";
  const runSummaryModeValue = hasSelectedExamFiles ? runSummaryModeLabel : "--";
  const runSummaryProfileValue =
    hasSelectedExamFiles ? (selectedRunProfileName ?? STANDARD_RUN_PROFILE_LABEL) : "--";
  const runSummaryDurationValue = hasSelectedExamFiles
    ? `${previewDurationMinutes} minutes`
    : "--";
  const runSummaryNoteTriggerEnabled =
    stage === "idle" &&
    runSummaryNoteActionEnabled &&
    Boolean(onRunSummaryNoteAction);
  const runSummaryInfoClassName = [
    "exam-mix-info",
    runSummaryNoteTriggerEnabled ? "is-note-trigger" : "",
    runSummaryNoteTriggerEnabled && isRunSummaryNoteActionActive ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const handleRunSummaryInfoKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!runSummaryNoteTriggerEnabled || !onRunSummaryNoteAction) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRunSummaryNoteAction();
      }
    },
    [onRunSummaryNoteAction, runSummaryNoteTriggerEnabled],
  );
  useEffect(() => {
    if (stage === "idle" || !isExamFilesNoteOpen) {
      return;
    }
    onCloseExamFilesNote();
  }, [isExamFilesNoteOpen, onCloseExamFilesNote, stage]);

  const examFilePanelProps = {
    files: examFiles,
    listState: examFilesState,
    listError: examFilesError,
    selectedPathRows: selectedExamPathRows,
    selectedPaths: selectedExamPaths,
    vaultPath: vault.vaultPath,
    compactSummary: {
      maxPoints: plannedMaxPoints,
      taskCount: plannedTaskCount,
      minDurationMinutes: previewDurationMinutes,
    },
    selectedProfileId: selectedRunProfileId,
    profileOptions: runProfileOptions,
    onProfileChange: handleRunProfileChange,
    onSetSelectedPathRows: handleSetSelectedExamRows,
    onClearSelection: handleClearExamSelection,
    onPlaceSelectedFile: handlePlaceSelectedExamFile,
    listScrollMode: "external" as const,
  };
  const requestResetExam = useCallback(() => {
    setIsResetConfirmOpen(true);
  }, []);
  const cancelResetExam = useCallback(() => {
    setIsResetConfirmOpen(false);
  }, []);
  const confirmResetExam = useCallback(() => {
    handleResetExam();
    setIsResetConfirmOpen(false);
  }, [handleResetExam]);
  const handleBackToExamMenuReset = useCallback(() => {
    setIsResetConfirmOpen(false);
    handleResetExam();
  }, [handleResetExam]);
  const examStageControls = useMemo<ExamStageControls>(
    () => ({
      stage,
      canStartExam,
      phaseDisabled: false,
      onStartExam: handleStartExam,
      onSubmitExam: handleSubmitExam,
      onStartScoring: handleStartScoring,
      onFinishManualScoring: handleFinishManualScoring,
      onFinalizeExam: handleFinalizeExam,
      onBackToResults: handleBackToFinishScoring,
      onResetExam: requestResetExam,
    }),
    [
      canStartExam,
      handleBackToFinishScoring,
      handleFinalizeExam,
      handleFinishManualScoring,
      handleStartExam,
      handleStartScoring,
      handleSubmitExam,
      requestResetExam,
      stage,
    ],
  );
  const phaseButton = resolveExamPhaseButton(examStageControls);
  const platform = getShortcutPlatform();
  const viewBinding = useMemo(() => {
    if (!viewToggleCommand) {
      return null;
    }
    return getEffectiveBinding(
      viewToggleCommand,
      settings.keyboardShortcuts.bindings,
      platform,
    );
  }, [platform, settings.keyboardShortcuts.bindings]);
  const viewShortcutLabel = viewBinding
    ? formatBinding(viewBinding, platform)
    : null;
  const viewLabel = viewShortcutLabel ? `View (${viewShortcutLabel})` : "View";
  const studyBindings = useMemo(() => {
    const bindings = settings.keyboardShortcuts.bindings;
    return {
      prev: studyPrevCommand
        ? getEffectiveBinding(studyPrevCommand, bindings, platform)
        : null,
      next: studyNextCommand
        ? getEffectiveBinding(studyNextCommand, bindings, platform)
        : null,
      submit: studySubmitCommand
        ? getEffectiveBinding(studySubmitCommand, bindings, platform)
        : null,
    };
  }, [platform, settings.keyboardShortcuts.bindings]);

  const isRunnerStage = stage === "running" || stage === "review";
  const hasCorrectionCandidates = incorrectTaskResults.length > 0;
  const activePhase = stage === "review" ? "review" : "exam";
  const isExamTimerRunning = stage === "running" && !examTimeUp && examTimerEnabled;
  const viewToggleDisabled = isTableView && !examRunning;
  const timelineVisible = examShowTimeline;
  const renderOverviewToggle = () => (
    <div className="exam-overview-toggle">
      <div className="exam-overview-toggle-header">
        <div
          className="pill-grid exam-overview-tabs"
          role="tablist"
          aria-label="Exam overview tabs"
        >
          <button
            type="button"
            className={`pill pill-button ${overviewTab === "ready" ? "active" : ""}`}
            onClick={() => setOverviewTab("ready")}
            role="tab"
            aria-selected={overviewTab === "ready"}
          >
            READY
          </button>
          {overviewTab === "statistics" ? (
            <>
              <button
                type="button"
                className={`pill pill-button ${overviewStatsTab === "last" ? "active" : ""}`}
                onClick={() => {
                  setOverviewTab("statistics");
                  setOverviewStatsTab("last");
                }}
                role="tab"
                aria-selected={overviewStatsTab === "last"}
              >
                Last Session
              </button>
              <button
                type="button"
                className={`pill pill-button ${overviewStatsTab === "history" ? "active" : ""}`}
                onClick={() => {
                  setOverviewTab("statistics");
                  setOverviewStatsTab("history");
                }}
                role="tab"
                aria-selected={overviewStatsTab === "history"}
              >
                History
              </button>
            </>
          ) : (
            <button
              type="button"
              className="pill pill-button"
              onClick={() => {
                setOverviewTab("statistics");
                setOverviewStatsTab("last");
              }}
              role="tab"
              aria-selected={false}
            >
              Statistics
            </button>
          )}
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    document.body.classList.toggle("focus-mode", isViewMode);
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [isViewMode]);

  useEffect(() => {
    if (!isTableView) {
      autoViewModeRef.current = false;
      return;
    }
    if (stage === "finished") {
      autoViewModeRef.current = false;
      if (isViewMode) {
        setIsViewMode(false);
      }
      return;
    }
    if (!examRunning) {
      autoViewModeRef.current = false;
      if (isViewMode) {
        setIsViewMode(false);
      }
      return;
    }
    if (!autoViewModeRef.current) {
      autoViewModeRef.current = true;
      setIsViewMode(true);
    }
  }, [examRunning, isTableView, isViewMode, stage]);

  useEffect(() => {
    if (stage !== "idle" && overviewTab !== "ready") {
      setOverviewTab("ready");
    }
  }, [overviewTab, stage]);

  useEffect(() => {
    if (stage !== "finished" || !isViewMode) {
      return;
    }
    autoViewModeRef.current = false;
    setIsViewMode(false);
  }, [isViewMode, stage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const isEditable = isEditableTarget(event.target);
      const canTrigger = (
        command:
          | typeof viewToggleCommand
          | typeof studyPrevCommand
          | typeof studyNextCommand
          | typeof studySubmitCommand,
        binding: string | null,
      ) => {
        if (!command || !binding) {
          return false;
        }
        if (!command.allowInTextInputs && isEditable) {
          return false;
        }
        return matchesBinding(event, binding);
      };

      if (canTrigger(viewToggleCommand, viewBinding)) {
        event.preventDefault();
        setIsViewMode((prev) => !prev);
        return;
      }

      const isManualScoringStage =
        stage === "scoring_manual" && Boolean(activeManualTaskEntry);
      const isCorrectionStage = stage === "correction" && Boolean(correctionActiveTask);
      if (!(isRunnerStage && activeTask) && !isManualScoringStage && !isCorrectionStage) {
        return;
      }

      if (canTrigger(studyPrevCommand, studyBindings.prev)) {
        event.preventDefault();
        if (stage === "scoring_manual") {
          if (canGoManualScoringBack) {
            handleManualScoringBack();
          }
        } else if (stage === "correction") {
          if (correctionCanGoBack) {
            handleCorrectionTaskBack();
          }
        } else if (activeTaskIndex > 0) {
          handleTaskBack();
        }
        return;
      }

      if (canTrigger(studyNextCommand, studyBindings.next)) {
        event.preventDefault();
        if (stage === "scoring_manual") {
          if (canGoManualScoringNext) {
            handleManualScoringNext();
          }
        } else if (stage === "correction") {
          if (correctionCanGoNext) {
            handleCorrectionTaskNext();
          }
        } else if (activeTaskIndex < runTasks.length - 1) {
          handleTaskNext();
        }
        return;
      }

      if (!canTrigger(studySubmitCommand, studyBindings.submit)) {
        return;
      }
      if (stage === "scoring_manual") {
        if (canGoManualScoringNext) {
          event.preventDefault();
          handleManualScoringNext();
        }
        return;
      }
      if (stage === "correction") {
        if (correctionCanGoNext) {
          event.preventDefault();
          handleCorrectionTaskNext();
        }
        return;
      }
      if (activeTaskIndex < runTasks.length - 1) {
        event.preventDefault();
        handleTaskNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeTask,
    activeTaskIndex,
    activeManualTaskEntry,
    canGoManualScoringBack,
    canGoManualScoringNext,
    correctionActiveTask,
    correctionCanGoBack,
    correctionCanGoNext,
    handleManualScoringBack,
    handleManualScoringNext,
    handleCorrectionTaskBack,
    handleCorrectionTaskNext,
    handleTaskBack,
    handleTaskNext,
    isRunnerStage,
    runTasks.length,
    stage,
    studyBindings,
    viewBinding,
  ]);

  return (
    <div className="exam-page">
      <div className="exam-layout">
        <div className="exam-main">
          {timelineVisible ? (
            <ExamTimeBar
              className={isViewMode ? "exam-time-bar--view" : undefined}
              timeLimitMs={examTimeLimitMs}
              timeRemainingMs={examTimeRemainingMs}
              isRunning={isExamTimerRunning}
              isTimeUp={examTimeUp}
              isEnabled={examTimerEnabled}
            />
          ) : null}
          {stage === "idle" || isRunnerStage ? (
            <section className="panel exam-panel">
              <div className="exam-panel-toolbar">
                <button
                  type="button"
                  className="primary small"
                  onClick={phaseButton.onClick}
                  disabled={phaseButton.disabled}
                >
                  {phaseButton.label}
                </button>
                {stage !== "idle" ? (
                  <button type="button" className="ghost small" onClick={requestResetExam}>
                    Reset
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost small exam-toolbar-icon-button"
                  onClick={openExamToggles}
                  aria-label="Settings"
                  title="Settings"
                >
                  <SettingsIcon />
                </button>
                <button
                  type="button"
                  className={`focus-toggle exam-view-toggle ${isViewMode ? "active" : ""}`}
                  onClick={() => setIsViewMode((prev) => !prev)}
                  aria-pressed={isViewMode}
                  aria-label={viewLabel}
                  title={viewLabel}
                  disabled={viewToggleDisabled}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                </button>
              </div>
              <div
                className={runSummaryInfoClassName}
                role="list"
                aria-label="Run summary"
                onClick={runSummaryNoteTriggerEnabled ? onRunSummaryNoteAction : undefined}
                onKeyDown={runSummaryNoteTriggerEnabled ? handleRunSummaryInfoKeyDown : undefined}
                tabIndex={runSummaryNoteTriggerEnabled ? 0 : undefined}
                aria-haspopup={runSummaryNoteTriggerEnabled ? "dialog" : undefined}
                aria-expanded={runSummaryNoteTriggerEnabled ? isRunSummaryNoteActionActive : undefined}
                title={runSummaryNoteTriggerEnabled ? "Note" : undefined}
              >
                <div className="exam-mix-summary-block" role="listitem">
                  <p className="exam-mix-summary-label">Selection</p>
                  <p className="exam-mix-summary-value">{runSummarySelectionValue}</p>
                </div>
                <div className="exam-mix-summary-block" role="listitem">
                  <p className="exam-mix-summary-label">Tasks total</p>
                  <p className="exam-mix-summary-value">{runSummaryTasksTotalValue}</p>
                </div>
                <div className="exam-mix-summary-block" role="listitem">
                  <p className="exam-mix-summary-label">Max points in run</p>
                  <p className="exam-mix-summary-value">{runSummaryMaxPointsValue}</p>
                </div>
                <div className="exam-mix-summary-block" role="listitem">
                  <p className="exam-mix-summary-label">Mode</p>
                  <p className="exam-mix-summary-value">{runSummaryModeValue}</p>
                </div>
                <div className="exam-mix-summary-block" role="listitem">
                  <p className="exam-mix-summary-label">Profile</p>
                  <p className="exam-mix-summary-value">{runSummaryProfileValue}</p>
                </div>
                <div className="exam-mix-summary-block" role="listitem">
                  <p className="exam-mix-summary-label">Duration</p>
                  <p className="exam-mix-summary-value">{runSummaryDurationValue}</p>
                </div>
              </div>
              {stage === "idle" ? (
                <div className="exam-overview">
                  <div className="exam-overview-body">
                    {renderOverviewToggle()}
                    {overviewTab === "ready" ? (
                      <ExamIdlePanel
                        selectedCount={selectedExamCount}
                        previewState={selectedExamParseState}
                        previewError={selectedExamParseError}
                        examEmptyState={examEmptyState}
                        missingSettings={missingExamSettings}
                        onOpenExamSettings={handleOpenExamSettings}
                      />
                    ) : (
                      <ExamStatisticsPanel
                        runs={examRuns}
                        gradeScaleId={settings.examGradeScale}
                        onDeleteRun={handleDeleteExamRun}
                        deleteError={examRunDeleteError}
                        showTabs={false}
                        activeTab={overviewStatsTab}
                      />
                    )}
                  </div>
                </div>
              ) : activeTask ? (
                <ExamTaskRunner
                  task={activeTask}
                  taskIndex={activeTaskIndex}
                  taskCount={runTasks.length}
                  maxPoints={activeTaskMaxPoints}
                  phase={activePhase}
                  partStates={activeTaskPartStates}
                  awardedPoints={activeTaskAwardedPoints}
                  autoGradeDecision={activeTaskAutoDecision}
                  onOptionSelect={handleOptionSelect}
                  onTrueFalseSelect={handleTrueFalseSelect}
                  onClozeInputChange={handleClozeInputChange}
                  onClozeTokenDrop={handleClozeTokenDrop}
                  onClozeTokenRemove={handleClozeTokenRemove}
                  onClozeTokenDragStart={handleClozeTokenDragStart}
                  onBlankDragOver={handleClozeBlankDragOver}
                  onTextInputChange={handleTextInputChange}
                  onAwardedPointsChange={handleAwardedPointsChange}
                  onAutoGradeDecision={handleAutoGradeDecision}
                  onBack={handleTaskBack}
                  onNext={handleTaskNext}
                  canGoBack={activeTaskIndex > 0}
                  canGoNext={activeTaskIndex < runTasks.length - 1}
                  showSourceBadge={settings.examShowTaskSources}
                  helpEnabled={settings.examHelpEnabled}
                  vaultPath={vault.vaultPath}
                  vaultPngAssets={vault.pngAssets}
                />
              ) : (
                <div className="empty-state">No tasks available for this exam.</div>
              )}
            </section>
          ) : null}
          {stage === "scoring_manual" ? (
            <ExamManualScoringPanel
              task={activeManualTaskEntry}
              showSourceBadge={settings.examShowTaskSources}
              helpEnabled={settings.examHelpEnabled}
              vaultPath={vault.vaultPath}
              vaultPngAssets={vault.pngAssets}
              finishDisabled={false}
              canGoBack={canGoManualScoringBack}
              canGoNext={canGoManualScoringNext}
              onAwardedPointsChange={handleAwardedPointsChange}
              onBack={handleManualScoringBack}
              onNext={handleManualScoringNext}
              onFinishScoring={handleFinishManualScoring}
              onReset={requestResetExam}
            />
          ) : null}
          {stage === "finish_scoring" ? (
            results ? (
              <section className="panel finish-scoring-panel">
                <div className="exam-panel-toolbar">
                  <button
                    type="button"
                    className="primary small"
                    onClick={phaseButton.onClick}
                    disabled={phaseButton.disabled}
                  >
                    {phaseButton.label}
                  </button>
                  <button type="button" className="ghost small" onClick={requestResetExam}>
                    Reset
                  </button>
                  <button
                    type="button"
                    className="primary small finish-scoring-correction-button"
                    onClick={handleStartCorrection}
                    disabled={!hasCorrectionCandidates}
                    title={hasCorrectionCandidates ? undefined : "No incorrect cards"}
                  >
                    Correction
                  </button>
                </div>
                <ExamResultsPanel
                  results={results}
                  helpEnabled={settings.examHelpEnabled}
                  vaultPath={vault.vaultPath}
                  vaultPngAssets={vault.pngAssets}
                  onToggleTaskCardWrapper={handleResultTaskCardWrapperToggle}
                  taskCardWrapPendingById={resultTaskCardWrapPendingById}
                  taskCardWrapErrorById={resultTaskCardWrapErrorById}
                  taskCardWrapNoticeById={resultTaskCardWrapNoticeById}
                  getTaskCardWrapDisabledReason={getTaskCardWrapDisabledReason}
                />
              </section>
            ) : (
              <section className="panel finish-scoring-panel">
                <div className="exam-panel-toolbar">
                  <button
                    type="button"
                    className="primary small"
                    onClick={phaseButton.onClick}
                    disabled={phaseButton.disabled}
                  >
                    {phaseButton.label}
                  </button>
                  <button type="button" className="ghost small" onClick={requestResetExam}>
                    Reset
                  </button>
                </div>
                <div className="empty-state">No results available yet.</div>
              </section>
            )
          ) : null}
          {stage === "correction" ? (
            <ExamCorrectionHost
              task={correctionActiveTask}
              queueIndex={correctionActiveEntry?.queueIndex ?? 0}
              queueLength={correctionQueueLength || incorrectTaskResults.length}
              maxPoints={correctionActiveMaxPoints}
              partStates={correctionActivePartStates}
              submitted={correctionActiveSubmitted}
              showSourceBadge={settings.examShowTaskSources}
              canGoBack={correctionCanGoBack}
              canGoNext={correctionCanGoNext}
              helpEnabled={settings.examHelpEnabled}
              vaultPath={vault.vaultPath}
              vaultPngAssets={vault.pngAssets}
              onOptionSelect={handleCorrectionOptionSelect}
              onTrueFalseSelect={handleCorrectionTrueFalseSelect}
              onClozeInputChange={handleCorrectionClozeInputChange}
              onClozeTokenDrop={handleCorrectionClozeTokenDrop}
              onClozeTokenRemove={handleCorrectionClozeTokenRemove}
              onTextInputChange={handleCorrectionTextInputChange}
              onSubmit={handleCorrectionSubmit}
              onBack={handleCorrectionTaskBack}
              onNext={handleCorrectionTaskNext}
              onBackToResults={handleBackToFinishScoring}
            />
          ) : null}
          {stage === "finished" ? (
            results ? (
              <>
                <section className="panel exam-panel">
                  <div className="exam-panel-toolbar">
                    <button
                      type="button"
                      className="ghost small"
                      onClick={handleBackToExamMenuReset}
                    >
                      Back to Exam Menu
                    </button>
                  </div>
                  <div className="exam-overview">
                    <div className="exam-overview-body">
                      <ExamStatisticsPanel
                        runs={examRuns}
                        gradeScaleId={settings.examGradeScale}
                        onDeleteRun={handleDeleteExamRun}
                        deleteError={examRunDeleteError}
                        showTabs={false}
                      />
                    </div>
                  </div>
                </section>
                <section className="panel exam-panel">
                  <div className="exam-panel-toolbar">
                    <button
                      type="button"
                      className="ghost small"
                      onClick={handleBackToExamMenuReset}
                    >
                      Back to Exam Menu
                    </button>
                  </div>
                  <ExamResultsPanel
                    results={results}
                    helpEnabled={settings.examHelpEnabled}
                    vaultPath={vault.vaultPath}
                    vaultPngAssets={vault.pngAssets}
                    onToggleTaskCardWrapper={handleResultTaskCardWrapperToggle}
                    taskCardWrapPendingById={resultTaskCardWrapPendingById}
                    taskCardWrapErrorById={resultTaskCardWrapErrorById}
                    taskCardWrapNoticeById={resultTaskCardWrapNoticeById}
                    getTaskCardWrapDisabledReason={getTaskCardWrapDisabledReason}
                  />
                </section>
              </>
            ) : (
              <div className="empty-state">No results available yet.</div>
            )
          ) : null}
        </div>
        {stage === "idle" ? (
          <div className="exam-sidebar">
            <ExamFilePanel
              {...examFilePanelProps}
              onToggleFile={handleToggleExamSelection}
              combinationMode={combinationMode}
              onCombinationModeChange={handleCombinationModeChange}
              className="exam-files-panel"
            />
          </div>
        ) : null}
      </div>
      <NoteModal
        isOpen={isExamFilesNoteOpen}
        onClose={onCloseExamFilesNote}
        title="Exam Files"
        panelClassName="note-modal-panel-exam"
        bodyClassName="note-modal-body-exam"
      >
        <ExamFilePanel
          {...examFilePanelProps}
          onToggleFile={handleToggleExamSelection}
          combinationMode={combinationMode}
          onCombinationModeChange={handleCombinationModeChange}
        />
      </NoteModal>
      <NoteModal
        isOpen={isExamTogglesOpen}
        onClose={closeExamToggles}
        title="Exam Toggles"
      >
        <ExamTogglesPanel
          timeLimitEnabled={settings.examTimeLimitEnabled}
          showTimeline={settings.examShowTimeline}
          helpEnabled={settings.examHelpEnabled}
          showTaskSources={settings.examShowTaskSources}
          aiEvaluation={settings.examAiEvaluation}
          onTimeLimitToggle={settings.setExamTimeLimitEnabled}
          setShowTimeline={settings.setExamShowTimeline}
          setHelpEnabled={settings.setExamHelpEnabled}
          setShowTaskSources={settings.setExamShowTaskSources}
        />
      </NoteModal>
      <NoteModal
        isOpen={isResetConfirmOpen}
        onClose={cancelResetExam}
        title="Abort current exam?"
      >
        <div className="modal-body">
          <p className="muted">
            Do you really want to abort this exam? Your current progress will be lost.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost small" onClick={cancelResetExam}>
            Cancel
          </button>
          <button type="button" className="primary small" onClick={confirmResetExam}>
            Abort exam
          </button>
        </div>
      </NoteModal>
    </div>
  );
};
