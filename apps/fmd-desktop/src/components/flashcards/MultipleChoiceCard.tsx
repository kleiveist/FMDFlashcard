/**
 * @file apps/fmd-desktop/src/components/flashcards/MultipleChoiceCard.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Multiple Choice Card.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcards.ts: Typen.
 * - apps/fmd-desktop/src/components/flashcards/CompositeCard.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - MultipleChoiceCard: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useId, useMemo } from "react";
import { type MultipleChoiceCard as MultipleChoiceCardType } from "../../lib/flashcards";
import { MarkdownBlocks } from "./MarkdownBlocks";
import { HelpButton, hasHelpContent } from "../HelpButton";
import { FlashcardMediaGroup } from "./FlashcardMediaGroup";
import type { VaultPngAsset } from "../../lib/tree";

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
  submissionLocked?: boolean;
  showSubmit?: boolean;
  showResult?: boolean;
  revealCorrectness?: boolean;
  helpText?: string[] | string;
  helpEnabled?: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  onSelect: (cardIndex: number, keys: string[]) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const MultipleChoiceCard = ({
  card,
  cardIndex,
  submitted,
  selectedKeys,
  submissionLocked = false,
  showSubmit = true,
  showResult = true,
  revealCorrectness,
  helpText,
  helpEnabled,
  vaultPath,
  vaultPngAssets,
  onSelect,
  onSubmit,
}: MultipleChoiceCardProps) => {
  const inputGroup = useId();
  const hasSolutions = card.correctKeys.length > 0;
  const isMultiSelect = card.correctKeys.length > 1;
  const selectionIsCorrect =
    hasSolutions && selectedKeys.length > 0
      ? isExactKeyMatch(selectedKeys, card.correctKeys)
      : false;
  const reveal = revealCorrectness ?? submitted;
  const resultLabel = submitted && showResult
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

  const hasHelp = helpEnabled && hasHelpContent(helpText);
  const showActions = showSubmit || (submitted && showResult) || hasHelp;

  return (
    <article className="flashcard-item">
      <h3 className="flashcard-question">{card.question}</h3>
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
      <ul className="flashcard-options">
        {displayOptions.map(({ option, label }) => {
          const isSelected = selectedKeys.includes(option.key);
          const isCorrect = hasSolutions && card.correctKeys.includes(option.key);
          const isIncorrect = hasSolutions && reveal && isSelected && !isCorrect;
          const isDisabled = submitted || submissionLocked;
          const optionClasses = [
            "flashcard-option",
            isSelected ? "selected" : "",
            reveal && isCorrect ? "correct" : "",
            reveal && isIncorrect ? "incorrect" : "",
            isDisabled ? "disabled" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const handleSelect = () => {
            if (isDisabled) {
              return;
            }
            if (isMultiSelect) {
              const nextKeys = isSelected
                ? selectedKeys.filter((key) => key !== option.key)
                : [...selectedKeys, option.key];
              onSelect(cardIndex, nextKeys);
              return;
            }
            onSelect(cardIndex, [option.key]);
          };

          return (
            <li key={`flashcard-${cardIndex}-${option.key}`}>
              <label className={optionClasses}>
                <input
                  type={isMultiSelect ? "checkbox" : "radio"}
                  name={`flashcard-${cardIndex}-${inputGroup}`}
                  checked={isSelected}
                  onChange={handleSelect}
                  disabled={isDisabled}
                  className="flashcard-option-input"
                />
                <span className="flashcard-key">{label}</span>
                <MarkdownBlocks
                  text={option.text}
                  className="flashcard-text"
                  allowTableScroll
                  vaultPath={vaultPath}
                  vaultPngAssets={vaultPngAssets}
                />
              </label>
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
              onClick={() => onSubmit(cardIndex, selectedKeys.length > 0)}
              disabled={selectedKeys.length === 0 || submitted || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted && showResult ? (
            <span
              className={`flashcard-result ${
                hasSolutions ? (selectionIsCorrect ? "correct" : "incorrect") : "neutral"
              }`}
            >
              {resultLabel}
            </span>
          ) : null}
          <HelpButton
            helpText={helpText}
            enabled={helpEnabled}
            className="flashcard-help-button"
            vaultPath={vaultPath}
            vaultPngAssets={vaultPngAssets}
          />
        </div>
      ) : null}
    </article>
  );
};
