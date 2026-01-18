/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ExamCanvas.tsx
 */

import { type DragEvent, useMemo, useState } from "react";
import type { ExamBlueprint, ExamTaskBlueprint, CardType } from "../../../features/exam-editor/types";
import type { ExamEditorSelection } from "../types";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";

const CARD_TYPES: CardType[] = ["qa", "tf", "m1", "m2", "cl", "cd", "cld"];

type ExamCanvasProps = {
  exam: ExamBlueprint;
  selection: ExamEditorSelection;
  onSelectExam: () => void;
  onSelectTask: (taskId: string) => void;
  onSelectCard: (taskId: string, cardId: string) => void;
  onCanvasDrop: (cardType: CardType) => void;
  onTaskDrop: (taskId: string, cardType: CardType) => void;
  onReorderTask: (sourceIndex: number, targetIndex: number) => void;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderCard: (taskId: string, sourceIndex: number, targetIndex: number) => void;
  onDeleteCard: (taskId: string, cardId: string) => void;
  getTaskWarning: (task: ExamTaskBlueprint) => string | null;
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
  cardId: string;
  position: "before" | "after";
};

const TASK_DRAG_TYPE = "application/x-fmd-task";
const CARD_DRAG_TYPE = "application/x-fmd-card";

const resolveDropType = (event: DragEvent<HTMLElement>) => {
  const value =
    event.dataTransfer.getData("application/x-fmd-card-type") ||
    event.dataTransfer.getData("text/plain");
  if (!value) {
    return null;
  }
  return CARD_TYPES.includes(value as CardType) ? (value as CardType) : null;
};

const allowDrop = (event: DragEvent<HTMLElement>) => {
  if (!event.dataTransfer.types.includes("application/x-fmd-card-type")) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

export const ExamCanvas = ({
  exam,
  selection,
  onSelectExam,
  onSelectTask,
  onSelectCard,
  onCanvasDrop,
  onTaskDrop,
  onReorderTask,
  onDuplicateTask,
  onDeleteTask,
  onReorderCard,
  onDeleteCard,
  getTaskWarning,
}: ExamCanvasProps) => {
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [taskDropTarget, setTaskDropTarget] = useState<TaskDropTarget | null>(null);
  const [cardDropTarget, setCardDropTarget] = useState<CardDropTarget | null>(null);
  const orderedTasks = useMemo(
    () => exam.tasks.slice().sort((a, b) => a.order - b.order),
    [exam.tasks],
  );
  const isExamSelected = selection.type === "exam";

  const clearDragState = () => {
    setDragPayload(null);
    setTaskDropTarget(null);
    setCardDropTarget(null);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    const cardType = resolveDropType(event);
    if (!cardType) {
      return;
    }
    event.preventDefault();
    onCanvasDrop(cardType);
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
    event.dataTransfer.setData(TASK_DRAG_TYPE, taskId);
    event.dataTransfer.effectAllowed = "move";
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
    event.dataTransfer.setData(
      CARD_DRAG_TYPE,
      JSON.stringify({ taskId, cardId }),
    );
    event.dataTransfer.effectAllowed = "move";
    setDragPayload({ kind: "card", taskId, cardId });
  };

  const handleDragEnd = () => {
    clearDragState();
  };

  const handleTaskDragOver = (event: DragEvent<HTMLLIElement>, taskId: string) => {
    if (event.dataTransfer.types.includes("application/x-fmd-card-type")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      return;
    }
    if (!dragPayload || dragPayload.kind !== "task") {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const position = getDropPosition(event);
    setTaskDropTarget({ taskId, position });
  };

  const handleTaskDrop = (event: DragEvent<HTMLLIElement>, taskId: string) => {
    const cardType = resolveDropType(event);
    if (cardType) {
      event.preventDefault();
      event.stopPropagation();
      onTaskDrop(taskId, cardType);
      clearDragState();
      return;
    }
    if (!dragPayload || dragPayload.kind !== "task") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const position = getDropPosition(event);
    const sourceIndex = orderedTasks.findIndex(
      (task) => task.id === dragPayload.taskId,
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
    if (!dragPayload || dragPayload.kind !== "card") {
      return;
    }
    if (dragPayload.taskId !== taskId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const position = getDropPosition(event);
    setCardDropTarget({ taskId, cardId, position });
  };

  const handleCardDrop = (
    event: DragEvent<HTMLDivElement>,
    taskId: string,
    cardId: string,
  ) => {
    if (!dragPayload || dragPayload.kind !== "card") {
      return;
    }
    if (dragPayload.taskId !== taskId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const task = orderedTasks.find((entry) => entry.id === taskId);
    if (!task) {
      clearDragState();
      return;
    }
    const sourceIndex = task.cards.findIndex(
      (card) => card.id === dragPayload.cardId,
    );
    const targetIndex = task.cards.findIndex((card) => card.id === cardId);
    if (sourceIndex === -1 || targetIndex === -1) {
      clearDragState();
      return;
    }
    const position = getDropPosition(event);
    let insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    if (sourceIndex < insertIndex) {
      insertIndex -= 1;
    }
    if (insertIndex !== sourceIndex) {
      onReorderCard(taskId, sourceIndex, insertIndex);
    }
    clearDragState();
  };

  return (
    <section
      className="panel exam-editor-panel exam-canvas"
      onDragOver={allowDrop}
      onDrop={handleCanvasDrop}
    >
      <header className="panel-header">
        <div>
          <h2>Canvas</h2>
          <p className="muted">Drop cards to create tasks and interactions.</p>
        </div>
      </header>
      <div className="panel-body">
        <button
          type="button"
          className={`exam-canvas-meta ${isExamSelected ? "selected" : ""}`}
          onClick={onSelectExam}
        >
          <span className="eyebrow">Exam</span>
          <strong>{exam.title.trim() || "Untitled exam"}</strong>
          <span className="muted">{exam.description.trim() || "No description"}</span>
        </button>

        {orderedTasks.length === 0 ? (
          <div className="exam-canvas-empty">
            <p>Drop a card type here to create Task 1.</p>
          </div>
        ) : (
          <ol className="exam-task-list">
            {orderedTasks.map((task, index) => {
              const isTaskSelected =
                selection.type === "task" && selection.taskId === task.id;
              const isTaskDragging =
                dragPayload?.kind === "task" && dragPayload.taskId === task.id;
              const taskDropPosition =
                taskDropTarget?.taskId === task.id
                  ? taskDropTarget.position
                  : null;
              const warning = getTaskWarning(task);
              return (
                <li
                  key={task.id}
                  className={`exam-task-node ${isTaskSelected ? "selected" : ""}${
                    isTaskDragging ? " is-dragging" : ""
                  }${taskDropPosition ? " drop-target" : ""}${
                    taskDropPosition ? ` drop-${taskDropPosition}` : ""
                  }`}
                  onDragOver={(event) => handleTaskDragOver(event, task.id)}
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
                      onClick={() => onSelectTask(task.id)}
                    >
                      <span className="task-number">Task {index + 1}</span>
                      <span className="task-title-text">
                        {task.title.trim() || "Untitled task"}
                      </span>
                    </button>
                    <div className="exam-task-actions">
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
                  {warning ? <div className="exam-task-warning">{warning}</div> : null}
                  <div className="exam-card-list">
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
                            <span className="card-index">Card {cardIndex + 1}</span>
                            <span className="card-type">
                              {serializeCardTypeLabel(card.type)}
                            </span>
                            {card.helpText?.trim() ? (
                              <span className="card-hint">Hint</span>
                            ) : null}
                          </button>
                          <div className="exam-card-actions">
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
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
};
