/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/components/SrReviewActions.tsx
 *
 * Zweck:
 * - Rendert die Seite Sr Review Actions.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrCardHost.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - SrReviewActions: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

type SrReviewActionsProps = {
  spacedRepetitionCanGoBack: boolean;
  spacedRepetitionCanGoNext: boolean;
  handleSpacedRepetitionPageBack: () => void;
  handleSpacedRepetitionPageNext: () => void;
};

export const SrReviewActions = ({
  spacedRepetitionCanGoBack,
  spacedRepetitionCanGoNext,
  handleSpacedRepetitionPageBack,
  handleSpacedRepetitionPageNext,
}: SrReviewActionsProps) => (
  <div className="flashcard-pagination">
    <button
      type="button"
      className="ghost small"
      onClick={handleSpacedRepetitionPageBack}
      disabled={!spacedRepetitionCanGoBack}
    >
      Back
    </button>
    <button
      type="button"
      className="ghost small"
      onClick={handleSpacedRepetitionPageNext}
      disabled={!spacedRepetitionCanGoNext}
    >
      Next
    </button>
  </div>
);
