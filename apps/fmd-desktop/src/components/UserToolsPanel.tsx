/**
 * @file apps/fmd-desktop/src/components/UserToolsPanel.tsx
 *
 * Zweck:
 * - Rendert die User Tools fuer Study/Spaced Repetition und Exam.
 *
 * Verantwortlichkeiten:
 * - Zeigt Active User, Start und User-Management an.
 * - Teilt Layout und Logik zwischen Study und Exam.
 */

type UserToolsPanelProps = {
  spacedRepetition: {
    spacedRepetitionActiveUser: string | null;
    spacedRepetitionSelectedUserId: string;
    spacedRepetitionUsers: { id: string; name: string }[];
    spacedRepetitionNewUserName: string;
    spacedRepetitionUserError: string;
    handleSpacedRepetitionActiveUserLoadCards: () => void;
    setSpacedRepetitionSelectedUserId: (value: string) => void;
    setSpacedRepetitionNewUserName: (value: string) => void;
    setSpacedRepetitionUserError: (value: string) => void;
    handleSpacedRepetitionCreateUser: () => void;
    handleSpacedRepetitionLoadUser: () => void;
  };
  handleDeleteOpen: () => void;
  onStart: () => void;
  startDisabled: boolean;
  showReset?: boolean;
  onReset?: () => void;
  examStageControls?: {
    stage: "idle" | "running" | "review" | "scoring" | "finished";
    canStartExam: boolean;
    finishPending?: boolean;
    onStartExam: () => void;
    onSubmitExam: () => void;
    onStartScoring: () => void;
    onFinishScoring: () => void;
    onResetExam: () => void;
  };
};

export const UserToolsPanel = ({
  spacedRepetition,
  handleDeleteOpen,
  onStart,
  startDisabled,
  showReset = false,
  onReset,
  examStageControls,
}: UserToolsPanelProps) => (
  <section className="panel sr-user-panel">
    <div className="panel-header">
      <div>
        <h2>User Tools</h2>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">Active user</span>
        <div className="setting-inline">
          <span className="value">
            {spacedRepetition.spacedRepetitionActiveUser ?? "—"}
          </span>
          {examStageControls ? (
            <>
              <div
                className="pill-grid exam-stage-control"
                role="group"
                aria-label="Exam stages"
              >
                <button
                  type="button"
                  className={`pill pill-button ${
                    examStageControls.stage === "idle" ? "active" : ""
                  }`}
                  onClick={examStageControls.onStartExam}
                  disabled={
                    examStageControls.stage !== "idle" ||
                    !examStageControls.canStartExam
                  }
                >
                  Start
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    examStageControls.stage === "review" ? "active" : ""
                  }`}
                  onClick={examStageControls.onSubmitExam}
                  disabled={examStageControls.stage !== "running"}
                >
                  Submit
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    examStageControls.stage === "running" ? "active" : ""
                  }`}
                  disabled={examStageControls.stage !== "running"}
                >
                  Exam
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    examStageControls.stage === "scoring" ||
                    examStageControls.stage === "finished"
                      ? "active"
                      : ""
                  }`}
                  onClick={
                    examStageControls.stage === "review"
                      ? examStageControls.onStartScoring
                      : examStageControls.onFinishScoring
                  }
                  disabled={
                    examStageControls.stage === "idle" ||
                    examStageControls.stage === "running" ||
                    examStageControls.stage === "finished" ||
                    (examStageControls.stage === "scoring" &&
                      examStageControls.finishPending)
                  }
                >
                  Grading
                </button>
              </div>
              {showReset ? (
                <button
                  type="button"
                  className="ghost small"
                  onClick={examStageControls.onResetExam}
                  aria-label="Reset session"
                >
                  Reset
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghost small"
                onClick={onStart}
                disabled={startDisabled}
                aria-label="Start session for active user"
              >
                Start
              </button>
              {showReset ? (
                <button
                  type="button"
                  className="ghost small"
                  onClick={onReset}
                  aria-label="Reset session"
                >
                  Reset
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">User list</span>
        <select
          className="text-input"
          value={spacedRepetition.spacedRepetitionSelectedUserId}
          onChange={(event) =>
            spacedRepetition.setSpacedRepetitionSelectedUserId(event.target.value)
          }
          aria-label="Select user"
        >
          <option value="">Select user</option>
          {spacedRepetition.spacedRepetitionUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>
      <div className="setting-row">
        <span className="label">New user</span>
        <div className="setting-inline">
          <input
            type="text"
            className="text-input"
            value={spacedRepetition.spacedRepetitionNewUserName}
            onChange={(event) => {
              spacedRepetition.setSpacedRepetitionNewUserName(event.target.value);
              if (spacedRepetition.spacedRepetitionUserError) {
                spacedRepetition.setSpacedRepetitionUserError("");
              }
            }}
            placeholder="User name"
            aria-label="New user name"
          />
          <button
            type="button"
            className="ghost small"
            onClick={spacedRepetition.handleSpacedRepetitionCreateUser}
          >
            Create
          </button>
        </div>
        {spacedRepetition.spacedRepetitionUserError ? (
          <span className="helper-text error-text">
            {spacedRepetition.spacedRepetitionUserError}
          </span>
        ) : null}
      </div>
      <div className="setting-row">
        <span className="label">Actions</span>
        <div className="setting-actions">
          <button
            type="button"
            className="ghost small"
            onClick={spacedRepetition.handleSpacedRepetitionLoadUser}
            disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
          >
            Load
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={handleDeleteOpen}
            disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </section>
);
