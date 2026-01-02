import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_ACCENT, isValidHex, normalizeHex } from "../../lib/color";
import { applyAccentColor, applyTheme, type ThemeMode } from "../../lib/theme";

type AppSettings = {
  vault_path?: string | null;
  theme?: string | null;
  accent_color?: string | null;
};

type PersistUpdates = {
  vaultPath?: string | null;
  theme?: ThemeMode;
  accentColor?: string;
};

export const DEFAULT_THEME: ThemeMode = "light";

export const useAppSettings = () => {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [maxFilesPerScan, setMaxFilesPerScan] = useState("");
  const [scanParallelism, setScanParallelism] = useState<
    "low" | "medium" | "high"
  >("medium");

  const saveSettings = useCallback(
    async (settings: {
      vaultPath: string | null;
      theme: ThemeMode;
      accentColor: string;
    }) => {
      try {
        await invoke("save_app_settings", {
          vaultPath: settings.vaultPath,
          theme: settings.theme,
          accentColor: settings.accentColor,
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
        vaultPath: updates.vaultPath ?? vaultPath,
        theme: updates.theme ?? theme,
        accentColor: updates.accentColor ?? accentColor,
      };
      const saved = await saveSettings(nextSettings);
      if (saved && "vaultPath" in updates) {
        setVaultPath(nextSettings.vaultPath ?? null);
      }
      return saved;
    },
    [accentColor, saveSettings, settingsLoaded, theme, vaultPath],
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

        setTheme(storedTheme);
        setAccentColor(resolvedAccent);
        setAccentDraft(resolvedAccent);
        setAccentError("");
        setVaultPath(settings.vault_path ?? null);
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

  return {
    accentColor,
    accentDraft,
    accentError,
    maxFilesPerScan,
    persistSettings,
    scanParallelism,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setMaxFilesPerScan,
    setScanParallelism,
    setTheme,
    settingsLoaded,
    theme,
    vaultPath,
  };
};
