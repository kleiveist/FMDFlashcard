/**
 * @file apps/fmd-desktop/src/pages/exam-editor/ExamEditorView.tsx
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { joinPath, normalizeRelativePath, normalizeVaultPath } from "../../lib/path";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { DESKTOP_QUERY, SMART_QUERY } from "../../lib/breakpoints";
import { type VaultFile } from "../../lib/tree";
import { composeMarkdownWithBody } from "../../features/preview/frontmatter";
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
  ExamPassiveSegment,
  ExamTaskBlueprint,
} from "../../features/exam-editor/types";
import {
  serializeCardTypeLabel,
  serializeExamBlueprintStable,
} from "../../features/exam-editor/serializer";
import { isCompositeTask, validateExamBlueprint } from "../../features/exam-editor/validation";
import { importExamMarkdown, isExamMarkdown } from "../../features/exam-editor/importer";
import { findNextNewExamFilename } from "../../features/exam-editor/fileNaming";
import type { UseExamPointsProfilesHandle } from "../../features/exam-points/useExamPointsProfiles";
import {
  removeExamTaskFrontmatterValue,
  resolveExamTaskFrontmatterValue,
  upsertExamTaskFrontmatterValue,
} from "../../features/exam-points/frontmatterTask";
import { CardsIcon } from "../../components/icons";
import { CardPalette } from "./components/CardPalette";
import { ExamCanvas } from "./components/ExamCanvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ContentMode } from "./components/ContentMode";
import { ModalShell } from "../../components/ModalShell";
import type { EditorMediaDraft } from "../../lib/cardMedia";
import type { VaultPngAsset } from "../../lib/tree";
import type { ExamEditorControlsState, ExamEditorMode, ExamEditorSelection } from "./types";
import {
  mergeChoiceOptions,
  parseChoiceRawBody,
  serializeChoiceRawBody,
} from "../../features/exam-editor/choiceRawBody";

const normalizeTaskOrder = (tasks: ExamTaskBlueprint[]) =>
  tasks.map((task, index) => ({ ...task, order: index }));

type SaveState = "idle" | "saving" | "saved";

type ExamEditorViewProps = {
  sourcePath?: string | null;
  sourceRelativePath?: string | null;
  sourceMarkdown?: string;
  activeFolderPath?: string | null;
  vaultFiles?: VaultFile[];
  vaultPngAssets?: VaultPngAsset[];
  vaultPath?: string | null;
  pointsProfiles: UseExamPointsProfilesHandle;
  showMoveButtons?: boolean;
  variant?: "exam" | "study";
  onControlsReady?: (controls: ExamEditorControlsState | null) => void;
  onSave?: (payload: { path: string; markdown: string; renamedFromPath?: string }) => void;
};

const resolveMarkdownWithTaskProfile = ({
  sourceMarkdown,
  bodyMarkdown,
  profileName,
}: {
  sourceMarkdown: string;
  bodyMarkdown: string;
  profileName: string | null;
}) => {
  const composed = composeMarkdownWithBody(sourceMarkdown, bodyMarkdown);
  const nextName = profileName?.trim() ?? "";
  if (!nextName) {
    const removed = removeExamTaskFrontmatterValue({ markdown: composed });
    return removed.error ? composed : removed.markdown;
  }
  const updated = upsertExamTaskFrontmatterValue({
    markdown: composed,
    profileName: nextName,
  });
  return updated.error ? composed : updated.markdown;
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
  return normalizedPath === normalizedVault || normalizedPath.startsWith(`${normalizedVault}/`);
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

const DEFAULT_EXAM_TITLE = "New Exam";
const NAME_FORBIDDEN_PATTERN = /[\\/]/;

const stripMarkdownExtension = (value: string) => value.replace(/\.md$/i, "");

const ensureMarkdownExtension = (value: string) => (/\.md$/i.test(value) ? value : `${value}.md`);

const getPathFileName = (value: string) => {
  const normalized = value.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) {
    return "";
  }
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return normalized;
  }
  return normalized.slice(lastSlash + 1);
};

const getPathDirectory = (value: string) => {
  const trimmed = value.replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  const lastSlash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (lastSlash === -1) {
    return "";
  }
  if (lastSlash === 0) {
    return trimmed.slice(0, 1);
  }
  if (lastSlash === 2 && /^[A-Za-z]:/.test(trimmed)) {
    return trimmed.slice(0, 3);
  }
  return trimmed.slice(0, lastSlash);
};

const buildPathWithFileName = (directory: string, fileName: string) => {
  if (!directory) {
    return fileName;
  }
  const separator = directory.includes("\\") && !directory.includes("/") ? "\\" : "/";
  const normalizedDirectory = directory.replace(/[\\/]+$/, "");
  if (!normalizedDirectory) {
    return `${separator}${fileName}`;
  }
  return `${normalizedDirectory}${separator}${fileName}`;
};

const deriveExamTitleFromFilePath = (path: string | null | undefined) => {
  const fileName = getPathFileName(path ?? "");
  if (!fileName) {
    return null;
  }
  const title = stripMarkdownExtension(fileName).trim();
  return title || null;
};

const resolveVaultRelativePath = (absolutePath: string, vaultPath: string | null | undefined) => {
  if (!vaultPath) {
    return null;
  }
  const normalizedVault = normalizeVaultPath(vaultPath);
  const normalizedAbsolute = normalizeVaultPath(absolutePath);
  if (!normalizedVault || !normalizedAbsolute) {
    return null;
  }
  if (normalizedAbsolute === normalizedVault) {
    return "";
  }
  if (!normalizedAbsolute.startsWith(`${normalizedVault}/`)) {
    return null;
  }
  const relative = normalizedAbsolute.slice(normalizedVault.length + 1);
  return normalizeRelativePath(relative);
};

type ExamFilenameResolution =
  { ok: true; fileName: string; title: string } | { ok: false; error: string };

const resolveExamFilenameFromTitle = (value: string): ExamFilenameResolution => {
  const trimmed = value.trim();
  const requested = trimmed || DEFAULT_EXAM_TITLE;
  if (NAME_FORBIDDEN_PATTERN.test(requested) || requested === "." || requested === "..") {
    return { ok: false, error: "Title cannot include / or \\ characters." };
  }
  if (/\.[^./\\]+$/.test(requested) && !/\.md$/i.test(requested)) {
    return { ok: false, error: "Only .md files are supported." };
  }
  const fileName = ensureMarkdownExtension(requested);
  const title = stripMarkdownExtension(fileName).trim();
  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  return { ok: true, fileName, title };
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
  return Boolean(document.querySelector(".modal-backdrop, .context-menu-backdrop"));
};

export const ExamEditorView = ({
  sourcePath,
  sourceRelativePath,
  sourceMarkdown,
  activeFolderPath,
  vaultFiles,
  vaultPngAssets,
  vaultPath,
  pointsProfiles,
  showMoveButtons,
  variant = "exam",
  onControlsReady,
  onSave,
}: ExamEditorViewProps) => {
  const [initialExam] = useState<ExamBlueprint>(() => createExamBlueprint());
  const [exam, setExam] = useState<ExamBlueprint>(() => initialExam);
  const [selection, setSelection] = useState<ExamEditorSelection>({ type: "exam" });
  const [mode, setMode] = useState<ExamEditorMode>("structure");
  const [savePath, setSavePath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState<string | null>(null);
  const [sourceDocumentMarkdown, setSourceDocumentMarkdown] = useState("");
  const [passiveSegments, setPassiveSegments] = useState<ExamPassiveSegment[]>([]);
  const [dirtyBaselineMarkdown, setDirtyBaselineMarkdown] = useState<string>(() =>
    resolveMarkdownWithTaskProfile({
      sourceMarkdown: "",
      bodyMarkdown: serializeExamBlueprintStable(initialExam, {
        passiveSegments: [],
        sourceMarkdown: "",
      }),
      profileName: null,
    }),
  );
  const [assignedTaskProfileName, setAssignedTaskProfileName] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [paletteModalOpen, setPaletteModalOpen] = useState(false);
  const [propertiesModalOpen, setPropertiesModalOpen] = useState(false);
  const lastLoadedRef = useRef<{ path: string | null; markdown: string | null }>({
    path: null,
    markdown: null,
  });
  const lastVaultPathRef = useRef<string | null>(vaultPath ?? null);
  const isStudyView = variant === "study";
  const isPaletteOverlayMode = useMediaQuery(SMART_QUERY, false);
  const isContentPopupMode = useMediaQuery(SMART_QUERY, false);
  const isDesktopViewport = useMediaQuery(DESKTOP_QUERY, false);
  const paletteOverlayActive = isStudyView && isPaletteOverlayMode;
  const contentPopupActive = isStudyView && isContentPopupMode;
  const propertiesPopupActive = isStudyView && isContentPopupMode;

  const validation = useMemo(() => validateExamBlueprint(exam), [exam]);
  const canSave = validation.valid;
  const isSaving = saveState === "saving";
  const examBodyMarkdown = useMemo(
    () =>
      serializeExamBlueprintStable(exam, {
        passiveSegments,
        sourceMarkdown: sourceDocumentMarkdown,
      }),
    [exam, passiveSegments, sourceDocumentMarkdown],
  );
  const effectiveProfileName = useMemo(() => {
    const trimmed = assignedTaskProfileName?.trim() ?? "";
    return trimmed || null;
  }, [assignedTaskProfileName]);
  const markdown = useMemo(
    () =>
      resolveMarkdownWithTaskProfile({
        sourceMarkdown: sourceDocumentMarkdown,
        bodyMarkdown: examBodyMarkdown,
        profileName: effectiveProfileName,
      }),
    [effectiveProfileName, examBodyMarkdown, sourceDocumentMarkdown],
  );
  const isSourceMarkdownLoading = sourcePath !== undefined && sourceMarkdown === undefined;
  const hasUnsavedChanges = !isSourceMarkdownLoading && markdown !== dirtyBaselineMarkdown;
  const validationSummary = useMemo(() => {
    if (validation.valid) {
      return null;
    }
    const ordered = exam.tasks.slice().sort((a, b) => a.order - b.order);
    const taskLookup = new Map(ordered.map((task, index) => [task.id, { task, index }]));
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

  const assignedProfileResolution = useMemo(() => {
    const requestedNameRaw = assignedTaskProfileName?.trim() ?? "";
    if (!requestedNameRaw) {
      return {
        requestedName: null,
        profile: null,
        missing: false,
      };
    }
    return pointsProfiles.resolveAssignedProfile(requestedNameRaw);
  }, [assignedTaskProfileName, pointsProfiles]);
  const assignedProfileNameForSelect = assignedProfileResolution.missing
    ? "__missing__"
    : (assignedProfileResolution.profile?.name ?? "__standard__");

  useEffect(() => {
    if (!assignedTaskProfileName || assignedTaskProfileName.trim()) {
      return;
    }
    setAssignedTaskProfileName(null);
  }, [assignedTaskProfileName]);

  useEffect(() => {
    if (!contentPopupActive || mode !== "content") {
      setContentModalOpen(false);
    }
  }, [contentPopupActive, mode]);

  useEffect(() => {
    if (!propertiesPopupActive || mode !== "structure") {
      setPropertiesModalOpen(false);
    }
  }, [propertiesPopupActive, mode]);

  useEffect(() => {
    if (!paletteOverlayActive || mode !== "structure") {
      setPaletteModalOpen(false);
    }
  }, [paletteOverlayActive, mode]);

  useEffect(() => {
    if (!propertiesModalOpen) {
      return;
    }
    if (selection.type === "exam") {
      setPropertiesModalOpen(false);
    }
  }, [selection.type, propertiesModalOpen]);

  const updateTasks = useCallback(
    (updater: (tasks: ExamTaskBlueprint[]) => ExamTaskBlueprint[]) => {
      setExam((prev) => {
        const nextTasks = normalizeTaskOrder(updater(prev.tasks));
        return { ...prev, tasks: nextTasks };
      });
    },
    [],
  );

  const handleExamUpdate = useCallback((updates: Pick<ExamBlueprint, "title" | "description">) => {
    setExam((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleTaskUpdate = useCallback(
    (
      taskId: string,
      updates: {
        title?: string;
        helpText?: string;
        useCardWrapper?: boolean;
        mediaItems?: EditorMediaDraft[];
      },
    ) => {
      updateTasks((tasks) =>
        tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
      );
    },
    [updateTasks],
  );

  const handleCardUpdate = useCallback(
    (
      taskId: string,
      cardId: string,
      updates: {
        prompt?: string;
        answer?: string;
        correct?: "true" | "false" | null;
        helpText?: string;
        mediaItems?: EditorMediaDraft[];
      },
    ) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          return {
            ...task,
            cards: task.cards.map((card) => (card.id === cardId ? { ...card, ...updates } : card)),
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
            nextCard.mediaItems = (card.mediaItems ?? []).map((item) => ({ ...item }));
            if ("prompt" in card && "prompt" in nextCard) {
              nextCard.prompt = card.prompt;
            }
            if (nextCard.type === "m1" || nextCard.type === "m2") {
              nextCard.rawBody = serializeChoiceRawBody(nextCard);
            } else {
              nextCard.rawBody = undefined;
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
          task.id === taskId ? { ...task, cards: [...task.cards, newCard] } : task,
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
    (sourceTaskId: string, targetTaskId: string, sourceIndex: number, targetIndex: number) => {
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
          const nextCards = task.cards.filter((_, index) => index !== sourceIndex);
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
            const nextOptions = card.options.map((option) =>
              option.id === optionId ? { ...option, text: value } : option,
            );
            const nextCard = {
              ...card,
              options: nextOptions,
            };
            return {
              ...nextCard,
              rawBody: serializeChoiceRawBody(nextCard),
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
            const nextOptions = card.options.map((option) =>
              option.id === optionId ? { ...option, isCorrect: value } : option,
            );
            const nextCard = {
              ...card,
              options: nextOptions,
            };
            return {
              ...nextCard,
              rawBody: serializeChoiceRawBody(nextCard),
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
            const nextOptions = card.options.map((option) => ({
              ...option,
              isCorrect: option.id === optionId,
            }));
            const nextCard = {
              ...card,
              options: nextOptions,
            };
            return {
              ...nextCard,
              rawBody: serializeChoiceRawBody(nextCard),
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
            const nextCard = {
              ...card,
              options: [...card.options, createChoiceOption()],
            };
            return {
              ...nextCard,
              rawBody: serializeChoiceRawBody(nextCard),
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
            const nextOptions = card.options.filter((option) => option.id !== optionId);
            const nextCard = {
              ...card,
              options: nextOptions,
            };
            return {
              ...nextCard,
              rawBody: serializeChoiceRawBody(nextCard),
            };
          });
          return { ...task, cards };
        }),
      );
    },
    [updateTasks],
  );

  const handleChoiceRawBodyChange = useCallback(
    (taskId: string, cardId: string, value: string) => {
      updateTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          const cards = task.cards.map((card) => {
            if (card.id !== cardId || (card.type !== "m1" && card.type !== "m2")) {
              return card;
            }
            const parsed = parseChoiceRawBody(value);
            if (!parsed.parsed) {
              return {
                ...card,
                rawBody: value,
              };
            }
            const nextType = parsed.parsed.recommendedType;
            const nextOptions = mergeChoiceOptions(card.options, parsed.parsed.options);
            return {
              ...card,
              type: nextType,
              prompt: parsed.parsed.prompt,
              options: nextOptions,
              rawBody: value,
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

  const handleAssignTaskProfileName = useCallback((value: string | null) => {
    const next = typeof value === "string" ? value.trim() : "";
    setAssignedTaskProfileName(next || null);
    setSaveState("idle");
  }, []);

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
    const nextFilename = findNextNewExamFilename(targetRelativeDir, existingRelativePaths);

    if (!nextFilename) {
      setSaveError("All New Exam filenames (01-99) already exist in this folder.");
      return;
    }

    const targetPath = joinPath(vaultPath, targetRelativeDir, nextFilename);
    const nextExam = {
      ...createExamBlueprint(),
      title: stripMarkdownExtension(nextFilename),
    };
    const bodyMarkdown = serializeExamBlueprintStable(nextExam, {
      passiveSegments: [],
      sourceMarkdown: "",
    });
    const initialMarkdown = resolveMarkdownWithTaskProfile({
      sourceMarkdown: "",
      bodyMarkdown,
      profileName: effectiveProfileName,
    });

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
      setSourceDocumentMarkdown(initialMarkdown);
      setPassiveSegments([]);
      setDirtyBaselineMarkdown(initialMarkdown);
      onSave?.({ path: targetPath, markdown: initialMarkdown });
    } catch (error) {
      setSaveError(asErrorMessage(error, "Failed to create new exam file."));
      setSaveState("idle");
    }
  }, [activeFolderPath, effectiveProfileName, onSave, sourceRelativePath, vaultFiles, vaultPath]);

  const handleSave = useCallback(
    async (forceDialog = false) => {
      const currentValidation = validateExamBlueprint(exam);
      if (!currentValidation.valid) {
        setSaveState("idle");
        return false;
      }
      setSaveState("saving");
      setSaveError("");
      try {
        const fileNameResolution = resolveExamFilenameFromTitle(exam.title);
        if (!fileNameResolution.ok) {
          setSaveError(fileNameResolution.error);
          setSaveState("idle");
          return false;
        }

        const resolvePath = (path: string) =>
          vaultPath && !isAbsolutePath(path) ? joinPath(vaultPath, path) : path;
        const resolveDefaultPath = (basePath: string | null) => {
          const baseDirectory = getPathDirectory(basePath ?? "");
          if (baseDirectory) {
            return buildPathWithFileName(baseDirectory, fileNameResolution.fileName);
          }
          if (vaultPath) {
            return joinPath(vaultPath, fileNameResolution.fileName);
          }
          return fileNameResolution.fileName;
        };
        const openSaveDialog = async (defaultPath: string) => {
          const chosenPath = await save({
            defaultPath,
            filters: [{ name: "Markdown", extensions: ["md"] }],
          });
          if (!chosenPath) {
            return null;
          }
          return resolvePath(chosenPath);
        };

        const normalizedCurrentSavePath = savePath ? resolvePath(savePath) : null;
        let targetPath = normalizedCurrentSavePath;
        let renamedFromPath: string | undefined;
        if (!targetPath || forceDialog) {
          const chosenPath = await openSaveDialog(resolveDefaultPath(targetPath));
          if (!chosenPath) {
            setSaveState("idle");
            return false;
          }
          targetPath = chosenPath;
        } else {
          const desiredPath = buildPathWithFileName(
            getPathDirectory(targetPath),
            fileNameResolution.fileName,
          );
          const needsRename = normalizeVaultPath(desiredPath) !== normalizeVaultPath(targetPath);
          if (needsRename) {
            const fromRelativePath = resolveVaultRelativePath(targetPath, vaultPath);
            const toRelativePath = resolveVaultRelativePath(desiredPath, vaultPath);
            const normalizedSourceRelative = fromRelativePath
              ? normalizeRelativePath(fromRelativePath).toLowerCase()
              : "";
            const normalizedTargetRelative = toRelativePath
              ? normalizeRelativePath(toRelativePath).toLowerCase()
              : "";
            const hasKnownConflict = Boolean(
              normalizedTargetRelative &&
              vaultFiles?.some((file) => {
                const existingRelative = normalizeRelativePath(file.relative_path).toLowerCase();
                return (
                  existingRelative === normalizedTargetRelative &&
                  existingRelative !== normalizedSourceRelative
                );
              }),
            );

            if (hasKnownConflict || !vaultPath || !fromRelativePath || !toRelativePath) {
              const chosenPath = await openSaveDialog(resolveDefaultPath(desiredPath));
              if (!chosenPath) {
                setSaveState("idle");
                return false;
              }
              targetPath = chosenPath;
            } else {
              try {
                const moved = await invoke<VaultFile>("move_markdown_file", {
                  vaultPath,
                  fromRelativePath,
                  toRelativePath,
                });
                renamedFromPath = targetPath;
                targetPath = moved.path;
              } catch (error) {
                const renameError = asErrorMessage(error, "Failed to rename exam file.");
                if (/already exists/i.test(renameError)) {
                  const chosenPath = await openSaveDialog(resolveDefaultPath(desiredPath));
                  if (!chosenPath) {
                    setSaveState("idle");
                    return false;
                  }
                  targetPath = chosenPath;
                } else {
                  throw error;
                }
              }
            }
          }
        }

        if (
          !forceDialog &&
          normalizedCurrentSavePath &&
          !renamedFromPath &&
          normalizeVaultPath(targetPath) !== normalizeVaultPath(normalizedCurrentSavePath)
        ) {
          const fromRelativePath = resolveVaultRelativePath(normalizedCurrentSavePath, vaultPath);
          const toRelativePath = resolveVaultRelativePath(targetPath, vaultPath);
          const normalizedSourceRelative = fromRelativePath
            ? normalizeRelativePath(fromRelativePath).toLowerCase()
            : "";
          const normalizedTargetRelative = toRelativePath
            ? normalizeRelativePath(toRelativePath).toLowerCase()
            : "";
          const hasKnownConflict = Boolean(
            normalizedTargetRelative &&
            vaultFiles?.some((file) => {
              const existingRelative = normalizeRelativePath(file.relative_path).toLowerCase();
              return (
                existingRelative === normalizedTargetRelative &&
                existingRelative !== normalizedSourceRelative
              );
            }),
          );
          if (!hasKnownConflict && vaultPath && fromRelativePath && toRelativePath) {
            try {
              const moved = await invoke<VaultFile>("move_markdown_file", {
                vaultPath,
                fromRelativePath,
                toRelativePath,
              });
              renamedFromPath = normalizedCurrentSavePath;
              targetPath = moved.path;
            } catch (error) {
              const renameError = asErrorMessage(error, "Failed to rename exam file.");
              if (!/already exists/i.test(renameError)) {
                throw error;
              }
            }
          }
        }

        const finalTitle = deriveExamTitleFromFilePath(targetPath) ?? fileNameResolution.title;
        const nextExam = exam.title === finalTitle ? exam : { ...exam, title: finalTitle };
        const bodyMarkdown = serializeExamBlueprintStable(nextExam, {
          passiveSegments,
          sourceMarkdown: sourceDocumentMarkdown,
        });
        const markdownToSave = resolveMarkdownWithTaskProfile({
          sourceMarkdown: sourceDocumentMarkdown,
          bodyMarkdown,
          profileName: effectiveProfileName,
        });

        await invoke("write_text_file", {
          path: targetPath,
          contents: markdownToSave,
        });
        if (exam.title !== finalTitle) {
          setExam((prev) => ({ ...prev, title: finalTitle }));
        }
        setSavePath(targetPath);
        setSaveState("saved");
        setLastSavedContent(markdownToSave);
        setSourceDocumentMarkdown(markdownToSave);
        setDirtyBaselineMarkdown(markdownToSave);
        onSave?.({ path: targetPath, markdown: markdownToSave, renamedFromPath });
        return true;
      } catch (error) {
        setSaveError(asErrorMessage(error, "Failed to save exam."));
        setSaveState("idle");
        return false;
      }
    },
    [
      effectiveProfileName,
      exam,
      onSave,
      passiveSegments,
      savePath,
      sourceDocumentMarkdown,
      vaultFiles,
      vaultPath,
    ],
  );

  const controls = useMemo<ExamEditorControlsState>(
    () => ({
      mode,
      canSave,
      isSaving,
      hasUnsavedChanges,
      savePath,
      saveState,
      validationSummary,
      onModeChange: setMode,
      onNewExam: handleNewExam,
      onSaveAs: () => {
        void handleSave(true);
      },
      onSave: () => {
        void handleSave(false);
      },
      onSaveAndWait: () => handleSave(false),
      onQuickAddCard: handleAddTask,
    }),
    [
      canSave,
      handleNewExam,
      handleSave,
      handleAddTask,
      hasUnsavedChanges,
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
        const sourceIndex = orderedTasks.findIndex((task) => task.id === selection.taskId);
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
        const sourceIndex = task.cards.findIndex((card) => card.id === selection.cardId);
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

  useLayoutEffect(() => {
    if (!onControlsReady) {
      return;
    }
    onControlsReady(controls);
  }, [controls, onControlsReady]);

  useLayoutEffect(() => {
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
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
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
        const moved = handleKeyboardReorder(event.key === "ArrowUp" ? "up" : "down");
        if (moved) {
          event.preventDefault();
        }
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (isEditableTarget(event.target)) {
          return;
        }
        const modes: ExamEditorMode[] = ["structure", "content"];
        const currentIndex = modes.indexOf(mode);
        if (currentIndex === -1) {
          return;
        }
        const nextIndex =
          event.key === "ArrowLeft"
            ? Math.max(0, currentIndex - 1)
            : Math.min(modes.length - 1, currentIndex + 1);
        const nextMode = modes[nextIndex];
        if (nextMode && mode !== nextMode) {
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
    if (lastLoaded.path === sourcePath && lastLoaded.markdown === sourceMarkdown) {
      return;
    }
    if (sourcePath && savePath && sourcePath === savePath && lastSavedContent === sourceMarkdown) {
      return;
    }
    lastLoadedRef.current = { path: sourcePath ?? null, markdown: sourceMarkdown };
    setImportWarnings([]);
    setImportMessage("");
    setSaveState("idle");
    setSaveError("");
    const sourcePathTitle = deriveExamTitleFromFilePath(sourcePath);

    if (!sourcePath) {
      setSourceDocumentMarkdown("");
      setPassiveSegments([]);
      setAssignedTaskProfileName(null);
      setDirtyBaselineMarkdown(
        resolveMarkdownWithTaskProfile({
          sourceMarkdown: "",
          bodyMarkdown: serializeExamBlueprintStable(exam, {
            passiveSegments: [],
            sourceMarkdown: "",
          }),
          profileName: null,
        }),
      );
      return;
    }
    if (!sourceMarkdown.trim()) {
      const blankExam = {
        ...createExamBlueprint(),
        title: sourcePathTitle ?? "",
      };
      const assignedProfile = resolveExamTaskFrontmatterValue(sourceMarkdown);
      setExam(blankExam);
      setSelection({ type: "exam" });
      setSavePath(sourcePath);
      setLastSavedContent(sourceMarkdown);
      setSourceDocumentMarkdown(sourceMarkdown);
      setPassiveSegments([]);
      setAssignedTaskProfileName(assignedProfile);
      setDirtyBaselineMarkdown(
        resolveMarkdownWithTaskProfile({
          sourceMarkdown,
          bodyMarkdown: serializeExamBlueprintStable(blankExam, {
            passiveSegments: [],
            sourceMarkdown,
          }),
          profileName: assignedProfile?.trim() || null,
        }),
      );
      return;
    }
    if (!isExamMarkdown(sourceMarkdown)) {
      const nonExamBlueprint = {
        ...createExamBlueprint(),
        title: sourcePathTitle ?? "",
      };
      const assignedProfile = resolveExamTaskFrontmatterValue(sourceMarkdown);
      setImportMessage(
        "Selected file has no #exam block. Create a new exam or switch back to Markdown.",
      );
      setExam(nonExamBlueprint);
      setSelection({ type: "exam" });
      setSavePath(null);
      setLastSavedContent(null);
      setSourceDocumentMarkdown(sourceMarkdown);
      setPassiveSegments([]);
      setAssignedTaskProfileName(assignedProfile);
      setDirtyBaselineMarkdown(
        resolveMarkdownWithTaskProfile({
          sourceMarkdown,
          bodyMarkdown: serializeExamBlueprintStable(nonExamBlueprint, {
            passiveSegments: [],
            sourceMarkdown,
          }),
          profileName: assignedProfile?.trim() || null,
        }),
      );
      return;
    }
    const imported = importExamMarkdown(sourceMarkdown);
    if (!imported) {
      const fallbackBlueprint = {
        ...createExamBlueprint(),
        title: sourcePathTitle ?? "",
      };
      const assignedProfile = resolveExamTaskFrontmatterValue(sourceMarkdown);
      setImportMessage("Unable to import exam data from this file.");
      setExam(fallbackBlueprint);
      setSelection({ type: "exam" });
      setSavePath(null);
      setLastSavedContent(null);
      setSourceDocumentMarkdown(sourceMarkdown);
      setPassiveSegments([]);
      setAssignedTaskProfileName(assignedProfile);
      setDirtyBaselineMarkdown(
        resolveMarkdownWithTaskProfile({
          sourceMarkdown,
          bodyMarkdown: serializeExamBlueprintStable(fallbackBlueprint, {
            passiveSegments: [],
            sourceMarkdown,
          }),
          profileName: assignedProfile?.trim() || null,
        }),
      );
      return;
    }
    const assignedProfile = resolveExamTaskFrontmatterValue(sourceMarkdown);
    const importedExam = {
      ...imported.blueprint,
      title: sourcePathTitle ?? imported.blueprint.title,
    };
    setExam(importedExam);
    setPassiveSegments(imported.passiveSegments);
    setSelection({ type: "exam" });
    setImportWarnings(imported.warnings);
    setSavePath(sourcePath);
    setLastSavedContent(sourceMarkdown);
    setSourceDocumentMarkdown(sourceMarkdown);
    setAssignedTaskProfileName(assignedProfile);
    setDirtyBaselineMarkdown(
      resolveMarkdownWithTaskProfile({
        sourceMarkdown,
        bodyMarkdown: serializeExamBlueprintStable(importedExam, {
          passiveSegments: imported.passiveSegments,
          sourceMarkdown,
        }),
        profileName: assignedProfile?.trim() || null,
      }),
    );
  }, [exam, lastSavedContent, savePath, sourceMarkdown, sourcePath]);

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

  const handleTaskProfileSelectChange = useCallback(
    (value: string) => {
      if (value === "__missing__") {
        return;
      }
      if (value === "__standard__") {
        handleAssignTaskProfileName(null);
        return;
      }
      handleAssignTaskProfileName(value);
    },
    [handleAssignTaskProfileName],
  );

  const profileNameOptions = useMemo(
    () =>
      pointsProfiles.profiles
        .map((profile) => profile.name)
        .sort((left, right) => left.localeCompare(right)),
    [pointsProfiles.profiles],
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

  const taskProfileSelect = (
    <div className="exam-task-profile-select">
      <label className="label" htmlFor="exam-task-profile-select">
        Task profile
      </label>
      <select
        id="exam-task-profile-select"
        className="text-input"
        value={assignedProfileNameForSelect}
        onChange={(event) => handleTaskProfileSelectChange(event.target.value)}
      >
        {assignedProfileResolution.missing && assignedProfileResolution.requestedName ? (
          <option value="__missing__">Missing: {assignedProfileResolution.requestedName}</option>
        ) : null}
        <option value="__standard__">Standard (no profile)</option>
        {profileNameOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {assignedProfileResolution.missing && assignedProfileResolution.requestedName ? (
        <div className="error">
          Missing points profile "{assignedProfileResolution.requestedName}". Create or reassign in
          the Points Profiles page.
        </div>
      ) : null}
    </div>
  );

  const propertiesPanel = (
    <PropertiesPanel
      exam={exam}
      selection={selection}
      onExamUpdate={handleExamUpdate}
      onTaskUpdate={handleTaskUpdate}
      onCardTypeChange={handleCardTypeChange}
    />
  );

  const handleStructureTaskSelect = useCallback(
    (taskId: string) => {
      setSelection({ type: "task", taskId });
      if (propertiesPopupActive) {
        setPropertiesModalOpen(true);
      }
    },
    [propertiesPopupActive],
  );

  const handleStructureCardSelect = useCallback(
    (taskId: string, cardId: string) => {
      setSelection({ type: "card", taskId, cardId });
      if (propertiesPopupActive) {
        setPropertiesModalOpen(true);
      }
    },
    [propertiesPopupActive],
  );

  const handlePropertiesClose = useCallback(() => {
    setPropertiesModalOpen(false);
    setSelection((prev) => (prev.type === "exam" ? prev : { type: "exam" }));
  }, []);

  const canvasProps = {
    exam,
    selection,
    validationSummary,
    onSelectTask: handleStructureTaskSelect,
    onSelectCard: handleStructureCardSelect,
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

  const structureSplitLayout = isDesktopViewport;
  const showPropertiesInline = !structureSplitLayout;
  const handleExamTitlePanelActivate = useCallback(() => {
    setSelection((prev) => (prev.type === "exam" ? prev : { type: "exam" }));
  }, []);
  const examTitlePanel = (
    <div
      onMouseDownCapture={handleExamTitlePanelActivate}
      onFocusCapture={handleExamTitlePanelActivate}
    >
      <PropertiesPanel
        exam={exam}
        className="exam-title-panel"
        selection={{ type: "exam" }}
        onExamUpdate={handleExamUpdate}
        onTaskUpdate={handleTaskUpdate}
        onCardTypeChange={handleCardTypeChange}
      />
    </div>
  );
  const structureSideContent = structureSplitLayout ? (
    selection.type === "exam" ? (
      <CardPalette onQuickAdd={handleAddTask} />
    ) : (
      propertiesPanel
    )
  ) : undefined;
  const inlineSelection: ExamEditorSelection =
    propertiesPopupActive && (selection.type === "task" || selection.type === "card")
      ? { type: "exam" }
      : selection;
  const inlinePropertiesPanel = showPropertiesInline ? (
    <PropertiesPanel
      exam={exam}
      selection={inlineSelection}
      onExamUpdate={handleExamUpdate}
      onTaskUpdate={handleTaskUpdate}
      onCardTypeChange={handleCardTypeChange}
    />
  ) : null;
  const mobileTopContent = showPropertiesInline ? (
    inlinePropertiesPanel || alerts ? (
      <>
        {inlinePropertiesPanel}
        {alerts}
      </>
    ) : null
  ) : (
    alerts
  );
  const desktopTopContent = (
    <>
      {examTitlePanel}
      {alerts}
    </>
  );

  return (
    <div className={`exam-editor-page${isStudyView ? " study-view" : ""}`}>
      {mode === "structure" ? (
        structureSplitLayout ? (
          <div className={`exam-editor-structure${isStudyView ? " study-structure" : ""}`}>
            <ExamCanvas
              {...canvasProps}
              topContent={desktopTopContent}
              sideContent={structureSideContent}
            />
          </div>
        ) : isStudyView ? (
          <div className="exam-editor-structure study-structure">
            {paletteOverlayActive ? null : <CardPalette onQuickAdd={handleAddTask} />}
            <ExamCanvas
              {...canvasProps}
              headerActions={paletteToggleButton}
              topContent={mobileTopContent}
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
            {propertiesPopupActive && propertiesModalOpen && selection.type !== "exam" ? (
              <ModalShell
                isOpen={propertiesModalOpen}
                title={selection.type === "card" ? "Card Properties" : "Task Properties"}
                onClose={handlePropertiesClose}
                className="properties-modal-panel"
                bodyClassName="properties-modal-body"
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
                tasksHeaderSlot={taskProfileSelect}
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
                onChoiceRawBodyChange={handleChoiceRawBodyChange}
                vaultFiles={vaultFiles}
                vaultPngAssets={vaultPngAssets}
                vaultPath={vaultPath}
                sourceRelativePath={sourceRelativePath}
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
            tasksHeaderSlot={taskProfileSelect}
            onSelectTask={(taskId) => setSelection({ type: "task", taskId })}
            onTaskUpdate={handleTaskUpdate}
            onCardUpdate={(taskId, cardId, updates) => handleCardUpdate(taskId, cardId, updates)}
            onCardHelpChange={handleCardHelpChange}
            onOptionTextChange={handleOptionTextChange}
            onOptionToggle={handleOptionToggle}
            onOptionSelect={handleOptionSelect}
            onOptionAdd={handleOptionAdd}
            onOptionRemove={handleOptionRemove}
            onChoiceRawBodyChange={handleChoiceRawBodyChange}
            vaultFiles={vaultFiles}
            vaultPngAssets={vaultPngAssets}
            vaultPath={vaultPath}
            sourceRelativePath={sourceRelativePath}
          />
        </>
      )}
    </div>
  );
};
