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
import { HelpButton, hasHelpContent } from "../../../components/HelpButton";

const formatTaskTitle = (index: number, count: number) => `Task ${index} of ${count}`;

type ExamTaskPhase = "exam" | "review" | "scoring";
type ExamTaskWithSource = ExamTask & {
  sourceTitle?: string;
  originalTaskNumber?: number;
};

type ExamTaskRunnerProps = {
  task: ExamTaskWithSource;
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
  helpEnabled?: boolean;
  showNavigation?: boolean;
  scoringReadOnly?: boolean;
  showConversionControls?: boolean;
};

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
  onConversionDecision,
  onBack,
  onNext,
  canGoBack,
  canGoNext,
  helpEnabled = false,
  showNavigation = true,
  scoringReadOnly = false,
  showConversionControls = true,
}: ExamTaskRunnerProps) => {
  const isScoring = phase === "scoring";
  const canRevealOfficialSolution = phase === "review" || phase === "scoring";
  const isAutoGraded = task.gradingMode === "auto";
  const taskIsCorrect = isAutoGraded ? isTaskCorrect(task, partStates) : false;
  const effectiveAutoDecision = isAutoGraded
    ? (autoGradeDecision ?? taskIsCorrect)
    : false;
  const autoAwardedPoints = (() => {
    if (!isAutoGraded) {
      return 0;
    }
    if (typeof awardedPoints === "number" && Number.isFinite(awardedPoints)) {
      return Math.min(maxPoints, Math.max(0, Math.floor(awardedPoints)));
    }
    return effectiveAutoDecision ? maxPoints : 0;
  })();
  const phaseLabel = phase === "exam" ? "EXAM" : phase === "review" ? "REVIEW" : "SCORING";
  const inputLocked = phase !== "exam" || conversionPending;
  const hasHelp = helpEnabled && hasHelpContent(task.helpText);

  return (
    <div className="exam-task">
      <header className="exam-task-header">
        <div>
          <p className="eyebrow">{phaseLabel}</p>
          <h2>{formatTaskTitle(taskIndex + 1, taskCount)}</h2>
          <p className="muted">Max points: {maxPoints}</p>
          {task.sourceTitle ? (
            <span className="exam-task-source-badge">
              Quelle: {task.sourceTitle}
            </span>
          ) : null}
        </div>
        {showNavigation ? (
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
        ) : null}
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
        submitted={canRevealOfficialSolution}
        submissionLocked={inputLocked}
        partStates={partStates}
        showSubmit={false}
        showResult={false}
        revealCorrectness={canRevealOfficialSolution}
        showSolution={canRevealOfficialSolution}
        forceRevealText={canRevealOfficialSolution}
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
            <span className="label">RESULT</span>
            <div className="exam-points-input">
              <span
                className={`flashcard-result ${
                  effectiveAutoDecision ? "correct" : "incorrect"
                }`}
              >
                {effectiveAutoDecision ? "Correct" : "Incorrect"}
              </span>
            </div>
          </div>
          <div className="exam-points-row">
            <span className="label">POINTS</span>
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
            {scoringReadOnly ? (
              <span>{awardedPoints ?? 0}</span>
            ) : (
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
            )}
            <span className="muted">/ {maxPoints}</span>
          </div>
        </div>
      ) : null}

      {isScoring && showConversionControls ? (
        <label className="exam-conversion-toggle">
          <input
            type="checkbox"
            checked={conversionDecision ?? false}
            onChange={(event) => onConversionDecision(taskIndex, event.target.checked)}
            disabled={conversionPending || scoringReadOnly}
          />
          Convert to flashcard
        </label>
      ) : null}

      {isScoring && showConversionControls && conversionError ? (
        <div className="error">{conversionError}</div>
      ) : null}

      {hasHelp ? (
        <div className="exam-help-actions">
          <HelpButton helpText={task.helpText} enabled={helpEnabled} />
        </div>
      ) : null}
    </div>
  );
};
