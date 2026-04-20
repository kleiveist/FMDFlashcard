/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ExamCanvas.tsx
 */

import {
  type DragEvent,
  type ReactNode,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertIcon, CheckIcon } from "../../../components/icons";
import type { ExamBlueprint, ExamTaskBlueprint, CardType } from "../../../features/exam-editor/types";
import type { ExamEditorSelection } from "../types";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  hasDragType,
  readInternalDrag,
  readInternalDragText,
  setDropEffectSafe,
  startInternalDrag,
} from "../../../lib/dragDrop";

const CARD_TYPES: CardType[] = ["qa", "tf", "m1", "m2", "cl", "cd", "cld"];

type ExamCanvasProps = {
  exam: ExamBlueprint;
  selection: ExamEditorSelection;
  validationSummary: { count: number; messages: string[] } | null;
  onSelectTask: (taskId: string) => void;
  onSelectCard: (taskId: string, cardId: string) => void;
  onCanvasDrop: (cardType: CardType) => void;
  onTaskDrop: (taskId: string, cardType: CardType) => void;
  onReorderTask: (sourceIndex: number, targetIndex: number) => void;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderCard: (taskId: string, sourceIndex: number, targetIndex: number) => void;
  onMoveCardAcrossTasks: (
    sourceTaskId: string,
    targetTaskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
  onDeleteCard: (taskId: string, cardId: string) => void;
  showMoveButtons: boolean;
  getTaskWarning: (task: ExamTaskBlueprint) => string | null;
  topContent?: ReactNode;
  bodyContent?: ReactNode;
  bottomContent?: ReactNode;
  headerActions?: ReactNode;
  sideContent?: ReactNode;
};

type DragPayload =
  | { kind: "task"; taskId: string }
  | { kind: "card"; taskId: string; cardId: string };

type TaskDropTarget = {
  taskId: string;
  position: "before" | "after";
};

type CardDropTarget = {
  taskId: string;
  cardId: string | null;
  position: "before" | "after";
};

const TASK_DRAG_TYPE = "application/x-fmd-task";
const CARD_DRAG_TYPE = "application/x-fmd-card";
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_SPEED = 18;

const resolveDropType = (event: DragEvent<HTMLElement>) => {
  const internalValue = readInternalDragText(event, {
    channel: DRAG_CHANNELS.EXAM_CARD_TYPE,
  }).trim();
  if (CARD_TYPES.includes(internalValue as CardType)) {
    return internalValue as CardType;
  }
  let value = "";
  try {
    value =
      event.dataTransfer.getData("application/x-fmd-card-type") ||
      event.dataTransfer.getData("text/plain");
  } catch {
    value = "";
  }
  if (!value) {
    return null;
  }
  return CARD_TYPES.includes(value as CardType) ? (value as CardType) : null;
};

const allowDrop = (event: DragEvent<HTMLElement>) => {
  const hasLegacyType = hasDragType(event, "application/x-fmd-card-type");
  const internalType = readInternalDragText(event, {
    channel: DRAG_CHANNELS.EXAM_CARD_TYPE,
  }).trim();
  const hasInternalType = CARD_TYPES.includes(internalType as CardType);
  if (!hasLegacyType && !hasInternalType) {
    return;
  }
  event.preventDefault();
  setDropEffectSafe(event, "copy");
};

export const ExamCanvas = ({
  exam,
  selection,
  validationSummary,
  onSelectTask,
  onSelectCard,
  onCanvasDrop,
  onTaskDrop,
  onReorderTask,
  onDuplicateTask,
  onDeleteTask,
  onReorderCard,
  onMoveCardAcrossTasks,
  onDeleteCard,
  showMoveButtons,
  getTaskWarning,
  topContent,
  bodyContent,
  bottomContent,
  headerActions,
  sideContent,
}: ExamCanvasProps) => {
  const isSplitLayout = Boolean(sideContent) && !bodyContent;
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [taskDropTarget, setTaskDropTarget] = useState<TaskDropTarget | null>(null);
  const [cardDropTarget, setCardDropTarget] = useState<CardDropTarget | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollPointerRef = useRef<number | null>(null);
  const orderedTasks = useMemo(
    () => exam.tasks.slice().sort((a, b) => a.order - b.order),
    [exam.tasks],
  );
  const hasValidationErrors = Boolean(
    validationSummary && validationSummary.count > 0,
  );
  const validationLabel = hasValidationErrors
    ? `Cannot save: ${validationSummary?.count ?? 0} validation ${
        validationSummary?.count === 1 ? "error" : "errors"
      }`
    : "All checks passed.";

  useEffect(() => {
    dragPayloadRef.current = dragPayload;
    if (!dragPayload) {
      autoScrollPointerRef.current = null;
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    }
  }, [dragPayload]);

  useEffect(() => {
    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };
  }, []);

  const clearDragState = () => {
    setDragPayload(null);
    setTaskDropTarget(null);
    setCardDropTarget(null);
    endInternalDrag(DRAG_CHANNELS.EXAM_TASK);
    endInternalDrag(DRAG_CHANNELS.EXAM_CARD);
  };

  const resolveActiveDragPayload = (event: DragEvent<HTMLElement>) => {
    if (dragPayload) {
      return dragPayload;
    }
    const taskPayload = readInternalDrag<{ taskId: string }>(event, {
      channel: DRAG_CHANNELS.EXAM_TASK,
    });
    if (taskPayload && typeof taskPayload.taskId === "string") {
      return { kind: "task", taskId: taskPayload.taskId } satisfies DragPayload;
    }
    const cardPayload = readInternalDrag<{ taskId: string; cardId: string }>(event, {
      channel: DRAG_CHANNELS.EXAM_CARD,
    });
    if (
      cardPayload &&
      typeof cardPayload.taskId === "string" &&
      typeof cardPayload.cardId === "string"
    ) {
      return {
        kind: "card",
        taskId: cardPayload.taskId,
        cardId: cardPayload.cardId,
      } satisfies DragPayload;
    }
    return null;
  };

  const handleAutoScroll = (clientY: number) => {
    autoScrollPointerRef.current = clientY;
    if (autoScrollFrameRef.current !== null) {
      return;
    }
    const step = () => {
      const container = scrollContainerRef.current;
      const pointerY = autoScrollPointerRef.current;
      if (!container || pointerY === null || !dragPayloadRef.current) {
        autoScrollPointerRef.current = null;
        if (autoScrollFrameRef.current !== null) {
          window.cancelAnimationFrame(autoScrollFrameRef.current);
          autoScrollFrameRef.current = null;
        }
        return;
      }
      const rect = container.getBoundingClientRect();
      let delta = 0;
      if (pointerY < rect.top + AUTO_SCROLL_EDGE) {
        const distance = rect.top + AUTO_SCROLL_EDGE - pointerY;
        delta = -Math.min(
          AUTO_SCROLL_SPEED,
          (distance / AUTO_SCROLL_EDGE) * AUTO_SCROLL_SPEED,
        );
      } else if (pointerY > rect.bottom - AUTO_SCROLL_EDGE) {
        const distance = pointerY - (rect.bottom - AUTO_SCROLL_EDGE);
        delta = Math.min(
          AUTO_SCROLL_SPEED,
          (distance / AUTO_SCROLL_EDGE) * AUTO_SCROLL_SPEED,
        );
      }
      if (delta !== 0) {
        container.scrollTop += delta;
      }
      autoScrollFrameRef.current = window.requestAnimationFrame(step);
    };
    autoScrollFrameRef.current = window.requestAnimationFrame(step);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    const cardType = resolveDropType(event);
    if (!cardType) {
      return;
    }
    event.preventDefault();
    onCanvasDrop(cardType);
    endInternalDrag(DRAG_CHANNELS.EXAM_CARD_TYPE);
  };

  const getDropPosition = (event: DragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    return event.clientY <= midpoint ? "before" : "after";
  };

  const handleTaskDragStart = (event: DragEvent<HTMLDivElement>, taskId: string) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".exam-task-actions")) {
      event.preventDefault();
      return;
    }
    startInternalDrag(event, {
      channel: DRAG_CHANNELS.EXAM_TASK,
      payload: { taskId },
      plainTextFallback: taskId,
      effectAllowed: "move",
    });
    try {
      event.dataTransfer.setData(TASK_DRAG_TYPE, taskId);
    } catch {
      // ignore restricted dataTransfer implementations
    }
    setDragPayload({ kind: "task", taskId });
  };

  const handleCardDragStart = (
    event: DragEvent<HTMLDivElement>,
    taskId: string,
    cardId: string,
  ) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".exam-card-actions")) {
      event.preventDefault();
      return;
    }
    startInternalDrag(event, {
      channel: DRAG_CHANNELS.EXAM_CARD,
      payload: { taskId, cardId },
      plainTextFallback: `${taskId}:${cardId}`,
      effectAllowed: "move",
    });
    try {
      event.dataTransfer.setData(
        CARD_DRAG_TYPE,
        JSON.stringify({ taskId, cardId }),
      );
    } catch {
      // ignore restricted dataTransfer implementations
    }
    setDragPayload({ kind: "card", taskId, cardId });
  };

  const handleDragEnd = () => {
    clearDragState();
    autoScrollPointerRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const handleTaskDragOver = (
    event: DragEvent<HTMLLIElement>,
    taskId: string,
    isEmpty: boolean,
  ) => {
    const cardType = resolveDropType(event);
    if (cardType) {
      event.preventDefault();
      setDropEffectSafe(event, "copy");
      handleAutoScroll(event.clientY);
      return;
    }
    const activeDragPayload = resolveActiveDragPayload(event);
    if (!activeDragPayload) {
      return;
    }
    if (activeDragPayload.kind === "task") {
      event.preventDefault();
      setDropEffectSafe(event, "move");
      const position = getDropPosition(event);
      setTaskDropTarget({ taskId, position });
      handleAutoScroll(event.clientY);
      return;
    }
    if (activeDragPayload.kind === "card" && isEmpty) {
      event.preventDefault();
      setDropEffectSafe(event, "move");
      setCardDropTarget({ taskId, cardId: null, position: "after" });
      handleAutoScroll(event.clientY);
    }
  };

  const handleTaskDrop = (event: DragEvent<HTMLLIElement>, taskId: string) => {
    const cardType = resolveDropType(event);
    if (cardType) {
      event.preventDefault();
      event.stopPropagation();
      onTaskDrop(taskId, cardType);
      endInternalDrag(DRAG_CHANNELS.EXAM_CARD_TYPE);
      clearDragState();
      return;
    }
    const activeDragPayload = resolveActiveDragPayload(event);
    if (!activeDragPayload) {
      return;
    }
    if (activeDragPayload.kind === "card") {
      event.preventDefault();
      event.stopPropagation();
      const sourceTask = orderedTasks.find(
        (task) => task.id === activeDragPayload.taskId,
      );
      const targetTask = orderedTasks.find((task) => task.id === taskId);
      if (!sourceTask || !targetTask) {
        clearDragState();
        return;
      }
      if (targetTask.cards.length !== 0) {
        clearDragState();
        return;
      }
      const sourceIndex = sourceTask.cards.findIndex(
        (card) => card.id === activeDragPayload.cardId,
      );
      if (sourceIndex === -1) {
        clearDragState();
        return;
      }
      if (activeDragPayload.taskId === taskId) {
        clearDragState();
        return;
      }
      onMoveCardAcrossTasks(
        activeDragPayload.taskId,
        taskId,
        sourceIndex,
        0,
      );
      onSelectCard(taskId, activeDragPayload.cardId);
      clearDragState();
      return;
    }
    if (activeDragPayload.kind !== "task") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const position = getDropPosition(event);
    const sourceIndex = orderedTasks.findIndex(
      (task) => task.id === activeDragPayload.taskId,
    );
    const targetIndex = orderedTasks.findIndex((task) => task.id === taskId);
    if (sourceIndex === -1 || targetIndex === -1) {
      clearDragState();
      return;
    }
    let insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    if (sourceIndex < insertIndex) {
      insertIndex -= 1;
    }
    if (insertIndex !== sourceIndex) {
      onReorderTask(sourceIndex, insertIndex);
    }
    clearDragState();
  };

  const handleCardDragOver = (
    event: DragEvent<HTMLDivElement>,
    taskId: string,
    cardId: string,
  ) => {
    const activeDragPayload = resolveActiveDragPayload(event);
    if (!activeDragPayload || activeDragPayload.kind !== "card") {
      return;
    }
    event.preventDefault();
    setDropEffectSafe(event, "move");
    const position = getDropPosition(event);
    setCardDropTarget({ taskId, cardId, position });
    handleAutoScroll(event.clientY);
  };

  const handleCardListDragOver = (
    event: DragEvent<HTMLDivElement>,
    taskId: string,
  ) => {
    const activeDragPayload = resolveActiveDragPayload(event);
    if (!activeDragPayload || activeDragPayload.kind !== "card") {
      return;
    }
    if (event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    setDropEffectSafe(event, "move");
    setCardDropTarget({ taskId, cardId: null, position: "after" });
    handleAutoScroll(event.clientY);
  };

  const handleCardDrop = (
    event: DragEvent<HTMLDivElement>,
    taskId: string,
    cardId: string,
  ) => {
    const activeDragPayload = resolveActiveDragPayload(event);
    if (!activeDragPayload || activeDragPayload.kind !== "card") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourceTask = orderedTasks.find(
      (entry) => entry.id === activeDragPayload.taskId,
    );
    const targetTask = orderedTasks.find((entry) => entry.id === taskId);
    if (!sourceTask || !targetTask) {
      clearDragState();
      return;
    }
    const sourceIndex = sourceTask.cards.findIndex(
      (card) => card.id === activeDragPayload.cardId,
    );
    const targetIndex = targetTask.cards.findIndex((card) => card.id === cardId);
    if (sourceIndex === -1 || targetIndex === -1) {
      clearDragState();
      return;
    }
    const position = getDropPosition(event);
    let insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    const sameTask = activeDragPayload.taskId === taskId;
    if (sameTask && sourceIndex < insertIndex) {
      insertIndex -= 1;
    }
    if (!sameTask || insertIndex !== sourceIndex) {
      if (sameTask) {
        onReorderCard(taskId, sourceIndex, insertIndex);
      } else {
        onMoveCardAcrossTasks(
          activeDragPayload.taskId,
          taskId,
          sourceIndex,
          insertIndex,
        );
      }
      onSelectCard(taskId, activeDragPayload.cardId);
    }
    clearDragState();
  };

  const handleCardListDrop = (
    event: DragEvent<HTMLDivElement>,
    taskId: string,
  ) => {
    const activeDragPayload = resolveActiveDragPayload(event);
    if (!activeDragPayload || activeDragPayload.kind !== "card") {
      return;
    }
    if (event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourceTask = orderedTasks.find(
      (entry) => entry.id === activeDragPayload.taskId,
    );
    const targetTask = orderedTasks.find((entry) => entry.id === taskId);
    if (!sourceTask || !targetTask) {
      clearDragState();
      return;
    }
    const sourceIndex = sourceTask.cards.findIndex(
      (card) => card.id === activeDragPayload.cardId,
    );
    if (sourceIndex === -1) {
      clearDragState();
      return;
    }
    if (activeDragPayload.taskId === taskId) {
      const insertIndex = Math.max(0, targetTask.cards.length - 1);
      if (insertIndex !== sourceIndex) {
        onReorderCard(taskId, sourceIndex, insertIndex);
      }
    } else {
      onMoveCardAcrossTasks(
        activeDragPayload.taskId,
        taskId,
        sourceIndex,
        targetTask.cards.length,
      );
    }
    onSelectCard(taskId, activeDragPayload.cardId);
    clearDragState();
  };

  const handleCanvasDragOver = (event: DragEvent<HTMLDivElement>) => {
    allowDrop(event);
    if (dragPayload) {
      handleAutoScroll(event.clientY);
    }
  };

  const handleCanvasWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!dragPayload) {
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollTop += event.deltaY;
    event.preventDefault();
  };

  const handleMoveTask = (taskId: string, direction: "up" | "down") => {
    const sourceIndex = orderedTasks.findIndex((task) => task.id === taskId);
    if (sourceIndex === -1) {
      return;
    }
    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedTasks.length) {
      return;
    }
    onReorderTask(sourceIndex, targetIndex);
    onSelectTask(taskId);
  };

  const handleMoveCard = (
    taskId: string,
    cardId: string,
    direction: "up" | "down",
  ) => {
    const task = orderedTasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }
    const sourceIndex = task.cards.findIndex((card) => card.id === cardId);
    if (sourceIndex === -1) {
      return;
    }
    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (targetIndex < 0 || targetIndex >= task.cards.length) {
      return;
    }
    onReorderCard(taskId, sourceIndex, targetIndex);
    onSelectCard(taskId, cardId);
  };

  const taskList = (
    <div className="exam-canvas-section">
      {orderedTasks.length === 0 ? (
        <div className="exam-canvas-empty">
          <p>Drop a card type here to create task 1).</p>
        </div>
      ) : (
        <ul className="exam-task-list">
          {orderedTasks.map((task, index) => {
            const isTaskSelected =
              selection.type === "task" && selection.taskId === task.id;
            const isTaskDragging =
              dragPayload?.kind === "task" && dragPayload.taskId === task.id;
            const taskDropPosition =
              taskDropTarget?.taskId === task.id
                ? taskDropTarget.position
                : null;
            const isCardDropTarget =
              dragPayload?.kind === "card" &&
              cardDropTarget?.taskId === task.id;
            const warning = getTaskWarning(task);

            return (
              <li
                key={task.id}
                className={`exam-task-node ${
                  isTaskSelected ? "selected" : ""
                }${isTaskDragging ? " is-dragging" : ""}${
                  taskDropPosition ? " drop-target" : ""
                }${taskDropPosition ? ` drop-${taskDropPosition}` : ""}${
                  isCardDropTarget ? " card-drop-target" : ""
                }`}
                onDragOver={(event) =>
                  handleTaskDragOver(event, task.id, task.cards.length === 0)
                }
                onDrop={(event) => handleTaskDrop(event, task.id)}
              >
                <div
                  className="exam-task-header"
                  draggable
                  onDragStart={(event) => handleTaskDragStart(event, task.id)}
                  onDragEnd={handleDragEnd}
                >
                  <button
                    type="button"
                    className="exam-task-title"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectTask(task.id);
                    }}
                  >
                    <span className="task-number">{index + 1})</span>
                    <span className="task-title-text">
                      {task.title.trim() || "Untitled task"}
                    </span>
                  </button>
                  <div className="exam-task-actions">
                    {showMoveButtons ? (
                      <>
                        <button
                          type="button"
                          className="ghost small"
                          onClick={() => handleMoveTask(task.id, "up")}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="ghost small"
                          onClick={() => handleMoveTask(task.id, "down")}
                          disabled={index === orderedTasks.length - 1}
                        >
                          Down
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => onDuplicateTask(task.id)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="ghost small danger"
                      onClick={() => onDeleteTask(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="exam-task-body">
                  {warning ? (
                    <div className="exam-task-warning">{warning}</div>
                  ) : null}
                  <div
                    className={`exam-card-list${
                      dragPayload?.kind === "card" &&
                      cardDropTarget?.taskId === task.id &&
                      cardDropTarget.cardId === null
                        ? " drop-target drop-after"
                        : ""
                    }`}
                    onDragOver={(event) =>
                      handleCardListDragOver(event, task.id)
                    }
                    onDrop={(event) => handleCardListDrop(event, task.id)}
                  >
                    {task.cards.map((card, cardIndex) => {
                      const isCardSelected =
                        selection.type === "card" &&
                        selection.taskId === task.id &&
                        selection.cardId === card.id;
                      const isCardDragging =
                        dragPayload?.kind === "card" &&
                        dragPayload.taskId === task.id &&
                        dragPayload.cardId === card.id;
                      const cardDropPosition =
                        cardDropTarget?.taskId === task.id &&
                        cardDropTarget.cardId === card.id
                          ? cardDropTarget.position
                          : null;

                      return (
                        <div
                          key={card.id}
                          className={`exam-card-item ${
                            isCardSelected ? "selected" : ""
                          }${isCardDragging ? " is-dragging" : ""}${
                            cardDropPosition ? " drop-target" : ""
                          }${cardDropPosition ? ` drop-${cardDropPosition}` : ""}`}
                          draggable
                          onDragStart={(event) =>
                            handleCardDragStart(event, task.id, card.id)
                          }
                          onDragEnd={handleDragEnd}
                          onDragOver={(event) =>
                            handleCardDragOver(event, task.id, card.id)
                          }
                          onDrop={(event) =>
                            handleCardDrop(event, task.id, card.id)
                          }
                        >
                          <button
                            type="button"
                            className="exam-card-title"
                            onClick={() => onSelectCard(task.id, card.id)}
                          >
                            <span className="card-index">{cardIndex + 1})</span>
                            <span className="card-type">
                              {serializeCardTypeLabel(card.type)}
                            </span>
                            {card.helpText?.trim() ? (
                              <span className="card-hint">Hint</span>
                            ) : null}
                          </button>
                          <div className="exam-card-actions">
                            {showMoveButtons ? (
                              <>
                                <button
                                  type="button"
                                  className="ghost small"
                                  onClick={() => handleMoveCard(task.id, card.id, "up")}
                                  disabled={cardIndex === 0}
                                >
                                  Up
                                </button>
                                <button
                                  type="button"
                                  className="ghost small"
                                  onClick={() => handleMoveCard(task.id, card.id, "down")}
                                  disabled={cardIndex === task.cards.length - 1}
                                >
                                  Down
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              className="ghost small danger"
                              onClick={() => onDeleteCard(task.id, card.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <section
      className={`panel exam-editor-panel exam-canvas${isSplitLayout ? " is-split" : ""}`}
      onDragOver={allowDrop}
      onDrop={handleCanvasDrop}
    >
      <header className="panel-header exam-canvas-header">
        <div className="exam-canvas-title">
          <div className="exam-canvas-status" role="status">
            <button
              type="button"
              className={`exam-canvas-status-button ${
                hasValidationErrors ? "is-invalid" : "is-valid"
              }`}
              aria-label={validationLabel}
            >
              {hasValidationErrors ? <AlertIcon /> : <CheckIcon />}
            </button>
            <div className="exam-canvas-status-tooltip" role="tooltip">
              <div className="exam-canvas-status-title">{validationLabel}</div>
              {hasValidationErrors ? (
                <ul className="exam-canvas-status-list">
                  {validationSummary?.messages.map((message, index) => (
                    <li key={`${index}-${message}`}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <div>
            <h2>Canvas</h2>
            <p className="muted">Drop cards to create tasks and interactions.</p>
          </div>
        </div>
        {headerActions ? (
          <div className="exam-canvas-actions">{headerActions}</div>
        ) : null}
      </header>
      <div
        className="panel-body"
        ref={isSplitLayout ? undefined : scrollContainerRef}
        onDragOver={isSplitLayout ? undefined : handleCanvasDragOver}
        onWheel={isSplitLayout ? undefined : handleCanvasWheel}
      >
        {topContent ? <div className="exam-canvas-top">{topContent}</div> : null}
        {bodyContent ? (
          <div className="exam-canvas-body">{bodyContent}</div>
        ) : isSplitLayout ? (
          <div className="exam-canvas-split">
            <div
              className="exam-canvas-body exam-canvas-tasks"
              ref={scrollContainerRef}
              onDragOver={handleCanvasDragOver}
              onWheel={handleCanvasWheel}
            >
              {taskList}
            </div>
            <div className="exam-canvas-side">{sideContent}</div>
          </div>
        ) : (
          <div className="exam-canvas-body">{taskList}</div>
        )}
        {bottomContent ? (
          <div className="exam-canvas-bottom">{bottomContent}</div>
        ) : null}
      </div>
    </section>
  );
};
