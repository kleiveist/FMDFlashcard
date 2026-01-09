/**
 * @file apps/fmd-desktop/src/components/flashcards/TrueFalseCard.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente True False Card.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcards.ts: Typen.
 * - apps/fmd-desktop/src/features/flashcards/logic.ts: Feature-Logik oder Hook.
 *
 * Exportiert:
 * - TrueFalseCard: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { type TrueFalseCard as TrueFalseCardType } from "../../lib/flashcards";
import { MarkdownBlocks } from "./MarkdownBlocks";
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
  submissionLocked?: boolean;
  showSubmit?: boolean;
  showResult?: boolean;
  revealCorrectness?: boolean;
  showSolution?: boolean;
  onSelect: (cardIndex: number, itemId: string, value: TrueFalseSelection) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const TrueFalseCard = ({
  card,
  cardIndex,
  submitted,
  selections,
  submissionLocked = false,
  showSubmit = true,
  showResult = true,
  revealCorrectness,
  showSolution,
  onSelect,
  onSubmit,
}: TrueFalseCardProps) => {
  const canSubmit = areTrueFalseItemsComplete(card, selections);
  const isCorrect = isTrueFalseCardCorrect(card, selections);
  const reveal = revealCorrectness ?? submitted;
  const shouldShowSolution = showSolution ?? submitted;
  const resultLabel = submitted && showResult ? (isCorrect ? "Correct" : "Incorrect") : "";
  const showActions = showSubmit || (submitted && showResult);

  return (
    <article className="flashcard-item truefalse-card">
      <h3 className="flashcard-question">True/False</h3>
      {card.context?.trim() ? (
        <MarkdownBlocks text={card.context} allowTableScroll />
      ) : null}
      <ul className="truefalse-list">
        {card.items.map((item) => {
          const selected = selections[item.id];
          const isItemCorrect = reveal && selected === item.correct;
          const isItemIncorrect = reveal && selected && selected !== item.correct;
          const trueClasses = [
            "truefalse-option",
            selected === "wahr" ? "selected" : "",
            reveal && item.correct === "wahr" ? "correct" : "",
            reveal && selected === "wahr" && isItemIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const falseClasses = [
            "truefalse-option",
            selected === "falsch" ? "selected" : "",
            reveal && item.correct === "falsch" ? "correct" : "",
            reveal && selected === "falsch" && isItemIncorrect ? "incorrect" : "",
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
              {submitted && showResult ? (
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
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, canSubmit)}
              disabled={submitted || !canSubmit || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted && showResult ? (
            <span className={`flashcard-result ${isCorrect ? "correct" : "incorrect"}`}>
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {shouldShowSolution ? (
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
