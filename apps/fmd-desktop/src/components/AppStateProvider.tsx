import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { isValidHex, normalizeHex } from "../lib/color";
import { type ThemeMode } from "../lib/theme";
import { type VaultFile } from "../lib/tree";
import { useFlashcards } from "../features/flashcards/useFlashcards";
import { usePreview } from "../features/preview/usePreview";
import { useAppSettings } from "../features/settings/useAppSettings";
import { useSpacedRepetition } from "../features/spaced-repetition/useSpacedRepetition";
import { useVault } from "../features/vault/useVault";

type AppActions = {
  handlePickVault: () => Promise<boolean>;
  handleSelectFile: (file: VaultFile) => void;
  handleThemeChange: (nextTheme: ThemeMode) => void;
  handleAccentPick: (value: string) => void;
  handleAccentInputChange: (value: string) => void;
  handleCopyAccent: () => Promise<void>;
  handleCopyVaultPath: () => Promise<void>;
  handleRescanVault: () => void;
  handleMaxFilesPerScanChange: (value: string) => void;
};

type AppState = {
  actions: AppActions;
  flashcards: ReturnType<typeof useFlashcards>;
  preview: ReturnType<typeof usePreview>;
  settings: ReturnType<typeof useAppSettings>;
  spacedRepetition: ReturnType<typeof useSpacedRepetition>;
  vault: ReturnType<typeof useVault>;
};

const AppStateContext = createContext<AppState | null>(null);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const settings = useAppSettings();
  const vault = useVault({ persistSettings: settings.persistSettings });
  const preview = usePreview();
  const flashcards = useFlashcards({
    files: vault.files,
    preview: preview.preview,
    selectedFile: preview.selectedFile,
    vaultPath: vault.vaultPath,
    settings: {
      flashcardMode: settings.flashcardMode,
      flashcardOrder: settings.flashcardOrder,
      flashcardPageSize: settings.flashcardPageSize,
      flashcardScope: settings.flashcardScope,
      setFlashcardMode: settings.setFlashcardMode,
      setFlashcardOrder: settings.setFlashcardOrder,
      setFlashcardPageSize: settings.setFlashcardPageSize,
      setFlashcardScope: settings.setFlashcardScope,
      setSolutionRevealEnabled: settings.setSolutionRevealEnabled,
      setStatsResetMode: settings.setStatsResetMode,
      solutionRevealEnabled: settings.solutionRevealEnabled,
      statsResetMode: settings.statsResetMode,
    },
  });
  const spacedRepetition = useSpacedRepetition({
    isFlashcardScanning: flashcards.isFlashcardScanning,
    scanFlashcards: flashcards.scanFlashcards,
    setIsFlashcardScanning: flashcards.setIsFlashcardScanning,
    settings: {
      setSpacedRepetitionBoxes: settings.setSpacedRepetitionBoxes,
      setSpacedRepetitionOrder: settings.setSpacedRepetitionOrder,
      setSpacedRepetitionPageSize: settings.setSpacedRepetitionPageSize,
      setSpacedRepetitionStatsView: settings.setSpacedRepetitionStatsView,
      spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
      spacedRepetitionOrder: settings.spacedRepetitionOrder,
      spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
      spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
    },
  });
  const hasRestoredVault = useRef(false);
  const {
    accentColor,
    persistSettings,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setMaxFilesPerScan,
    setTheme,
    settingsLoaded,
    vaultPath: storedVaultPath,
  } = settings;
  const { loadVault, pickVault, rescanVault, setVaultPath, vaultPath } = vault;
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
      const loaded = await loadVault(storedVaultPath, {
        persist: false,
        clearOnFailure: false,
        errorMessage:
          "Gespeicherter Vault ist nicht verfuegbar. Bitte neu auswaehlen.",
      });
      if (!loaded && !cancelled) {
        setVaultPath(null);
        await persistSettings({ vaultPath: null });
      }
    };

    void restoreVault();

    return () => {
      cancelled = true;
    };
  }, [loadVault, persistSettings, setVaultPath, settingsLoaded, storedVaultPath]);

  const handlePickVault = useCallback(async () => {
    setPreviewError("");
    const previewSnapshot = takePreviewSnapshot();
    const flashcardsSnapshot = takeFlashcardsSnapshot();

    const loaded = await pickVault({
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

    return loaded;
  }, [
    pickVault,
    resetFlashcards,
    resetPreview,
    restoreFlashcardsSnapshot,
    restorePreviewSnapshot,
    setPreviewError,
    takeFlashcardsSnapshot,
    takePreviewSnapshot,
  ]);

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

  const handleRescanVault = useCallback(() => {
    void rescanVault();
  }, [rescanVault]);

  const handleMaxFilesPerScanChange = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      if (nextValue === "" || /^[0-9]+$/.test(nextValue)) {
        setMaxFilesPerScan(nextValue);
      }
    },
    [setMaxFilesPerScan],
  );

  const value: AppState = {
    actions: {
      handlePickVault,
      handleSelectFile,
      handleThemeChange,
      handleAccentPick,
      handleAccentInputChange,
      handleCopyAccent,
      handleCopyVaultPath,
      handleRescanVault,
      handleMaxFilesPerScanChange,
    },
    flashcards,
    preview,
    settings,
    spacedRepetition,
    vault,
  };

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};
