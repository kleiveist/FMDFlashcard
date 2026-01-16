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
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isValidHex, normalizeHex } from "../lib/color";
import { isHiddenPath, normalizeRelativePath, normalizeVaultPath } from "../lib/path";
import { type ThemeMode } from "../lib/theme";
import { type VaultFile } from "../lib/tree";
import { useFlashcards } from "../features/flashcards/useFlashcards";
import { usePreview } from "../features/preview/usePreview";
import { useAppSettings } from "../features/settings/useAppSettings";
import { type SettingsPageId } from "../features/settings/settingsNavigation";
import { useSpacedRepetition } from "../features/spaced-repetition/useSpacedRepetition";
import { useUserVault } from "../features/user-vault/useUserVault";
import { useVault } from "../features/vault/useVault";
import { LargeVaultWarningModal } from "./LargeVaultWarningModal";
import { VaultManagerModal } from "./VaultManagerModal";
import { DEFAULT_HELP_TOPIC_ID } from "../pages/help/helpContent";

type AppActions = {
  handlePickVault: () => Promise<boolean>;
  handleSwitchVault: (path: string) => Promise<boolean>;
  handleRemoveRecentVault: (path: string) => void;
  handleOpenVaultManager: () => void;
  handleClearVault: () => void;
  handleSelectFile: (file: VaultFile) => void;
  handleThemeChange: (nextTheme: ThemeMode) => void;
  handleAccentPick: (value: string) => void;
  handleAccentInputChange: (value: string) => void;
  handleCopyAccent: () => Promise<void>;
  handleCopyVaultPath: () => Promise<void>;
  handleRescanVault: () => Promise<boolean>;
  handleResetIndex: () => void;
  handleMaxFilesPerScanChange: (value: string) => void;
};

type AppState = {
  actions: AppActions;
  flashcards: ReturnType<typeof useFlashcards>;
  fastFlashcards: ReturnType<typeof useFlashcards>;
  help: {
    activeTopicId: string;
    setActiveTopicId: (value: string) => void;
  };
  settingsNav: {
    activeSettingsPage: SettingsPageId;
    setActiveSettingsPage: (value: SettingsPageId) => void;
  };
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
  const spacedRepetition = useSpacedRepetition({
    isFlashcardScanning: flashcards.isFlashcardScanning,
    scanFlashcards: flashcards.scanFlashcards,
    setIsFlashcardScanning: flashcards.setIsFlashcardScanning,
    userVaultProfilePath: userVault.activeProfilePath,
    userVaultRevision: userVault.revision,
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
    setListError,
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
        setVaultPath(null);
        await persistSettings({ vaultPath: null });
      }
    };

    void restoreVault();

    return () => {
      cancelled = true;
    };
  }, [loadVault, persistSettings, setVaultPath, settingsLoaded, storedVaultPath]);

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
      const count = countMarkdownFiles(results, showHiddenFolders);
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
        return false;
      }

      const count = countMarkdownFiles(results, showHiddenFolders);
      const threshold = parseVaultWarningThreshold(maxFilesPerScan);
      if (threshold && count > threshold) {
        setLargeVaultWarningCount(count);
      } else {
        setLargeVaultWarningCount(null);
      }

      return true;
    },
    [
      loadVault,
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
      if (!settingsLoaded) {
        return;
      }
      const normalized = normalizeVaultPath(path);
      if (!normalized) {
        return;
      }
      const next = [
        { path, lastOpenedAt: new Date().toISOString() },
        ...recentVaults.filter(
          (entry) => normalizeVaultPath(entry.path) !== normalized,
        ),
      ].slice(0, MAX_RECENT_VAULTS);
      await persistSettings({ recentVaults: next });
    },
    [persistSettings, recentVaults, settingsLoaded],
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

  const handleOpenVaultManager = useCallback(() => {
    setIsVaultManagerOpen(true);
  }, []);

  const handleCloseVaultManager = useCallback(() => {
    setIsVaultManagerOpen(false);
  }, []);

  const handleSelectFile = useCallback(
    (file: VaultFile) => {
      resetFlashcards();
      void selectFile(file);
    },
    [resetFlashcards, selectFile],
  );

  const handleThemeChange = useCallback(
    (nextTheme: ThemeMode) => {
      setTheme(nextTheme);
    },
    [setTheme],
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
        setAccentError("HEX muss #RRGGBB sein.");
      }
    },
    [setAccentColor, setAccentDraft, setAccentError],
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

  const handleRescanVault = useCallback(async () => {
    if (!vaultPath) {
      setListError("Kein aktiver Vault zum Aktualisieren.");
      return false;
    }
    if (listState === "loading") {
      if (import.meta.env.DEV) {
        console.info("[vault] Refresh skipped because a scan is already running.");
      }
      return false;
    }
    if (import.meta.env.DEV) {
      console.info("[vault] Refresh requested", { vaultPath });
    }
    const success = await rescanVault();
    if (!success && import.meta.env.DEV) {
      console.warn("[vault] Refresh failed", { vaultPath });
    }
    return success;
  }, [listState, rescanVault, setListError, vaultPath]);

  const handleResetIndex = useCallback(() => {
    if (!vaultPath) {
      return;
    }
    resetPreview();
    resetFlashcards();
    resetFastFlashcards();
    setActiveFolderPath(null);
    setLargeVaultWarningCount(null);
    setFiles([]);
    setListError("");
    setListState("idle");
    setVaultPath(null);
    void persistSettings({ vaultPath: null, activeNotePath: null });
  }, [
    persistSettings,
    resetFastFlashcards,
    resetFlashcards,
    resetPreview,
    setActiveFolderPath,
    setFiles,
    setLargeVaultWarningCount,
    setListError,
    setListState,
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
      handleThemeChange,
      handleAccentPick,
      handleAccentInputChange,
      handleCopyAccent,
      handleCopyVaultPath,
      handleRescanVault,
      handleResetIndex,
      handleMaxFilesPerScanChange,
    },
    flashcards,
    fastFlashcards,
    help: {
      activeTopicId: activeHelpTopicId,
      setActiveTopicId: setActiveHelpTopicId,
    },
    settingsNav: {
      activeSettingsPage,
      setActiveSettingsPage,
    },
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
        userVault={userVault}
        onClose={handleCloseVaultManager}
        onOpenVault={handlePickVault}
        onRescanVault={handleRescanVault}
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
