/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/ContentMode.tsx
 */

import type { ReactNode } from "react";
import type { ExamBlueprint, ExamTaskBlueprint } from "../../../features/exam-editor/types";
import type {
  ExamValidation,
  TaskValidation,
} from "../../../features/exam-editor/validation";
import { isCompositeTask } from "../../../features/exam-editor/validation";
import type { ExamEditorSelection } from "../types";
import { ModalShell } from "../../../components/ModalShell";
import { CardContentForm, MediaEditor } from "./ContentForms";
import { HelpEditor } from "./HelpEditor";
import type { EditorMediaDraft } from "../../../lib/cardMedia";
import type { VaultPngAsset } from "../../../lib/tree";

const getTaskValidation = (
  validation: ExamValidation,
  taskId: string,
): TaskValidation | undefined =>
  validation.taskValidations.find((entry) => entry.taskId === taskId);

type ContentModeProps = {
  exam: ExamBlueprint;
  selection: ExamEditorSelection;
  validation: ExamValidation;
  tasksHeaderSlot?: ReactNode;
  onSelectTask: (taskId: string) => void;
  onTaskUpdate: (
    taskId: string,
    updates: {
      title?: string;
      helpText?: string;
      useCardWrapper?: boolean;
      mediaItems?: EditorMediaDraft[];
    },
  ) => void;
  onCardUpdate: (
    taskId: string,
    cardId: string,
    updates: {
      prompt?: string;
      answer?: string;
      correct?: "true" | "false" | null;
      mediaItems?: EditorMediaDraft[];
    },
  ) => void;
  onCardHelpChange: (taskId: string, cardId: string, value: string) => void;
  onOptionTextChange: (
    taskId: string,
    cardId: string,
    optionId: string,
    value: string,
  ) => void;
  onOptionToggle: (
    taskId: string,
    cardId: string,
    optionId: string,
    value: boolean,
  ) => void;
  onOptionSelect: (taskId: string, cardId: string, optionId: string) => void;
  onOptionAdd: (taskId: string, cardId: string) => void;
  onOptionRemove: (taskId: string, cardId: string, optionId: string) => void;
  vaultPngAssets?: VaultPngAsset[] | null;
  popupMode?: boolean;
  popupOpen?: boolean;
  onPopupOpen?: () => void;
  onPopupClose?: () => void;
};

const resolveActiveTaskId = (
  exam: ExamBlueprint,
  selection: ExamEditorSelection,
) => {
  if (selection.type === "task") {
    return selection.taskId;
  }
  if (selection.type === "card") {
    return selection.taskId;
  }
  return exam.tasks[0]?.id ?? null;
};

type ContentEditorPanelProps = {
  activeTask: ExamTaskBlueprint | null;
  taskValidation?: TaskValidation;
  onTaskUpdate: ContentModeProps["onTaskUpdate"];
  onCardUpdate: ContentModeProps["onCardUpdate"];
  onCardHelpChange: ContentModeProps["onCardHelpChange"];
  onOptionTextChange: ContentModeProps["onOptionTextChange"];
  onOptionToggle: ContentModeProps["onOptionToggle"];
  onOptionSelect: ContentModeProps["onOptionSelect"];
  onOptionAdd: ContentModeProps["onOptionAdd"];
  onOptionRemove: ContentModeProps["onOptionRemove"];
  vaultPngAssets?: VaultPngAsset[] | null;
};

const ContentEditorPanel = ({
  activeTask,
  taskValidation,
  onTaskUpdate,
  onCardUpdate,
  onCardHelpChange,
  onOptionTextChange,
  onOptionToggle,
  onOptionSelect,
  onOptionAdd,
  onOptionRemove,
  vaultPngAssets,
}: ContentEditorPanelProps) => (
  <section className="panel exam-editor-panel content-editor">
    <header className="panel-header">
      <div>
        <h2>Content</h2>
        <p className="muted">Fill prompts, answers, and options.</p>
      </div>
    </header>
    <div className="panel-body">
      {!activeTask ? (
        <div className="exam-canvas-empty">
          <p>Create a task in Structure mode to start authoring.</p>
        </div>
      ) : (
        <div className="content-editor-body">
          <header className="content-task-header">
            <div>
              <span className="eyebrow">Task</span>
              <h3>{activeTask.title.trim() || "Untitled task"}</h3>
            </div>
            {isCompositeTask(activeTask) ? (
              <div className="exam-task-warning">
                Composite task: auto-grading can be unreliable.
              </div>
            ) : null}
          </header>

          <HelpEditor
            label="Card help / hint"
            value={activeTask.helpText ?? ""}
            onChange={(value) => onTaskUpdate(activeTask.id, { helpText: value })}
            showPreviewToggle
          />

          <MediaEditor
            value={activeTask.mediaItems ?? []}
            onChange={(value) => onTaskUpdate(activeTask.id, { mediaItems: value })}
            vaultPngAssets={vaultPngAssets}
          />

          {activeTask.cards.map((card, cardIndex) => {
            const cardValidation = taskValidation?.cardValidations?.[cardIndex];
            return (
              <CardContentForm
                key={card.id}
                card={card}
                validation={cardValidation}
                onPromptChange={(value) =>
                  onCardUpdate(activeTask.id, card.id, { prompt: value })
                }
                onAnswerChange={(value) =>
                  onCardUpdate(activeTask.id, card.id, { answer: value })
                }
                onCorrectChange={(value) =>
                  onCardUpdate(activeTask.id, card.id, { correct: value })
                }
                onOptionTextChange={(optionId, value) =>
                  onOptionTextChange(activeTask.id, card.id, optionId, value)
                }
                onOptionToggle={(optionId, value) =>
                  onOptionToggle(activeTask.id, card.id, optionId, value)
                }
                onOptionSelect={(optionId) =>
                  onOptionSelect(activeTask.id, card.id, optionId)
                }
                onOptionAdd={() => onOptionAdd(activeTask.id, card.id)}
                onOptionRemove={(optionId) =>
                  onOptionRemove(activeTask.id, card.id, optionId)
                }
                onHelpChange={(value) =>
                  onCardHelpChange(activeTask.id, card.id, value)
                }
                onMediaChange={(value) =>
                  onCardUpdate(activeTask.id, card.id, { mediaItems: value })
                }
                vaultPngAssets={vaultPngAssets}
              />
            );
          })}
          {taskValidation?.errors.length ? (
            <div className="error">{taskValidation.errors.join(" ")}</div>
          ) : null}
        </div>
      )}
    </div>
  </section>
);

export const ContentMode = ({
  exam,
  selection,
  validation,
  tasksHeaderSlot,
  onSelectTask,
  onTaskUpdate,
  onCardUpdate,
  onCardHelpChange,
  onOptionTextChange,
  onOptionToggle,
  onOptionSelect,
  onOptionAdd,
  onOptionRemove,
  vaultPngAssets,
  popupMode = false,
  popupOpen = false,
  onPopupOpen,
  onPopupClose,
}: ContentModeProps) => {
  const activeTaskId = resolveActiveTaskId(exam, selection);
  const activeTask = exam.tasks.find((task) => task.id === activeTaskId) ?? null;
  const orderedTasks = exam.tasks.slice().sort((a, b) => a.order - b.order);
  const taskValidation = activeTask
    ? getTaskValidation(validation, activeTask.id)
    : undefined;
  const handleTaskSelect = (taskId: string) => {
    onSelectTask(taskId);
    if (popupMode) {
      onPopupOpen?.();
    }
  };
  const isPopupOpen = popupMode && popupOpen;
  const contentPanel = (
    <ContentEditorPanel
      activeTask={activeTask}
      taskValidation={taskValidation}
      onTaskUpdate={onTaskUpdate}
      onCardUpdate={onCardUpdate}
      onCardHelpChange={onCardHelpChange}
      onOptionTextChange={onOptionTextChange}
      onOptionToggle={onOptionToggle}
      onOptionSelect={onOptionSelect}
      onOptionAdd={onOptionAdd}
      onOptionRemove={onOptionRemove}
      vaultPngAssets={vaultPngAssets}
    />
  );

  return (
    <div
      className={`exam-editor-content${popupMode ? " content-popup-mode" : ""}`}
    >
      <aside className="panel exam-editor-panel content-nav">
        <header className="panel-header">
          <div>
            <h2>Tasks</h2>
            <p className="muted">Jump to a task to edit content.</p>
          </div>
          {tasksHeaderSlot ? (
            <div className="content-nav-header-slot">{tasksHeaderSlot}</div>
          ) : null}
        </header>
        <div className="panel-body">
          <ol className="content-task-list">
            {orderedTasks.map((task, index) => {
              const taskValidationEntry = getTaskValidation(validation, task.id);
              const isActive = task.id === activeTaskId;
              const isValid = taskValidationEntry?.valid ?? false;
              return (
                <li key={task.id} className={`content-task-item ${isActive ? "active" : ""}`}>
                  <button
                    type="button"
                    className="content-task-button"
                    onClick={() => handleTaskSelect(task.id)}
                  >
                    <span className={`status-dot ${isValid ? "valid" : "invalid"}`} />
                    <span className="task-label">Task {index + 1}</span>
                    <span className="task-title">{task.title.trim() || "Untitled"}</span>
                    <span className="card-count">{task.cards.length} card(s)</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>

      {popupMode ? null : contentPanel}
      {popupMode ? (
        <ModalShell
          isOpen={isPopupOpen}
          title="Content"
          onClose={onPopupClose ?? (() => {})}
          className="content-popup-panel"
          bodyClassName="content-popup-body"
        >
          {contentPanel}
        </ModalShell>
      ) : null}
    </div>
  );
};
