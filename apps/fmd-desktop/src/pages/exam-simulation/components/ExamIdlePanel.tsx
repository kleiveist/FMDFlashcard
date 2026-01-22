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
