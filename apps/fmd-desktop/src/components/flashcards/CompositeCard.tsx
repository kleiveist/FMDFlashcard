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

import { useMemo, type DragEvent, type ReactNode } from "react";
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

const EMPTY_CLOZE_RESPONSES: Record<string, string> = {};
const EMPTY_PART_STATE: CompositePartState = {};

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
  resultHeaderAction?: ReactNode;
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
  onSelfGrade: (cardIndex: number, partIndex: number, grade: FlashcardSelfGrade) => void;
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
  resultHeaderAction,
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
  const partCount = card.parts.length;
  const canSubmit =
    partCount > 0 &&
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
    cardResult === "pending" ? "pending" : cardResult === "correct" ? "correct" : "incorrect"
  }`;
  const hasHelp = helpEnabled && hasHelpContent(helpText);
  const showActions = showSubmit || (submitted && showResult) || hasHelp;
  const optionSelectHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) => (index: number, keys: string[]) => onOptionSelect(index, partIndex, keys),
      ),
    [onOptionSelect, partCount],
  );
  const trueFalseSelectHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) => (index: number, itemId: string, value: TrueFalseSelection) =>
          onTrueFalseSelect(index, partIndex, itemId, value),
      ),
    [onTrueFalseSelect, partCount],
  );
  const clozeInputHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) => (index: number, blankId: string, value: string) =>
          onClozeInputChange(index, partIndex, blankId, value),
      ),
    [onClozeInputChange, partCount],
  );
  const clozeTokenDropHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) =>
          (
            event: DragEvent<HTMLElement>,
            index: number,
            blankId: string,
            validTokenIds: Set<string>,
            dragBlankIds: Set<string>,
          ) =>
            onClozeTokenDrop(event, index, partIndex, blankId, validTokenIds, dragBlankIds),
      ),
    [onClozeTokenDrop, partCount],
  );
  const clozeTokenRemoveHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) => (index: number, blankId: string) =>
          onClozeTokenRemove(index, partIndex, blankId),
      ),
    [onClozeTokenRemove, partCount],
  );
  const textInputHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) => (index: number, value: string) =>
          onTextInputChange(index, partIndex, value),
      ),
    [onTextInputChange, partCount],
  );
  const textCheckHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) => (index: number) => onTextCheck(index, partIndex),
      ),
    [onTextCheck, partCount],
  );
  const selfGradeHandlers = useMemo(
    () =>
      Array.from(
        { length: partCount },
        (_, partIndex) => (index: number, grade: FlashcardSelfGrade) =>
          onSelfGrade(index, partIndex, grade),
      ),
    [onSelfGrade, partCount],
  );

  return (
    <article className="flashcard-item composite-card">
      <div className="composite-parts">
        {card.parts.map((part, partIndex) => {
          const state = partStates[partIndex] ?? EMPTY_PART_STATE;
          if (part.kind === "cloze") {
            return (
              <ClozeCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                partIndex={partIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                responses={state.clozeResponses ?? EMPTY_CLOZE_RESPONSES}
                showResult={showResult}
                revealCorrectness={revealCorrectness}
                showSolution={showSolution}
                vaultPath={vaultPath}
                vaultPngAssets={vaultPngAssets}
                onInputChange={clozeInputHandlers[partIndex]}
                onTokenDrop={clozeTokenDropHandlers[partIndex]}
                onTokenRemove={clozeTokenRemoveHandlers[partIndex]}
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
                onSelect={trueFalseSelectHandlers[partIndex]}
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
                onInputChange={textInputHandlers[partIndex]}
                onCheck={textCheckHandlers[partIndex]}
                onSelfGrade={selfGradeHandlers[partIndex]}
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
              onSelect={optionSelectHandlers[partIndex]}
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
          {showResultLabel ? <span className={resultClass}>{resultLabel}</span> : null}
          {showResultLabel ? resultHeaderAction : null}
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
