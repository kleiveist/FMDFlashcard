import type { FreeTextCard as FreeTextCardType } from "../../lib/flashcards";
import type { FlashcardSelfGrade } from "../../features/flashcards/logic";

type FreeTextCardProps = {
  card: FreeTextCardType;
  cardIndex: number;
  submitted: boolean;
  response: string;
  revealed: boolean;
  selfGrade?: FlashcardSelfGrade;
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
      <div className="flashcard-text-block">{card.front}</div>
      <textarea
        className="flashcard-input"
        value={response}
        onChange={(event) => onInputChange(cardIndex, event.target.value)}
        placeholder="Your answer"
        aria-label="Your answer"
        disabled={submitted || revealed}
      />
      <div className="flashcard-actions">
        {!revealed ? (
          <button
            type="button"
            className="ghost small flashcard-submit"
            onClick={() => onCheck(cardIndex)}
            disabled={!hasInput || submitted}
          >
            Check
          </button>
        ) : (
          <>
            <button
              type="button"
              className="primary small flashcard-submit"
              onClick={() => onSelfGrade(cardIndex, "correct")}
              disabled={submitted}
            >
              Correct
            </button>
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSelfGrade(cardIndex, "incorrect")}
              disabled={submitted}
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
      {revealed ? (
        <div className="flashcard-answer">
          <span className="label">Answer</span>
          <div className="flashcard-answer-text">{card.back}</div>
        </div>
      ) : null}
    </article>
  );
};
