type ExamStage = "idle" | "running" | "finished" | "conversion";

type ExamToolsPanelProps = {
  stage: ExamStage;
  canStartExam: boolean;
  isSettingsValid: boolean;
  remainingPoints: number;
  hasTaskCountMismatch: boolean;
  plannedTaskCount: number;
  availableTaskCount: number;
  expectedTaskCount: number;
  onStartExam: () => void;
  onFinishExam: () => void;
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
  onStartExam,
  onFinishExam,
  onResetExam,
}: ExamToolsPanelProps) => {
  const showStart = stage === "idle";
  const showFinish = stage === "running";
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
            {showFinish ? (
              <button
                type="button"
                className="primary"
                onClick={onFinishExam}
              >
                Finish Exam
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
