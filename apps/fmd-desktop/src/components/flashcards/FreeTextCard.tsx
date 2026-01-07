/**
 * @file apps/fmd-desktop/src/components/flashcards/FreeTextCard.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Free Text Card.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcards.ts: Typen.
 * - apps/fmd-desktop/src/features/flashcards/logic.ts: Typen.
 *
 * Exportiert:
 * - FreeTextCard: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import type { FreeTextCard as FreeTextCardType } from "../../lib/flashcards";
import type { FlashcardSelfGrade } from "../../features/flashcards/logic";

type FreeTextCardProps = {
  card: FreeTextCardType;
  cardIndex: number;
  submitted: boolean;
  response: string;
  revealed: boolean;
  selfGrade?: FlashcardSelfGrade;
  submissionLocked?: boolean;
  showActions?: boolean;
  onInputChange: (cardIndex: number, value: string) => void;
  onCheck: (cardIndex: number) => void;
  onSelfGrade: (cardIndex: number, grade: FlashcardSelfGrade) => void;
};

export const FreeTextCard = ({
  card,
  cardIndex,
  submitted,
  response,
  revealed,
  selfGrade,
  submissionLocked = false,
  showActions = true,
  onInputChange,
  onCheck,
  onSelfGrade,
}: FreeTextCardProps) => {
  const hasInput = response.trim().length > 0;
  const resultLabel = submitted
    ? selfGrade === "correct"
      ? "Correct"
      : "Incorrect"
    : "";

  return (
    <article className="flashcard-item free-text-card">
      {card.front.trim() ? (
        <div className="flashcard-text-block">{card.front}</div>
      ) : null}
      <textarea
        className="flashcard-input"
        value={response}
        onChange={(event) => onInputChange(cardIndex, event.target.value)}
        placeholder="Your answer"
        aria-label="Your answer"
        disabled={submitted || revealed}
      />
      {showActions ? (
        <div className="flashcard-actions">
          {!revealed ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onCheck(cardIndex)}
              disabled={!hasInput || submitted || submissionLocked}
            >
              Check
            </button>
          ) : (
            <>
              <button
                type="button"
                className="primary small flashcard-submit"
                onClick={() => onSelfGrade(cardIndex, "correct")}
                disabled={submitted || submissionLocked}
              >
                Correct
              </button>
              <button
                type="button"
                className="ghost small flashcard-submit"
                onClick={() => onSelfGrade(cardIndex, "incorrect")}
                disabled={submitted || submissionLocked}
              >
                Incorrect
              </button>
            </>
          )}
          {submitted ? (
            <span
              className={`flashcard-result ${
                selfGrade === "correct" ? "correct" : "incorrect"
              }`}
            >
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {revealed ? (
        <div className="flashcard-answer">
          <span className="label">Answer</span>
          <div className="flashcard-answer-text">{card.back}</div>
        </div>
      ) : null}
    </article>
  );
};
