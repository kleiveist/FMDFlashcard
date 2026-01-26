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

import {
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  type ClozeCard as ClozeCardType,
} from "../../lib/flashcards";
import {
  areClozeBlanksComplete,
  CLOZE_TOKEN_DRAG_TYPE,
  getClozeBlanks,
  isClozeCardCorrect,
  type ClozeDragPayload,
} from "../../features/flashcards/logic";
import { resolveSeed, seededShuffle } from "../../lib/seededShuffle";
import {
  CLOZE_PLACEHOLDER_PREFIX,
  CLOZE_PLACEHOLDER_SUFFIX,
  MarkdownBlocks,
} from "./MarkdownBlocks";
import { findTableLineIndices } from "../../lib/markdownTables";
import { HelpButton, hasHelpContent } from "../HelpButton";

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
  helpText?: string[] | string;
  helpEnabled?: boolean;
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

type PointerDragState = {
  pointerId: number;
  tokenId: string;
  tokenValue: string;
  sourceBlankId?: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  dragging: boolean;
};

type DragGhostState = {
  tokenId: string;
  tokenValue: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  sourceBlankId?: string;
};

type SelectedTokenState = {
  tokenId: string;
  tokenValue: string;
  sourceBlankId?: string;
};

const POINTER_DRAG_THRESHOLD = 8;

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
  helpText,
  helpEnabled,
  onBlankDragOver,
  onInputChange,
  onSubmit,
  onTokenDragStart,
  onTokenDrop,
  onTokenRemove,
}: ClozeCardProps) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const suppressClickRef = useRef(false);
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [activeDropBlankId, setActiveDropBlankId] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedTokenState | null>(null);
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
    const combinedLines = combinedText.split("\n");
    const tableLineIndices = findTableLineIndices(combinedLines);
    const isFenceStart = /^(```|~~~)/.test(combinedLines[0]?.trimStart() ?? "");
    if (tableLineIndices.has(0) || isFenceStart) {
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
  const hasHelp = helpEnabled && hasHelpContent(helpText);
  const showActions = showSubmit || (submitted && showResult) || hasHelp;

  const resolveDropBlankId = (clientX: number, clientY: number) => {
    if (typeof document === "undefined" || !document.elementsFromPoint) {
      return null;
    }
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      const dropzone = element.closest<HTMLElement>('[data-dropzone="cloze-blank"]');
      if (!dropzone) {
        continue;
      }
      if (cardRef.current && !cardRef.current.contains(dropzone)) {
        continue;
      }
      const blankId = dropzone.dataset.blankId;
      if (blankId && dragBlankIds.has(blankId)) {
        return blankId;
      }
    }
    return null;
  };

  const createSyntheticDragEvent = (payload: ClozeDragPayload) => {
    const dataTransfer = {
      getData: (type: string) =>
        type === CLOZE_TOKEN_DRAG_TYPE ? JSON.stringify(payload) : "",
    };
    return {
      preventDefault: () => {},
      dataTransfer,
    } as DragEvent<HTMLElement>;
  };

  const handleTokenPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    tokenId: string,
    tokenValue: string,
    sourceBlankId?: string,
  ) => {
    if (submitted) {
      return;
    }
    if (event.pointerType === "mouse") {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    setSelectedToken(null);
    const rect = event.currentTarget.getBoundingClientRect();
    pointerDragRef.current = {
      pointerId: event.pointerId,
      tokenId,
      tokenValue,
      sourceBlankId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      dragging: false,
    };
    setActiveDropBlankId(null);
    setDragGhost(null);
  };

  const handleTokenPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = pointerDragRef.current;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.dragging) {
      if (Math.hypot(deltaX, deltaY) < POINTER_DRAG_THRESHOLD) {
        return;
      }
      state.dragging = true;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragGhost({
        tokenId: state.tokenId,
        tokenValue: state.tokenValue,
        x: event.clientX,
        y: event.clientY,
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        sourceBlankId: state.sourceBlankId,
      });
    } else {
      event.preventDefault();
      setDragGhost((prev) =>
        prev ? { ...prev, x: event.clientX, y: event.clientY } : prev,
      );
    }
    const blankId = resolveDropBlankId(event.clientX, event.clientY);
    setActiveDropBlankId(blankId);
  };

  const finishPointerDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled: boolean,
  ) => {
    const state = pointerDragRef.current;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    pointerDragRef.current = null;
    if (state.dragging) {
      event.preventDefault();
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      suppressClickRef.current = true;
      const blankId = cancelled
        ? null
        : resolveDropBlankId(event.clientX, event.clientY);
      if (blankId) {
        const payload: ClozeDragPayload = {
          cardIndex,
          tokenId: state.tokenId,
          partIndex,
        };
        onTokenDrop(
          createSyntheticDragEvent(payload),
          cardIndex,
          blankId,
          validTokenIds,
          dragBlankIds,
        );
      } else if (state.sourceBlankId) {
        onTokenRemove(cardIndex, state.sourceBlankId);
      }
    }
    setDragGhost(null);
    setActiveDropBlankId(null);
  };

  const handleTokenPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) =>
    finishPointerDrag(event, false);

  const handleTokenPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) =>
    finishPointerDrag(event, true);

  const handleTokenClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    tokenId: string,
    tokenValue: string,
    sourceBlankId?: string,
  ) => {
    if (submitted) {
      return;
    }
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    event.stopPropagation();
    if (selectedToken?.tokenId === tokenId) {
      setSelectedToken(null);
      return;
    }
    setSelectedToken({ tokenId, tokenValue, sourceBlankId });
  };

  const handleBlankClick = (blankId: string) => {
    if (submitted) {
      return;
    }
    if (!selectedToken) {
      return;
    }
    const payload: ClozeDragPayload = {
      cardIndex,
      tokenId: selectedToken.tokenId,
      partIndex,
    };
    onTokenDrop(
      createSyntheticDragEvent(payload),
      cardIndex,
      blankId,
      validTokenIds,
      dragBlankIds,
    );
    setSelectedToken(null);
  };

  const handleTokenRemoveClick = (blankId: string, tokenId: string) => {
    if (selectedToken?.tokenId === tokenId) {
      setSelectedToken(null);
    }
    onTokenRemove(cardIndex, blankId);
  };

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
      activeDropBlankId === segment.id ? "drop-target" : "",
      reveal ? (isBlankCorrect ? "correct" : "incorrect") : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span
        className={blankClasses}
        aria-label={`Drop zone ${blankNumber}`}
        data-dropzone="cloze-blank"
        data-blank-id={segment.id}
        onClick={() => handleBlankClick(segment.id)}
        onDragOver={onBlankDragOver}
        onDrop={(event) =>
          onTokenDrop(event, cardIndex, segment.id, validTokenIds, dragBlankIds)
        }
      >
        {hasToken ? (
          <span className="cloze-token">
            <button
              type="button"
              className={`token-chip${
                dragGhost?.tokenId === assignedTokenId ? " is-dragging" : ""
              }${selectedToken?.tokenId === assignedTokenId ? " selected" : ""}`}
              draggable={!submitted}
              onDragStart={(event) =>
                onTokenDragStart(event, {
                  cardIndex,
                  tokenId: assignedTokenId,
                  partIndex,
                })
              }
              onClick={(event) =>
                handleTokenClick(event, assignedTokenId, assignedValue, segment.id)
              }
              onPointerDown={(event) =>
                handleTokenPointerDown(event, assignedTokenId, assignedValue, segment.id)
              }
              onPointerMove={handleTokenPointerMove}
              onPointerUp={handleTokenPointerUp}
              onPointerCancel={handleTokenPointerCancel}
              disabled={submitted}
            >
              {assignedValue}
            </button>
            {!submitted ? (
              <button
                type="button"
                className="token-remove"
                onClick={() => handleTokenRemoveClick(segment.id, assignedTokenId)}
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
    <article
      ref={cardRef}
      className={`flashcard-item cloze-card${selectedToken ? " is-selecting" : ""}`}
    >
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
                  className={`token-chip ${isUsed ? "used" : ""}${
                    dragGhost?.tokenId === token.id ? " is-dragging" : ""
                  }${selectedToken?.tokenId === token.id ? " selected" : ""}`}
                  draggable={!submitted && !isUsed}
                  onDragStart={(event) =>
                    onTokenDragStart(event, {
                      cardIndex,
                      tokenId: token.id,
                      partIndex,
                    })
                  }
                  onClick={(event) => handleTokenClick(event, token.id, token.value)}
                  onPointerDown={(event) =>
                    handleTokenPointerDown(event, token.id, token.value)
                  }
                  onPointerMove={handleTokenPointerMove}
                  onPointerUp={handleTokenPointerUp}
                  onPointerCancel={handleTokenPointerCancel}
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
          <HelpButton
            helpText={helpText}
            enabled={helpEnabled}
            className="flashcard-help-button"
          />
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
      {dragGhost && typeof document !== "undefined"
        ? createPortal(
            <div
              className="token-chip token-ghost"
              style={{
                transform: `translate3d(${
                  dragGhost.x - dragGhost.offsetX
                }px, ${dragGhost.y - dragGhost.offsetY}px, 0)`,
              }}
              aria-hidden="true"
            >
              {dragGhost.tokenValue}
            </div>,
            document.body,
          )
        : null}
    </article>
  );
};
