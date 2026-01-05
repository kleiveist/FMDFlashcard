import type { DragEvent } from "react";
import { ClozeCard } from "../../../components/flashcards/ClozeCard";
import { CompositeCard } from "../../../components/flashcards/CompositeCard";
import { FreeTextCard } from "../../../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../../../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../../../components/flashcards/TrueFalseCard";
import { SrReviewActions } from "./SrReviewActions";

type SrCardHostProps = {
  filteredFlashcardEntries: { card: any; cardIndex: number }[];
  showBoxEmptyMessage: boolean;
  activeBoxFilter: number | null;
  spacedRepetitionEmptyState: string;
  spacedRepetitionSubmissions: Record<number, boolean>;
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
  handleSelfGrade: (cardIndex: number, grade: "correct" | "incorrect") => void;
  handleSpacedRepetitionSubmit: (cardIndex: number, isFocusSubmit?: boolean) => void;
  handleClozeTokenDragStart: (event: DragEvent<HTMLElement>) => void;
  handleClozeBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  spacedRepetitionCanGoBack: boolean;
  spacedRepetitionCanGoNext: boolean;
  handleSpacedRepetitionPageBack: () => void;
  handleSpacedRepetitionPageNext: () => void;
};

export const SrCardHost = ({
  filteredFlashcardEntries,
  showBoxEmptyMessage,
  activeBoxFilter,
  spacedRepetitionEmptyState,
  spacedRepetitionSubmissions,
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
}: SrCardHostProps) => (
  <div className="panel-body">
    {filteredFlashcardEntries.length === 0 ? (
      <div className="empty-state">
        {showBoxEmptyMessage
          ? `No cards currently in box ${activeBoxFilter}.`
          : spacedRepetitionEmptyState}
      </div>
    ) : (
      <div className="flashcard-list">
        {filteredFlashcardEntries.map(({ card, cardIndex }) => {
          const submitted = !!spacedRepetitionSubmissions[cardIndex];

          if (card.kind === "composite") {
            return (
              <CompositeCard
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
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
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
                responses={spacedRepetitionClozeResponses[cardIndex] ?? {}}
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
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
                selections={spacedRepetitionTrueFalseSelections[cardIndex] ?? {}}
                onSelect={handleTrueFalseSelect}
                onSubmit={handleSpacedRepetitionSubmit}
              />
            );
          }

          if (card.kind === "free-text") {
            return (
              <FreeTextCard
                key={`flashcard-${cardIndex}`}
                card={card}
                cardIndex={cardIndex}
                submitted={submitted}
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
              key={`flashcard-${cardIndex}`}
              card={card}
              cardIndex={cardIndex}
              submitted={submitted}
              selectedKeys={spacedRepetitionSelections[cardIndex] ?? []}
              onSelect={handleOptionSelect}
              onSubmit={handleSpacedRepetitionSubmit}
            />
          );
        })}
      </div>
    )}
    <SrReviewActions
      spacedRepetitionCanGoBack={spacedRepetitionCanGoBack}
      spacedRepetitionCanGoNext={spacedRepetitionCanGoNext}
      handleSpacedRepetitionPageBack={handleSpacedRepetitionPageBack}
      handleSpacedRepetitionPageNext={handleSpacedRepetitionPageNext}
    />
  </div>
);
