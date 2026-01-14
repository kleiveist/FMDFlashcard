/**
 * @file apps/fmd-desktop/src/pages/fast-flashcard/components/FastCardHost.tsx
 *
 * Zweck:
 * - Rendert die Seite Fast Card Host.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/flashcards/ClozeCard.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/flashcards/CompositeCard.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/flashcards/FreeTextCard.tsx: UI-Komponente.
 *
 * Exportiert:
 * - FastCardHost: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import type { DragEvent } from "react";
import { ClozeCard } from "../../../components/flashcards/ClozeCard";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { FreeTextCard } from "../../../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../../../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../../../components/flashcards/TrueFalseCard";

type FastCardHostProps = {
  hasScannedCards: boolean;
  hasFilteredCards: boolean;
  currentEntry: { card: any; cardIndex: number } | null;
  isCurrentSubmitted: boolean;
  submissionLocked: boolean;
  helpEnabled: boolean;
  fastFlashcards: {
    flashcardCompositeStates: Record<number, any[]>;
    flashcardClozeResponses: Record<number, Record<string, string>>;
    flashcardTrueFalseSelections: Record<number, Record<string, any>>;
    flashcardTextResponses: Record<number, string>;
    flashcardTextRevealed: Record<number, boolean>;
    flashcardSelfGrades: Record<number, any>;
    flashcardSelections: Record<number, string[]>;
    handleClozeTokenDragStart: (event: DragEvent<HTMLElement>) => void;
    handleClozeBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  };
  orderedEntries: { cardIndex: number; card: any }[];
  canGoBack: boolean;
  canGoNext: boolean;
  setFastCardPosition: (value: (prev: number) => number) => void;
  handleOptionSelect: (cardIndex: number, keys: string[]) => void;
  handleTrueFalseSelect: (
    cardIndex: number,
    itemId: string,
    value: "wahr" | "falsch",
  ) => void;
  handleClozeInputChange: (cardIndex: number, blankId: string, value: string) => void;
  handleClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  handleClozeTokenRemove: (cardIndex: number, blankId: string) => void;
  handleTextInputChange: (cardIndex: number, value: string) => void;
  handleTextCheck: (cardIndex: number) => void;
  handleCompositeOptionSelect: (
    cardIndex: number,
    partIndex: number,
    keys: string[],
  ) => void;
  handleCompositeTrueFalseSelect: (
    cardIndex: number,
    partIndex: number,
    itemId: string,
    value: "wahr" | "falsch",
  ) => void;
  handleCompositeClozeInputChange: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  handleCompositeClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  handleCompositeClozeTokenRemove: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
  ) => void;
  handleCompositeTextInputChange: (
    cardIndex: number,
    partIndex: number,
    value: string,
  ) => void;
  handleCompositeTextCheck: (cardIndex: number, partIndex: number) => void;
  handleCompositeSelfGrade: (
    cardIndex: number,
    partIndex: number,
    grade: "correct" | "incorrect",
  ) => void;
  handleFastSubmit: (cardIndex: number, canSubmit: boolean) => void;
  handleFastSelfGrade: (cardIndex: number, grade: "correct" | "incorrect") => void;
};

export const FastCardHost = ({
  hasScannedCards,
  hasFilteredCards,
  currentEntry,
  isCurrentSubmitted,
  submissionLocked,
  helpEnabled,
  fastFlashcards,
  orderedEntries,
  canGoBack,
  canGoNext,
  setFastCardPosition,
  handleOptionSelect,
  handleTrueFalseSelect,
  handleClozeInputChange,
  handleClozeTokenDrop,
  handleClozeTokenRemove,
  handleTextInputChange,
  handleTextCheck,
  handleCompositeOptionSelect,
  handleCompositeTrueFalseSelect,
  handleCompositeClozeInputChange,
  handleCompositeClozeTokenDrop,
  handleCompositeClozeTokenRemove,
  handleCompositeTextInputChange,
  handleCompositeTextCheck,
  handleCompositeSelfGrade,
  handleFastSubmit,
  handleFastSelfGrade,
}: FastCardHostProps) => (
  <div className="panel-body">
    {!hasScannedCards ? (
      <div className="empty-state">
        Select a note from DASHBOARD and start the flashcard scan
      </div>
    ) : !hasFilteredCards ? (
      <div className="empty-state">No cards match the selected mode.</div>
    ) : currentEntry ? (
      <div className="flashcard-list">
        {currentEntry.card.kind === "composite" ? (
          <CompositeCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            helpText={currentEntry.card.helpText}
            helpEnabled={helpEnabled}
            partStates={
              fastFlashcards.flashcardCompositeStates[currentEntry.cardIndex] ?? []
            }
            onOptionSelect={handleCompositeOptionSelect}
            onTrueFalseSelect={handleCompositeTrueFalseSelect}
            onClozeInputChange={handleCompositeClozeInputChange}
            onClozeTokenDrop={handleCompositeClozeTokenDrop}
            onClozeTokenRemove={handleCompositeClozeTokenRemove}
            onClozeTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
            onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
            onTextInputChange={handleCompositeTextInputChange}
            onTextCheck={handleCompositeTextCheck}
            onSelfGrade={handleCompositeSelfGrade}
            onSubmit={handleFastSubmit}
          />
        ) : currentEntry.card.kind === "cloze" ? (
          <ClozeCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            helpText={currentEntry.card.helpText}
            helpEnabled={helpEnabled}
            responses={
              fastFlashcards.flashcardClozeResponses[currentEntry.cardIndex] ?? {}
            }
            onInputChange={handleClozeInputChange}
            onTokenDrop={handleClozeTokenDrop}
            onTokenRemove={handleClozeTokenRemove}
            onTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
            onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
            onSubmit={handleFastSubmit}
          />
        ) : currentEntry.card.kind === "true-false" ? (
          <TrueFalseCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            helpText={currentEntry.card.helpText}
            helpEnabled={helpEnabled}
            selections={
              fastFlashcards.flashcardTrueFalseSelections[currentEntry.cardIndex] ?? {}
            }
            onSelect={handleTrueFalseSelect}
            onSubmit={handleFastSubmit}
          />
        ) : currentEntry.card.kind === "free-text" ? (
          <FreeTextCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            helpText={currentEntry.card.helpText}
            helpEnabled={helpEnabled}
            response={fastFlashcards.flashcardTextResponses[currentEntry.cardIndex] ?? ""}
            revealed={
              fastFlashcards.flashcardTextRevealed[currentEntry.cardIndex] ?? false
            }
            selfGrade={fastFlashcards.flashcardSelfGrades[currentEntry.cardIndex]}
            onInputChange={handleTextInputChange}
            onCheck={handleTextCheck}
            onSelfGrade={handleFastSelfGrade}
          />
        ) : (
          <MultipleChoiceCard
            key={`fast-flashcard-${currentEntry.cardIndex}`}
            card={currentEntry.card}
            cardIndex={currentEntry.cardIndex}
            submitted={isCurrentSubmitted}
            submissionLocked={submissionLocked}
            helpText={currentEntry.card.helpText}
            helpEnabled={helpEnabled}
            selectedKeys={
              fastFlashcards.flashcardSelections[currentEntry.cardIndex] ?? []
            }
            onSelect={handleOptionSelect}
            onSubmit={handleFastSubmit}
          />
        )}
      </div>
    ) : (
      <div className="empty-state">No cards available.</div>
    )}
    <div className="flashcard-pagination">
      <button
        type="button"
        className="ghost small"
        onClick={() => setFastCardPosition((prev) => Math.max(0, prev - 1))}
        disabled={!canGoBack}
      >
        Back
      </button>
      <button
        type="button"
        className="ghost small"
        onClick={() =>
          setFastCardPosition((prev) =>
            Math.min(prev + 1, Math.max(orderedEntries.length - 1, 0)),
          )
        }
        disabled={!canGoNext}
      >
        Next
      </button>
    </div>
  </div>
);
