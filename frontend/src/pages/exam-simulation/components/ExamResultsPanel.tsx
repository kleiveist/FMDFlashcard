/**
 * @file frontend/src/pages/exam-simulation/components/ExamResultsPanel.tsx
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
 * - frontend/src/pages/exam-simulation/ExamSimulationPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - ExamResultsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useMemo, useState, type DragEvent } from "react";
import { ModalShell } from "../../../components/ModalShell";
import type { TrueFalseSelection } from "../../../features/flashcards/logic";
import { ExamTaskRunner } from "./ExamTaskRunner";
import type { ExamSessionTask } from "../../../lib/examMixedSession";
import type { ExamResults } from "../examSimulationTypes";
import type { VaultPngAsset } from "../../../lib/tree";

type ExamResultsPanelProps = {
  results: ExamResults;
  helpEnabled?: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  correctionAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
  } | null;
  onToggleTaskCardWrapper: (sessionTaskId: string, nextWrapped: boolean) => void;
  taskCardWrapPendingById: Record<string, boolean>;
  taskCardWrapErrorById: Record<string, string>;
  taskCardWrapNoticeById?: Record<string, string>;
  getTaskCardWrapDisabledReason: (task: ExamSessionTask) => string;
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
const noopNav = () => {};

export const ExamResultsPanel = ({
  results,
  helpEnabled = false,
  vaultPath,
  vaultPngAssets,
  correctionAction = null,
  onToggleTaskCardWrapper,
  taskCardWrapPendingById,
  taskCardWrapErrorById,
  taskCardWrapNoticeById = {},
  getTaskCardWrapDisabledReason,
}: ExamResultsPanelProps) => {
  const [selectedTaskSessionId, setSelectedTaskSessionId] = useState<string | null>(null);
  const selectedBreakdownItem = useMemo(
    () =>
      selectedTaskSessionId
        ? (results.breakdown.find((item) => item.sessionTaskId === selectedTaskSessionId) ?? null)
        : null,
    [results.breakdown, selectedTaskSessionId],
  );
  const selectedTask = selectedBreakdownItem?.detail.task ?? null;
  const selectedSessionTaskId = selectedBreakdownItem?.sessionTaskId ?? null;
  const selectedTogglePending = selectedSessionTaskId
    ? (taskCardWrapPendingById[selectedSessionTaskId] ?? false)
    : false;
  const selectedToggleError = selectedSessionTaskId
    ? (taskCardWrapErrorById[selectedSessionTaskId] ?? "")
    : "";
  const selectedToggleNotice = selectedSessionTaskId
    ? (taskCardWrapNoticeById[selectedSessionTaskId] ?? "")
    : "";
  const selectedToggleDisabledReason = selectedTask
    ? getTaskCardWrapDisabledReason(selectedTask)
    : "";
  const selectedToggleDisabled = selectedTogglePending || Boolean(selectedToggleDisabledReason);

  return (
    <div className="exam-results">
      <header className="exam-task-header">
        <div>
          <p className="eyebrow">RESULTS</p>
          <h2>Exam results</h2>
          <p className="muted">Current score and per-task breakdown.</p>
        </div>
        {correctionAction ? (
          <div className="exam-task-header-actions">
            <button
              type="button"
              className="primary small"
              onClick={correctionAction.onClick}
              disabled={correctionAction.disabled}
              title={correctionAction.title}
            >
              {correctionAction.label}
            </button>
          </div>
        ) : null}
      </header>

      <div className="exam-results-summary">
        <div className="exam-results-summary-group">
          <span className="label">Score</span>
          <div className="exam-results-score">
            <span className="value">{results.totalAwarded}</span>
            <span className="muted">/ {results.totalMax} points</span>
          </div>
          <div className="exam-results-percent">{results.percentage}%</div>
        </div>
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
                <div className="exam-results-task-scores">
                  <span>
                    {item.awardedPoints} / {item.maxPoints}
                  </span>
                </div>
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
        headerActions={
          selectedBreakdownItem && selectedTask ? (
            <div className="exam-results-task-modal-toolbar">
              <div className="field exam-results-task-card-wrapper-field">
                <span className="label">Card wrapper</span>
                <label className="choice-row">
                  <span className="switch">
                    <input
                      type="checkbox"
                      checked={selectedTask.cardWrapper}
                      disabled={selectedToggleDisabled}
                      onChange={(event) =>
                        onToggleTaskCardWrapper(
                          selectedBreakdownItem.sessionTaskId,
                          event.target.checked,
                        )
                      }
                      aria-label="Wrap task in #card block"
                    />
                    <span className="slider" />
                  </span>
                  <span>
                    Wrap task in <code>#card</code> block
                  </span>
                </label>
                <span className="muted small">
                  Applies to the full task, including all parts.
                </span>
              </div>
              {selectedTogglePending ? (
                <span className="muted small">Saving...</span>
              ) : null}
            </div>
          ) : null
        }
      >
        {selectedBreakdownItem ? (
          <div className="exam-results-task-modal-scroll">
            {selectedToggleDisabledReason ? (
              <div className="muted exam-results-task-modal-note">
                {selectedToggleDisabledReason}
              </div>
            ) : null}
            {selectedToggleError ? (
              <div className="error">{selectedToggleError}</div>
            ) : null}
            {!selectedToggleError && selectedToggleNotice ? (
              <div className="muted exam-results-task-modal-note">
                {selectedToggleNotice}
              </div>
            ) : null}
            <ExamTaskRunner
              task={selectedBreakdownItem.detail.task}
              taskIndex={selectedBreakdownItem.index - 1}
              taskCount={results.breakdown.length}
              maxPoints={selectedBreakdownItem.maxPoints}
              phase="scoring"
              partStates={selectedBreakdownItem.detail.partStates}
              awardedPoints={selectedBreakdownItem.detail.awardedPoints}
              autoGradeDecision={selectedBreakdownItem.detail.autoGradeDecision}
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
              onBack={noopNav}
              onNext={noopNav}
              canGoBack={false}
              canGoNext={false}
              helpEnabled={helpEnabled}
              showNavigation={false}
              scoringReadOnly
              vaultPath={vaultPath}
              vaultPngAssets={vaultPngAssets}
            />
          </div>
        ) : null}
      </ModalShell>
    </div>
  );
};
