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

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
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
import { validatePointsProfile } from "../../../features/exam-points/validatePointsProfile";
import { resolveExamTaskFrontmatterValue } from "../../../features/exam-points/frontmatterTask";
import type { MissingExamSetting } from "../../../features/settings/validateExamSettings";
import { asErrorMessage } from "../../../lib/errors";
import { DRAG_CHANNELS, endInternalDrag } from "../../../lib/dragDrop";
import {
  applyTaskAreaToggle,
  resolveTaskMutationScope,
} from "../../../lib/taskAreaToggle";
import {
  buildExamRunId,
  calculateExamPercent,
  isExamPassed,
  resolveExamGrade,
  resolveExamStatusDescriptor,
  subscribeExamRunHistoryReset,
  sortExamRunsByDateDesc,
  type ExamRunPointsProfileAssignment,
  type ExamRun,
  type ExamRunStorage,
} from "../../../lib/examRuns";
import {
  findExamTaskWrapper,
  unwrapExamTask,
  wrapExamTask,
} from "../../../lib/exam/autoCards";
import { parseExamTasks, type ExamTask } from "../../../lib/exam";
import {
  EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  type ExamPointsProfile,
} from "../../../lib/exam/pointsProfiles";
import {
  resolveAutoCardTypeValueSum,
  resolveExamTaskPointTypes,
  resolveTaskMaxPointsFromProfile,
  resolveTaskTypePointsFromMap,
} from "../../../lib/exam/pointsScoring";
import {
  buildCombinedSessionTasksFromRows,
  createMixSeed,
  type ExamCombinationMode,
  type ExamSessionSource,
  type ExamSessionTask,
} from "../../../lib/examMixedSession";
import {
  flattenExamSelectionRows,
  normalizeExamSelectionRows,
  type ExamSelectionRows,
} from "../../../lib/examSelectionRows";
import { type VaultFile } from "../../../lib/tree";
import type { LoadState } from "../../../lib/types";
import type { ExamFileEntry } from "../../../features/exam/types";
import { resolveExamFileStatusReason } from "../../../features/exam/types";
import {
  appendExamRunStore,
  deleteExamRunStoreEntry,
  loadExamRunStore,
} from "../../../features/user-vault/storage";
import { upsertExamResultStatsFrontmatter } from "../../../features/exam-results/frontmatterStats";
import { resolveAutoTaskAwardedPoints } from "../autoScoring";
import type {
  ExamCorrectionState,
  ExamManualTaskEntry,
  ExamResults,
  ExamStage,
} from "../examSimulationTypes";

type ExamSettingsSnapshot = {
  maxTotalPoints: number;
  taskCount: number;
  taskPoints: number[];
  durationMinutes: number;
  timeLimitEnabled: boolean;
  aiEvaluation: ExamAiEvaluation;
  pointsProfile: ExamPointsProfile | null;
  combinationMode: ExamCombinationMode;
  pointsProfileAssignments: ExamRunPointsProfileAssignment[];
};

type SelectedExamParseEntry = {
  tasks: ExamTask[];
  hasExamBlock: boolean;
  taskRequestedName: string | null;
};

type SelectedExamSource = ExamSessionSource & {
  taskRequestedName: string | null;
  taskResolvedProfileId: string | null;
  taskResolvedProfileName: string | null;
  taskMissing: boolean;
};

type SelectedExamSourceRows = SelectedExamSource[][];

type PreviewSession = {
  tasks: ExamSessionTask[];
  hasExamBlock: boolean;
};

type SessionTaskPointsPlan = {
  taskPoints: number[];
  maxTotalPoints: number;
  profileAssignments: ExamRunPointsProfileAssignment[];
  totalDurationSeconds: number;
};

type SelectedExamIgnoredEntry = {
  path: string;
  sourceTitle: string;
  reason: string;
};

const EMPTY_PART_STATES: CompositePartState[] = [];

const buildSelectionSignature = (rows: ExamSelectionRows) =>
  rows.map((row) => row.join(",")).join("|");
const STANDARD_RUN_PROFILE_NAME = "Standard (no profile)";
export const __resetRunProfileLargeSelectionAutoResetForTests = () => undefined;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeDurationMinutes = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const normalizeAwardedPoints = (value: number | null, maxPoints: number) => {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }
  return clampNumber(Math.floor(value), 0, maxPoints);
};

const normalizeNavigationStep = (step?: number) => {
  if (typeof step !== "number" || !Number.isFinite(step)) {
    return 1;
  }
  return Math.max(1, Math.floor(step));
};

const isAutoGradedTask = (task: ExamTask) =>
  task.gradingMode === "auto";

const requiresAwardedQaScoring = (task: ExamSessionTask) =>
  (task.gradingMode === "manual" || task.gradingMode === "hybrid") &&
  (task.card.primaryType === "qa" || task.card.detectedTypes?.includes("qa") === true);

const isTaskCorrect = (
  task: ExamTask,
  states: CompositePartState[] | undefined,
) =>
  task.card.parts.every(
    (part, index) =>
      evaluateFlashcardPartResult(part, states?.[index] ?? {}) === "correct",
  );

export const useExamSimulationViewModel = () => {
  const {
    actions,
    preview,
    settings,
    pointsProfiles,
    spacedRepetition,
    userVault,
    vault,
    examFiles,
    examFilesState,
    examFilesError,
    selectedExamFileRows,
  } = useAppState();
  const resolvedProfileRootPath =
    userVault.profileRootPath ??
    userVault.customRootPath ??
    userVault.autoRootPath ??
    userVault.resolvedPath ??
    (vault.vaultPath ? `${vault.vaultPath.replace(/[\\/]+$/, "")}/.profile` : null);
  const [examRuns, setExamRuns] = useState<ExamRun[]>([]);
  const [examRunsLoaded, setExamRunsLoaded] = useState(false);
  const [examRunDeleteError, setExamRunDeleteError] = useState("");
  const [, setExamRunsMigratedFromLegacy] = useState(false);
  const [stage, setStage] = useState<ExamStage>("idle");
  const [selectedExamParses, setSelectedExamParses] = useState<
    Record<string, SelectedExamParseEntry>
  >({});
  const [selectedExamRuntimeIgnored, setSelectedExamRuntimeIgnored] = useState<
    SelectedExamIgnoredEntry[]
  >([]);
  const [selectedExamParseState, setSelectedExamParseState] =
    useState<LoadState>("idle");
  const [selectedExamParseError, setSelectedExamParseError] = useState("");
  const [combinationMode, setCombinationMode] =
    useState<ExamCombinationMode>("fully-mixed");
  const [selectedRunProfileId, setSelectedRunProfileId] = useState<string | null>(
    null,
  );
  const [mixSeed, setMixSeed] = useState<string>(() => createMixSeed());
  const [sessionInvalidationMessage, setSessionInvalidationMessage] = useState("");
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [manualScoringIndex, setManualScoringIndex] = useState(0);
  const [activeExamTasks, setActiveExamTasks] = useState<ExamSessionTask[]>([]);
  const [activeExamFiles, setActiveExamFiles] = useState<VaultFile[]>([]);
  const [activeMixSeed, setActiveMixSeed] = useState<string | null>(null);
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
  const [correctionState, setCorrectionState] = useState<ExamCorrectionState | null>(
    null,
  );
  const [resultTaskCardWrapPendingById, setResultTaskCardWrapPendingById] = useState<
    Record<string, boolean>
  >({});
  const [resultTaskCardWrapErrorById, setResultTaskCardWrapErrorById] = useState<
    Record<string, string>
  >({});
  const [resultTaskCardWrapNoticeById, setResultTaskCardWrapNoticeById] = useState<
    Record<string, string>
  >({});
  const [examTimeRemainingMs, setExamTimeRemainingMs] = useState<number | null>(
    null,
  );
  const [examTimeUp, setExamTimeUp] = useState(false);
  const examTimerRef = useRef<number | null>(null);
  const examTimerEndRef = useRef<number | null>(null);
  const examStartTimeRef = useRef<number | null>(null);
  const examRunRecordedRef = useRef(false);
  const selectionSignatureRef = useRef("");
  const runProfileSelectionInitializedRef = useRef(false);
  const runProfileAutoStateSignatureRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    setExamRuns([]);
    setExamRunsLoaded(false);

    const loadRuns = async () => {
      try {
        if (resolvedProfileRootPath) {
          const store = await loadExamRunStore(resolvedProfileRootPath);
          const runs = Array.isArray(store.runs) ? store.runs : [];
          if (cancelled) {
            return;
          }
          setExamRuns(sortExamRunsByDateDesc(runs));
          setExamRunsMigratedFromLegacy(false);
          return;
        }
        const storage = await invoke<ExamRunStorage>("load_exam_run_data");
        if (cancelled) {
          return;
        }
        const runs = Array.isArray(storage?.runs) ? storage.runs : [];
        setExamRuns(sortExamRunsByDateDesc(runs));
        setExamRunsMigratedFromLegacy(false);
      } catch (error) {
        console.warn("Failed to load exam runs", error);
      } finally {
        if (!cancelled) {
          setExamRunsLoaded(true);
        }
      }
    };

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, [resolvedProfileRootPath, userVault.revision]);

  useEffect(() => {
    const unsubscribe = subscribeExamRunHistoryReset(() => {
      setExamRuns([]);
      if (resolvedProfileRootPath) {
        setExamRunsMigratedFromLegacy(true);
      }
    });
    return unsubscribe;
  }, [resolvedProfileRootPath]);

  useEffect(() => {
    if (!examRunsLoaded || resolvedProfileRootPath) {
      return;
    }
    const storage: ExamRunStorage = { runs: examRuns };
    void invoke("save_exam_run_data", { storage }).catch((error) => {
      console.warn("Failed to save exam runs", error);
    });
  }, [examRuns, examRunsLoaded, resolvedProfileRootPath]);

  const examFilesByPath = useMemo(
    () => new Map(examFiles.map((file) => [file.path, file])),
    [examFiles],
  );
  const selectedExamPathRows = useMemo(
    () => normalizeExamSelectionRows(selectedExamFileRows),
    [selectedExamFileRows],
  );
  const selectedExamPaths = useMemo(
    () => flattenExamSelectionRows(selectedExamPathRows),
    [selectedExamPathRows],
  );

  const selectedExamFiles = useMemo(
    () =>
      selectedExamPaths
        .map((path) => examFilesByPath.get(path))
        .filter((file): file is ExamFileEntry => Boolean(file)),
    [examFilesByPath, selectedExamPaths],
  );
  const selectedExamRunnableFiles = useMemo(
    () => selectedExamFiles.filter((file) => file.status === "valid"),
    [selectedExamFiles],
  );
  const selectedExamIgnoredByScan = useMemo<SelectedExamIgnoredEntry[]>(
    () =>
      selectedExamFiles
        .filter((file) => file.status !== "valid")
        .map((file) => ({
          path: file.path,
          sourceTitle: file.relative_path || file.path,
          reason: resolveExamFileStatusReason(file),
        })),
    [selectedExamFiles],
  );
  const selectedExamCount = selectedExamFiles.length;
  const selectedRunnableExamCount = selectedExamRunnableFiles.length;
  const selectedExamSelectionSignature = useMemo(
    () => buildSelectionSignature(selectedExamPathRows),
    [selectedExamPathRows],
  );

  useEffect(() => {
    if (!runProfileSelectionInitializedRef.current) {
      if (pointsProfiles.loading) {
        return;
      }
      runProfileSelectionInitializedRef.current = true;
      if (selectedRunProfileId === null && pointsProfiles.defaultProfileId) {
        setSelectedRunProfileId(pointsProfiles.defaultProfileId);
      }
      return;
    }
    if (
      selectedRunProfileId &&
      !pointsProfiles.profiles.some((profile) => profile.id === selectedRunProfileId)
    ) {
      setSelectedRunProfileId(pointsProfiles.defaultProfileId ?? null);
    }
  }, [
    pointsProfiles.defaultProfileId,
    pointsProfiles.loading,
    pointsProfiles.profiles,
    selectedRunProfileId,
  ]);

  const selectedRunProfile = useMemo(
    () =>
      pointsProfiles.profiles.find((profile) => profile.id === selectedRunProfileId) ??
      null,
    [pointsProfiles.profiles, selectedRunProfileId],
  );

  useEffect(() => {
    if (selectedRunnableExamCount === 0) {
      setSelectedExamParses({});
      setSelectedExamRuntimeIgnored([]);
      setSelectedExamParseState("idle");
      setSelectedExamParseError("");
      return;
    }

    let cancelled = false;
    setSelectedExamParseState("loading");
    setSelectedExamParseError("");

    const parseSelectedExamFiles = async () => {
      const results = await Promise.allSettled(
        selectedExamRunnableFiles.map(async (file) => {
          const contents = await invoke<string>("read_text_file", {
            path: file.path,
          });
          const taskRequestedName = resolveExamTaskFrontmatterValue(contents);
          return {
            file,
            parsed: parseExamTasks(contents),
            taskRequestedName,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const nextParses: Record<string, SelectedExamParseEntry> = {};
      const runtimeIgnored: SelectedExamIgnoredEntry[] = [];
      let failures = 0;

      results.forEach((result, index) => {
        const file = selectedExamRunnableFiles[index];
        if (!file) {
          return;
        }
        if (result.status === "fulfilled") {
          const parsed = result.value.parsed;
          if (parsed.hasExamBlock && parsed.tasks.length > 0) {
            nextParses[file.path] = {
              tasks: parsed.tasks,
              hasExamBlock: parsed.hasExamBlock,
              taskRequestedName: result.value.taskRequestedName,
            };
            return;
          }
          runtimeIgnored.push({
            path: file.path,
            sourceTitle: file.relative_path || file.path,
            reason: "Datei enthaelt keinen gueltigen Exam-Block mit Aufgaben mehr.",
          });
          return;
        }
        failures += 1;
        runtimeIgnored.push({
          path: file.path,
          sourceTitle: file.relative_path || file.path,
          reason: asErrorMessage(
            result.reason,
            "Datei konnte beim Start nicht gelesen werden.",
          ),
        });
        console.warn("Failed to parse selected exam file", file.path, result.reason);
      });

      setSelectedExamParses(nextParses);
      setSelectedExamRuntimeIgnored(runtimeIgnored);
      if (failures > 0) {
        setSelectedExamParseError(
          failures === selectedExamRunnableFiles.length
            ? "Ausgewaehlte Exam-Dateien konnten nicht geladen werden."
            : `${failures} ausgewaehlte Exam-Datei(en) konnten nicht geladen werden.`,
        );
      }
      setSelectedExamParseState("idle");
    };

    void parseSelectedExamFiles();

    return () => {
      cancelled = true;
    };
  }, [selectedRunnableExamCount, selectedExamRunnableFiles]);

  const selectedExamSources = useMemo<SelectedExamSource[]>(
    () =>
      selectedExamRunnableFiles
        .map((file) => {
          const parsed = selectedExamParses[file.path];
          if (!parsed || parsed.tasks.length === 0 || !parsed.hasExamBlock) {
            return null;
          }
          const taskRequestedName = parsed.taskRequestedName?.trim() || null;
          const assigned = pointsProfiles.resolveAssignedProfile(taskRequestedName);
          const resolvedTaskProfile = taskRequestedName ? assigned.profile : null;
          const taskMissing = Boolean(taskRequestedName && !resolvedTaskProfile);
          return {
            examPath: file.path,
            sourceTitle: file.relative_path || file.path,
            tasks: parsed.tasks,
            taskRequestedName,
            taskResolvedProfileId: resolvedTaskProfile?.id ?? null,
            taskResolvedProfileName: resolvedTaskProfile?.name ?? null,
            taskMissing,
          } satisfies SelectedExamSource;
        })
        .filter((source): source is SelectedExamSource => Boolean(source)),
    [
      pointsProfiles.resolveAssignedProfile,
      selectedExamParses,
      selectedExamRunnableFiles,
    ],
  );
  const selectedExamSourceByPath = useMemo(
    () => new Map(selectedExamSources.map((source) => [source.examPath, source])),
    [selectedExamSources],
  );
  const selectedExamSourceRows = useMemo<SelectedExamSourceRows>(
    () =>
      selectedExamPathRows
        .map((row) =>
          row
            .map((path) => selectedExamSourceByPath.get(path))
            .filter((source): source is SelectedExamSource => Boolean(source)),
        )
        .filter((row) => row.length > 0),
    [selectedExamPathRows, selectedExamSourceByPath],
  );

  const selectedExamIgnoredEntries = useMemo<SelectedExamIgnoredEntry[]>(
    () => [...selectedExamIgnoredByScan, ...selectedExamRuntimeIgnored],
    [selectedExamIgnoredByScan, selectedExamRuntimeIgnored],
  );
  const selectedIncludedExamCount = selectedExamSources.length;

  const runProfileAutoState = useMemo(() => {
    if (selectedExamCount === 0 || selectedExamParseState !== "idle") {
      return {
        ready: false,
        signature: "",
        targetProfileId: null as string | null,
      };
    }

    let targetProfileId: string | null = null;
    if (selectedExamSources.length === 1) {
      targetProfileId = selectedExamSources[0]?.taskResolvedProfileId ?? null;
    } else if (selectedExamSources.length > 1 && combinationMode === "nested") {
      const firstProfileId = selectedExamSources[0]?.taskResolvedProfileId ?? null;
      const hasSharedProfile =
        Boolean(firstProfileId) &&
        selectedExamSources.every(
          (source) => source.taskResolvedProfileId === firstProfileId,
        );
      targetProfileId = hasSharedProfile ? firstProfileId : null;
    }

    const sourceSignature = selectedExamSources
      .map(
        (source) =>
          `${source.examPath}:${source.taskRequestedName ?? ""}:${source.taskResolvedProfileId ?? ""}:${source.taskMissing ? "missing" : "ok"}`,
      )
      .join("|");

    return {
      ready: true,
      signature: `${selectedExamCount}:${selectedExamSources.length}:${combinationMode}:${sourceSignature}`,
      targetProfileId,
    };
  }, [combinationMode, selectedExamCount, selectedExamParseState, selectedExamSources]);

  useEffect(() => {
    if (!runProfileSelectionInitializedRef.current) {
      return;
    }
    if (!runProfileAutoState.ready) {
      runProfileAutoStateSignatureRef.current = "";
      return;
    }
    if (runProfileAutoState.signature === runProfileAutoStateSignatureRef.current) {
      return;
    }
    runProfileAutoStateSignatureRef.current = runProfileAutoState.signature;
    if (selectedRunProfileId !== runProfileAutoState.targetProfileId) {
      setSelectedRunProfileId(runProfileAutoState.targetProfileId);
      setSessionInvalidationMessage("");
    }
  }, [runProfileAutoState, selectedRunProfileId]);

  const selectedValidTaskCount = useMemo(
    () =>
      selectedExamSources.reduce(
        (sum, source) => sum + source.tasks.length,
        0,
      ),
    [selectedExamSources],
  );

  const previewSession = useMemo<PreviewSession>(() => {
    if (
      selectedExamSources.length === 0 ||
      selectedExamParseState !== "idle" ||
      selectedRunnableExamCount === 0
    ) {
      return {
        tasks: [] as ExamSessionTask[],
        hasExamBlock: false,
      };
    }

    const combined = buildCombinedSessionTasksFromRows(
      selectedExamSourceRows,
      mixSeed,
      combinationMode,
    );
    return {
      tasks: combined.tasks,
      hasExamBlock: selectedExamSources.every((source) => {
        const parsed = selectedExamParses[source.examPath];
        return Boolean(parsed?.hasExamBlock);
      }),
    };
  }, [
    combinationMode,
    mixSeed,
    selectedExamParseState,
    selectedExamParses,
    selectedExamSourceRows,
    selectedRunnableExamCount,
  ]);

  const previewExamParse = useMemo(
    () => ({
      tasks: previewSession.tasks,
      hasExamBlock: previewSession.hasExamBlock,
    }),
    [previewSession.hasExamBlock, previewSession.tasks],
  );

  const defaultProfileDurationMinutes = normalizeDurationMinutes(
    pointsProfiles.defaultProfile?.durationMinutes ?? EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  );

  const resolveTaskTypePointsSourceMap = useCallback(
    (profile: ExamPointsProfile | null) => {
      if (!profile || profile.distribution !== "task-type") {
        return null;
      }
      return profile.typeRules;
    },
    [],
  );

  const resolveSessionTaskPointsPlan = useCallback(
    (
      tasks: ExamSessionTask[],
      profile: ExamPointsProfile | null,
      sources: SelectedExamSource[],
      mode: ExamCombinationMode,
      nestedGroupCount: number,
    ): SessionTaskPointsPlan => {
      const profileAssignments = sources.map((source) => ({
        examPath: source.examPath,
        sourceTitle: source.sourceTitle,
        requestedName: source.taskRequestedName,
        profileId: profile?.id ?? null,
        profileName: profile?.name ?? STANDARD_RUN_PROFILE_NAME,
        profileVersion: profile?.version ?? null,
        missing: source.taskMissing,
      }));
      const taskPoints = tasks.map((task) => {
        if (!profile) {
          return resolveTaskTypePointsFromMap({
            taskTypes: resolveExamTaskPointTypes(task),
            typePoints: settings.examTaskTypeDefaultPoints,
          });
        }

        const taskTypes = resolveExamTaskPointTypes(task);
        const taskTypePointsSource = resolveTaskTypePointsSourceMap(profile);
        if (taskTypePointsSource) {
          return resolveTaskTypePointsFromMap({
            taskTypes,
            typePoints: {
              qa: taskTypePointsSource.qa.points,
              tf: taskTypePointsSource.tf.points,
              m1: taskTypePointsSource.m1.points,
              m2: taskTypePointsSource.m2.points,
              cl: taskTypePointsSource.cl.points,
              cd: taskTypePointsSource.cd.points,
              cld: taskTypePointsSource.cld.points,
            },
          });
        }

        const sourceTaskIndex = Math.max(0, task.sourceTaskIndex ?? 0);
        const canUseProfileTaskOrder = sourceTaskIndex < Math.max(0, profile.taskCount);
        if (!canUseProfileTaskOrder) {
          return resolveTaskTypePointsFromMap({
            taskTypes,
            typePoints: settings.examTaskTypeDefaultPoints,
          });
        }

        return resolveTaskMaxPointsFromProfile({
          profile,
          taskIndex: sourceTaskIndex,
          taskTypes,
        });
      });
      const totalDurationSeconds = (() => {
        if (!profile) {
          return tasks.reduce(
            (sum, task) =>
              sum +
              resolveAutoCardTypeValueSum({
                taskTypes: resolveExamTaskPointTypes(task),
                typeValues: settings.examTaskTypeDefaultTimeSeconds,
              }),
            0,
          );
        }

        const profileDurationMinutes = normalizeDurationMinutes(
          profile.durationMinutes ?? defaultProfileDurationMinutes,
        );
        if (mode === "nested") {
          return profileDurationMinutes * Math.max(1, nestedGroupCount) * 60;
        }
        return profileDurationMinutes * Math.max(0, sources.length) * 60;
      })();
      const maxTotalPoints = taskPoints.reduce((sum, value) => sum + value, 0);
      return {
        taskPoints,
        maxTotalPoints,
        profileAssignments,
        totalDurationSeconds,
      };
    },
    [
      defaultProfileDurationMinutes,
      resolveTaskTypePointsSourceMap,
      settings.examTaskTypeDefaultPoints,
      settings.examTaskTypeDefaultTimeSeconds,
    ],
  );

  const previewTaskPlan = useMemo(
    () =>
      resolveSessionTaskPointsPlan(
        previewExamParse.tasks,
        selectedRunProfile,
        selectedExamSources,
        combinationMode,
        selectedExamSourceRows.length,
      ),
    [
      combinationMode,
      previewExamParse.tasks,
      resolveSessionTaskPointsPlan,
      selectedRunProfile,
      selectedExamSourceRows.length,
      selectedExamSources,
    ],
  );
  const plannedTaskCount = previewTaskPlan.taskPoints.length;
  const plannedMaxPoints = previewTaskPlan.maxTotalPoints;
  const previewDurationMinutes = normalizeDurationMinutes(
    Math.ceil(previewTaskPlan.totalDurationSeconds / 60),
  );
  const hasTaskCountMismatch = false;

  const activeTasks = stage === "idle" ? previewExamParse.tasks : activeExamTasks;
  const activeExamSettings = stage === "idle" ? null : activeSettings;
  const examDurationMinutes = activeExamSettings
    ? activeExamSettings.durationMinutes
    : previewDurationMinutes;
  const examTimerEnabled = activeExamSettings
    ? activeExamSettings.timeLimitEnabled && examDurationMinutes > 0
    : settings.examTimeLimitEnabled && examDurationMinutes > 0;
  const examShowTimeline = settings.examShowTimeline;
  const examTimeLimitMs = examTimerEnabled ? examDurationMinutes * 60 * 1000 : 0;
  const activeTaskCount = activeExamSettings
    ? Math.min(activeTasks.length, activeExamSettings.taskCount)
    : plannedTaskCount;
  const runTasks = activeTasks.slice(0, activeTaskCount);
  const runTaskPoints = (
    activeExamSettings ? activeExamSettings.taskPoints : previewTaskPlan.taskPoints
  ).slice(0, activeTaskCount);
  const runMaxPoints = runTaskPoints.reduce((sum, value) => sum + value, 0);
  const manualTaskIndices = useMemo(
    () =>
      runTasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => requiresAwardedQaScoring(task))
        .map(({ index }) => index),
    [runTasks],
  );
  const manualTaskEntries = useMemo<ExamManualTaskEntry[]>(
    () =>
      manualTaskIndices.flatMap((taskIndex, manualIndex) => {
        const task = runTasks[taskIndex];
        if (!task) {
          return [];
        }
        return [
          {
            task,
            taskIndex,
            manualIndex,
            manualCount: manualTaskIndices.length,
            maxPoints: runTaskPoints[taskIndex] ?? 0,
            partStates: partStates[taskIndex] ?? [],
            awardedPoints: awardedPoints[taskIndex] ?? null,
          },
        ];
      }),
    [awardedPoints, manualTaskIndices, partStates, runTaskPoints, runTasks],
  );
  const manualScoringComplete = manualTaskEntries.every(
    (entry) => entry.awardedPoints !== null,
  );
  const activeManualTaskEntry = manualTaskEntries[manualScoringIndex] ?? null;
  const canGoManualScoringBack = manualScoringIndex > 0;
  const canGoManualScoringNext = manualScoringIndex < manualTaskEntries.length - 1;

  useEffect(() => {
    if (manualTaskEntries.length === 0) {
      if (manualScoringIndex !== 0) {
        setManualScoringIndex(0);
      }
      return;
    }
    if (manualScoringIndex > manualTaskEntries.length - 1) {
      setManualScoringIndex(manualTaskEntries.length - 1);
    }
  }, [manualScoringIndex, manualTaskEntries.length]);

  const activeTask = runTasks[activeTaskIndex] ?? null;
  const activeTaskMaxPoints = runTaskPoints[activeTaskIndex] ?? 0;

  const remainingPoints = 0;
  const missingExamSettings = useMemo(() => {
    const missing: MissingExamSetting[] = [];
    if (selectedRunProfile) {
      const blockers = validatePointsProfile(selectedRunProfile);
      blockers.forEach((item) => {
        missing.push(item);
      });
    }
    if (settings.examTimeLimitEnabled && previewDurationMinutes <= 0) {
      missing.push({
        id: "exam.duration",
        label: "Time limit ist aktiv, aber Dauer ist 0 Minuten",
        description:
          "Setze im Profil oder in den Task-Type Defaults eine gesamte Dauer groesser als 0.",
        severity: "blocker",
      });
    }
    return missing;
  }, [previewDurationMinutes, selectedRunProfile, settings.examTimeLimitEnabled]);
  const hasSettingsBlockers = missingExamSettings.some(
    (item) => item.severity !== "warning",
  );
  const isSettingsValid = !hasSettingsBlockers;

  const canStartExam =
    selectedExamCount > 0 &&
    selectedRunnableExamCount > 0 &&
    selectedExamParseState === "idle" &&
    !pointsProfiles.loading &&
    previewExamParse.tasks.length > 0 &&
    isSettingsValid;
  const examRunning = stage !== "idle";

  const resetExamState = useCallback(() => {
    setStage("idle");
    setActiveTaskIndex(0);
    setManualScoringIndex(0);
    setActiveExamTasks([]);
    setActiveExamFiles([]);
    setActiveMixSeed(null);
    setActiveSettings(null);
    setPartStates({});
    setAwardedPoints({});
    setAutoGradeDecisions({});
    setCorrectionState(null);
    setResultTaskCardWrapPendingById({});
    setResultTaskCardWrapErrorById({});
    setResultTaskCardWrapNoticeById({});
    setExamTimeRemainingMs(null);
    setExamTimeUp(false);
    examTimerEndRef.current = null;
    examStartTimeRef.current = null;
    examRunRecordedRef.current = false;
  }, []);

  const handleToggleExamSelection = useCallback(
    (path: string) => {
      actions.handleToggleExamFileSelection(path);
      setSessionInvalidationMessage("");
    },
    [actions],
  );

  const handleSelectVisibleExamFiles = useCallback(
    (paths: string[]) => {
      actions.handleSetSelectedExamFiles(paths);
      setSessionInvalidationMessage("");
    },
    [actions],
  );
  const handleSetSelectedExamRows = useCallback(
    (rows: ExamSelectionRows) => {
      actions.handleSetSelectedExamFileRows(rows);
      setSessionInvalidationMessage("");
    },
    [actions],
  );

  const handleClearExamSelection = useCallback(() => {
    actions.handleClearSelectedExamFiles();
    setSessionInvalidationMessage("");
  }, [actions]);

  const handlePlaceSelectedExamFile = useCallback(
    (sourcePath: string, target: { rowIndex: number; slotIndex: number }) => {
      actions.handlePlaceSelectedExamFile(sourcePath, target);
      setSessionInvalidationMessage("");
    },
    [actions],
  );

  const handleMoveSelectedExamFile = useCallback(
    (sourcePath: string, targetPath: string) => {
      actions.handleMoveSelectedExamFile(sourcePath, targetPath);
      setSessionInvalidationMessage("");
    },
    [actions],
  );

  const handleCombinationModeChange = useCallback((nextMode: ExamCombinationMode) => {
    setCombinationMode(nextMode);
    setSessionInvalidationMessage("");
  }, []);

  const handleRunProfileChange = useCallback((profileId: string) => {
    setSelectedRunProfileId(profileId || null);
    setSessionInvalidationMessage("");
  }, []);

  useEffect(() => {
    const previousSelection = selectionSignatureRef.current;
    if (!previousSelection) {
      selectionSignatureRef.current = selectedExamSelectionSignature;
      return;
    }
    if (previousSelection === selectedExamSelectionSignature) {
      return;
    }
    selectionSignatureRef.current = selectedExamSelectionSignature;
    if (stage !== "idle") {
      resetExamState();
      setSessionInvalidationMessage("Session muss neu gestartet werden.");
      return;
    }
    setSessionInvalidationMessage("");
  }, [resetExamState, selectedExamSelectionSignature, stage]);

  const canReshuffleMix = useMemo(
    () =>
      stage === "idle" &&
      selectedExamParseState === "idle" &&
      selectedExamSources.length > 0 &&
      (combinationMode === "fully-mixed" ||
        combinationMode === "sequential-shuffled" ||
        combinationMode === "nested"),
    [combinationMode, selectedExamParseState, selectedExamSources.length, stage],
  );

  const handleReshuffleMix = useCallback(() => {
    if (!canReshuffleMix) {
      return;
    }
    setMixSeed(createMixSeed());
    if (stage !== "idle") {
      resetExamState();
      setSessionInvalidationMessage("Session muss neu gestartet werden.");
      return;
    }
    setSessionInvalidationMessage("");
  }, [canReshuffleMix, resetExamState, stage]);

  const handleStartExam = useCallback(() => {
    if (!canStartExam) {
      return;
    }
    if (selectedExamSources.length === 0 || selectedExamSourceRows.length === 0) {
      return;
    }
    const sessionSeed = mixSeed || createMixSeed();
    const sessionTasks = buildCombinedSessionTasksFromRows(
      selectedExamSourceRows,
      sessionSeed,
      combinationMode,
    ).tasks;
    if (sessionTasks.length === 0) {
      return;
    }
    const sessionTaskPlan = resolveSessionTaskPointsPlan(
      sessionTasks,
      selectedRunProfile,
      selectedExamSources,
      combinationMode,
      selectedExamSourceRows.length,
    );
    const snapshot: ExamSettingsSnapshot = {
      maxTotalPoints: sessionTaskPlan.maxTotalPoints,
      taskCount: sessionTaskPlan.taskPoints.length,
      taskPoints: sessionTaskPlan.taskPoints,
      durationMinutes: normalizeDurationMinutes(
        Math.ceil(sessionTaskPlan.totalDurationSeconds / 60),
      ),
      timeLimitEnabled: settings.examTimeLimitEnabled,
      aiEvaluation: settings.examAiEvaluation,
      pointsProfile: selectedRunProfile,
      combinationMode,
      pointsProfileAssignments: sessionTaskPlan.profileAssignments,
    };
    examStartTimeRef.current = Date.now();
    examRunRecordedRef.current = false;
    setSessionInvalidationMessage("");
    setMixSeed(sessionSeed);
    setActiveMixSeed(sessionSeed);
    setActiveExamTasks(sessionTasks);
    setActiveExamFiles(
      selectedExamSources.map((source) => ({
        path: source.examPath,
        relative_path: source.sourceTitle,
      })),
    );
    setActiveSettings(snapshot);
    setStage("running");
    setActiveTaskIndex(0);
    setManualScoringIndex(0);
    setPartStates({});
    setAwardedPoints({});
    setAutoGradeDecisions({});
    setCorrectionState(null);
    setResultTaskCardWrapPendingById({});
    setResultTaskCardWrapErrorById({});
    setResultTaskCardWrapNoticeById({});
    setExamTimeUp(false);
    const snapshotTimeLimitMs = snapshot.timeLimitEnabled
      ? snapshot.durationMinutes * 60 * 1000
      : 0;
    if (snapshotTimeLimitMs > 0) {
      setExamTimeRemainingMs(snapshotTimeLimitMs);
      examTimerEndRef.current = Date.now() + snapshotTimeLimitMs;
    } else {
      setExamTimeRemainingMs(null);
      examTimerEndRef.current = null;
    }
  }, [
    canStartExam,
    combinationMode,
    mixSeed,
    resolveSessionTaskPointsPlan,
    selectedExamSourceRows,
    selectedExamSources,
    selectedRunProfile,
    settings.examAiEvaluation,
    settings.examTimeLimitEnabled,
  ]);

  const handleResetExam = useCallback(() => {
    resetExamState();
  }, [resetExamState]);

  const handleDeleteExamRun = useCallback(
    async (runId: string) => {
      if (!runId) {
        return;
      }
      setExamRunDeleteError("");
      let previousRuns: ExamRun[] = [];
      let hadRun = false;

      setExamRuns((prev) => {
        previousRuns = prev;
        hadRun = prev.some((run) => run.id === runId);
        return prev.filter((run) => run.id !== runId);
      });

      if (!hadRun) {
        return;
      }

      const nextRuns = previousRuns.filter((run) => run.id !== runId);
      const targetRun = previousRuns.find((run) => run.id === runId) ?? null;
      let success = true;

      if (resolvedProfileRootPath) {
        success = await deleteExamRunStoreEntry(
          resolvedProfileRootPath,
          runId,
          targetRun?.filePath ?? null,
        );
      } else {
        try {
          const storage: ExamRunStorage = { runs: nextRuns };
          await invoke("save_exam_run_data", { storage });
        } catch (error) {
          console.warn("Failed to delete exam run entry", error);
          success = false;
        }
      }

      if (!success) {
        setExamRuns(previousRuns);
        setExamRunDeleteError("Eintrag konnte nicht geloescht werden.");
      }
    },
    [userVault.activeProfilePath],
  );

  const handleSubmitExam = useCallback(() => {
    if (stage !== "running") {
      return;
    }
    setStage("review");
  }, [stage]);

  useEffect(() => {
    if (stage !== "running" || !examTimerEnabled) {
      if (examTimerRef.current !== null) {
        window.clearInterval(examTimerRef.current);
        examTimerRef.current = null;
      }
      if (!examTimerEnabled) {
        setExamTimeRemainingMs(null);
      }
      return;
    }

    const endTime = examTimerEndRef.current ?? Date.now() + examTimeLimitMs;
    examTimerEndRef.current = endTime;

    const updateTimer = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setExamTimeRemainingMs(remaining);
      if (remaining <= 0) {
        setExamTimeUp(true);
        if (examTimerRef.current !== null) {
          window.clearInterval(examTimerRef.current);
          examTimerRef.current = null;
        }
        if (stage === "running") {
          setStage("review");
        }
      }
    };

    updateTimer();
    if (examTimerRef.current !== null) {
      window.clearInterval(examTimerRef.current);
    }
    examTimerRef.current = window.setInterval(updateTimer, 1000);

    return () => {
      if (examTimerRef.current !== null) {
        window.clearInterval(examTimerRef.current);
        examTimerRef.current = null;
      }
    };
  }, [examTimeLimitMs, examTimerEnabled, stage]);

  const handleStartScoring = useCallback(() => {
    if (stage !== "review") {
      return;
    }
    setManualScoringIndex(0);
    setStage(manualTaskIndices.length > 0 ? "scoring_manual" : "finish_scoring");
  }, [manualTaskIndices.length, stage]);

  const handleFinishManualScoring = useCallback(() => {
    if (stage !== "scoring_manual") {
      return;
    }
    setAwardedPoints((prev) => {
      const next = { ...prev };
      manualTaskEntries.forEach((entry) => {
        if (next[entry.taskIndex] === null || next[entry.taskIndex] === undefined) {
          next[entry.taskIndex] = 0;
        }
      });
      return next;
    });
    setStage("finish_scoring");
  }, [manualTaskEntries, stage]);

  const handleBackToFinishScoring = useCallback(() => {
    if (stage !== "correction") {
      return;
    }
    setStage("finish_scoring");
  }, [stage]);

  const handleFinalizeExam = useCallback(() => {
    if (stage !== "finish_scoring") {
      return;
    }
    setStage("finished");
  }, [stage]);

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
      try {
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
      } finally {
        endInternalDrag(DRAG_CHANNELS.CLOZE_TOKEN);
      }
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
      if (stage !== "scoring_manual") {
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
      if (stage !== "scoring_manual") {
        return;
      }
      setAutoGradeDecisions((prev) => ({ ...prev, [taskIndex]: decision }));
    },
    [stage],
  );

  const handleTaskBack = useCallback((step = 1) => {
    const resolvedStep = normalizeNavigationStep(step);
    setActiveTaskIndex((prev) => Math.max(0, prev - resolvedStep));
  }, []);

  const handleTaskNext = useCallback((step = 1) => {
    if (runTasks.length === 0) {
      return;
    }
    const resolvedStep = normalizeNavigationStep(step);
    setActiveTaskIndex((prev) =>
      Math.min(runTasks.length - 1, prev + resolvedStep),
    );
  }, [runTasks.length]);

  const handleManualScoringBack = useCallback(() => {
    setManualScoringIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleManualScoringNext = useCallback(() => {
    if (manualTaskEntries.length === 0) {
      return;
    }
    setManualScoringIndex((prev) =>
      Math.min(manualTaskEntries.length - 1, prev + 1),
    );
  }, [manualTaskEntries.length]);

  const buildResultsFromAttempt = useCallback(
    (
      taskStates: Record<number, CompositePartState[]>,
      taskAwardedPoints: Record<number, number | null>,
      taskAutoGradeDecisions: Record<number, boolean>,
    ): ExamResults | null => {
      if (!activeExamSettings || runTasks.length === 0) {
        return null;
      }

      const breakdown = runTasks.map((task, index) => {
        const maxPoints = runTaskPoints[index] ?? 0;
        const currentTaskPartStates = taskStates[index] ?? [];
        if (isAutoGradedTask(task)) {
          const isCorrect = isTaskCorrect(task, currentTaskPartStates);
          const overrideDecision = taskAutoGradeDecisions[index];
          const decidedCorrect = overrideDecision ?? isCorrect;
          const autoAwarded = resolveAutoTaskAwardedPoints({
            task,
            partStates: currentTaskPartStates,
            maxPoints,
            overrideDecision,
            pointsProfile: activeExamSettings.pointsProfile,
            defaultTypePoints: settings.examTaskTypeDefaultPoints,
          });
          return {
            index: index + 1,
            sessionTaskId: task.sessionTaskId,
            sourceTitle: task.sourceTitle,
            originalTaskNumber: task.originalTaskNumber,
            awardedPoints: autoAwarded,
            maxPoints,
            isCorrect: decidedCorrect,
            detail: {
              task,
              partStates: currentTaskPartStates,
              awardedPoints: autoAwarded,
              autoGradeDecision: overrideDecision,
            },
          };
        }
        const awarded = normalizeAwardedPoints(taskAwardedPoints[index] ?? null, maxPoints);
        return {
          index: index + 1,
          sessionTaskId: task.sessionTaskId,
          sourceTitle: task.sourceTitle,
          originalTaskNumber: task.originalTaskNumber,
          awardedPoints: awarded,
          maxPoints,
          isCorrect: null,
          detail: {
            task,
            partStates: currentTaskPartStates,
            awardedPoints: awarded,
          },
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
    },
    [
      activeExamSettings,
      runTaskPoints,
      runTasks,
      settings.examTaskTypeDefaultPoints,
    ],
  );

  const canShowResults =
    Boolean(activeExamSettings) &&
    runTasks.length > 0 &&
    (stage === "scoring_manual" ||
      stage === "finish_scoring" ||
      stage === "correction" ||
      stage === "finished");

  const results = useMemo(
    () =>
      canShowResults
        ? buildResultsFromAttempt(partStates, awardedPoints, autoGradeDecisions)
        : null,
    [
      autoGradeDecisions,
      awardedPoints,
      buildResultsFromAttempt,
      canShowResults,
      partStates,
    ],
  );
  const incorrectTaskResults = useMemo(
    () => results?.breakdown.filter((item) => item.isCorrect === false) ?? [],
    [results],
  );

  const handleStartCorrection = useCallback(() => {
    if (stage !== "finish_scoring" || incorrectTaskResults.length === 0) {
      return;
    }
    setCorrectionState({
      queue: incorrectTaskResults.map((item, queueIndex) => ({
        sessionTaskId: item.sessionTaskId,
        queueIndex,
        sourceTaskIndex: item.index - 1,
      })),
      activeIndex: 0,
      partStates: {},
      submissions: {},
    });
    setStage("correction");
  }, [incorrectTaskResults, stage]);

  const updateCorrectionPartState = useCallback(
    (
      sessionTaskId: string,
      partIndex: number,
      updater: (current: CompositePartState) => CompositePartState,
    ) => {
      setCorrectionState((prev) => {
        if (!prev) {
          return prev;
        }
        const nextParts = [...(prev.partStates[sessionTaskId] ?? [])];
        const current = nextParts[partIndex] ?? {};
        nextParts[partIndex] = updater(current);
        return {
          ...prev,
          partStates: {
            ...prev.partStates,
            [sessionTaskId]: nextParts,
          },
        };
      });
    },
    [],
  );

  const handleCorrectionOptionSelect = useCallback(
    (sessionTaskId: string, partIndex: number, keys: string[]) => {
      const uniqueKeys = Array.from(new Set(keys));
      updateCorrectionPartState(sessionTaskId, partIndex, (current) => ({
        ...current,
        selections: uniqueKeys,
      }));
    },
    [updateCorrectionPartState],
  );

  const handleCorrectionTrueFalseSelect = useCallback(
    (
      sessionTaskId: string,
      partIndex: number,
      itemId: string,
      value: TrueFalseSelection,
    ) => {
      updateCorrectionPartState(sessionTaskId, partIndex, (current) => ({
        ...current,
        trueFalseSelections: {
          ...(current.trueFalseSelections ?? {}),
          [itemId]: value,
        },
      }));
    },
    [updateCorrectionPartState],
  );

  const handleCorrectionClozeInputChange = useCallback(
    (sessionTaskId: string, partIndex: number, blankId: string, value: string) => {
      updateCorrectionPartState(sessionTaskId, partIndex, (current) => ({
        ...current,
        clozeResponses: {
          ...(current.clozeResponses ?? {}),
          [blankId]: value,
        },
      }));
    },
    [updateCorrectionPartState],
  );

  const handleCorrectionClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      sessionTaskId: string,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      try {
        const payload = getClozeDragPayload(event);
        if (!payload || payload.partIndex !== partIndex) {
          return;
        }
        if (payload.tokenId === blankId || !validTokenIds.has(payload.tokenId)) {
          return;
        }

        updateCorrectionPartState(sessionTaskId, partIndex, (current) => {
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
      } finally {
        endInternalDrag(DRAG_CHANNELS.CLOZE_TOKEN);
      }
    },
    [updateCorrectionPartState],
  );

  const handleCorrectionClozeTokenRemove = useCallback(
    (sessionTaskId: string, partIndex: number, blankId: string) => {
      updateCorrectionPartState(sessionTaskId, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        delete responses[blankId];
        return { ...current, clozeResponses: responses };
      });
    },
    [updateCorrectionPartState],
  );

  const handleCorrectionTextInputChange = useCallback(
    (sessionTaskId: string, partIndex: number, value: string) => {
      updateCorrectionPartState(sessionTaskId, partIndex, (current) => ({
        ...current,
        textResponse: value,
      }));
    },
    [updateCorrectionPartState],
  );

  const handleCorrectionSubmit = useCallback(
    (sessionTaskId: string, canSubmit: boolean) => {
      if (!canSubmit) {
        return;
      }
      setCorrectionState((prev) =>
        prev
          ? {
              ...prev,
              submissions: {
                ...prev.submissions,
                [sessionTaskId]: true,
              },
            }
          : prev,
      );
    },
    [],
  );

  const handleCorrectionTaskBack = useCallback(() => {
    setCorrectionState((prev) =>
      prev
        ? {
            ...prev,
            activeIndex: Math.max(0, prev.activeIndex - 1),
          }
        : prev,
    );
  }, []);

  const handleCorrectionTaskNext = useCallback(() => {
    setCorrectionState((prev) =>
      prev
        ? {
            ...prev,
            activeIndex: Math.min(prev.queue.length - 1, prev.activeIndex + 1),
          }
        : prev,
    );
  }, []);

  useEffect(() => {
    if (stage !== "finished") {
      examRunRecordedRef.current = false;
      return;
    }
    if (!results || activeExamFiles.length === 0 || !examRunsLoaded) {
      return;
    }
    if (examRunRecordedRef.current) {
      return;
    }
    const firstExamFile = activeExamFiles[0];
    if (!firstExamFile) {
      return;
    }

    const finishedAt = new Date().toISOString();
    const startedAt = examStartTimeRef.current
      ? new Date(examStartTimeRef.current).toISOString()
      : finishedAt;
    const durationMs = examStartTimeRef.current
      ? Math.max(0, Date.now() - examStartTimeRef.current)
      : 0;
    const percent = calculateExamPercent(results.totalAwarded, results.totalMax);
    const passed = isExamPassed(percent);
    const grade = resolveExamGrade(settings.examGradeScale, percent);
    const examFilePath =
      activeExamFiles.length === 1
        ? firstExamFile.relative_path || firstExamFile.path
        : `Mixed (${activeExamFiles.length}): ${activeExamFiles
            .map((file) => file.relative_path || file.path)
            .join(", ")}`;
    const profileAssignments = activeExamSettings?.pointsProfileAssignments ?? [];
    const selectedProfile = activeExamSettings?.pointsProfile ?? null;

    const run: ExamRun = {
      id: buildExamRunId(),
      startedAt,
      endedAt: finishedAt,
      durationMs,
      userId: spacedRepetition.spacedRepetitionActiveUserId ?? null,
      userName: spacedRepetition.spacedRepetitionActiveUser ?? "Unknown",
      examFilePath,
      tasksDetected: runTasks.length,
      maxPoints: results.totalMax,
      achievedPoints: results.totalAwarded,
      percent,
      passed,
      grade,
      gradeScaleId: settings.examGradeScale,
      pointsProfileId: selectedProfile?.id ?? null,
      pointsProfileName: selectedProfile?.name ?? null,
      pointsProfileVersion: selectedProfile?.version ?? null,
      pointsProfileAssignments: profileAssignments,
    };

    if (resolvedProfileRootPath) {
      void (async () => {
        const filePath = await appendExamRunStore(resolvedProfileRootPath, run);
        if (!filePath) {
          return;
        }
        setExamRuns((prev) =>
          sortExamRunsByDateDesc(
            prev.map((entry) =>
              entry.id === run.id ? { ...entry, filePath } : entry,
            ),
          ),
        );
      })();
    }
    setExamRuns((prev) => sortExamRunsByDateDesc([run, ...prev]));
    if (activeExamFiles.length === 1) {
      const singleExamFile = activeExamFiles[0];
      if (!singleExamFile) {
        examRunRecordedRef.current = true;
        return;
      }
      const scoreValue = `${results.totalAwarded}/${results.totalMax}`;
      const percentValue = String(percent);
      const statusValue = String(resolveExamStatusDescriptor(percent).value);
      void (async () => {
        try {
          const contents = await invoke<string>("read_text_file", {
            path: singleExamFile.path,
          });
          if (!parseExamTasks(contents).hasExamBlock) {
            return;
          }
          const updated = upsertExamResultStatsFrontmatter({
            markdown: contents,
            score: scoreValue,
            percent: percentValue,
            status: statusValue,
          });
          if (updated.error) {
            console.warn("Failed to write exam result stats to markdown", updated.error);
            return;
          }
          if (updated.markdown === contents) {
            return;
          }
          await invoke("write_text_file", {
            path: singleExamFile.path,
            contents: updated.markdown,
          });
          if (preview.selectedFile?.path === singleExamFile.path) {
            preview.setPreview(updated.markdown);
          }
        } catch (error) {
          console.warn(
            "Failed to persist exam result stats to markdown",
            asErrorMessage(error, "Unknown error"),
          );
        }
      })();
    }
    examRunRecordedRef.current = true;
  }, [
    activeExamSettings,
    activeExamFiles,
    examRunsLoaded,
    results,
    runTasks.length,
    settings.examGradeScale,
    spacedRepetition.spacedRepetitionActiveUser,
    spacedRepetition.spacedRepetitionActiveUserId,
    stage,
    userVault.activeProfilePath,
    preview,
  ]);

  const getTaskCardWrapDisabledReason = useCallback(
    (task: ExamSessionTask) => {
      if (stage !== "finished") {
        return "Card wrapper toggle is available after scoring is finished.";
      }
      if (!task.sourceExamPath) {
        return "This task has no source file reference.";
      }
      const matchingSourceFiles = activeExamFiles.filter(
        (file) => file.path === task.sourceExamPath,
      );
      if (matchingSourceFiles.length !== 1) {
        return "Task source file is not uniquely available in this exam session.";
      }
      const scopeResolution = resolveTaskMutationScope({
        sourcePath: task.sourceExamPath,
        sourceRange: task.sourceRange,
      });
      if (!scopeResolution.scope) {
        return scopeResolution.reason;
      }
      return "";
    },
    [activeExamFiles, stage],
  );

  const handleResultTaskCardWrapperToggle = useCallback(
    (sessionTaskId: string, nextWrapped: boolean) => {
      if (stage !== "finished") {
        return;
      }
      const targetTask = runTasks.find((task) => task.sessionTaskId === sessionTaskId);
      if (!targetTask) {
        setResultTaskCardWrapErrorById((prev) => ({
          ...prev,
          [sessionTaskId]: "Task not found in current exam results.",
        }));
        return;
      }
      if (resultTaskCardWrapPendingById[sessionTaskId]) {
        return;
      }

      const disabledReason = getTaskCardWrapDisabledReason(targetTask);
      if (disabledReason) {
        setResultTaskCardWrapErrorById((prev) => ({
          ...prev,
          [sessionTaskId]: disabledReason,
        }));
        return;
      }

      const scopeResolution = resolveTaskMutationScope({
        sourcePath: targetTask.sourceExamPath,
        sourceRange: targetTask.sourceRange,
      });
      if (!scopeResolution.scope) {
        setResultTaskCardWrapErrorById((prev) => ({
          ...prev,
          [sessionTaskId]: scopeResolution.reason,
        }));
        return;
      }
      const mutationScope = scopeResolution.scope;
      const sourcePath = mutationScope.sourcePath;

      setResultTaskCardWrapPendingById((prev) => ({ ...prev, [sessionTaskId]: true }));
      setResultTaskCardWrapErrorById((prev) => ({ ...prev, [sessionTaskId]: "" }));
      setResultTaskCardWrapNoticeById((prev) => ({ ...prev, [sessionTaskId]: "" }));

      const applyToggle = async () => {
        try {
          const toggleResult = await applyTaskAreaToggle({
            scope: mutationScope,
            nextEnabled: nextWrapped,
            mutators: {
              findWrapper: findExamTaskWrapper,
              addWrapper: wrapExamTask,
              removeWrapper: unwrapExamTask,
            },
            readSource: (path) =>
              invoke<string>("read_text_file", {
                path,
              }),
            writeSource: (path, contents) =>
              invoke("write_text_file_atomic", {
                path,
                contents,
              }),
            onSourceUpdated: ({ contents, wroteFile }) => {
              if (wroteFile && preview.selectedFile?.path === sourcePath) {
                preview.setPreview(contents);
              }

              const reparsed = parseExamTasks(contents);
              setSelectedExamParses((prev) => {
                const current = prev[sourcePath];
                if (!current) {
                  return prev;
                }
                return {
                  ...prev,
                  [sourcePath]: {
                    ...current,
                    tasks: reparsed.tasks,
                    hasExamBlock: reparsed.hasExamBlock,
                  },
                };
              });

              setActiveExamTasks((prev) => {
                const parsedByIndex = new Map(
                  reparsed.tasks.map((task) => [task.index, task] as const),
                );
                let changed = false;
                const next = prev.map((task) => {
                  if (task.sourceExamPath !== sourcePath) {
                    return task;
                  }
                  const parsedTask = parsedByIndex.get(task.index);
                  if (!parsedTask) {
                    return task;
                  }
                  changed = true;
                  return {
                    ...parsedTask,
                    sessionTaskId: task.sessionTaskId,
                    sourceExamPath: task.sourceExamPath,
                    sourceTitle: task.sourceTitle,
                    originalTaskNumber: task.originalTaskNumber,
                    sourceTaskIndex: task.sourceTaskIndex,
                    sessionIndex: task.sessionIndex,
                  };
                });
                return changed ? next : prev;
              });
            },
            onRescanVault: () => actions.handleRescanVault("exam-results-card-toggle"),
          });
          const rescanOk = toggleResult.rescanOk;
          if (!rescanOk) {
            setResultTaskCardWrapNoticeById((prev) => ({
              ...prev,
              [sessionTaskId]:
                toggleResult.wroteFile
                  ? "File saved, but vault refresh failed. Some views may update after a manual refresh."
                  : "Vault refresh failed. Some views may update after a manual refresh.",
            }));
          }
        } catch (error) {
          setResultTaskCardWrapErrorById((prev) => ({
            ...prev,
            [sessionTaskId]: asErrorMessage(error, "Failed to update task wrapper."),
          }));
        } finally {
          setResultTaskCardWrapPendingById((prev) => ({
            ...prev,
            [sessionTaskId]: false,
          }));
        }
      };

      void applyToggle();
    },
    [
      actions,
      getTaskCardWrapDisabledReason,
      preview,
      resultTaskCardWrapPendingById,
      runTasks,
      stage,
    ],
  );

  const activeTaskPartStates = activeTask
    ? partStates[activeTaskIndex] ?? EMPTY_PART_STATES
    : EMPTY_PART_STATES;
  const activeTaskAwardedPoints = activeTask
    ? awardedPoints[activeTaskIndex] ?? null
    : null;
  const activeTaskAutoDecision = activeTask
    ? autoGradeDecisions[activeTaskIndex]
    : undefined;
  const getTaskPartStates = useCallback(
    (taskIndex: number) => partStates[taskIndex] ?? EMPTY_PART_STATES,
    [partStates],
  );
  const getTaskAwardedPoints = useCallback(
    (taskIndex: number) => awardedPoints[taskIndex] ?? null,
    [awardedPoints],
  );
  const getTaskAutoGradeDecision = useCallback(
    (taskIndex: number) => autoGradeDecisions[taskIndex],
    [autoGradeDecisions],
  );
  const correctionActiveEntry =
    correctionState?.queue[correctionState.activeIndex] ?? null;
  const correctionActiveTask = correctionActiveEntry
    ? (runTasks[correctionActiveEntry.sourceTaskIndex] ?? null)
    : null;
  const correctionActiveMaxPoints = correctionActiveEntry
    ? (runTaskPoints[correctionActiveEntry.sourceTaskIndex] ?? 0)
    : 0;
  const correctionActivePartStates =
    correctionActiveEntry && correctionState
      ? correctionState.partStates[correctionActiveEntry.sessionTaskId] ??
        EMPTY_PART_STATES
      : EMPTY_PART_STATES;
  const correctionActiveSubmitted =
    correctionActiveEntry && correctionState
      ? Boolean(correctionState.submissions[correctionActiveEntry.sessionTaskId])
      : false;
  const correctionCanGoBack = (correctionState?.activeIndex ?? 0) > 0;
  const correctionCanGoNext =
    (correctionState?.activeIndex ?? 0) < ((correctionState?.queue.length ?? 0) - 1);
  const correctionQueueLength = correctionState?.queue.length ?? 0;
  const selectionPreviewState: LoadState =
    selectedExamCount === 0 || selectedRunnableExamCount === 0
      ? "idle"
      : selectedExamParseState;
  const selectionPreviewError = selectedExamParseError;
  const examEmptyState = useMemo(() => {
    if (selectedExamCount === 0 || selectionPreviewState !== "idle") {
      return null;
    }
    if (selectedRunnableExamCount === 0) {
      return {
        title: "Keine gueltigen Exam-Dateien ausgewaehlt",
        message:
          "Waehle mindestens eine gueltige Exam-Datei mit erkannten Aufgaben aus.",
      };
    }
    if (selectionPreviewError && previewExamParse.tasks.length === 0) {
      return {
        title: "Dateien konnten nicht geladen werden",
        message: selectionPreviewError,
      };
    }
    if (previewExamParse.tasks.length === 0) {
      return {
        title: "Keine Aufgaben im kombinierten Lauf",
        message:
          "Fuer die aktuelle Auswahl und den Modus wurden keine Tasks eingebunden.",
      };
    }
    return null;
  }, [
    previewExamParse.tasks.length,
    selectedExamCount,
    selectedRunnableExamCount,
    selectionPreviewError,
    selectionPreviewState,
  ]);
  const selectedExamSourceFiles = useMemo(
    () =>
      selectedExamSources.map((source) => ({
        path: source.examPath,
        relative_path: source.sourceTitle,
      })),
    [selectedExamSources],
  );
  const sessionExamFiles = stage === "idle" ? selectedExamSourceFiles : activeExamFiles;
  const mixSessionEnabled = sessionExamFiles.length >= 2;
  const mixSessionSeed = stage === "idle" ? mixSeed : activeMixSeed;
  const combinationModeLabel =
    combinationMode === "fully-mixed"
      ? "Komplett gemischt"
      : combinationMode === "sequential"
        ? "Hintereinander"
        : combinationMode === "sequential-shuffled"
          ? "Hintereinander mit interner Mischung"
          : "Nested";
  const isCombinationModeRandomized =
    combinationMode === "fully-mixed" ||
    combinationMode === "sequential-shuffled" ||
    combinationMode === "nested";
  const runProfileOptions = pointsProfiles.profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
  }));

  return {
    actions,
    preview,
    settings,
    spacedRepetition,
    vault,
    examFiles,
    examFilesState,
    examFilesError,
    examRuns,
    examRunDeleteError,
    selectedExamFiles,
    selectedExamRunnableFiles,
    selectedExamIgnoredEntries,
    selectedExamPathRows,
    selectedExamPaths,
    selectedExamCount,
    selectedRunnableExamCount,
    selectedIncludedExamCount,
    selectedValidTaskCount,
    selectedExamParseState: selectionPreviewState,
    selectedExamParseError: selectionPreviewError,
    sessionInvalidationMessage,
    previewExamParse,
    combinationMode,
    combinationModeLabel,
    isCombinationModeRandomized,
    runProfileOptions,
    selectedRunProfileId,
    selectedRunProfile,
    previewDurationMinutes,
    mixSeed: mixSessionSeed,
    mixSessionEnabled,
    mixSessionExamFiles: sessionExamFiles,
    canReshuffleMix,
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
    getTaskPartStates,
    getTaskAwardedPoints,
    getTaskAutoGradeDecision,
    activeManualTaskEntry,
    manualTaskEntries,
    manualScoringComplete,
    canGoManualScoringBack,
    canGoManualScoringNext,
    incorrectTaskResults,
    correctionActiveEntry,
    correctionActiveTask,
    correctionActiveMaxPoints,
    correctionActivePartStates,
    correctionActiveSubmitted,
    correctionCanGoBack,
    correctionCanGoNext,
    correctionQueueLength,
    activeMixedTasks: activeExamTasks,
    runTasks,
    runTaskPoints,
    runMaxPoints,
    examDurationMinutes,
    examTimeLimitMs,
    examTimeRemainingMs,
    examTimeUp,
    examTimerEnabled,
    examShowTimeline,
    remainingPoints,
    missingExamSettings,
    isSettingsValid,
    canStartExam,
    examEmptyState,
    results,
    resultTaskCardWrapPendingById,
    resultTaskCardWrapErrorById,
    resultTaskCardWrapNoticeById,
    handleDeleteExamRun,
    handleToggleExamSelection,
    handleSelectVisibleExamFiles,
    handleSetSelectedExamRows,
    handleClearExamSelection,
    handlePlaceSelectedExamFile,
    handleMoveSelectedExamFile,
    handleCombinationModeChange,
    handleRunProfileChange,
    handleStartExam,
    handleReshuffleMix,
    handleResetExam,
    handleSubmitExam,
    handleStartScoring,
    handleFinishManualScoring,
    handleStartCorrection,
    handleBackToFinishScoring,
    handleFinalizeExam,
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
    handleManualScoringBack,
    handleManualScoringNext,
    handleCorrectionOptionSelect,
    handleCorrectionTrueFalseSelect,
    handleCorrectionClozeInputChange,
    handleCorrectionClozeTokenDrop,
    handleCorrectionClozeTokenRemove,
    handleCorrectionTextInputChange,
    handleCorrectionSubmit,
    handleCorrectionTaskBack,
    handleCorrectionTaskNext,
    handleResultTaskCardWrapperToggle,
    getTaskCardWrapDisabledReason,
  };
};
