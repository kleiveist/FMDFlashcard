/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamResultsPanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam Results Panel.
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
 * - ExamResultsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useMemo, useState, type DragEvent } from "react";
import { ModalShell } from "../../../components/ModalShell";
import type { CompositePartState, TrueFalseSelection } from "../../../features/flashcards/logic";
import { ExamTaskRunner } from "./ExamTaskRunner";
import type { ExamSessionTask } from "../../../lib/examMixedSession";

type ExamTaskBreakdown = {
  index: number;
  sessionTaskId: string;
  sourceTitle: string;
  originalTaskNumber: number;
  awardedPoints: number;
  maxPoints: number;
  isCorrect: boolean | null;
  detail: {
    task: ExamSessionTask;
    partStates: CompositePartState[];
    awardedPoints: number | null;
    autoGradeDecision?: boolean;
    conversionDecision?: boolean;
  };
};

type ExamResults = {
  breakdown: ExamTaskBreakdown[];
  totalAwarded: number;
  totalMax: number;
  percentage: number;
};

type ExamResultsPanelProps = {
  results: ExamResults;
  helpEnabled?: boolean;
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
const noopAwardedPointsChange = (
  _taskIndex: number,
  _value: string,
  _maxPoints: number,
) => {};
const noopAutoGradeDecision = (_taskIndex: number, _decision: boolean) => {};
const noopConversionDecision = (_taskIndex: number, _shouldConvert: boolean) => {};
const noopNav = () => {};

export const ExamResultsPanel = ({
  results,
  helpEnabled = false,
}: ExamResultsPanelProps) => {
  const [selectedTaskSessionId, setSelectedTaskSessionId] = useState<string | null>(null);
  const selectedBreakdownItem = useMemo(
    () =>
      selectedTaskSessionId
        ? (results.breakdown.find((item) => item.sessionTaskId === selectedTaskSessionId) ?? null)
        : null,
    [results.breakdown, selectedTaskSessionId],
  );

  return (
    <div className="exam-results">
      <header className="exam-task-header">
        <div>
          <p className="eyebrow">RESULTS</p>
          <h2>Exam results</h2>
          <p className="muted">Final score and per-task breakdown.</p>
        </div>
      </header>

      <div className="exam-results-summary">
        <div className="exam-results-score">
          <span className="value">{results.totalAwarded}</span>
          <span className="muted">/ {results.totalMax} points</span>
        </div>
        <div className="exam-results-percent">{results.percentage}%</div>
      </div>

      <div className="status-list">
        {results.breakdown.map((item) => {
          const showCorrectness = item.isCorrect !== null;
          return (
            <button
              key={item.sessionTaskId}
              type="button"
              className="status-item exam-results-task-trigger"
              onClick={() => setSelectedTaskSessionId(item.sessionTaskId)}
              aria-haspopup="dialog"
              aria-label={`Open result details for task ${item.index}`}
            >
              <div className="status-row">
                <span>Task {item.index}</span>
                <span>
                  {item.awardedPoints} / {item.maxPoints}
                </span>
              </div>
              <div className="muted">
                Quelle: {item.sourceTitle} (#{item.originalTaskNumber})
              </div>
              {showCorrectness ? (
                <div className="muted">
                  {item.isCorrect ? "Correct" : "Incorrect"}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <ModalShell
        isOpen={Boolean(selectedBreakdownItem)}
        title={
          selectedBreakdownItem
            ? `Task ${selectedBreakdownItem.index} Result`
            : "Task Result"
        }
        onClose={() => setSelectedTaskSessionId(null)}
        className="exam-results-task-modal-panel"
        bodyClassName="exam-results-task-modal-body"
      >
        {selectedBreakdownItem ? (
          <div className="exam-results-task-modal-scroll">
            <ExamTaskRunner
              task={selectedBreakdownItem.detail.task}
              taskIndex={selectedBreakdownItem.index - 1}
              taskCount={results.breakdown.length}
              maxPoints={selectedBreakdownItem.maxPoints}
              phase="scoring"
              partStates={selectedBreakdownItem.detail.partStates}
              awardedPoints={selectedBreakdownItem.detail.awardedPoints}
              autoGradeDecision={selectedBreakdownItem.detail.autoGradeDecision}
              conversionDecision={selectedBreakdownItem.detail.conversionDecision}
              conversionPending={false}
              conversionError=""
              onOptionSelect={noopOptionSelect}
              onTrueFalseSelect={noopTrueFalseSelect}
              onClozeInputChange={noopClozeInputChange}
              onClozeTokenDrop={noopClozeTokenDrop}
              onClozeTokenRemove={noopClozeTokenRemove}
              onClozeTokenDragStart={noopClozeTokenDragStart}
              onBlankDragOver={noopBlankDragOver}
              onTextInputChange={noopTextInputChange}
              onAwardedPointsChange={noopAwardedPointsChange}
              onAutoGradeDecision={noopAutoGradeDecision}
              onConversionDecision={noopConversionDecision}
              onBack={noopNav}
              onNext={noopNav}
              canGoBack={false}
              canGoNext={false}
              helpEnabled={helpEnabled}
              showNavigation={false}
              scoringReadOnly
              showConversionControls={false}
            />
          </div>
        ) : null}
      </ModalShell>
    </div>
  );
};
