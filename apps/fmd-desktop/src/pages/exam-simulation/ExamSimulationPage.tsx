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

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserToolsPanel } from "../../components/UserToolsPanel";
import { SrDeleteModal } from "../spaced-repetition/components/SrDeleteModal";
import { ExamFilePanel } from "./components/ExamFilePanel";
import { ExamIdlePanel } from "./components/ExamIdlePanel";
import { ExamResultsPanel } from "./components/ExamResultsPanel";
import { ExamStatisticsPanel } from "./components/ExamStatisticsPanel";
import { ExamTaskRunner } from "./components/ExamTaskRunner";
import { ExamTimeBar } from "./components/ExamTimeBar";
import { useExamSimulationViewModel } from "./hooks/useExamSimulationViewModel";
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
    examEmptyState,
    results,
    conversionDecisions,
    conversionPending,
    conversionError,
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
  const showOverviewLayout = isOverviewStage && !isViewMode;
  const timelineVisible = examTimerEnabled && examShowTimeline;
  const showTimelineBlock = !isViewMode && (timelineVisible || isOverviewStage);
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
  const readySummary = useMemo(() => {
    if (!selectedExamFile) {
      return { state: "empty", title: "Select an exam file to begin." };
    }
    if (preview.previewState === "loading") {
      return { state: "loading", title: "Loading exam file..." };
    }
    if (preview.previewState === "error") {
      return {
        state: "error",
        title: preview.previewError || "Failed to load file.",
      };
    }
    if (examEmptyState) {
      return {
        state: "empty",
        title: examEmptyState.title,
        detail: examEmptyState.message,
      };
    }
    return {
      state: "ready",
      title: "Exam ready to start",
      detail: `${previewExamParse.tasks.length} tasks detected. Max points this run: ${plannedMaxPoints}.`,
      extra: hasTaskCountMismatch
        ? `Only ${previewExamParse.tasks.length} tasks available. The exam will run ${plannedTaskCount}.`
        : null,
    };
  }, [
    examEmptyState,
    hasTaskCountMismatch,
    plannedMaxPoints,
    plannedTaskCount,
    preview.previewError,
    preview.previewState,
    previewExamParse.tasks.length,
    selectedExamFile,
  ]);
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
            className={`pill pill-button ${
              overviewTab === "statistics" ? "active" : ""
            }`}
            onClick={() => setOverviewTab("statistics")}
            role="tab"
            aria-selected={overviewTab === "statistics"}
          >
            Statistics
          </button>
        </div>
        <button
          type="button"
          className={`focus-toggle ${isViewMode ? "active" : ""}`}
          onClick={() => setIsViewMode((prev) => !prev)}
          aria-pressed={isViewMode}
          aria-label={viewLabel}
          title={viewLabel}
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
      {overviewTab === "ready" ? (
        readySummary.state === "error" ? (
          <div className="error">{readySummary.title}</div>
        ) : (
          <div className="exam-overview-summary">
            <div className="exam-overview-summary-title">{readySummary.title}</div>
            {readySummary.detail ? (
              <div className="muted">{readySummary.detail}</div>
            ) : null}
            {readySummary.extra ? (
              <div className="muted">{readySummary.extra}</div>
            ) : null}
          </div>
        )
      ) : null}
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

  return (
    <div className="exam-page">
      {showTimelineBlock ? (
        <div className="exam-timeline-block">
          {timelineVisible ? (
            <ExamTimeBar
              timeLimitMs={examTimeLimitMs}
              timeRemainingMs={examTimeRemainingMs}
              isRunning={isExamTimerRunning}
              isTimeUp={examTimeUp}
              isEnabled={examTimerEnabled}
            />
          ) : null}
          {showOverviewLayout ? renderOverviewToggle() : null}
        </div>
      ) : null}

      <div className="exam-layout">
        <section className="panel exam-panel">
          {isViewMode && timelineVisible ? (
            <ExamTimeBar
              className="exam-time-bar--view"
              timeLimitMs={examTimeLimitMs}
              timeRemainingMs={examTimeRemainingMs}
              isRunning={isExamTimerRunning}
              isTimeUp={examTimeUp}
              isEnabled={examTimerEnabled}
            />
          ) : null}
          {stage === "idle" ? (
            <div className="exam-overview">
              {isViewMode && isOverviewStage ? renderOverviewToggle() : null}
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
                  />
                ) : (
                  <ExamStatisticsPanel
                    runs={examRuns}
                    gradeScaleId={settings.examGradeScale}
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
                />
              ) : (
                <div className="empty-state">No tasks available for this exam.</div>
              )
            ) : stage === "finished" ? (
              results ? (
                <ExamResultsPanel
                  results={results}
                />
              ) : (
                <div className="empty-state">No results available yet.</div>
              )
            ) : null}
        </section>
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
            examStageControls={{
              stage,
              canStartExam,
              finishPending: conversionPending,
              onStartExam: handleStartExam,
              onSubmitExam: handleSubmitExam,
              onStartScoring: handleStartScoring,
              onFinishScoring: handleFinishScoring,
              onResetExam: handleResetExam,
            }}
          />
          <ExamFilePanel
            files={examFiles}
            listState={examFilesState}
            listError={examFilesError}
            selectedFile={selectedExamFile}
            vaultPath={vault.vaultPath}
            onSelectFile={actions.handleSelectFile}
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
    </div>
  );
};
