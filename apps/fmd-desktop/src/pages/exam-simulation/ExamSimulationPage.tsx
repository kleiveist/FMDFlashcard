import { ExamFilePanel } from "./components/ExamFilePanel";
import { ExamIdlePanel } from "./components/ExamIdlePanel";
import { ExamResultsPanel } from "./components/ExamResultsPanel";
import { ExamTaskRunner } from "./components/ExamTaskRunner";
import { ExamToolsPanel } from "./components/ExamToolsPanel";
import { useExamSimulationViewModel } from "./hooks/useExamSimulationViewModel";

export const ExamSimulationPage = () => {
  const {
    actions,
    preview,
    settings,
    vault,
    examFiles,
    examFilesState,
    examFilesError,
    selectedExamFile,
    previewExamParse,
    plannedTaskCount,
    plannedMaxPoints,
    hasTaskCountMismatch,
    stage,
    activeTaskIndex,
    activeTask,
    activeTaskMaxPoints,
    activeTaskPartStates,
    activeTaskAwardedPoints,
    runTasks,
    remainingPoints,
    isSettingsValid,
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
    handleTaskBack,
    handleTaskNext,
    handleConversionDecision,
  } = useExamSimulationViewModel();

  const isRunnerStage = stage === "running" || stage === "review" || stage === "scoring";
  const activePhase = stage === "review" ? "review" : stage === "scoring" ? "scoring" : "exam";

  return (
    <div className="exam-page">
      <header className="content-header">
        <div>
          <p className="eyebrow">EXAM SIMULATION</p>
          <h1>Exam</h1>
          <p className="muted">Run a Punktaufgaben exam and convert tasks into cards.</p>
        </div>
      </header>

      <div className="exam-layout">
        <section className="panel exam-panel">
          {stage === "idle" ? (
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
          <ExamFilePanel
            files={examFiles}
            listState={examFilesState}
            listError={examFilesError}
            selectedFile={selectedExamFile}
            vaultPath={vault.vaultPath}
            onSelectFile={actions.handleSelectFile}
          />
          <ExamToolsPanel
            stage={stage}
            canStartExam={canStartExam}
            isSettingsValid={isSettingsValid}
            remainingPoints={remainingPoints}
            hasTaskCountMismatch={hasTaskCountMismatch}
            plannedTaskCount={plannedTaskCount}
            availableTaskCount={previewExamParse.tasks.length}
            expectedTaskCount={settings.examTaskCount}
            onStartExam={handleStartExam}
            onSubmitExam={handleSubmitExam}
            onStartScoring={handleStartScoring}
            onFinishScoring={handleFinishScoring}
            finishPending={conversionPending}
            onResetExam={handleResetExam}
          />
        </div>
      </div>
    </div>
  );
};
