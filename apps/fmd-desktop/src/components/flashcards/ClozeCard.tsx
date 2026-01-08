/**
 * @file apps/fmd-desktop/src/components/flashcards/ClozeCard.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Cloze Card.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcards.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/features/flashcards/logic.ts: Feature-Logik oder Hook.
 *
 * Exportiert:
 * - ClozeCard: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { type DragEvent, useMemo } from "react";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  type ClozeCard as ClozeCardType,
} from "../../lib/flashcards";
import {
  areClozeBlanksComplete,
  getClozeBlanks,
  isClozeCardCorrect,
} from "../../features/flashcards/logic";
import { resolveSeed, seededShuffle } from "../../lib/seededShuffle";
import {
  CLOZE_PLACEHOLDER_PREFIX,
  CLOZE_PLACEHOLDER_SUFFIX,
  MarkdownBlocks,
} from "./MarkdownBlocks";
import { findTableLineIndices } from "../../lib/markdownTables";

type ClozeCardProps = {
  card: ClozeCardType;
  cardIndex: number;
  submitted: boolean;
  responses: Record<string, string>;
  submissionLocked?: boolean;
  partIndex?: number;
  showSubmit?: boolean;
  showResult?: boolean;
  revealCorrectness?: boolean;
  showSolution?: boolean;
  onInputChange: (cardIndex: number, blankId: string, value: string) => void;
  onTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onTokenRemove: (cardIndex: number, blankId: string) => void;
  onTokenDragStart: (
    event: DragEvent<HTMLElement>,
    payload: { cardIndex: number; tokenId: string; partIndex?: number },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const ClozeCard = ({
  card,
  cardIndex,
  submitted,
  responses,
  submissionLocked = false,
  partIndex,
  showSubmit = true,
  showResult = true,
  revealCorrectness,
  showSolution,
  onBlankDragOver,
  onInputChange,
  onSubmit,
  onTokenDragStart,
  onTokenDrop,
  onTokenRemove,
}: ClozeCardProps) => {
  const blanks = getClozeBlanks(card.segments);
  const dragBlanks = blanks.filter((blank) => blank.kind === "drag");
  const dragBlankIds = new Set(dragBlanks.map((blank) => blank.id));
  const tokenById = new Map(
    card.dragTokens.map((token) => [token.id, token.value]),
  );
  const { placeholderText, blankById, blankOrderById } = useMemo(() => {
    let text = "";
    const blankMap = new Map<string, Extract<ClozeCardType["segments"][number], { type: "blank" }>>();
    const orderMap = new Map<string, number>();
    let blankIndex = 0;

    card.segments.forEach((segment) => {
      if (segment.type === "text") {
        text += segment.value;
        return;
      }
      blankMap.set(segment.id, segment);
      blankIndex += 1;
      orderMap.set(segment.id, blankIndex);
      text += `${CLOZE_PLACEHOLDER_PREFIX}${segment.id}${CLOZE_PLACEHOLDER_SUFFIX}`;
    });

    return { placeholderText: text, blankById: blankMap, blankOrderById: orderMap };
  }, [card.segments]);
  const { markdownText, questionText } = useMemo(() => {
    const trimmedQuestion = card.question.trim();
    if (!trimmedQuestion) {
      return { markdownText: placeholderText, questionText: "" };
    }
    const combinedText = `${card.question}\n${placeholderText}`;
    const tableLineIndices = findTableLineIndices(combinedText.split("\n"));
    if (tableLineIndices.has(0)) {
      return { markdownText: combinedText, questionText: "" };
    }
    return { markdownText: placeholderText, questionText: card.question };
  }, [card.question, placeholderText]);
  const normalizedPartIndex = partIndex ?? 0;
  const tokenBank = useMemo(() => {
    const identifier = `${cardIndex}:${normalizedPartIndex}:${card.question}`;
    const seed = resolveSeed(identifier);
    return seededShuffle(card.dragTokens, seed);
  }, [card.dragTokens, cardIndex, normalizedPartIndex, card.question]);
  const assignedTokenIds = new Set(
    dragBlanks
      .map((blank) => responses[blank.id])
      .filter((tokenId) => tokenById.has(tokenId)),
  );
  const hasDragTokens = tokenBank.length > 0;
  const validTokenIds = new Set(card.dragTokens.map((token) => token.id));
  const canSubmit = areClozeBlanksComplete(card, responses);
  const isCorrect = isClozeCardCorrect(card, responses);
  const reveal = revealCorrectness ?? submitted;
  const shouldShowSolution = showSolution ?? submitted;
  const resultLabel = submitted && showResult ? (isCorrect ? "Correct" : "Incorrect") : "";
  const showActions = showSubmit || (submitted && showResult);

  const renderBlank = (blankId: string) => {
    const segment = blankById.get(blankId);
    if (!segment) {
      return null;
    }
    const blankNumber = blankOrderById.get(blankId) ?? 0;

    if (segment.kind === "input") {
      const value = responses[segment.id] ?? "";
      const isBlankCorrect = reveal
        ? isInputAnswerMatch(value, segment.solution)
        : false;
      const blankClasses = [
        "cloze-blank",
        "input",
        value.trim() ? "filled" : "",
        reveal ? (isBlankCorrect ? "correct" : "incorrect") : "",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <span className={blankClasses}>
          <input
            type="text"
            className="cloze-input"
            value={value}
            onChange={(event) =>
              onInputChange(cardIndex, segment.id, event.target.value)
            }
            disabled={submitted}
            placeholder="____"
            aria-label={`Blank ${blankNumber}`}
          />
        </span>
      );
    }

    const assignedTokenId = responses[segment.id] ?? "";
    const assignedValue = assignedTokenId
      ? tokenById.get(assignedTokenId) ?? ""
      : "";
    const hasToken = Boolean(assignedValue);
    const isBlankCorrect = reveal
      ? isDragAnswerMatch(assignedValue, segment.solution)
      : false;
    const blankClasses = [
      "cloze-blank",
      "drag",
      hasToken ? "filled" : "",
      reveal ? (isBlankCorrect ? "correct" : "incorrect") : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span
        className={blankClasses}
        aria-label={`Drop zone ${blankNumber}`}
        onDragOver={onBlankDragOver}
        onDrop={(event) =>
          onTokenDrop(event, cardIndex, segment.id, validTokenIds, dragBlankIds)
        }
      >
        {hasToken ? (
          <span className="cloze-token">
            <button
              type="button"
              className="token-chip"
              draggable={!submitted}
              onDragStart={(event) =>
                onTokenDragStart(event, {
                  cardIndex,
                  tokenId: assignedTokenId,
                  partIndex,
                })
              }
              disabled={submitted}
            >
              {assignedValue}
            </button>
            {!submitted ? (
              <button
                type="button"
                className="token-remove"
                onClick={() => onTokenRemove(cardIndex, segment.id)}
                aria-label="Remove token"
              >
                x
              </button>
            ) : null}
          </span>
        ) : (
          <span className="cloze-placeholder">Drop token</span>
        )}
      </span>
    );
  };

  const renderSolutionBlank = (blankId: string) => {
    const segment = blankById.get(blankId);
    if (!segment) {
      return null;
    }
    return <span className="cloze-solution-token">{segment.solution}</span>;
  };

  return (
    <article className="flashcard-item cloze-card">
      {questionText.trim() ? (
        <h3 className="flashcard-question">{questionText}</h3>
      ) : null}
      <MarkdownBlocks
        text={markdownText}
        className="cloze-text"
        allowTableScroll={false}
        renderPlaceholder={renderBlank}
      />
      {hasDragTokens ? (
        <div className="token-section">
          <span className="label">Tokens</span>
          <div className="token-pool">
            {tokenBank.map((token) => {
              const isUsed = assignedTokenIds.has(token.id);
              return (
                <button
                  key={`token-${cardIndex}-${token.id}`}
                  type="button"
                  className={`token-chip ${isUsed ? "used" : ""}`}
                  draggable={!submitted && !isUsed}
                  onDragStart={(event) =>
                    onTokenDragStart(event, {
                      cardIndex,
                      tokenId: token.id,
                      partIndex,
                    })
                  }
                  disabled={submitted || isUsed}
                >
                  {token.value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
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
        <div className="token-solution">
          <span className="label">Solution</span>
          <MarkdownBlocks
            text={markdownText}
            className="cloze-solution"
            allowTableScroll={false}
            renderPlaceholder={renderSolutionBlank}
          />
        </div>
      ) : null}
    </article>
  );
};
