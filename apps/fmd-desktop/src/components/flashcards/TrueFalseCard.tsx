import { type TrueFalseCard as TrueFalseCardType } from "../../lib/flashcards";
import {
  areTrueFalseItemsComplete,
  isTrueFalseCardCorrect,
  type TrueFalseSelection,
} from "../../features/flashcards/logic";

type TrueFalseCardProps = {
  card: TrueFalseCardType;
  cardIndex: number;
  submitted: boolean;
  selections: Record<string, TrueFalseSelection>;
  onSelect: (cardIndex: number, itemId: string, value: TrueFalseSelection) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const TrueFalseCard = ({
  card,
  cardIndex,
  submitted,
  selections,
  onSelect,
  onSubmit,
}: TrueFalseCardProps) => {
  const canSubmit = areTrueFalseItemsComplete(card, selections);
  const isCorrect = isTrueFalseCardCorrect(card, selections);
  const resultLabel = submitted ? (isCorrect ? "Correct" : "Incorrect") : "";

  return (
    <article className="flashcard-item truefalse-card">
      <h3 className="flashcard-question">True/False</h3>
      <ul className="truefalse-list">
        {card.items.map((item) => {
          const selected = selections[item.id];
          const isItemCorrect = submitted && selected === item.correct;
          const isItemIncorrect = submitted && selected && selected !== item.correct;
          const trueClasses = [
            "truefalse-option",
            selected === "wahr" ? "selected" : "",
            submitted && item.correct === "wahr" ? "correct" : "",
            submitted && selected === "wahr" && isItemIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const falseClasses = [
            "truefalse-option",
            selected === "falsch" ? "selected" : "",
            submitted && item.correct === "falsch" ? "correct" : "",
            submitted && selected === "falsch" && isItemIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={item.id} className="truefalse-item">
              <div className="truefalse-question">{item.question}</div>
              <div className="truefalse-options">
                <button
                  type="button"
                  className={trueClasses}
                  onClick={() => onSelect(cardIndex, item.id, "wahr")}
                  aria-pressed={selected === "wahr"}
                  disabled={submitted}
                >
                  True
                </button>
                <button
                  type="button"
                  className={falseClasses}
                  onClick={() => onSelect(cardIndex, item.id, "falsch")}
                  aria-pressed={selected === "falsch"}
                  disabled={submitted}
                >
                  False
                </button>
              </div>
              {submitted ? (
                <span
                  className={`truefalse-result ${
                    isItemCorrect ? "correct" : "incorrect"
                  }`}
                >
                  {isItemCorrect ? "Correct" : "Incorrect"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flashcard-actions">
        <button
          type="button"
          className="ghost small flashcard-submit"
          onClick={() => onSubmit(cardIndex, canSubmit)}
          disabled={submitted || !canSubmit}
        >
          Submit
        </button>
        {submitted ? (
          <span className={`flashcard-result ${isCorrect ? "correct" : "incorrect"}`}>
            {resultLabel}
          </span>
        ) : null}
      </div>
      {submitted ? (
        <div className="truefalse-solution">
          <span className="label">Solution</span>
          <ul className="truefalse-solution-list">
            {card.items.map((item) => (
              <li key={`solution-${item.id}`} className="truefalse-solution-item">
                <span>{item.question}</span>
                <span className="truefalse-solution-answer">
                  {item.correct === "wahr" ? "True" : "False"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
};
