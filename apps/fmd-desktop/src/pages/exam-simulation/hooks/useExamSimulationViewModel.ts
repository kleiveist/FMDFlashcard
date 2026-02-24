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
import type { MissingExamSetting } from "../../../features/settings/validateExamSettings";
import { asErrorMessage } from "../../../lib/errors";
import {
  buildExamRunId,
  calculateExamPercent,
  isExamPassed,
  resolveExamStatusDescriptor,
  subscribeExamRunHistoryReset,
  sortExamRunsByDateDesc,
  type ExamRunPointsProfileAssignment,
  type ExamRun,
  type ExamRunStorage,
} from "../../../lib/examRuns";
import {
  AUTO_CARD_TYPES,
  findExamTaskWrapper,
  resolveFlashcardPartAutoCardType,
  unwrapExamTask,
  wrapExamTask,
} from "../../../lib/exam/autoCards";
import { parseExamTasks, type ExamTask } from "../../../lib/exam";
import {
  EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  type ExamPointsProfile,
} from "../../../lib/exam/pointsProfiles";
import {
  resolveExamTaskPointTypes,
  resolveTaskMaxPointsFromProfile,
  resolveTaskTypePointsFromMap,
} from "../../../lib/exam/pointsScoring";
import {
  buildMixedSessionTasks,
  buildSingleSessionTasks,
  createMixSeed,
  type DuplicateTaskNumberWarning,
  type ExamSessionSource,
  type ExamSessionTask,
} from "../../../lib/examMixedSession";
import { type VaultFile } from "../../../lib/tree";
import type { LoadState } from "../../../lib/types";
import {
  appendExamRunStore,
  deleteExamRunStoreEntry,
  loadExamRunStore,
  saveExamRunStore,
} from "../../../features/user-vault/storage";
import { resolveExamTaskFrontmatterValue } from "../../../features/exam-points/frontmatterTask";
import { upsertExamResultStatsFrontmatter } from "../../../features/exam-results/frontmatterStats";

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
  durationMinutes: number;
  timeLimitEnabled: boolean;
  aiEvaluation: ExamAiEvaluation;
  pointsProfileAssignments: ExamRunPointsProfileAssignment[];
};

type ExamTaskResult = {
  index: number;
  sessionTaskId: string;
  sourceTitle: string;
  originalTaskNumber: number;
  awardedPoints: number;
  maxPoints: number;
  isCorrect: boolean | null;
  detail: {
    task: ExamSessionTask;
    partStates: CompositePartState[];
    awardedPoints: number | null;
    autoGradeDecision?: boolean;
  };
};

type SelectedExamParseEntry = {
  tasks: ExamTask[];
  hasExamBlock: boolean;
  taskProfileName: string | null;
};

type PreviewSession = {
  tasks: ExamSessionTask[];
  hasExamBlock: boolean;
  duplicateTaskNumberWarnings: DuplicateTaskNumberWarning[];
};

type ResolvedExamProfileAssignment = {
  examPath: string;
  sourceTitle: string;
  requestedName: string | null;
  profile: ExamPointsProfile | null;
  missing: boolean;
};

type SessionTaskPointsPlan = {
  taskPoints: number[];
  maxTotalPoints: number;
  profileAssignments: ExamRunPointsProfileAssignment[];
  missingAssignments: ResolvedExamProfileAssignment[];
};

const buildSelectionSignature = (paths: string[]) =>
  paths.slice().sort((left, right) => left.localeCompare(right)).join("|");

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

const resolveDurationFromProfileAssignments = (
  assignments: ResolvedExamProfileAssignment[],
  fallbackDuration: number,
) => {
  const assignedDurations = assignments
    .map((assignment) => assignment.profile)
    .filter((profile): profile is ExamPointsProfile => Boolean(profile))
    .map((profile) => normalizeDurationMinutes(profile.durationMinutes));
  if (assignedDurations.length > 0) {
    return Math.max(...assignedDurations);
  }
  return normalizeDurationMinutes(fallbackDuration);
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
    selectedExamFilePaths,
  } = useAppState();
  const [examRuns, setExamRuns] = useState<ExamRun[]>([]);
  const [examRunsLoaded, setExamRunsLoaded] = useState(false);
  const [examRunDeleteError, setExamRunDeleteError] = useState("");
  const [, setExamRunsMigratedFromLegacy] = useState(false);
  const [stage, setStage] = useState<ExamStage>("idle");
  const [selectedExamParses, setSelectedExamParses] = useState<
    Record<string, SelectedExamParseEntry>
  >({});
  const [selectedExamParseState, setSelectedExamParseState] =
    useState<LoadState>("idle");
  const [selectedExamParseError, setSelectedExamParseError] = useState("");
  const [mixSeed, setMixSeed] = useState<string>(() => createMixSeed());
  const [sessionInvalidationMessage, setSessionInvalidationMessage] = useState("");
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
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
  const duplicateWarningSignatureRef = useRef("");


  useEffect(() => {
    let cancelled = false;
    setExamRuns([]);
    setExamRunsLoaded(false);

    const loadRuns = async () => {
      try {
        if (userVault.activeProfilePath) {
          const store = await loadExamRunStore(userVault.activeProfilePath);
          let runs = Array.isArray(store.runs) ? store.runs : [];
          let migrated = store.migratedFromAppData;
          if (!migrated && runs.length === 0) {
            const legacy = await invoke<ExamRunStorage>("load_exam_run_data");
            runs = Array.isArray(legacy?.runs) ? legacy.runs : [];
            migrated = true;
            await saveExamRunStore(userVault.activeProfilePath, {
              ...store,
              runs,
              migratedFromAppData: migrated,
            });
          }
          if (cancelled) {
            return;
          }
          setExamRuns(sortExamRunsByDateDesc(runs));
          setExamRunsMigratedFromLegacy(migrated);
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
  }, [userVault.activeProfilePath, userVault.revision]);

  useEffect(() => {
    const unsubscribe = subscribeExamRunHistoryReset(() => {
      setExamRuns([]);
      if (userVault.activeProfilePath) {
        setExamRunsMigratedFromLegacy(true);
      }
    });
    return unsubscribe;
  }, [userVault.activeProfilePath]);

  useEffect(() => {
    if (!examRunsLoaded || userVault.activeProfilePath) {
      return;
    }
    const storage: ExamRunStorage = { runs: examRuns };
    void invoke("save_exam_run_data", { storage }).catch((error) => {
      console.warn("Failed to save exam runs", error);
    });
  }, [examRuns, examRunsLoaded, userVault.activeProfilePath]);

  const examFilesByPath = useMemo(
    () => new Map(examFiles.map((file) => [file.path, file])),
    [examFiles],
  );
  const selectedExamPaths = selectedExamFilePaths;

  const selectedExamFiles = useMemo(
    () =>
      selectedExamPaths
        .map((path) => examFilesByPath.get(path))
        .filter((file): file is VaultFile => Boolean(file)),
    [examFilesByPath, selectedExamPaths],
  );
  const selectedExamCount = selectedExamFiles.length;
  const mixModeEnabled = selectedExamCount >= 2;
  const selectedExamSelectionSignature = useMemo(
    () => buildSelectionSignature(selectedExamPaths),
    [selectedExamPaths],
  );

  useEffect(() => {
    if (selectedExamCount === 0) {
      setSelectedExamParses({});
      setSelectedExamParseState("idle");
      setSelectedExamParseError("");
      return;
    }

    let cancelled = false;
    setSelectedExamParseState("loading");
    setSelectedExamParseError("");

    const parseSelectedExamFiles = async () => {
      const results = await Promise.allSettled(
        selectedExamFiles.map(async (file) => {
          const contents = await invoke<string>("read_text_file", {
            path: file.path,
          });
          return {
            file,
            parsed: parseExamTasks(contents),
            taskProfileName: resolveExamTaskFrontmatterValue(contents),
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const nextParses: Record<string, SelectedExamParseEntry> = {};
      let failures = 0;

      results.forEach((result, index) => {
        const file = selectedExamFiles[index];
        if (!file) {
          return;
        }
        if (result.status === "fulfilled") {
          nextParses[file.path] = {
            ...result.value.parsed,
            taskProfileName: result.value.taskProfileName,
          };
          return;
        }
        failures += 1;
        console.warn("Failed to parse selected exam file", file.path, result.reason);
      });

      setSelectedExamParses(nextParses);
      if (failures > 0) {
        setSelectedExamParseError(
          failures === selectedExamFiles.length
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
  }, [selectedExamCount, selectedExamFiles]);

  const selectedExamSources = useMemo(
    () =>
      selectedExamFiles
        .map((file) => {
          const parsed = selectedExamParses[file.path];
          if (!parsed) {
            return null;
          }
          return {
            examPath: file.path,
            sourceTitle: file.relative_path || file.path,
            tasks: parsed.tasks,
          } satisfies ExamSessionSource;
        })
        .filter((source): source is ExamSessionSource => Boolean(source)),
    [selectedExamFiles, selectedExamParses],
  );

  const previewSession = useMemo<PreviewSession>(() => {
    const hasAllParses = selectedExamSources.length === selectedExamCount;
    if (selectedExamCount === 0 || selectedExamParseState !== "idle" || !hasAllParses) {
      return {
        tasks: [] as ExamSessionTask[],
        hasExamBlock: false,
        duplicateTaskNumberWarnings: [],
      };
    }

    if (selectedExamCount === 1) {
      const source = selectedExamSources[0];
      if (!source) {
        return {
          tasks: [] as ExamSessionTask[],
          hasExamBlock: false,
          duplicateTaskNumberWarnings: [],
        };
      }
      return {
        tasks: buildSingleSessionTasks(source, mixSeed),
        hasExamBlock: selectedExamParses[source.examPath]?.hasExamBlock ?? false,
        duplicateTaskNumberWarnings: [],
      };
    }

    const mixed = buildMixedSessionTasks(selectedExamSources, mixSeed);
    const hasExamBlock = selectedExamSources.every(
      (source) => selectedExamParses[source.examPath]?.hasExamBlock ?? false,
    );
    return {
      tasks: mixed.tasks,
      hasExamBlock,
      duplicateTaskNumberWarnings: mixed.duplicateTaskNumberWarnings,
    };
  }, [
    mixSeed,
    selectedExamCount,
    selectedExamParseState,
    selectedExamParses,
    selectedExamSources,
  ]);

  useEffect(() => {
    const warnings = previewSession.duplicateTaskNumberWarnings;
    if (warnings.length === 0) {
      duplicateWarningSignatureRef.current = "";
      return;
    }
    const signature = warnings
      .map((warning) => `${warning.examPath}:${warning.taskNumber}:${warning.count}`)
      .join("|");
    if (duplicateWarningSignatureRef.current === signature) {
      return;
    }
    duplicateWarningSignatureRef.current = signature;
    warnings.forEach((warning) => {
      console.warn(
        `Duplicate task number ${warning.taskNumber}) in ${warning.sourceTitle} (${warning.count} entries).`,
      );
    });
  }, [previewSession.duplicateTaskNumberWarnings]);

  const previewExamParse = useMemo(
    () => ({
      tasks: previewSession.tasks,
      hasExamBlock: previewSession.hasExamBlock,
    }),
    [previewSession.hasExamBlock, previewSession.tasks],
  );

  const selectedExamProfileAssignments = useMemo<ResolvedExamProfileAssignment[]>(
    () =>
      selectedExamFiles.map((file) => {
        const parsed = selectedExamParses[file.path];
        const requestedNameRaw = parsed?.taskProfileName?.trim() ?? "";
        if (!requestedNameRaw) {
          return {
            examPath: file.path,
            sourceTitle: file.relative_path || file.path,
            requestedName: null,
            profile: null,
            missing: false,
          };
        }
        const resolved = pointsProfiles.resolveAssignedProfile(requestedNameRaw);
        return {
          examPath: file.path,
          sourceTitle: file.relative_path || file.path,
          requestedName: resolved.requestedName,
          profile: resolved.profile,
          missing: resolved.missing,
        };
      }),
    [pointsProfiles, selectedExamFiles, selectedExamParses],
  );

  const selectedExamProfileAssignmentMap = useMemo(
    () =>
      new Map(
        selectedExamProfileAssignments.map((assignment) => [
          assignment.examPath,
          assignment,
        ]),
      ),
    [selectedExamProfileAssignments],
  );
  const taskOrderProfileFallbackByExamPath = useMemo(() => {
    const fallbackMap = new Map<string, boolean>();
    selectedExamProfileAssignments.forEach((assignment) => {
      const profile = assignment.profile;
      if (!profile || profile.distribution !== "task-order") {
        fallbackMap.set(assignment.examPath, false);
        return;
      }
      const parsed = selectedExamParses[assignment.examPath];
      const tasks = parsed?.tasks ?? [];
      const shouldFallback = tasks.some((task) => {
        const points = profile.taskPoints[Math.max(0, task.index)];
        if (!Number.isFinite(points)) {
          return true;
        }
        return Math.floor(points) <= 0;
      });
      fallbackMap.set(assignment.examPath, shouldFallback);
    });
    return fallbackMap;
  }, [selectedExamParses, selectedExamProfileAssignments]);
  const defaultProfileDurationMinutes = normalizeDurationMinutes(
    pointsProfiles.defaultProfile?.durationMinutes ?? EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  );
  const previewDurationMinutes = useMemo(
    () =>
      resolveDurationFromProfileAssignments(
        selectedExamProfileAssignments,
        defaultProfileDurationMinutes,
      ),
    [defaultProfileDurationMinutes, selectedExamProfileAssignments],
  );

  const resolveTaskTypePointsSourceMap = useCallback(
    (task: ExamSessionTask) => {
      const assignment = selectedExamProfileAssignmentMap.get(task.sourceExamPath);
      const profile = assignment?.profile ?? null;
      const useDefaultTaskTypeFallback =
        (assignment && taskOrderProfileFallbackByExamPath.get(task.sourceExamPath)) ?? false;
      if (!profile || useDefaultTaskTypeFallback) {
        return settings.examTaskTypeDefaultPoints;
      }
      if (profile.distribution !== "task-type") {
        return null;
      }
      return AUTO_CARD_TYPES.reduce(
        (acc, type) => {
          acc[type] = Math.max(0, Math.floor(profile.typeRules[type]?.points ?? 0));
          return acc;
        },
        {} as Record<(typeof AUTO_CARD_TYPES)[number], number>,
      );
    },
    [
      selectedExamProfileAssignmentMap,
      settings.examTaskTypeDefaultPoints,
      taskOrderProfileFallbackByExamPath,
    ],
  );

  const resolveSessionTaskPointsPlan = useCallback(
    (tasks: ExamSessionTask[]): SessionTaskPointsPlan => {
      const profileAssignments = selectedExamProfileAssignments.map((assignment) => ({
        examPath: assignment.examPath,
        sourceTitle: assignment.sourceTitle,
        requestedName: assignment.requestedName,
        profileId: assignment.profile?.id ?? null,
        profileName: assignment.profile?.name ?? null,
        profileVersion: assignment.profile?.version ?? null,
        missing: assignment.missing,
      }));
      const missingAssignments = selectedExamProfileAssignments.filter(
        (assignment) => assignment.missing,
      );
      const taskPoints = tasks.map((task) => {
        const assignment = selectedExamProfileAssignmentMap.get(task.sourceExamPath);
        const profile = assignment?.profile ?? null;
        const taskTypes = resolveExamTaskPointTypes(task);
        const taskTypePointsSource = resolveTaskTypePointsSourceMap(task);
        if (taskTypePointsSource) {
          return resolveTaskTypePointsFromMap({
            taskTypes,
            typePoints: taskTypePointsSource,
          });
        }
        if (!profile) {
          // Defensive fallback: missing profiles should already resolve via taskTypePointsSource.
          return 0;
        }
        return resolveTaskMaxPointsFromProfile({
          profile,
          taskIndex: Math.max(0, task.index),
          taskTypes,
        });
      });
      const maxTotalPoints = taskPoints.reduce((sum, value) => sum + value, 0);
      return {
        taskPoints,
        maxTotalPoints,
        profileAssignments,
        missingAssignments,
      };
    },
    [
      resolveTaskTypePointsSourceMap,
      selectedExamProfileAssignmentMap,
      selectedExamProfileAssignments,
    ],
  );

  const previewTaskPlan = useMemo(
    () => resolveSessionTaskPointsPlan(previewExamParse.tasks),
    [previewExamParse.tasks, resolveSessionTaskPointsPlan],
  );
  const plannedTaskCount = previewTaskPlan.taskPoints.length;
  const plannedMaxPoints = previewTaskPlan.maxTotalPoints;
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

  const activeTask = runTasks[activeTaskIndex] ?? null;
  const activeTaskMaxPoints = runTaskPoints[activeTaskIndex] ?? 0;

  const remainingPoints = 0;
  const missingExamSettings = useMemo(() => {
    const missing: MissingExamSetting[] = [];
    if (settings.examTimeLimitEnabled && previewDurationMinutes <= 0) {
      missing.push({
        id: "exam.duration",
        label: "Time limit ist aktiv, aber Profil-Dauer fehlt",
        description: "Setze im Points-Profil eine Dauer groesser als 0 Minuten.",
        severity: "blocker",
      });
    }
    selectedExamProfileAssignments.forEach((assignment) => {
      if (assignment.missing) {
        missing.push({
          id: `exam.points.profile.missing.${assignment.examPath}`,
          label: `Points-Profil fehlt (${assignment.sourceTitle})`,
          description: assignment.requestedName
            ? `Task "${assignment.requestedName}" verweist auf kein vorhandenes Profil.`
            : "Task verweist auf kein vorhandenes Profil.",
          severity: "blocker",
        });
        return;
      }
      if (!assignment.profile) {
        return;
      }
      if (taskOrderProfileFallbackByExamPath.get(assignment.examPath)) {
        return;
      }
      const blockers = validatePointsProfile(assignment.profile);
      blockers.forEach((item) => {
        missing.push({
          ...item,
          id: `${item.id}.${assignment.examPath}`,
          label: `${item.label} (${assignment.sourceTitle})`,
        });
      });
    });
    return missing;
  }, [
    previewDurationMinutes,
    selectedExamProfileAssignments,
    taskOrderProfileFallbackByExamPath,
    settings.examTimeLimitEnabled,
  ]);
  const hasSettingsBlockers = missingExamSettings.some(
    (item) => item.severity !== "warning",
  );
  const isSettingsValid = !hasSettingsBlockers;

  const canStartExam =
    selectedExamCount > 0 &&
    selectedExamParseState === "idle" &&
    !pointsProfiles.loading &&
    previewExamParse.tasks.length > 0 &&
    isSettingsValid;
  const examRunning = stage !== "idle";

  const resetExamState = useCallback(() => {
    setStage("idle");
    setActiveTaskIndex(0);
    setActiveExamTasks([]);
    setActiveExamFiles([]);
    setActiveMixSeed(null);
    setActiveSettings(null);
    setPartStates({});
    setAwardedPoints({});
    setAutoGradeDecisions({});
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
    (file: VaultFile) => {
      actions.handleToggleExamFileSelection(file);
      setSessionInvalidationMessage("");
    },
    [actions],
  );

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

  const handleReshuffleMix = useCallback(() => {
    if (selectedExamCount < 2) {
      return;
    }
    setMixSeed(createMixSeed());
    if (stage !== "idle") {
      resetExamState();
      setSessionInvalidationMessage("Session muss neu gestartet werden.");
      return;
    }
    setSessionInvalidationMessage("");
  }, [resetExamState, selectedExamCount, stage]);

  const handleStartExam = useCallback(() => {
    if (!canStartExam) {
      return;
    }
    const hasAllParses = selectedExamSources.length === selectedExamCount;
    if (!hasAllParses || selectedExamCount === 0) {
      return;
    }
    const sessionSeed = createMixSeed();
    let sessionTasks: ExamSessionTask[] = [];
    if (selectedExamCount >= 2) {
      sessionTasks = buildMixedSessionTasks(selectedExamSources, sessionSeed).tasks;
    } else {
      const primarySource = selectedExamSources[0];
      if (!primarySource) {
        return;
      }
      sessionTasks = buildSingleSessionTasks(primarySource, sessionSeed);
    }
    if (sessionTasks.length === 0) {
      return;
    }
    const sessionTaskPlan = resolveSessionTaskPointsPlan(sessionTasks);
    if (sessionTaskPlan.missingAssignments.length > 0) {
      return;
    }
    const snapshot: ExamSettingsSnapshot = {
      maxTotalPoints: sessionTaskPlan.maxTotalPoints,
      taskCount: sessionTaskPlan.taskPoints.length,
      taskPoints: sessionTaskPlan.taskPoints,
      durationMinutes: previewDurationMinutes,
      timeLimitEnabled: settings.examTimeLimitEnabled,
      aiEvaluation: settings.examAiEvaluation,
      pointsProfileAssignments: sessionTaskPlan.profileAssignments,
    };
    // TODO: Wire snapshot.aiEvaluation into grading once AI evaluation is implemented.
    examStartTimeRef.current = Date.now();
    examRunRecordedRef.current = false;
    setSessionInvalidationMessage("");
    setMixSeed(sessionSeed);
    setActiveMixSeed(selectedExamCount >= 2 ? sessionSeed : null);
    setActiveExamTasks(sessionTasks);
    setActiveExamFiles(selectedExamFiles);
    setActiveSettings(snapshot);
    setStage("running");
    setActiveTaskIndex(0);
    setPartStates({});
    setAwardedPoints({});
    setAutoGradeDecisions({});
    setResultTaskCardWrapPendingById({});
    setResultTaskCardWrapErrorById({});
    setResultTaskCardWrapNoticeById({});
    setExamTimeUp(false);
    if (examTimerEnabled) {
      setExamTimeRemainingMs(examTimeLimitMs);
      examTimerEndRef.current = Date.now() + examTimeLimitMs;
    } else {
      setExamTimeRemainingMs(null);
      examTimerEndRef.current = null;
    }
  }, [
    canStartExam,
    selectedExamCount,
    selectedExamFiles,
    selectedExamSources,
    settings.examAiEvaluation,
    settings.examTimeLimitEnabled,
    previewDurationMinutes,
    examTimeLimitMs,
    examTimerEnabled,
    resolveSessionTaskPointsPlan,
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
      let success = true;

      if (userVault.activeProfilePath) {
        success = await deleteExamRunStoreEntry(userVault.activeProfilePath, runId);
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
    setStage("scoring");
  }, [stage]);

  const handleFinishScoring = useCallback(() => {
    if (stage !== "scoring") {
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
      const taskPartStates = partStates[index] ?? [];
      if (isAutoGradedTask(task)) {
        const isCorrect = isTaskCorrect(task, taskPartStates);
        const overrideDecision = autoGradeDecisions[index];
        const decidedCorrect = overrideDecision ?? isCorrect;
        const taskTypePointsSource = resolveTaskTypePointsSourceMap(task);
        const autoAwarded = (() => {
          if (typeof overrideDecision === "boolean") {
            return overrideDecision ? maxPoints : 0;
          }
          if (!taskTypePointsSource) {
            return isCorrect ? maxPoints : 0;
          }
          const summed = task.card.parts.reduce((sum, part, partIndex) => {
            const result = evaluateFlashcardPartResult(part, taskPartStates[partIndex] ?? {});
            if (result !== "correct") {
              return sum;
            }
            const type = resolveFlashcardPartAutoCardType(part);
            if (!type) {
              return sum;
            }
            return sum + Math.max(0, Math.floor(taskTypePointsSource[type] ?? 0));
          }, 0);
          return clampNumber(summed, 0, maxPoints);
        })();
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
            partStates: taskPartStates,
            awardedPoints: autoAwarded,
            autoGradeDecision: overrideDecision,
          },
        };
      }
      const awarded = normalizeAwardedPoints(awardedPoints[index] ?? null, maxPoints);
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
          partStates: taskPartStates,
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
  }, [
    activeExamSettings,
    autoGradeDecisions,
    awardedPoints,
    partStates,
    resolveTaskTypePointsSourceMap,
    runTaskPoints,
    runTasks,
    stage,
  ]);

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
    const examFilePath =
      activeExamFiles.length === 1
        ? firstExamFile.relative_path || firstExamFile.path
        : `Mixed (${activeExamFiles.length}): ${activeExamFiles
            .map((file) => file.relative_path || file.path)
            .join(", ")}`;
    const profileAssignments = activeExamSettings?.pointsProfileAssignments ?? [];
    const resolvedAssignments = profileAssignments.filter(
      (assignment) => !assignment.missing && assignment.profileId,
    );
    const uniqueProfileKeys = new Set(
      resolvedAssignments.map((assignment) =>
        [assignment.profileId, assignment.profileName].join("|"),
      ),
    );
    const singleResolvedProfile =
      uniqueProfileKeys.size === 1 ? resolvedAssignments[0] ?? null : null;

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
      grade: null,
      gradeScaleId: settings.examGradeScale,
      pointsProfileId: singleResolvedProfile?.profileId ?? null,
      pointsProfileName: singleResolvedProfile?.profileName ?? null,
      pointsProfileVersion: singleResolvedProfile?.profileVersion ?? null,
      pointsProfileAssignments: profileAssignments,
    };

    if (userVault.activeProfilePath) {
      void appendExamRunStore(userVault.activeProfilePath, run);
    }
    setExamRuns((prev) => sortExamRunsByDateDesc([run, ...prev]));
    if (activeExamFiles.length === 1) {
      const singleExamFile = activeExamFiles[0];
      if (!singleExamFile) {
        examRunRecordedRef.current = true;
        return;
      }
      const scoreValue = `${results.totalAwarded}/${results.totalMax}`;
      const percentValue = `${percent}%`;
      const statusValue = resolveExamStatusDescriptor(percent).token;
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
      const range = task.sourceRange;
      if (
        !range ||
        !Number.isFinite(range.startLine) ||
        !Number.isFinite(range.endLine) ||
        range.startLine < 0 ||
        range.endLine < range.startLine
      ) {
        return "Task source range is unavailable.";
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

      const sourcePath = targetTask.sourceExamPath;
      const sourceRange = targetTask.sourceRange;

      setResultTaskCardWrapPendingById((prev) => ({ ...prev, [sessionTaskId]: true }));
      setResultTaskCardWrapErrorById((prev) => ({ ...prev, [sessionTaskId]: "" }));
      setResultTaskCardWrapNoticeById((prev) => ({ ...prev, [sessionTaskId]: "" }));

      const applyToggle = async () => {
        try {
          const contents = await invoke<string>("read_text_file", {
            path: sourcePath,
          });
          let lines = contents.replace(/\r\n?/g, "\n").split("\n");

          if (!nextWrapped && !findExamTaskWrapper(lines, sourceRange)) {
            throw new Error(
              "Could not identify an exact #card/#endcard wrapper for this task.",
            );
          }

          const mutation = nextWrapped
            ? wrapExamTask(lines, sourceRange)
            : unwrapExamTask(lines, sourceRange);
          lines = mutation.lines;
          const nextContents = lines.join("\n");
          const wroteFile = mutation.changed;

          if (wroteFile) {
            await invoke("write_text_file_atomic", {
              path: sourcePath,
              contents: nextContents,
            });
            if (preview.selectedFile?.path === sourcePath) {
              preview.setPreview(nextContents);
            }
          }

          const reparsed = parseExamTasks(nextContents);
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
                sessionIndex: task.sessionIndex,
              };
            });
            return changed ? next : prev;
          });

          const rescanOk = await actions.handleRescanVault("exam-results-card-toggle");
          if (!rescanOk) {
            setResultTaskCardWrapNoticeById((prev) => ({
              ...prev,
              [sessionTaskId]:
                wroteFile
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

  const activeTaskPartStates =
    activeTask ? partStates[activeTaskIndex] ?? [] : [];
  const activeTaskAwardedPoints =
    activeTask ? awardedPoints[activeTaskIndex] ?? null : null;
  const activeTaskAutoDecision =
    activeTask ? autoGradeDecisions[activeTaskIndex] : undefined;
  const selectionPreviewState: LoadState =
    selectedExamCount === 0 ? "idle" : selectedExamParseState;
  const selectionPreviewError = selectedExamParseError;
  const examEmptyState = useMemo(() => {
    if (selectedExamCount === 0 || selectionPreviewState !== "idle") {
      return null;
    }
    if (selectionPreviewError) {
      return {
        title: "Dateien konnten nicht geladen werden",
        message: selectionPreviewError,
      };
    }
    if (!previewExamParse.hasExamBlock) {
      return {
        title: "No exam block",
        message: "This file does not include a #exam ... #endexam wrapper.",
      };
    }
    if (previewExamParse.tasks.length === 0) {
      return {
        title: "No tasks found",
        message:
          selectedExamCount >= 2
            ? "Fuer den aktuellen Mix wurden keine passenden Aufgaben gefunden."
            : "Add Punktaufgaben inside the exam block to start an exam.",
      };
    }
    return null;
  }, [
    previewExamParse.hasExamBlock,
    previewExamParse.tasks.length,
    selectedExamCount,
    selectionPreviewError,
    selectionPreviewState,
  ]);
  const sessionExamFiles = stage === "idle" ? selectedExamFiles : activeExamFiles;
  const mixSessionEnabled = sessionExamFiles.length >= 2;
  const mixSessionSeed =
    stage === "idle"
      ? selectedExamCount >= 2
        ? mixSeed
        : null
      : activeMixSeed;
  const canReshuffleMix =
    selectedExamCount >= 2 && stage === "idle" && selectedExamParseState === "idle";

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
    selectedExamPaths,
    selectedExamCount,
    selectedExamParseState: selectionPreviewState,
    selectedExamParseError: selectionPreviewError,
    sessionInvalidationMessage,
    previewExamParse,
    mixModeEnabled,
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
    handleStartExam,
    handleReshuffleMix,
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
    handleResultTaskCardWrapperToggle,
    getTaskCardWrapDisabledReason,
  };
};
