/**
 * @file apps/fmd-desktop/src/features/settings/useAppSettings.ts
 *
 * Zweck:
 * - Stellt den Hook useAppSettings fuer Settings bereit.
 *
 * Verantwortlichkeiten:
 * - Verwaltet State und Ableitungen fuer Settings.
 * - Stellt Aktionen und Handler fuer die UI bereit.
 * - Bietet konsolidierte Daten fuer Komponenten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/color.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/lib/theme.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/features/flashcards/useFlashcards.ts: Feature-Logik oder Hook.
 *
 * Exportiert:
 * - DEFAULT_THEME: Zentrale Export-API.
 * - DEFAULT_LANGUAGE: Zentrale Export-API.
 *
 * Hinweise:
 * - Hook darf nur innerhalb von React-Komponenten genutzt werden.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_ACCENT, isValidHex, normalizeHex } from "../../lib/color";
import { applyAccentColor, applyTheme, type ThemeMode } from "../../lib/theme";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  normalizeKeyboardShortcuts,
  type KeyboardShortcutSettings,
} from "../../lib/shortcuts/bindings";
import {
  DEFAULT_FLASHCARD_PAGE_SIZE,
  FLASHCARD_PAGE_SIZES,
  type FlashcardMode,
  type FlashcardOrder,
  type FlashcardPageSize,
  type FlashcardScope,
  type StatsResetMode,
} from "../flashcards/useFlashcards";
import {
  FAST_FLASHCARD_DURATIONS,
  type FastFlashcardDuration,
} from "../fast-flashcard/constants";
import {
  DEFAULT_SPACED_REPETITION_PAGE_SIZE,
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
  type SpacedRepetitionBoxes,
  type SpacedRepetitionOrder,
  type SpacedRepetitionPageSize,
  type SpacedRepetitionRepetitionStrength,
} from "../spaced-repetition/useSpacedRepetition";

type AppLanguage = "de" | "en";
type EditorGridIntensity = "light" | "medium" | "strong";
type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";
type ExamAiProvider = "shared-gpt";
type ExamGradeScale = "standard-1-6";

export type ExamAiEvaluation = {
  enabled: boolean;
  provider: ExamAiProvider | null;
};

type AppSettings = {
  active_note_path?: string | null;
  vault_path?: string | null;
  theme?: string | null;
  accent_color?: string | null;
  editor_exact_colors?: boolean | null;
  editor_blueprint_grid?: boolean | null;
  editor_blueprint_grid_intensity?: string | null;
  language?: AppLanguage | null;
  max_files_per_scan?: string | null;
  scan_parallelism?: string | null;
  show_hidden_folders?: boolean | null;
  hidden_folders_level?: number | null;
  hidden_folders_level_vault?: number | null;
  hidden_folders_level_index?: number | null;
  flashcard_order?: string | null;
  flashcard_mode?: string | null;
  flashcard_scope?: string | null;
  flashcard_page_size?: number | null;
  flashcard_solution_reveal_enabled?: boolean | null;
  flashcard_stats_reset_mode?: string | null;
  flashcard_help_enabled?: boolean | null;
  fast_flashcard_order?: string | null;
  fast_flashcard_mode?: string | null;
  fast_flashcard_scope?: string | null;
  fast_flashcard_duration?: number | null;
  fast_flashcard_help_enabled?: boolean | null;
  exam_show_timeline?: boolean | null;
  exam_help_enabled?: boolean | null;
  spaced_repetition_boxes?: number | null;
  spaced_repetition_order?: string | null;
  spaced_repetition_page_size?: number | null;
  spaced_repetition_repetition_strength?: string | null;
  spaced_repetition_stats_view?: string | null;
  spaced_repetition_help_enabled?: boolean | null;
  right_toolbar_collapsed?: boolean | null;
  exam_max_total_points?: number | null;
  exam_task_count?: number | null;
  exam_task_points?: number[] | null;
  exam_duration_minutes?: number | null;
  exam_time_limit_enabled?: boolean | null;
  exam_auto_cards_enabled?: boolean | null;
  exam_auto_cards_return_on_correct?: boolean | null;
  exam_grade_scale?: string | null;
  exam_ai_evaluation?: ExamAiEvaluation | null;
  keyboard_shortcuts?: KeyboardShortcutSettings | null;
};

type PersistUpdates = {
  activeNotePath?: string | null;
  vaultPath?: string | null;
  theme?: ThemeMode;
  accentColor?: string;
  editorExactColors?: boolean;
  editorBlueprintGrid?: boolean;
  editorBlueprintGridIntensity?: EditorGridIntensity;
  language?: AppLanguage;
  maxFilesPerScan?: string;
  scanParallelism?: "low" | "medium" | "high";
  showHiddenFolders?: boolean;
  flashcardOrder?: FlashcardOrder;
  flashcardMode?: FlashcardMode;
  flashcardScope?: FlashcardScope;
  flashcardPageSize?: FlashcardPageSize;
  solutionRevealEnabled?: boolean;
  statsResetMode?: StatsResetMode;
  flashcardHelpEnabled?: boolean;
  fastFlashcardOrder?: FlashcardOrder;
  fastFlashcardMode?: FlashcardMode;
  fastFlashcardScope?: FlashcardScope;
  fastFlashcardDuration?: number;
  fastFlashcardHelpEnabled?: boolean;
  examShowTimeline?: boolean;
  examHelpEnabled?: boolean;
  spacedRepetitionBoxes?: SpacedRepetitionBoxes;
  spacedRepetitionOrder?: SpacedRepetitionOrder;
  spacedRepetitionPageSize?: SpacedRepetitionPageSize;
  spacedRepetitionRepetitionStrength?: SpacedRepetitionRepetitionStrength;
  spacedRepetitionStatsView?: SpacedRepetitionStatsView;
  spacedRepetitionHelpEnabled?: boolean;
  rightToolbarCollapsed?: boolean;
  examMaxTotalPoints?: number;
  examTaskCount?: number;
  examTaskPoints?: number[];
  examDurationMinutes?: number;
  examTimeLimitEnabled?: boolean;
  examAutoCardsEnabled?: boolean;
  examAutoCardsReturnOnCorrect?: boolean;
  examGradeScale?: ExamGradeScale;
  examAiEvaluation?: ExamAiEvaluation;
  keyboardShortcuts?: KeyboardShortcutSettings;
};

export const DEFAULT_THEME: ThemeMode = "light";
export const DEFAULT_LANGUAGE: AppLanguage = "de";
const DEFAULT_EDITOR_EXACT_COLORS = true;
const DEFAULT_EDITOR_BLUEPRINT_GRID = false;
const DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY: EditorGridIntensity = "medium";
const DEFAULT_MAX_FILES_PER_SCAN = "50";
const DEFAULT_SCAN_PARALLELISM: "low" | "medium" | "high" = "medium";
const DEFAULT_SHOW_HIDDEN_FOLDERS = false;
const DEFAULT_FLASHCARD_ORDER: FlashcardOrder = "in-order";
const DEFAULT_FLASHCARD_MODE: FlashcardMode = "all";
const DEFAULT_FLASHCARD_SCOPE: FlashcardScope = "current";
const DEFAULT_STATS_RESET_MODE: StatsResetMode = "scan";
const DEFAULT_FLASHCARD_HELP_ENABLED = true;
const DEFAULT_FAST_FLASHCARD_ORDER: FlashcardOrder = DEFAULT_FLASHCARD_ORDER;
const DEFAULT_FAST_FLASHCARD_MODE: FlashcardMode = DEFAULT_FLASHCARD_MODE;
const DEFAULT_FAST_FLASHCARD_SCOPE: FlashcardScope = DEFAULT_FLASHCARD_SCOPE;
const DEFAULT_FAST_FLASHCARD_DURATION = 6;
const DEFAULT_FAST_FLASHCARD_HELP_ENABLED = true;
const DEFAULT_EXAM_SHOW_TIMELINE = true;
const DEFAULT_EXAM_HELP_ENABLED = true;
const DEFAULT_SPACED_REPETITION_BOXES: SpacedRepetitionBoxes = 5;
const DEFAULT_SPACED_REPETITION_ORDER: SpacedRepetitionOrder = "in-order";
const DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH: SpacedRepetitionRepetitionStrength =
  "medium";
const DEFAULT_SPACED_REPETITION_STATS_VIEW: SpacedRepetitionStatsView = "boxes";
const DEFAULT_SPACED_REPETITION_HELP_ENABLED = true;
const DEFAULT_RIGHT_TOOLBAR_COLLAPSED = false;
const MAX_EXAM_TASK_COUNT = 20;
const DEFAULT_EXAM_MAX_TOTAL_POINTS = 20;
const DEFAULT_EXAM_TASK_COUNT = 5;
const DEFAULT_EXAM_DURATION_MINUTES = 30;
const DEFAULT_EXAM_TIME_LIMIT_ENABLED = true;
const DEFAULT_EXAM_AUTO_CARDS_ENABLED = false;
const DEFAULT_EXAM_AUTO_CARDS_RETURN_ON_CORRECT = false;
const DEFAULT_EXAM_AI_EVALUATION: ExamAiEvaluation = {
  enabled: false,
  provider: null,
};
const DEFAULT_EXAM_GRADE_SCALE: ExamGradeScale = "standard-1-6";

const parseInteger = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const resolveLegacyHiddenFoldersLevel = (settings: AppSettings) => {
  const candidates = [
    settings.hidden_folders_level,
    settings.hidden_folders_level_vault,
    settings.hidden_folders_level_index,
  ];
  for (const candidate of candidates) {
    const parsed = parseInteger(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const clampExamTaskCount = (value: unknown) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    return DEFAULT_EXAM_TASK_COUNT;
  }
  return Math.min(MAX_EXAM_TASK_COUNT, Math.max(1, parsed));
};

const clampExamTotalPoints = (value: unknown) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    return DEFAULT_EXAM_MAX_TOTAL_POINTS;
  }
  return Math.max(0, parsed);
};

const clampExamTaskPointsValue = (value: unknown) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    return 0;
  }
  return Math.max(0, parsed);
};

const clampExamDurationMinutes = (value: unknown) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    return DEFAULT_EXAM_DURATION_MINUTES;
  }
  return Math.min(240, Math.max(0, parsed));
};

const buildDefaultExamTaskPoints = (taskCount: number, maxTotalPoints: number) => {
  if (taskCount <= 0) {
    return [];
  }
  const even = Math.floor(maxTotalPoints / taskCount);
  const remainder = maxTotalPoints % taskCount;
  return Array.from({ length: taskCount }, (_, index) =>
    even + (index < remainder ? 1 : 0),
  );
};

const normalizeExamTaskPointsAll = (
  value: unknown,
  taskCount: number,
  maxTotalPoints: number,
) => {
  const defaults = buildDefaultExamTaskPoints(taskCount, maxTotalPoints);
  const raw = Array.isArray(value) ? value : [];
  const normalized: number[] = [];
  for (let index = 0; index < MAX_EXAM_TASK_COUNT; index += 1) {
    const candidate = raw[index];
    if (typeof candidate !== "undefined") {
      normalized.push(clampExamTaskPointsValue(candidate));
    } else {
      normalized.push(index < defaults.length ? defaults[index] : 0);
    }
  }
  return normalized;
};

const mergeExamTaskPointsAll = (
  current: unknown,
  updates: unknown,
  taskCount: number,
  maxTotalPoints: number,
) => {
  const normalized = normalizeExamTaskPointsAll(
    current,
    taskCount,
    maxTotalPoints,
  );
  if (!Array.isArray(updates)) {
    return normalized;
  }
  const next = [...normalized];
  const limit = Math.min(updates.length, taskCount);
  for (let index = 0; index < limit; index += 1) {
    next[index] = clampExamTaskPointsValue(updates[index]);
  }
  return next;
};

const normalizeExamAiEvaluation = (value: unknown): ExamAiEvaluation => {
  if (!value || typeof value !== "object") {
    return DEFAULT_EXAM_AI_EVALUATION;
  }
  const candidate = value as { enabled?: unknown; provider?: unknown };
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : false,
    provider: candidate.provider === "shared-gpt" ? "shared-gpt" : null,
  };
};

export const useAppSettings = () => {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [editorExactColors, setEditorExactColors] = useState(
    DEFAULT_EDITOR_EXACT_COLORS,
  );
  const [editorBlueprintGrid, setEditorBlueprintGrid] = useState(
    DEFAULT_EDITOR_BLUEPRINT_GRID,
  );
  const [editorBlueprintGridIntensity, setEditorBlueprintGridIntensity] =
    useState<EditorGridIntensity>(DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [maxFilesPerScan, setMaxFilesPerScan] = useState(
    DEFAULT_MAX_FILES_PER_SCAN,
  );
  const [scanParallelism, setScanParallelism] = useState<
    "low" | "medium" | "high"
  >(DEFAULT_SCAN_PARALLELISM);
  const [showHiddenFolders, setShowHiddenFoldersState] = useState(
    DEFAULT_SHOW_HIDDEN_FOLDERS,
  );
  const [flashcardOrder, setFlashcardOrder] =
    useState<FlashcardOrder>(DEFAULT_FLASHCARD_ORDER);
  const [flashcardMode, setFlashcardMode] =
    useState<FlashcardMode>(DEFAULT_FLASHCARD_MODE);
  const [flashcardScope, setFlashcardScope] =
    useState<FlashcardScope>(DEFAULT_FLASHCARD_SCOPE);
  const [flashcardPageSize, setFlashcardPageSize] =
    useState<FlashcardPageSize>(DEFAULT_FLASHCARD_PAGE_SIZE);
  const [solutionRevealEnabled, setSolutionRevealEnabled] = useState(true);
  const [statsResetMode, setStatsResetMode] =
    useState<StatsResetMode>(DEFAULT_STATS_RESET_MODE);
  const [flashcardHelpEnabled, setFlashcardHelpEnabledState] = useState(
    DEFAULT_FLASHCARD_HELP_ENABLED,
  );
  const [fastFlashcardOrder, setFastFlashcardOrder] =
    useState<FlashcardOrder>(DEFAULT_FAST_FLASHCARD_ORDER);
  const [fastFlashcardMode, setFastFlashcardMode] =
    useState<FlashcardMode>(DEFAULT_FAST_FLASHCARD_MODE);
  const [fastFlashcardScope, setFastFlashcardScope] =
    useState<FlashcardScope>(DEFAULT_FAST_FLASHCARD_SCOPE);
  const [fastFlashcardDuration, setFastFlashcardDuration] = useState(
    DEFAULT_FAST_FLASHCARD_DURATION,
  );
  const [fastFlashcardHelpEnabled, setFastFlashcardHelpEnabledState] = useState(
    DEFAULT_FAST_FLASHCARD_HELP_ENABLED,
  );
  const [examShowTimeline, setExamShowTimelineState] = useState(
    DEFAULT_EXAM_SHOW_TIMELINE,
  );
  const [examHelpEnabled, setExamHelpEnabledState] = useState(
    DEFAULT_EXAM_HELP_ENABLED,
  );
  const [spacedRepetitionBoxes, setSpacedRepetitionBoxes] =
    useState<SpacedRepetitionBoxes>(DEFAULT_SPACED_REPETITION_BOXES);
  const [spacedRepetitionOrder, setSpacedRepetitionOrder] =
    useState<SpacedRepetitionOrder>(DEFAULT_SPACED_REPETITION_ORDER);
  const [spacedRepetitionPageSize, setSpacedRepetitionPageSize] =
    useState<SpacedRepetitionPageSize>(DEFAULT_SPACED_REPETITION_PAGE_SIZE);
  const [
    spacedRepetitionRepetitionStrength,
    setSpacedRepetitionRepetitionStrength,
  ] = useState<SpacedRepetitionRepetitionStrength>(
    DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH,
  );
  const [spacedRepetitionStatsView, setSpacedRepetitionStatsView] =
    useState<SpacedRepetitionStatsView>(DEFAULT_SPACED_REPETITION_STATS_VIEW);
  const [spacedRepetitionHelpEnabled, setSpacedRepetitionHelpEnabledState] =
    useState(DEFAULT_SPACED_REPETITION_HELP_ENABLED);
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(
    DEFAULT_RIGHT_TOOLBAR_COLLAPSED,
  );
  const [examMaxTotalPoints, setExamMaxTotalPointsState] = useState(
    DEFAULT_EXAM_MAX_TOTAL_POINTS,
  );
  const [examTaskCount, setExamTaskCountState] = useState(DEFAULT_EXAM_TASK_COUNT);
  const [examTaskPoints, setExamTaskPointsState] = useState(() =>
    normalizeExamTaskPointsAll(
      [],
      DEFAULT_EXAM_TASK_COUNT,
      DEFAULT_EXAM_MAX_TOTAL_POINTS,
    ),
  );
  const [examDurationMinutes, setExamDurationMinutesState] = useState(
    DEFAULT_EXAM_DURATION_MINUTES,
  );
  const [examTimeLimitEnabled, setExamTimeLimitEnabledState] = useState(
    DEFAULT_EXAM_TIME_LIMIT_ENABLED,
  );
  const [examAutoCardsEnabled, setExamAutoCardsEnabledState] = useState(
    DEFAULT_EXAM_AUTO_CARDS_ENABLED,
  );
  const [examAutoCardsReturnOnCorrect, setExamAutoCardsReturnOnCorrectState] =
    useState(DEFAULT_EXAM_AUTO_CARDS_RETURN_ON_CORRECT);
  const [examGradeScale, setExamGradeScaleState] = useState<ExamGradeScale>(
    DEFAULT_EXAM_GRADE_SCALE,
  );
  const [examAiEvaluation, setExamAiEvaluationState] = useState<ExamAiEvaluation>(
    DEFAULT_EXAM_AI_EVALUATION,
  );
  const [keyboardShortcuts, setKeyboardShortcutsState] =
    useState<KeyboardShortcutSettings>(DEFAULT_KEYBOARD_SHORTCUTS);
  const autoSaveReady = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);
  const needsShowHiddenFoldersMigration = useRef(false);
  const needsKeyboardShortcutsMigration = useRef(false);

  const setExamMaxTotalPoints = useCallback((value: number) => {
    setExamMaxTotalPointsState(clampExamTotalPoints(value));
  }, []);

  const setExamTaskCount = useCallback((value: number) => {
    const nextCount = clampExamTaskCount(value);
    setExamTaskCountState(nextCount);
    setExamTaskPointsState((prev) => {
      return normalizeExamTaskPointsAll(prev, nextCount, examMaxTotalPoints);
    });
  }, [examMaxTotalPoints]);

  const setExamTaskPoints = useCallback(
    (value: number[]) => {
      setExamTaskPointsState((prev) => {
        return mergeExamTaskPointsAll(
          prev,
          value,
          examTaskCount,
          examMaxTotalPoints,
        );
      });
    },
    [examMaxTotalPoints, examTaskCount],
  );

  const setExamDurationMinutes = useCallback((value: number) => {
    setExamDurationMinutesState(clampExamDurationMinutes(value));
  }, []);

  const setExamShowTimeline = useCallback((value: boolean) => {
    setExamShowTimelineState(Boolean(value));
  }, []);

  const setExamTimeLimitEnabled = useCallback((value: boolean) => {
    setExamTimeLimitEnabledState(Boolean(value));
  }, []);

  const setExamAutoCardsEnabled = useCallback((value: boolean) => {
    setExamAutoCardsEnabledState(Boolean(value));
  }, []);

  const setExamAutoCardsReturnOnCorrect = useCallback((value: boolean) => {
    setExamAutoCardsReturnOnCorrectState(Boolean(value));
  }, []);

  const setExamAiEvaluation = useCallback((value: ExamAiEvaluation) => {
    setExamAiEvaluationState({
      enabled: Boolean(value?.enabled),
      provider: value?.provider === "shared-gpt" ? "shared-gpt" : null,
    });
  }, []);

  const setExamGradeScale = useCallback((value: ExamGradeScale) => {
    setExamGradeScaleState(value);
  }, []);

  const setKeyboardShortcuts = useCallback((value: KeyboardShortcutSettings) => {
    const { settings } = normalizeKeyboardShortcuts(value);
    setKeyboardShortcutsState(settings);
  }, []);

  const setKeyboardShortcutBinding = useCallback(
    (commandId: string, binding: string | null) => {
      setKeyboardShortcutsState((prev) => ({
        ...prev,
        bindings: { ...prev.bindings, [commandId]: binding },
      }));
    },
    [],
  );

  const resetKeyboardShortcuts = useCallback(() => {
    setKeyboardShortcutsState(DEFAULT_KEYBOARD_SHORTCUTS);
  }, []);

  const setShowHiddenFolders = useCallback((value: boolean) => {
    setShowHiddenFoldersState(Boolean(value));
  }, []);

  const setFlashcardHelpEnabled = useCallback((value: boolean) => {
    setFlashcardHelpEnabledState(Boolean(value));
  }, []);

  const setFastFlashcardHelpEnabled = useCallback((value: boolean) => {
    setFastFlashcardHelpEnabledState(Boolean(value));
  }, []);

  const setExamHelpEnabled = useCallback((value: boolean) => {
    setExamHelpEnabledState(Boolean(value));
  }, []);

  const setSpacedRepetitionHelpEnabled = useCallback((value: boolean) => {
    setSpacedRepetitionHelpEnabledState(Boolean(value));
  }, []);

  const saveSettings = useCallback(
    async (settings: {
      activeNotePath: string | null;
      vaultPath: string | null;
      theme: ThemeMode;
      accentColor: string;
      editorExactColors: boolean;
      editorBlueprintGrid: boolean;
      editorBlueprintGridIntensity: EditorGridIntensity;
      language: AppLanguage;
      maxFilesPerScan: string;
      scanParallelism: "low" | "medium" | "high";
      showHiddenFolders: boolean;
      flashcardOrder: FlashcardOrder;
      flashcardMode: FlashcardMode;
      flashcardScope: FlashcardScope;
      flashcardPageSize: FlashcardPageSize;
      solutionRevealEnabled: boolean;
      statsResetMode: StatsResetMode;
      flashcardHelpEnabled: boolean;
      spacedRepetitionBoxes: SpacedRepetitionBoxes;
      spacedRepetitionOrder: SpacedRepetitionOrder;
      spacedRepetitionPageSize: SpacedRepetitionPageSize;
      spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
      spacedRepetitionStatsView: SpacedRepetitionStatsView;
      spacedRepetitionHelpEnabled: boolean;
      rightToolbarCollapsed: boolean;
      fastFlashcardOrder: FlashcardOrder;
      fastFlashcardMode: FlashcardMode;
      fastFlashcardScope: FlashcardScope;
      fastFlashcardDuration: number;
      fastFlashcardHelpEnabled: boolean;
      examShowTimeline: boolean;
      examHelpEnabled: boolean;
      examMaxTotalPoints: number;
      examTaskCount: number;
      examTaskPoints: number[];
      examDurationMinutes: number;
      examTimeLimitEnabled: boolean;
      examAutoCardsEnabled: boolean;
      examAutoCardsReturnOnCorrect: boolean;
      examGradeScale: ExamGradeScale;
      examAiEvaluation: ExamAiEvaluation;
      keyboardShortcuts: KeyboardShortcutSettings;
    }) => {
      try {
        await invoke("save_app_settings", {
          activeNotePath: settings.activeNotePath,
          vaultPath: settings.vaultPath,
          theme: settings.theme,
          accentColor: settings.accentColor,
          editorExactColors: settings.editorExactColors,
          editorBlueprintGrid: settings.editorBlueprintGrid,
          editorBlueprintGridIntensity: settings.editorBlueprintGridIntensity,
          language: settings.language,
          maxFilesPerScan: settings.maxFilesPerScan,
          scanParallelism: settings.scanParallelism,
          showHiddenFolders: settings.showHiddenFolders,
          flashcardOrder: settings.flashcardOrder,
          flashcardMode: settings.flashcardMode,
          flashcardScope: settings.flashcardScope,
          flashcardPageSize: settings.flashcardPageSize,
          flashcardSolutionRevealEnabled: settings.solutionRevealEnabled,
          flashcardStatsResetMode: settings.statsResetMode,
          flashcardHelpEnabled: settings.flashcardHelpEnabled,
          fastFlashcardOrder: settings.fastFlashcardOrder,
          fastFlashcardMode: settings.fastFlashcardMode,
          fastFlashcardScope: settings.fastFlashcardScope,
          fastFlashcardDuration: settings.fastFlashcardDuration,
          fastFlashcardHelpEnabled: settings.fastFlashcardHelpEnabled,
          examShowTimeline: settings.examShowTimeline,
          examHelpEnabled: settings.examHelpEnabled,
          spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
          spacedRepetitionOrder: settings.spacedRepetitionOrder,
          spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
          spacedRepetitionRepetitionStrength:
            settings.spacedRepetitionRepetitionStrength,
          spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
          spacedRepetitionHelpEnabled: settings.spacedRepetitionHelpEnabled,
          rightToolbarCollapsed: settings.rightToolbarCollapsed,
          examMaxTotalPoints: settings.examMaxTotalPoints,
          examTaskCount: settings.examTaskCount,
          examTaskPoints: settings.examTaskPoints,
          examDurationMinutes: settings.examDurationMinutes,
          examTimeLimitEnabled: settings.examTimeLimitEnabled,
          examAutoCardsEnabled: settings.examAutoCardsEnabled,
          examAutoCardsReturnOnCorrect: settings.examAutoCardsReturnOnCorrect,
          examGradeScale: settings.examGradeScale,
          examAiEvaluation: settings.examAiEvaluation,
          keyboardShortcuts: settings.keyboardShortcuts,
        });
        return true;
      } catch (error) {
        console.error("Failed to save settings", error);
        return false;
      }
    },
    [],
  );

  const persistSettings = useCallback(
    async (updates: PersistUpdates) => {
      if (!settingsLoaded) {
        return false;
      }
      const nextSettings = {
        activeNotePath: updates.activeNotePath ?? activeNotePath,
        vaultPath: updates.vaultPath ?? vaultPath,
        theme: updates.theme ?? theme,
        accentColor: updates.accentColor ?? accentColor,
        editorExactColors: updates.editorExactColors ?? editorExactColors,
        editorBlueprintGrid: updates.editorBlueprintGrid ?? editorBlueprintGrid,
        editorBlueprintGridIntensity:
          updates.editorBlueprintGridIntensity ?? editorBlueprintGridIntensity,
        language: updates.language ?? language,
        maxFilesPerScan: updates.maxFilesPerScan ?? maxFilesPerScan,
        scanParallelism: updates.scanParallelism ?? scanParallelism,
        showHiddenFolders: updates.showHiddenFolders ?? showHiddenFolders,
        flashcardOrder: updates.flashcardOrder ?? flashcardOrder,
        flashcardMode: updates.flashcardMode ?? flashcardMode,
        flashcardScope: updates.flashcardScope ?? flashcardScope,
        fastFlashcardOrder: updates.fastFlashcardOrder ?? fastFlashcardOrder,
        fastFlashcardMode: updates.fastFlashcardMode ?? fastFlashcardMode,
        fastFlashcardScope: updates.fastFlashcardScope ?? fastFlashcardScope,
        fastFlashcardDuration:
          updates.fastFlashcardDuration ?? fastFlashcardDuration,
        fastFlashcardHelpEnabled:
          updates.fastFlashcardHelpEnabled ?? fastFlashcardHelpEnabled,
        examShowTimeline:
          updates.examShowTimeline ?? examShowTimeline,
        flashcardPageSize: updates.flashcardPageSize ?? flashcardPageSize,
        solutionRevealEnabled:
          updates.solutionRevealEnabled ?? solutionRevealEnabled,
        statsResetMode: updates.statsResetMode ?? statsResetMode,
        flashcardHelpEnabled:
          updates.flashcardHelpEnabled ?? flashcardHelpEnabled,
        spacedRepetitionBoxes:
          updates.spacedRepetitionBoxes ?? spacedRepetitionBoxes,
        spacedRepetitionOrder:
          updates.spacedRepetitionOrder ?? spacedRepetitionOrder,
        spacedRepetitionPageSize:
          updates.spacedRepetitionPageSize ?? spacedRepetitionPageSize,
        spacedRepetitionRepetitionStrength:
          updates.spacedRepetitionRepetitionStrength ??
          spacedRepetitionRepetitionStrength,
        spacedRepetitionStatsView:
          updates.spacedRepetitionStatsView ?? spacedRepetitionStatsView,
        spacedRepetitionHelpEnabled:
          updates.spacedRepetitionHelpEnabled ?? spacedRepetitionHelpEnabled,
        rightToolbarCollapsed:
          updates.rightToolbarCollapsed ?? rightToolbarCollapsed,
        examMaxTotalPoints: updates.examMaxTotalPoints ?? examMaxTotalPoints,
        examTaskCount: updates.examTaskCount ?? examTaskCount,
        examTaskPoints: mergeExamTaskPointsAll(
          examTaskPoints,
          updates.examTaskPoints,
          updates.examTaskCount ?? examTaskCount,
          updates.examMaxTotalPoints ?? examMaxTotalPoints,
        ),
        examDurationMinutes:
          updates.examDurationMinutes ?? examDurationMinutes,
        examTimeLimitEnabled:
          updates.examTimeLimitEnabled ?? examTimeLimitEnabled,
        examHelpEnabled: updates.examHelpEnabled ?? examHelpEnabled,
        examAutoCardsEnabled:
          updates.examAutoCardsEnabled ?? examAutoCardsEnabled,
        examAutoCardsReturnOnCorrect:
          updates.examAutoCardsReturnOnCorrect ?? examAutoCardsReturnOnCorrect,
        examGradeScale:
          updates.examGradeScale ?? examGradeScale,
        examAiEvaluation: updates.examAiEvaluation ?? examAiEvaluation,
        keyboardShortcuts: updates.keyboardShortcuts ?? keyboardShortcuts,
      };
      const saved = await saveSettings(nextSettings);
      if (saved && "activeNotePath" in updates) {
        setActiveNotePath(nextSettings.activeNotePath ?? null);
      }
      if (saved && "vaultPath" in updates) {
        setVaultPath(nextSettings.vaultPath ?? null);
      }
      return saved;
    },
    [
      activeNotePath,
      accentColor,
      editorExactColors,
      editorBlueprintGrid,
      editorBlueprintGridIntensity,
      examAiEvaluation,
      examGradeScale,
      examMaxTotalPoints,
      examTaskCount,
      examTaskPoints,
      examDurationMinutes,
      examTimeLimitEnabled,
      examAutoCardsEnabled,
      examAutoCardsReturnOnCorrect,
      keyboardShortcuts,
      flashcardMode,
      flashcardOrder,
      fastFlashcardMode,
      fastFlashcardOrder,
      fastFlashcardScope,
      fastFlashcardDuration,
      fastFlashcardHelpEnabled,
      flashcardPageSize,
      flashcardScope,
      flashcardHelpEnabled,
      language,
      maxFilesPerScan,
      saveSettings,
      scanParallelism,
      showHiddenFolders,
      settingsLoaded,
      solutionRevealEnabled,
      examHelpEnabled,
      spacedRepetitionBoxes,
      spacedRepetitionHelpEnabled,
      spacedRepetitionOrder,
      spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView,
      statsResetMode,
      theme,
      vaultPath,
      rightToolbarCollapsed,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("load_app_settings");
        if (cancelled) {
          return;
        }

        const storedTheme = settings.theme === "dark" ? "dark" : DEFAULT_THEME;
        const storedAccentRaw = settings.accent_color ?? DEFAULT_ACCENT;
        const storedAccent = normalizeHex(storedAccentRaw);
        const resolvedAccent = isValidHex(storedAccent)
          ? storedAccent
          : DEFAULT_ACCENT;
        const storedEditorExactColors =
          typeof settings.editor_exact_colors === "boolean"
            ? settings.editor_exact_colors
            : DEFAULT_EDITOR_EXACT_COLORS;
        const storedEditorBlueprintGrid =
          typeof settings.editor_blueprint_grid === "boolean"
            ? settings.editor_blueprint_grid
            : DEFAULT_EDITOR_BLUEPRINT_GRID;
        const storedEditorBlueprintGridIntensity =
          settings.editor_blueprint_grid_intensity === "light" ||
          settings.editor_blueprint_grid_intensity === "strong" ||
          settings.editor_blueprint_grid_intensity === "medium"
            ? settings.editor_blueprint_grid_intensity
            : DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY;
        const storedLanguage =
          settings.language === "en" ? "en" : DEFAULT_LANGUAGE;
        const maxFilesRaw = settings.max_files_per_scan;
        const maxFilesValue =
          typeof maxFilesRaw === "number"
            ? String(maxFilesRaw)
            : typeof maxFilesRaw === "string"
              ? maxFilesRaw.trim()
              : DEFAULT_MAX_FILES_PER_SCAN;
        const storedMaxFilesPerScan =
          maxFilesValue === ""
            ? ""
            : /^[0-9]+$/.test(maxFilesValue)
              ? maxFilesValue
              : DEFAULT_MAX_FILES_PER_SCAN;
        const storedScanParallelism =
          settings.scan_parallelism === "low" ||
          settings.scan_parallelism === "high" ||
          settings.scan_parallelism === "medium"
            ? settings.scan_parallelism
            : DEFAULT_SCAN_PARALLELISM;
        const legacyHiddenFoldersLevel = resolveLegacyHiddenFoldersLevel(settings);
        const shouldMigrateShowHiddenFolders =
          typeof settings.show_hidden_folders !== "boolean" &&
          legacyHiddenFoldersLevel !== null;
        if (shouldMigrateShowHiddenFolders) {
          needsShowHiddenFoldersMigration.current = true;
        }
        const storedShowHiddenFolders =
          typeof settings.show_hidden_folders === "boolean"
            ? settings.show_hidden_folders
            : legacyHiddenFoldersLevel !== null
              ? legacyHiddenFoldersLevel > 0
              : DEFAULT_SHOW_HIDDEN_FOLDERS;
        const storedFlashcardOrder =
          settings.flashcard_order === "random"
            ? "random"
            : DEFAULT_FLASHCARD_ORDER;
        const storedFlashcardMode =
          settings.flashcard_mode === "all" ||
          settings.flashcard_mode === "qa" ||
          settings.flashcard_mode === "multiple-choice" ||
          settings.flashcard_mode === "mix" ||
          settings.flashcard_mode === "fill-blank" ||
          settings.flashcard_mode === "assignment" ||
          settings.flashcard_mode === "true-false"
            ? settings.flashcard_mode
            : settings.flashcard_mode === "yes-no"
              ? "true-false"
              : DEFAULT_FLASHCARD_MODE;
        const storedFlashcardScope =
          settings.flashcard_scope === "vault"
            ? "vault"
            : DEFAULT_FLASHCARD_SCOPE;
        const storedFastFlashcardOrder =
          settings.fast_flashcard_order === "random"
            ? "random"
            : DEFAULT_FAST_FLASHCARD_ORDER;
        const storedFastFlashcardMode =
          settings.fast_flashcard_mode === "all" ||
          settings.fast_flashcard_mode === "qa" ||
          settings.fast_flashcard_mode === "multiple-choice" ||
          settings.fast_flashcard_mode === "mix" ||
          settings.fast_flashcard_mode === "fill-blank" ||
          settings.fast_flashcard_mode === "assignment" ||
          settings.fast_flashcard_mode === "true-false"
            ? settings.fast_flashcard_mode
            : settings.fast_flashcard_mode === "yes-no"
              ? "true-false"
              : DEFAULT_FAST_FLASHCARD_MODE;
        const storedFastFlashcardScope =
          settings.fast_flashcard_scope === "vault"
            ? "vault"
            : DEFAULT_FAST_FLASHCARD_SCOPE;
        const storedFastFlashcardDurationRaw = settings.fast_flashcard_duration;
        const storedFastFlashcardDurationValue =
          typeof storedFastFlashcardDurationRaw === "number"
            ? storedFastFlashcardDurationRaw
            : typeof storedFastFlashcardDurationRaw === "string"
              ? Number.parseInt(storedFastFlashcardDurationRaw, 10)
              : DEFAULT_FAST_FLASHCARD_DURATION;
        const storedFastFlashcardDuration =
          FAST_FLASHCARD_DURATIONS.includes(
            storedFastFlashcardDurationValue as FastFlashcardDuration,
          )
            ? (storedFastFlashcardDurationValue as FastFlashcardDuration)
            : DEFAULT_FAST_FLASHCARD_DURATION;
        const storedFastFlashcardHelpEnabled =
          typeof settings.fast_flashcard_help_enabled === "boolean"
            ? settings.fast_flashcard_help_enabled
            : DEFAULT_FAST_FLASHCARD_HELP_ENABLED;
        const storedExamShowTimeline =
          typeof settings.exam_show_timeline === "boolean"
            ? settings.exam_show_timeline
            : DEFAULT_EXAM_SHOW_TIMELINE;
        const storedExamHelpEnabled =
          typeof settings.exam_help_enabled === "boolean"
            ? settings.exam_help_enabled
            : DEFAULT_EXAM_HELP_ENABLED;
        const storedFlashcardPageSizeRaw = settings.flashcard_page_size;
        const migratedFlashcardPageSize =
          storedFlashcardPageSizeRaw === 10
            ? 5
            : storedFlashcardPageSizeRaw;
        const storedFlashcardPageSize =
          typeof migratedFlashcardPageSize === "number" &&
          FLASHCARD_PAGE_SIZES.includes(
            migratedFlashcardPageSize as FlashcardPageSize,
          )
            ? (migratedFlashcardPageSize as FlashcardPageSize)
            : DEFAULT_FLASHCARD_PAGE_SIZE;
        const storedSolutionRevealEnabled =
          typeof settings.flashcard_solution_reveal_enabled === "boolean"
            ? settings.flashcard_solution_reveal_enabled
            : true;
        const storedStatsResetMode =
          settings.flashcard_stats_reset_mode === "session"
            ? "session"
            : DEFAULT_STATS_RESET_MODE;
        const storedFlashcardHelpEnabled =
          typeof settings.flashcard_help_enabled === "boolean"
            ? settings.flashcard_help_enabled
            : DEFAULT_FLASHCARD_HELP_ENABLED;
        const storedSpacedRepetitionBoxes =
          typeof settings.spaced_repetition_boxes === "number" &&
          SPACED_REPETITION_BOXES.includes(
            settings.spaced_repetition_boxes as SpacedRepetitionBoxes,
          )
            ? (settings.spaced_repetition_boxes as SpacedRepetitionBoxes)
            : DEFAULT_SPACED_REPETITION_BOXES;
        const storedSpacedRepetitionOrder =
          settings.spaced_repetition_order === "random" ||
          settings.spaced_repetition_order === "repetition"
            ? settings.spaced_repetition_order
            : DEFAULT_SPACED_REPETITION_ORDER;
        const storedSpacedRepetitionPageSizeRaw =
          settings.spaced_repetition_page_size;
        const migratedSpacedRepetitionPageSize =
          storedSpacedRepetitionPageSizeRaw === 10
            ? 5
            : storedSpacedRepetitionPageSizeRaw;
        const storedSpacedRepetitionPageSize =
          typeof migratedSpacedRepetitionPageSize === "number" &&
          SPACED_REPETITION_PAGE_SIZES.includes(
            migratedSpacedRepetitionPageSize as SpacedRepetitionPageSize,
          )
            ? (migratedSpacedRepetitionPageSize as SpacedRepetitionPageSize)
            : DEFAULT_SPACED_REPETITION_PAGE_SIZE;
        const storedSpacedRepetitionRepetitionStrength =
          settings.spaced_repetition_repetition_strength === "weak" ||
          settings.spaced_repetition_repetition_strength === "strong" ||
          settings.spaced_repetition_repetition_strength === "medium"
            ? settings.spaced_repetition_repetition_strength
            : DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH;
        const storedSpacedRepetitionStatsView =
          settings.spaced_repetition_stats_view === "vault" ||
          settings.spaced_repetition_stats_view === "completed"
            ? settings.spaced_repetition_stats_view
            : DEFAULT_SPACED_REPETITION_STATS_VIEW;
        const storedSpacedRepetitionHelpEnabled =
          typeof settings.spaced_repetition_help_enabled === "boolean"
            ? settings.spaced_repetition_help_enabled
            : DEFAULT_SPACED_REPETITION_HELP_ENABLED;
        const storedActiveNotePath =
          typeof settings.active_note_path === "string"
            ? settings.active_note_path
            : null;
        const storedRightToolbarCollapsed =
          typeof settings.right_toolbar_collapsed === "boolean"
            ? settings.right_toolbar_collapsed
            : DEFAULT_RIGHT_TOOLBAR_COLLAPSED;
        const storedExamMaxTotalPoints = clampExamTotalPoints(
          settings.exam_max_total_points ?? DEFAULT_EXAM_MAX_TOTAL_POINTS,
        );
        const storedExamTaskCount = clampExamTaskCount(
          settings.exam_task_count ?? DEFAULT_EXAM_TASK_COUNT,
        );
        const storedExamTaskPoints = normalizeExamTaskPointsAll(
          settings.exam_task_points,
          storedExamTaskCount,
          storedExamMaxTotalPoints,
        );
        const storedExamDurationMinutes = clampExamDurationMinutes(
          settings.exam_duration_minutes ?? DEFAULT_EXAM_DURATION_MINUTES,
        );
        const storedExamTimeLimitEnabled =
          typeof settings.exam_time_limit_enabled === "boolean"
            ? settings.exam_time_limit_enabled
            : DEFAULT_EXAM_TIME_LIMIT_ENABLED;
        const storedExamAutoCardsEnabled =
          typeof settings.exam_auto_cards_enabled === "boolean"
            ? settings.exam_auto_cards_enabled
            : DEFAULT_EXAM_AUTO_CARDS_ENABLED;
        const storedExamAutoCardsReturnOnCorrect =
          typeof settings.exam_auto_cards_return_on_correct === "boolean"
            ? settings.exam_auto_cards_return_on_correct
            : DEFAULT_EXAM_AUTO_CARDS_RETURN_ON_CORRECT;
        const storedExamGradeScale =
          settings.exam_grade_scale === "standard-1-6"
            ? settings.exam_grade_scale
            : DEFAULT_EXAM_GRADE_SCALE;
        const storedExamAiEvaluation = normalizeExamAiEvaluation(
          settings.exam_ai_evaluation,
        );
        const {
          settings: storedKeyboardShortcuts,
          needsMigration: shouldMigrateShortcuts,
        } = normalizeKeyboardShortcuts(settings.keyboard_shortcuts);
        if (shouldMigrateShortcuts) {
          needsKeyboardShortcutsMigration.current = true;
        }
        setTheme(storedTheme);
        setAccentColor(resolvedAccent);
        setAccentDraft(resolvedAccent);
        setAccentError("");
        setEditorExactColors(storedEditorExactColors);
        setEditorBlueprintGrid(storedEditorBlueprintGrid);
        setEditorBlueprintGridIntensity(storedEditorBlueprintGridIntensity);
        setActiveNotePath(storedActiveNotePath);
        setVaultPath(settings.vault_path ?? null);
        setLanguage(storedLanguage);
        setMaxFilesPerScan(storedMaxFilesPerScan);
        setScanParallelism(storedScanParallelism);
        setShowHiddenFoldersState(storedShowHiddenFolders);
        setFlashcardOrder(storedFlashcardOrder);
        setFlashcardMode(storedFlashcardMode);
        setFlashcardScope(storedFlashcardScope);
        setFastFlashcardOrder(storedFastFlashcardOrder);
        setFastFlashcardMode(storedFastFlashcardMode);
        setFastFlashcardScope(storedFastFlashcardScope);
        setFastFlashcardDuration(storedFastFlashcardDuration);
        setFastFlashcardHelpEnabledState(storedFastFlashcardHelpEnabled);
        setExamShowTimelineState(storedExamShowTimeline);
        setExamHelpEnabledState(storedExamHelpEnabled);
        setFlashcardPageSize(storedFlashcardPageSize);
        setSolutionRevealEnabled(storedSolutionRevealEnabled);
        setStatsResetMode(storedStatsResetMode);
        setFlashcardHelpEnabledState(storedFlashcardHelpEnabled);
        setSpacedRepetitionBoxes(storedSpacedRepetitionBoxes);
        setSpacedRepetitionOrder(storedSpacedRepetitionOrder);
        setSpacedRepetitionPageSize(storedSpacedRepetitionPageSize);
        setSpacedRepetitionRepetitionStrength(
          storedSpacedRepetitionRepetitionStrength,
        );
        setSpacedRepetitionStatsView(storedSpacedRepetitionStatsView);
        setSpacedRepetitionHelpEnabledState(storedSpacedRepetitionHelpEnabled);
        setRightToolbarCollapsed(storedRightToolbarCollapsed);
        setExamMaxTotalPointsState(storedExamMaxTotalPoints);
        setExamTaskCountState(storedExamTaskCount);
        setExamTaskPointsState(storedExamTaskPoints);
        setExamDurationMinutesState(storedExamDurationMinutes);
        setExamTimeLimitEnabledState(storedExamTimeLimitEnabled);
        setExamAutoCardsEnabledState(storedExamAutoCardsEnabled);
        setExamAutoCardsReturnOnCorrectState(storedExamAutoCardsReturnOnCorrect);
        setExamGradeScaleState(storedExamGradeScale);
        setExamAiEvaluationState(storedExamAiEvaluation);
        setKeyboardShortcutsState(storedKeyboardShortcuts);
        setSettingsLoaded(true);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load settings", error);
          setSettingsLoaded(true);
        }
      }
    };

    void restoreSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mdEditorColors = editorExactColors ? "on" : "off";
  }, [editorExactColors]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mdEditorGrid = editorBlueprintGrid ? "on" : "off";
  }, [editorBlueprintGrid]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mdEditorGridIntensity = editorBlueprintGridIntensity;
  }, [editorBlueprintGridIntensity]);

  useEffect(() => {
    if (!settingsLoaded || !needsShowHiddenFoldersMigration.current) {
      return;
    }
    needsShowHiddenFoldersMigration.current = false;
    void persistSettings({ showHiddenFolders });
  }, [persistSettings, settingsLoaded, showHiddenFolders]);

  useEffect(() => {
    if (!settingsLoaded || !needsKeyboardShortcutsMigration.current) {
      return;
    }
    needsKeyboardShortcutsMigration.current = false;
    void persistSettings({ keyboardShortcuts });
  }, [keyboardShortcuts, persistSettings, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!autoSaveReady.current) {
      autoSaveReady.current = true;
      return;
    }
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = window.setTimeout(() => {
      void saveSettings({
        activeNotePath,
        vaultPath,
        theme,
        accentColor,
        editorExactColors,
        editorBlueprintGrid,
        editorBlueprintGridIntensity,
        language,
        maxFilesPerScan,
        scanParallelism,
        showHiddenFolders,
        flashcardOrder,
        flashcardMode,
        flashcardScope,
        flashcardPageSize,
        solutionRevealEnabled,
        statsResetMode,
        flashcardHelpEnabled,
        spacedRepetitionBoxes,
        spacedRepetitionOrder,
        spacedRepetitionPageSize,
        spacedRepetitionRepetitionStrength,
        spacedRepetitionStatsView,
        spacedRepetitionHelpEnabled,
        rightToolbarCollapsed,
        fastFlashcardOrder,
        fastFlashcardMode,
        fastFlashcardScope,
        fastFlashcardDuration,
        fastFlashcardHelpEnabled,
        examShowTimeline,
        examHelpEnabled,
        examMaxTotalPoints,
        examTaskCount,
        examTaskPoints,
        examDurationMinutes,
        examTimeLimitEnabled,
        examAutoCardsEnabled,
        examAutoCardsReturnOnCorrect,
        examGradeScale,
        examAiEvaluation,
        keyboardShortcuts,
      });
    }, 300);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [
    accentColor,
    activeNotePath,
    editorExactColors,
    editorBlueprintGrid,
    editorBlueprintGridIntensity,
    examAiEvaluation,
    examMaxTotalPoints,
    examTaskCount,
    examTaskPoints,
    examDurationMinutes,
    examTimeLimitEnabled,
    examAutoCardsEnabled,
    examAutoCardsReturnOnCorrect,
    examGradeScale,
    examHelpEnabled,
    keyboardShortcuts,
    flashcardMode,
    flashcardOrder,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    fastFlashcardDuration,
    fastFlashcardHelpEnabled,
    examShowTimeline,
    flashcardPageSize,
    flashcardScope,
    flashcardHelpEnabled,
    language,
    maxFilesPerScan,
    saveSettings,
    scanParallelism,
    showHiddenFolders,
    settingsLoaded,
    solutionRevealEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionHelpEnabled,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    vaultPath,
    rightToolbarCollapsed,
  ]);

  return {
    accentColor,
    activeNotePath,
    accentDraft,
    accentError,
    editorExactColors,
    editorBlueprintGrid,
    editorBlueprintGridIntensity,
    examAiEvaluation,
    examMaxTotalPoints,
    examTaskCount,
    examTaskPoints,
    examDurationMinutes,
    examTimeLimitEnabled,
    examAutoCardsEnabled,
    examAutoCardsReturnOnCorrect,
    examGradeScale,
    flashcardMode,
    flashcardOrder,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    fastFlashcardDuration,
    fastFlashcardHelpEnabled,
    examShowTimeline,
    examHelpEnabled,
    flashcardPageSize,
    flashcardScope,
    keyboardShortcuts,
    showHiddenFolders,
    language,
    maxFilesPerScan,
    persistSettings,
    scanParallelism,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    setEditorExactColors,
    setEditorBlueprintGrid,
    setEditorBlueprintGridIntensity,
    setExamAiEvaluation,
    setExamMaxTotalPoints,
    setExamTaskCount,
    setExamTaskPoints,
    setExamDurationMinutes,
    setExamTimeLimitEnabled,
    setExamAutoCardsEnabled,
    setExamAutoCardsReturnOnCorrect,
    setExamGradeScale,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setFlashcardHelpEnabled,
    setFastFlashcardMode,
    setFastFlashcardOrder,
    setFastFlashcardScope,
    setFastFlashcardDuration,
    setFastFlashcardHelpEnabled,
    setExamShowTimeline,
    setExamHelpEnabled,
    setKeyboardShortcuts,
    setKeyboardShortcutBinding,
    resetKeyboardShortcuts,
    setShowHiddenFolders,
    setLanguage,
    setMaxFilesPerScan,
    setRightToolbarCollapsed,
    setScanParallelism,
    setSolutionRevealEnabled,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionHelpEnabled,
    setSpacedRepetitionStatsView,
    setStatsResetMode,
    setTheme,
    settingsLoaded,
    solutionRevealEnabled,
    flashcardHelpEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionHelpEnabled,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    vaultPath,
    rightToolbarCollapsed,
  };
};
