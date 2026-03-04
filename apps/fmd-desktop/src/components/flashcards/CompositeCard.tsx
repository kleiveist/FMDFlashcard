/**
 * @file apps/fmd-desktop/src/components/flashcards/CompositeCard.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Composite Card.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/flashcards/ClozeCard.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/flashcards/FreeTextCard.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/flashcards/MultipleChoiceCard.tsx: UI-Komponente.
 *
 * Exportiert:
 * - CompositeCard: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import type { DragEvent } from "react";
import { ClozeCard } from "./ClozeCard";
import { FreeTextCard } from "./FreeTextCard";
import { MultipleChoiceCard } from "./MultipleChoiceCard";
import { TrueFalseCard } from "./TrueFalseCard";
import type { CompositeFlashcard } from "../../lib/flashcards";
import {
  evaluateCompositeCardResult,
  isFlashcardPartComplete,
  type CompositePartState,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "../../features/flashcards/logic";
import { HelpButton, hasHelpContent } from "../HelpButton";
import type { VaultPngAsset } from "../../lib/tree";

type CompositeCardProps = {
  card: CompositeFlashcard;
  cardIndex: number;
  submitted: boolean;
  submissionLocked?: boolean;
  partStates: CompositePartState[];
  showSubmit?: boolean;
  showResult?: boolean;
  revealCorrectness?: boolean;
  showSolution?: boolean;
  forceRevealText?: boolean;
  helpText?: string[] | string;
  helpEnabled?: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  onOptionSelect: (cardIndex: number, partIndex: number, keys: string[]) => void;
  onTrueFalseSelect: (
    cardIndex: number,
    partIndex: number,
    itemId: string,
    value: TrueFalseSelection,
  ) => void;
  onClozeInputChange: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  onClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onClozeTokenRemove: (cardIndex: number, partIndex: number, blankId: string) => void;
  onClozeTokenDragStart: (
    event: DragEvent<HTMLElement>,
    payload: { cardIndex: number; tokenId: string; partIndex?: number },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onTextInputChange: (cardIndex: number, partIndex: number, value: string) => void;
  onTextCheck: (cardIndex: number, partIndex: number) => void;
  onSelfGrade: (
    cardIndex: number,
    partIndex: number,
    grade: FlashcardSelfGrade,
  ) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const CompositeCard = ({
  card,
  cardIndex,
  submitted,
  submissionLocked = false,
  partStates,
  showSubmit = true,
  showResult = true,
  revealCorrectness,
  showSolution,
  forceRevealText = false,
  helpText,
  helpEnabled,
  vaultPath,
  vaultPngAssets,
  onBlankDragOver,
  onClozeInputChange,
  onClozeTokenDragStart,
  onClozeTokenDrop,
  onClozeTokenRemove,
  onOptionSelect,
  onSelfGrade,
  onSubmit,
  onTextCheck,
  onTextInputChange,
  onTrueFalseSelect,
}: CompositeCardProps) => {
  const canSubmit =
    card.parts.length > 0 &&
    card.parts.every((part, index) => {
      if (part.kind === "free-text") {
        return true;
      }
      return isFlashcardPartComplete(part, partStates[index] ?? {});
    });
  const cardResult = evaluateCompositeCardResult(card, partStates);
  const showResultLabel = submitted && showResult;
  const resultLabel = showResultLabel
    ? cardResult === "pending"
      ? "Pending"
      : cardResult === "correct"
        ? "Correct"
        : "Incorrect"
    : "";
  const resultClass = `flashcard-result ${
    cardResult === "pending"
      ? "pending"
      : cardResult === "correct"
        ? "correct"
        : "incorrect"
  }`;
  const hasHelp = helpEnabled && hasHelpContent(helpText);
  const showActions = showSubmit || (submitted && showResult) || hasHelp;

  return (
    <article className="flashcard-item composite-card">
      <div className="composite-parts">
        {card.parts.map((part, partIndex) => {
          const state = partStates[partIndex] ?? {};
          if (part.kind === "cloze") {
            return (
              <ClozeCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                partIndex={partIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                responses={state.clozeResponses ?? {}}
                showResult={showResult}
                revealCorrectness={revealCorrectness}
                showSolution={showSolution}
                vaultPath={vaultPath}
                vaultPngAssets={vaultPngAssets}
                onInputChange={(index, blankId, value) =>
                  onClozeInputChange(index, partIndex, blankId, value)
                }
                onTokenDrop={(event, index, blankId, validTokenIds, dragBlankIds) =>
                  onClozeTokenDrop(
                    event,
                    index,
                    partIndex,
                    blankId,
                    validTokenIds,
                    dragBlankIds,
                  )
                }
                onTokenRemove={(index, blankId) =>
                  onClozeTokenRemove(index, partIndex, blankId)
                }
                onTokenDragStart={onClozeTokenDragStart}
                onBlankDragOver={onBlankDragOver}
                onSubmit={onSubmit}
                showSubmit={false}
              />
            );
          }

          if (part.kind === "true-false") {
            return (
              <TrueFalseCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                selections={state.trueFalseSelections ?? {}}
                showResult={showResult}
                revealCorrectness={revealCorrectness}
                showSolution={showSolution}
                vaultPath={vaultPath}
                vaultPngAssets={vaultPngAssets}
                onSelect={(index, itemId, value) =>
                  onTrueFalseSelect(index, partIndex, itemId, value)
                }
                onSubmit={onSubmit}
                showSubmit={false}
              />
            );
          }

          if (part.kind === "free-text") {
            return (
              <FreeTextCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                response={state.textResponse ?? ""}
                revealed={forceRevealText || state.textRevealed || false}
                selfGrade={state.selfGrade}
                showActions={showResult}
                vaultPath={vaultPath}
                vaultPngAssets={vaultPngAssets}
                onInputChange={(index, value) =>
                  onTextInputChange(index, partIndex, value)
                }
                onCheck={(index) => onTextCheck(index, partIndex)}
                onSelfGrade={(index, grade) => onSelfGrade(index, partIndex, grade)}
              />
            );
          }

          return (
            <MultipleChoiceCard
              key={`composite-${cardIndex}-${partIndex}`}
              card={part}
              cardIndex={cardIndex}
              submitted={submitted}
              submissionLocked={submissionLocked}
              selectedKeys={state.selections ?? []}
              showResult={showResult}
              revealCorrectness={revealCorrectness}
              vaultPath={vaultPath}
              vaultPngAssets={vaultPngAssets}
              onSelect={(index, keys) => onOptionSelect(index, partIndex, keys)}
              onSubmit={onSubmit}
              showSubmit={false}
            />
          );
        })}
      </div>
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, canSubmit)}
              disabled={!canSubmit || submitted || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {showResultLabel ? (
            <span className={resultClass}>{resultLabel}</span>
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
