import { type MultipleChoiceCard as MultipleChoiceCardType } from "../../lib/flashcards";

type MultipleChoiceCardProps = {
  card: MultipleChoiceCardType;
  cardIndex: number;
  submitted: boolean;
  selectedKey: string;
  onSelect: (cardIndex: number, key: string) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const MultipleChoiceCard = ({
  card,
  cardIndex,
  submitted,
  selectedKey,
  onSelect,
  onSubmit,
}: MultipleChoiceCardProps) => {
  const hasSolutions = card.correctKeys.length > 0;
  const selectionIsCorrect =
    hasSolutions && selectedKey ? card.correctKeys.includes(selectedKey) : false;
  const resultLabel = submitted
    ? hasSolutions
      ? selectionIsCorrect
        ? "Correct"
        : "Incorrect"
      : "No solution defined"
    : "";

  return (
    <article className="flashcard-item">
      <h3 className="flashcard-question">{card.question}</h3>
      <ul className="flashcard-options">
        {card.options.map((option) => {
          const isSelected = selectedKey === option.key;
          const isCorrect = hasSolutions && card.correctKeys.includes(option.key);
          const isIncorrect = hasSolutions && submitted && isSelected && !isCorrect;
          const optionClasses = [
            "flashcard-option",
            isSelected ? "selected" : "",
            submitted && isCorrect ? "correct" : "",
            isIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={`flashcard-${cardIndex}-${option.key}`}>
              <button
                type="button"
                className={optionClasses}
                onClick={() => onSelect(cardIndex, option.key)}
                disabled={submitted}
                aria-pressed={isSelected}
              >
                <span className="flashcard-key">{option.key}</span>
                <span className="flashcard-text">{option.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flashcard-actions">
        <button
          type="button"
          className="ghost small flashcard-submit"
          onClick={() => onSubmit(cardIndex, Boolean(selectedKey))}
          disabled={!selectedKey || submitted}
        >
          Submit
        </button>
        {submitted ? (
          <span
            className={`flashcard-result ${
              hasSolutions ? (selectionIsCorrect ? "correct" : "incorrect") : "neutral"
            }`}
          >
            {resultLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
};
