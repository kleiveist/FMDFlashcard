import type { ExamTask } from "../../../lib/exam";

const formatTaskTitle = (index: number, count: number) => `Task ${index} of ${count}`;

type ExamTaskRunnerProps = {
  task: ExamTask;
  taskIndex: number;
  taskCount: number;
  maxPoints: number;
  selection: string;
  awardedPoints: number | null;
  revealed: boolean;
  onSelect: (taskIndex: number, key: string) => void;
  onRevealAnswer: (taskIndex: number) => void;
  onAwardedPointsChange: (taskIndex: number, value: string, maxPoints: number) => void;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
};

export const ExamTaskRunner = ({
  task,
  taskIndex,
  taskCount,
  maxPoints,
  selection,
  awardedPoints,
  revealed,
  onSelect,
  onRevealAnswer,
  onAwardedPointsChange,
  onBack,
  onNext,
  canGoBack,
  canGoNext,
}: ExamTaskRunnerProps) => {
  const isAutoGraded = task.kind === "multiple-choice" && Boolean(task.correctKey);
  const canGrade =
    !isAutoGraded && (task.kind !== "text" || task.answer === null || revealed);

  return (
    <div className="exam-task">
      <header className="exam-task-header">
        <div>
          <p className="eyebrow">EXAM</p>
          <h2>{formatTaskTitle(taskIndex + 1, taskCount)}</h2>
          <p className="muted">Max points: {maxPoints}</p>
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
          {task.options.map((option) => {
            const isSelected = selection === option.key;
            const optionClasses = [
              "flashcard-option",
              isSelected ? "selected" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={`${task.id}-${option.key}`}>
                <button
                  type="button"
                  className={optionClasses}
                  onClick={() => onSelect(taskIndex, option.key)}
                  aria-pressed={isSelected}
                >
                  <span className="flashcard-key">{option.key}</span>
                  <span className="flashcard-text">{option.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {task.kind === "text" && task.answer && !revealed ? (
        <button
          type="button"
          className="ghost small"
          onClick={() => onRevealAnswer(taskIndex)}
        >
          Reveal answer
        </button>
      ) : null}

      {task.kind === "text" && task.answer && revealed ? (
        <div className="flashcard-answer">
          <span className="label">Answer</span>
          <div className="flashcard-answer-text">{task.answer}</div>
        </div>
      ) : null}

      {isAutoGraded ? null : (
        <div className="exam-points-row">
          <span className="label">AWARDED</span>
          <div className="exam-points-input">
            <input
              type="number"
              min={0}
              max={maxPoints}
              className="text-input"
              value={awardedPoints ?? ""}
              onChange={(event) =>
                onAwardedPointsChange(taskIndex, event.target.value, maxPoints)
              }
              disabled={!canGrade}
              aria-label="Awarded points"
            />
            <span className="muted">/ {maxPoints}</span>
          </div>
        </div>
      )}
    </div>
  );
};
