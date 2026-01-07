/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamTaskRunner.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam Task Runner.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/flashcards/CompositeCard.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/features/flashcards/logic.ts: Feature-Logik oder Hook.
 * - apps/fmd-desktop/src/lib/exam.ts: Typen.
 *
 * Exportiert:
 * - ExamTaskRunner: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { type DragEvent } from "react";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { evaluateFlashcardPartResult, type CompositePartState, type TrueFalseSelection } from "../../../features/flashcards/logic";
import type { ExamTask } from "../../../lib/exam";
import type { FlashcardPart } from "../../../lib/flashcards";

const formatTaskTitle = (index: number, count: number) => `Task ${index} of ${count}`;

type ExamTaskPhase = "exam" | "review" | "scoring";

type ExamTaskRunnerProps = {
  task: ExamTask;
  taskIndex: number;
  taskCount: number;
  maxPoints: number;
  phase: ExamTaskPhase;
  partStates: CompositePartState[];
  awardedPoints: number | null;
  autoGradeDecision?: boolean;
  conversionDecision?: boolean;
  conversionPending: boolean;
  conversionError: string;
  onOptionSelect: (taskIndex: number, partIndex: number, keys: string[]) => void;
  onTrueFalseSelect: (
    taskIndex: number,
    partIndex: number,
    itemId: string,
    value: TrueFalseSelection,
  ) => void;
  onClozeInputChange: (
    taskIndex: number,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  onClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    taskIndex: number,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onClozeTokenRemove: (taskIndex: number, partIndex: number, blankId: string) => void;
  onClozeTokenDragStart: (
    event: DragEvent<HTMLElement>,
    payload: { cardIndex: number; tokenId: string; partIndex?: number },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onTextInputChange: (taskIndex: number, partIndex: number, value: string) => void;
  onAwardedPointsChange: (taskIndex: number, value: string, maxPoints: number) => void;
  onAutoGradeDecision: (taskIndex: number, decision: boolean) => void;
  onConversionDecision: (taskIndex: number, shouldConvert: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
};

const isAutoGradablePart = (part: FlashcardPart) => {
  if (part.kind === "multiple-choice") {
    return part.correctKeys.length > 0;
  }
  if (part.kind === "true-false") {
    return part.items.length > 0;
  }
  if (part.kind === "cloze") {
    return part.segments.some((segment) => segment.type === "blank");
  }
  return false;
};

const isTaskAutoGraded = (task: ExamTask) =>
  task.card.parts.length > 0 && task.card.parts.every(isAutoGradablePart);

const isTaskCorrect = (task: ExamTask, states: CompositePartState[]) =>
  task.card.parts.every(
    (part, index) => evaluateFlashcardPartResult(part, states[index] ?? {}) === "correct",
  );

const noopSubmit = (_cardIndex: number, _canSubmit: boolean) => {};
const noopTextCheck = (_cardIndex: number, _partIndex: number) => {};
const noopSelfGrade = (
  _cardIndex: number,
  _partIndex: number,
  _grade: "correct" | "incorrect",
) => {};

export const ExamTaskRunner = ({
  task,
  taskIndex,
  taskCount,
  maxPoints,
  phase,
  partStates,
  awardedPoints,
  autoGradeDecision,
  conversionDecision,
  conversionPending,
  conversionError,
  onOptionSelect,
  onTrueFalseSelect,
  onClozeInputChange,
  onClozeTokenDrop,
  onClozeTokenRemove,
  onClozeTokenDragStart,
  onBlankDragOver,
  onTextInputChange,
  onAwardedPointsChange,
  onAutoGradeDecision,
  onConversionDecision,
  onBack,
  onNext,
  canGoBack,
  canGoNext,
}: ExamTaskRunnerProps) => {
  const isScoring = phase === "scoring";
  const showAnswers = phase !== "exam";
  const isAutoGraded = isTaskAutoGraded(task);
  const taskIsCorrect = isAutoGraded ? isTaskCorrect(task, partStates) : false;
  const decidedCorrect = isAutoGraded ? autoGradeDecision ?? taskIsCorrect : null;
  const autoAwardedPoints = isAutoGraded && decidedCorrect ? maxPoints : 0;
  const phaseLabel = phase === "exam" ? "EXAM" : phase === "review" ? "REVIEW" : "SCORING";
  const inputLocked = phase !== "exam" || conversionPending;

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

      <CompositeCard
        card={task.card}
        cardIndex={taskIndex}
        submitted={showAnswers}
        submissionLocked={inputLocked}
        partStates={partStates}
        showSubmit={false}
        showResult={false}
        revealCorrectness={showAnswers}
        showSolution={showAnswers}
        forceRevealText={showAnswers}
        onOptionSelect={onOptionSelect}
        onTrueFalseSelect={onTrueFalseSelect}
        onClozeInputChange={onClozeInputChange}
        onClozeTokenDrop={onClozeTokenDrop}
        onClozeTokenRemove={onClozeTokenRemove}
        onClozeTokenDragStart={onClozeTokenDragStart}
        onBlankDragOver={onBlankDragOver}
        onTextInputChange={onTextInputChange}
        onTextCheck={noopTextCheck}
        onSelfGrade={noopSelfGrade}
        onSubmit={noopSubmit}
      />

      {isScoring && isAutoGraded ? (
        <>
          <div className="exam-points-row">
            <span className="label">AUTO RESULT</span>
            <div className="exam-points-input">
              <span
                className={`flashcard-result ${
                  taskIsCorrect ? "correct" : "incorrect"
                }`}
              >
                {taskIsCorrect ? "Correct" : "Incorrect"}
              </span>
            </div>
          </div>
          <div className="exam-points-row">
            <span className="label">CONFIRM</span>
            <div className="exam-points-input">
              <button
                type="button"
                className={`small ${decidedCorrect ? "primary" : "ghost"}`}
                onClick={() => onAutoGradeDecision(taskIndex, true)}
                aria-pressed={decidedCorrect === true}
                disabled={conversionPending}
              >
                Correct
              </button>
              <button
                type="button"
                className={`small ${decidedCorrect ? "ghost" : "primary"}`}
                onClick={() => onAutoGradeDecision(taskIndex, false)}
                aria-pressed={decidedCorrect === false}
                disabled={conversionPending}
              >
                Not correct
              </button>
            </div>
          </div>
          <div className="exam-points-row">
            <span className="label">AWARDED</span>
            <div className="exam-points-input">
              <span>{autoAwardedPoints}</span>
              <span className="muted">/ {maxPoints}</span>
            </div>
          </div>
        </>
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
              disabled={conversionPending}
            />
            <span className="muted">/ {maxPoints}</span>
          </div>
        </div>
      ) : null}

      {isScoring ? (
        <label className="exam-conversion-toggle">
          <input
            type="checkbox"
            checked={conversionDecision ?? false}
            onChange={(event) => onConversionDecision(taskIndex, event.target.checked)}
            disabled={conversionPending}
          />
          Convert to flashcard
        </label>
      ) : null}

      {isScoring && conversionError ? (
        <div className="error">{conversionError}</div>
      ) : null}
    </div>
  );
};
