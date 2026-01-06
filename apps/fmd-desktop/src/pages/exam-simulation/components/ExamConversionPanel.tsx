import type { ExamTask } from "../../../lib/exam";

type ExamConversionPanelProps = {
  task: ExamTask | null;
  taskIndex: number;
  taskCount: number;
  decision?: boolean;
  decisionsCount: number;
  pending: boolean;
  error: string;
  canGoBack: boolean;
  canGoNext: boolean;
  onDecision: (taskIndex: number, shouldConvert: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onApply: () => void;
};

export const ExamConversionPanel = ({
  task,
  taskIndex,
  taskCount,
  decision,
  decisionsCount,
  pending,
  error,
  canGoBack,
  canGoNext,
  onDecision,
  onBack,
  onNext,
  onApply,
}: ExamConversionPanelProps) => {
  if (!task) {
    return (
      <div className="empty-state">
        No tasks available for conversion.
      </div>
    );
  }

  return (
    <div className="exam-conversion">
      <header className="exam-task-header">
        <div>
          <p className="eyebrow">CONVERSION</p>
          <h2>
            Task {taskIndex + 1} of {taskCount}
          </h2>
          <p className="muted">Wrap this task into a flashcard block?</p>
        </div>
        <div className="exam-task-nav">
          <button
            type="button"
            className="ghost small"
            onClick={onBack}
            disabled={!canGoBack}
          >
            Previous
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={onNext}
            disabled={!canGoNext}
          >
            Next
          </button>
        </div>
      </header>

      {task.warnings.length > 0 ? (
        <div className="exam-warning">
          {task.warnings.map((warning) => (
            <div key={warning.message}>{warning.message}</div>
          ))}
        </div>
      ) : null}

      <div className="flashcard-text-block">
        {task.prompt || "No task content provided."}
      </div>

      {task.kind === "multiple-choice" ? (
        <ul className="flashcard-options">
          {task.options.map((option) => (
            <li key={`${task.id}-${option.key}`}>
              <div className="flashcard-option exam-option-static">
                <span className="flashcard-key">{option.key}</span>
                <span className="flashcard-text">{option.text}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {task.kind === "text" && task.answer ? (
        <div className="flashcard-answer">
          <span className="label">Answer</span>
          <div className="flashcard-answer-text">{task.answer}</div>
        </div>
      ) : null}

      <div className="exam-conversion-actions">
        <button
          type="button"
          className={`pill pill-button ${decision === true ? "active" : ""}`}
          aria-pressed={decision === true}
          onClick={() => onDecision(taskIndex, true)}
        >
          Convert
        </button>
        <button
          type="button"
          className={`pill pill-button ${decision === false ? "active" : ""}`}
          aria-pressed={decision === false}
          onClick={() => onDecision(taskIndex, false)}
        >
          Skip
        </button>
        <span className="muted">
          Selected: {decisionsCount} / {taskCount}
        </span>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="exam-conversion-footer">
        <button
          type="button"
          className="primary"
          onClick={onApply}
          disabled={pending}
        >
          Apply conversions
        </button>
      </div>
    </div>
  );
};
