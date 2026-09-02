/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/components/SrCardHost.tsx
 *
 * Zweck:
 * - Rendert die Seite Sr Card Host.
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
 * - SrCardHost: React-Komponente.
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
import { SrReviewActions } from "./SrReviewActions";
import type { ClozeDragPayload, FlashcardSelfGrade } from "../../../features/flashcards/logic";
import type { VaultPngAsset } from "../../../lib/tree";

const EMPTY_CLOZE_RESPONSES: Record<string, string> = {};
type SrEntry = { card: any; cardIndex: number; sourceMeta?: unknown };

type SrCardHostProps = {
  filteredFlashcardEntries: SrEntry[];
  nextPreviewFlashcardEntry?: SrEntry | null;
  renderResultHeaderAction?: (cardIndex: number, submitted: boolean) => ReactNode;
  spacedRepetitionSubmissions: Record<number, boolean>;
  helpEnabled: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
  spacedRepetitionCompositeStates?: Record<number, any[]>;
  spacedRepetitionClozeResponses: Record<number, Record<string, string>>;
  spacedRepetitionTrueFalseSelections: Record<number, Record<string, any>>;
  spacedRepetitionTextResponses: Record<number, string>;
  spacedRepetitionTextRevealed: Record<number, boolean>;
  spacedRepetitionSelfGrades: Record<number, any>;
  spacedRepetitionSelections: Record<number, string[]>;
  handleCompositeOptionSelect: (cardIndex: number, partIndex: number, keys: string[]) => void;
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
  handleCompositeClozeTokenRemove: (cardIndex: number, partIndex: number, blankId: string) => void;
  handleCompositeTextInputChange: (cardIndex: number, partIndex: number, value: string) => void;
  handleCompositeTextCheck: (cardIndex: number, partIndex: number) => void;
  handleCompositeSelfGrade: (
    cardIndex: number,
    partIndex: number,
    grade: "correct" | "incorrect",
  ) => void;
  handleOptionSelect: (cardIndex: number, keys: string[]) => void;
  handleTrueFalseSelect: (cardIndex: number, itemId: string, value: "wahr" | "falsch") => void;
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
  handleSelfGrade: (cardIndex: number, grade: "correct" | "incorrect") => void;
  handleSpacedRepetitionSubmit: (
    cardIndex: number,
    canSubmit: boolean,
    selfGrade?: FlashcardSelfGrade,
  ) => void;
  handleClozeTokenDragStart: (event: DragEvent<HTMLElement>, payload: ClozeDragPayload) => void;
  handleClozeBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  spacedRepetitionCanGoBack: boolean;
  spacedRepetitionCanGoNext: boolean;
  handleSpacedRepetitionPageBack: () => void;
  handleSpacedRepetitionPageNext: () => void;
  prevShortcutTitle: string;
  nextShortcutTitle: string;
};

export const SrCardHost = ({
  filteredFlashcardEntries,
  nextPreviewFlashcardEntry = null,
  renderResultHeaderAction,
  spacedRepetitionSubmissions,
  helpEnabled,
  vaultPath,
  vaultPngAssets,
  spacedRepetitionCompositeStates,
  spacedRepetitionClozeResponses,
  spacedRepetitionTrueFalseSelections,
  spacedRepetitionTextResponses,
  spacedRepetitionTextRevealed,
  spacedRepetitionSelfGrades,
  spacedRepetitionSelections,
  handleCompositeOptionSelect,
  handleCompositeTrueFalseSelect,
  handleCompositeClozeInputChange,
  handleCompositeClozeTokenDrop,
  handleCompositeClozeTokenRemove,
  handleCompositeTextInputChange,
  handleCompositeTextCheck,
  handleCompositeSelfGrade,
  handleOptionSelect,
  handleTrueFalseSelect,
  handleClozeInputChange,
  handleClozeTokenDrop,
  handleClozeTokenRemove,
  handleTextInputChange,
  handleTextCheck,
  handleSelfGrade,
  handleSpacedRepetitionSubmit,
  handleClozeTokenDragStart,
  handleClozeBlankDragOver,
  spacedRepetitionCanGoBack,
  spacedRepetitionCanGoNext,
  handleSpacedRepetitionPageBack,
  handleSpacedRepetitionPageNext,
  prevShortcutTitle,
  nextShortcutTitle,
}: SrCardHostProps) => {
  const renderEntry = (entry: SrEntry, options: { preview?: boolean; keyPrefix?: string } = {}) => {
    const card = entry.card;
    const cardIndex = entry.cardIndex;
    const submitted = !!spacedRepetitionSubmissions[cardIndex];
    const locked = false;
    const keyPrefix = options.keyPrefix ?? "flashcard";
    const entryHelpEnabled = helpEnabled;
    const entryHelpText = card.helpText;
    const resultHeaderAction = !renderResultHeaderAction
      ? null
      : (renderResultHeaderAction(cardIndex, submitted) ?? null);

    if (card.kind === "composite") {
      return (
        <CompositeCard
          key={`${keyPrefix}-${cardIndex}`}
          card={card}
          cardIndex={cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={resultHeaderAction}
          partStates={spacedRepetitionCompositeStates?.[cardIndex] ?? []}
          onOptionSelect={handleCompositeOptionSelect}
          onTrueFalseSelect={handleCompositeTrueFalseSelect}
          onClozeInputChange={handleCompositeClozeInputChange}
          onClozeTokenDrop={handleCompositeClozeTokenDrop}
          onClozeTokenRemove={handleCompositeClozeTokenRemove}
          onClozeTokenDragStart={handleClozeTokenDragStart}
          onBlankDragOver={handleClozeBlankDragOver}
          onTextInputChange={handleCompositeTextInputChange}
          onTextCheck={handleCompositeTextCheck}
          onSelfGrade={handleCompositeSelfGrade}
          onSubmit={handleSpacedRepetitionSubmit}
        />
      );
    }

    if (card.kind === "cloze") {
      return (
        <ClozeCard
          key={`${keyPrefix}-${cardIndex}`}
          card={card}
          cardIndex={cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={resultHeaderAction}
          responses={spacedRepetitionClozeResponses[cardIndex] ?? EMPTY_CLOZE_RESPONSES}
          onInputChange={handleClozeInputChange}
          onTokenDrop={handleClozeTokenDrop}
          onTokenRemove={handleClozeTokenRemove}
          onTokenDragStart={handleClozeTokenDragStart}
          onBlankDragOver={handleClozeBlankDragOver}
          onSubmit={handleSpacedRepetitionSubmit}
        />
      );
    }

    if (card.kind === "true-false") {
      return (
        <TrueFalseCard
          key={`${keyPrefix}-${cardIndex}`}
          card={card}
          cardIndex={cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={resultHeaderAction}
          selections={spacedRepetitionTrueFalseSelections[cardIndex] ?? {}}
          onSelect={handleTrueFalseSelect}
          onSubmit={handleSpacedRepetitionSubmit}
        />
      );
    }

    if (card.kind === "free-text") {
      return (
        <FreeTextCard
          key={`${keyPrefix}-${cardIndex}`}
          card={card}
          cardIndex={cardIndex}
          submitted={submitted}
          submissionLocked={locked}
          vaultPath={vaultPath}
          vaultPngAssets={vaultPngAssets}
          helpText={entryHelpText}
          helpEnabled={entryHelpEnabled}
          resultHeaderAction={resultHeaderAction}
          response={spacedRepetitionTextResponses[cardIndex] ?? ""}
          revealed={spacedRepetitionTextRevealed[cardIndex] ?? false}
          selfGrade={spacedRepetitionSelfGrades[cardIndex]}
          onInputChange={handleTextInputChange}
          onCheck={handleTextCheck}
          onSelfGrade={handleSelfGrade}
        />
      );
    }

    return (
      <MultipleChoiceCard
        key={`${keyPrefix}-${cardIndex}`}
        card={card}
        cardIndex={cardIndex}
        submitted={submitted}
        submissionLocked={locked}
        vaultPath={vaultPath}
        vaultPngAssets={vaultPngAssets}
        helpText={entryHelpText}
        helpEnabled={entryHelpEnabled}
        resultHeaderAction={resultHeaderAction}
        selectedKeys={spacedRepetitionSelections[cardIndex] ?? []}
        onSelect={handleOptionSelect}
        onSubmit={handleSpacedRepetitionSubmit}
      />
    );
  };

  return (
    <div className="panel-body">
      <div className="flashcard-list">
        {filteredFlashcardEntries.map((entry) => renderEntry(entry))}
        {nextPreviewFlashcardEntry ? (
          <div className="study-ultrawide-preview-pane">
            {renderEntry(nextPreviewFlashcardEntry, {
              preview: true,
              keyPrefix: "sr-next",
            })}
          </div>
        ) : null}
      </div>
      <SrReviewActions
        spacedRepetitionCanGoBack={spacedRepetitionCanGoBack}
        spacedRepetitionCanGoNext={spacedRepetitionCanGoNext}
        handleSpacedRepetitionPageBack={handleSpacedRepetitionPageBack}
        handleSpacedRepetitionPageNext={handleSpacedRepetitionPageNext}
        prevShortcutTitle={prevShortcutTitle}
        nextShortcutTitle={nextShortcutTitle}
      />
    </div>
  );
};
