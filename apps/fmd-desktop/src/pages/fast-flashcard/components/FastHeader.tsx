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

type FastHeaderProps = {
  hasScannedCards: boolean;
};

export const FastHeader = ({ hasScannedCards }: FastHeaderProps) => (
  <div className="panel-header">
    <div>
      <h2>Flashcard</h2>
      {!hasScannedCards ? (
        <p className="muted">{fastFlashcardStatusLabel}</p>
      ) : null}
    </div>
  </div>
);
