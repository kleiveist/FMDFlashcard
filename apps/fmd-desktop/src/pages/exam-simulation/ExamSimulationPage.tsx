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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  resolveExamPhaseButton,
  resolveExamPrimaryButton,
  type ExamStageControls,
  UserToolsPanel,
} from "../../components/UserToolsPanel";
import { ModalShell } from "../../components/ModalShell";
import { FileIcon } from "../../components/icons";
import type { VaultFile } from "../../lib/tree";
import { SrDeleteModal } from "../spaced-repetition/components/SrDeleteModal";
import { ExamFilePanel } from "./components/ExamFilePanel";
import { ExamIdlePanel } from "./components/ExamIdlePanel";
import { ExamResultsPanel } from "./components/ExamResultsPanel";
import { ExamStatisticsPanel } from "./components/ExamStatisticsPanel";
import { ExamTaskRunner } from "./components/ExamTaskRunner";
import { ExamTimeBar } from "./components/ExamTimeBar";
import { useExamSimulationViewModel } from "./hooks/useExamSimulationViewModel";
import { useLayoutMode } from "../../lib/layoutMode";
import { requestSettingsFocus } from "../../features/settings/settingsDeepLink";
import { useMediaQuery } from "../../lib/useMediaQuery";
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

export const ExamSimulationPage = () => {
  const {
    actions,
    preview,
    settings,
    spacedRepetition,
    vault,
    examFiles,
    examFilesState,
    examFilesError,
    examRuns,
    examRunDeleteError,
    selectedExamFile,
    previewExamParse,
    plannedTaskCount,
    plannedMaxPoints,
    hasTaskCountMismatch,
    stage,
    examRunning,
    activeTaskIndex,
    activeTask,
    activeTaskMaxPoints,
    activeTaskPartStates,
    activeTaskAwardedPoints,
    activeTaskAutoDecision,
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
    conversionDecisions,
    conversionPending,
    conversionError,
    handleDeleteExamRun,
    handleStartExam,
    handleResetExam,
    handleSubmitExam,
    handleStartScoring,
    handleFinishScoring,
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
    handleConversionDecision,
  } = useExamSimulationViewModel();
  const [isViewMode, setIsViewMode] = useState(false);
  const [overviewTab, setOverviewTab] = useState<"ready" | "statistics">("ready");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const autoViewModeRef = useRef(false);
  const isTableView = useLayoutMode() === "table";
  const isTablet = useMediaQuery("(min-width: 980px) and (max-width: 1199px)", false);
  const [isExamFilesOpen, setIsExamFilesOpen] = useState(false);
  const handleOpenExamSettings = useCallback(() => {
    const focusTarget =
      missingExamSettings.find((item) => item.severity !== "warning") ??
      missingExamSettings[0];
    requestSettingsFocus({
      pageId: "exam-settings",
      subPageId: "exam-settings",
      scrollSelector: "#exam-settings-section",
      focusSelector: focusTarget?.fieldSelector,
      highlight: true,
    });
  }, [missingExamSettings]);

  const handleExamFilesOpen = useCallback(() => {
    setIsExamFilesOpen(true);
  }, []);

  const handleExamFilesClose = useCallback(() => {
    setIsExamFilesOpen(false);
  }, []);

  const handleExamFileSelect = useCallback(
    (file: VaultFile) => {
      actions.handleSelectFile(file);
      setIsExamFilesOpen(false);
    },
    [actions],
  );
  const examFilePanelProps = {
    files: examFiles,
    listState: examFilesState,
    listError: examFilesError,
    selectedFile: selectedExamFile,
    vaultPath: vault.vaultPath,
  };

  useEffect(() => {
    if (!isTablet && isExamFilesOpen) {
      setIsExamFilesOpen(false);
    }
  }, [isExamFilesOpen, isTablet]);
  const examStageControls = useMemo<ExamStageControls>(
    () => ({
      stage,
      canStartExam,
      finishPending: conversionPending,
      onStartExam: handleStartExam,
      onSubmitExam: handleSubmitExam,
      onStartScoring: handleStartScoring,
      onFinishScoring: handleFinishScoring,
      onResetExam: handleResetExam,
    }),
    [
      canStartExam,
      conversionPending,
      handleFinishScoring,
      handleResetExam,
      handleStartExam,
      handleStartScoring,
      handleSubmitExam,
      stage,
    ],
  );
  const phaseButton = resolveExamPhaseButton(examStageControls);
  const primaryButton = resolveExamPrimaryButton(examStageControls);
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

  const isRunnerStage = stage === "running" || stage === "review" || stage === "scoring";
  const activePhase = stage === "review" ? "review" : stage === "scoring" ? "scoring" : "exam";
  const isExamTimerRunning = stage === "running" && !examTimeUp && examTimerEnabled;
  const isOverviewStage = stage === "idle";
  const showOverviewToggle = isOverviewStage;
  const viewToggleDisabled = isTableView && !examRunning;
  const timelineVisible = examTimerEnabled && examShowTimeline;
  const selectedUser = useMemo(
    () =>
      spacedRepetition.spacedRepetitionUsers.find(
        (user) => user.id === spacedRepetition.spacedRepetitionSelectedUserId,
      ),
    [
      spacedRepetition.spacedRepetitionSelectedUserId,
      spacedRepetition.spacedRepetitionUsers,
    ],
  );
  const deleteTargetName = selectedUser?.name ?? "";
  const canConfirmDelete =
    Boolean(deleteTargetName) && deleteConfirmInput.trim() === deleteTargetName;
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
          <button
            type="button"
            className={`pill pill-button ${overviewTab === "statistics" ? "active" : ""}`}
            onClick={() => setOverviewTab("statistics")}
            role="tab"
            aria-selected={overviewTab === "statistics"}
          >
            Statistics
          </button>
        </div>
        {isTableView ? (
          <button
            type="button"
            className="primary small"
            onClick={phaseButton.onClick}
            disabled={phaseButton.disabled}
          >
            {phaseButton.label}
          </button>
        ) : null}
      </div>
    </div>
  );

  const handleDeleteOpen = useCallback(() => {
    if (!selectedUser) {
      return;
    }
    setIsDeleteDialogOpen(true);
  }, [selectedUser]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!canConfirmDelete) {
      return;
    }
    spacedRepetition.handleSpacedRepetitionDeleteUser();
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, [canConfirmDelete, spacedRepetition]);

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
  }, [examRunning, isTableView, isViewMode]);

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return;
    }
    if (!selectedUser) {
      setIsDeleteDialogOpen(false);
      setDeleteConfirmInput("");
    }
  }, [isDeleteDialogOpen, selectedUser]);

  useEffect(() => {
    if (stage !== "idle" && overviewTab !== "ready") {
      setOverviewTab("ready");
    }
  }, [overviewTab, stage]);

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

      if (!isRunnerStage || !activeTask) {
        return;
      }

      if (canTrigger(studyPrevCommand, studyBindings.prev)) {
        event.preventDefault();
        if (activeTaskIndex > 0) {
          handleTaskBack();
        }
        return;
      }

      if (canTrigger(studyNextCommand, studyBindings.next)) {
        event.preventDefault();
        if (activeTaskIndex < runTasks.length - 1) {
          handleTaskNext();
        }
        return;
      }

      if (!canTrigger(studySubmitCommand, studyBindings.submit)) {
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
    handleTaskBack,
    handleTaskNext,
    isRunnerStage,
    runTasks.length,
    studyBindings,
    viewBinding,
  ]);

  const mobileNavActions =
    typeof document === "undefined"
      ? null
      : document.getElementById("mobile-nav-actions");
  const tableViewControls =
    (isTableView || isViewMode) && mobileNavActions && !isOverviewStage
      ? createPortal(
          <button
            type="button"
            className={`${primaryButton.variant} small`}
            onClick={primaryButton.onClick}
            disabled={primaryButton.disabled}
          >
            {primaryButton.label}
          </button>,
          mobileNavActions,
        )
      : null;

  return (
    <div className="exam-page">
      {tableViewControls}
      <div className="exam-layout">
        <div className="exam-main">
          {showOverviewToggle ? renderOverviewToggle() : null}
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
          <section className="panel exam-panel">
            <div className="exam-panel-toolbar">
              <button
                type="button"
                className={`focus-toggle ${isViewMode ? "active" : ""}`}
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
              {isTablet ? (
                <button
                  type="button"
                  className="focus-toggle exam-files-toggle"
                  onClick={handleExamFilesOpen}
                  aria-label="Exam Files"
                  title="Exam Files"
                >
                  <FileIcon />
                </button>
              ) : null}
            </div>
            {stage === "idle" ? (
              <div className="exam-overview">
                <div className="exam-overview-body">
                  {overviewTab === "ready" ? (
                    <ExamIdlePanel
                      selectedFile={selectedExamFile}
                      previewState={preview.previewState}
                      previewError={preview.previewError}
                      examEmptyState={examEmptyState}
                      availableTaskCount={previewExamParse.tasks.length}
                      plannedTaskCount={plannedTaskCount}
                      plannedMaxPoints={plannedMaxPoints}
                      hasTaskCountMismatch={hasTaskCountMismatch}
                      onStartExam={phaseButton.onClick}
                      startDisabled={phaseButton.disabled}
                      missingSettings={missingExamSettings}
                      onOpenExamSettings={handleOpenExamSettings}
                    />
                  ) : (
                    <ExamStatisticsPanel
                      runs={examRuns}
                      gradeScaleId={settings.examGradeScale}
                      onDeleteRun={handleDeleteExamRun}
                      deleteError={examRunDeleteError}
                    />
                  )}
                </div>
              </div>
            ) : isRunnerStage ? (
                activeTask ? (
                  <ExamTaskRunner
                    task={activeTask}
                    taskIndex={activeTaskIndex}
                    taskCount={runTasks.length}
                    maxPoints={activeTaskMaxPoints}
                    phase={activePhase}
                    partStates={activeTaskPartStates}
                    awardedPoints={activeTaskAwardedPoints}
                    autoGradeDecision={activeTaskAutoDecision}
                    conversionDecision={conversionDecisions[activeTaskIndex]}
                    conversionPending={conversionPending}
                    conversionError={conversionError}
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
                    onConversionDecision={handleConversionDecision}
                    onBack={handleTaskBack}
                    onNext={handleTaskNext}
                    canGoBack={activeTaskIndex > 0}
                    canGoNext={activeTaskIndex < runTasks.length - 1}
                    helpEnabled={settings.examHelpEnabled}
                  />
                ) : (
                  <div className="empty-state">No tasks available for this exam.</div>
                )
              ) : stage === "finished" ? (
                results ? (
                  <>
                    <section className="panel exam-panel">
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
                      <ExamResultsPanel results={results} />
                    </section>
                  </>
                ) : (
                  <div className="empty-state">No results available yet.</div>
                )
              ) : null}
          </section>
        </div>
        <div className="exam-sidebar">
          <UserToolsPanel
            spacedRepetition={spacedRepetition}
            handleDeleteOpen={handleDeleteOpen}
            onStart={handleStartExam}
            startDisabled={
              !spacedRepetition.spacedRepetitionActiveUser ||
              !canStartExam ||
              examRunning
            }
            showReset={examRunning}
            onReset={handleResetExam}
            examStageControls={examStageControls}
          />
          <ExamFilePanel
            {...examFilePanelProps}
            onSelectFile={actions.handleSelectFile}
            className="exam-files-panel"
          />
        </div>
      </div>
      <SrDeleteModal
        isDeleteDialogOpen={isDeleteDialogOpen}
        deleteTargetName={deleteTargetName}
        deleteConfirmInput={deleteConfirmInput}
        setDeleteConfirmInput={setDeleteConfirmInput}
        handleDeleteCancel={handleDeleteCancel}
        handleDeleteConfirm={handleDeleteConfirm}
        canConfirmDelete={canConfirmDelete}
      />
      <ModalShell
        isOpen={isExamFilesOpen}
        title="Exam Files"
        onClose={handleExamFilesClose}
        className="note-modal-panel"
        bodyClassName="note-modal-body"
      >
        <ExamFilePanel
          {...examFilePanelProps}
          onSelectFile={handleExamFileSelect}
        />
      </ModalShell>
    </div>
  );
};
