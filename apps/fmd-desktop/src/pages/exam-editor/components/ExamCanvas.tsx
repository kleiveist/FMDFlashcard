/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ExamCanvas.tsx
 */

import type { DragEvent } from "react";
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
  onMoveTask: (taskId: string, direction: "up" | "down") => void;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onMoveCard: (taskId: string, cardId: string, direction: "up" | "down") => void;
  onDeleteCard: (taskId: string, cardId: string) => void;
  getTaskWarning: (task: ExamTaskBlueprint) => string | null;
};

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
  onMoveTask,
  onDuplicateTask,
  onDeleteTask,
  onMoveCard,
  onDeleteCard,
  getTaskWarning,
}: ExamCanvasProps) => {
  const orderedTasks = exam.tasks.slice().sort((a, b) => a.order - b.order);
  const isExamSelected = selection.type === "exam";

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    const cardType = resolveDropType(event);
    if (!cardType) {
      return;
    }
    event.preventDefault();
    onCanvasDrop(cardType);
  };

  const handleTaskDrop = (event: DragEvent<HTMLLIElement>, taskId: string) => {
    const cardType = resolveDropType(event);
    if (!cardType) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onTaskDrop(taskId, cardType);
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
              const warning = getTaskWarning(task);
              return (
                <li
                  key={task.id}
                  className={`exam-task-node ${isTaskSelected ? "selected" : ""}`}
                  onDragOver={allowDrop}
                  onDrop={(event) => handleTaskDrop(event, task.id)}
                >
                  <div className="exam-task-header">
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
                        onClick={() => onMoveTask(task.id, "up")}
                        disabled={index === 0}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => onMoveTask(task.id, "down")}
                        disabled={index === orderedTasks.length - 1}
                      >
                        Down
                      </button>
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
                      return (
                        <div
                          key={card.id}
                          className={`exam-card-item ${
                            isCardSelected ? "selected" : ""
                          }`}
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
                              className="ghost small"
                              onClick={() => onMoveCard(task.id, card.id, "up")}
                              disabled={cardIndex === 0}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className="ghost small"
                              onClick={() => onMoveCard(task.id, card.id, "down")}
                              disabled={cardIndex === task.cards.length - 1}
                            >
                              Down
                            </button>
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
