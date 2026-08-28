/**
 * @file frontend/src/pages/exam-editor/components/PropertiesPanel.tsx
 */

import type { ExamBlueprint, CardType } from "../../../features/exam-editor/types";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";
import type { ExamEditorSelection } from "../types";

const CARD_TYPES: CardType[] = ["qa", "tf", "m1", "m2", "cl", "cd", "cld"];

type PropertiesPanelProps = {
  exam: ExamBlueprint;
  selection: ExamEditorSelection;
  className?: string;
  onExamUpdate: (updates: Pick<ExamBlueprint, "title" | "description">) => void;
  onTaskUpdate: (
    taskId: string,
    updates: { title?: string; useCardWrapper?: boolean },
  ) => void;
  onCardTypeChange: (taskId: string, cardId: string, type: CardType) => void;
};

export const PropertiesPanel = ({
  exam,
  selection,
  className,
  onExamUpdate,
  onTaskUpdate,
  onCardTypeChange,
}: PropertiesPanelProps) => {
  const panelClassName = ["panel", "exam-editor-panel", "properties-panel", className]
    .filter(Boolean)
    .join(" ");

  if (selection.type === "task") {
    const task = exam.tasks.find((entry) => entry.id === selection.taskId);
    if (!task) {
      return null;
    }
    return (
      <aside className={panelClassName}>
        <header className="panel-header">
          <div>
            <h2>Task properties</h2>
            <p className="muted">Edit task title and wrapper.</p>
          </div>
        </header>
        <div className="panel-body">
          <label className="field">
            <span className="label">Task heading</span>
            <input
              className="text-input"
              value={task.title}
              onChange={(event) =>
                onTaskUpdate(task.id, { title: event.target.value })
              }
              placeholder="Optional heading"
            />
          </label>
          <div className="field">
            <span className="label">Card wrapper</span>
            <label className="choice-row">
              <span className="switch">
                <input
                  type="checkbox"
                  checked={task.useCardWrapper}
                  onChange={(event) =>
                    onTaskUpdate(task.id, { useCardWrapper: event.target.checked })
                  }
                />
                <span className="slider" />
              </span>
              <span>Wrap task in #card block</span>
            </label>
            <span className="muted small">
              Applies to the full task, including all parts.
            </span>
          </div>
        </div>
      </aside>
    );
  }

  if (selection.type === "card") {
    const task = exam.tasks.find((entry) => entry.id === selection.taskId);
    const card = task?.cards.find((entry) => entry.id === selection.cardId);
    if (!task || !card) {
      return null;
    }
    return (
      <aside className={panelClassName}>
        <header className="panel-header">
          <div>
            <h2>Card properties</h2>
            <p className="muted">Configure card type.</p>
          </div>
        </header>
        <div className="panel-body">
          <label className="field">
            <span className="label">Card type</span>
            <select
              className="text-input"
              value={card.type}
              onChange={(event) =>
                onCardTypeChange(task.id, card.id, event.target.value as CardType)
              }
            >
              {CARD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {serializeCardTypeLabel(type)}
                </option>
              ))}
            </select>
            <span className="muted small">
              Changing the type resets card-specific content.
            </span>
          </label>
        </div>
      </aside>
    );
  }

  return (
    <aside className={panelClassName}>
      <header className="panel-header">
        <div>
          <h2>Exam properties</h2>
        </div>
      </header>
      <div className="panel-body">
        <div className="field">
          <input
            className="text-input"
            aria-label="Title"
            value={exam.title}
            onChange={(event) =>
              onExamUpdate({
                title: event.target.value,
                description: exam.description,
              })
            }
            placeholder="Exam title"
          />
        </div>
      </div>
    </aside>
  );
};
