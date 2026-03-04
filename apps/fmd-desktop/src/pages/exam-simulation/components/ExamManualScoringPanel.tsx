import { type DragEvent } from "react";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { FlashcardMediaGroup } from "../../../components/flashcards/FlashcardMediaGroup";
import type { TrueFalseSelection } from "../../../features/flashcards/logic";
import type { ExamManualTaskEntry } from "../examSimulationTypes";
import type { VaultPngAsset } from "../../../lib/tree";

type ExamManualScoringPanelProps = {
  task: ExamManualTaskEntry | null;
  helpEnabled?: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  finishDisabled: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  onAwardedPointsChange: (taskIndex: number, value: string, maxPoints: number) => void;
  onBack: () => void;
  onNext: () => void;
  onFinishScoring: () => void;
};

const noopOptionSelect = (
  _taskIndex: number,
  _partIndex: number,
  _keys: string[],
) => {};
const noopTrueFalseSelect = (
  _taskIndex: number,
  _partIndex: number,
  _itemId: string,
  _value: TrueFalseSelection,
) => {};
const noopClozeInputChange = (
  _taskIndex: number,
  _partIndex: number,
  _blankId: string,
  _value: string,
) => {};
const noopClozeTokenDrop = (
  _event: DragEvent<HTMLElement>,
  _taskIndex: number,
  _partIndex: number,
  _blankId: string,
  _validTokenIds: Set<string>,
  _dragBlankIds: Set<string>,
) => {};
const noopClozeTokenRemove = (
  _taskIndex: number,
  _partIndex: number,
  _blankId: string,
) => {};
const noopClozeTokenDragStart = (
  _event: DragEvent<HTMLElement>,
  _payload: { cardIndex: number; tokenId: string; partIndex?: number },
) => {};
const noopBlankDragOver = (_event: DragEvent<HTMLElement>) => {};
const noopTextInputChange = (
  _taskIndex: number,
  _partIndex: number,
  _value: string,
) => {};
const noopTextCheck = (_taskIndex: number, _partIndex: number) => {};
const noopSelfGrade = (
  _taskIndex: number,
  _partIndex: number,
  _grade: "correct" | "incorrect",
) => {};
const noopSubmit = (_taskIndex: number, _canSubmit: boolean) => {};

export const ExamManualScoringPanel = ({
  task,
  helpEnabled = false,
  vaultPath,
  vaultPngAssets,
  finishDisabled,
  canGoBack,
  canGoNext,
  onAwardedPointsChange,
  onBack,
  onNext,
  onFinishScoring,
}: ExamManualScoringPanelProps) => (
  <section className="panel scoring-panel">
    <header className="scoring-panel-header">
      <div>
        <p className="eyebrow">SCORING</p>
        <h2>Manual scoring</h2>
        <p className="muted">
          Only QA tasks or mixed tasks containing QA are listed here.
        </p>
      </div>
      <div className="exam-task-header-actions">
        <button
          type="button"
          className="primary small"
          onClick={onFinishScoring}
          disabled={finishDisabled}
        >
          Finish Scoring
        </button>
      </div>
    </header>

    {task ? (
      <article className="scoring-manual-card">
        <header className="exam-task-header">
          <div>
            <p className="eyebrow">
              TASK {task.manualIndex + 1} OF {task.manualCount}
            </p>
            <h3>Manual review</h3>
            <p className="muted">Max points: {task.maxPoints}</p>
            <span className="exam-task-source-badge">
              Quelle: {task.task.sourceTitle}
            </span>
          </div>
        </header>
        {task.task.media?.length ? (
          <FlashcardMediaGroup
            media={task.task.media}
            vaultPngAssets={vaultPngAssets}
            vaultPath={vaultPath}
          />
        ) : null}
        <CompositeCard
          card={task.task.card}
          cardIndex={task.taskIndex}
          submitted
          submissionLocked
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          partStates={task.partStates}
          showSubmit={false}
          showResult={false}
          revealCorrectness
          showSolution
          forceRevealText
          helpText={task.task.helpText}
          helpEnabled={helpEnabled}
          onOptionSelect={noopOptionSelect}
          onTrueFalseSelect={noopTrueFalseSelect}
          onClozeInputChange={noopClozeInputChange}
          onClozeTokenDrop={noopClozeTokenDrop}
          onClozeTokenRemove={noopClozeTokenRemove}
          onClozeTokenDragStart={noopClozeTokenDragStart}
          onBlankDragOver={noopBlankDragOver}
          onTextInputChange={noopTextInputChange}
          onTextCheck={noopTextCheck}
          onSelfGrade={noopSelfGrade}
          onSubmit={noopSubmit}
        />
        <div className="exam-points-row">
          <span className="label">AWARDED</span>
          <div className="exam-points-input">
            <input
              type="number"
              min={0}
              max={task.maxPoints}
              className="text-input"
              value={task.awardedPoints ?? ""}
              onChange={(event) =>
                onAwardedPointsChange(
                  task.taskIndex,
                  event.target.value,
                  task.maxPoints,
                )
              }
              aria-label="Awarded points"
            />
            <span className="muted">/ {task.maxPoints}</span>
          </div>
        </div>
        <div className="exam-task-footer-actions">
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
        </div>
      </article>
    ) : (
      <div className="empty-state">
        No QA tasks with awarded scoring are available for this exam.
      </div>
    )}
  </section>
);
