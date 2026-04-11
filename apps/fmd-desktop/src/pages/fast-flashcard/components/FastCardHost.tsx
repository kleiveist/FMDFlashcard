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

import type { DragEvent, ReactNode } from "react";
import { ClozeCard } from "../../../components/flashcards/ClozeCard";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { FreeTextCard } from "../../../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../../../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../../../components/flashcards/TrueFalseCard";
import type { ClozeDragPayload } from "../../../features/flashcards/logic";
import type { VaultPngAsset } from "../../../lib/tree";

const EMPTY_CLOZE_RESPONSES: Record<string, string> = {};
type FastEntry = { card: any; cardIndex: number };

type FastCardHostProps = {
  hasScannedCards: boolean;
  hasFilteredCards: boolean;
  currentEntry: FastEntry | null;
  isCurrentSubmitted: boolean;
  submissionLocked: boolean;
  resultHeaderAction?: ReactNode;
  helpEnabled: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  fastFlashcards: {
    flashcardSubmissions: Record<number, boolean>;
    flashcardCompositeStates: Record<number, any[]>;
    flashcardClozeResponses: Record<number, Record<string, string>>;
    flashcardTrueFalseSelections: Record<number, Record<string, any>>;
    flashcardTextResponses: Record<number, string>;
    flashcardTextRevealed: Record<number, boolean>;
    flashcardSelfGrades: Record<number, any>;
    flashcardSelections: Record<number, string[]>;
    handleClozeTokenDragStart: (
      event: DragEvent<HTMLElement>,
      payload: ClozeDragPayload,
    ) => void;
    handleClozeBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  };
  orderedEntries: FastEntry[];
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
  resultHeaderAction,
  helpEnabled,
  vaultPath,
  vaultPngAssets,
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
}: FastCardHostProps) => {
  const nextEntry = (() => {
    if (currentEntry === null) {
      return null;
    }
    const currentPosition = orderedEntries.findIndex(
      (entry) => entry.cardIndex === currentEntry.cardIndex,
    );
    if (currentPosition < 0) {
      return null;
    }
    return orderedEntries[currentPosition + 1] ?? null;
  })();

  const renderEntry = (
    entry: FastEntry,
    options: {
      preview?: boolean;
      keyPrefix?: string;
    } = {},
  ) => {
    const submitted = !!fastFlashcards.flashcardSubmissions[entry.cardIndex];
    const locked =
      currentEntry !== null && entry.cardIndex === currentEntry.cardIndex
        ? submissionLocked
        : false;
    const entryHelpEnabled = helpEnabled;
    const entryHelpText = entry.card.helpText;
    const entryHeaderAction =
      currentEntry !== null &&
      entry.cardIndex === currentEntry.cardIndex &&
      submitted &&
      isCurrentSubmitted
        ? resultHeaderAction
        : null;
    const keyPrefix = options.keyPrefix ?? "fast-flashcard";

    if (entry.card.kind === "composite") {
      return (
        <CompositeCard
          key={`${keyPrefix}-${entry.cardIndex}`}
          card={entry.card}
          cardIndex={entry.cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={entryHeaderAction}
          partStates={fastFlashcards.flashcardCompositeStates[entry.cardIndex] ?? []}
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
      );
    }

    if (entry.card.kind === "cloze") {
      return (
        <ClozeCard
          key={`${keyPrefix}-${entry.cardIndex}`}
          card={entry.card}
          cardIndex={entry.cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={entryHeaderAction}
          responses={
            fastFlashcards.flashcardClozeResponses[entry.cardIndex] ??
            EMPTY_CLOZE_RESPONSES
          }
          onInputChange={handleClozeInputChange}
          onTokenDrop={handleClozeTokenDrop}
          onTokenRemove={handleClozeTokenRemove}
          onTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
          onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
          onSubmit={handleFastSubmit}
        />
      );
    }

    if (entry.card.kind === "true-false") {
      return (
        <TrueFalseCard
          key={`${keyPrefix}-${entry.cardIndex}`}
          card={entry.card}
          cardIndex={entry.cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={entryHeaderAction}
          selections={fastFlashcards.flashcardTrueFalseSelections[entry.cardIndex] ?? {}}
          onSelect={handleTrueFalseSelect}
          onSubmit={handleFastSubmit}
        />
      );
    }

    if (entry.card.kind === "free-text") {
      return (
        <FreeTextCard
          key={`${keyPrefix}-${entry.cardIndex}`}
          card={entry.card}
          cardIndex={entry.cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={entryHeaderAction}
          response={fastFlashcards.flashcardTextResponses[entry.cardIndex] ?? ""}
          revealed={fastFlashcards.flashcardTextRevealed[entry.cardIndex] ?? false}
          selfGrade={fastFlashcards.flashcardSelfGrades[entry.cardIndex]}
          onInputChange={handleTextInputChange}
          onCheck={handleTextCheck}
          onSelfGrade={handleFastSelfGrade}
        />
      );
    }

    return (
      <MultipleChoiceCard
        key={`${keyPrefix}-${entry.cardIndex}`}
        card={entry.card}
        cardIndex={entry.cardIndex}
        submitted={submitted}
        submissionLocked={locked}
        vaultPath={vaultPath}
        vaultPngAssets={vaultPngAssets}
        helpText={entryHelpText}
        helpEnabled={entryHelpEnabled}
        resultHeaderAction={entryHeaderAction}
        selectedKeys={fastFlashcards.flashcardSelections[entry.cardIndex] ?? []}
        onSelect={handleOptionSelect}
        onSubmit={handleFastSubmit}
      />
    );
  };

  return (
    <div className="panel-body">
      {!hasScannedCards ? (
        <div className="empty-state">
          Select a note from DASHBOARD and start the flashcard scan
        </div>
      ) : !hasFilteredCards ? (
        <div className="empty-state">No cards match the selected mode.</div>
      ) : currentEntry ? (
        <div className="flashcard-list">
          {renderEntry(currentEntry)}
          {nextEntry ? (
            <div className="study-ultrawide-preview-pane">
              {renderEntry(nextEntry, {
                preview: true,
                keyPrefix: "fast-flashcard-next",
              })}
            </div>
          ) : null}
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
};
