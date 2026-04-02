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

import type { ReactNode } from "react";
import { type TrueFalseCard as TrueFalseCardType } from "../../lib/flashcards";
import { renderMarkdownMathNode } from "../../lib/markdownMath";
import { MarkdownBlocks } from "./MarkdownBlocks";
import {
  areTrueFalseItemsComplete,
  isTrueFalseCardCorrect,
  type TrueFalseSelection,
} from "../../features/flashcards/logic";
import { HelpButton, hasHelpContent } from "../HelpButton";
import { FlashcardMediaGroup } from "./FlashcardMediaGroup";
import type { VaultPngAsset } from "../../lib/tree";

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
  resultHeaderAction?: ReactNode;
  helpText?: string[] | string;
  helpEnabled?: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
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
  resultHeaderAction,
  helpText,
  helpEnabled,
  vaultPath,
  vaultPngAssets,
  onSelect,
  onSubmit,
}: TrueFalseCardProps) => {
  const canSubmit = areTrueFalseItemsComplete(card, selections);
  const isCorrect = isTrueFalseCardCorrect(card, selections);
  const reveal = revealCorrectness ?? submitted;
  const shouldShowSolution = showSolution ?? submitted;
  const resultLabel = submitted && showResult ? (isCorrect ? "Correct" : "Incorrect") : "";
  const hasHelp = helpEnabled && hasHelpContent(helpText);
  const showActions = showSubmit || (submitted && showResult) || hasHelp;

  return (
    <article className="flashcard-item truefalse-card">
      <h3 className="flashcard-question">True/False</h3>
      <FlashcardMediaGroup
        media={card.media}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
      />
      {card.context?.trim() ? (
        <MarkdownBlocks
          text={card.context}
          allowTableScroll
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
        />
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
              <div className="truefalse-question">
                {renderMarkdownMathNode(item.question, {
                  keyPrefix: `true-false-question-${cardIndex}-${item.id}`,
                })}
              </div>
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
          {submitted && showResult ? resultHeaderAction : null}
          <HelpButton
            helpText={helpText}
            enabled={helpEnabled}
            className="flashcard-help-button"
            vaultPath={vaultPath}
            vaultPngAssets={vaultPngAssets}
          />
        </div>
      ) : null}
      {shouldShowSolution ? (
        <div className="truefalse-solution">
          <span className="label">Solution</span>
          <ul className="truefalse-solution-list">
            {card.items.map((item) => (
              <li key={`solution-${item.id}`} className="truefalse-solution-item">
                <span>
                  {renderMarkdownMathNode(item.question, {
                    keyPrefix: `true-false-solution-${cardIndex}-${item.id}`,
                  })}
                </span>
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
