/**
 * @file apps/fmd-desktop/src/pages/exam-editor/ExamEditorView.tsx
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { joinPath, normalizeRelativePath, normalizeVaultPath } from "../../lib/path";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { type VaultFile } from "../../lib/tree";
import {
  cloneTaskBlueprint,
  createCardBlueprint,
  createChoiceOption,
  createExamBlueprint,
  createTaskBlueprint,
  reorderCardsByIndex,
  reorderTasksByIndex,
} from "../../features/exam-editor/blueprint";
import type {
  CardType,
  ExamBlueprint,
  ExamTaskBlueprint,
} from "../../features/exam-editor/types";
import {
  serializeCardTypeLabel,
  serializeExamBlueprint,
} from "../../features/exam-editor/serializer";
import { isCompositeTask, validateExamBlueprint } from "../../features/exam-editor/validation";
import { importExamMarkdown, isExamMarkdown } from "../../features/exam-editor/importer";
import { findNextNewExamFilename } from "../../features/exam-editor/fileNaming";
import { CardsIcon } from "../../components/icons";
import { CardPalette } from "./components/CardPalette";
import { ExamCanvas } from "./components/ExamCanvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ContentMode } from "./components/ContentMode";
import { ModalShell } from "../../components/ModalShell";
import type {
  ExamEditorControlsState,
  ExamEditorMode,
  ExamEditorSelection,
} from "./types";

const normalizeTaskOrder = (tasks: ExamTaskBlueprint[]) =>
  tasks.map((task, index) => ({ ...task, order: index }));

type SaveState = "idle" | "saving" | "saved";

type ExamEditorViewProps = {
  sourcePath?: string | null;
  sourceRelativePath?: string | null;
  sourceMarkdown?: string;
  activeFolderPath?: string | null;
  vaultFiles?: VaultFile[];
  vaultPath?: string | null;
  showMoveButtons?: boolean;
  variant?: "exam" | "study";
  onControlsReady?: (controls: ExamEditorControlsState | null) => void;
  onSave?: (payload: { path: string; markdown: string }) => void;
};

const isPathInsideVault = (path: string, vaultPath: string | null) => {
  if (!vaultPath) {
    return false;
  }
  const normalizedVault = normalizeVaultPath(vaultPath);
  const normalizedPath = normalizeVaultPath(path);
  if (!normalizedVault || !normalizedPath) {
    return false;
  }
  return (
    normalizedPath === normalizedVault ||
    normalizedPath.startsWith(`${normalizedVault}/`)
  );
};

const isAbsolutePath = (value: string) => /^(?:[A-Za-z]:[\\/]|\/)/.test(value);

const normalizeFolderPath = (value: string | null | undefined) =>
  normalizeRelativePath(value ?? "").replace(/\/+$/, "");

const getParentRelativePath = (value: string) => {
  const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return "";
  }
  return normalized.slice(0, lastSlash);
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }
  return Boolean(
    target.closest('[contenteditable="true"], [contenteditable=""], [role="textbox"]'),
  );
};

const isModalOpen = () => {
  if (typeof document === "undefined") {
    return false;
  }
  return Boolean(
    document.querySelector(".modal-backdrop, .context-menu-backdrop"),
  );
};

export const ExamEditorView = ({
  sourcePath,
  sourceRelativePath,
  sourceMarkdown,
  activeFolderPath,
  vaultFiles,
  vaultPath,
  showMoveButtons,
  variant = "exam",
  onControlsReady,
  onSave,
}: ExamEditorViewProps) => {
  const [exam, setExam] = useState<ExamBlueprint>(() => createExamBlueprint());
  const [selection, setSelection] = useState<ExamEditorSelection>({ type: "exam" });
  const [mode, setMode] = useState<ExamEditorMode>("structure");
  const [savePath, setSavePath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [paletteModalOpen, setPaletteModalOpen] = useState(false);
  const [taskPropertiesModalOpen, setTaskPropertiesModalOpen] = useState(false);
  const lastLoadedRef = useRef<{ path: string | null; markdown: string | null }>({
    path: null,
    markdown: null,
  });
  const lastVaultPathRef = useRef<string | null>(vaultPath ?? null);
  const isStudyView = variant === "study";
  const isPaletteOverlayMode = useMediaQuery("(max-width: 1200px)", false);
  const isContentPopupMode = useMediaQuery("(max-width: 1200px)", false);
  const paletteOverlayActive = isStudyView && isPaletteOverlayMode;
  const contentPopupActive = isStudyView && isContentPopupMode;
  const taskPropertiesPopupActive = isStudyView && isContentPopupMode;

  const validation = useMemo(() => validateExamBlueprint(exam), [exam]);
  const canSave = validation.valid;
  const isSaving = saveState === "saving";
  const markdown = useMemo(() => serializeExamBlueprint(exam), [exam]);
  const validationSummary = useMemo(() => {
    if (validation.valid) {
      return null;
    }
    const ordered = exam.tasks.slice().sort((a, b) => a.order - b.order);
    const taskLookup = new Map(
      ordered.map((task, index) => [task.id, { task, index }]),
    );
    const messages: string[] = [];
    validation.errors.forEach((error) => {
      messages.push(error);
    });
    validation.taskValidations.forEach((taskValidation) => {
      const info = taskLookup.get(taskValidation.taskId);
      const taskIndex = info ? info.index + 1 : null;
      const taskLabel = taskIndex ? `Task ${taskIndex}` : "Task";
      taskValidation.errors.forEach((error) => {
        messages.push(`${taskLabel}: ${error}`);
      });
      const cards = info?.task.cards ?? [];
      taskValidation.cardValidations.forEach((cardValidation, cardIndex) => {
        if (cardValidation.errors.length === 0) {
          return;
        }
        const card = cards[cardIndex];
        const cardLabel = card ? serializeCardTypeLabel(card.type) : "Card";
        const partLabel = `Part ${cardIndex + 1} (${cardLabel})`;
        const location = taskIndex ? `${taskLabel} -> ${partLabel}` : partLabel;
        cardValidation.errors.forEach((error) => {
          messages.push(`${location}: ${error}`);
        });
      });
    });
    if (messages.length === 0) {
      messages.push("Validation failed.");
    }
    return {
      count: messages.length,
      messages: messages.slice(0, 3),
    };
  }, [exam.tasks, validation]);

  useEffect(() => {
    if (!contentPopupActive || mode !== "content") {
      setContentModalOpen(false);
    }
  }, [contentPopupActive, mode]);

  useEffect(() => {
    if (!taskPropertiesPopupActive || mode !== "structure") {
      setTaskPropertiesModalOpen(false);
    }
  }, [taskPropertiesPopupActive, mode]);

  useEffect(() => {
    if (!paletteOverlayActive || mode !== "structure") {
      setPaletteModalOpen(false);
    }
  }, [paletteOverlayActive, mode]);

  useEffect(() => {
    if (!taskPropertiesModalOpen) {
      return;
    }
    if (selection.type !== "task") {
      setTaskPropertiesModalOpen(false);
    }
  }, [selection.type, taskPropertiesModalOpen]);

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
    (
      taskId: string,
      updates: { title?: string; helpText?: string; useCardWrapper?: boolean },
    ) => {
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

  const handleReorderTask = useCallback(
    (sourceIndex: number, targetIndex: number) => {
      updateTasks((tasks) => reorderTasksByIndex(tasks, sourceIndex, targetIndex));
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

  const handleReorderCard = useCallback(
    (taskId: string, sourceIndex: number, targetIndex: number) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          return {
            ...task,
            cards: reorderCardsByIndex(task.cards, sourceIndex, targetIndex),
          };
        }),
      );
    },
    [updateTasks],
  );

  const handleMoveCardAcrossTasks = useCallback(
    (
      sourceTaskId: string,
      targetTaskId: string,
      sourceIndex: number,
      targetIndex: number,
    ) => {
      if (sourceTaskId === targetTaskId) {
        handleReorderCard(sourceTaskId, sourceIndex, targetIndex);
        return;
      }
      updateTasks((tasks) => {
        const sourceTask = tasks.find((task) => task.id === sourceTaskId);
        const targetTask = tasks.find((task) => task.id === targetTaskId);
        if (!sourceTask || !targetTask) {
          return tasks;
        }
        if (sourceIndex < 0 || sourceIndex >= sourceTask.cards.length) {
          return tasks;
        }
        const movedCard = sourceTask.cards[sourceIndex];
        const nextTasks = tasks.flatMap((task) => {
          if (task.id !== sourceTaskId) {
            return [task];
          }
          const nextCards = task.cards.filter(
            (_, index) => index !== sourceIndex,
          );
          if (nextCards.length === 0) {
            return [];
          }
          return [{ ...task, cards: nextCards }];
        });
        return nextTasks.map((task) => {
          if (task.id !== targetTaskId) {
            return task;
          }
          const nextCards = task.cards.slice();
          const insertIndex = Math.max(0, Math.min(targetIndex, nextCards.length));
          nextCards.splice(insertIndex, 0, movedCard);
          return { ...task, cards: nextCards };
        });
      });
    },
    [handleReorderCard, updateTasks],
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

  const handleNewExam = useCallback(async () => {
    setSaveError("");
    setImportMessage("");
    setImportWarnings([]);
    setSaveState("idle");

    if (!vaultPath) {
      setSaveError("No active vault selected.");
      return;
    }

    const targetRelativeDir = sourceRelativePath
      ? getParentRelativePath(sourceRelativePath)
      : normalizeFolderPath(activeFolderPath);
    const existingRelativePaths = vaultFiles?.map((file) => file.relative_path) ?? [];
    const nextFilename = findNextNewExamFilename(
      targetRelativeDir,
      existingRelativePaths,
    );

    if (!nextFilename) {
      setSaveError("All New Exam filenames (01-99) already exist in this folder.");
      return;
    }

    const targetPath = joinPath(vaultPath, targetRelativeDir, nextFilename);
    const nextExam = createExamBlueprint();
    const initialMarkdown = serializeExamBlueprint(nextExam);

    setSaveState("saving");
    try {
      await invoke("write_text_file", {
        path: targetPath,
        contents: initialMarkdown,
      });
      setExam(nextExam);
      setSelection({ type: "exam" });
      setSavePath(targetPath);
      setSaveState("saved");
      setLastSavedContent(initialMarkdown);
      onSave?.({ path: targetPath, markdown: initialMarkdown });
    } catch (error) {
      setSaveError(asErrorMessage(error, "Failed to create new exam file."));
      setSaveState("idle");
    }
  }, [
    activeFolderPath,
    onSave,
    sourceRelativePath,
    vaultFiles,
    vaultPath,
  ]);

  const handleSave = useCallback(
    async (forceDialog = false) => {
      const currentValidation = validateExamBlueprint(exam);
      if (!currentValidation.valid) {
        setSaveState("idle");
        return;
      }
      setSaveState("saving");
      setSaveError("");
      try {
        const resolvePath = (path: string) =>
          vaultPath && !isAbsolutePath(path) ? joinPath(vaultPath, path) : path;
        let targetPath = savePath;
        let nextSavePath = savePath;
        if (!targetPath || forceDialog) {
          const suggestedName = exam.title.trim()
            ? `${exam.title.trim()}.md`
            : "New Exam.md";
          const defaultPath =
            savePath && isPathInsideVault(savePath, vaultPath ?? null)
              ? savePath
              : vaultPath
                ? joinPath(vaultPath, suggestedName)
                : suggestedName;
          const chosenPath = await save({
            defaultPath,
            filters: [{ name: "Markdown", extensions: ["md"] }],
          });
          if (!chosenPath) {
            setSaveState("idle");
            return;
          }
          targetPath = resolvePath(chosenPath);
          nextSavePath = targetPath;
        } else {
          targetPath = resolvePath(targetPath);
          nextSavePath = targetPath;
        }

        await invoke("write_text_file", {
          path: targetPath,
          contents: markdown,
        });
        setSavePath(nextSavePath ?? targetPath);
        setSaveState("saved");
        setLastSavedContent(markdown);
        onSave?.({ path: targetPath, markdown });
      } catch (error) {
        setSaveError(asErrorMessage(error, "Failed to save exam."));
        setSaveState("idle");
      }
    },
    [exam, exam.title, markdown, onSave, savePath, vaultPath],
  );

  const controls = useMemo<ExamEditorControlsState>(
    () => ({
      mode,
      canSave,
      isSaving,
      savePath,
      saveState,
      validationSummary,
      onModeChange: setMode,
      onNewExam: handleNewExam,
      onSaveAs: () => handleSave(true),
      onSave: () => handleSave(false),
      onQuickAddCard: handleAddTask,
    }),
    [
      canSave,
      handleNewExam,
      handleSave,
      handleAddTask,
      isSaving,
      mode,
      savePath,
      saveState,
      validationSummary,
    ],
  );

  const orderedTasks = useMemo(
    () => exam.tasks.slice().sort((a, b) => a.order - b.order),
    [exam.tasks],
  );

  const handleKeyboardReorder = useCallback(
    (direction: "up" | "down") => {
      const delta = direction === "up" ? -1 : 1;
      if (selection.type === "task") {
        const sourceIndex = orderedTasks.findIndex(
          (task) => task.id === selection.taskId,
        );
        if (sourceIndex === -1) {
          return false;
        }
        const targetIndex = sourceIndex + delta;
        if (targetIndex < 0 || targetIndex >= orderedTasks.length) {
          return false;
        }
        handleReorderTask(sourceIndex, targetIndex);
        return true;
      }
      if (selection.type === "card") {
        const task = exam.tasks.find((entry) => entry.id === selection.taskId);
        if (!task) {
          return false;
        }
        const sourceIndex = task.cards.findIndex(
          (card) => card.id === selection.cardId,
        );
        if (sourceIndex === -1) {
          return false;
        }
        const targetIndex = sourceIndex + delta;
        if (targetIndex < 0 || targetIndex >= task.cards.length) {
          return false;
        }
        handleReorderCard(task.id, sourceIndex, targetIndex);
        return true;
      }
      return false;
    },
    [exam.tasks, handleReorderCard, handleReorderTask, orderedTasks, selection],
  );

  useEffect(() => {
    if (!onControlsReady) {
      return;
    }
    onControlsReady(controls);
  }, [controls, onControlsReady]);

  useEffect(() => {
    return () => {
      onControlsReady?.(null);
    };
  }, [onControlsReady]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (isModalOpen()) {
        return;
      }
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s";
      if (isSaveShortcut) {
        event.preventDefault();
        void handleSave(false);
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (mode !== "structure") {
          return;
        }
        if (isEditableTarget(event.target)) {
          return;
        }
        const moved = handleKeyboardReorder(
          event.key === "ArrowUp" ? "up" : "down",
        );
        if (moved) {
          event.preventDefault();
        }
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (isEditableTarget(event.target)) {
          return;
        }
        const nextMode = event.key === "ArrowLeft" ? "structure" : "content";
        if (mode !== nextMode) {
          setMode(nextMode);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyboardReorder, handleSave, mode]);

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

  useEffect(() => {
    if (lastVaultPathRef.current === vaultPath) {
      return;
    }
    lastVaultPathRef.current = vaultPath ?? null;
    if (!savePath) {
      return;
    }
    if (vaultPath && isPathInsideVault(savePath, vaultPath)) {
      return;
    }
    setSavePath(null);
    setSaveState("idle");
    setLastSavedContent(null);
  }, [savePath, vaultPath]);

  useEffect(() => {
    if (sourcePath === undefined || sourceMarkdown === undefined) {
      return;
    }
    const lastLoaded = lastLoadedRef.current;
    if (
      lastLoaded.path === sourcePath &&
      lastLoaded.markdown === sourceMarkdown
    ) {
      return;
    }
    if (
      sourcePath &&
      savePath &&
      sourcePath === savePath &&
      lastSavedContent === sourceMarkdown
    ) {
      return;
    }
    lastLoadedRef.current = { path: sourcePath ?? null, markdown: sourceMarkdown };
    setImportWarnings([]);
    setImportMessage("");
    setSaveState("idle");
    setSaveError("");

    if (!sourcePath) {
      return;
    }
    if (!sourceMarkdown.trim()) {
      const blankExam = createExamBlueprint();
      setExam(blankExam);
      setSelection({ type: "exam" });
      setSavePath(sourcePath);
      setLastSavedContent(sourceMarkdown);
      return;
    }
    if (!isExamMarkdown(sourceMarkdown)) {
      setImportMessage(
        "Selected file has no #exam block. Create a new exam or switch back to Markdown.",
      );
      setExam(createExamBlueprint());
      setSelection({ type: "exam" });
      setSavePath(null);
      setLastSavedContent(null);
      return;
    }
    const imported = importExamMarkdown(sourceMarkdown);
    if (!imported) {
      setImportMessage("Unable to import exam data from this file.");
      setExam(createExamBlueprint());
      setSelection({ type: "exam" });
      setSavePath(null);
      setLastSavedContent(null);
      return;
    }
    setExam(imported.blueprint);
    setSelection({ type: "exam" });
    setImportWarnings(imported.warnings);
    setSavePath(sourcePath);
    setLastSavedContent(sourceMarkdown);
  }, [lastSavedContent, savePath, sourceMarkdown, sourcePath]);

  const getTaskWarning = useCallback(
    (task: ExamTaskBlueprint) =>
      isCompositeTask(task) ? "Composite task: auto-grading can be unreliable." : null,
    [],
  );

  const handleContentTaskSelect = useCallback(
    (taskId: string) => {
      setSelection({ type: "task", taskId });
      if (contentPopupActive) {
        setContentModalOpen(true);
      }
    },
    [contentPopupActive],
  );

  const hasAlerts = Boolean(importMessage || importWarnings.length > 0 || saveError);
  const alerts = hasAlerts ? (
    <>
      {importMessage ? <div className="error">{importMessage}</div> : null}
      {importWarnings.length > 0 ? (
        <div className="exam-task-warning">
          {importWarnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
      {saveError ? <div className="error">{saveError}</div> : null}
    </>
  ) : null;

  const propertiesPanel = (
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
  );

  const handleStructureTaskSelect = useCallback(
    (taskId: string) => {
      setSelection({ type: "task", taskId });
      if (taskPropertiesPopupActive) {
        setTaskPropertiesModalOpen(true);
      }
    },
    [taskPropertiesPopupActive],
  );

  const handleTaskPropertiesClose = useCallback(() => {
    setTaskPropertiesModalOpen(false);
    setSelection((prev) => (prev.type === "task" ? { type: "exam" } : prev));
  }, []);

  const canvasProps = {
    exam,
    selection,
    validationSummary,
    onSelectTask: handleStructureTaskSelect,
    onSelectCard: (taskId: string, cardId: string) =>
      setSelection({ type: "card", taskId, cardId }),
    onCanvasDrop: handleAddTask,
    onTaskDrop: handleAddCardToTask,
    onReorderTask: handleReorderTask,
    onDuplicateTask: handleDuplicateTask,
    onDeleteTask: handleDeleteTask,
    onReorderCard: handleReorderCard,
    onMoveCardAcrossTasks: handleMoveCardAcrossTasks,
    onDeleteCard: handleDeleteCard,
    showMoveButtons: Boolean(showMoveButtons),
    getTaskWarning,
  };

  const paletteToggleButton = paletteOverlayActive ? (
    <button
      type="button"
      className="ghost small exam-editor-palette-toggle"
      onClick={() => setPaletteModalOpen((open) => !open)}
      aria-haspopup="dialog"
      aria-expanded={paletteModalOpen}
      aria-label="Open card palette"
      title="Card palette"
    >
      <CardsIcon />
    </button>
  ) : null;

  const inlinePropertiesPanel =
    !taskPropertiesPopupActive || selection.type !== "task" ? propertiesPanel : null;
  const topContent =
    inlinePropertiesPanel || alerts ? (
      <>
        {inlinePropertiesPanel}
        {alerts}
      </>
    ) : null;

  return (
    <div className={`exam-editor-page${isStudyView ? " study-view" : ""}`}>
      {mode === "structure" ? (
        isStudyView ? (
          <div className="exam-editor-structure study-structure">
            {paletteOverlayActive ? null : (
              <CardPalette onQuickAdd={handleAddTask} />
            )}
            <ExamCanvas
              {...canvasProps}
              headerActions={paletteToggleButton}
              topContent={topContent}
            />
            {paletteOverlayActive && paletteModalOpen ? (
              <ModalShell
                isOpen={paletteModalOpen}
                title="Card palette"
                onClose={() => setPaletteModalOpen(false)}
                className="palette-modal-panel"
                bodyClassName="palette-modal-body"
              >
                <CardPalette
                  onQuickAdd={(type) => {
                    handleAddTask(type);
                    setPaletteModalOpen(false);
                  }}
                />
              </ModalShell>
            ) : null}
            {taskPropertiesPopupActive &&
            taskPropertiesModalOpen &&
            selection.type === "task" ? (
              <ModalShell
                isOpen={taskPropertiesModalOpen}
                title="Task Properties"
                onClose={handleTaskPropertiesClose}
                className="task-properties-modal-panel"
                bodyClassName="task-properties-modal-body"
              >
                {propertiesPanel}
              </ModalShell>
            ) : null}
          </div>
        ) : (
          <div className="exam-editor-structure">
            <CardPalette onQuickAdd={handleAddTask} />
            {alerts}
            <div className="exam-editor-layout">
              {propertiesPanel}
              <ExamCanvas {...canvasProps} />
            </div>
          </div>
        )
      ) : isStudyView ? (
        <div className="exam-editor-structure">
          <ExamCanvas
            {...canvasProps}
            topContent={alerts}
            bodyContent={
              <ContentMode
                exam={exam}
                selection={selection}
                validation={validation}
                onSelectTask={handleContentTaskSelect}
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
                popupMode={contentPopupActive}
                popupOpen={contentModalOpen}
                onPopupOpen={() => setContentModalOpen(true)}
                onPopupClose={() => setContentModalOpen(false)}
              />
            }
          />
        </div>
      ) : (
        <>
          {alerts}
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
        </>
      )}
    </div>
  );
};
