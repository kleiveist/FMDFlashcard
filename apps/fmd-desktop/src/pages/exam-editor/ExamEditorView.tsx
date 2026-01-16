/**
 * @file apps/fmd-desktop/src/pages/exam-editor/ExamEditorView.tsx
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import {
  cloneTaskBlueprint,
  createCardBlueprint,
  createChoiceOption,
  createExamBlueprint,
  createTaskBlueprint,
} from "../../features/exam-editor/blueprint";
import type {
  CardType,
  ExamBlueprint,
  ExamTaskBlueprint,
} from "../../features/exam-editor/types";
import { serializeExamBlueprint } from "../../features/exam-editor/serializer";
import { isCompositeTask, validateExamBlueprint } from "../../features/exam-editor/validation";
import { CardPalette } from "./components/CardPalette";
import { ExamCanvas } from "./components/ExamCanvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ContentMode } from "./components/ContentMode";
import type { ExamEditorSelection } from "./types";

const normalizeTaskOrder = (tasks: ExamTaskBlueprint[]) =>
  tasks.map((task, index) => ({ ...task, order: index }));

type EditorMode = "structure" | "content";

type SaveState = "idle" | "saving" | "saved";

export const ExamEditorView = () => {
  const [exam, setExam] = useState<ExamBlueprint>(() => createExamBlueprint());
  const [selection, setSelection] = useState<ExamEditorSelection>({ type: "exam" });
  const [mode, setMode] = useState<EditorMode>("structure");
  const [savePath, setSavePath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState<string | null>(null);

  const validation = useMemo(() => validateExamBlueprint(exam), [exam]);
  const canSave = validation.valid;
  const isSaving = saveState === "saving";
  const markdown = useMemo(() => serializeExamBlueprint(exam), [exam]);

  const updateTasks = useCallback(
    (updater: (tasks: ExamTaskBlueprint[]) => ExamTaskBlueprint[]) => {
      setExam((prev) => {
        const nextTasks = normalizeTaskOrder(updater(prev.tasks));
        return { ...prev, tasks: nextTasks };
      });
    },
    [],
  );

  const handleExamUpdate = useCallback(
    (updates: Pick<ExamBlueprint, "title" | "description">) => {
      setExam((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const handleTaskUpdate = useCallback(
    (taskId: string, updates: { title?: string; helpText?: string }) => {
      updateTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task,
        ),
      );
    },
    [updateTasks],
  );

  const handleCardUpdate = useCallback(
    (
      taskId: string,
      cardId: string,
      updates: { prompt?: string; answer?: string; correct?: "true" | "false" | null; helpText?: string },
    ) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          return {
            ...task,
            cards: task.cards.map((card) =>
              card.id === cardId ? { ...card, ...updates } : card,
            ),
          };
        }),
      );
    },
    [updateTasks],
  );

  const handleCardTypeChange = useCallback(
    (taskId: string, cardId: string, type: CardType) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const cards = task.cards.map((card) => {
            if (card.id !== cardId) {
              return card;
            }
            const nextCard = createCardBlueprint(type);
            nextCard.helpText = card.helpText;
            if ("prompt" in card && "prompt" in nextCard) {
              nextCard.prompt = card.prompt;
            }
            return nextCard;
          });
          return { ...task, cards };
        }),
      );
    },
    [updateTasks],
  );

  const handleAddTask = useCallback(
    (cardType: CardType) => {
      const newTask = createTaskBlueprint(exam.tasks.length, cardType);
      updateTasks((tasks) => [...tasks, newTask]);
      setSelection({
        type: "card",
        taskId: newTask.id,
        cardId: newTask.cards[0]?.id ?? newTask.id,
      });
    },
    [exam.tasks.length, updateTasks],
  );

  const handleAddCardToTask = useCallback(
    (taskId: string, cardType: CardType) => {
      const newCard = createCardBlueprint(cardType);
      updateTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId
            ? { ...task, cards: [...task.cards, newCard] }
            : task,
        ),
      );
      setSelection({ type: "card", taskId, cardId: newCard.id });
    },
    [updateTasks],
  );

  const handleMoveTask = useCallback(
    (taskId: string, direction: "up" | "down") => {
      updateTasks((tasks) => {
        const index = tasks.findIndex((task) => task.id === taskId);
        if (index === -1) {
          return tasks;
        }
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= tasks.length) {
          return tasks;
        }
        const nextTasks = [...tasks];
        const temp = nextTasks[index];
        nextTasks[index] = nextTasks[targetIndex];
        nextTasks[targetIndex] = temp;
        return nextTasks;
      });
    },
    [updateTasks],
  );

  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      const task = exam.tasks.find((entry) => entry.id === taskId);
      if (!task) {
        return;
      }
      const clonedTask = cloneTaskBlueprint(task);
      updateTasks((tasks) => {
        const index = tasks.findIndex((entry) => entry.id === taskId);
        if (index === -1) {
          return tasks;
        }
        const next = [...tasks];
        next.splice(index + 1, 0, clonedTask);
        return next;
      });
      setSelection({ type: "task", taskId: clonedTask.id });
    },
    [exam.tasks, updateTasks],
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      updateTasks((tasks) => tasks.filter((task) => task.id !== taskId));
      setSelection({ type: "exam" });
    },
    [updateTasks],
  );

  const handleMoveCard = useCallback(
    (taskId: string, cardId: string, direction: "up" | "down") => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const index = task.cards.findIndex((card) => card.id === cardId);
          if (index === -1) {
            return task;
          }
          const targetIndex = direction === "up" ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= task.cards.length) {
            return task;
          }
          const nextCards = [...task.cards];
          const temp = nextCards[index];
          nextCards[index] = nextCards[targetIndex];
          nextCards[targetIndex] = temp;
          return { ...task, cards: nextCards };
        }),
      );
    },
    [updateTasks],
  );

  const handleDeleteCard = useCallback(
    (taskId: string, cardId: string) => {
      updateTasks((tasks) =>
        tasks.flatMap((task) => {
          if (task.id !== taskId) {
            return [task];
          }
          const nextCards = task.cards.filter((card) => card.id !== cardId);
          if (nextCards.length === 0) {
            return [];
          }
          return [{ ...task, cards: nextCards }];
        }),
      );
    },
    [updateTasks],
  );

  const handleOptionTextChange = useCallback(
    (taskId: string, cardId: string, optionId: string, value: string) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const cards = task.cards.map((card) => {
            if (card.id !== cardId || (card.type !== "m1" && card.type !== "m2")) {
              return card;
            }
            return {
              ...card,
              options: card.options.map((option) =>
                option.id === optionId ? { ...option, text: value } : option,
              ),
            };
          });
          return { ...task, cards };
        }),
      );
    },
    [updateTasks],
  );

  const handleOptionToggle = useCallback(
    (taskId: string, cardId: string, optionId: string, value: boolean) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const cards = task.cards.map((card) => {
            if (card.id !== cardId || (card.type !== "m1" && card.type !== "m2")) {
              return card;
            }
            return {
              ...card,
              options: card.options.map((option) =>
                option.id === optionId ? { ...option, isCorrect: value } : option,
              ),
            };
          });
          return { ...task, cards };
        }),
      );
    },
    [updateTasks],
  );

  const handleOptionSelect = useCallback(
    (taskId: string, cardId: string, optionId: string) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const cards = task.cards.map((card) => {
            if (card.id !== cardId || (card.type !== "m1" && card.type !== "m2")) {
              return card;
            }
            return {
              ...card,
              options: card.options.map((option) => ({
                ...option,
                isCorrect: option.id === optionId,
              })),
            };
          });
          return { ...task, cards };
        }),
      );
    },
    [updateTasks],
  );

  const handleOptionAdd = useCallback(
    (taskId: string, cardId: string) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const cards = task.cards.map((card) => {
            if (card.id !== cardId || (card.type !== "m1" && card.type !== "m2")) {
              return card;
            }
            return {
              ...card,
              options: [...card.options, createChoiceOption()],
            };
          });
          return { ...task, cards };
        }),
      );
    },
    [updateTasks],
  );

  const handleOptionRemove = useCallback(
    (taskId: string, cardId: string, optionId: string) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const cards = task.cards.map((card) => {
            if (card.id !== cardId || (card.type !== "m1" && card.type !== "m2")) {
              return card;
            }
            return {
              ...card,
              options: card.options.filter((option) => option.id !== optionId),
            };
          });
          return { ...task, cards };
        }),
      );
    },
    [updateTasks],
  );

  const handleCardHelpChange = useCallback(
    (taskId: string, cardId: string, value: string) => {
      handleCardUpdate(taskId, cardId, { helpText: value });
    },
    [handleCardUpdate],
  );

  const handleNewExam = useCallback(() => {
    setExam(createExamBlueprint());
    setSelection({ type: "exam" });
    setSavePath(null);
    setSaveState("idle");
    setSaveError("");
    setLastSavedContent(null);
  }, []);

  const handleSave = useCallback(
    async (forceDialog = false) => {
      if (!canSave) {
        return;
      }
      setSaveState("saving");
      setSaveError("");
      try {
        let targetPath = savePath;
        if (!targetPath || forceDialog) {
          const suggestedName = exam.title.trim()
            ? `${exam.title.trim()}.md`
            : undefined;
          const chosenPath = await save({
            defaultPath: suggestedName,
            filters: [{ name: "Markdown", extensions: ["md"] }],
          });
          if (!chosenPath) {
            setSaveState("idle");
            return;
          }
          targetPath = chosenPath;
          setSavePath(chosenPath);
        }

        await invoke("write_text_file", {
          path: targetPath,
          contents: markdown,
        });
        setSaveState("saved");
        setLastSavedContent(markdown);
      } catch (error) {
        setSaveError(asErrorMessage(error, "Failed to save exam."));
        setSaveState("idle");
      }
    },
    [canSave, exam.title, markdown, savePath],
  );

  useEffect(() => {
    if (selection.type === "task") {
      const exists = exam.tasks.some((task) => task.id === selection.taskId);
      if (!exists) {
        setSelection({ type: "exam" });
      }
    }
    if (selection.type === "card") {
      const task = exam.tasks.find((entry) => entry.id === selection.taskId);
      if (!task) {
        setSelection({ type: "exam" });
        return;
      }
      const cardExists = task.cards.some((card) => card.id === selection.cardId);
      if (!cardExists) {
        setSelection({ type: "task", taskId: task.id });
      }
    }
  }, [exam.tasks, selection]);

  useEffect(() => {
    if (saveState !== "saved" || !lastSavedContent) {
      return;
    }
    if (markdown !== lastSavedContent) {
      setSaveState("idle");
    }
  }, [lastSavedContent, markdown, saveState]);

  const getTaskWarning = useCallback(
    (task: ExamTaskBlueprint) =>
      isCompositeTask(task) ? "Composite task: auto-grading can be unreliable." : null,
    [],
  );

  return (
    <div className="exam-editor-page">
      <header className="content-header exam-editor-header">
        <div>
          <p className="eyebrow">Exam Editor</p>
          <h1>Build exams</h1>
          <p className="muted">
            Design structure first, then fill in card content and hints.
          </p>
        </div>
        <div className="exam-editor-actions">
          <div className="pill-grid" role="tablist" aria-label="Editor mode">
            <button
              type="button"
              className={`pill pill-button ${mode === "structure" ? "active" : ""}`}
              onClick={() => setMode("structure")}
              role="tab"
              aria-selected={mode === "structure"}
            >
              Structure
            </button>
            <button
              type="button"
              className={`pill pill-button ${mode === "content" ? "active" : ""}`}
              onClick={() => setMode("content")}
              role="tab"
              aria-selected={mode === "content"}
            >
              Content
            </button>
          </div>
          <div className="exam-editor-action-buttons">
            <button type="button" className="ghost small" onClick={handleNewExam}>
              New exam
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => handleSave(true)}
              disabled={!canSave || isSaving}
            >
              Save as
            </button>
            <button
              type="button"
              className="primary small"
              onClick={() => handleSave(false)}
              disabled={!canSave || isSaving}
            >
              Save
            </button>
          </div>
        </div>
      </header>

      {savePath ? (
        <div className="exam-editor-save-row">
          <span className="muted">Saved path:</span>
          <span className="save-path">{savePath}</span>
          {saveState === "saving" ? (
            <span className="pill">Saving...</span>
          ) : saveState === "saved" ? (
            <span className="pill success">Saved</span>
          ) : null}
        </div>
      ) : null}
      {saveError ? <div className="error">{saveError}</div> : null}
      {!canSave ? (
        <div className="exam-editor-validation">
          <span className="pill warning">Fix validation before saving.</span>
        </div>
      ) : null}

      {mode === "structure" ? (
        <div className="exam-editor-layout">
          <PropertiesPanel
            exam={exam}
            selection={selection}
            onExamUpdate={handleExamUpdate}
            onTaskUpdate={handleTaskUpdate}
            onCardUpdate={(taskId, cardId, updates) =>
              handleCardUpdate(taskId, cardId, updates)
            }
            onCardTypeChange={handleCardTypeChange}
          />
          <ExamCanvas
            exam={exam}
            selection={selection}
            onSelectExam={() => setSelection({ type: "exam" })}
            onSelectTask={(taskId) => setSelection({ type: "task", taskId })}
            onSelectCard={(taskId, cardId) =>
              setSelection({ type: "card", taskId, cardId })
            }
            onCanvasDrop={handleAddTask}
            onTaskDrop={handleAddCardToTask}
            onMoveTask={handleMoveTask}
            onDuplicateTask={handleDuplicateTask}
            onDeleteTask={handleDeleteTask}
            onMoveCard={handleMoveCard}
            onDeleteCard={handleDeleteCard}
            getTaskWarning={getTaskWarning}
          />
          <CardPalette onQuickAdd={handleAddTask} />
        </div>
      ) : (
        <ContentMode
          exam={exam}
          selection={selection}
          validation={validation}
          onSelectTask={(taskId) => setSelection({ type: "task", taskId })}
          onTaskUpdate={handleTaskUpdate}
          onCardUpdate={(taskId, cardId, updates) =>
            handleCardUpdate(taskId, cardId, updates)
          }
          onCardHelpChange={handleCardHelpChange}
          onOptionTextChange={handleOptionTextChange}
          onOptionToggle={handleOptionToggle}
          onOptionSelect={handleOptionSelect}
          onOptionAdd={handleOptionAdd}
          onOptionRemove={handleOptionRemove}
        />
      )}
    </div>
  );
};
