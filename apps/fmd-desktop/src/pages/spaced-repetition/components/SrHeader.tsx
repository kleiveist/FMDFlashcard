/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/components/SrHeader.tsx
 *
 * Zweck:
 * - Rendert die Seite Sr Header.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/spaced-repetition/SpacedRepetitionPage.tsx: Nutzt dieses Modul.
 * - react: React-API.
 *
 * Exportiert:
 * - SrHeader: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import type { Dispatch, SetStateAction } from "react";

type SrHeaderProps = {
  spacedRepetitionStatusLabel: string;
  isFocusMode: boolean;
  focusLabel: string;
  setIsFocusMode: Dispatch<SetStateAction<boolean>>;
};

export const SrHeader = ({
  spacedRepetitionStatusLabel,
  isFocusMode,
  focusLabel,
  setIsFocusMode,
}: SrHeaderProps) => (
  <div className="panel-header">
    <div>
      <h2>Flashcard</h2>
      <p className="muted">{spacedRepetitionStatusLabel}</p>
    </div>
    <div className="panel-actions">
      <button
        type="button"
        className={`focus-toggle ${isFocusMode ? "active" : ""}`}
        onClick={() => setIsFocusMode((prev) => !prev)}
        aria-pressed={isFocusMode}
        aria-label={focusLabel}
        title={focusLabel}
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
