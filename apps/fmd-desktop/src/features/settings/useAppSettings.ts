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
import { normalizeVaultPath } from "../../lib/path";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  normalizeKeyboardShortcuts,
  type KeyboardShortcutSettings,
} from "../../lib/shortcuts/bindings";
import {
  AUTO_CARD_TYPES,
  type AutoCardType,
  type AutoCardTypeMap,
} from "../../lib/exam/autoCards";
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
import type { UserVaultMode } from "../../lib/userVault";
import {
  loadProfileSettings as loadUserVaultProfileSettings,
  saveProfileSettings as saveUserVaultProfileSettings,
} from "../user-vault/storage";

type AppLanguage = "de" | "en";
type EditorGridIntensity = "light" | "medium" | "strong";
type MarkdownPreviewDefaultMode = "markdown" | "raw";
type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";
type ExamAiProvider = "shared-gpt";
type ExamGradeScale = "standard-1-6";

type MarkdownEditorAccentColor = {
  lightHex?: string | null;
  darkHex?: string | null;
  customSwatches?: string[] | null;
};

type MarkdownEditorSettings = {
  accentColor?: MarkdownEditorAccentColor | null;
  accentColorHex?: string | null;
};

export type ExamAiEvaluation = {
  enabled: boolean;
  provider: ExamAiProvider | null;
};

export type VaultRegistryStatus = "available" | "missing";

export type RecentVaultEntry = {
  id: string;
  path: string;
  lastOpenedAt: string;
  status: VaultRegistryStatus;
  lastSeenAt: string | null;
  lastError?: string | null;
};

export type NormalizedSettingsResult = {
  settings: SettingsSnapshot;
  needsShowHiddenFoldersMigration: boolean;
  needsKeyboardShortcutsMigration: boolean;
  needsExamTaskTypeDefaultsMigration: boolean;
};

type ExamTaskTypeDefaultsByUserEntry = {
  points: Record<AutoCardType, number>;
  timeSeconds: Record<AutoCardType, number>;
};

type ExamTaskTypeDefaultsByUserId = Record<string, ExamTaskTypeDefaultsByUserEntry>;

export type AppSettings = {
  active_note_path?: string | null;
  vault_path?: string | null;
  recent_vaults?: RecentVaultEntry[] | null;
  user_vault_mode?: string | null;
  user_vault_custom_path?: string | null;
  user_vault_last_path?: string | null;
  user_vault_selected_auto_path?: string | null;
  user_vault_selected_custom_path?: string | null;
  theme?: string | null;
  accent_color?: string | null;
  markdownEditor?: MarkdownEditorSettings | null;
  editor_exact_colors?: boolean | null;
  editor_markdown_exact_colors_enabled?: boolean | null;
  editor_markdown_custom_accent_hex?: string | null;
  editor_blueprint_grid?: boolean | null;
  editor_blueprint_grid_intensity?: string | null;
  ui_cursor_accessory_enabled?: boolean | null;
  editor_markdown_backslash_enabled?: boolean | null;
  editor_markdown_view_edit_enabled?: boolean | null;
  editor_markdown_preview_default_mode?: string | null;
  exam_editor_show_move_buttons?: boolean | null;
  language?: AppLanguage | null;
  max_files_per_scan?: string | null;
  scan_parallelism?: string | null;
  show_hidden_folders?: boolean | null;
  show_empty_folders?: boolean | null;
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
  fast_flashcard_auto_time_enabled?: boolean | null;
  fast_flashcard_help_enabled?: boolean | null;
  exam_show_timeline?: boolean | null;
  exam_help_enabled?: boolean | null;
  spaced_repetition_boxes?: number | null;
  spaced_repetition_order?: string | null;
  spaced_repetition_page_size?: number | null;
  spaced_repetition_repetition_strength?: string | null;
  spaced_repetition_stats_view?: string | null;
  spaced_repetition_auto_time_enabled?: boolean | null;
  spaced_repetition_help_enabled?: boolean | null;
  right_toolbar_collapsed?: boolean | null;
  exam_max_total_points?: number | null;
  exam_task_count?: number | null;
  exam_task_points?: number[] | null;
  exam_duration_minutes?: number | null;
  exam_time_limit_enabled?: boolean | null;
  exam_auto_cards_enabled?: boolean | null;
  exam_auto_cards_types?: Partial<AutoCardTypeMap> | null;
  exam_task_type_default_points?: Partial<Record<AutoCardType, number>> | null;
  exam_task_type_default_time_seconds?: Partial<Record<AutoCardType, number>> | null;
  exam_task_type_defaults_by_user_id?:
    | Record<
        string,
        | {
            points?: Partial<Record<AutoCardType, number>> | null;
            timeSeconds?: Partial<Record<AutoCardType, number>> | null;
          }
        | null
      >
    | null;
  exam_auto_cards_return_on_correct?: boolean | null;
  exam_grade_scale?: string | null;
  exam_ai_evaluation?: ExamAiEvaluation | null;
  input_debug_enabled?: boolean | null;
  input_debug_redact_content?: boolean | null;
  keyboard_shortcuts?: KeyboardShortcutSettings | null;
};

type PersistUpdates = {
  activeNotePath?: string | null;
  vaultPath?: string | null;
  recentVaults?: RecentVaultEntry[];
  userVaultMode?: UserVaultMode;
  userVaultCustomPath?: string | null;
  userVaultLastPath?: string | null;
  userVaultSelectedAutoPath?: string | null;
  userVaultSelectedCustomPath?: string | null;
  theme?: ThemeMode;
  accentColor?: string;
  markdownEditorAccentEnabled?: boolean;
  markdownEditorAccentLightHex?: string;
  markdownEditorAccentDarkHex?: string;
  markdownEditorAccentCustomSwatches?: string[];
  editorBlueprintGrid?: boolean;
  editorBlueprintGridIntensity?: EditorGridIntensity;
  cursorAccessoryEnabled?: boolean;
  markdownViewEditEnabled?: boolean;
  markdownPreviewDefaultMode?: MarkdownPreviewDefaultMode;
  examEditorShowMoveButtons?: boolean;
  language?: AppLanguage;
  maxFilesPerScan?: string;
  scanParallelism?: "low" | "medium" | "high";
  showHiddenFolders?: boolean;
  showEmptyFolders?: boolean;
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
  fastFlashcardAutoTimeEnabled?: boolean;
  fastFlashcardHelpEnabled?: boolean;
  examShowTimeline?: boolean;
  examHelpEnabled?: boolean;
  spacedRepetitionBoxes?: SpacedRepetitionBoxes;
  spacedRepetitionOrder?: SpacedRepetitionOrder;
  spacedRepetitionPageSize?: SpacedRepetitionPageSize;
  spacedRepetitionRepetitionStrength?: SpacedRepetitionRepetitionStrength;
  spacedRepetitionStatsView?: SpacedRepetitionStatsView;
  spacedRepetitionAutoTimeEnabled?: boolean;
  spacedRepetitionHelpEnabled?: boolean;
  rightToolbarCollapsed?: boolean;
  examMaxTotalPoints?: number;
  examTaskCount?: number;
  examTaskPoints?: number[];
  examDurationMinutes?: number;
  examTimeLimitEnabled?: boolean;
  examAutoCardsTypes?: Partial<AutoCardTypeMap>;
  examTaskTypeDefaultPoints?: Partial<Record<AutoCardType, number>>;
  examTaskTypeDefaultTimeSeconds?: Partial<Record<AutoCardType, number>>;
  examTaskTypeDefaultsByUserId?: ExamTaskTypeDefaultsByUserId;
  examAutoCardsReturnOnCorrect?: boolean;
  examGradeScale?: ExamGradeScale;
  examAiEvaluation?: ExamAiEvaluation;
  inputDebugEnabled?: boolean;
  inputDebugRedactContent?: boolean;
  keyboardShortcuts?: KeyboardShortcutSettings;
};

export type SettingsSnapshot = {
  activeNotePath: string | null;
  vaultPath: string | null;
  recentVaults: RecentVaultEntry[];
  userVaultMode: UserVaultMode;
  userVaultCustomPath: string | null;
  userVaultLastPath: string | null;
  userVaultSelectedAutoPath: string | null;
  userVaultSelectedCustomPath: string | null;
  theme: ThemeMode;
  accentColor: string;
  markdownEditorAccentEnabled: boolean;
  markdownEditorAccentLightHex: string;
  markdownEditorAccentDarkHex: string;
  markdownEditorAccentCustomSwatches: string[];
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: EditorGridIntensity;
  cursorAccessoryEnabled: boolean;
  markdownViewEditEnabled: boolean;
  markdownPreviewDefaultMode: MarkdownPreviewDefaultMode;
  examEditorShowMoveButtons: boolean;
  language: AppLanguage;
  maxFilesPerScan: string;
  scanParallelism: "low" | "medium" | "high";
  showHiddenFolders: boolean;
  showEmptyFolders: boolean;
  flashcardOrder: FlashcardOrder;
  flashcardMode: FlashcardMode;
  flashcardScope: FlashcardScope;
  flashcardPageSize: FlashcardPageSize;
  solutionRevealEnabled: boolean;
  statsResetMode: StatsResetMode;
  flashcardHelpEnabled: boolean;
  fastFlashcardOrder: FlashcardOrder;
  fastFlashcardMode: FlashcardMode;
  fastFlashcardScope: FlashcardScope;
  fastFlashcardDuration: number;
  fastFlashcardAutoTimeEnabled: boolean;
  fastFlashcardHelpEnabled: boolean;
  examShowTimeline: boolean;
  examHelpEnabled: boolean;
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  spacedRepetitionOrder: SpacedRepetitionOrder;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
  spacedRepetitionStatsView: SpacedRepetitionStatsView;
  spacedRepetitionAutoTimeEnabled: boolean;
  spacedRepetitionHelpEnabled: boolean;
  rightToolbarCollapsed: boolean;
  examMaxTotalPoints: number;
  examTaskCount: number;
  examTaskPoints: number[];
  examDurationMinutes: number;
  examTimeLimitEnabled: boolean;
  examAutoCardsTypes: AutoCardTypeMap;
  examTaskTypeDefaultPoints: Record<AutoCardType, number>;
  examTaskTypeDefaultTimeSeconds: Record<AutoCardType, number>;
  examTaskTypeDefaultsByUserId: ExamTaskTypeDefaultsByUserId;
  examAutoCardsReturnOnCorrect: boolean;
  examGradeScale: ExamGradeScale;
  examAiEvaluation: ExamAiEvaluation;
  inputDebugEnabled: boolean;
  inputDebugRedactContent: boolean;
  keyboardShortcuts: KeyboardShortcutSettings;
};

export const DEFAULT_THEME: ThemeMode = "light";
export const DEFAULT_LANGUAGE: AppLanguage = "de";
const DEFAULT_EDITOR_BLUEPRINT_GRID = false;
const DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY: EditorGridIntensity = "medium";
const DEFAULT_EXAM_EDITOR_SHOW_MOVE_BUTTONS = false;
const DEFAULT_MARKDOWN_EDITOR_ACCENT_ENABLED = false;
const CURSOR_ACCESSORY_VIEWPORT_BREAKPOINT = 1200;
const resolveDefaultCursorAccessoryEnabled = () => {
  if (typeof window === "undefined") {
    return true;
  }
  return window.innerWidth < CURSOR_ACCESSORY_VIEWPORT_BREAKPOINT;
};
const DEFAULT_CURSOR_ACCESSORY_ENABLED = resolveDefaultCursorAccessoryEnabled();
const DEFAULT_MARKDOWN_VIEW_EDIT_ENABLED = false;
const DEFAULT_MARKDOWN_PREVIEW_DEFAULT_MODE: MarkdownPreviewDefaultMode =
  "markdown";
const DEFAULT_MAX_FILES_PER_SCAN = "50";
const DEFAULT_SCAN_PARALLELISM: "low" | "medium" | "high" = "medium";
const DEFAULT_SHOW_HIDDEN_FOLDERS = false;
const DEFAULT_SHOW_EMPTY_FOLDERS = true;
const DEFAULT_USER_VAULT_MODE: UserVaultMode = "auto";
const DEFAULT_FLASHCARD_ORDER: FlashcardOrder = "in-order";
const DEFAULT_FLASHCARD_MODE: FlashcardMode = "all";
const DEFAULT_FLASHCARD_SCOPE: FlashcardScope = "current";
const DEFAULT_STATS_RESET_MODE: StatsResetMode = "scan";
const DEFAULT_FLASHCARD_HELP_ENABLED = true;
const DEFAULT_FAST_FLASHCARD_ORDER: FlashcardOrder = DEFAULT_FLASHCARD_ORDER;
const DEFAULT_FAST_FLASHCARD_MODE: FlashcardMode = DEFAULT_FLASHCARD_MODE;
const DEFAULT_FAST_FLASHCARD_SCOPE: FlashcardScope = DEFAULT_FLASHCARD_SCOPE;
const DEFAULT_FAST_FLASHCARD_DURATION = 12;
const DEFAULT_FAST_FLASHCARD_AUTO_TIME_ENABLED = false;
const DEFAULT_FAST_FLASHCARD_HELP_ENABLED = true;
const DEFAULT_EXAM_SHOW_TIMELINE = true;
const DEFAULT_EXAM_HELP_ENABLED = true;
const DEFAULT_SPACED_REPETITION_BOXES: SpacedRepetitionBoxes = 5;
const DEFAULT_SPACED_REPETITION_ORDER: SpacedRepetitionOrder = "in-order";
const DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH: SpacedRepetitionRepetitionStrength =
  "medium";
const DEFAULT_SPACED_REPETITION_STATS_VIEW: SpacedRepetitionStatsView = "boxes";
const DEFAULT_SPACED_REPETITION_AUTO_TIME_ENABLED = false;
const DEFAULT_SPACED_REPETITION_HELP_ENABLED = true;
const DEFAULT_RIGHT_TOOLBAR_COLLAPSED = false;
const MAX_RECENT_VAULTS = 10;
const FALLBACK_RECENT_OPENED_AT = new Date(0).toISOString();
const MAX_EXAM_TASK_COUNT = 20;
const DEFAULT_EXAM_MAX_TOTAL_POINTS = 20;
const DEFAULT_EXAM_TASK_COUNT = 5;
const DEFAULT_EXAM_DURATION_MINUTES = 30;
const DEFAULT_EXAM_TIME_LIMIT_ENABLED = true;
export const DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS: Record<AutoCardType, number> = {
  qa: 6,
  tf: 2,
  m1: 3,
  m2: 5,
  cl: 4,
  cd: 5,
  cld: 8,
};
export const DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS: Record<
  AutoCardType,
  number
> = {
  qa: 6,
  tf: 2,
  m1: 3,
  m2: 5,
  cl: 4,
  cd: 5,
  cld: 8,
};
export const EXAM_TASK_TYPE_LEGACY_PRESET_POINTS: Record<AutoCardType, number> = {
  qa: 10,
  tf: 1,
  m1: 3,
  m2: 5,
  cl: 6,
  cd: 5,
  cld: 8,
};
export const EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS: Record<
  AutoCardType,
  number
> = {
  qa: 480,
  tf: 45,
  m1: 90,
  m2: 120,
  cl: 240,
  cd: 160,
  cld: 480,
};

const hasExactExamTaskTypeDefaults = (
  candidate: Record<AutoCardType, number>,
  legacy: Record<AutoCardType, number>,
) =>
  AUTO_CARD_TYPES.every((type) => candidate[type] === legacy[type]);

const buildDefaultAutoCardTypes = (value: boolean): AutoCardTypeMap =>
  AUTO_CARD_TYPES.reduce(
    (acc, type) => {
      acc[type] = value;
      return acc;
    },
    {} as AutoCardTypeMap,
  );
const DEFAULT_EXAM_AUTO_CARDS_TYPES = buildDefaultAutoCardTypes(false);
const DEFAULT_EXAM_AUTO_CARDS_RETURN_ON_CORRECT = false;
const DEFAULT_EXAM_AI_EVALUATION: ExamAiEvaluation = {
  enabled: false,
  provider: null,
};
const DEFAULT_EXAM_GRADE_SCALE: ExamGradeScale = "standard-1-6";
const DEFAULT_INPUT_DEBUG_ENABLED = false;
const DEFAULT_INPUT_DEBUG_REDACT_CONTENT = true;

const normalizeVaultRegistryStatus = (value: unknown): VaultRegistryStatus =>
  value === "missing" ? "missing" : "available";

export const buildRecentVaultId = (path: string) => {
  const normalized = normalizeVaultPath(path.trim());
  return normalized ? `vault:${normalized}` : `vault:${path.trim()}`;
};

type RecentVaultEntryOverrides = Partial<RecentVaultEntry> & {
  id?: string;
};

export const createRecentVaultEntry = (
  path: string,
  overrides: RecentVaultEntryOverrides = {},
): RecentVaultEntry => {
  const trimmedPath = path.trim();
  const now = new Date().toISOString();
  const status = normalizeVaultRegistryStatus(overrides.status);
  const lastOpenedAt =
    typeof overrides.lastOpenedAt === "string" && overrides.lastOpenedAt.trim()
      ? overrides.lastOpenedAt
      : now;
  const explicitLastSeenAt = overrides.lastSeenAt;
  const lastSeenAt =
    typeof explicitLastSeenAt === "string"
      ? explicitLastSeenAt
      : explicitLastSeenAt === null
        ? null
        : status === "available"
          ? lastOpenedAt
          : null;
  const lastError =
    typeof overrides.lastError === "string"
      ? overrides.lastError
      : overrides.lastError === null
        ? null
        : null;

  return {
    id:
      typeof overrides.id === "string" && overrides.id.trim()
        ? overrides.id
        : buildRecentVaultId(trimmedPath),
    path: trimmedPath,
    lastOpenedAt,
    status,
    lastSeenAt,
    lastError,
  };
};

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

const clampExamTaskTypeDefaultPoints = (value: unknown, fallback: number) => {
  const parsed = parseInteger(value);
  if (parsed === null) {
    return Math.max(0, Math.floor(fallback));
  }
  return Math.max(0, parsed);
};

const isAutoCardType = (value: unknown): value is AutoCardType =>
  AUTO_CARD_TYPES.includes(value as AutoCardType);

const normalizeExamAutoCardsTypes = (
  value: unknown,
  legacyEnabled: boolean | null,
): AutoCardTypeMap => {
  const next = { ...DEFAULT_EXAM_AUTO_CARDS_TYPES };
  let hasExplicitConfig = false;

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (isAutoCardType(entry)) {
        next[entry] = true;
        hasExplicitConfig = true;
      }
    });
  } else if (value && typeof value === "object") {
    const candidate = value as Partial<Record<AutoCardType, unknown>>;
    AUTO_CARD_TYPES.forEach((type) => {
      if (typeof candidate[type] === "boolean") {
        next[type] = candidate[type] ?? false;
        hasExplicitConfig = true;
      }
    });
  }

  if (!hasExplicitConfig && legacyEnabled) {
    AUTO_CARD_TYPES.forEach((type) => {
      next[type] = true;
    });
  }

  return next;
};

const mergeExamAutoCardsTypes = (
  current: AutoCardTypeMap,
  updates?: Partial<AutoCardTypeMap>,
): AutoCardTypeMap => {
  if (!updates) {
    return current;
  }
  const next = { ...current };
  AUTO_CARD_TYPES.forEach((type) => {
    if (typeof updates[type] === "boolean") {
      next[type] = updates[type] ?? false;
    }
  });
  return next;
};

const normalizeExamTaskTypeDefaultPoints = (
  value: unknown,
): Record<AutoCardType, number> => {
  const next = { ...DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return next;
  }
  const candidate = value as Partial<Record<AutoCardType, unknown>>;
  AUTO_CARD_TYPES.forEach((type) => {
    next[type] = clampExamTaskTypeDefaultPoints(
      candidate[type],
      DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS[type],
    );
  });
  return next;
};

const mergeExamTaskTypeDefaultPoints = (
  current: Record<AutoCardType, number>,
  updates?: Partial<Record<AutoCardType, number>>,
): Record<AutoCardType, number> => {
  if (!updates) {
    return current;
  }
  const next = { ...current };
  AUTO_CARD_TYPES.forEach((type) => {
    if (typeof updates[type] === "number" && Number.isFinite(updates[type])) {
      next[type] = clampExamTaskTypeDefaultPoints(updates[type], current[type]);
    }
  });
  return next;
};

const normalizeExamTaskTypeDefaultTimeSeconds = (
  value: unknown,
): Record<AutoCardType, number> => {
  const next = { ...DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return next;
  }
  const candidate = value as Partial<Record<AutoCardType, unknown>>;
  AUTO_CARD_TYPES.forEach((type) => {
    next[type] = clampExamTaskTypeDefaultPoints(
      candidate[type],
      DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS[type],
    );
  });
  return next;
};

const mergeExamTaskTypeDefaultTimeSeconds = (
  current: Record<AutoCardType, number>,
  updates?: Partial<Record<AutoCardType, number>>,
): Record<AutoCardType, number> => {
  if (!updates) {
    return current;
  }
  const next = { ...current };
  AUTO_CARD_TYPES.forEach((type) => {
    if (typeof updates[type] === "number" && Number.isFinite(updates[type])) {
      next[type] = clampExamTaskTypeDefaultPoints(updates[type], current[type]);
    }
  });
  return next;
};

const normalizeExamTaskTypeDefaultsByUserId = (
  value: unknown,
): ExamTaskTypeDefaultsByUserId => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const next: ExamTaskTypeDefaultsByUserId = {};
  Object.entries(value as Record<string, unknown>).forEach(([rawUserId, rawDefaults]) => {
    const userId = rawUserId.trim();
    if (!userId) {
      return;
    }
    if (!rawDefaults || typeof rawDefaults !== "object" || Array.isArray(rawDefaults)) {
      return;
    }
    const candidate = rawDefaults as {
      points?: unknown;
      timeSeconds?: unknown;
    };
    const hasPoints = Boolean(
      candidate.points &&
        typeof candidate.points === "object" &&
        !Array.isArray(candidate.points),
    );
    const hasTimeSeconds = Boolean(
      candidate.timeSeconds &&
        typeof candidate.timeSeconds === "object" &&
        !Array.isArray(candidate.timeSeconds),
    );
    if (!hasPoints && !hasTimeSeconds) {
      return;
    }
    next[userId] = {
      points: normalizeExamTaskTypeDefaultPoints(candidate.points),
      timeSeconds: normalizeExamTaskTypeDefaultTimeSeconds(candidate.timeSeconds),
    };
  });
  return next;
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

const normalizeRecentVaults = (value: unknown): RecentVaultEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: RecentVaultEntry[] = [];
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const candidate = entry as {
      id?: unknown;
      vaultId?: unknown;
      vault_id?: unknown;
      path?: unknown;
      status?: unknown;
      lastSeenAt?: unknown;
      last_seen_at?: unknown;
      lastError?: unknown;
      last_error?: unknown;
      lastOpenedAt?: unknown;
      last_opened_at?: unknown;
    };
    if (typeof candidate.path !== "string") {
      return;
    }
    const trimmedPath = candidate.path.trim();
    if (!trimmedPath) {
      return;
    }
    const normalized = normalizeVaultPath(trimmedPath);
    if (!normalized || seenPaths.has(normalized)) {
      return;
    }
    const rawId =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id
        : typeof candidate.vaultId === "string" && candidate.vaultId.trim()
          ? candidate.vaultId
          : typeof candidate.vault_id === "string" && candidate.vault_id.trim()
            ? candidate.vault_id
            : buildRecentVaultId(trimmedPath);
    if (seenIds.has(rawId)) {
      return;
    }
    seenIds.add(rawId);
    seenPaths.add(normalized);
    const lastOpenedAt =
      typeof candidate.lastOpenedAt === "string"
        ? candidate.lastOpenedAt
        : typeof candidate.last_opened_at === "string"
          ? candidate.last_opened_at
          : FALLBACK_RECENT_OPENED_AT;
    const status = normalizeVaultRegistryStatus(candidate.status);
    const lastSeenAt =
      typeof candidate.lastSeenAt === "string"
        ? candidate.lastSeenAt
        : typeof candidate.last_seen_at === "string"
          ? candidate.last_seen_at
          : status === "available"
            ? lastOpenedAt
            : null;
    const lastError =
      typeof candidate.lastError === "string"
        ? candidate.lastError
        : typeof candidate.last_error === "string"
          ? candidate.last_error
          : null;
    entries.push(
      createRecentVaultEntry(trimmedPath, {
        id: rawId,
        lastOpenedAt,
        status,
        lastSeenAt,
        lastError,
      }),
    );
  });
  return entries.slice(0, MAX_RECENT_VAULTS);
};

const normalizeMarkdownAccentHex = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = normalizeHex(value);
  return isValidHex(normalized) ? normalized : null;
};

const normalizeMarkdownAccentSwatches = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const next = new Set<string>();
  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }
    const normalized = normalizeHex(entry);
    if (isValidHex(normalized)) {
      next.add(normalized);
    }
  });
  return Array.from(next).slice(0, 20);
};

const buildProfileSettingsPayload = (settings: SettingsSnapshot): AppSettings => ({
  active_note_path: settings.activeNotePath,
  vault_path: settings.vaultPath,
  recent_vaults: settings.recentVaults,
  theme: settings.theme,
  accent_color: settings.accentColor,
  markdownEditor: {
    accentColor: {
      lightHex: settings.markdownEditorAccentLightHex,
      darkHex: settings.markdownEditorAccentDarkHex,
      customSwatches: settings.markdownEditorAccentCustomSwatches,
    },
  },
  editor_markdown_exact_colors_enabled: settings.markdownEditorAccentEnabled,
  editor_blueprint_grid: settings.editorBlueprintGrid,
  editor_blueprint_grid_intensity: settings.editorBlueprintGridIntensity,
  ui_cursor_accessory_enabled: settings.cursorAccessoryEnabled,
  editor_markdown_view_edit_enabled: settings.markdownViewEditEnabled,
  editor_markdown_preview_default_mode: settings.markdownPreviewDefaultMode,
  exam_editor_show_move_buttons: settings.examEditorShowMoveButtons,
  language: settings.language,
  max_files_per_scan: settings.maxFilesPerScan,
  scan_parallelism: settings.scanParallelism,
  show_hidden_folders: settings.showHiddenFolders,
  show_empty_folders: settings.showEmptyFolders,
  flashcard_order: settings.flashcardOrder,
  flashcard_mode: settings.flashcardMode,
  flashcard_scope: settings.flashcardScope,
  flashcard_page_size: settings.flashcardPageSize,
  flashcard_solution_reveal_enabled: settings.solutionRevealEnabled,
  flashcard_stats_reset_mode: settings.statsResetMode,
  flashcard_help_enabled: settings.flashcardHelpEnabled,
  fast_flashcard_order: settings.fastFlashcardOrder,
  fast_flashcard_mode: settings.fastFlashcardMode,
  fast_flashcard_scope: settings.fastFlashcardScope,
  fast_flashcard_duration: settings.fastFlashcardDuration,
  fast_flashcard_auto_time_enabled: settings.fastFlashcardAutoTimeEnabled,
  fast_flashcard_help_enabled: settings.fastFlashcardHelpEnabled,
  exam_show_timeline: settings.examShowTimeline,
  exam_help_enabled: settings.examHelpEnabled,
  spaced_repetition_boxes: settings.spacedRepetitionBoxes,
  spaced_repetition_order: settings.spacedRepetitionOrder,
  spaced_repetition_page_size: settings.spacedRepetitionPageSize,
  spaced_repetition_repetition_strength:
    settings.spacedRepetitionRepetitionStrength,
  spaced_repetition_stats_view: settings.spacedRepetitionStatsView,
  spaced_repetition_auto_time_enabled: settings.spacedRepetitionAutoTimeEnabled,
  spaced_repetition_help_enabled: settings.spacedRepetitionHelpEnabled,
  right_toolbar_collapsed: settings.rightToolbarCollapsed,
  exam_max_total_points: settings.examMaxTotalPoints,
  exam_task_count: settings.examTaskCount,
  exam_task_points: settings.examTaskPoints,
  exam_duration_minutes: settings.examDurationMinutes,
  exam_time_limit_enabled: settings.examTimeLimitEnabled,
  exam_auto_cards_types: settings.examAutoCardsTypes,
  exam_task_type_default_points: settings.examTaskTypeDefaultPoints,
  exam_task_type_default_time_seconds: settings.examTaskTypeDefaultTimeSeconds,
  exam_task_type_defaults_by_user_id: settings.examTaskTypeDefaultsByUserId,
  exam_auto_cards_return_on_correct: settings.examAutoCardsReturnOnCorrect,
  exam_grade_scale: settings.examGradeScale,
  exam_ai_evaluation: settings.examAiEvaluation,
  input_debug_enabled: settings.inputDebugEnabled,
  input_debug_redact_content: settings.inputDebugRedactContent,
  keyboard_shortcuts: settings.keyboardShortcuts,
});

export const normalizeSettings = (
  settings: AppSettings | null | undefined,
): NormalizedSettingsResult => {
  const stored = settings ?? {};
  const storedTheme = stored.theme === "dark" ? "dark" : DEFAULT_THEME;
  const storedAccentRaw = stored.accent_color ?? DEFAULT_ACCENT;
  const storedAccent = normalizeHex(storedAccentRaw);
  const resolvedAccent = isValidHex(storedAccent) ? storedAccent : DEFAULT_ACCENT;
  const storedMarkdownAccent = stored.markdownEditor?.accentColor ?? null;
  const storedMarkdownAccentLight = normalizeMarkdownAccentHex(
    storedMarkdownAccent?.lightHex,
  );
  const storedMarkdownAccentDark = normalizeMarkdownAccentHex(
    storedMarkdownAccent?.darkHex,
  );
  const storedMarkdownAccentCustomSwatches = normalizeMarkdownAccentSwatches(
    storedMarkdownAccent?.customSwatches ?? [],
  );
  const legacyMarkdownAccent =
    normalizeMarkdownAccentHex(stored.markdownEditor?.accentColorHex) ??
    normalizeMarkdownAccentHex(stored.editor_markdown_custom_accent_hex);
  const fallbackMarkdownAccent = legacyMarkdownAccent ?? resolvedAccent;
  const storedMarkdownAccentEnabled =
    typeof stored.editor_markdown_exact_colors_enabled === "boolean"
      ? stored.editor_markdown_exact_colors_enabled
      : DEFAULT_MARKDOWN_EDITOR_ACCENT_ENABLED;
  const storedMarkdownAccentLightHex =
    storedMarkdownAccentLight ?? fallbackMarkdownAccent;
  const storedMarkdownAccentDarkHex =
    storedMarkdownAccentDark ?? fallbackMarkdownAccent;
  const storedEditorBlueprintGrid =
    typeof stored.editor_blueprint_grid === "boolean"
      ? stored.editor_blueprint_grid
      : DEFAULT_EDITOR_BLUEPRINT_GRID;
  const storedEditorBlueprintGridIntensity =
    stored.editor_blueprint_grid_intensity === "light" ||
    stored.editor_blueprint_grid_intensity === "strong" ||
    stored.editor_blueprint_grid_intensity === "medium"
      ? stored.editor_blueprint_grid_intensity
      : DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY;
  const storedCursorAccessoryEnabled =
    typeof stored.ui_cursor_accessory_enabled === "boolean"
      ? stored.ui_cursor_accessory_enabled
      : typeof stored.editor_markdown_backslash_enabled === "boolean"
        ? stored.editor_markdown_backslash_enabled
      : DEFAULT_CURSOR_ACCESSORY_ENABLED;
  const storedMarkdownViewEditEnabled =
    typeof stored.editor_markdown_view_edit_enabled === "boolean"
      ? stored.editor_markdown_view_edit_enabled
      : DEFAULT_MARKDOWN_VIEW_EDIT_ENABLED;
  const storedMarkdownPreviewDefaultMode =
    stored.editor_markdown_preview_default_mode === "raw" ||
    stored.editor_markdown_preview_default_mode === "markdown"
      ? stored.editor_markdown_preview_default_mode
      : DEFAULT_MARKDOWN_PREVIEW_DEFAULT_MODE;
  const storedExamEditorShowMoveButtons =
    typeof stored.exam_editor_show_move_buttons === "boolean"
      ? stored.exam_editor_show_move_buttons
      : DEFAULT_EXAM_EDITOR_SHOW_MOVE_BUTTONS;
  const storedLanguage = stored.language === "en" ? "en" : DEFAULT_LANGUAGE;
  const maxFilesRaw = stored.max_files_per_scan;
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
    stored.scan_parallelism === "low" ||
    stored.scan_parallelism === "high" ||
    stored.scan_parallelism === "medium"
      ? stored.scan_parallelism
      : DEFAULT_SCAN_PARALLELISM;
  const legacyHiddenFoldersLevel = resolveLegacyHiddenFoldersLevel(stored);
  const needsShowHiddenFoldersMigration =
    typeof stored.show_hidden_folders !== "boolean" &&
    legacyHiddenFoldersLevel !== null;
  const storedShowHiddenFolders =
    typeof stored.show_hidden_folders === "boolean"
      ? stored.show_hidden_folders
      : legacyHiddenFoldersLevel !== null
        ? legacyHiddenFoldersLevel > 0
        : DEFAULT_SHOW_HIDDEN_FOLDERS;
  const storedShowEmptyFolders =
    typeof stored.show_empty_folders === "boolean"
      ? stored.show_empty_folders
      : DEFAULT_SHOW_EMPTY_FOLDERS;
  const storedUserVaultMode =
    stored.user_vault_mode === "custom" ? "custom" : DEFAULT_USER_VAULT_MODE;
  const storedUserVaultCustomPath =
    typeof stored.user_vault_custom_path === "string"
      ? stored.user_vault_custom_path.trim() || null
      : null;
  const storedUserVaultLastPath =
    typeof stored.user_vault_last_path === "string"
      ? stored.user_vault_last_path.trim() || null
      : null;
  const storedUserVaultSelectedAutoPath =
    typeof stored.user_vault_selected_auto_path === "string"
      ? stored.user_vault_selected_auto_path.trim() || null
      : null;
  const storedUserVaultSelectedCustomPathRaw =
    typeof stored.user_vault_selected_custom_path === "string"
      ? stored.user_vault_selected_custom_path.trim() || null
      : null;
  const storedUserVaultSelectedCustomPath =
    storedUserVaultSelectedCustomPathRaw ?? storedUserVaultCustomPath ?? null;
  const storedFlashcardOrder =
    stored.flashcard_order === "random" ? "random" : DEFAULT_FLASHCARD_ORDER;
  const storedFlashcardMode =
    stored.flashcard_mode === "all" ||
    stored.flashcard_mode === "qa" ||
    stored.flashcard_mode === "multiple-choice" ||
    stored.flashcard_mode === "mix" ||
    stored.flashcard_mode === "fill-blank" ||
    stored.flashcard_mode === "assignment" ||
    stored.flashcard_mode === "true-false"
      ? stored.flashcard_mode
      : stored.flashcard_mode === "yes-no"
        ? "true-false"
        : DEFAULT_FLASHCARD_MODE;
  const storedFlashcardScope =
    stored.flashcard_scope === "vault" ? "vault" : DEFAULT_FLASHCARD_SCOPE;
  const storedFastFlashcardOrder =
    stored.fast_flashcard_order === "random"
      ? "random"
      : DEFAULT_FAST_FLASHCARD_ORDER;
  const storedFastFlashcardMode =
    stored.fast_flashcard_mode === "all" ||
    stored.fast_flashcard_mode === "qa" ||
    stored.fast_flashcard_mode === "multiple-choice" ||
    stored.fast_flashcard_mode === "mix" ||
    stored.fast_flashcard_mode === "fill-blank" ||
    stored.fast_flashcard_mode === "assignment" ||
    stored.fast_flashcard_mode === "true-false"
      ? stored.fast_flashcard_mode
      : stored.fast_flashcard_mode === "yes-no"
        ? "true-false"
        : DEFAULT_FAST_FLASHCARD_MODE;
  const storedFastFlashcardScope =
    stored.fast_flashcard_scope === "vault"
      ? "vault"
      : DEFAULT_FAST_FLASHCARD_SCOPE;
  const storedFastFlashcardDurationRaw = stored.fast_flashcard_duration;
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
  const storedFastFlashcardAutoTimeEnabled =
    typeof stored.fast_flashcard_auto_time_enabled === "boolean"
      ? stored.fast_flashcard_auto_time_enabled
      : DEFAULT_FAST_FLASHCARD_AUTO_TIME_ENABLED;
  const storedFastFlashcardHelpEnabled =
    typeof stored.fast_flashcard_help_enabled === "boolean"
      ? stored.fast_flashcard_help_enabled
      : DEFAULT_FAST_FLASHCARD_HELP_ENABLED;
  const storedExamShowTimeline =
    typeof stored.exam_show_timeline === "boolean"
      ? stored.exam_show_timeline
      : DEFAULT_EXAM_SHOW_TIMELINE;
  const storedExamHelpEnabled =
    typeof stored.exam_help_enabled === "boolean"
      ? stored.exam_help_enabled
      : DEFAULT_EXAM_HELP_ENABLED;
  const storedFlashcardPageSizeRaw = stored.flashcard_page_size;
  const migratedFlashcardPageSize =
    storedFlashcardPageSizeRaw === 10 ? 5 : storedFlashcardPageSizeRaw;
  const storedFlashcardPageSize =
    typeof migratedFlashcardPageSize === "number" &&
    FLASHCARD_PAGE_SIZES.includes(migratedFlashcardPageSize as FlashcardPageSize)
      ? (migratedFlashcardPageSize as FlashcardPageSize)
      : DEFAULT_FLASHCARD_PAGE_SIZE;
  const storedSolutionRevealEnabled =
    typeof stored.flashcard_solution_reveal_enabled === "boolean"
      ? stored.flashcard_solution_reveal_enabled
      : true;
  const storedStatsResetMode =
    stored.flashcard_stats_reset_mode === "session"
      ? "session"
      : DEFAULT_STATS_RESET_MODE;
  const storedFlashcardHelpEnabled =
    typeof stored.flashcard_help_enabled === "boolean"
      ? stored.flashcard_help_enabled
      : DEFAULT_FLASHCARD_HELP_ENABLED;
  const storedSpacedRepetitionBoxes =
    typeof stored.spaced_repetition_boxes === "number" &&
    SPACED_REPETITION_BOXES.includes(
      stored.spaced_repetition_boxes as SpacedRepetitionBoxes,
    )
      ? (stored.spaced_repetition_boxes as SpacedRepetitionBoxes)
      : DEFAULT_SPACED_REPETITION_BOXES;
  const storedSpacedRepetitionOrder =
    stored.spaced_repetition_order === "random" ||
    stored.spaced_repetition_order === "repetition"
      ? stored.spaced_repetition_order
      : DEFAULT_SPACED_REPETITION_ORDER;
  const storedSpacedRepetitionPageSizeRaw = stored.spaced_repetition_page_size;
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
    stored.spaced_repetition_repetition_strength === "weak" ||
    stored.spaced_repetition_repetition_strength === "strong" ||
    stored.spaced_repetition_repetition_strength === "medium"
      ? stored.spaced_repetition_repetition_strength
      : DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH;
  const storedSpacedRepetitionStatsView =
    stored.spaced_repetition_stats_view === "vault" ||
    stored.spaced_repetition_stats_view === "completed"
      ? stored.spaced_repetition_stats_view
      : DEFAULT_SPACED_REPETITION_STATS_VIEW;
  const storedSpacedRepetitionAutoTimeEnabled =
    typeof stored.spaced_repetition_auto_time_enabled === "boolean"
      ? stored.spaced_repetition_auto_time_enabled
      : DEFAULT_SPACED_REPETITION_AUTO_TIME_ENABLED;
  const storedSpacedRepetitionHelpEnabled =
    typeof stored.spaced_repetition_help_enabled === "boolean"
      ? stored.spaced_repetition_help_enabled
      : DEFAULT_SPACED_REPETITION_HELP_ENABLED;
  const storedActiveNotePath =
    typeof stored.active_note_path === "string" ? stored.active_note_path : null;
  const storedRecentVaults = normalizeRecentVaults(stored.recent_vaults);
  const storedRightToolbarCollapsed =
    typeof stored.right_toolbar_collapsed === "boolean"
      ? stored.right_toolbar_collapsed
      : DEFAULT_RIGHT_TOOLBAR_COLLAPSED;
  const storedExamMaxTotalPoints = clampExamTotalPoints(
    stored.exam_max_total_points ?? DEFAULT_EXAM_MAX_TOTAL_POINTS,
  );
  const storedExamTaskCount = clampExamTaskCount(
    stored.exam_task_count ?? DEFAULT_EXAM_TASK_COUNT,
  );
  const storedExamTaskPoints = normalizeExamTaskPointsAll(
    stored.exam_task_points,
    storedExamTaskCount,
    storedExamMaxTotalPoints,
  );
  const storedExamDurationMinutes = clampExamDurationMinutes(
    stored.exam_duration_minutes ?? DEFAULT_EXAM_DURATION_MINUTES,
  );
  const storedExamTimeLimitEnabled =
    typeof stored.exam_time_limit_enabled === "boolean"
      ? stored.exam_time_limit_enabled
      : DEFAULT_EXAM_TIME_LIMIT_ENABLED;
  const legacyExamAutoCardsEnabled =
    typeof stored.exam_auto_cards_enabled === "boolean"
      ? stored.exam_auto_cards_enabled
      : null;
  const storedExamAutoCardsTypes = normalizeExamAutoCardsTypes(
    stored.exam_auto_cards_types,
    legacyExamAutoCardsEnabled,
  );
  const storedExamTaskTypeDefaultPoints = normalizeExamTaskTypeDefaultPoints(
    stored.exam_task_type_default_points,
  );
  const storedExamTaskTypeDefaultTimeSeconds =
    normalizeExamTaskTypeDefaultTimeSeconds(
      stored.exam_task_type_default_time_seconds,
    );
  const storedExamTaskTypeDefaultsByUserId =
    normalizeExamTaskTypeDefaultsByUserId(
      stored.exam_task_type_defaults_by_user_id,
    );
  const needsExamTaskTypeDefaultsMigration =
    hasExactExamTaskTypeDefaults(
      storedExamTaskTypeDefaultPoints,
      EXAM_TASK_TYPE_LEGACY_PRESET_POINTS,
    ) &&
    hasExactExamTaskTypeDefaults(
      storedExamTaskTypeDefaultTimeSeconds,
      EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS,
    );
  const normalizedExamTaskTypeDefaultPoints = needsExamTaskTypeDefaultsMigration
    ? { ...DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS }
    : storedExamTaskTypeDefaultPoints;
  const normalizedExamTaskTypeDefaultTimeSeconds =
    needsExamTaskTypeDefaultsMigration
      ? { ...DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS }
      : storedExamTaskTypeDefaultTimeSeconds;
  const storedExamAutoCardsReturnOnCorrect =
    typeof stored.exam_auto_cards_return_on_correct === "boolean"
      ? stored.exam_auto_cards_return_on_correct
      : DEFAULT_EXAM_AUTO_CARDS_RETURN_ON_CORRECT;
  const storedExamGradeScale =
    stored.exam_grade_scale === "standard-1-6"
      ? stored.exam_grade_scale
      : DEFAULT_EXAM_GRADE_SCALE;
  const storedExamAiEvaluation = normalizeExamAiEvaluation(
    stored.exam_ai_evaluation,
  );
  const storedInputDebugEnabled =
    typeof stored.input_debug_enabled === "boolean"
      ? stored.input_debug_enabled
      : DEFAULT_INPUT_DEBUG_ENABLED;
  const storedInputDebugRedactContent =
    typeof stored.input_debug_redact_content === "boolean"
      ? stored.input_debug_redact_content
      : DEFAULT_INPUT_DEBUG_REDACT_CONTENT;
  const {
    settings: storedKeyboardShortcuts,
    needsMigration: needsKeyboardShortcutsMigration,
  } = normalizeKeyboardShortcuts(stored.keyboard_shortcuts);

  return {
    settings: {
      activeNotePath: storedActiveNotePath,
      vaultPath: stored.vault_path ?? null,
      recentVaults: storedRecentVaults,
      userVaultMode: storedUserVaultMode,
      userVaultCustomPath: storedUserVaultCustomPath,
      userVaultLastPath: storedUserVaultLastPath,
      userVaultSelectedAutoPath: storedUserVaultSelectedAutoPath,
      userVaultSelectedCustomPath: storedUserVaultSelectedCustomPath,
      theme: storedTheme,
      accentColor: resolvedAccent,
      markdownEditorAccentEnabled: storedMarkdownAccentEnabled,
      markdownEditorAccentLightHex: storedMarkdownAccentLightHex,
      markdownEditorAccentDarkHex: storedMarkdownAccentDarkHex,
      markdownEditorAccentCustomSwatches: storedMarkdownAccentCustomSwatches,
      editorBlueprintGrid: storedEditorBlueprintGrid,
      editorBlueprintGridIntensity: storedEditorBlueprintGridIntensity,
      cursorAccessoryEnabled: storedCursorAccessoryEnabled,
      markdownViewEditEnabled: storedMarkdownViewEditEnabled,
      markdownPreviewDefaultMode: storedMarkdownPreviewDefaultMode,
      examEditorShowMoveButtons: storedExamEditorShowMoveButtons,
      language: storedLanguage,
      maxFilesPerScan: storedMaxFilesPerScan,
      scanParallelism: storedScanParallelism,
      showHiddenFolders: storedShowHiddenFolders,
      showEmptyFolders: storedShowEmptyFolders,
      flashcardOrder: storedFlashcardOrder,
      flashcardMode: storedFlashcardMode,
      flashcardScope: storedFlashcardScope,
      flashcardPageSize: storedFlashcardPageSize,
      solutionRevealEnabled: storedSolutionRevealEnabled,
      statsResetMode: storedStatsResetMode,
      flashcardHelpEnabled: storedFlashcardHelpEnabled,
      fastFlashcardOrder: storedFastFlashcardOrder,
      fastFlashcardMode: storedFastFlashcardMode,
      fastFlashcardScope: storedFastFlashcardScope,
      fastFlashcardDuration: storedFastFlashcardDuration,
      fastFlashcardAutoTimeEnabled: storedFastFlashcardAutoTimeEnabled,
      fastFlashcardHelpEnabled: storedFastFlashcardHelpEnabled,
      examShowTimeline: storedExamShowTimeline,
      examHelpEnabled: storedExamHelpEnabled,
      spacedRepetitionBoxes: storedSpacedRepetitionBoxes,
      spacedRepetitionOrder: storedSpacedRepetitionOrder,
      spacedRepetitionPageSize: storedSpacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength: storedSpacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView: storedSpacedRepetitionStatsView,
      spacedRepetitionAutoTimeEnabled: storedSpacedRepetitionAutoTimeEnabled,
      spacedRepetitionHelpEnabled: storedSpacedRepetitionHelpEnabled,
      rightToolbarCollapsed: storedRightToolbarCollapsed,
      examMaxTotalPoints: storedExamMaxTotalPoints,
      examTaskCount: storedExamTaskCount,
      examTaskPoints: storedExamTaskPoints,
      examDurationMinutes: storedExamDurationMinutes,
      examTimeLimitEnabled: storedExamTimeLimitEnabled,
      examAutoCardsTypes: storedExamAutoCardsTypes,
      examTaskTypeDefaultPoints: normalizedExamTaskTypeDefaultPoints,
      examTaskTypeDefaultTimeSeconds: normalizedExamTaskTypeDefaultTimeSeconds,
      examTaskTypeDefaultsByUserId: storedExamTaskTypeDefaultsByUserId,
      examAutoCardsReturnOnCorrect: storedExamAutoCardsReturnOnCorrect,
      examGradeScale: storedExamGradeScale,
      examAiEvaluation: storedExamAiEvaluation,
      inputDebugEnabled: storedInputDebugEnabled,
      inputDebugRedactContent: storedInputDebugRedactContent,
      keyboardShortcuts: storedKeyboardShortcuts,
    },
    needsShowHiddenFoldersMigration,
    needsKeyboardShortcutsMigration,
    needsExamTaskTypeDefaultsMigration,
  };
};

export const useAppSettings = () => {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [markdownEditorAccentEnabled, setMarkdownEditorAccentEnabledState] =
    useState(DEFAULT_MARKDOWN_EDITOR_ACCENT_ENABLED);
  const [markdownEditorAccentLightHex, setMarkdownEditorAccentLightHexState] =
    useState(DEFAULT_ACCENT);
  const [markdownEditorAccentDarkHex, setMarkdownEditorAccentDarkHexState] =
    useState(DEFAULT_ACCENT);
  const [
    markdownEditorAccentCustomSwatches,
    setMarkdownEditorAccentCustomSwatchesState,
  ] = useState<string[]>([]);
  const [editorBlueprintGrid, setEditorBlueprintGrid] = useState(
    DEFAULT_EDITOR_BLUEPRINT_GRID,
  );
  const [editorBlueprintGridIntensity, setEditorBlueprintGridIntensity] =
    useState<EditorGridIntensity>(DEFAULT_EDITOR_BLUEPRINT_GRID_INTENSITY);
  const [cursorAccessoryEnabled, setCursorAccessoryEnabledState] = useState(
    DEFAULT_CURSOR_ACCESSORY_ENABLED,
  );
  const [markdownViewEditEnabled, setMarkdownViewEditEnabledState] = useState(
    DEFAULT_MARKDOWN_VIEW_EDIT_ENABLED,
  );
  const [markdownPreviewDefaultMode, setMarkdownPreviewDefaultModeState] =
    useState<MarkdownPreviewDefaultMode>(DEFAULT_MARKDOWN_PREVIEW_DEFAULT_MODE);
  const [examEditorShowMoveButtons, setExamEditorShowMoveButtonsState] =
    useState(DEFAULT_EXAM_EDITOR_SHOW_MOVE_BUTTONS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [userVaultProfilePath, setUserVaultProfilePath] = useState<string | null>(
    null,
  );
  const [userVaultProfileRevision, setUserVaultProfileRevision] = useState(0);
  const [userVaultProfileActiveUserId, setUserVaultProfileActiveUserId] = useState<
    string | null
  >(null);
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [recentVaults, setRecentVaults] = useState<RecentVaultEntry[]>([]);
  const [userVaultMode, setUserVaultModeState] = useState<UserVaultMode>(
    DEFAULT_USER_VAULT_MODE,
  );
  const [userVaultCustomPath, setUserVaultCustomPathState] = useState<
    string | null
  >(null);
  const [userVaultLastPath, setUserVaultLastPathState] = useState<string | null>(
    null,
  );
  const [userVaultSelectedAutoPath, setUserVaultSelectedAutoPathState] =
    useState<string | null>(null);
  const [userVaultSelectedCustomPath, setUserVaultSelectedCustomPathState] =
    useState<string | null>(null);
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
  const [showEmptyFolders, setShowEmptyFoldersState] = useState(
    DEFAULT_SHOW_EMPTY_FOLDERS,
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
  const [fastFlashcardAutoTimeEnabled, setFastFlashcardAutoTimeEnabledState] =
    useState(DEFAULT_FAST_FLASHCARD_AUTO_TIME_ENABLED);
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
  const [
    spacedRepetitionAutoTimeEnabled,
    setSpacedRepetitionAutoTimeEnabledState,
  ] = useState(DEFAULT_SPACED_REPETITION_AUTO_TIME_ENABLED);
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
  const [examAutoCardsTypes, setExamAutoCardsTypesState] = useState<
    AutoCardTypeMap
  >(() => ({ ...DEFAULT_EXAM_AUTO_CARDS_TYPES }));
  const [examTaskTypeDefaultPointsFallback, setExamTaskTypeDefaultPointsFallbackState] =
    useState<
      Record<AutoCardType, number>
    >(() => ({ ...DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS }));
  const [
    examTaskTypeDefaultTimeSecondsFallback,
    setExamTaskTypeDefaultTimeSecondsFallbackState,
  ] = useState<Record<AutoCardType, number>>(() => ({
    ...DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS,
  }));
  const [examTaskTypeDefaultsByUserId, setExamTaskTypeDefaultsByUserIdState] = useState<
    ExamTaskTypeDefaultsByUserId
  >({});
  const activeUserTaskTypeDefaults = userVaultProfileActiveUserId
    ? (examTaskTypeDefaultsByUserId[userVaultProfileActiveUserId] ?? null)
    : null;
  const examTaskTypeDefaultPoints: Record<AutoCardType, number> =
    activeUserTaskTypeDefaults?.points ?? examTaskTypeDefaultPointsFallback;
  const examTaskTypeDefaultTimeSeconds: Record<AutoCardType, number> =
    activeUserTaskTypeDefaults?.timeSeconds ?? examTaskTypeDefaultTimeSecondsFallback;
  const [examAutoCardsReturnOnCorrect, setExamAutoCardsReturnOnCorrectState] =
    useState(DEFAULT_EXAM_AUTO_CARDS_RETURN_ON_CORRECT);
  const [examGradeScale, setExamGradeScaleState] = useState<ExamGradeScale>(
    DEFAULT_EXAM_GRADE_SCALE,
  );
  const [examAiEvaluation, setExamAiEvaluationState] = useState<ExamAiEvaluation>(
    DEFAULT_EXAM_AI_EVALUATION,
  );
  const [inputDebugEnabled, setInputDebugEnabledState] = useState(
    DEFAULT_INPUT_DEBUG_ENABLED,
  );
  const [inputDebugRedactContent, setInputDebugRedactContentState] = useState(
    DEFAULT_INPUT_DEBUG_REDACT_CONTENT,
  );
  const [keyboardShortcuts, setKeyboardShortcutsState] =
    useState<KeyboardShortcutSettings>(DEFAULT_KEYBOARD_SHORTCUTS);
  const autoSaveReady = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);
  const needsShowHiddenFoldersMigration = useRef(false);
  const needsKeyboardShortcutsMigration = useRef(false);
  const needsExamTaskTypeDefaultsMigration = useRef(false);
  const lastProfileSyncRef = useRef<{ path: string; revision: number } | null>(
    null,
  );

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

  const setExamAutoCardsTypeEnabled = useCallback(
    (type: AutoCardType, value: boolean) => {
      setExamAutoCardsTypesState((prev) => ({
        ...prev,
        [type]: Boolean(value),
      }));
    },
    [],
  );

  const setExamTaskTypeDefaultPoint = useCallback(
    (type: AutoCardType, value: number) => {
      if (userVaultProfileActiveUserId) {
        setExamTaskTypeDefaultsByUserIdState((prev) => {
          const current = prev[userVaultProfileActiveUserId] ?? {
            points: { ...examTaskTypeDefaultPointsFallback },
            timeSeconds: { ...examTaskTypeDefaultTimeSecondsFallback },
          };
          return {
            ...prev,
            [userVaultProfileActiveUserId]: {
              points: {
                ...current.points,
                [type]: clampExamTaskTypeDefaultPoints(value, current.points[type]),
              },
              timeSeconds: { ...current.timeSeconds },
            },
          };
        });
        return;
      }
      setExamTaskTypeDefaultPointsFallbackState((prev) => ({
        ...prev,
        [type]: clampExamTaskTypeDefaultPoints(value, prev[type]),
      }));
    },
    [
      examTaskTypeDefaultPointsFallback,
      examTaskTypeDefaultTimeSecondsFallback,
      userVaultProfileActiveUserId,
    ],
  );

  const setExamTaskTypeDefaultTimeSeconds = useCallback(
    (type: AutoCardType, value: number) => {
      if (userVaultProfileActiveUserId) {
        setExamTaskTypeDefaultsByUserIdState((prev) => {
          const current = prev[userVaultProfileActiveUserId] ?? {
            points: { ...examTaskTypeDefaultPointsFallback },
            timeSeconds: { ...examTaskTypeDefaultTimeSecondsFallback },
          };
          return {
            ...prev,
            [userVaultProfileActiveUserId]: {
              points: { ...current.points },
              timeSeconds: {
                ...current.timeSeconds,
                [type]: clampExamTaskTypeDefaultPoints(value, current.timeSeconds[type]),
              },
            },
          };
        });
        return;
      }
      setExamTaskTypeDefaultTimeSecondsFallbackState((prev) => ({
        ...prev,
        [type]: clampExamTaskTypeDefaultPoints(value, prev[type]),
      }));
    },
    [
      examTaskTypeDefaultPointsFallback,
      examTaskTypeDefaultTimeSecondsFallback,
      userVaultProfileActiveUserId,
    ],
  );

  const resetExamTaskTypeDefaultPoints = useCallback(() => {
    if (userVaultProfileActiveUserId) {
      setExamTaskTypeDefaultsByUserIdState((prev) => {
        const current = prev[userVaultProfileActiveUserId] ?? {
          points: { ...examTaskTypeDefaultPointsFallback },
          timeSeconds: { ...examTaskTypeDefaultTimeSecondsFallback },
        };
        return {
          ...prev,
          [userVaultProfileActiveUserId]: {
            points: { ...EXAM_TASK_TYPE_LEGACY_PRESET_POINTS },
            timeSeconds: { ...current.timeSeconds },
          },
        };
      });
      return;
    }
    setExamTaskTypeDefaultPointsFallbackState({ ...EXAM_TASK_TYPE_LEGACY_PRESET_POINTS });
  }, [
    examTaskTypeDefaultPointsFallback,
    examTaskTypeDefaultTimeSecondsFallback,
    userVaultProfileActiveUserId,
  ]);

  const resetExamTaskTypeDefaultTimeSeconds = useCallback(() => {
    if (userVaultProfileActiveUserId) {
      setExamTaskTypeDefaultsByUserIdState((prev) => {
        const current = prev[userVaultProfileActiveUserId] ?? {
          points: { ...examTaskTypeDefaultPointsFallback },
          timeSeconds: { ...examTaskTypeDefaultTimeSecondsFallback },
        };
        return {
          ...prev,
          [userVaultProfileActiveUserId]: {
            points: { ...current.points },
            timeSeconds: { ...EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS },
          },
        };
      });
      return;
    }
    setExamTaskTypeDefaultTimeSecondsFallbackState({
      ...EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS,
    });
  }, [
    examTaskTypeDefaultPointsFallback,
    examTaskTypeDefaultTimeSecondsFallback,
    userVaultProfileActiveUserId,
  ]);

  const setExamAutoCardsReturnOnCorrect = useCallback((value: boolean) => {
    setExamAutoCardsReturnOnCorrectState(Boolean(value));
  }, []);

  const setExamAiEvaluation = useCallback((value: ExamAiEvaluation) => {
    setExamAiEvaluationState({
      enabled: Boolean(value?.enabled),
      provider: value?.provider === "shared-gpt" ? "shared-gpt" : null,
    });
  }, []);

  const setInputDebugEnabled = useCallback((value: boolean) => {
    setInputDebugEnabledState(Boolean(value));
  }, []);

  const setInputDebugRedactContent = useCallback((value: boolean) => {
    setInputDebugRedactContentState(Boolean(value));
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

  const setShowEmptyFolders = useCallback((value: boolean) => {
    setShowEmptyFoldersState(Boolean(value));
  }, []);

  const setUserVaultMode = useCallback((value: UserVaultMode) => {
    setUserVaultModeState(value);
  }, []);

  const setUserVaultCustomPath = useCallback((value: string | null) => {
    const next = value?.trim() ?? null;
    setUserVaultCustomPathState(next || null);
  }, []);

  const setUserVaultLastPath = useCallback((value: string | null) => {
    const next = value?.trim() ?? null;
    setUserVaultLastPathState(next || null);
  }, []);

  const setUserVaultSelectedAutoPath = useCallback((value: string | null) => {
    const next = value?.trim() ?? null;
    setUserVaultSelectedAutoPathState(next || null);
  }, []);

  const setUserVaultSelectedCustomPath = useCallback((value: string | null) => {
    const next = value?.trim() ?? null;
    setUserVaultSelectedCustomPathState(next || null);
  }, []);

  const setUserVaultProfileContext = useCallback(
    (
      path: string | null,
      revision: number,
      activeUserId: string | null = null,
    ) => {
      setUserVaultProfilePath(path);
      setUserVaultProfileRevision(revision);
      setUserVaultProfileActiveUserId(activeUserId?.trim() || null);
    },
    [],
  );

  const setFlashcardHelpEnabled = useCallback((value: boolean) => {
    setFlashcardHelpEnabledState(Boolean(value));
  }, []);

  const setFastFlashcardHelpEnabled = useCallback((value: boolean) => {
    setFastFlashcardHelpEnabledState(Boolean(value));
  }, []);

  const setFastFlashcardAutoTimeEnabled = useCallback((value: boolean) => {
    setFastFlashcardAutoTimeEnabledState(Boolean(value));
  }, []);

  const setExamHelpEnabled = useCallback((value: boolean) => {
    setExamHelpEnabledState(Boolean(value));
  }, []);

  const setExamEditorShowMoveButtons = useCallback((value: boolean) => {
    setExamEditorShowMoveButtonsState(Boolean(value));
  }, []);

  const setMarkdownEditorAccentEnabled = useCallback((value: boolean) => {
    setMarkdownEditorAccentEnabledState(Boolean(value));
  }, []);

  const setMarkdownEditorAccentHex = useCallback(
    (mode: "light" | "dark", value: string) => {
      const normalized = normalizeHex(value);
      if (!isValidHex(normalized)) {
        return;
      }
      if (mode === "dark") {
        setMarkdownEditorAccentDarkHexState(normalized);
      } else {
        setMarkdownEditorAccentLightHexState(normalized);
      }
    },
    [],
  );

  const setMarkdownEditorAccentCustomSwatches = useCallback(
    (value: string[]) => {
      setMarkdownEditorAccentCustomSwatchesState(
        normalizeMarkdownAccentSwatches(value),
      );
    },
    [],
  );

  const addMarkdownEditorAccentCustomSwatch = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value);
      if (!isValidHex(normalized)) {
        return;
      }
      setMarkdownEditorAccentCustomSwatchesState((prev) => {
        if (prev.includes(normalized)) {
          return prev;
        }
        const next = [normalized, ...prev];
        return normalizeMarkdownAccentSwatches(next);
      });
    },
    [],
  );

  const setMarkdownViewEditEnabled = useCallback((value: boolean) => {
    setMarkdownViewEditEnabledState(Boolean(value));
  }, []);

  const setCursorAccessoryEnabled = useCallback((value: boolean) => {
    setCursorAccessoryEnabledState(Boolean(value));
  }, []);

  const setMarkdownPreviewDefaultMode = useCallback(
    (value: MarkdownPreviewDefaultMode) => {
      setMarkdownPreviewDefaultModeState(value === "raw" ? "raw" : "markdown");
    },
    [],
  );

  const setSpacedRepetitionHelpEnabled = useCallback((value: boolean) => {
    setSpacedRepetitionHelpEnabledState(Boolean(value));
  }, []);

  const setSpacedRepetitionAutoTimeEnabled = useCallback((value: boolean) => {
    setSpacedRepetitionAutoTimeEnabledState(Boolean(value));
  }, []);

  const buildSettingsSnapshot = useCallback(
    (): SettingsSnapshot => ({
      activeNotePath,
      vaultPath,
      recentVaults,
      userVaultMode,
      userVaultCustomPath,
      userVaultLastPath,
      userVaultSelectedAutoPath,
      userVaultSelectedCustomPath,
      theme,
      accentColor,
      markdownEditorAccentEnabled,
      markdownEditorAccentLightHex,
      markdownEditorAccentDarkHex,
      markdownEditorAccentCustomSwatches,
      editorBlueprintGrid,
      editorBlueprintGridIntensity,
      cursorAccessoryEnabled,
      markdownViewEditEnabled,
      markdownPreviewDefaultMode,
      examEditorShowMoveButtons,
      language,
      maxFilesPerScan,
      scanParallelism,
      showHiddenFolders,
      showEmptyFolders,
      flashcardOrder,
      flashcardMode,
      flashcardScope,
      flashcardPageSize,
      solutionRevealEnabled,
      statsResetMode,
      flashcardHelpEnabled,
      fastFlashcardOrder,
      fastFlashcardMode,
      fastFlashcardScope,
      fastFlashcardDuration,
      fastFlashcardAutoTimeEnabled,
      fastFlashcardHelpEnabled,
      examShowTimeline,
      examHelpEnabled,
      spacedRepetitionBoxes,
      spacedRepetitionOrder,
      spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView,
      spacedRepetitionAutoTimeEnabled,
      spacedRepetitionHelpEnabled,
      rightToolbarCollapsed,
      examMaxTotalPoints,
      examTaskCount,
      examTaskPoints,
      examDurationMinutes,
      examTimeLimitEnabled,
      examAutoCardsTypes,
      examTaskTypeDefaultPoints: examTaskTypeDefaultPointsFallback,
      examTaskTypeDefaultTimeSeconds: examTaskTypeDefaultTimeSecondsFallback,
      examTaskTypeDefaultsByUserId,
      examAutoCardsReturnOnCorrect,
      examGradeScale,
      examAiEvaluation,
      inputDebugEnabled,
      inputDebugRedactContent,
      keyboardShortcuts,
    }),
    [
      accentColor,
      activeNotePath,
      markdownEditorAccentEnabled,
      markdownEditorAccentLightHex,
      markdownEditorAccentDarkHex,
      markdownEditorAccentCustomSwatches,
      editorBlueprintGrid,
      editorBlueprintGridIntensity,
      cursorAccessoryEnabled,
      markdownViewEditEnabled,
      markdownPreviewDefaultMode,
      examEditorShowMoveButtons,
      examAiEvaluation,
      examMaxTotalPoints,
      examTaskCount,
      examTaskPoints,
      examDurationMinutes,
      examTimeLimitEnabled,
      examAutoCardsTypes,
      examTaskTypeDefaultPointsFallback,
      examTaskTypeDefaultTimeSecondsFallback,
      examTaskTypeDefaultsByUserId,
      examAutoCardsReturnOnCorrect,
      examGradeScale,
      examHelpEnabled,
      inputDebugEnabled,
      inputDebugRedactContent,
      keyboardShortcuts,
      flashcardMode,
      flashcardOrder,
      fastFlashcardMode,
      fastFlashcardOrder,
      fastFlashcardScope,
      fastFlashcardDuration,
      fastFlashcardAutoTimeEnabled,
      fastFlashcardHelpEnabled,
      examShowTimeline,
      flashcardPageSize,
      flashcardScope,
      flashcardHelpEnabled,
      language,
      maxFilesPerScan,
      scanParallelism,
      showHiddenFolders,
      showEmptyFolders,
      solutionRevealEnabled,
      spacedRepetitionBoxes,
      spacedRepetitionHelpEnabled,
      spacedRepetitionOrder,
      spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView,
      spacedRepetitionAutoTimeEnabled,
      statsResetMode,
      theme,
      userVaultCustomPath,
      userVaultLastPath,
      userVaultSelectedAutoPath,
      userVaultSelectedCustomPath,
      userVaultMode,
      vaultPath,
      recentVaults,
      rightToolbarCollapsed,
    ],
  );

  const saveSettings = useCallback(
    async (settings: SettingsSnapshot) => {
      try {
        const profilePayload = buildProfileSettingsPayload(settings);
        if (userVaultProfilePath) {
          await saveUserVaultProfileSettings(userVaultProfilePath, profilePayload);
        }
        await invoke("save_app_settings", {
          activeNotePath: settings.activeNotePath,
          vaultPath: settings.vaultPath,
          recentVaults: settings.recentVaults,
          userVaultMode: settings.userVaultMode,
          userVaultCustomPath: settings.userVaultCustomPath,
          userVaultLastPath: settings.userVaultLastPath,
          userVaultSelectedAutoPath: settings.userVaultSelectedAutoPath,
          userVaultSelectedCustomPath: settings.userVaultSelectedCustomPath,
          theme: settings.theme,
          accentColor: settings.accentColor,
          editorMarkdownExactColorsEnabled: settings.markdownEditorAccentEnabled,
          markdownEditor: {
            accentColor: {
              lightHex: settings.markdownEditorAccentLightHex,
              darkHex: settings.markdownEditorAccentDarkHex,
              customSwatches: settings.markdownEditorAccentCustomSwatches,
            },
          },
          editorBlueprintGrid: settings.editorBlueprintGrid,
          editorBlueprintGridIntensity: settings.editorBlueprintGridIntensity,
          uiCursorAccessoryEnabled: settings.cursorAccessoryEnabled,
          editorMarkdownViewEditEnabled: settings.markdownViewEditEnabled,
          editorMarkdownPreviewDefaultMode: settings.markdownPreviewDefaultMode,
          examEditorShowMoveButtons: settings.examEditorShowMoveButtons,
          language: settings.language,
          maxFilesPerScan: settings.maxFilesPerScan,
          scanParallelism: settings.scanParallelism,
          showHiddenFolders: settings.showHiddenFolders,
          showEmptyFolders: settings.showEmptyFolders,
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
          fastFlashcardAutoTimeEnabled: settings.fastFlashcardAutoTimeEnabled,
          fastFlashcardHelpEnabled: settings.fastFlashcardHelpEnabled,
          examShowTimeline: settings.examShowTimeline,
          examHelpEnabled: settings.examHelpEnabled,
          spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
          spacedRepetitionOrder: settings.spacedRepetitionOrder,
          spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
          spacedRepetitionRepetitionStrength:
            settings.spacedRepetitionRepetitionStrength,
          spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
          spacedRepetitionAutoTimeEnabled: settings.spacedRepetitionAutoTimeEnabled,
          spacedRepetitionHelpEnabled: settings.spacedRepetitionHelpEnabled,
          rightToolbarCollapsed: settings.rightToolbarCollapsed,
          examMaxTotalPoints: settings.examMaxTotalPoints,
          examTaskCount: settings.examTaskCount,
          examTaskPoints: settings.examTaskPoints,
          examDurationMinutes: settings.examDurationMinutes,
          examTimeLimitEnabled: settings.examTimeLimitEnabled,
          examAutoCardsTypes: settings.examAutoCardsTypes,
          examTaskTypeDefaultPoints: settings.examTaskTypeDefaultPoints,
          examTaskTypeDefaultTimeSeconds: settings.examTaskTypeDefaultTimeSeconds,
          examAutoCardsReturnOnCorrect: settings.examAutoCardsReturnOnCorrect,
          examGradeScale: settings.examGradeScale,
          examAiEvaluation: settings.examAiEvaluation,
          inputDebugEnabled: settings.inputDebugEnabled,
          inputDebugRedactContent: settings.inputDebugRedactContent,
          keyboardShortcuts: settings.keyboardShortcuts,
        });
        return true;
      } catch (error) {
        console.error("Failed to save settings", error);
        return false;
      }
    },
    [userVaultProfilePath],
  );

  const persistSettings = useCallback(
    async (updates: PersistUpdates) => {
      if (!settingsLoaded) {
        return false;
      }
      const nextSettings = {
        activeNotePath: updates.activeNotePath ?? activeNotePath,
        vaultPath: updates.vaultPath ?? vaultPath,
        recentVaults: updates.recentVaults ?? recentVaults,
        userVaultMode: updates.userVaultMode ?? userVaultMode,
        userVaultCustomPath: updates.userVaultCustomPath ?? userVaultCustomPath,
        userVaultLastPath: updates.userVaultLastPath ?? userVaultLastPath,
        userVaultSelectedAutoPath:
          updates.userVaultSelectedAutoPath ?? userVaultSelectedAutoPath,
        userVaultSelectedCustomPath:
          updates.userVaultSelectedCustomPath ?? userVaultSelectedCustomPath,
        theme: updates.theme ?? theme,
        accentColor: updates.accentColor ?? accentColor,
        markdownEditorAccentEnabled:
          updates.markdownEditorAccentEnabled ?? markdownEditorAccentEnabled,
        markdownEditorAccentLightHex:
          updates.markdownEditorAccentLightHex ?? markdownEditorAccentLightHex,
        markdownEditorAccentDarkHex:
          updates.markdownEditorAccentDarkHex ?? markdownEditorAccentDarkHex,
        markdownEditorAccentCustomSwatches:
          updates.markdownEditorAccentCustomSwatches ??
          markdownEditorAccentCustomSwatches,
        editorBlueprintGrid: updates.editorBlueprintGrid ?? editorBlueprintGrid,
        editorBlueprintGridIntensity:
          updates.editorBlueprintGridIntensity ?? editorBlueprintGridIntensity,
        cursorAccessoryEnabled:
          updates.cursorAccessoryEnabled ?? cursorAccessoryEnabled,
        markdownViewEditEnabled:
          updates.markdownViewEditEnabled ?? markdownViewEditEnabled,
        markdownPreviewDefaultMode:
          updates.markdownPreviewDefaultMode ?? markdownPreviewDefaultMode,
        examEditorShowMoveButtons:
          updates.examEditorShowMoveButtons ?? examEditorShowMoveButtons,
        language: updates.language ?? language,
        maxFilesPerScan: updates.maxFilesPerScan ?? maxFilesPerScan,
        scanParallelism: updates.scanParallelism ?? scanParallelism,
        showHiddenFolders: updates.showHiddenFolders ?? showHiddenFolders,
        showEmptyFolders: updates.showEmptyFolders ?? showEmptyFolders,
        flashcardOrder: updates.flashcardOrder ?? flashcardOrder,
        flashcardMode: updates.flashcardMode ?? flashcardMode,
        flashcardScope: updates.flashcardScope ?? flashcardScope,
        fastFlashcardOrder: updates.fastFlashcardOrder ?? fastFlashcardOrder,
        fastFlashcardMode: updates.fastFlashcardMode ?? fastFlashcardMode,
        fastFlashcardScope: updates.fastFlashcardScope ?? fastFlashcardScope,
        fastFlashcardDuration:
          updates.fastFlashcardDuration ?? fastFlashcardDuration,
        fastFlashcardAutoTimeEnabled:
          updates.fastFlashcardAutoTimeEnabled ?? fastFlashcardAutoTimeEnabled,
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
        spacedRepetitionAutoTimeEnabled:
          updates.spacedRepetitionAutoTimeEnabled ??
          spacedRepetitionAutoTimeEnabled,
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
        examAutoCardsTypes: mergeExamAutoCardsTypes(
          examAutoCardsTypes,
          updates.examAutoCardsTypes,
        ),
        examTaskTypeDefaultPoints: mergeExamTaskTypeDefaultPoints(
          examTaskTypeDefaultPointsFallback,
          updates.examTaskTypeDefaultPoints,
        ),
        examTaskTypeDefaultTimeSeconds: mergeExamTaskTypeDefaultTimeSeconds(
          examTaskTypeDefaultTimeSecondsFallback,
          updates.examTaskTypeDefaultTimeSeconds,
        ),
        examTaskTypeDefaultsByUserId:
          updates.examTaskTypeDefaultsByUserId ?? examTaskTypeDefaultsByUserId,
        examAutoCardsReturnOnCorrect:
          updates.examAutoCardsReturnOnCorrect ?? examAutoCardsReturnOnCorrect,
        examGradeScale:
          updates.examGradeScale ?? examGradeScale,
        examAiEvaluation: updates.examAiEvaluation ?? examAiEvaluation,
        inputDebugEnabled: updates.inputDebugEnabled ?? inputDebugEnabled,
        inputDebugRedactContent:
          updates.inputDebugRedactContent ?? inputDebugRedactContent,
        keyboardShortcuts: updates.keyboardShortcuts ?? keyboardShortcuts,
      };
      const saved = await saveSettings(nextSettings);
      if (saved && "activeNotePath" in updates) {
        setActiveNotePath(nextSettings.activeNotePath ?? null);
      }
      if (saved && "vaultPath" in updates) {
        setVaultPath(nextSettings.vaultPath ?? null);
      }
      if (saved && "recentVaults" in updates) {
        setRecentVaults(nextSettings.recentVaults ?? []);
      }
      return saved;
    },
    [
      activeNotePath,
      accentColor,
      markdownEditorAccentEnabled,
      markdownEditorAccentLightHex,
      markdownEditorAccentDarkHex,
      markdownEditorAccentCustomSwatches,
      editorBlueprintGrid,
      editorBlueprintGridIntensity,
      cursorAccessoryEnabled,
      markdownViewEditEnabled,
      markdownPreviewDefaultMode,
      examEditorShowMoveButtons,
      examAiEvaluation,
      examGradeScale,
      inputDebugEnabled,
      inputDebugRedactContent,
      examMaxTotalPoints,
      examTaskCount,
      examTaskPoints,
      examDurationMinutes,
      examTimeLimitEnabled,
      examAutoCardsTypes,
      examTaskTypeDefaultPointsFallback,
      examTaskTypeDefaultTimeSecondsFallback,
      examTaskTypeDefaultsByUserId,
      examAutoCardsReturnOnCorrect,
      keyboardShortcuts,
      flashcardMode,
      flashcardOrder,
      fastFlashcardMode,
      fastFlashcardOrder,
      fastFlashcardScope,
      fastFlashcardDuration,
      fastFlashcardAutoTimeEnabled,
      fastFlashcardHelpEnabled,
      flashcardPageSize,
      flashcardScope,
      flashcardHelpEnabled,
      language,
      maxFilesPerScan,
      saveSettings,
      scanParallelism,
      showHiddenFolders,
      showEmptyFolders,
      settingsLoaded,
      solutionRevealEnabled,
      examHelpEnabled,
      spacedRepetitionBoxes,
      spacedRepetitionHelpEnabled,
      spacedRepetitionOrder,
      spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView,
      spacedRepetitionAutoTimeEnabled,
      statsResetMode,
      theme,
      userVaultCustomPath,
      userVaultLastPath,
      userVaultSelectedAutoPath,
      userVaultSelectedCustomPath,
      userVaultMode,
      vaultPath,
      recentVaults,
      rightToolbarCollapsed,
    ],
  );

  const applyStoredSettings = useCallback((settings: AppSettings) => {
    const {
      settings: normalized,
      needsShowHiddenFoldersMigration: shouldMigrateShowHiddenFolders,
      needsKeyboardShortcutsMigration: shouldMigrateShortcuts,
      needsExamTaskTypeDefaultsMigration: shouldMigrateExamTaskTypeDefaults,
    } = normalizeSettings(settings);

    if (shouldMigrateShowHiddenFolders) {
      needsShowHiddenFoldersMigration.current = true;
    }
    if (shouldMigrateShortcuts) {
      needsKeyboardShortcutsMigration.current = true;
    }
    if (shouldMigrateExamTaskTypeDefaults) {
      needsExamTaskTypeDefaultsMigration.current = true;
    }

    setTheme(normalized.theme);
    setAccentColor(normalized.accentColor);
    setAccentDraft(normalized.accentColor);
    setAccentError("");
    setMarkdownEditorAccentEnabledState(normalized.markdownEditorAccentEnabled);
    setMarkdownEditorAccentLightHexState(normalized.markdownEditorAccentLightHex);
    setMarkdownEditorAccentDarkHexState(normalized.markdownEditorAccentDarkHex);
    setMarkdownEditorAccentCustomSwatchesState(
      normalized.markdownEditorAccentCustomSwatches,
    );
    setEditorBlueprintGrid(normalized.editorBlueprintGrid);
    setEditorBlueprintGridIntensity(normalized.editorBlueprintGridIntensity);
    setCursorAccessoryEnabledState(normalized.cursorAccessoryEnabled);
    setMarkdownViewEditEnabledState(normalized.markdownViewEditEnabled);
    setMarkdownPreviewDefaultModeState(normalized.markdownPreviewDefaultMode);
    setExamEditorShowMoveButtonsState(normalized.examEditorShowMoveButtons);
    setActiveNotePath(normalized.activeNotePath);
    setVaultPath(normalized.vaultPath);
    setRecentVaults(normalized.recentVaults);
    setUserVaultModeState(normalized.userVaultMode);
    setUserVaultCustomPathState(normalized.userVaultCustomPath);
    setUserVaultLastPathState(normalized.userVaultLastPath);
    setUserVaultSelectedAutoPathState(normalized.userVaultSelectedAutoPath);
    setUserVaultSelectedCustomPathState(normalized.userVaultSelectedCustomPath);
    setLanguage(normalized.language);
    setMaxFilesPerScan(normalized.maxFilesPerScan);
    setScanParallelism(normalized.scanParallelism);
    setShowHiddenFoldersState(normalized.showHiddenFolders);
    setShowEmptyFoldersState(normalized.showEmptyFolders);
    setFlashcardOrder(normalized.flashcardOrder);
    setFlashcardMode(normalized.flashcardMode);
    setFlashcardScope(normalized.flashcardScope);
    setFastFlashcardOrder(normalized.fastFlashcardOrder);
    setFastFlashcardMode(normalized.fastFlashcardMode);
    setFastFlashcardScope(normalized.fastFlashcardScope);
    setFastFlashcardDuration(normalized.fastFlashcardDuration);
    setFastFlashcardAutoTimeEnabledState(normalized.fastFlashcardAutoTimeEnabled);
    setFastFlashcardHelpEnabledState(normalized.fastFlashcardHelpEnabled);
    setExamShowTimelineState(normalized.examShowTimeline);
    setExamHelpEnabledState(normalized.examHelpEnabled);
    setFlashcardPageSize(normalized.flashcardPageSize);
    setSolutionRevealEnabled(normalized.solutionRevealEnabled);
    setStatsResetMode(normalized.statsResetMode);
    setFlashcardHelpEnabledState(normalized.flashcardHelpEnabled);
    setSpacedRepetitionBoxes(normalized.spacedRepetitionBoxes);
    setSpacedRepetitionOrder(normalized.spacedRepetitionOrder);
    setSpacedRepetitionPageSize(normalized.spacedRepetitionPageSize);
    setSpacedRepetitionRepetitionStrength(
      normalized.spacedRepetitionRepetitionStrength,
    );
    setSpacedRepetitionStatsView(normalized.spacedRepetitionStatsView);
    setSpacedRepetitionAutoTimeEnabledState(
      normalized.spacedRepetitionAutoTimeEnabled,
    );
    setSpacedRepetitionHelpEnabledState(normalized.spacedRepetitionHelpEnabled);
    setRightToolbarCollapsed(normalized.rightToolbarCollapsed);
    setExamMaxTotalPointsState(normalized.examMaxTotalPoints);
    setExamTaskCountState(normalized.examTaskCount);
    setExamTaskPointsState(normalized.examTaskPoints);
    setExamDurationMinutesState(normalized.examDurationMinutes);
    setExamTimeLimitEnabledState(normalized.examTimeLimitEnabled);
    setExamAutoCardsTypesState(normalized.examAutoCardsTypes);
    setExamTaskTypeDefaultPointsFallbackState(normalized.examTaskTypeDefaultPoints);
    setExamTaskTypeDefaultTimeSecondsFallbackState(
      normalized.examTaskTypeDefaultTimeSeconds,
    );
    setExamTaskTypeDefaultsByUserIdState(normalized.examTaskTypeDefaultsByUserId);
    setExamAutoCardsReturnOnCorrectState(normalized.examAutoCardsReturnOnCorrect);
    setExamGradeScaleState(normalized.examGradeScale);
    setExamAiEvaluationState(normalized.examAiEvaluation);
    setInputDebugEnabledState(normalized.inputDebugEnabled);
    setInputDebugRedactContentState(normalized.inputDebugRedactContent);
    setKeyboardShortcutsState(normalized.keyboardShortcuts);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("load_app_settings");
        if (cancelled) {
          return;
        }
        applyStoredSettings(settings);
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
    if (!settingsLoaded || !userVaultProfilePath) {
      lastProfileSyncRef.current = null;
      return;
    }
    const lastSync = lastProfileSyncRef.current;
    if (
      lastSync &&
      lastSync.path === userVaultProfilePath &&
      lastSync.revision === userVaultProfileRevision
    ) {
      return;
    }
    lastProfileSyncRef.current = {
      path: userVaultProfilePath,
      revision: userVaultProfileRevision,
    };
    let cancelled = false;

    const restoreProfileSettings = async () => {
      const stored = await loadUserVaultProfileSettings(userVaultProfilePath);
      if (cancelled) {
        return;
      }
      if (stored) {
        const sanitized = {
          ...(stored as AppSettings),
          user_vault_mode: userVaultMode,
          user_vault_custom_path: userVaultCustomPath,
          user_vault_last_path: userVaultLastPath,
          user_vault_selected_auto_path: userVaultSelectedAutoPath,
          user_vault_selected_custom_path: userVaultSelectedCustomPath,
        };
        applyStoredSettings(sanitized);
        return;
      }
      const snapshot = buildSettingsSnapshot();
      const payload = buildProfileSettingsPayload(snapshot);
      await saveUserVaultProfileSettings(userVaultProfilePath, payload);
    };

    void restoreProfileSettings();

    return () => {
      cancelled = true;
    };
  }, [
    applyStoredSettings,
    buildSettingsSnapshot,
    settingsLoaded,
    userVaultCustomPath,
    userVaultLastPath,
    userVaultMode,
    userVaultSelectedAutoPath,
    userVaultSelectedCustomPath,
    userVaultProfilePath,
    userVaultProfileRevision,
  ]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

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
    if (!settingsLoaded || !needsExamTaskTypeDefaultsMigration.current) {
      return;
    }
    needsExamTaskTypeDefaultsMigration.current = false;
    void persistSettings({
      examTaskTypeDefaultPoints: examTaskTypeDefaultPointsFallback,
      examTaskTypeDefaultTimeSeconds: examTaskTypeDefaultTimeSecondsFallback,
    });
  }, [
    examTaskTypeDefaultPointsFallback,
    examTaskTypeDefaultTimeSecondsFallback,
    persistSettings,
    settingsLoaded,
  ]);

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
    const snapshot = buildSettingsSnapshot();
    autoSaveTimer.current = window.setTimeout(() => {
      void saveSettings(snapshot);
    }, 300);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [buildSettingsSnapshot, saveSettings, settingsLoaded]);

  return {
    accentColor,
    activeNotePath,
    accentDraft,
    accentError,
    markdownEditorAccentEnabled,
    markdownEditorAccentLightHex,
    markdownEditorAccentDarkHex,
    markdownEditorAccentCustomSwatches,
    editorBlueprintGrid,
    editorBlueprintGridIntensity,
    cursorAccessoryEnabled,
    markdownViewEditEnabled,
    markdownPreviewDefaultMode,
    examEditorShowMoveButtons,
    examAiEvaluation,
    inputDebugEnabled,
    inputDebugRedactContent,
    examMaxTotalPoints,
    examTaskCount,
    examTaskPoints,
    examDurationMinutes,
    examTimeLimitEnabled,
    examAutoCardsTypes,
    examTaskTypeDefaultPoints,
    examTaskTypeDefaultTimeSeconds,
    examAutoCardsReturnOnCorrect,
    examGradeScale,
    flashcardMode,
    flashcardOrder,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    fastFlashcardDuration,
    fastFlashcardAutoTimeEnabled,
    fastFlashcardHelpEnabled,
    examShowTimeline,
    examHelpEnabled,
    flashcardPageSize,
    flashcardScope,
    keyboardShortcuts,
    showHiddenFolders,
    showEmptyFolders,
    language,
    maxFilesPerScan,
    persistSettings,
    scanParallelism,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    setMarkdownEditorAccentEnabled,
    setMarkdownEditorAccentHex,
    setMarkdownEditorAccentCustomSwatches,
    addMarkdownEditorAccentCustomSwatch,
    setEditorBlueprintGrid,
    setEditorBlueprintGridIntensity,
    setCursorAccessoryEnabled,
    setMarkdownViewEditEnabled,
    setMarkdownPreviewDefaultMode,
    setExamEditorShowMoveButtons,
    setExamAiEvaluation,
    setInputDebugEnabled,
    setInputDebugRedactContent,
    setExamMaxTotalPoints,
    setExamTaskCount,
    setExamTaskPoints,
    setExamDurationMinutes,
    setExamTimeLimitEnabled,
    setExamAutoCardsTypeEnabled,
    setExamTaskTypeDefaultPoint,
    setExamTaskTypeDefaultTimeSeconds,
    resetExamTaskTypeDefaultPoints,
    resetExamTaskTypeDefaultTimeSeconds,
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
    setFastFlashcardAutoTimeEnabled,
    setFastFlashcardHelpEnabled,
    setExamShowTimeline,
    setExamHelpEnabled,
    setKeyboardShortcuts,
    setKeyboardShortcutBinding,
    resetKeyboardShortcuts,
    setShowHiddenFolders,
    setShowEmptyFolders,
    setUserVaultCustomPath,
    setUserVaultMode,
    setUserVaultLastPath,
    setUserVaultSelectedAutoPath,
    setUserVaultSelectedCustomPath,
    setUserVaultProfileContext,
    setLanguage,
    setMaxFilesPerScan,
    setRightToolbarCollapsed,
    setScanParallelism,
    setSolutionRevealEnabled,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionAutoTimeEnabled,
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
    spacedRepetitionAutoTimeEnabled,
    spacedRepetitionHelpEnabled,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    userVaultCustomPath,
    userVaultMode,
    userVaultLastPath,
    userVaultSelectedAutoPath,
    userVaultSelectedCustomPath,
    vaultPath,
    recentVaults,
    rightToolbarCollapsed,
  };
};
