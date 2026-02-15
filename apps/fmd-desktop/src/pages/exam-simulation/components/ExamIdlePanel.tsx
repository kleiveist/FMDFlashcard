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
import type { MissingExamSetting } from "../../../features/settings/validateExamSettings";

type ExamEmptyState = {
  title: string;
  message: string;
};

type ExamIdlePanelProps = {
  selectedCount: number;
  previewState: LoadState;
  previewError: string;
  examEmptyState: ExamEmptyState | null;
  availableTaskCount: number;
  plannedTaskCount: number;
  plannedMaxPoints: number;
  hasTaskCountMismatch: boolean;
  sessionInvalidationMessage?: string;
  onStartExam: () => void;
  startDisabled: boolean;
  missingSettings: MissingExamSetting[];
  onOpenExamSettings: () => void;
};

export const ExamIdlePanel = ({
  selectedCount,
  previewState,
  previewError,
  examEmptyState,
  availableTaskCount,
  plannedTaskCount,
  plannedMaxPoints,
  hasTaskCountMismatch,
  sessionInvalidationMessage,
  onStartExam,
  startDisabled,
  missingSettings,
  onOpenExamSettings,
}: ExamIdlePanelProps) => {
  const isReadyDisabled = startDisabled;
  const hasBlockingMissing =
    missingSettings.length > 0 &&
    missingSettings.some((item) => item.severity !== "warning");
  if (selectedCount === 0) {
    return (
      <div className="empty-state">
        Waehle mindestens eine Exam-Datei, um zu starten.
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
      </div>
      <p className="muted">
        {availableTaskCount} tasks detected. Max points this run: {plannedMaxPoints}.
      </p>
      {sessionInvalidationMessage ? (
        <p className="exam-session-invalidated">{sessionInvalidationMessage}</p>
      ) : null}
      {hasTaskCountMismatch ? (
        <p className="muted">
          Only {availableTaskCount} tasks available. The exam will run {plannedTaskCount}.
        </p>
      ) : null}
      {isReadyDisabled && hasBlockingMissing ? (
        <div className="exam-start-blocked">
          <div className="exam-start-blocked-header">
            <strong>Exam kann nicht gestartet werden</strong>
            <p className="muted">Bitte ergaenze die folgenden Einstellungen.</p>
          </div>
          <div className="exam-start-blocked-list">
            <span className="label">Fehlende Einstellungen</span>
            <ul className="exam-missing-settings-list">
              {missingSettings.map((item) => (
                <li key={item.id} className="exam-missing-settings-item">
                  <span className="exam-missing-settings-dot" aria-hidden="true">
                    •
                  </span>
                  <div className="exam-missing-settings-content">
                    <span className="exam-missing-settings-label">{item.label}</span>
                    {item.description ? (
                      <span className="muted">{item.description}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="primary small"
            onClick={onOpenExamSettings}
          >
            Exam Settings oeffnen
          </button>
        </div>
      ) : null}
    </div>
  );
};
