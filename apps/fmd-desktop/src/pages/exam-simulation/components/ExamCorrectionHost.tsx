import { type DragEvent } from "react";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { FlashcardMediaGroup } from "../../../components/flashcards/FlashcardMediaGroup";
import {
  handleClozeBlankDragOver,
  handleClozeTokenDragStart,
  type CompositePartState,
  type TrueFalseSelection,
} from "../../../features/flashcards/logic";
import type { ExamSessionTask } from "../../../lib/examMixedSession";
import type { VaultPngAsset } from "../../../lib/tree";

type ExamCorrectionHostProps = {
  task: ExamSessionTask | null;
  queueIndex: number;
  queueLength: number;
  maxPoints: number;
  partStates: CompositePartState[];
  submitted: boolean;
  showSourceBadge?: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  helpEnabled?: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  onOptionSelect: (sessionTaskId: string, partIndex: number, keys: string[]) => void;
  onTrueFalseSelect: (
    sessionTaskId: string,
    partIndex: number,
    itemId: string,
    value: TrueFalseSelection,
  ) => void;
  onClozeInputChange: (
    sessionTaskId: string,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  onClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    sessionTaskId: string,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onClozeTokenRemove: (sessionTaskId: string, partIndex: number, blankId: string) => void;
  onTextInputChange: (sessionTaskId: string, partIndex: number, value: string) => void;
  onSubmit: (sessionTaskId: string, canSubmit: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onBackToResults: () => void;
};

const noopTextCheck = (_cardIndex: number, _partIndex: number) => {};
const noopSelfGrade = (
  _cardIndex: number,
  _partIndex: number,
  _grade: "correct" | "incorrect",
) => {};

export const ExamCorrectionHost = ({
  task,
  queueIndex,
  queueLength,
  maxPoints,
  partStates,
  submitted,
  showSourceBadge = true,
  canGoBack,
  canGoNext,
  helpEnabled = false,
  vaultPath,
  vaultPngAssets,
  onOptionSelect,
  onTrueFalseSelect,
  onClozeInputChange,
  onClozeTokenDrop,
  onClozeTokenRemove,
  onTextInputChange,
  onSubmit,
  onBack,
  onNext,
  onBackToResults,
}: ExamCorrectionHostProps) => {
  if (!task) {
    return (
      <section className="panel correction-panel">
        <div className="empty-state">No incorrect cards available.</div>
      </section>
    );
  }

  return (
    <section className="panel correction-panel">
      <header className="correction-panel-header">
        <div>
          <p className="eyebrow">CORRECTION</p>
          <h2>
            Card {queueIndex + 1} of {queueLength}
          </h2>
          <p className="muted">Practice only. This does not change your exam score.</p>
          <p className="muted">Max points: {maxPoints}</p>
          {showSourceBadge ? (
            <span className="exam-task-source-badge">Quelle: {task.sourceTitle}</span>
          ) : null}
        </div>
        <div className="exam-task-header-actions">
          <button type="button" className="ghost small" onClick={onBackToResults}>
            Back to Results
          </button>
        </div>
      </header>

      <div className="exam-correction-banner">
        <strong>Correction Mode</strong>
        <span className="muted">Work through incorrect cards again with fresh answers.</span>
      </div>

      <div className="flashcard-list">
        {task.media?.length ? (
          <FlashcardMediaGroup
            media={task.media}
            vaultPngAssets={vaultPngAssets}
            vaultPath={vaultPath}
          />
        ) : null}
        <CompositeCard
          card={task.card}
          cardIndex={queueIndex}
          submitted={submitted}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          partStates={partStates}
          revealCorrectness={submitted}
          showSolution={submitted}
          forceRevealText={submitted}
          helpText={task.helpText}
          helpEnabled={helpEnabled}
          onOptionSelect={(_taskIndex, partIndex, keys) =>
            onOptionSelect(task.sessionTaskId, partIndex, keys)
          }
          onTrueFalseSelect={(_taskIndex, partIndex, itemId, value) =>
            onTrueFalseSelect(task.sessionTaskId, partIndex, itemId, value)
          }
          onClozeInputChange={(_taskIndex, partIndex, blankId, value) =>
            onClozeInputChange(task.sessionTaskId, partIndex, blankId, value)
          }
          onClozeTokenDrop={(event, _taskIndex, partIndex, blankId, validTokenIds, dragBlankIds) =>
            onClozeTokenDrop(
              event,
              task.sessionTaskId,
              partIndex,
              blankId,
              validTokenIds,
              dragBlankIds,
            )
          }
          onClozeTokenRemove={(_taskIndex, partIndex, blankId) =>
            onClozeTokenRemove(task.sessionTaskId, partIndex, blankId)
          }
          onClozeTokenDragStart={handleClozeTokenDragStart}
          onBlankDragOver={handleClozeBlankDragOver}
          onTextInputChange={(_taskIndex, partIndex, value) =>
            onTextInputChange(task.sessionTaskId, partIndex, value)
          }
          onTextCheck={noopTextCheck}
          onSelfGrade={noopSelfGrade}
          onSubmit={(_taskIndex, canSubmit) => onSubmit(task.sessionTaskId, canSubmit)}
        />
      </div>

      <div className="flashcard-pagination correction-pagination">
        <button type="button" className="ghost small" onClick={onBack} disabled={!canGoBack}>
          Previous
        </button>
        <button type="button" className="ghost small" onClick={onNext} disabled={!canGoNext}>
          Next
        </button>
      </div>
    </section>
  );
};
