import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_ACCENT, isValidHex, normalizeHex } from "../../lib/color";
import { applyAccentColor, applyTheme, type ThemeMode } from "../../lib/theme";
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
  DEFAULT_SPACED_REPETITION_PAGE_SIZE,
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
  type SpacedRepetitionBoxes,
  type SpacedRepetitionOrder,
  type SpacedRepetitionPageSize,
  type SpacedRepetitionRepetitionStrength,
} from "../spaced-repetition/useSpacedRepetition";

type AppLanguage = "de" | "en";
type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";

type AppSettings = {
  active_note_path?: string | null;
  vault_path?: string | null;
  theme?: string | null;
  accent_color?: string | null;
  language?: AppLanguage | null;
  max_files_per_scan?: string | null;
  scan_parallelism?: string | null;
  flashcard_order?: string | null;
  flashcard_mode?: string | null;
  flashcard_scope?: string | null;
  flashcard_page_size?: number | null;
  flashcard_solution_reveal_enabled?: boolean | null;
  flashcard_stats_reset_mode?: string | null;
  spaced_repetition_boxes?: number | null;
  spaced_repetition_order?: string | null;
  spaced_repetition_page_size?: number | null;
  spaced_repetition_repetition_strength?: string | null;
  spaced_repetition_stats_view?: string | null;
  right_toolbar_collapsed?: boolean | null;
};

type PersistUpdates = {
  activeNotePath?: string | null;
  vaultPath?: string | null;
  theme?: ThemeMode;
  accentColor?: string;
  language?: AppLanguage;
  maxFilesPerScan?: string;
  scanParallelism?: "low" | "medium" | "high";
  flashcardOrder?: FlashcardOrder;
  flashcardMode?: FlashcardMode;
  flashcardScope?: FlashcardScope;
  flashcardPageSize?: FlashcardPageSize;
  solutionRevealEnabled?: boolean;
  statsResetMode?: StatsResetMode;
  spacedRepetitionBoxes?: SpacedRepetitionBoxes;
  spacedRepetitionOrder?: SpacedRepetitionOrder;
  spacedRepetitionPageSize?: SpacedRepetitionPageSize;
  spacedRepetitionRepetitionStrength?: SpacedRepetitionRepetitionStrength;
  spacedRepetitionStatsView?: SpacedRepetitionStatsView;
  rightToolbarCollapsed?: boolean;
};

export const DEFAULT_THEME: ThemeMode = "light";
export const DEFAULT_LANGUAGE: AppLanguage = "de";
const DEFAULT_SCAN_PARALLELISM: "low" | "medium" | "high" = "medium";
const DEFAULT_FLASHCARD_ORDER: FlashcardOrder = "in-order";
const DEFAULT_FLASHCARD_MODE: FlashcardMode = "all";
const DEFAULT_FLASHCARD_SCOPE: FlashcardScope = "current";
const DEFAULT_STATS_RESET_MODE: StatsResetMode = "scan";
const DEFAULT_SPACED_REPETITION_BOXES: SpacedRepetitionBoxes = 5;
const DEFAULT_SPACED_REPETITION_ORDER: SpacedRepetitionOrder = "in-order";
const DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH: SpacedRepetitionRepetitionStrength =
  "medium";
const DEFAULT_SPACED_REPETITION_STATS_VIEW: SpacedRepetitionStatsView = "boxes";
const DEFAULT_RIGHT_TOOLBAR_COLLAPSED = false;

export const useAppSettings = () => {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [maxFilesPerScan, setMaxFilesPerScan] = useState("");
  const [scanParallelism, setScanParallelism] = useState<
    "low" | "medium" | "high"
  >(DEFAULT_SCAN_PARALLELISM);
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
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(
    DEFAULT_RIGHT_TOOLBAR_COLLAPSED,
  );
  const autoSaveReady = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);

  const saveSettings = useCallback(
    async (settings: {
      activeNotePath: string | null;
      vaultPath: string | null;
      theme: ThemeMode;
      accentColor: string;
      language: AppLanguage;
      maxFilesPerScan: string;
      scanParallelism: "low" | "medium" | "high";
      flashcardOrder: FlashcardOrder;
      flashcardMode: FlashcardMode;
      flashcardScope: FlashcardScope;
      flashcardPageSize: FlashcardPageSize;
      solutionRevealEnabled: boolean;
      statsResetMode: StatsResetMode;
      spacedRepetitionBoxes: SpacedRepetitionBoxes;
      spacedRepetitionOrder: SpacedRepetitionOrder;
      spacedRepetitionPageSize: SpacedRepetitionPageSize;
      spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
      spacedRepetitionStatsView: SpacedRepetitionStatsView;
      rightToolbarCollapsed: boolean;
    }) => {
      try {
        await invoke("save_app_settings", {
          activeNotePath: settings.activeNotePath,
          vaultPath: settings.vaultPath,
          theme: settings.theme,
          accentColor: settings.accentColor,
          language: settings.language,
          maxFilesPerScan: settings.maxFilesPerScan || null,
          scanParallelism: settings.scanParallelism,
          flashcardOrder: settings.flashcardOrder,
          flashcardMode: settings.flashcardMode,
          flashcardScope: settings.flashcardScope,
          flashcardPageSize: settings.flashcardPageSize,
          flashcardSolutionRevealEnabled: settings.solutionRevealEnabled,
          flashcardStatsResetMode: settings.statsResetMode,
          spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
          spacedRepetitionOrder: settings.spacedRepetitionOrder,
          spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
          spacedRepetitionRepetitionStrength:
            settings.spacedRepetitionRepetitionStrength,
          spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
          rightToolbarCollapsed: settings.rightToolbarCollapsed,
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
        language: updates.language ?? language,
        maxFilesPerScan: updates.maxFilesPerScan ?? maxFilesPerScan,
        scanParallelism: updates.scanParallelism ?? scanParallelism,
        flashcardOrder: updates.flashcardOrder ?? flashcardOrder,
        flashcardMode: updates.flashcardMode ?? flashcardMode,
        flashcardScope: updates.flashcardScope ?? flashcardScope,
        flashcardPageSize: updates.flashcardPageSize ?? flashcardPageSize,
        solutionRevealEnabled:
          updates.solutionRevealEnabled ?? solutionRevealEnabled,
        statsResetMode: updates.statsResetMode ?? statsResetMode,
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
        rightToolbarCollapsed:
          updates.rightToolbarCollapsed ?? rightToolbarCollapsed,
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
      flashcardMode,
      flashcardOrder,
      flashcardPageSize,
      flashcardScope,
      language,
      maxFilesPerScan,
      saveSettings,
      scanParallelism,
      settingsLoaded,
      solutionRevealEnabled,
      spacedRepetitionBoxes,
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
        const storedLanguage =
          settings.language === "en" ? "en" : DEFAULT_LANGUAGE;
        const maxFilesRaw = settings.max_files_per_scan;
        const maxFilesValue =
          typeof maxFilesRaw === "number"
            ? String(maxFilesRaw)
            : typeof maxFilesRaw === "string"
              ? maxFilesRaw.trim()
              : "";
        const storedMaxFilesPerScan =
          maxFilesValue && /^[0-9]+$/.test(maxFilesValue) ? maxFilesValue : "";
        const storedScanParallelism =
          settings.scan_parallelism === "low" ||
          settings.scan_parallelism === "high" ||
          settings.scan_parallelism === "medium"
            ? settings.scan_parallelism
            : DEFAULT_SCAN_PARALLELISM;
        const storedFlashcardOrder =
          settings.flashcard_order === "random"
            ? "random"
            : DEFAULT_FLASHCARD_ORDER;
        const storedFlashcardMode =
          settings.flashcard_mode === "all" ||
          settings.flashcard_mode === "qa" ||
          settings.flashcard_mode === "multiple-choice" ||
          settings.flashcard_mode === "mix" ||
          settings.flashcard_mode === "cloze" ||
          settings.flashcard_mode === "matching" ||
          settings.flashcard_mode === "true-false"
            ? settings.flashcard_mode
            : settings.flashcard_mode === "yes-no"
              ? "true-false"
              : DEFAULT_FLASHCARD_MODE;
        const storedFlashcardScope =
          settings.flashcard_scope === "vault"
            ? "vault"
            : DEFAULT_FLASHCARD_SCOPE;
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
        const storedActiveNotePath =
          typeof settings.active_note_path === "string"
            ? settings.active_note_path
            : null;
        const storedRightToolbarCollapsed =
          typeof settings.right_toolbar_collapsed === "boolean"
            ? settings.right_toolbar_collapsed
            : DEFAULT_RIGHT_TOOLBAR_COLLAPSED;
        setTheme(storedTheme);
        setAccentColor(resolvedAccent);
        setAccentDraft(resolvedAccent);
        setAccentError("");
        setActiveNotePath(storedActiveNotePath);
        setVaultPath(settings.vault_path ?? null);
        setLanguage(storedLanguage);
        setMaxFilesPerScan(storedMaxFilesPerScan);
        setScanParallelism(storedScanParallelism);
        setFlashcardOrder(storedFlashcardOrder);
        setFlashcardMode(storedFlashcardMode);
        setFlashcardScope(storedFlashcardScope);
        setFlashcardPageSize(storedFlashcardPageSize);
        setSolutionRevealEnabled(storedSolutionRevealEnabled);
        setStatsResetMode(storedStatsResetMode);
        setSpacedRepetitionBoxes(storedSpacedRepetitionBoxes);
        setSpacedRepetitionOrder(storedSpacedRepetitionOrder);
        setSpacedRepetitionPageSize(storedSpacedRepetitionPageSize);
        setSpacedRepetitionRepetitionStrength(
          storedSpacedRepetitionRepetitionStrength,
        );
        setSpacedRepetitionStatsView(storedSpacedRepetitionStatsView);
        setRightToolbarCollapsed(storedRightToolbarCollapsed);
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
        language,
        maxFilesPerScan,
        scanParallelism,
        flashcardOrder,
        flashcardMode,
        flashcardScope,
        flashcardPageSize,
        solutionRevealEnabled,
        statsResetMode,
        spacedRepetitionBoxes,
        spacedRepetitionOrder,
        spacedRepetitionPageSize,
        spacedRepetitionRepetitionStrength,
        spacedRepetitionStatsView,
        rightToolbarCollapsed,
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
    flashcardMode,
    flashcardOrder,
    flashcardPageSize,
    flashcardScope,
    language,
    maxFilesPerScan,
    saveSettings,
    scanParallelism,
    settingsLoaded,
    solutionRevealEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
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
    flashcardMode,
    flashcardOrder,
    flashcardPageSize,
    flashcardScope,
    language,
    maxFilesPerScan,
    persistSettings,
    scanParallelism,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setLanguage,
    setMaxFilesPerScan,
    setRightToolbarCollapsed,
    setScanParallelism,
    setSolutionRevealEnabled,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionStatsView,
    setStatsResetMode,
    setTheme,
    settingsLoaded,
    solutionRevealEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    vaultPath,
    rightToolbarCollapsed,
  };
};
