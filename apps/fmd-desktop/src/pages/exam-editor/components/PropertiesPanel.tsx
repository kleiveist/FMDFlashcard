/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/PropertiesPanel.tsx
 */

import type { ExamBlueprint, CardType } from "../../../features/exam-editor/types";
import { serializeCardTypeLabel } from "../../../features/exam-editor/serializer";
import type { ExamEditorSelection } from "../types";
import { HelpEditor } from "./HelpEditor";

const CARD_TYPES: CardType[] = ["qa", "tf", "m1", "m2", "cl", "cd", "cld"];

type PropertiesPanelProps = {
  exam: ExamBlueprint;
  selection: ExamEditorSelection;
  onExamUpdate: (updates: Pick<ExamBlueprint, "title" | "description">) => void;
  onTaskUpdate: (taskId: string, updates: { title?: string; helpText?: string }) => void;
  onCardUpdate: (taskId: string, cardId: string, updates: { helpText?: string }) => void;
  onCardTypeChange: (taskId: string, cardId: string, type: CardType) => void;
};

export const PropertiesPanel = ({
  exam,
  selection,
  onExamUpdate,
  onTaskUpdate,
  onCardUpdate,
  onCardTypeChange,
}: PropertiesPanelProps) => {
  if (selection.type === "task") {
    const task = exam.tasks.find((entry) => entry.id === selection.taskId);
    if (!task) {
      return null;
    }
    return (
      <aside className="panel exam-editor-panel properties-panel">
        <header className="panel-header">
          <div>
            <h2>Task properties</h2>
            <p className="muted">Edit task title and hints.</p>
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
          <HelpEditor
            label="Task help / hint"
            value={task.helpText ?? ""}
            onChange={(value) => onTaskUpdate(task.id, { helpText: value })}
          />
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
      <aside className="panel exam-editor-panel properties-panel">
        <header className="panel-header">
          <div>
            <h2>Card properties</h2>
            <p className="muted">Configure type and hints.</p>
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
          <HelpEditor
            label="Card help / hint"
            value={card.helpText ?? ""}
            onChange={(value) => onCardUpdate(task.id, card.id, { helpText: value })}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel exam-editor-panel properties-panel">
      <header className="panel-header">
        <div>
          <h2>Exam properties</h2>
          <p className="muted">Define title and description.</p>
        </div>
      </header>
      <div className="panel-body">
        <label className="field">
          <span className="label">Title</span>
          <input
            className="text-input"
            value={exam.title}
            onChange={(event) =>
              onExamUpdate({
                title: event.target.value,
                description: exam.description,
              })
            }
            placeholder="Exam title"
          />
        </label>
        <label className="field">
          <span className="label">Description</span>
          <textarea
            className="text-input exam-textarea"
            rows={4}
            value={exam.description}
            onChange={(event) =>
              onExamUpdate({
                title: exam.title,
                description: event.target.value,
              })
            }
            placeholder="Short description"
          />
        </label>
      </div>
    </aside>
  );
};
