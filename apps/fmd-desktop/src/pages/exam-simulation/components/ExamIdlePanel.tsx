/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamIdlePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam Idle Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - ExamIdlePanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import type { LoadState } from "../../../lib/types";
import type { VaultFile } from "../../../lib/tree";

type ExamEmptyState = {
  title: string;
  message: string;
};

type ExamIdlePanelProps = {
  selectedFile: VaultFile | null;
  previewState: LoadState;
  previewError: string;
  examEmptyState: ExamEmptyState | null;
  availableTaskCount: number;
  plannedTaskCount: number;
  plannedMaxPoints: number;
  hasTaskCountMismatch: boolean;
  onStartExam: () => void;
  startDisabled: boolean;
  onToggleView: () => void;
  viewToggleDisabled: boolean;
  isViewMode: boolean;
  viewLabel: string;
};

export const ExamIdlePanel = ({
  selectedFile,
  previewState,
  previewError,
  examEmptyState,
  availableTaskCount,
  plannedTaskCount,
  plannedMaxPoints,
  hasTaskCountMismatch,
  onStartExam,
  startDisabled,
  onToggleView,
  viewToggleDisabled,
  isViewMode,
  viewLabel,
}: ExamIdlePanelProps) => {
  const isReadyDisabled = startDisabled;
  if (!selectedFile) {
    return (
      <div className="empty-state">
        Select an exam file to begin.
      </div>
    );
  }

  if (previewState === "loading") {
    return <div className="empty-state">Loading exam file...</div>;
  }

  if (previewState === "error") {
    return <div className="error">{previewError || "Failed to load file."}</div>;
  }

  if (examEmptyState) {
    return (
      <div className="empty-state">
        <strong>{examEmptyState.title}</strong>
        <p>{examEmptyState.message}</p>
      </div>
    );
  }

  return (
    <div className="exam-idle">
      <div className="exam-idle-header">
        <p className="eyebrow">READY</p>
      </div>
      <div className="exam-ready-header">
        <h2>
          <button
            type="button"
            className="panel-title-button"
            onClick={onStartExam}
            disabled={isReadyDisabled}
          >
            Exam ready to start
          </button>
        </h2>
        <button
          type="button"
          className={`focus-toggle ${isViewMode ? "active" : ""}`}
          onClick={onToggleView}
          aria-pressed={isViewMode}
          aria-label={viewLabel}
          title={viewLabel}
          disabled={viewToggleDisabled}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
        </button>
      </div>
      <p className="muted">
        {availableTaskCount} tasks detected. Max points this run: {plannedMaxPoints}.
      </p>
      {hasTaskCountMismatch ? (
        <p className="muted">
          Only {availableTaskCount} tasks available. The exam will run {plannedTaskCount}.
        </p>
      ) : null}
    </div>
  );
};
