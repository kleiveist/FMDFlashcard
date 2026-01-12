/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts
 *
 * Zweck:
 * - Stellt den Hook useExamSimulationViewModel fuer Exam Simulation bereit.
 *
 * Verantwortlichkeiten:
 * - Verwaltet State und Ableitungen fuer Exam Simulation.
 * - Stellt Aktionen und Handler fuer die UI bereit.
 * - Bietet konsolidierte Daten fuer Komponenten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/features/flashcards/logic.ts: Feature-Logik oder Hook.
 * - apps/fmd-desktop/src/features/settings/useAppSettings.ts: Typen.
 *
 * Exportiert:
 * - useExamSimulationViewModel: Hook fuer Exam Simulation.
 *
 * Hinweise:
 * - Hook darf nur innerhalb von React-Komponenten genutzt werden.
 */

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppState } from "../../../components/AppStateProvider";
import {
  evaluateFlashcardPartResult,
  getClozeDragPayload,
  handleClozeBlankDragOver,
  handleClozeTokenDragStart,
  type CompositePartState,
  type TrueFalseSelection,
} from "../../../features/flashcards/logic";
import { type ExamAiEvaluation } from "../../../features/settings/useAppSettings";
import { asErrorMessage } from "../../../lib/errors";
import { parseExamTasks, type ExamTask } from "../../../lib/exam";
import { type LoadState } from "../../../lib/types";
import { type VaultFile } from "../../../lib/tree";

type ExamStage =
  | "idle"
  | "running"
  | "review"
  | "scoring"
  | "finished";

type ExamSettingsSnapshot = {
  maxTotalPoints: number;
  taskCount: number;
  taskPoints: number[];
  aiEvaluation: ExamAiEvaluation;
};

type ExamTaskResult = {
  index: number;
  awardedPoints: number;
  maxPoints: number;
  isCorrect: boolean | null;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeAwardedPoints = (value: number | null, maxPoints: number) => {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }
  return clampNumber(Math.floor(value), 0, maxPoints);
};

const isAutoGradedTask = (task: ExamTask) =>
  task.gradingMode === "auto";

const isTaskCorrect = (
  task: ExamTask,
  states: CompositePartState[] | undefined,
) =>
  task.card.parts.every(
    (part, index) =>
      evaluateFlashcardPartResult(part, states?.[index] ?? {}) === "correct",
  );

export const useExamSimulationViewModel = () => {
  const { actions, preview, settings, spacedRepetition, vault } = useAppState();
  const [examFiles, setExamFiles] = useState<VaultFile[]>([]);
  const [examFilesState, setExamFilesState] = useState<LoadState>("idle");
  const [examFilesError, setExamFilesError] = useState("");
  const [stage, setStage] = useState<ExamStage>("idle");
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [activeExamTasks, setActiveExamTasks] = useState<ExamTask[]>([]);
  const [activeExamFile, setActiveExamFile] = useState<VaultFile | null>(null);
  const [activeSettings, setActiveSettings] = useState<ExamSettingsSnapshot | null>(
    null,
  );
  const [partStates, setPartStates] = useState<Record<number, CompositePartState[]>>(
    {},
  );
  const [awardedPoints, setAwardedPoints] = useState<Record<number, number | null>>(
    {},
  );
  const [autoGradeDecisions, setAutoGradeDecisions] = useState<
    Record<number, boolean>
  >({});
  const [conversionDecisions, setConversionDecisions] = useState<
    Record<number, boolean>
  >({});
  const [conversionPending, setConversionPending] = useState(false);
  const [conversionError, setConversionError] = useState("");

  useEffect(() => {
    if (!vault.vaultPath) {
      setExamFiles([]);
      setExamFilesState("idle");
      setExamFilesError("");
      return;
    }
    if (vault.files.length === 0) {
      setExamFiles([]);
      setExamFilesState("idle");
      setExamFilesError("");
      return;
    }

    let cancelled = false;
    setExamFilesState("loading");
    setExamFilesError("");

    const scanFiles = async () => {
      const results = await Promise.allSettled(
        vault.files.map(async (file) => {
          const contents = await invoke<string>("read_text_file", {
            path: file.path,
          });
          const parsed = parseExamTasks(contents);
          return parsed.hasExamBlock ? file : null;
        }),
      );

      if (cancelled) {
        return;
      }

      const nextExamFiles: VaultFile[] = [];
      let failures = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value) {
            nextExamFiles.push(result.value);
          }
        } else {
          failures += 1;
          console.warn("Failed to scan exam file", result.reason);
        }
      });

      if (failures > 0 && nextExamFiles.length === 0) {
        setExamFilesError("Exam files could not be scanned.");
      }

      setExamFiles(nextExamFiles);
      setExamFilesState("idle");
    };

    void scanFiles();

    return () => {
      cancelled = true;
    };
  }, [vault.files, vault.vaultPath]);

  const selectedExamFile = useMemo(() => {
    if (!preview.selectedFile) {
      return null;
    }
    return examFiles.find((file) => file.path === preview.selectedFile?.path) ?? null;
  }, [examFiles, preview.selectedFile]);

  const previewExamParse = useMemo(() => {
    if (!selectedExamFile || preview.previewState !== "idle") {
      return { tasks: [], hasExamBlock: false };
    }
    return parseExamTasks(preview.preview);
  }, [preview.preview, preview.previewState, selectedExamFile]);

  const plannedTaskCount = Math.min(
    previewExamParse.tasks.length,
    settings.examTaskCount,
  );
  const activeTaskPoints = useMemo(
    () => settings.examTaskPoints.slice(0, settings.examTaskCount),
    [settings.examTaskCount, settings.examTaskPoints],
  );
  const plannedTaskPoints = activeTaskPoints.slice(0, plannedTaskCount);
  const plannedMaxPoints = plannedTaskPoints.reduce((sum, value) => sum + value, 0);

  const hasTaskCountMismatch = previewExamParse.tasks.length < settings.examTaskCount;

  const activeTasks = stage === "idle" ? previewExamParse.tasks : activeExamTasks;
  const activeExamSettings = stage === "idle" ? null : activeSettings;
  const activeTaskCount = activeExamSettings
    ? Math.min(activeTasks.length, activeExamSettings.taskCount)
    : plannedTaskCount;
  const runTasks = activeTasks.slice(0, activeTaskCount);
  const runTaskPoints = (activeExamSettings
    ? activeExamSettings.taskPoints
    : activeTaskPoints
  ).slice(0, activeTaskCount);
  const runMaxPoints = runTaskPoints.reduce((sum, value) => sum + value, 0);

  const activeTask = runTasks[activeTaskIndex] ?? null;
  const activeTaskMaxPoints = runTaskPoints[activeTaskIndex] ?? 0;

  const taskPointsSum = activeTaskPoints.reduce((sum, value) => sum + value, 0);
  const remainingPoints = settings.examMaxTotalPoints - taskPointsSum;
  const isSettingsValid =
    activeTaskPoints.length === settings.examTaskCount &&
    taskPointsSum === settings.examMaxTotalPoints &&
    settings.examTaskCount >= 1 &&
    settings.examTaskCount <= 20;

  const canStartExam =
    Boolean(selectedExamFile) &&
    preview.previewState === "idle" &&
    previewExamParse.tasks.length > 0 &&
    isSettingsValid;
  const examRunning = stage !== "idle";

  const resetExamState = useCallback(() => {
    setStage("idle");
    setActiveTaskIndex(0);
    setActiveExamTasks([]);
    setActiveExamFile(null);
    setActiveSettings(null);
    setPartStates({});
    setAwardedPoints({});
    setAutoGradeDecisions({});
    setConversionDecisions({});
    setConversionPending(false);
    setConversionError("");
  }, []);

  useEffect(() => {
    resetExamState();
  }, [selectedExamFile?.path, resetExamState]);

  const handleStartExam = useCallback(() => {
    if (!canStartExam || !selectedExamFile) {
      return;
    }
    const snapshot: ExamSettingsSnapshot = {
      maxTotalPoints: settings.examMaxTotalPoints,
      taskCount: settings.examTaskCount,
      taskPoints: activeTaskPoints,
      aiEvaluation: settings.examAiEvaluation,
    };
    // TODO: Wire snapshot.aiEvaluation into grading once AI evaluation is implemented.
    setActiveExamTasks(previewExamParse.tasks);
    setActiveExamFile(selectedExamFile);
    setActiveSettings(snapshot);
    setStage("running");
    setActiveTaskIndex(0);
    setPartStates({});
    setAwardedPoints({});
    setAutoGradeDecisions({});
    setConversionDecisions({});
    setConversionError("");
    setConversionPending(false);
  }, [
    canStartExam,
    previewExamParse.tasks,
    selectedExamFile,
    settings.examAiEvaluation,
    settings.examMaxTotalPoints,
    settings.examTaskCount,
    activeTaskPoints,
  ]);

  const handleResetExam = useCallback(() => {
    resetExamState();
  }, [resetExamState]);

  const handleSubmitExam = useCallback(() => {
    if (stage !== "running") {
      return;
    }
    setStage("review");
  }, [stage]);

  const handleStartScoring = useCallback(() => {
    if (stage !== "review") {
      return;
    }
    setStage("scoring");
  }, [stage]);

  const handleFinishScoring = useCallback(() => {
    if (stage !== "scoring" || conversionPending) {
      return;
    }
    if (!activeExamFile) {
      setStage("finished");
      return;
    }

    const tasksToConvert = runTasks
      .map((task, index) => ({ task, index }))
      .filter((entry) => conversionDecisions[entry.index]);

    if (tasksToConvert.length === 0) {
      setStage("finished");
      return;
    }

    setConversionPending(true);
    setConversionError("");

    const applyConversions = async () => {
      try {
        const contents = await invoke<string>("read_text_file", {
          path: activeExamFile.path,
        });
        const lines = contents.replace(/\r\n?/g, "\n").split("\n");
        const sorted = [...tasksToConvert].sort(
          (a, b) => a.task.sourceRange.startLine - b.task.sourceRange.startLine,
        );
        let offset = 0;

        sorted.forEach(({ task }) => {
          const start = task.sourceRange.startLine + offset;
          const end = task.sourceRange.endLine + offset;
          const chunkHasCardMarker = lines
            .slice(start, end + 1)
            .some((line) => line.trim() === "#card");
          const hasCardStart = lines[start - 1]?.trim() === "#card";
          const isWrapped = hasCardStart || chunkHasCardMarker;

          if (!isWrapped) {
            lines.splice(start, 0, "#card");
            offset += 1;
            lines.splice(end + 2, 0, "#");
            offset += 1;
          }
        });

        const nextContents = lines.join("\n");
        await invoke("write_text_file", {
          path: activeExamFile.path,
          contents: nextContents,
        });

        if (preview.selectedFile?.path === activeExamFile.path) {
          preview.setPreview(nextContents);
        }

        setStage("finished");
      } catch (error) {
        setConversionError(asErrorMessage(error, "Failed to convert tasks."));
      } finally {
        setConversionPending(false);
      }
    };

    void applyConversions();
  }, [
    activeExamFile,
    conversionDecisions,
    conversionPending,
    preview,
    runTasks,
    stage,
  ]);

  const updatePartState = useCallback(
    (
      taskIndex: number,
      partIndex: number,
      updater: (current: CompositePartState) => CompositePartState,
    ) => {
      if (stage !== "running") {
        return;
      }
      setPartStates((prev) => {
        const nextParts = [...(prev[taskIndex] ?? [])];
        const current = nextParts[partIndex] ?? {};
        nextParts[partIndex] = updater(current);
        return { ...prev, [taskIndex]: nextParts };
      });
    },
    [stage],
  );

  const handleOptionSelect = useCallback(
    (taskIndex: number, partIndex: number, keys: string[]) => {
      const uniqueKeys = Array.from(new Set(keys));
      updatePartState(taskIndex, partIndex, (current) => ({
        ...current,
        selections: uniqueKeys,
      }));
    },
    [updatePartState],
  );

  const handleTrueFalseSelect = useCallback(
    (
      taskIndex: number,
      partIndex: number,
      itemId: string,
      value: TrueFalseSelection,
    ) => {
      updatePartState(taskIndex, partIndex, (current) => ({
        ...current,
        trueFalseSelections: {
          ...(current.trueFalseSelections ?? {}),
          [itemId]: value,
        },
      }));
    },
    [updatePartState],
  );

  const handleClozeInputChange = useCallback(
    (taskIndex: number, partIndex: number, blankId: string, value: string) => {
      updatePartState(taskIndex, partIndex, (current) => ({
        ...current,
        clozeResponses: {
          ...(current.clozeResponses ?? {}),
          [blankId]: value,
        },
      }));
    },
    [updatePartState],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      taskIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (stage !== "running") {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== taskIndex || payload.partIndex !== partIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updatePartState(taskIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        const existingBlankId = Object.entries(responses).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete responses[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          responses[blankId] = payload.tokenId;
        }
        return { ...current, clozeResponses: responses };
      });
    },
    [stage, updatePartState],
  );

  const handleClozeTokenRemove = useCallback(
    (taskIndex: number, partIndex: number, blankId: string) => {
      updatePartState(taskIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        delete responses[blankId];
        return { ...current, clozeResponses: responses };
      });
    },
    [updatePartState],
  );

  const handleTextInputChange = useCallback(
    (taskIndex: number, partIndex: number, value: string) => {
      updatePartState(taskIndex, partIndex, (current) => ({
        ...current,
        textResponse: value,
      }));
    },
    [updatePartState],
  );

  const handleAwardedPointsChange = useCallback(
    (taskIndex: number, value: string, maxPoints: number) => {
      if (stage !== "scoring") {
        return;
      }
      if (value.trim() === "") {
        setAwardedPoints((prev) => ({ ...prev, [taskIndex]: null }));
        return;
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const clamped = clampNumber(parsed, 0, maxPoints);
      setAwardedPoints((prev) => ({ ...prev, [taskIndex]: clamped }));
    },
    [stage],
  );

  const handleAutoGradeDecision = useCallback(
    (taskIndex: number, decision: boolean) => {
      if (stage !== "scoring") {
        return;
      }
      setAutoGradeDecisions((prev) => ({ ...prev, [taskIndex]: decision }));
    },
    [stage],
  );

  const handleTaskBack = useCallback(() => {
    setActiveTaskIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleTaskNext = useCallback(() => {
    if (runTasks.length === 0) {
      return;
    }
    setActiveTaskIndex((prev) =>
      Math.min(runTasks.length - 1, prev + 1),
    );
  }, [runTasks.length]);

  const results = useMemo(() => {
    if (!activeExamSettings || runTasks.length === 0 || stage !== "finished") {
      return null;
    }

    const breakdown: ExamTaskResult[] = runTasks.map((task, index) => {
      const maxPoints = runTaskPoints[index] ?? 0;
      if (isAutoGradedTask(task)) {
        const isCorrect = isTaskCorrect(task, partStates[index]);
        const decidedCorrect = autoGradeDecisions[index] ?? isCorrect;
        return {
          index: index + 1,
          awardedPoints: decidedCorrect ? maxPoints : 0,
          maxPoints,
          isCorrect: decidedCorrect,
        };
      }
      const awarded = normalizeAwardedPoints(awardedPoints[index] ?? null, maxPoints);
      return {
        index: index + 1,
        awardedPoints: awarded,
        maxPoints,
        isCorrect: null,
      };
    });

    const totalAwarded = breakdown.reduce(
      (sum, item) => sum + item.awardedPoints,
      0,
    );
    const totalMax = breakdown.reduce((sum, item) => sum + item.maxPoints, 0);
    const percentage = totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0;

    return {
      breakdown,
      totalAwarded,
      totalMax,
      percentage,
    };
  }, [
    activeExamSettings,
    autoGradeDecisions,
    awardedPoints,
    partStates,
    runTaskPoints,
    runTasks,
    stage,
  ]);

  const handleConversionDecision = useCallback(
    (taskIndex: number, shouldConvert: boolean) => {
      setConversionDecisions((prev) => ({ ...prev, [taskIndex]: shouldConvert }));
    },
    [],
  );

  const activeTaskPartStates =
    activeTask ? partStates[activeTaskIndex] ?? [] : [];
  const activeTaskAwardedPoints =
    activeTask ? awardedPoints[activeTaskIndex] ?? null : null;
  const activeTaskAutoDecision =
    activeTask ? autoGradeDecisions[activeTaskIndex] : undefined;
  const examEmptyState = useMemo(() => {
    if (!selectedExamFile || preview.previewState !== "idle") {
      return null;
    }
    if (!previewExamParse.hasExamBlock) {
      return {
        title: "No exam block",
        message: "This file does not include a #exam ... # wrapper.",
      };
    }
    if (previewExamParse.tasks.length === 0) {
      return {
        title: "No tasks found",
        message: "Add Punktaufgaben inside the exam block to start an exam.",
      };
    }
    return null;
  }, [
    preview.previewState,
    previewExamParse.hasExamBlock,
    previewExamParse.tasks.length,
    selectedExamFile,
  ]);

  return {
    actions,
    preview,
    settings,
    spacedRepetition,
    vault,
    examFiles,
    examFilesState,
    examFilesError,
    selectedExamFile,
    previewExamParse,
    plannedTaskCount,
    plannedMaxPoints,
    hasTaskCountMismatch,
    stage,
    examRunning,
    activeTaskIndex,
    activeTask,
    activeTaskMaxPoints,
    activeTaskPartStates,
    activeTaskAwardedPoints,
    activeTaskAutoDecision,
    runTasks,
    runTaskPoints,
    runMaxPoints,
    remainingPoints,
    isSettingsValid,
    canStartExam,
    examEmptyState,
    results,
    conversionDecisions,
    conversionPending,
    conversionError,
    handleStartExam,
    handleResetExam,
    handleSubmitExam,
    handleStartScoring,
    handleFinishScoring,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleClozeBlankDragOver,
    handleClozeTokenDragStart,
    handleAwardedPointsChange,
    handleAutoGradeDecision,
    handleTaskBack,
    handleTaskNext,
    handleConversionDecision,
  };
};
