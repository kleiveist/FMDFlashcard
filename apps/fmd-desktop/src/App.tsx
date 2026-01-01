import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type VaultFile = {
  path: string;
  relative_path: string;
};

type TabKey = "dashboard" | "settings";

type LoadState = "idle" | "loading" | "error";

type ThemeMode = "light" | "dark";

type AppSettings = {
  vault_path?: string | null;
  theme?: string | null;
  accent_color?: string | null;
};

type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[];
  fullPath?: string;
};

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";
const DEFAULT_THEME: ThemeMode = "light";
const DEFAULT_ACCENT = "#E07A5F";
const ACCENT_PALETTE = [
  "#E07A5F",
  "#2F8F83",
  "#3A7D44",
  "#3B82F6",
  "#D97706",
  "#DC2626",
];

const FolderIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

const FileIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M14 4v5h5" />
  </svg>
);

const normalizeRelativePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\/+/, "");

const buildTree = (files: VaultFile[]): TreeNode[] => {
  const root: TreeNode = {
    name: "__root__",
    path: "",
    type: "dir",
    children: [],
  };

  for (const file of files) {
    const relative = normalizeRelativePath(file.relative_path);
    const parts = relative.split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }
    let current = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (isFile) {
        const existing = current.children?.find(
          (child) => child.type === "file" && child.path === currentPath,
        );
        if (!existing) {
          current.children = current.children ?? [];
          current.children.push({
            name: part,
            path: currentPath,
            type: "file",
            fullPath: file.path,
          });
        }
        return;
      }

      let next = current.children?.find(
        (child) => child.type === "dir" && child.name === part,
      );
      if (!next) {
        next = {
          name: part,
          path: currentPath,
          type: "dir",
          children: [],
        };
        current.children = current.children ?? [];
        current.children.push(next);
      }
      current = next;
    });
  }

  return sortNodes(root.children ?? []);
};

const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((node) => {
    if (node.type === "dir" && node.children) {
      return { ...node, children: sortNodes(node.children) };
    }
    return node;
  });
};

const vaultBaseName = (value: string | null) => {
  if (!value) {
    return "Vault";
  }
  const trimmed = value.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || "Vault";
};

const asErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

const normalizeHex = (value: string) => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }
  if (!trimmed.startsWith("#")) {
    return `#${trimmed}`;
  }
  return `#${trimmed.slice(1)}`;
};

const isValidHex = (value: string) => /^#[0-9A-F]{6}$/.test(value);

const hexToRgb = (value: string) => {
  if (!isValidHex(value)) {
    return null;
  }
  const hex = value.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (channel: number) =>
    channel.toString(16).toUpperCase().padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixChannel = (from: number, to: number, amount: number) =>
  Math.round(from + (to - from) * amount);

const mixRgb = (
  rgb: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
) => ({
  r: mixChannel(rgb.r, target.r, amount),
  g: mixChannel(rgb.g, target.g, amount),
  b: mixChannel(rgb.b, target.b, amount),
});

const contrastFor = (rgb: { r: number; g: number; b: number }) => {
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance > 170 ? "#1A1A1A" : "#FFFFFF";
};

const buildAccentTokens = (value: string) => {
  const normalized = normalizeHex(value);
  const rgb = hexToRgb(normalized) ?? hexToRgb(DEFAULT_ACCENT)!;
  const strong = mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.18);
  const highlight = mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.28);
  return {
    accent: rgbToHex(rgb.r, rgb.g, rgb.b),
    accentStrong: rgbToHex(strong.r, strong.g, strong.b),
    accentSoft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    accentHighlight: rgbToHex(highlight.r, highlight.g, highlight.b),
    accentBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
    accentContrast: contrastFor(rgb),
    accentContrastStrong: contrastFor(strong),
  };
};

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

const applyAccentColor = (value: string) => {
  const root = document.documentElement;
  const tokens = buildAccentTokens(value);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-strong", tokens.accentStrong);
  root.style.setProperty("--accent-soft", tokens.accentSoft);
  root.style.setProperty("--accent-highlight", tokens.accentHighlight);
  root.style.setProperty("--accent-border", tokens.accentBorder);
  root.style.setProperty("--accent-contrast", tokens.accentContrast);
  root.style.setProperty("--accent-contrast-strong", tokens.accentContrastStrong);
};

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [preview, setPreview] = useState("");
  const [listState, setListState] = useState<LoadState>("idle");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [listError, setListError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [treeSelection, setTreeSelection] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const fileCountLabel = useMemo(() => {
    if (!vaultPath) {
      return "Kein Vault gewaehlt";
    }
    if (files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${files.length} Markdown-Datei${files.length === 1 ? "" : "en"}`;
  }, [files.length, vaultPath]);

  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const treeNodes = useMemo(() => buildTree(files), [files]);

  const saveSettings = useCallback(
    async (settings: { vaultPath: string | null; theme: ThemeMode; accentColor: string }) => {
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
    async (updates: {
      vaultPath?: string | null;
      theme?: ThemeMode;
      accentColor?: string;
    }) => {
      if (!settingsLoaded) {
        return false;
      }
      const nextSettings = {
        vaultPath: updates.vaultPath ?? vaultPath,
        theme: updates.theme ?? theme,
        accentColor: updates.accentColor ?? accentColor,
      };
      return saveSettings(nextSettings);
    },
    [accentColor, saveSettings, settingsLoaded, theme, vaultPath],
  );

  const loadVault = useCallback(
    async (
      path: string,
      options: {
        persist: boolean;
        clearOnFailure?: boolean;
        errorMessage?: string;
      },
    ) => {
      setListError("");
      setPreviewError("");
      setVaultPath(path);
      setSelectedFile(null);
      setTreeSelection(null);
      setPreview("");
      setFiles([]);
      setListState("loading");
      try {
        const results = await invoke<VaultFile[]>("list_markdown_files", {
          vaultPath: path,
        });
        setFiles(results);
        setListState("idle");
        if (options.persist) {
          await persistSettings({ vaultPath: path });
        }
        return true;
      } catch (error) {
        const message = asErrorMessage(error, "Failed to list markdown files.");
        setListError(options.errorMessage ?? message);
        setListState("error");
        if (options.clearOnFailure) {
          setVaultPath(null);
          await persistSettings({ vaultPath: null });
        }
        return false;
      }
    },
    [persistSettings],
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
        setSettingsLoaded(true);

        if (settings.vault_path) {
          const loaded = await loadVault(settings.vault_path, {
            persist: false,
            clearOnFailure: false,
            errorMessage:
              "Gespeicherter Vault ist nicht verfuegbar. Bitte neu auswaehlen.",
          });
          if (!loaded) {
            setVaultPath(null);
            await saveSettings({
              vaultPath: null,
              theme: storedTheme,
              accentColor: resolvedAccent,
            });
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Failed to load settings", error);
        setSettingsLoaded(true);
      }
    };

    void restoreSettings();

    return () => {
      cancelled = true;
    };
  }, [loadVault, saveSettings]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  const handlePickVault = async () => {
    setListError("");
    setPreviewError("");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Vault auswaehlen",
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    await loadVault(selected, { persist: true });
  };

  const handleSelectFile = async (file: VaultFile) => {
    setSelectedFile(file);
    setPreview("");
    setPreviewError("");
    setPreviewState("loading");
    try {
      const contents = await invoke<string>("read_text_file", {
        path: file.path,
      });
      setPreview(contents);
      setPreviewState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Failed to load file contents.");
      setPreviewError(message);
      setPreviewState("error");
    }
  };

  const handleThemeToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTheme: ThemeMode = event.target.checked ? "dark" : "light";
    setTheme(nextTheme);
    void persistSettings({ theme: nextTheme });
  };

  const handleAccentPick = (value: string) => {
    const normalized = normalizeHex(value);
    if (!isValidHex(normalized)) {
      return;
    }
    setAccentError("");
    setAccentColor(normalized);
    setAccentDraft(normalized);
    void persistSettings({ accentColor: normalized });
  };

  const handleAccentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeHex(event.target.value);
    setAccentDraft(nextValue);
    if (!nextValue) {
      setAccentError("");
      return;
    }
    if (isValidHex(nextValue)) {
      setAccentError("");
      setAccentColor(nextValue);
      void persistSettings({ accentColor: nextValue });
    } else {
      setAccentError("HEX muss #RRGGBB sein.");
    }
  };

  const handleCopyAccent = async () => {
    try {
      await navigator.clipboard.writeText(accentColor);
    } catch (error) {
      console.error("Failed to copy accent color", error);
    }
  };

  const renderTreeNodes = (nodes: TreeNode[]) =>
    nodes.map((node) => {
      if (node.type === "dir") {
        return (
          <details className="tree-dir" key={node.path}>
            <summary className="tree-item">
              <span className="tree-icon">
                <FolderIcon />
              </span>
              <span className="tree-name">{node.name}</span>
            </summary>
            <div className="tree-children">{renderTreeNodes(node.children ?? [])}</div>
          </details>
        );
      }

      return (
        <button
          type="button"
          key={node.path}
          className={`tree-item tree-file ${
            treeSelection === node.path ? "active" : ""
          }`}
          onClick={() => setTreeSelection(node.path)}
          title={node.path}
        >
          <span className="tree-icon">
            <FileIcon />
          </span>
          <span className="tree-name">{node.name}</span>
        </button>
      );
    });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FMD</div>
          <div className="brand-text">
            <span className="brand-title">FMD Flashcard</span>
            <span className="brand-sub">Vault-first study workspace</span>
          </div>
        </div>
        <nav className="nav">
          <button
            type="button"
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="vault-status">
            <span className="label">Vault</span>
            <span className="value">{vaultPath ? "Aktiv" : "Nicht gesetzt"}</span>
          </div>
          <button
            type="button"
            className={`nav-icon ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            aria-label="Einstellungen"
            title="Einstellungen"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <circle cx="9" cy="6" r="2.5" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <circle cx="14" cy="12" r="2.5" />
              <line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="11" cy="18" r="2.5" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="content">
        {activeTab === "dashboard" ? (
          <>
            <header className="content-header">
              <div>
                <p className="eyebrow">Dashboard</p>
                <h1>Vault Uebersicht</h1>
                <p className="muted">
                  Waehle einen Vault, scanne Markdown-Dateien und sieh dir Inhalte
                  sofort an.
                </p>
              </div>
            </header>

            <details className="vault-details">
              <summary>
                <span>Datenverzeichnis</span>
                <span className="vault-summary">{fileCountLabel}</span>
              </summary>
              <div className="vault-body">
                {!vaultPath ? (
                  <div className="empty-state">
                    Waehle einen Vault, um das Verzeichnis anzuzeigen.
                  </div>
                ) : null}
                {listState === "loading" ? (
                  <span className="chip">Scanne...</span>
                ) : null}
                {listState === "error" ? (
                  <div className="error">{listError}</div>
                ) : null}
                {vaultPath && listState === "idle" && treeNodes.length === 0 ? (
                  <div className="empty-state">
                    Keine Markdown-Dateien in diesem Vault.
                  </div>
                ) : null}
                {vaultPath && listState === "idle" && treeNodes.length > 0 ? (
                  <div className="vault-tree">
                    <details className="tree-dir" open>
                      <summary className="tree-item">
                        <span className="tree-icon">
                          <FolderIcon />
                        </span>
                        <span className="tree-name">{vaultRootName}</span>
                      </summary>
                      <div className="tree-children">{renderTreeNodes(treeNodes)}</div>
                    </details>
                  </div>
                ) : null}
              </div>
            </details>

            <div className="workspace">
              <section className="panel list-panel">
                <div className="panel-header">
                  <div>
                    <h2>Notizen</h2>
                    <p className="muted">{fileCountLabel}</p>
                  </div>
                  {listState === "loading" ? (
                    <span className="chip">Scanne...</span>
                  ) : null}
                </div>
                <div className="panel-body">
                  {!vaultPath ? (
                    <div className="empty-state">
                      Waehle einen Vault, um die Liste zu fuellen.
                    </div>
                  ) : null}
                  {listState === "error" ? (
                    <div className="error">{listError}</div>
                  ) : null}
                  {vaultPath && listState === "idle" && files.length === 0 ? (
                    <div className="empty-state">
                      Keine Markdown-Dateien in diesem Vault.
                    </div>
                  ) : null}
                  {vaultPath && listState !== "error" ? (
                    <ul className="file-list">
                      {files.map((file) => (
                        <li key={file.path}>
                          <button
                            type="button"
                            className={`file-item ${
                              selectedFile?.path === file.path ? "active" : ""
                            }`}
                            onClick={() => handleSelectFile(file)}
                          >
                            <span className="file-name">{file.relative_path}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>

              <section className="panel preview-panel">
                <div className="panel-header">
                  <div>
                    <h2>Vorschau</h2>
                    <p className="muted">
                      {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
                    </p>
                  </div>
                  {previewState === "loading" ? (
                    <span className="chip">Lade...</span>
                  ) : null}
                </div>
                <div className="panel-body">
                  {previewState === "error" ? (
                    <div className="error">{previewError}</div>
                  ) : null}
                  <pre className="preview">
                    {preview || emptyPreview}
                  </pre>
                </div>
              </section>
            </div>
          </>
        ) : (
          <>
            <header className="content-header">
              <div>
                <p className="eyebrow">Settings</p>
                <h1>Einstellungen</h1>
                <p className="muted">
                  Passe deinen Workflow an. Die naechsten Features bauen auf dieser
                  Vault-Basis auf.
                </p>
              </div>
              <div className="actions">
                <button type="button" className="primary" onClick={handlePickVault}>
                  Vault auswaehlen
                </button>
              </div>
            </header>

            <div className="settings-grid">
              <section className="panel appearance-panel">
                <h2>Erscheinungsbild</h2>
                <p className="muted">
                  Theme und Akzentfarbe praegen die Oberflaeche und bleiben
                  gespeichert.
                </p>
                <div className="setting-row">
                  <span className="label">Theme</span>
                  <div className="theme-toggle">
                    <span className="toggle-label">Hell</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={theme === "dark"}
                        onChange={handleThemeToggle}
                        aria-label="Theme umschalten"
                      />
                      <span className="slider" />
                    </label>
                    <span className="toggle-label">Dunkel</span>
                  </div>
                  <span className="helper-text">
                    Wechselt Hintergrund, Kontrast und Panels.
                  </span>
                </div>
                <div className="setting-row">
                  <span className="label">Akzentfarbe</span>
                  <div className="accent-controls">
                    <input
                      type="color"
                      className="color-wheel"
                      value={accentColor}
                      onChange={(event) => handleAccentPick(event.target.value)}
                      aria-label="Akzentfarbe auswaehlen"
                    />
                    <div className="accent-palette">
                      {ACCENT_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`accent-swatch ${
                            accentColor === color ? "active" : ""
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleAccentPick(color)}
                          aria-label={`Akzentfarbe ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="accent-hex">
                    <input
                      type="text"
                      className="hex-input"
                      value={accentDraft}
                      onChange={handleAccentInputChange}
                      placeholder="#RRGGBB"
                      aria-label="Akzentfarbe als HEX"
                    />
                    <button
                      type="button"
                      className="ghost small"
                      onClick={handleCopyAccent}
                    >
                      Kopieren
                    </button>
                  </div>
                  <span className={`helper-text ${accentError ? "error-text" : ""}`}>
                    {accentError || "HEX Wert der Akzentfarbe (#RRGGBB)."}
                  </span>
                </div>
              </section>
              <section className="panel">
                <h2>Vault Status</h2>
                <p className="muted">
                  Aktiver Pfad wird hier gespeichert. Bald folgen Auto-Scan und
                  Watcher.
                </p>
                <div className="setting-row">
                  <span className="label">Aktueller Vault</span>
                  <span className="value path-value">
                    {vaultPath ?? "Nicht gesetzt"}
                  </span>
                </div>
              </section>
              <section className="panel">
                <h2>Naechste Schritte</h2>
                <p className="muted">
                  Parser, Karten-Generator und Sync werden als naechste vertikale
                  Scheiben ausgebaut.
                </p>
                <div className="pill-grid">
                  <span className="pill">Parser</span>
                  <span className="pill">Card Build</span>
                  <span className="pill">Vault Watcher</span>
                </div>
              </section>
              <section className="panel">
                <h2>Aktivitaet</h2>
                <p className="muted">
                  Zuletzt gelesene Datei und Import-Logs erscheinen hier.
                </p>
                <div className="setting-row">
                  <span className="label">Zuletzt</span>
                  <span className="value">
                    {selectedFile?.relative_path ?? "Noch nichts geladen"}
                  </span>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
