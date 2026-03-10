/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamToolsPanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam Tools Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/exam-simulation/ExamSimulationPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - ExamToolsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import type { ExamStage } from "../examSimulationTypes";

type ExamToolsPanelProps = {
  stage: ExamStage;
  canStartExam: boolean;
  isSettingsValid: boolean;
  remainingPoints: number;
  hasTaskCountMismatch: boolean;
  plannedTaskCount: number;
  availableTaskCount: number;
  expectedTaskCount: number;
  finishPending?: boolean;
  onStartExam: () => void;
  onSubmitExam: () => void;
  onStartScoring: () => void;
  onFinishManualScoring: () => void;
  onFinalizeExam: () => void;
  onBackToResults: () => void;
  onResetExam: () => void;
};

export const ExamToolsPanel = ({
  stage,
  canStartExam,
  isSettingsValid,
  remainingPoints,
  hasTaskCountMismatch,
  plannedTaskCount,
  availableTaskCount,
  expectedTaskCount,
  finishPending = false,
  onStartExam,
  onSubmitExam,
  onStartScoring,
  onFinishManualScoring,
  onFinalizeExam,
  onBackToResults,
  onResetExam,
}: ExamToolsPanelProps) => {
  const showStart = stage === "idle";
  const showSubmit = stage === "running";
  const showReviewAdvance = stage === "review";
  const showFinishScoring = stage === "scoring_manual";
  const showFinalize = stage === "finish_scoring";
  const showBackToResults = stage === "correction";
  const showSettingsHints = stage === "idle";

  return (
    <section className="panel exam-tools-panel">
      <div className="panel-header">
        <div>
          <h2>Exam Tools</h2>
          <p className="muted">Start, finish, or reset an exam run.</p>
        </div>
      </div>
      <div className="panel-body">
        <div className="setting-row">
          <span className="label">CONTROLS</span>
          <div className="setting-actions">
            {showStart ? (
              <button
                type="button"
                className="primary"
                onClick={onStartExam}
                disabled={!canStartExam}
              >
                Start Exam
              </button>
            ) : null}
            {showSubmit ? (
              <button type="button" className="primary" onClick={onSubmitExam}>
                Submit
              </button>
            ) : null}
            {showReviewAdvance ? (
              <button type="button" className="primary" onClick={onStartScoring}>
                Proceed to Scoring
              </button>
            ) : null}
            {showFinishScoring ? (
              <button
                type="button"
                className="primary"
                onClick={onFinishManualScoring}
                disabled={finishPending}
              >
                Finish
              </button>
            ) : null}
            {showFinalize ? (
              <button
                type="button"
                className="primary"
                onClick={onFinalizeExam}
                disabled={finishPending}
              >
                Finish
              </button>
            ) : null}
            {showBackToResults ? (
              <button
                type="button"
                className="primary"
                onClick={onBackToResults}
              >
                Back to Results
              </button>
            ) : null}
            <button type="button" className="ghost" onClick={onResetExam}>
              Reset
            </button>
          </div>
        </div>
        {showSettingsHints && !isSettingsValid ? (
          <div className="exam-warning">
            Assign points so the total matches the configured max score.
          </div>
        ) : null}
        {showSettingsHints && remainingPoints !== 0 ? (
          <div className="muted">Remaining points: {remainingPoints}</div>
        ) : null}
        {showSettingsHints && hasTaskCountMismatch ? (
          <div className="muted">
            Only {availableTaskCount} tasks found (expected {expectedTaskCount}). The
            exam will run {plannedTaskCount}.
          </div>
        ) : null}
      </div>
    </section>
  );
};
