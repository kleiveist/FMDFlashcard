/**
 * @file apps/fmd-desktop/src/components/AppStateProvider.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente App State Provider.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/color.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/lib/path.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/lib/theme.ts: Typen.
 *
 * Exportiert:
 * - AppStateProvider: React-Komponente.
 * - useAppState: Hook fuer /.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { isValidHex, normalizeHex } from "../lib/color";
import { asErrorMessage } from "../lib/errors";
import {
  applyTaskAreaToggle,
  buildTaskMutationScopeKey,
  type TaskMutationScope,
} from "../lib/taskAreaToggle";
import { isHiddenPath, normalizeRelativePath, normalizeVaultPath } from "../lib/path";
import { type DesignMode, type ThemeMode } from "../lib/theme";
import { type VaultFile } from "../lib/tree";
import type { LoadState } from "../lib/types";
import { useFlashcards } from "../features/flashcards/useFlashcards";
import { useFlashcardNoteFiles } from "../features/flashcards/useFlashcardNoteFiles";
import {
  usePreview,
  type PreviewFileOpenOptions,
} from "../features/preview/usePreview";
import {
  buildRecentVaultId,
  createRecentVaultEntry,
  useAppSettings,
  type RecentVaultEntry,
} from "../features/settings/useAppSettings";
import { type SettingsPageId } from "../features/settings/settingsNavigation";
import { useSpacedRepetition } from "../features/spaced-repetition/useSpacedRepetition";
import { useUserVault } from "../features/user-vault/useUserVault";
import { useVault } from "../features/vault/useVault";
import { useExamFiles } from "../features/exam/useExamFiles";
import type { ExamFileEntry } from "../features/exam/types";
import { useExamPointsProfiles } from "../features/exam-points/useExamPointsProfiles";
import {
  areExamSelectionRowsEqual,
  buildExamSelectionRowsFromPaths,
  flattenExamSelectionRows,
  moveExamSelectionPathBeforeTarget,
  normalizeExamSelectionRows,
  placeExamSelectionPath,
  toggleExamSelectionPath,
  type ExamSelectionPlacementTarget,
  type ExamSelectionRows,
} from "../lib/examSelectionRows";
import {
  addTaskWrapper,
  findTaskWrapper,
  removeTaskWrapper,
} from "../lib/exam/autoCards";
import { LargeVaultWarningModal } from "./LargeVaultWarningModal";
import { VaultManagerModal } from "./VaultManagerModal";
import { DEFAULT_HELP_TOPIC_ID } from "../pages/help/helpContent";

type AppActions = {
  handlePickVault: () => Promise<boolean>;
  handleSwitchVault: (path: string) => Promise<boolean>;
  handleRemoveRecentVault: (path: string) => void;
  handleOpenVaultManager: () => void;
  handleClearVault: () => void;
  handleSelectFile: (file: VaultFile, options?: PreviewFileOpenOptions) => void;
  handleToggleExamFileSelection: (path: string) => void;
  handleSetSelectedExamFiles: (paths: string[]) => void;
  handleSetSelectedExamFileRows: (rows: ExamSelectionRows) => void;
  handlePlaceSelectedExamFile: (
    sourcePath: string,
    target: ExamSelectionPlacementTarget,
  ) => void;
  handleMoveSelectedExamFile: (sourcePath: string, targetPath: string) => void;
  handleClearSelectedExamFiles: () => void;
  handleThemeChange: (nextTheme: ThemeMode) => void;
  handleDesignModeChange: (nextMode: DesignMode) => void;
  handleAccentPick: (value: string) => void;
  handleAccentInputChange: (value: string) => void;
  handleCopyAccent: () => Promise<void>;
  handleCopyVaultPath: () => Promise<void>;
  stageTaskAreaToggle: (scope: TaskMutationScope, nextEnabled: boolean) => void;
  getStagedTaskAreaToggle: (scope: TaskMutationScope) => boolean | null;
  getTaskAreaToggleNotice: (scope: TaskMutationScope) => string;
  flushPendingTaskAreaToggles: (trigger?: string) => Promise<boolean>;
  handleRescanVault: (source?: string) => Promise<boolean>;
  handleResetIndex: () => void;
  handleMaxFilesPerScanChange: (value: string) => void;
};

type AppState = {
  actions: AppActions;
  flashcards: ReturnType<typeof useFlashcards>;
  fastFlashcards: ReturnType<typeof useFlashcards>;
  examFiles: ExamFileEntry[];
  examFilesState: LoadState;
  examFilesError: string;
  selectedExamFileRows: ExamSelectionRows;
  selectedExamFilePaths: string[];
  flashcardNoteFiles: ReturnType<typeof useFlashcards>["flashcardFiles"];
  flashcardNoteFilesState: LoadState;
  flashcardNoteFilesError: string;
  help: {
    activeTopicId: string;
    setActiveTopicId: (value: string) => void;
  };
  settingsNav: {
    activeSettingsPage: SettingsPageId;
    setActiveSettingsPage: (value: SettingsPageId) => void;
  };
  pointsProfiles: ReturnType<typeof useExamPointsProfiles>;
  preview: ReturnType<typeof usePreview>;
  settings: ReturnType<typeof useAppSettings>;
  spacedRepetition: ReturnType<typeof useSpacedRepetition>;
  userVault: ReturnType<typeof useUserVault>;
  vault: ReturnType<typeof useVault> & {
    activeFolderPath: string | null;
    setActiveFolderPath: (value: string | null) => void;
  };
};

const AppStateContext = createContext<AppState | null>(null);

const countMarkdownFiles = (files: VaultFile[], showHiddenFolders: boolean) =>
  files.reduce((count, file) => {
    const relativePath = normalizeRelativePath(file.relative_path);
    if (!showHiddenFolders && isHiddenPath(relativePath)) {
      return count;
    }
    if (relativePath.toLowerCase().endsWith(".md")) {
      return count + 1;
    }
    return count;
  }, 0);

const parseVaultWarningThreshold = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const MAX_RECENT_VAULTS = 10;

type StagedTaskAreaToggle = {
  scope: TaskMutationScope;
  nextEnabled: boolean;
  stagedAt: number;
};

type VaultPathInfo = {
  exists: boolean;
  isDir: boolean;
};

type VaultRecheckResult = {
  vaultId: string;
  path: string | null;
  available: boolean;
  loaded: boolean;
  lastError: string | null;
  message: string;
};

const describeMissingVaultPath = (info: VaultPathInfo) =>
  info.exists ? "Pfad ist kein Ordner." : "Pfad existiert nicht.";

const removeRecordKeys = <T,>(map: Record<string, T>, keys: string[]) => {
  if (keys.length === 0) {
    return map;
  }
  let changed = false;
  const next = { ...map };
  keys.forEach((key) => {
    if (key in next) {
      delete next[key];
      changed = true;
    }
  });
  return changed ? next : map;
};

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const settings = useAppSettings();
  const [activeHelpTopicId, setActiveHelpTopicId] = useState<string>(
    DEFAULT_HELP_TOPIC_ID,
  );
  const [activeFolderPath, setActiveFolderPathState] = useState<string | null>(
    null,
  );
  const [largeVaultWarningCount, setLargeVaultWarningCount] = useState<
    number | null
  >(null);
  const [isVaultManagerOpen, setIsVaultManagerOpen] = useState(false);
  const [activeSettingsPage, setActiveSettingsPage] =
    useState<SettingsPageId>("appearance");
  const [selectedExamFileRows, setSelectedExamFileRows] = useState<ExamSelectionRows>(
    [],
  );
  const [stagedTaskAreaTogglesByKey, setStagedTaskAreaTogglesByKey] = useState<
    Record<string, StagedTaskAreaToggle>
  >({});
  const [taskAreaToggleNoticeByKey, setTaskAreaToggleNoticeByKey] = useState<
    Record<string, string>
  >({});
  const {
    activeNotePath,
    accentColor,
    persistSettings,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    showHiddenFolders,
    maxFilesPerScan,
    setMaxFilesPerScan,
    setTheme,
    setDesignMode,
    settingsLoaded,
    vaultPath: storedVaultPath,
    recentVaults,
    flashcardMode,
    flashcardOrder,
    flashcardPageSize,
    flashcardScope,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    setFastFlashcardMode,
    setFastFlashcardOrder,
    setFastFlashcardScope,
    setSolutionRevealEnabled,
    setStatsResetMode,
    setUserVaultProfileContext,
    solutionRevealEnabled,
    statsResetMode,
  } = settings;
  const vault = useVault({ persistSettings, showHiddenFolders });
  const userVault = useUserVault({
    vaultPath: vault.vaultPath,
    mode: settings.userVaultMode,
    setMode: settings.setUserVaultMode,
    customPath: settings.userVaultCustomPath,
    setCustomPath: settings.setUserVaultCustomPath,
  });
  const legacyPointsDefaults = useMemo(
    () => ({
      durationMinutes: settings.examDurationMinutes,
      maxTotalPoints: settings.examMaxTotalPoints,
      taskCount: settings.examTaskCount,
      taskPoints: settings.examTaskPoints,
    }),
    [
      settings.examDurationMinutes,
      settings.examMaxTotalPoints,
      settings.examTaskCount,
      settings.examTaskPoints,
    ],
  );
  const pointsProfiles = useExamPointsProfiles({
    profilePath: userVault.activeProfilePath,
    profileRevision: userVault.revision,
    legacyDefaults: legacyPointsDefaults,
  });
  const handleBeforeUserAction = useCallback(
    async (reason: string) => {
      const result = await userVault.bootstrapProfileContext(reason);
      return result.ok && Boolean(result.activeProfileId);
    },
    [userVault.bootstrapProfileContext],
  );
  const preview = usePreview();
  const flashcards = useFlashcards({
    files: vault.files,
    preview: preview.preview,
    selectedFile: preview.selectedFile,
    vaultPath: vault.vaultPath,
    settings: {
      flashcardMode,
      flashcardOrder,
      flashcardPageSize,
      flashcardScope,
      setFlashcardMode,
      setFlashcardOrder,
      setFlashcardPageSize,
      setFlashcardScope,
      setSolutionRevealEnabled,
      setStatsResetMode,
      solutionRevealEnabled,
      statsResetMode,
    },
  });
  const fastFlashcards = useFlashcards({
    files: vault.files,
    preview: preview.preview,
    selectedFile: preview.selectedFile,
    vaultPath: vault.vaultPath,
    settings: {
      flashcardMode: fastFlashcardMode,
      flashcardOrder: fastFlashcardOrder,
      flashcardPageSize,
      flashcardScope: fastFlashcardScope,
      setFlashcardMode: setFastFlashcardMode,
      setFlashcardOrder: setFastFlashcardOrder,
      setFlashcardPageSize,
      setFlashcardScope: setFastFlashcardScope,
      setSolutionRevealEnabled,
      setStatsResetMode,
      solutionRevealEnabled,
      statsResetMode,
    },
  });
  const { examFiles, examFilesState, examFilesError } = useExamFiles({
    files: vault.files,
    vaultPath: vault.vaultPath,
  });
  const examFilePathSet = useMemo(
    () => new Set(examFiles.map((file) => file.path)),
    [examFiles],
  );
  const selectedExamFilePaths = useMemo(
    () => flattenExamSelectionRows(selectedExamFileRows),
    [selectedExamFileRows],
  );
  const normalizeSelectedExamFileRows = useCallback(
    (rows: ExamSelectionRows) =>
      normalizeExamSelectionRows(rows, {
        validPaths: examFilePathSet,
      }),
    [examFilePathSet],
  );
  const normalizeSelectedExamFiles = useCallback(
    (paths: string[]) =>
      buildExamSelectionRowsFromPaths(paths, {
        validPaths: examFilePathSet,
      }),
    [examFilePathSet],
  );
  const handleSetSelectedExamFiles = useCallback(
    (paths: string[]) => {
      setSelectedExamFileRows(normalizeSelectedExamFiles(paths));
    },
    [normalizeSelectedExamFiles],
  );
  const handleSetSelectedExamFileRows = useCallback(
    (rows: ExamSelectionRows) => {
      setSelectedExamFileRows(normalizeSelectedExamFileRows(rows));
    },
    [normalizeSelectedExamFileRows],
  );
  const handleToggleExamFileSelection = useCallback(
    (path: string) => {
      if (!examFilePathSet.has(path)) {
        return;
      }
      setSelectedExamFileRows((previous) =>
        toggleExamSelectionPath(previous, path, { validPaths: examFilePathSet }),
      );
    },
    [examFilePathSet],
  );
  const handlePlaceSelectedExamFile = useCallback(
    (sourcePath: string, target: ExamSelectionPlacementTarget) => {
      setSelectedExamFileRows((previous) =>
        placeExamSelectionPath(previous, sourcePath, target, {
          validPaths: examFilePathSet,
        }),
      );
    },
    [examFilePathSet],
  );
  const handleMoveSelectedExamFile = useCallback(
    (sourcePath: string, targetPath: string) => {
      if (!sourcePath || !targetPath || sourcePath === targetPath) {
        return;
      }
      setSelectedExamFileRows((previous) =>
        moveExamSelectionPathBeforeTarget(previous, sourcePath, targetPath, {
          validPaths: examFilePathSet,
        }),
      );
    },
    [examFilePathSet],
  );
  const handleClearSelectedExamFiles = useCallback(() => {
    setSelectedExamFileRows([]);
  }, []);

  useEffect(() => {
    setSelectedExamFileRows((previous) => {
      const next = normalizeSelectedExamFileRows(previous);
      return areExamSelectionRowsEqual(next, previous) ? previous : next;
    });
  }, [normalizeSelectedExamFileRows]);
  const {
    noteFiles: flashcardNoteFiles,
    noteFilesState: flashcardNoteFilesState,
    noteFilesError: flashcardNoteFilesError,
  } = useFlashcardNoteFiles({
    files: vault.files,
    vaultPath: vault.vaultPath,
  });
  const spacedRepetition = useSpacedRepetition({
    isFlashcardScanning: flashcards.isFlashcardScanning,
    scanFlashcardEntries: flashcards.scanFlashcardEntries,
    setIsFlashcardScanning: flashcards.setIsFlashcardScanning,
    beforeUserAction: handleBeforeUserAction,
    userVaultProfilePath: userVault.activeProfilePath,
    userVaultRevision: userVault.revision,
    userVaultMode: userVault.mode,
    vaultPath: vault.vaultPath,
    settings: {
      setSpacedRepetitionBoxes: settings.setSpacedRepetitionBoxes,
      setSpacedRepetitionOrder: settings.setSpacedRepetitionOrder,
      setSpacedRepetitionPageSize: settings.setSpacedRepetitionPageSize,
      setSpacedRepetitionRepetitionStrength:
        settings.setSpacedRepetitionRepetitionStrength,
      setSpacedRepetitionStatsView: settings.setSpacedRepetitionStatsView,
      spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
      spacedRepetitionOrder: settings.spacedRepetitionOrder,
      spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength:
        settings.spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
    },
  });
  useEffect(() => {
    setUserVaultProfileContext(
      userVault.activeProfilePath,
      userVault.revision,
      spacedRepetition.spacedRepetitionActiveUserId,
    );
  }, [
    setUserVaultProfileContext,
    spacedRepetition.spacedRepetitionActiveUserId,
    userVault.activeProfilePath,
    userVault.revision,
  ]);
  const hasRestoredVault = useRef(false);
  const lastRecentVaultRef = useRef<string | null>(null);
  const isRestoringActiveNote = useRef(false);
  const hasResolvedActiveNote = useRef(false);
  const {
    loadVault,
    pickVault,
    rescanVault,
    restoreSnapshot: restoreVaultSnapshot,
    listState,
    setFiles,
    setPngAssets,
    setListError,
    setLastRefreshAt,
    setListState,
    setVaultPath,
    takeSnapshot: takeVaultSnapshot,
    vaultPath,
  } = vault;
  const {
    resetPreview,
    restoreSnapshot: restorePreviewSnapshot,
    selectFile,
    setPreviewError,
    takeSnapshot: takePreviewSnapshot,
  } = preview;
  const {
    resetFlashcards,
    restoreSnapshot: restoreFlashcardsSnapshot,
    takeSnapshot: takeFlashcardsSnapshot,
  } = flashcards;
  const { resetFlashcards: resetFastFlashcards } = fastFlashcards;
  const autoRecheckRunningRef = useRef(false);

  const activeVaultEntry = useMemo(() => {
    const normalizedActivePath = normalizeVaultPath(vaultPath ?? "");
    if (!normalizedActivePath) {
      return null;
    }
    return (
      recentVaults.find(
        (entry) => normalizeVaultPath(entry.path) === normalizedActivePath,
      ) ?? null
    );
  }, [recentVaults, vaultPath]);

  const persistRecentVaultRegistry = useCallback(
    async (entries: RecentVaultEntry[]) => {
      if (!settingsLoaded) {
        return false;
      }
      return persistSettings({
        recentVaults: entries.slice(0, MAX_RECENT_VAULTS),
      });
    },
    [persistSettings, settingsLoaded],
  );

  const updateRecentVaultEntry = useCallback(
    async (vaultId: string, updates: Partial<RecentVaultEntry>) => {
      const index = recentVaults.findIndex((entry) => entry.id === vaultId);
      if (index < 0) {
        return null;
      }
      const current = recentVaults[index];
      const nextEntry = createRecentVaultEntry(updates.path ?? current.path, {
        ...current,
        ...updates,
        id: current.id,
        lastOpenedAt: updates.lastOpenedAt ?? current.lastOpenedAt,
        status: updates.status ?? current.status,
        lastSeenAt:
          typeof updates.lastSeenAt === "undefined"
            ? current.lastSeenAt
            : updates.lastSeenAt,
        lastError:
          typeof updates.lastError === "undefined"
            ? current.lastError ?? null
            : updates.lastError,
      });
      const unchanged =
        current.path === nextEntry.path &&
        current.lastOpenedAt === nextEntry.lastOpenedAt &&
        current.status === nextEntry.status &&
        current.lastSeenAt === nextEntry.lastSeenAt &&
        (current.lastError ?? null) === (nextEntry.lastError ?? null);
      if (unchanged) {
        return current;
      }
      const nextPathKey = normalizeVaultPath(nextEntry.path);
      const next = recentVaults.reduce<RecentVaultEntry[]>((acc, entry, entryIndex) => {
        if (entryIndex === index) {
          acc.push(nextEntry);
          return acc;
        }
        if (entry.id === nextEntry.id) {
          return acc;
        }
        if (nextPathKey && normalizeVaultPath(entry.path) === nextPathKey) {
          return acc;
        }
        acc.push(entry);
        return acc;
      }, []);
      await persistRecentVaultRegistry(next);
      return nextEntry;
    },
    [persistRecentVaultRegistry, recentVaults],
  );

  const markRecentVaultAvailable = useCallback(
    async (path: string) => {
      const normalizedPath = normalizeVaultPath(path);
      if (!normalizedPath) {
        return null;
      }
      const now = new Date().toISOString();
      const existing =
        recentVaults.find(
          (entry) => normalizeVaultPath(entry.path) === normalizedPath,
        ) ?? null;
      const nextEntry = createRecentVaultEntry(path, {
        id: existing?.id ?? buildRecentVaultId(path),
        lastOpenedAt: now,
        status: "available",
        lastSeenAt: now,
        lastError: null,
      });
      const next = [
        nextEntry,
        ...recentVaults.filter((entry) => {
          if (entry.id === nextEntry.id) {
            return false;
          }
          return normalizeVaultPath(entry.path) !== normalizedPath;
        }),
      ].slice(0, MAX_RECENT_VAULTS);
      await persistRecentVaultRegistry(next);
      return nextEntry;
    },
    [persistRecentVaultRegistry, recentVaults],
  );

  const markRecentVaultMissingByPath = useCallback(
    async (path: string, lastError: string) => {
      const normalizedPath = normalizeVaultPath(path);
      if (!normalizedPath) {
        return null;
      }
      const existing =
        recentVaults.find(
          (entry) => normalizeVaultPath(entry.path) === normalizedPath,
        ) ?? null;
      if (existing) {
        return updateRecentVaultEntry(existing.id, {
          status: "missing",
          lastError,
        });
      }
      const nextEntry = createRecentVaultEntry(path, {
        id: buildRecentVaultId(path),
        status: "missing",
        lastSeenAt: null,
        lastError,
      });
      const next = [nextEntry, ...recentVaults].slice(0, MAX_RECENT_VAULTS);
      await persistRecentVaultRegistry(next);
      return nextEntry;
    },
    [persistRecentVaultRegistry, recentVaults, updateRecentVaultEntry],
  );

  const inspectVaultPath = useCallback(async (path: string) => {
    try {
      const info = await invoke<VaultPathInfo>("get_path_info", { path });
      if (info.exists && info.isDir) {
        return { available: true as const, lastError: null };
      }
      return {
        available: false as const,
        lastError: describeMissingVaultPath(info),
      };
    } catch (error) {
      return {
        available: false as const,
        lastError: asErrorMessage(error, "Pfadpruefung fehlgeschlagen."),
      };
    }
  }, []);

  const setActiveFolderPath = useCallback((value: string | null) => {
    if (value === null) {
      setActiveFolderPathState(null);
      return;
    }
    const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
    setActiveFolderPathState(normalized);
  }, []);

  useEffect(() => {
    setActiveFolderPath(null);
  }, [setActiveFolderPath, vault.vaultPath]);

  useEffect(() => {
    if (!settingsLoaded || hasRestoredVault.current) {
      return;
    }
    hasRestoredVault.current = true;
    if (!storedVaultPath) {
      return;
    }
    let cancelled = false;

    const restoreVault = async () => {
      const results = await loadVault(storedVaultPath, {
        persist: false,
        clearOnFailure: false,
        errorMessage:
          "Saved vault is unavailable. Please reselect.",
      });
      if (!results && !cancelled) {
        await markRecentVaultMissingByPath(
          storedVaultPath,
          "Saved vault is unavailable. Please reselect.",
        );
      }
    };

    void restoreVault();

    return () => {
      cancelled = true;
    };
  }, [
    loadVault,
    markRecentVaultMissingByPath,
    settingsLoaded,
    storedVaultPath,
  ]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (preview.selectedFile && !hasResolvedActiveNote.current) {
      hasResolvedActiveNote.current = true;
    }
    if (!hasResolvedActiveNote.current) {
      return;
    }
    const nextPath = preview.selectedFile?.relative_path ?? null;
    if (nextPath === activeNotePath) {
      return;
    }
    setActiveNotePath(nextPath);
  }, [activeNotePath, preview.selectedFile, setActiveNotePath, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!vault.vaultPath || vault.listState !== "idle") {
      return;
    }
    if (preview.selectedFile || isRestoringActiveNote.current) {
      if (preview.selectedFile) {
        hasResolvedActiveNote.current = true;
      }
      return;
    }
    if (!activeNotePath) {
      hasResolvedActiveNote.current = true;
      return;
    }
    const storedFile = vault.files.find(
      (file) =>
        file.relative_path === activeNotePath || file.path === activeNotePath,
    );
    if (!storedFile) {
      setActiveNotePath(null);
      if (vault.files.length === 0) {
        hasResolvedActiveNote.current = true;
        return;
      }
    }
    const nextFile = storedFile ?? vault.files[0];
    if (!nextFile) {
      return;
    }
    isRestoringActiveNote.current = true;
    resetFlashcards();
    void Promise.resolve(selectFile(nextFile)).finally(() => {
      isRestoringActiveNote.current = false;
      hasResolvedActiveNote.current = true;
    });
  }, [
    activeNotePath,
    preview.selectedFile,
    resetFlashcards,
    selectFile,
    setActiveNotePath,
    settingsLoaded,
    vault.files,
    vault.listState,
    vault.vaultPath,
  ]);

  const handlePickVault = useCallback(async () => {
    setPreviewError("");
    const previewSnapshot = takePreviewSnapshot();
    const flashcardsSnapshot = takeFlashcardsSnapshot();

    const results = await pickVault({
      errorMessage: "Ausgewaehlter Vault ist nicht verfuegbar.",
      onBeforeLoad: () => {
        resetPreview();
        resetFlashcards();
      },
      onLoadFailed: () => {
        restorePreviewSnapshot(previewSnapshot);
        restoreFlashcardsSnapshot(flashcardsSnapshot);
      },
    });

    if (results) {
      const count = countMarkdownFiles(results.files, showHiddenFolders);
      const threshold = parseVaultWarningThreshold(maxFilesPerScan);
      if (threshold && count > threshold) {
        setLargeVaultWarningCount(count);
      } else {
        setLargeVaultWarningCount(null);
      }
    }

    return Boolean(results);
  }, [
    pickVault,
    resetFlashcards,
    resetPreview,
    restoreFlashcardsSnapshot,
    restorePreviewSnapshot,
    setPreviewError,
    takeFlashcardsSnapshot,
    takePreviewSnapshot,
    setLargeVaultWarningCount,
    maxFilesPerScan,
    showHiddenFolders,
  ]);

  const handleSwitchVault = useCallback(
    async (path: string) => {
      if (!path) {
        return false;
      }
      setPreviewError("");
      const previewSnapshot = takePreviewSnapshot();
      const flashcardsSnapshot = takeFlashcardsSnapshot();
      const vaultSnapshot = takeVaultSnapshot();

      resetPreview();
      resetFlashcards();

      const errorMessage = "Ausgewaehlter Vault ist nicht verfuegbar.";
      const results = await loadVault(path, {
        persist: true,
        clearOnFailure: false,
        errorMessage,
      });

      if (!results) {
        restoreVaultSnapshot(vaultSnapshot);
        setListError(errorMessage);
        restorePreviewSnapshot(previewSnapshot);
        restoreFlashcardsSnapshot(flashcardsSnapshot);
        const inspected = await inspectVaultPath(path);
        await markRecentVaultMissingByPath(
          path,
          inspected.lastError ?? errorMessage,
        );
        return false;
      }

      const count = countMarkdownFiles(results.files, showHiddenFolders);
      const threshold = parseVaultWarningThreshold(maxFilesPerScan);
      if (threshold && count > threshold) {
        setLargeVaultWarningCount(count);
      } else {
        setLargeVaultWarningCount(null);
      }

      await markRecentVaultAvailable(path);
      lastRecentVaultRef.current = normalizeVaultPath(path);

      return true;
    },
    [
      inspectVaultPath,
      loadVault,
      markRecentVaultAvailable,
      markRecentVaultMissingByPath,
      maxFilesPerScan,
      resetFlashcards,
      resetPreview,
      restoreFlashcardsSnapshot,
      restorePreviewSnapshot,
      restoreVaultSnapshot,
      setLargeVaultWarningCount,
      setListError,
      setPreviewError,
      showHiddenFolders,
      takeFlashcardsSnapshot,
      takePreviewSnapshot,
      takeVaultSnapshot,
    ],
  );

  const updateRecentVaults = useCallback(
    async (path: string) => {
      await markRecentVaultAvailable(path);
    },
    [markRecentVaultAvailable],
  );

  const handleRecheckVault = useCallback(
    async (
      vaultId: string,
      options: { loadIfAvailable?: boolean; source?: string } = {},
    ): Promise<VaultRecheckResult> => {
      const entry = recentVaults.find((candidate) => candidate.id === vaultId);
      if (!entry) {
        return {
          vaultId,
          path: null,
          available: false,
          loaded: false,
          lastError: "Vault-Eintrag nicht gefunden.",
          message: "Vault-Eintrag nicht gefunden.",
        };
      }
      const source = options.source ?? "unknown";
      if (import.meta.env.DEV) {
        console.info("[vault] Recheck requested", {
          vaultId,
          source,
          path: entry.path,
        });
      }
      const inspected = await inspectVaultPath(entry.path);
      if (!inspected.available) {
        const reason = inspected.lastError ?? "Vault path unavailable.";
        await updateRecentVaultEntry(entry.id, {
          status: "missing",
          lastError: reason,
        });
        return {
          vaultId: entry.id,
          path: entry.path,
          available: false,
          loaded: false,
          lastError: reason,
          message: `Vault noch missing: ${reason}`,
        };
      }

      const now = new Date().toISOString();
      await updateRecentVaultEntry(entry.id, {
        status: "available",
        lastSeenAt: now,
        lastError: null,
      });

      let loaded = false;
      if (options.loadIfAvailable) {
        const normalizedActivePath = normalizeVaultPath(vaultPath ?? "");
        const normalizedEntryPath = normalizeVaultPath(entry.path);
        if (
          normalizedActivePath &&
          normalizedEntryPath &&
          normalizedActivePath === normalizedEntryPath
        ) {
          loaded = listState !== "loading" ? await rescanVault() : false;
        } else {
          loaded = await handleSwitchVault(entry.path);
        }
      }

      return {
        vaultId: entry.id,
        path: entry.path,
        available: true,
        loaded,
        lastError: null,
        message: loaded
          ? "Vault verfuegbar und geladen."
          : options.loadIfAvailable
            ? "Vault verfuegbar, Laden fehlgeschlagen."
            : "Vault verfuegbar.",
      };
    },
    [
      handleSwitchVault,
      inspectVaultPath,
      listState,
      recentVaults,
      rescanVault,
      updateRecentVaultEntry,
      vaultPath,
    ],
  );

  const handleRelinkVault = useCallback(
    async (
      vaultId: string,
      nextPath: string,
      source = "unknown",
    ): Promise<VaultRecheckResult> => {
      const entry = recentVaults.find((candidate) => candidate.id === vaultId);
      if (!entry) {
        return {
          vaultId,
          path: null,
          available: false,
          loaded: false,
          lastError: "Vault-Eintrag nicht gefunden.",
          message: "Vault-Eintrag nicht gefunden.",
        };
      }
      const trimmedPath = nextPath.trim();
      const normalizedPath = normalizeVaultPath(trimmedPath);
      if (!trimmedPath || !normalizedPath) {
        return {
          vaultId: entry.id,
          path: entry.path,
          available: false,
          loaded: false,
          lastError: "Ungueltiger Vault-Pfad.",
          message: "Ungueltiger Vault-Pfad.",
        };
      }
      if (import.meta.env.DEV) {
        console.info("[vault] Relink requested", {
          vaultId: entry.id,
          fromPath: entry.path,
          toPath: trimmedPath,
          source,
        });
      }
      const inspected = await inspectVaultPath(trimmedPath);
      if (!inspected.available) {
        const reason = inspected.lastError ?? "Vault path unavailable.";
        await updateRecentVaultEntry(entry.id, {
          path: trimmedPath,
          status: "missing",
          lastSeenAt: null,
          lastError: reason,
        });
        return {
          vaultId: entry.id,
          path: trimmedPath,
          available: false,
          loaded: false,
          lastError: reason,
          message: `Vault noch missing: ${reason}`,
        };
      }
      const now = new Date().toISOString();
      await updateRecentVaultEntry(entry.id, {
        path: trimmedPath,
        status: "available",
        lastSeenAt: now,
        lastError: null,
      });
      const loaded = await handleSwitchVault(trimmedPath);
      return {
        vaultId: entry.id,
        path: trimmedPath,
        available: true,
        loaded,
        lastError: null,
        message: loaded
          ? "Vault verfuegbar und geladen."
          : "Vault verfuegbar, Laden fehlgeschlagen.",
      };
    },
    [
      handleSwitchVault,
      inspectVaultPath,
      recentVaults,
      updateRecentVaultEntry,
    ],
  );

  const handleRemoveRecentVault = useCallback(
    (path: string) => {
      const normalized = normalizeVaultPath(path);
      if (!normalized) {
        return;
      }
      if (lastRecentVaultRef.current === normalized) {
        lastRecentVaultRef.current = null;
      }
      const next = recentVaults.filter(
        (entry) => normalizeVaultPath(entry.path) !== normalized,
      );
      if (next.length === recentVaults.length) {
        return;
      }
      void persistSettings({ recentVaults: next });
    },
    [persistSettings, recentVaults],
  );

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!vault.vaultPath) {
      lastRecentVaultRef.current = null;
      return;
    }
    if (vault.listState !== "idle") {
      return;
    }
    const normalized = normalizeVaultPath(vault.vaultPath);
    if (!normalized) {
      return;
    }
    if (lastRecentVaultRef.current === normalized) {
      return;
    }
    lastRecentVaultRef.current = normalized;
    void updateRecentVaults(vault.vaultPath);
  }, [settingsLoaded, updateRecentVaults, vault.listState, vault.vaultPath]);

  const missingVaultEntries = useMemo(
    () => recentVaults.filter((entry) => entry.status === "missing"),
    [recentVaults],
  );

  useEffect(() => {
    if (!settingsLoaded || missingVaultEntries.length === 0) {
      return;
    }
    let cancelled = false;
    const run = async (source: string) => {
      if (cancelled || autoRecheckRunningRef.current) {
        return;
      }
      autoRecheckRunningRef.current = true;
      try {
        for (const entry of missingVaultEntries) {
          if (cancelled) {
            return;
          }
          const shouldLoad = activeVaultEntry?.id === entry.id;
          await handleRecheckVault(entry.id, {
            loadIfAvailable: shouldLoad,
            source,
          });
        }
      } finally {
        autoRecheckRunningRef.current = false;
      }
    };

    void run("auto:startup");

    const handleFocus = () => {
      void run("auto:focus");
    };
    window.addEventListener("focus", handleFocus);
    const timer = window.setInterval(() => {
      void run("auto:timer");
    }, 5000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(timer);
    };
  }, [activeVaultEntry?.id, handleRecheckVault, missingVaultEntries, settingsLoaded]);

  const handleOpenVaultManager = useCallback(() => {
    setIsVaultManagerOpen(true);
  }, []);

  const handleCloseVaultManager = useCallback(() => {
    setIsVaultManagerOpen(false);
  }, []);

  const handleSelectFile = useCallback(
    (file: VaultFile, options?: PreviewFileOpenOptions) => {
      resetFlashcards();
      void selectFile(file, options);
    },
    [resetFlashcards, selectFile],
  );

  const handleThemeChange = useCallback(
    (nextTheme: ThemeMode) => {
      setTheme(nextTheme);
    },
    [setTheme],
  );

  const handleDesignModeChange = useCallback(
    (nextMode: DesignMode) => {
      setDesignMode(nextMode);
    },
    [setDesignMode],
  );

  const handleAccentPick = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value);
      if (!isValidHex(normalized)) {
        return;
      }
      setAccentError("");
      setAccentColor(normalized);
      setAccentDraft(normalized);
    },
    [setAccentColor, setAccentDraft, setAccentError],
  );

  const handleAccentInputChange = useCallback(
    (value: string) => {
      const nextValue = normalizeHex(value);
      setAccentDraft(nextValue);
      if (!nextValue) {
        setAccentError("");
        return;
      }
      if (isValidHex(nextValue)) {
        setAccentError("");
        setAccentColor(nextValue);
      } else {
        setAccentError(
          settings.language === "de"
            ? "HEX muss #RRGGBB sein."
            : "HEX must be #RRGGBB.",
        );
      }
    },
    [setAccentColor, setAccentDraft, setAccentError, settings.language],
  );

  const handleCopyAccent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(accentColor);
    } catch (error) {
      console.error("Failed to copy accent color", error);
    }
  }, [accentColor]);

  const handleCopyVaultPath = useCallback(async () => {
    if (!vaultPath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(vaultPath);
    } catch (error) {
      console.error("Failed to copy vault path", error);
    }
  }, [vaultPath]);

  const stageTaskAreaToggle = useCallback(
    (scope: TaskMutationScope, nextEnabled: boolean) => {
      const key = buildTaskMutationScopeKey(scope);
      setStagedTaskAreaTogglesByKey((prev) => ({
        ...prev,
        [key]: {
          scope,
          nextEnabled,
          stagedAt: Date.now(),
        },
      }));
      setTaskAreaToggleNoticeByKey((prev) => removeRecordKeys(prev, [key]));
    },
    [],
  );

  const getStagedTaskAreaToggle = useCallback(
    (scope: TaskMutationScope) => {
      const key = buildTaskMutationScopeKey(scope);
      return stagedTaskAreaTogglesByKey[key]?.nextEnabled ?? null;
    },
    [stagedTaskAreaTogglesByKey],
  );

  const getTaskAreaToggleNotice = useCallback(
    (scope: TaskMutationScope) => {
      const key = buildTaskMutationScopeKey(scope);
      return taskAreaToggleNoticeByKey[key] ?? "";
    },
    [taskAreaToggleNoticeByKey],
  );

  const flushPendingTaskAreaToggles = useCallback(
    async (trigger = "unknown") => {
      const pendingEntries = Object.entries(stagedTaskAreaTogglesByKey).sort(
        (left, right) => left[1].stagedAt - right[1].stagedAt,
      );
      if (pendingEntries.length === 0) {
        return true;
      }
      if (import.meta.env.DEV) {
        console.info("[task-area-toggle] Flushing staged task-area toggles", {
          trigger,
          count: pendingEntries.length,
        });
      }

      const processedKeys: string[] = [];
      const failedNoticeByKey: Record<string, string> = {};
      let flushOk = true;

      for (const [key, entry] of pendingEntries) {
        try {
          await applyTaskAreaToggle({
            scope: entry.scope,
            nextEnabled: entry.nextEnabled,
            removeMissingWrapperPolicy: "noop",
            mutators: {
              findWrapper: findTaskWrapper,
              addWrapper: addTaskWrapper,
              removeWrapper: removeTaskWrapper,
            },
            readSource: (path) => invoke<string>("read_text_file", { path }),
            writeSource: (path, contents) =>
              invoke("write_text_file_atomic", {
                path,
                contents,
              }),
            onSourceUpdated: ({ scope, contents, wroteFile }) => {
              if (wroteFile && preview.selectedFile?.path === scope.sourcePath) {
                preview.setPreview(contents);
              }
            },
          });
        } catch (error) {
          flushOk = false;
          failedNoticeByKey[key] =
            "Card-area update could not be saved. Local switch state was reverted.";
          if (import.meta.env.DEV) {
            console.warn(
              "[task-area-toggle] Failed to flush staged task-area toggle",
              {
                trigger,
                key,
                error: asErrorMessage(error, "Unknown error"),
              },
            );
          }
        } finally {
          processedKeys.push(key);
        }
      }

      if (processedKeys.length > 0) {
        setStagedTaskAreaTogglesByKey((prev) => removeRecordKeys(prev, processedKeys));
        setTaskAreaToggleNoticeByKey((prev) => {
          const cleared = removeRecordKeys(prev, processedKeys);
          return Object.keys(failedNoticeByKey).length > 0
            ? { ...cleared, ...failedNoticeByKey }
            : cleared;
        });
      }

      return flushOk;
    },
    [preview, stagedTaskAreaTogglesByKey],
  );

  const handleFlashcardScanWithPendingFlush = useCallback(async () => {
    await flushPendingTaskAreaToggles("flashcard-scan");
    await flashcards.handleFlashcardScan();
  }, [flashcards, flushPendingTaskAreaToggles]);

  const handleFastFlashcardScanWithPendingFlush = useCallback(async () => {
    await flushPendingTaskAreaToggles("fast-flashcard-scan");
    await fastFlashcards.handleFlashcardScan();
  }, [fastFlashcards, flushPendingTaskAreaToggles]);

  const handleRescanVault = useCallback(async (source = "unknown") => {
    await flushPendingTaskAreaToggles(`vault-rescan:${source}`);
    if (!vaultPath) {
      setListError("Kein aktiver Vault zum Aktualisieren.");
      return false;
    }
    if (listState === "loading") {
      if (import.meta.env.DEV) {
        console.info("[vault] Refresh skipped because a scan is already running.", {
          source,
        });
      }
      return false;
    }
    if (import.meta.env.DEV) {
      console.info("[vault] Refresh requested", { vaultPath, source });
    }
    if (activeVaultEntry?.status === "missing") {
      const result = await handleRecheckVault(activeVaultEntry.id, {
        loadIfAvailable: true,
        source: `${source}:active-missing`,
      });
      if (!result.available) {
        setListError(result.message);
      }
      return result.available && result.loaded;
    }
    const success = await rescanVault();
    if (success) {
      if (activeVaultEntry) {
        await updateRecentVaultEntry(activeVaultEntry.id, {
          status: "available",
          lastSeenAt: new Date().toISOString(),
          lastError: null,
        });
      } else {
        await markRecentVaultAvailable(vaultPath);
      }
    } else if (activeVaultEntry) {
      const inspected = await inspectVaultPath(vaultPath);
      if (!inspected.available) {
        await updateRecentVaultEntry(activeVaultEntry.id, {
          status: "missing",
          lastError: inspected.lastError ?? "Vault path unavailable.",
        });
      }
    }
    if (!success && import.meta.env.DEV) {
      console.warn("[vault] Refresh failed", { vaultPath, source });
    }
    return success;
  }, [
    activeVaultEntry,
    handleRecheckVault,
    inspectVaultPath,
    listState,
    markRecentVaultAvailable,
    rescanVault,
    setListError,
    updateRecentVaultEntry,
    vaultPath,
    flushPendingTaskAreaToggles,
  ]);

  const handleResetIndex = useCallback(() => {
    if (!vaultPath) {
      return;
    }
    resetPreview();
    resetFlashcards();
    resetFastFlashcards();
    setActiveFolderPath(null);
    setLargeVaultWarningCount(null);
    setSelectedExamFileRows([]);
    setFiles([]);
    setPngAssets([]);
    setListError("");
    setListState("idle");
    setLastRefreshAt(null);
    setVaultPath(null);
    setStagedTaskAreaTogglesByKey({});
    setTaskAreaToggleNoticeByKey({});
    void persistSettings({ vaultPath: null, activeNotePath: null });
  }, [
    persistSettings,
    resetFastFlashcards,
    resetFlashcards,
    resetPreview,
    setActiveFolderPath,
    setFiles,
    setLargeVaultWarningCount,
    setSelectedExamFileRows,
    setListError,
    setListState,
    setStagedTaskAreaTogglesByKey,
    setTaskAreaToggleNoticeByKey,
    setPngAssets,
    setVaultPath,
    vaultPath,
  ]);

  const handleClearVault = useCallback(() => {
    handleResetIndex();
  }, [handleResetIndex]);

  const handleMaxFilesPerScanChange = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      if (nextValue === "" || /^[0-9]+$/.test(nextValue)) {
        setMaxFilesPerScan(nextValue);
      }
    },
    [setMaxFilesPerScan],
  );

  const handleLargeVaultWarningDismiss = useCallback(() => {
    setLargeVaultWarningCount(null);
  }, [setLargeVaultWarningCount]);

  const value: AppState = {
    actions: {
      handlePickVault,
      handleSwitchVault,
      handleRemoveRecentVault,
      handleOpenVaultManager,
      handleClearVault,
      handleSelectFile,
      handleToggleExamFileSelection,
      handleSetSelectedExamFiles,
      handleSetSelectedExamFileRows,
      handlePlaceSelectedExamFile,
      handleMoveSelectedExamFile,
      handleClearSelectedExamFiles,
      handleThemeChange,
      handleDesignModeChange,
      handleAccentPick,
      handleAccentInputChange,
      handleCopyAccent,
      handleCopyVaultPath,
      stageTaskAreaToggle,
      getStagedTaskAreaToggle,
      getTaskAreaToggleNotice,
      flushPendingTaskAreaToggles,
      handleRescanVault,
      handleResetIndex,
      handleMaxFilesPerScanChange,
    },
    flashcards: {
      ...flashcards,
      handleFlashcardScan: handleFlashcardScanWithPendingFlush,
    },
    fastFlashcards: {
      ...fastFlashcards,
      handleFlashcardScan: handleFastFlashcardScanWithPendingFlush,
    },
    examFiles,
    examFilesState,
    examFilesError,
    selectedExamFileRows,
    selectedExamFilePaths,
    flashcardNoteFiles,
    flashcardNoteFilesState,
    flashcardNoteFilesError,
    help: {
      activeTopicId: activeHelpTopicId,
      setActiveTopicId: setActiveHelpTopicId,
    },
    settingsNav: {
      activeSettingsPage,
      setActiveSettingsPage,
    },
    pointsProfiles,
    preview,
    settings,
    spacedRepetition,
    userVault,
    vault: {
      ...vault,
      activeFolderPath,
      setActiveFolderPath,
    },
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
      <VaultManagerModal
        isOpen={isVaultManagerOpen}
        vaults={recentVaults}
        activeVaultPath={vault.vaultPath}
        activeVaultError={vault.listError}
        userVault={userVault}
        onClose={handleCloseVaultManager}
        onOpenVault={handlePickVault}
        onRescanVault={handleRescanVault}
        onRecheckVault={handleRecheckVault}
        onRelinkVault={handleRelinkVault}
        onSwitchVault={handleSwitchVault}
        onRemoveVault={handleRemoveRecentVault}
        onClearVault={handleClearVault}
      />
      <LargeVaultWarningModal
        count={largeVaultWarningCount}
        onClose={handleLargeVaultWarningDismiss}
      />
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};
