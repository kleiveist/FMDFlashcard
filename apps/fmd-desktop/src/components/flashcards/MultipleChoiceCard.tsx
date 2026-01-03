import { useMemo } from "react";
import { type MultipleChoiceCard as MultipleChoiceCardType } from "../../lib/flashcards";

const OPTION_LABELS = "abcdefghijklmnopqrstuvwxyz";

const indexToLabel = (index: number) => {
  let label = "";
  let cursor = index;
  do {
    label = OPTION_LABELS[cursor % 26] + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);
  return label;
};

const shuffleOptions = <T,>(options: T[]) => {
  const copy = [...options];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const isExactKeyMatch = (selected: string[], correct: string[]) => {
  if (selected.length !== correct.length) {
    return false;
  }
  const selectedSet = new Set(selected);
  if (selectedSet.size !== correct.length) {
    return false;
  }
  return correct.every((key) => selectedSet.has(key));
};

type MultipleChoiceCardProps = {
  card: MultipleChoiceCardType;
  cardIndex: number;
  submitted: boolean;
  selectedKeys: string[];
  onSelect: (cardIndex: number, keys: string[]) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const MultipleChoiceCard = ({
  card,
  cardIndex,
  submitted,
  selectedKeys,
  onSelect,
  onSubmit,
}: MultipleChoiceCardProps) => {
  const hasSolutions = card.correctKeys.length > 0;
  const isMultiSelect = card.correctKeys.length > 1;
  const selectionIsCorrect =
    hasSolutions && selectedKeys.length > 0
      ? isExactKeyMatch(selectedKeys, card.correctKeys)
      : false;
  const resultLabel = submitted
    ? hasSolutions
      ? selectionIsCorrect
        ? "Correct"
        : "Incorrect"
      : "No solution defined"
    : "";

  const cardSignature = useMemo(() => {
    const optionsSignature = card.options
      .map((option) => `${option.key}:${option.text}`)
      .join("|");
    return [card.question, card.correctKeys.join(","), optionsSignature].join("::");
  }, [card.question, card.correctKeys, card.options]);

  const displayOptions = useMemo(
    () =>
      shuffleOptions(card.options).map((option, index) => ({
        option,
        label: indexToLabel(index),
      })),
    [cardSignature],
  );

  return (
    <article className="flashcard-item">
      <h3 className="flashcard-question">{card.question}</h3>
      <ul className="flashcard-options">
        {displayOptions.map(({ option, label }) => {
          const isSelected = selectedKeys.includes(option.key);
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
                onClick={() => {
                  if (isMultiSelect) {
                    const nextKeys = isSelected
                      ? selectedKeys.filter((key) => key !== option.key)
                      : [...selectedKeys, option.key];
                    onSelect(cardIndex, nextKeys);
                    return;
                  }
                  onSelect(cardIndex, [option.key]);
                }}
                disabled={submitted}
                aria-pressed={isSelected}
              >
                <span className="flashcard-key">{label}</span>
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
          onClick={() => onSubmit(cardIndex, selectedKeys.length > 0)}
          disabled={selectedKeys.length === 0 || submitted}
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
