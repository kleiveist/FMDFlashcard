/**
 * @file frontend/src/components/flashcards/ClozeCard.tsx
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
 * - frontend/src/lib/flashcards.ts: Hilfsfunktionen oder Typen.
 * - frontend/src/features/flashcards/logic.ts: Feature-Logik oder Hook.
 *
 * Exportiert:
 * - ClozeCard: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  memo,
  type DragEvent,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
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
import { renderMarkdownMathNode } from "../../lib/markdownMath";
import { findTableLineIndices } from "../../lib/markdownTables";
import { HelpButton, hasHelpContent } from "../HelpButton";
import { FlashcardMediaGroup } from "./FlashcardMediaGroup";
import type { VaultPngAsset } from "../../lib/tree";

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
  resultHeaderAction?: ReactNode;
  helpText?: string[] | string;
  helpEnabled?: boolean;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
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

type ActiveInputState = {
  blankId: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
};

const POINTER_DRAG_THRESHOLD = 8;

const SEGMENT_KEY_SEPARATOR = "\u001e";
const SEGMENT_VALUE_SEPARATOR = "\u001f";
const TOKEN_KEY_SEPARATOR = "\u001d";

const areStringRecordValuesEqual = (
  previous: Record<string, string>,
  next: Record<string, string>,
) => {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }
  for (const key of previousKeys) {
    if (previous[key] !== next[key]) {
      return false;
    }
  }
  return true;
};

const buildClozeSegmentStructureKey = (segments: ClozeCardType["segments"]) =>
  segments
    .map((segment) => {
      if (segment.type === "text") {
        return `text${SEGMENT_VALUE_SEPARATOR}${segment.value}`;
      }
      if (segment.kind === "input") {
        return [
          "blank-input",
          segment.id,
          segment.solution,
          (segment.acceptedSolutions ?? []).join(SEGMENT_VALUE_SEPARATOR),
        ].join(SEGMENT_VALUE_SEPARATOR);
      }
      return ["blank-drag", segment.id, segment.solution].join(SEGMENT_VALUE_SEPARATOR);
    })
    .join(SEGMENT_KEY_SEPARATOR);

const buildClozeTokenStructureKey = (tokens: ClozeCardType["dragTokens"]) =>
  tokens.map((token) => `${token.id}${SEGMENT_VALUE_SEPARATOR}${token.value}`).join(
    TOKEN_KEY_SEPARATOR,
  );

const createShuffleEntropy = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const areHelpTextPropsEqual = (
  previous: ClozeCardProps["helpText"],
  next: ClozeCardProps["helpText"],
) => {
  if (previous === next) {
    return true;
  }
  if (
    typeof previous === "string" ||
    typeof next === "string" ||
    !Array.isArray(previous) ||
    !Array.isArray(next)
  ) {
    return false;
  }
  if (previous.length !== next.length) {
    return false;
  }
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index] !== next[index]) {
      return false;
    }
  }
  return true;
};

const areClozeCardPropsEqual = (previous: ClozeCardProps, next: ClozeCardProps) =>
  previous.card === next.card &&
  previous.cardIndex === next.cardIndex &&
  previous.submitted === next.submitted &&
  areStringRecordValuesEqual(previous.responses, next.responses) &&
  previous.submissionLocked === next.submissionLocked &&
  previous.partIndex === next.partIndex &&
  previous.showSubmit === next.showSubmit &&
  previous.showResult === next.showResult &&
  previous.revealCorrectness === next.revealCorrectness &&
  previous.showSolution === next.showSolution &&
  previous.resultHeaderAction === next.resultHeaderAction &&
  areHelpTextPropsEqual(previous.helpText, next.helpText) &&
  previous.helpEnabled === next.helpEnabled &&
  previous.vaultPath === next.vaultPath &&
  previous.vaultPngAssets === next.vaultPngAssets &&
  previous.onInputChange === next.onInputChange &&
  previous.onTokenDrop === next.onTokenDrop &&
  previous.onTokenRemove === next.onTokenRemove &&
  previous.onTokenDragStart === next.onTokenDragStart &&
  previous.onBlankDragOver === next.onBlankDragOver &&
  previous.onSubmit === next.onSubmit;

const ClozeCardComponent = ({
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
  resultHeaderAction,
  helpText,
  helpEnabled,
  vaultPath,
  vaultPngAssets,
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
  const inputElementByBlankIdRef = useRef<Map<string, HTMLInputElement>>(new Map());
  const inputRefCallbackByBlankIdRef = useRef<
    Map<string, (element: HTMLInputElement | null) => void>
  >(new Map());
  const activeInputStateRef = useRef<ActiveInputState>({
    blankId: null,
    selectionStart: null,
    selectionEnd: null,
  });
  const suppressFocusRestoreRef = useRef(false);
  const pendingFocusRestoreRef = useRef(false);
  const segmentStructureKey = useMemo(
    () => buildClozeSegmentStructureKey(card.segments),
    [card.segments],
  );
  const stableSegmentsRef = useRef<{
    key: string;
    value: ClozeCardType["segments"];
  }>({
    key: segmentStructureKey,
    value: card.segments,
  });
  if (stableSegmentsRef.current.key !== segmentStructureKey) {
    stableSegmentsRef.current = {
      key: segmentStructureKey,
      value: card.segments,
    };
  }
  const stableSegments = stableSegmentsRef.current.value;
  const tokenStructureKey = useMemo(
    () => buildClozeTokenStructureKey(card.dragTokens),
    [card.dragTokens],
  );
  const stableDragTokensRef = useRef<{
    key: string;
    value: ClozeCardType["dragTokens"];
  }>({
    key: tokenStructureKey,
    value: card.dragTokens,
  });
  if (stableDragTokensRef.current.key !== tokenStructureKey) {
    stableDragTokensRef.current = {
      key: tokenStructureKey,
      value: card.dragTokens,
    };
  }
  const stableDragTokens = stableDragTokensRef.current.value;
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [activeDropBlankId, setActiveDropBlankId] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedTokenState | null>(null);
  const blanks = useMemo(() => getClozeBlanks(stableSegments), [stableSegments]);
  const dragBlanks = useMemo(
    () => blanks.filter((blank) => blank.kind === "drag"),
    [blanks],
  );
  const dragBlankIds = useMemo(
    () => new Set(dragBlanks.map((blank) => blank.id)),
    [dragBlanks],
  );
  const tokenById = useMemo(
    () => new Map(stableDragTokens.map((token) => [token.id, token.value])),
    [stableDragTokens],
  );
  const { placeholderText, blankById, blankOrderById } = useMemo(() => {
    let text = "";
    const blankMap = new Map<string, Extract<ClozeCardType["segments"][number], { type: "blank" }>>();
    const orderMap = new Map<string, number>();
    let blankIndex = 0;

    stableSegments.forEach((segment) => {
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
  }, [stableSegments]);
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
  const shuffleTriggerKey = `${cardIndex}${SEGMENT_VALUE_SEPARATOR}${normalizedPartIndex}${SEGMENT_VALUE_SEPARATOR}${segmentStructureKey}${SEGMENT_VALUE_SEPARATOR}${tokenStructureKey}`;
  const tokenShuffleStateRef = useRef<{
    triggerKey: string;
    seed: number;
  } | null>(null);
  if (
    !tokenShuffleStateRef.current ||
    tokenShuffleStateRef.current.triggerKey !== shuffleTriggerKey
  ) {
    tokenShuffleStateRef.current = {
      triggerKey: shuffleTriggerKey,
      seed: resolveSeed(createShuffleEntropy()),
    };
  }
  const tokenShuffleSeed = tokenShuffleStateRef.current.seed;
  const tokenBank = useMemo(() => {
    return seededShuffle(stableDragTokens, tokenShuffleSeed);
  }, [stableDragTokens, tokenShuffleSeed]);
  const stableResponsesRef = useRef(responses);
  if (!areStringRecordValuesEqual(stableResponsesRef.current, responses)) {
    stableResponsesRef.current = responses;
  }
  const stableResponses = stableResponsesRef.current;
  const assignedTokenIds = useMemo(
    () =>
      new Set(
        dragBlanks
          .map((blank) => stableResponses[blank.id])
          .filter((tokenId) => tokenById.has(tokenId)),
      ),
    [dragBlanks, stableResponses, tokenById],
  );
  const hasDragTokens = tokenBank.length > 0;
  const validTokenIds = useMemo(
    () => new Set(stableDragTokens.map((token) => token.id)),
    [stableDragTokens],
  );
  const canSubmit = areClozeBlanksComplete(card, stableResponses);
  const isCorrect = isClozeCardCorrect(card, stableResponses);
  const reveal = revealCorrectness ?? submitted;
  const shouldShowSolution = showSolution ?? submitted;
  const resultLabel = submitted && showResult ? (isCorrect ? "Correct" : "Incorrect") : "";
  const hasHelp = helpEnabled && hasHelpContent(helpText);
  const showActions = showSubmit || (submitted && showResult) || hasHelp;
  const onInputChangeRef = useRef(onInputChange);
  const onTokenDropRef = useRef(onTokenDrop);
  const onTokenRemoveRef = useRef(onTokenRemove);
  const onTokenDragStartRef = useRef(onTokenDragStart);
  const onBlankDragOverRef = useRef(onBlankDragOver);
  const onSubmitRef = useRef(onSubmit);
  onInputChangeRef.current = onInputChange;
  onTokenDropRef.current = onTokenDrop;
  onTokenRemoveRef.current = onTokenRemove;
  onTokenDragStartRef.current = onTokenDragStart;
  onBlankDragOverRef.current = onBlankDragOver;
  onSubmitRef.current = onSubmit;

  const clearActiveInputState = useCallback(() => {
    activeInputStateRef.current = {
      blankId: null,
      selectionStart: null,
      selectionEnd: null,
    };
    pendingFocusRestoreRef.current = false;
  }, []);

  const updateTrackedInputSelection = useCallback(
    (blankId: string, input: HTMLInputElement) => {
      if (activeInputStateRef.current.blankId !== blankId) {
        return;
      }
      activeInputStateRef.current = {
        blankId,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      };
    },
    [],
  );

  const trackFocusedInput = useCallback((blankId: string, input: HTMLInputElement) => {
    suppressFocusRestoreRef.current = false;
    pendingFocusRestoreRef.current = false;
    activeInputStateRef.current = {
      blankId,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
    };
  }, []);

  const registerInputElement = useCallback(
    (blankId: string, element: HTMLInputElement | null) => {
      if (element) {
        inputElementByBlankIdRef.current.set(blankId, element);
        return;
      }
      if (
        activeInputStateRef.current.blankId === blankId &&
        !suppressFocusRestoreRef.current
      ) {
        pendingFocusRestoreRef.current = true;
      }
      inputElementByBlankIdRef.current.delete(blankId);
    },
    [],
  );

  const getInputRefCallback = useCallback(
    (blankId: string) => {
      const existing = inputRefCallbackByBlankIdRef.current.get(blankId);
      if (existing) {
        return existing;
      }
      const callback = (element: HTMLInputElement | null) => {
        registerInputElement(blankId, element);
      };
      inputRefCallbackByBlankIdRef.current.set(blankId, callback);
      return callback;
    },
    [registerInputElement],
  );

  const handleInputBlur = useCallback(
    (blankId: string, event: ReactFocusEvent<HTMLInputElement>) => {
      updateTrackedInputSelection(blankId, event.currentTarget);
      if (event.relatedTarget instanceof Element) {
        suppressFocusRestoreRef.current = true;
        clearActiveInputState();
      }
    },
    [clearActiveInputState, updateTrackedInputSelection],
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const activeBlankId = activeInputStateRef.current.blankId;
      if (!activeBlankId) {
        return;
      }
      const activeInput = inputElementByBlankIdRef.current.get(activeBlankId);
      const targetNode = event.target instanceof Node ? event.target : null;
      if (!targetNode) {
        return;
      }
      if (activeInput?.contains(targetNode)) {
        return;
      }
      suppressFocusRestoreRef.current = true;
      clearActiveInputState();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [clearActiveInputState]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (!pendingFocusRestoreRef.current) {
      return;
    }
    if (suppressFocusRestoreRef.current) {
      return;
    }
    const state = activeInputStateRef.current;
    if (!state.blankId) {
      return;
    }
    const targetInput = inputElementByBlankIdRef.current.get(state.blankId);
    if (!targetInput || targetInput.disabled || !targetInput.isConnected) {
      return;
    }
    if (document.activeElement === targetInput) {
      pendingFocusRestoreRef.current = false;
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      return;
    }
    try {
      targetInput.focus({ preventScroll: true });
    } catch {
      targetInput.focus();
    }
    const valueLength = targetInput.value.length;
    const resolvedStart =
      state.selectionStart === null
        ? valueLength
        : Math.min(valueLength, Math.max(0, state.selectionStart));
    const resolvedEndRaw =
      state.selectionEnd === null
        ? resolvedStart
        : Math.min(valueLength, Math.max(0, state.selectionEnd));
    const resolvedEnd = Math.max(resolvedStart, resolvedEndRaw);
    targetInput.setSelectionRange(resolvedStart, resolvedEnd);
    pendingFocusRestoreRef.current = false;
  });

  const resolveDropBlankId = useCallback((clientX: number, clientY: number) => {
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
  }, [dragBlankIds]);

  const createSyntheticDragEvent = useCallback((payload: ClozeDragPayload) => {
    const dataTransfer = {
      getData: (type: string) =>
        type === CLOZE_TOKEN_DRAG_TYPE ? JSON.stringify(payload) : "",
    };
    return {
      preventDefault: () => {},
      dataTransfer,
    } as DragEvent<HTMLElement>;
  }, []);

  const dispatchInputChange = useCallback(
    (blankId: string, value: string) => {
      onInputChangeRef.current(cardIndex, blankId, value);
    },
    [cardIndex],
  );

  const dispatchTokenDrop = useCallback(
    (event: DragEvent<HTMLElement>, blankId: string) => {
      onTokenDropRef.current(event, cardIndex, blankId, validTokenIds, dragBlankIds);
    },
    [cardIndex, dragBlankIds, validTokenIds],
  );

  const dispatchTokenDropFromPayload = useCallback(
    (payload: ClozeDragPayload, blankId: string) => {
      onTokenDropRef.current(
        createSyntheticDragEvent(payload),
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [cardIndex, createSyntheticDragEvent, dragBlankIds, validTokenIds],
  );

  const dispatchTokenRemove = useCallback(
    (blankId: string) => {
      onTokenRemoveRef.current(cardIndex, blankId);
    },
    [cardIndex],
  );

  const dispatchTokenDragStart = useCallback(
    (
      event: DragEvent<HTMLElement>,
      payload: { cardIndex: number; tokenId: string; partIndex?: number },
    ) => {
      onTokenDragStartRef.current(event, payload);
    },
    [],
  );

  const dispatchBlankDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    onBlankDragOverRef.current(event);
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmitRef.current(cardIndex, canSubmit);
  }, [cardIndex, canSubmit]);

  const handleTokenPointerDown = useCallback((
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
  }, [submitted]);

  const handleTokenPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
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
  }, [resolveDropBlankId]);

  const finishPointerDrag = useCallback((
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
        dispatchTokenDropFromPayload(payload, blankId);
      } else if (state.sourceBlankId) {
        dispatchTokenRemove(state.sourceBlankId);
      }
    }
    setDragGhost(null);
    setActiveDropBlankId(null);
  }, [
    cardIndex,
    dispatchTokenDropFromPayload,
    dispatchTokenRemove,
    partIndex,
    resolveDropBlankId,
  ]);

  const handleTokenPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) =>
      finishPointerDrag(event, false),
    [finishPointerDrag],
  );

  const handleTokenPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) =>
      finishPointerDrag(event, true),
    [finishPointerDrag],
  );

  const handleTokenClick = useCallback((
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
  }, [selectedToken?.tokenId, submitted]);

  const handleBlankClick = useCallback((blankId: string) => {
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
    dispatchTokenDropFromPayload(payload, blankId);
    setSelectedToken(null);
  }, [
    cardIndex,
    dispatchTokenDropFromPayload,
    partIndex,
    selectedToken,
    submitted,
  ]);

  const handleTokenRemoveClick = useCallback((blankId: string, tokenId: string) => {
    if (selectedToken?.tokenId === tokenId) {
      setSelectedToken(null);
    }
    dispatchTokenRemove(blankId);
  }, [dispatchTokenRemove, selectedToken?.tokenId]);

  const renderBlank = useCallback(
    (blankId: string) => {
      const segment = blankById.get(blankId);
      if (!segment) {
        return null;
      }
      const blankNumber = blankOrderById.get(blankId) ?? 0;

      if (segment.kind === "input") {
        const value = stableResponses[segment.id] ?? "";
        const isBlankCorrect = reveal
          ? isInputAnswerMatch(value, segment.solution, segment.acceptedSolutions)
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
              ref={getInputRefCallback(segment.id)}
              type="text"
              className="cloze-input"
              value={value}
              onFocus={(event) => trackFocusedInput(segment.id, event.currentTarget)}
              onBlur={(event) => handleInputBlur(segment.id, event)}
              onSelect={(event) =>
                updateTrackedInputSelection(segment.id, event.currentTarget)
              }
              onClick={(event) =>
                updateTrackedInputSelection(segment.id, event.currentTarget)
              }
              onKeyUp={(event) =>
                updateTrackedInputSelection(segment.id, event.currentTarget)
              }
              onChange={(event) => {
                updateTrackedInputSelection(segment.id, event.currentTarget);
                dispatchInputChange(segment.id, event.target.value);
              }}
              disabled={submitted}
              placeholder="____"
              aria-label={`Blank ${blankNumber}`}
            />
          </span>
        );
      }

      const assignedTokenId = stableResponses[segment.id] ?? "";
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
          onDragOver={dispatchBlankDragOver}
          onDrop={(event) => dispatchTokenDrop(event, segment.id)}
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
                  dispatchTokenDragStart(event, {
                    cardIndex,
                    tokenId: assignedTokenId,
                    partIndex,
                  })
                }
                onClick={(event) =>
                  handleTokenClick(event, assignedTokenId, assignedValue, segment.id)
                }
                onPointerDown={(event) =>
                  handleTokenPointerDown(
                    event,
                    assignedTokenId,
                    assignedValue,
                    segment.id,
                  )
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
    },
    [
      activeDropBlankId,
      blankById,
      blankOrderById,
      cardIndex,
      dispatchBlankDragOver,
      dispatchInputChange,
      dispatchTokenDragStart,
      dispatchTokenDrop,
      dragGhost?.tokenId,
      handleBlankClick,
      handleTokenClick,
      handleTokenPointerCancel,
      handleTokenPointerDown,
      handleTokenPointerMove,
      handleTokenPointerUp,
      getInputRefCallback,
      handleInputBlur,
      trackFocusedInput,
      updateTrackedInputSelection,
      partIndex,
      reveal,
      selectedToken?.tokenId,
      stableResponses,
      submitted,
      tokenById,
      handleTokenRemoveClick,
    ],
  );

  const renderSolutionBlank = useCallback(
    (blankId: string) => {
      const segment = blankById.get(blankId);
      if (!segment) {
        return null;
      }
      return (
        <span className="cloze-solution-token">
          {renderMarkdownMathNode(segment.solution, {
            keyPrefix: `cloze-solution-blank-${cardIndex}-${blankId}`,
          })}
        </span>
      );
    },
    [blankById, cardIndex],
  );

  return (
    <article
      ref={cardRef}
      className={`flashcard-item cloze-card${selectedToken ? " is-selecting" : ""}`}
    >
      {questionText.trim() ? (
        <h3 className="flashcard-question">
          {renderMarkdownMathNode(questionText, {
            keyPrefix: `cloze-question-${cardIndex}`,
          })}
        </h3>
      ) : null}
      <FlashcardMediaGroup
        media={card.media}
        vaultPngAssets={vaultPngAssets}
        vaultPath={vaultPath}
      />
      <MarkdownBlocks
        text={markdownText}
        className="cloze-text"
        allowTableScroll={false}
        renderPlaceholder={renderBlank}
        vaultPath={vaultPath}
        vaultPngAssets={vaultPngAssets}
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
                    dispatchTokenDragStart(event, {
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
              onClick={handleSubmit}
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
          {submitted && showResult ? resultHeaderAction : null}
          <HelpButton
            helpText={helpText}
            enabled={helpEnabled}
            className="flashcard-help-button"
            vaultPath={vaultPath}
            vaultPngAssets={vaultPngAssets}
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
            vaultPath={vaultPath}
            vaultPngAssets={vaultPngAssets}
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

ClozeCardComponent.displayName = "ClozeCard";

export const ClozeCard = memo(ClozeCardComponent, areClozeCardPropsEqual);
