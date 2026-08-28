/**
 * @file apps/fmd-desktop/src/pages/fast-flashcard/components/FastHeader.tsx
 *
 * Zweck:
 * - Rendert die Seite Fast Header.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/fast-flashcard/FastFlashcardPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - FastHeader: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { fastFlashcardStatusLabel } from "../hooks/useFastSession";
import type { StudySectionKey } from "../../../lib/studySections";

type FastHeaderProps = {
  hasScannedCards: boolean;
  isViewMode: boolean;
  onToggleView: () => void;
  viewLabel: string;
  onSectionSelect?: (section: StudySectionKey) => void;
  isTimeModeEnabled?: boolean;
  onTimeToggle?: () => void;
  showTimeToggle?: boolean;
};

export const FastHeader = ({
  hasScannedCards,
  isViewMode,
  onToggleView,
  viewLabel,
  onSectionSelect,
  isTimeModeEnabled,
  onTimeToggle,
  showTimeToggle = false,
}: FastHeaderProps) => (
  <div className="panel-header">
    <div>
      <h2>
        <button
          type="button"
          className="panel-title-button"
          onClick={() => onSectionSelect?.("fast-flashcard")}
        >
          Flashcard
        </button>
      </h2>
      {!hasScannedCards ? (
        <p className="muted">{fastFlashcardStatusLabel}</p>
      ) : null}
    </div>
    <div className="panel-actions">
      {showTimeToggle && onTimeToggle ? (
        <button
          type="button"
          className={`timer-start-button ${isTimeModeEnabled ? "active" : ""}`}
          onClick={onTimeToggle}
          aria-pressed={Boolean(isTimeModeEnabled)}
        >
          <span className="timer-start-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="7.5" />
              <path d="M12 7.5v4.4l2.8 1.8" />
            </svg>
          </span>
          <span className="timer-start-text">
            <span className="timer-start-meta">Time</span>
            <span className="timer-start-action">
              {isTimeModeEnabled ? "Stop" : "Start"}
            </span>
          </span>
        </button>
      ) : null}
      <button
        type="button"
        className={`focus-toggle ${isViewMode ? "active" : ""}`}
        onClick={onToggleView}
        aria-pressed={isViewMode}
        aria-label={viewLabel}
        title={viewLabel}
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
  </div>
);
