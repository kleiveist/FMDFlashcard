import { type DragEvent } from "react";
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

type ClozeCardProps = {
  card: ClozeCardType;
  cardIndex: number;
  submitted: boolean;
  responses: Record<string, string>;
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
    payload: { cardIndex: number; tokenId: string },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const ClozeCard = ({
  card,
  cardIndex,
  submitted,
  responses,
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
  const assignedTokenIds = new Set(
    dragBlanks
      .map((blank) => responses[blank.id])
      .filter((tokenId) => tokenById.has(tokenId)),
  );
  const hasDragTokens = card.dragTokens.length > 0;
  const validTokenIds = new Set(card.dragTokens.map((token) => token.id));
  const canSubmit = areClozeBlanksComplete(card, responses);
  const isCorrect = isClozeCardCorrect(card, responses);
  const resultLabel = submitted ? (isCorrect ? "Correct" : "Incorrect") : "";
  let blankPosition = 0;

  return (
    <article className="flashcard-item cloze-card">
      <h3 className="flashcard-question">{card.question}</h3>
      <div className="cloze-text">
        {card.segments.map((segment, segmentIndex) => {
          if (segment.type === "text") {
            return (
              <span key={`cloze-text-${cardIndex}-${segmentIndex}`}>
                {segment.value}
              </span>
            );
          }

          blankPosition += 1;
          const blankNumber = blankPosition;

          if (segment.kind === "input") {
            const value = responses[segment.id] ?? "";
            const isBlankCorrect = submitted
              ? isInputAnswerMatch(value, segment.solution)
              : false;
            const blankClasses = [
              "cloze-blank",
              "input",
              value.trim() ? "filled" : "",
              submitted ? (isBlankCorrect ? "correct" : "incorrect") : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span
                key={`cloze-blank-${cardIndex}-${segmentIndex}`}
                className={blankClasses}
              >
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
          const isBlankCorrect = submitted
            ? isDragAnswerMatch(assignedValue, segment.solution)
            : false;
          const blankClasses = [
            "cloze-blank",
            "drag",
            hasToken ? "filled" : "",
            submitted ? (isBlankCorrect ? "correct" : "incorrect") : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={`cloze-blank-${cardIndex}-${segmentIndex}`}
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
        })}
      </div>
      {hasDragTokens ? (
        <div className="token-section">
          <span className="label">Tokens</span>
          <div className="token-pool">
            {card.dragTokens.map((token) => {
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
      <div className="flashcard-actions">
        <button
          type="button"
          className="ghost small flashcard-submit"
          onClick={() => onSubmit(cardIndex, canSubmit)}
          disabled={submitted || !canSubmit}
        >
          Submit
        </button>
        {submitted ? (
          <span className={`flashcard-result ${isCorrect ? "correct" : "incorrect"}`}>
            {resultLabel}
          </span>
        ) : null}
      </div>
      {submitted ? (
        <div className="token-solution">
          <span className="label">Solution</span>
          <div className="cloze-solution">
            {card.segments.map((segment, segmentIndex) => {
              if (segment.type === "text") {
                return (
                  <span key={`solution-text-${cardIndex}-${segmentIndex}`}>
                    {segment.value}
                  </span>
                );
              }
              return (
                <span
                  key={`solution-blank-${cardIndex}-${segmentIndex}`}
                  className="cloze-solution-token"
                >
                  {segment.solution}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
};
