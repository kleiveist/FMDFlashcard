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
