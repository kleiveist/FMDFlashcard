/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamIdlePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam Idle Panel.
 */

import type { LoadState } from "../../../lib/types";
import type { MissingExamSetting } from "../../../features/settings/validateExamSettings";
import type { ReactNode } from "react";

type ExamEmptyState = {
  title: string;
  message: string;
};

type ExamIdlePanelProps = {
  selectedCount: number;
  previewState: LoadState;
  previewError: string;
  examEmptyState: ExamEmptyState | null;
  missingSettings: MissingExamSetting[];
  onOpenExamSettings: () => void;
};

export const ExamIdlePanel = ({
  selectedCount,
  previewState,
  previewError,
  examEmptyState,
  missingSettings,
  onOpenExamSettings,
}: ExamIdlePanelProps) => {
  const renderSetupPanel = (content: ReactNode) => (
    <div className="exam-idle exam-idle-steps">
      <div className="exam-idle-header">
        <p className="eyebrow">SETUP</p>
      </div>
      <section className="exam-step-panel">{content}</section>
    </div>
  );

  const hasBlockingMissing =
    missingSettings.length > 0 &&
    missingSettings.some((item) => item.severity !== "warning");

  if (selectedCount === 0) {
    return renderSetupPanel(
      <div className="empty-state">
        <p>Waehle mindestens eine Exam-Datei im Dateipanel.</p>
      </div>
    );
  }

  if (previewState === "loading") {
    return renderSetupPanel(
      <div className="empty-state">Lade ausgewaehlte Exam-Dateien...</div>,
    );
  }

  if (previewState === "error") {
    return renderSetupPanel(
      <div className="error">{previewError || "Dateien konnten nicht geladen werden."}</div>,
    );
  }

  if (examEmptyState) {
    return renderSetupPanel(
      <div className="empty-state">
        <strong>{examEmptyState.title}</strong>
        <p>{examEmptyState.message}</p>
      </div>,
    );
  }

  return (
    <div className="exam-idle exam-idle-steps">
      <div className="exam-idle-header">
        <p className="eyebrow">SETUP</p>
      </div>

      {hasBlockingMissing ? (
        <section className="exam-step-panel">
          <h3>Exam start blocked</h3>
          <div className="exam-start-blocked">
            <div className="exam-start-blocked-header">
              <strong>Exam kann nicht gestartet werden</strong>
              <p className="muted">Bitte korrigiere die folgenden Punkte.</p>
            </div>
            <div className="exam-start-blocked-list">
              <span className="label">Blockierende Einstellungen</span>
              <ul className="exam-missing-settings-list">
                {missingSettings.map((item) => (
                  <li key={item.id} className="exam-missing-settings-item">
                    <span className="exam-missing-settings-dot" aria-hidden="true">
                      •
                    </span>
                    <div className="exam-missing-settings-content">
                      <span className="exam-missing-settings-label">{item.label}</span>
                      {item.description ? <span className="muted">{item.description}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className="ghost small" onClick={onOpenExamSettings}>
              Exam Settings oeffnen
            </button>
          </div>
        </section>
      ) : (
        <section className="exam-step-panel">
          <h3>Ready</h3>
          <p className="muted">Use "Exam starten" in the toolbar to begin the run.</p>
        </section>
      )}
    </div>
  );
};
