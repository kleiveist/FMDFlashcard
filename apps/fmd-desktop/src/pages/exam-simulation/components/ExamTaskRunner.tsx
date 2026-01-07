import type { ExamTask } from "../../../lib/exam";
import { ExamMarkdown } from "./ExamMarkdown";

const formatTaskTitle = (index: number, count: number) => `Task ${index} of ${count}`;

type ExamTaskPhase = "exam" | "review" | "scoring";

type ExamTaskRunnerProps = {
  task: ExamTask;
  taskIndex: number;
  taskCount: number;
  maxPoints: number;
  phase: ExamTaskPhase;
  selection: string;
  response: string;
  awardedPoints: number | null;
  onSelect: (taskIndex: number, key: string) => void;
  onResponseChange: (taskIndex: number, value: string) => void;
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
  phase,
  selection,
  response,
  awardedPoints,
  onSelect,
  onResponseChange,
  onAwardedPointsChange,
  onBack,
  onNext,
  canGoBack,
  canGoNext,
}: ExamTaskRunnerProps) => {
  const isScoring = phase === "scoring";
  const showAnswers = phase !== "exam";
  const isAutoGraded = task.kind === "multiple-choice" && Boolean(task.correctKey);
  const autoAwardedPoints =
    isAutoGraded && selection === task.correctKey ? maxPoints : 0;
  const phaseLabel =
    phase === "exam" ? "EXAM" : phase === "review" ? "REVIEW" : "SCORING";
  const inputLocked = phase !== "exam";

  return (
    <div className="exam-task">
      <header className="exam-task-header">
        <div>
          <p className="eyebrow">{phaseLabel}</p>
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

      <ExamMarkdown
        className="flashcard-text-block"
        content={task.prompt || "No task content provided."}
      />

      {task.kind === "multiple-choice" ? (
        <ul className="flashcard-options">
          {task.options.map((option) => {
            const isSelected = selection === option.key;
            const isCorrect = option.key === task.correctKey;
            const optionClasses = [
              "flashcard-option",
              isSelected ? "selected" : "",
              showAnswers && isCorrect ? "correct" : "",
              showAnswers && isSelected && !isCorrect && task.correctKey ? "incorrect" : "",
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
                  disabled={inputLocked}
                >
                  <span className="flashcard-key">{option.key}</span>
                  <span className="flashcard-text">{option.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {task.kind === "text" ? (
        <textarea
          className="flashcard-input"
          value={response}
          onChange={(event) => onResponseChange(taskIndex, event.target.value)}
          placeholder="Your answer"
          aria-label="Your answer"
          disabled={inputLocked}
        />
      ) : null}

      {task.kind === "text" && task.answer !== null && showAnswers ? (
        <div className="flashcard-answer">
          <span className="label">Answer</span>
          <ExamMarkdown className="flashcard-answer-text" content={task.answer} />
        </div>
      ) : null}

      {isScoring && isAutoGraded ? (
        <div className="exam-points-row">
          <span className="label">AWARDED</span>
          <div className="exam-points-input">
            <span>{autoAwardedPoints}</span>
            <span className="muted">/ {maxPoints}</span>
          </div>
        </div>
      ) : null}

      {isScoring && !isAutoGraded ? (
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
              aria-label="Awarded points"
            />
            <span className="muted">/ {maxPoints}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
