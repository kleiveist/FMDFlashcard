import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import "./App.css";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  parseFlashcards,
  type ClozeSegment,
  type Flashcard,
} from "./lib/flashcards";

type VaultFile = {
  path: string;
  relative_path: string;
};

type TabKey = "dashboard" | "flashcard" | "settings";

type LoadState = "idle" | "loading" | "error";

type ThemeMode = "light" | "dark";

type FlashcardOrder = "in-order" | "random";
type FlashcardMode = "multiple-choice" | "yes-no";
type FlashcardBoxes = "3" | "5" | "7";
type FlashcardScope = "current" | "vault";
type FlashcardPageSize = 2 | 5 | 10;

type ClozeDragPayload = {
  cardIndex: number;
  tokenId: string;
};

type ClozeBlankSegment = Extract<ClozeSegment, { type: "blank" }>;

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
  file?: VaultFile;
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
const CLOZE_TOKEN_DRAG_TYPE = "application/x-cloze-token";

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
            file,
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

const getClozeBlanks = (segments: ClozeSegment[]) =>
  segments.filter((segment): segment is ClozeBlankSegment => segment.type === "blank");

const isClozeBlankFilled = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return value.trim().length > 0;
  }
  return tokenById.has(value);
};

const isClozeBlankCorrect = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return isInputAnswerMatch(value, blank.solution);
  }
  return isDragAnswerMatch(tokenById.get(value) ?? "", blank.solution);
};

const areClozeBlanksComplete = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankFilled(blank, responses, tokenById));
};

const isClozeCardCorrect = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankCorrect(blank, responses, tokenById));
};

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [preview, setPreview] = useState("");
  const [listState, setListState] = useState<LoadState>("idle");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [rawPreview, setRawPreview] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardOrder, setFlashcardOrder] =
    useState<FlashcardOrder>("in-order");
  const [flashcardMode, setFlashcardMode] =
    useState<FlashcardMode>("multiple-choice");
  const [flashcardBoxes, setFlashcardBoxes] =
    useState<FlashcardBoxes>("3");
  const [flashcardScope, setFlashcardScope] =
    useState<FlashcardScope>("current");
  const [flashcardPageSize, setFlashcardPageSize] =
    useState<FlashcardPageSize>(2);
  const [spacedRepetitionEnabled, setSpacedRepetitionEnabled] = useState(false);
  const [solutionRevealEnabled, setSolutionRevealEnabled] = useState(true);
  const [statsResetMode, setStatsResetMode] = useState<"scan" | "session">(
    "scan",
  );
  const [flashcardPage, setFlashcardPage] = useState(0);
  const [isFlashcardScanning, setIsFlashcardScanning] = useState(false);
  const [flashcardSelections, setFlashcardSelections] = useState<
    Record<number, string>
  >({});
  const [flashcardSubmissions, setFlashcardSubmissions] = useState<
    Record<number, boolean>
  >({});
  const [flashcardClozeResponses, setFlashcardClozeResponses] = useState<
    Record<number, Record<string, string>>
  >({});
  const [listError, setListError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [maxFilesPerScan, setMaxFilesPerScan] = useState("");
  const [scanParallelism, setScanParallelism] = useState<
    "low" | "medium" | "high"
  >("medium");

  const fileCountLabel = useMemo(() => {
    if (!vaultPath) {
      return "Kein Vault gewaehlt";
    }
    if (files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${files.length} Markdown-Datei${files.length === 1 ? "" : "en"}`;
  }, [files.length, vaultPath]);

  const flashcardStatusLabel = "Not scanned yet";
  const lastOpenedFile = selectedFile?.relative_path;
  const vaultIndexedComplete = useMemo(
    () => Boolean(vaultPath) && listState === "idle",
    [listState, vaultPath],
  );

  const flashcardPageCount = useMemo(
    () => Math.ceil(flashcards.length / flashcardPageSize),
    [flashcardPageSize, flashcards.length],
  );

  const flashcardPageIndex = useMemo(
    () => Math.min(flashcardPage, Math.max(0, flashcardPageCount - 1)),
    [flashcardPage, flashcardPageCount],
  );

  const flashcardPageStart = flashcardPageIndex * flashcardPageSize;

  const visibleFlashcards = useMemo(() => {
    return flashcards.slice(
      flashcardPageStart,
      flashcardPageStart + flashcardPageSize,
    );
  }, [flashcardPageSize, flashcards, flashcardPageStart]);

  const canGoBack = flashcardPageIndex > 0;
  const canGoNext = flashcardPageIndex < flashcardPageCount - 1;

  const { correctCount, incorrectCount, correctPercent } = useMemo(() => {
    let correct = 0;
    let incorrect = 0;

    flashcards.forEach((card, index) => {
      if (!flashcardSubmissions[index]) {
        return;
      }
      if (card.kind === "multiple-choice") {
        if (card.correctKeys.length === 0) {
          return;
        }
        const selected = flashcardSelections[index];
        if (selected && card.correctKeys.includes(selected)) {
          correct += 1;
        } else {
          incorrect += 1;
        }
        return;
      }

      const blanks = getClozeBlanks(card.segments);
      if (blanks.length === 0) {
        return;
      }
      const responses = flashcardClozeResponses[index] ?? {};
      if (isClozeCardCorrect(card, responses)) {
        correct += 1;
      } else {
        incorrect += 1;
      }
    });

    const total = correct + incorrect;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { correctCount: correct, incorrectCount: incorrect, correctPercent: percent };
  }, [flashcards, flashcardClozeResponses, flashcardSelections, flashcardSubmissions]);

  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${correctPercent}%`,
      }) as CSSProperties,
    [correctPercent],
  );

  const statsTotal = correctCount + incorrectCount;
  const totalQuestions = flashcards.length;
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";

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
      setPreview("");
      setFlashcards([]);
      setFlashcardSelections({});
      setFlashcardSubmissions({});
      setFlashcardClozeResponses({});
      setFlashcardPage(0);
      setIsFlashcardScanning(false);
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

  useEffect(() => {
    const maxPage = Math.max(0, flashcardPageCount - 1);
    if (flashcardPage > maxPage) {
      setFlashcardPage(maxPage);
    }
  }, [flashcardPage, flashcardPageCount]);

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

    const previousState = {
      vaultPath,
      files,
      selectedFile,
      preview,
      flashcards,
      flashcardSelections,
      flashcardSubmissions,
      flashcardClozeResponses,
      flashcardPage,
      listState,
      previewState,
      listError,
      previewError,
    };

    const loaded = await loadVault(selected, {
      persist: true,
      clearOnFailure: false,
      errorMessage: "Ausgewaehlter Vault ist nicht verfuegbar.",
    });

    if (!loaded) {
      setVaultPath(previousState.vaultPath);
      setFiles(previousState.files);
      setSelectedFile(previousState.selectedFile);
      setPreview(previousState.preview);
      setFlashcards(previousState.flashcards);
      setFlashcardSelections(previousState.flashcardSelections);
      setFlashcardSubmissions(previousState.flashcardSubmissions);
      setFlashcardClozeResponses(previousState.flashcardClozeResponses);
      setFlashcardPage(previousState.flashcardPage);
      setListState(previousState.listState);
      setPreviewState(previousState.previewState);
      setListError("Ausgewaehlter Vault ist nicht verfuegbar.");
      setPreviewError(previousState.previewError);
    }
  };

  const handleSelectFile = async (file: VaultFile) => {
    setSelectedFile(file);
    setPreview("");
    setFlashcards([]);
    setFlashcardSelections({});
    setFlashcardSubmissions({});
    setFlashcardClozeResponses({});
    setFlashcardPage(0);
    setIsFlashcardScanning(false);
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

  const handleFlashcardScan = useCallback(async () => {
    setIsFlashcardScanning(true);
    setFlashcards([]);
    setFlashcardSelections({});
    setFlashcardSubmissions({});
    setFlashcardClozeResponses({});
    setFlashcardPage(0);

    try {
      if (flashcardScope === "vault") {
        if (!vaultPath || files.length === 0) {
          setFlashcards([]);
          return;
        }

        const results = await Promise.allSettled(
          files.map(async (file) => {
            const contents = await invoke<string>("read_text_file", {
              path: file.path,
            });
            return parseFlashcards(contents);
          }),
        );

        const merged: Flashcard[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            merged.push(...result.value);
          } else {
            console.warn(
              "Failed to read markdown file",
              files[index]?.path,
              result.reason,
            );
          }
        });

        setFlashcards(merged);
        return;
      }

      const cards = parseFlashcards(preview);
      setFlashcards(cards);
    } finally {
      setIsFlashcardScanning(false);
    }
  }, [files, flashcardScope, preview, vaultPath]);

  const persistSpacedRepetition = useCallback((enabled: boolean) => {
    void enabled;
  }, []);

  const handleSpacedRepetitionToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setSpacedRepetitionEnabled(enabled);
    persistSpacedRepetition(enabled);
  };

  const handleFlashcardOptionSelect = useCallback(
    (cardIndex: number, key: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardSelections((prev) => ({ ...prev, [cardIndex]: key }));
    },
    [flashcardSubmissions],
  );

  const handleFlashcardSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean) => {
      if (!canSubmit) {
        return;
      }
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardSubmissions((prev) => ({ ...prev, [cardIndex]: true }));
    },
    [flashcardSubmissions],
  );

  const handleFlashcardPageBack = useCallback(() => {
    setFlashcardPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleFlashcardPageNext = useCallback(() => {
    if (flashcardPageCount <= 0) {
      return;
    }
    setFlashcardPage((prev) => Math.min(flashcardPageCount - 1, prev + 1));
  }, [flashcardPageCount]);

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

  const handleCopyVaultPath = async () => {
    if (!vaultPath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(vaultPath);
    } catch (error) {
      console.error("Failed to copy vault path", error);
    }
  };

  const handleRescanVault = useCallback(async () => {
    if (!vaultPath || listState === "loading") {
      return;
    }
    setListError("");
    setListState("loading");
    try {
      const results = await invoke<VaultFile[]>("list_markdown_files", {
        vaultPath,
      });
      setFiles(results);
      setListState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Vault konnte nicht neu gescannt werden.");
      setListError(message);
      setListState("error");
    }
  }, [listState, vaultPath]);

  const handleMaxFilesPerScanChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.trim();
    if (nextValue === "" || /^[0-9]+$/.test(nextValue)) {
      setMaxFilesPerScan(nextValue);
    }
  };

  const setClozeDragPayload = (
    event: DragEvent<HTMLElement>,
    payload: ClozeDragPayload,
  ) => {
    event.dataTransfer.setData(CLOZE_TOKEN_DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const getClozeDragPayload = (event: DragEvent<HTMLElement>) => {
    const raw = event.dataTransfer.getData(CLOZE_TOKEN_DRAG_TYPE);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as ClozeDragPayload;
      if (
        typeof parsed.cardIndex !== "number" ||
        typeof parsed.tokenId !== "string"
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const handleClozeTokenDragStart = (
    event: DragEvent<HTMLElement>,
    payload: ClozeDragPayload,
  ) => {
    event.dataTransfer.clearData();
    setClozeDragPayload(event, payload);
  };

  const handleClozeBlankDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleClozeInputChange = (
    cardIndex: number,
    blankId: string,
    value: string,
  ) => {
    setFlashcardClozeResponses((prev) => {
      const current = { ...(prev[cardIndex] ?? {}) };
      current[blankId] = value;
      return { ...prev, [cardIndex]: current };
    });
  };

  const handleClozeTokenDrop = (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => {
    event.preventDefault();
    if (flashcardSubmissions[cardIndex]) {
      return;
    }
    const payload = getClozeDragPayload(event);
    if (!payload || payload.cardIndex !== cardIndex) {
      return;
    }
    if (!validTokenIds.has(payload.tokenId)) {
      return;
    }
    if (!dragBlankIds.has(blankId)) {
      return;
    }
    setFlashcardClozeResponses((prev) => {
      const current = { ...(prev[cardIndex] ?? {}) };
      Object.keys(current).forEach((key) => {
        if (!dragBlankIds.has(key)) {
          return;
        }
        if (current[key] === payload.tokenId) {
          delete current[key];
        }
      });
      current[blankId] = payload.tokenId;
      return { ...prev, [cardIndex]: current };
    });
  };

  const handleClozeTokenRemove = (cardIndex: number, blankId: string) => {
    if (flashcardSubmissions[cardIndex]) {
      return;
    }
    setFlashcardClozeResponses((prev) => {
      const current = { ...(prev[cardIndex] ?? {}) };
      delete current[blankId];
      return { ...prev, [cardIndex]: current };
    });
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

      const fileRef =
        node.file ??
        (node.fullPath
          ? { path: node.fullPath, relative_path: node.path }
          : null);
      const isActive = !!fileRef && selectedFile?.path === fileRef.path;

      return (
        <button
          type="button"
          key={node.path}
          className={`tree-item tree-file ${isActive ? "active" : ""}`}
          onClick={() => fileRef && handleSelectFile(fileRef)}
          title={node.path}
          disabled={!fileRef}
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
          <button
            type="button"
            className={`nav-item ${activeTab === "flashcard" ? "active" : ""}`}
            onClick={() => setActiveTab("flashcard")}
          >
            Flashcard
          </button>
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="vault-status"
            onClick={handlePickVault}
            title={vaultPath ?? "Vault auswaehlen"}
            aria-label="Vault auswaehlen"
          >
            <span className="label">Aktiver Vault</span>
            <span className="value">
              Vault: {vaultPath ? vaultRootName : "Nicht gesetzt"}
            </span>
          </button>
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
                {listError ? <div className="error">{listError}</div> : null}
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
                  {listError ? <div className="error">{listError}</div> : null}
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
                  <div className="preview-actions">
                    <button
                      type="button"
                      className={`ghost small ${rawPreview ? "active" : ""}`}
                      onClick={() => setRawPreview((prev) => !prev)}
                      aria-pressed={rawPreview}
                      disabled={!selectedFile}
                    >
                      {rawPreview ? "Markdown" : "Rohtext"}
                    </button>
                    {previewState === "loading" ? (
                      <span className="chip">Lade...</span>
                    ) : null}
                  </div>
                </div>
                <div className="panel-body">
                  {previewState === "error" ? (
                    <div className="error">{previewError}</div>
                  ) : null}
                  {preview ? (
                    <div className={`preview ${rawPreview ? "raw" : "markdown"}`}>
                      {rawPreview ? (
                        <pre>{preview}</pre>
                      ) : (
                        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                          {preview}
                        </ReactMarkdown>
                      )}
                    </div>
                  ) : (
                    <div className="preview placeholder">{emptyPreview}</div>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : activeTab === "flashcard" ? (
          <>
            <div className="flashcard-layout">
              <section className="panel flashcard-panel">
                <div className="panel-header">
                  <div>
                    <h2>Flashcards</h2>
                    {flashcards.length === 0 ? (
                      <p className="muted">{flashcardStatusLabel}</p>
                    ) : null}
                  </div>
                </div>
                <div className="panel-body">
                  {flashcards.length === 0 ? (
                    <div className="empty-state">
                      Select a note and start the flashcard scan.
                    </div>
                  ) : (
                    <div className="flashcard-list">
                      {visibleFlashcards.map((card, localIndex) => {
                        const cardIndex = flashcardPageStart + localIndex;
                        const submitted = !!flashcardSubmissions[cardIndex];
                        if (card.kind === "cloze") {
                          const blanks = getClozeBlanks(card.segments);
                          const dragBlanks = blanks.filter(
                            (blank) => blank.kind === "drag",
                          );
                          const dragBlankIds = new Set(
                            dragBlanks.map((blank) => blank.id),
                          );
                          const responses = flashcardClozeResponses[cardIndex] ?? {};
                          const tokenById = new Map(
                            card.dragTokens.map((token) => [token.id, token.value]),
                          );
                          const assignedTokenIds = new Set(
                            dragBlanks
                              .map((blank) => responses[blank.id])
                              .filter((tokenId) => tokenById.has(tokenId)),
                          );
                          const hasDragTokens = card.dragTokens.length > 0;
                          const validTokenIds = new Set(
                            card.dragTokens.map((token) => token.id),
                          );
                          const canSubmit = areClozeBlanksComplete(card, responses);
                          const isCorrect = isClozeCardCorrect(card, responses);
                          const resultLabel = submitted
                            ? isCorrect
                              ? "Correct"
                              : "Incorrect"
                            : "";
                          let blankPosition = 0;

                          return (
                            <article
                              className="flashcard-item cloze-card"
                              key={`flashcard-${cardIndex}`}
                            >
                              <h3 className="flashcard-question">{card.question}</h3>
                              <div className="cloze-text">
                                {card.segments.map((segment, segmentIndex) => {
                                  if (segment.type === "text") {
                                    return (
                                      <span key={`cloze-text-${cardIndex}-${segmentIndex}`}>
                                        {segment.value}
                                      </span>
                                    );
                                  }

                                  blankPosition += 1;
                                  const blankNumber = blankPosition;

                                  if (segment.kind === "input") {
                                    const value = responses[segment.id] ?? "";
                                    const isBlankCorrect = submitted
                                      ? isInputAnswerMatch(value, segment.solution)
                                      : false;
                                    const blankClasses = [
                                      "cloze-blank",
                                      "input",
                                      value.trim() ? "filled" : "",
                                      submitted
                                        ? isBlankCorrect
                                          ? "correct"
                                          : "incorrect"
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ");

                                    return (
                                      <span
                                        key={`cloze-blank-${cardIndex}-${segmentIndex}`}
                                        className={blankClasses}
                                      >
                                        <input
                                          type="text"
                                          className="cloze-input"
                                          value={value}
                                          onChange={(event) =>
                                            handleClozeInputChange(
                                              cardIndex,
                                              segment.id,
                                              event.target.value,
                                            )
                                          }
                                          disabled={submitted}
                                          placeholder="____"
                                          aria-label={`Blank ${blankNumber}`}
                                        />
                                      </span>
                                    );
                                  }

                                  const assignedTokenId = responses[segment.id] ?? "";
                                  const assignedValue = assignedTokenId
                                    ? tokenById.get(assignedTokenId) ?? ""
                                    : "";
                                  const hasToken = Boolean(assignedValue);
                                  const isBlankCorrect = submitted
                                    ? isDragAnswerMatch(assignedValue, segment.solution)
                                    : false;
                                  const blankClasses = [
                                    "cloze-blank",
                                    "drag",
                                    hasToken ? "filled" : "",
                                    submitted ? (isBlankCorrect ? "correct" : "incorrect") : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ");

                                  return (
                                    <span
                                      key={`cloze-blank-${cardIndex}-${segmentIndex}`}
                                      className={blankClasses}
                                      aria-label={`Drop zone ${blankNumber}`}
                                      onDragOver={handleClozeBlankDragOver}
                                      onDrop={(event) =>
                                        handleClozeTokenDrop(
                                          event,
                                          cardIndex,
                                          segment.id,
                                          validTokenIds,
                                          dragBlankIds,
                                        )
                                      }
                                    >
                                      {hasToken ? (
                                        <span className="cloze-token">
                                          <button
                                            type="button"
                                            className="token-chip"
                                            draggable={!submitted}
                                            onDragStart={(event) =>
                                              handleClozeTokenDragStart(event, {
                                                cardIndex,
                                                tokenId: assignedTokenId,
                                              })
                                            }
                                            disabled={submitted}
                                          >
                                            {assignedValue}
                                          </button>
                                          {!submitted ? (
                                            <button
                                              type="button"
                                              className="token-remove"
                                              onClick={() =>
                                                handleClozeTokenRemove(
                                                  cardIndex,
                                                  segment.id,
                                                )
                                              }
                                              aria-label="Remove token"
                                            >
                                              x
                                            </button>
                                          ) : null}
                                        </span>
                                      ) : (
                                        <span className="cloze-placeholder">
                                          Drop token
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                              {hasDragTokens ? (
                                <div className="token-section">
                                  <span className="label">Tokens</span>
                                  <div className="token-pool">
                                    {card.dragTokens.map((token) => {
                                      const isUsed = assignedTokenIds.has(token.id);
                                      return (
                                        <button
                                          key={`token-${cardIndex}-${token.id}`}
                                          type="button"
                                          className={`token-chip ${isUsed ? "used" : ""}`}
                                          draggable={!submitted && !isUsed}
                                          onDragStart={(event) =>
                                            handleClozeTokenDragStart(event, {
                                              cardIndex,
                                              tokenId: token.id,
                                            })
                                          }
                                          disabled={submitted || isUsed}
                                        >
                                          {token.value}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                              <div className="flashcard-actions">
                                <button
                                  type="button"
                                  className="ghost small flashcard-submit"
                                  onClick={() =>
                                    handleFlashcardSubmit(cardIndex, canSubmit)
                                  }
                                  disabled={submitted || !canSubmit}
                                >
                                  Submit
                                </button>
                                {submitted ? (
                                  <span
                                    className={`flashcard-result ${
                                      isCorrect ? "correct" : "incorrect"
                                    }`}
                                  >
                                    {resultLabel}
                                  </span>
                                ) : null}
                              </div>
                              {submitted ? (
                                <div className="token-solution">
                                  <span className="label">Solution</span>
                                  <div className="cloze-solution">
                                    {card.segments.map((segment, segmentIndex) => {
                                      if (segment.type === "text") {
                                        return (
                                          <span
                                            key={`solution-text-${cardIndex}-${segmentIndex}`}
                                          >
                                            {segment.value}
                                          </span>
                                        );
                                      }
                                      return (
                                        <span
                                          key={`solution-blank-${cardIndex}-${segmentIndex}`}
                                          className="cloze-solution-token"
                                        >
                                          {segment.solution}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        }

                        const selectedKey = flashcardSelections[cardIndex] ?? "";
                        const hasSolutions = card.correctKeys.length > 0;
                        const selectionIsCorrect =
                          hasSolutions && selectedKey
                            ? card.correctKeys.includes(selectedKey)
                            : false;
                        const resultLabel = submitted
                          ? hasSolutions
                            ? selectionIsCorrect
                              ? "Correct"
                              : "Incorrect"
                            : "No solution defined"
                          : "";

                        return (
                          <article
                            className="flashcard-item"
                            key={`flashcard-${cardIndex}`}
                          >
                            <h3 className="flashcard-question">{card.question}</h3>
                            <ul className="flashcard-options">
                              {card.options.map((option) => {
                                const isSelected = selectedKey === option.key;
                                const isCorrect =
                                  hasSolutions &&
                                  card.correctKeys.includes(option.key);
                                const isIncorrect =
                                  hasSolutions &&
                                  submitted &&
                                  isSelected &&
                                  !isCorrect;
                                const optionClasses = [
                                  "flashcard-option",
                                  isSelected ? "selected" : "",
                                  submitted && isCorrect ? "correct" : "",
                                  isIncorrect ? "incorrect" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ");

                                return (
                                  <li key={`flashcard-${cardIndex}-${option.key}`}>
                                    <button
                                      type="button"
                                      className={optionClasses}
                                      onClick={() =>
                                        handleFlashcardOptionSelect(
                                          cardIndex,
                                          option.key,
                                        )
                                      }
                                      disabled={submitted}
                                      aria-pressed={isSelected}
                                    >
                                      <span className="flashcard-key">
                                        {option.key}
                                      </span>
                                      <span className="flashcard-text">
                                        {option.text}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="flashcard-actions">
                              <button
                                type="button"
                                className="ghost small flashcard-submit"
                                onClick={() =>
                                  handleFlashcardSubmit(cardIndex, Boolean(selectedKey))
                                }
                                disabled={!selectedKey || submitted}
                              >
                                Submit
                              </button>
                              {submitted ? (
                                <span
                                  className={`flashcard-result ${
                                    hasSolutions
                                      ? selectionIsCorrect
                                        ? "correct"
                                        : "incorrect"
                                      : "neutral"
                                  }`}
                                >
                                  {resultLabel}
                                </span>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <div className="flashcard-pagination">
                    <button
                      type="button"
                      className="ghost small"
                      onClick={handleFlashcardPageBack}
                      disabled={!canGoBack}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={handleFlashcardPageNext}
                      disabled={!canGoNext}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>

              <div className="flashcard-sidebar">
                <section className="panel toolbar-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Flashcard Tools</h2>
                      <p className="muted">Scan current notes for cards.</p>
                    </div>
                  </div>
                  <div className="panel-body">
                  <button
                    type="button"
                    className="primary"
                    onClick={handleFlashcardScan}
                    disabled={isFlashcardScanning}
                  >
                    {isFlashcardScanning ? "Scanning..." : "Flashcard"}
                  </button>
                  <div className="flashcard-controls">
                      <div className="toolbar-section">
                        <span className="label">SPACED REPETITION</span>
                        <div className="toggle-row">
                          <span className="toggle-label">Enabled</span>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={spacedRepetitionEnabled}
                              onChange={handleSpacedRepetitionToggle}
                              aria-label="Enabled"
                            />
                            <span className="slider" />
                          </label>
                        </div>
                      </div>
                      <div className="toolbar-section">
                        <span className="label">ORDER</span>
                        <div className="pill-grid">
                          <button
                            type="button"
                            className={`pill pill-button ${
                              flashcardOrder === "in-order" ? "active" : ""
                            }`}
                            aria-pressed={flashcardOrder === "in-order"}
                            onClick={() => setFlashcardOrder("in-order")}
                          >
                            In order
                          </button>
                          <button
                            type="button"
                            className={`pill pill-button ${
                              flashcardOrder === "random" ? "active" : ""
                            }`}
                            aria-pressed={flashcardOrder === "random"}
                            onClick={() => setFlashcardOrder("random")}
                          >
                            Random
                          </button>
                        </div>
                      </div>
                      <div className="toolbar-section">
                        <span className="label">MODE</span>
                        <div className="pill-grid">
                          <button
                            type="button"
                            className={`pill pill-button ${
                              flashcardMode === "multiple-choice" ? "active" : ""
                            }`}
                            aria-pressed={flashcardMode === "multiple-choice"}
                            onClick={() => setFlashcardMode("multiple-choice")}
                          >
                            Multiple Choice
                          </button>
                          <button
                            type="button"
                            className={`pill pill-button ${
                              flashcardMode === "yes-no" ? "active" : ""
                            }`}
                            aria-pressed={flashcardMode === "yes-no"}
                            onClick={() => setFlashcardMode("yes-no")}
                          >
                            Yes/No
                          </button>
                        </div>
                      </div>
                      <div className="toolbar-section">
                        <span className="label">BOXES</span>
                        <div className="pill-grid">
                          <button
                            type="button"
                            className={`pill pill-button ${
                              flashcardBoxes === "3" ? "active" : ""
                            }`}
                            aria-pressed={flashcardBoxes === "3"}
                            onClick={() => setFlashcardBoxes("3")}
                          >
                            3 Boxes
                          </button>
                          <button
                            type="button"
                            className={`pill pill-button ${
                              flashcardBoxes === "5" ? "active" : ""
                            }`}
                            aria-pressed={flashcardBoxes === "5"}
                            onClick={() => setFlashcardBoxes("5")}
                          >
                            5 Boxes
                          </button>
                          <button
                            type="button"
                            className={`pill pill-button ${
                              flashcardBoxes === "7" ? "active" : ""
                            }`}
                            aria-pressed={flashcardBoxes === "7"}
                            onClick={() => setFlashcardBoxes("7")}
                          >
                            7 Boxes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="panel stats-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Statistics</h2>
                    </div>
                  </div>
                  <div className="panel-body">
                    <div className="stats-summary">
                      <div className="stats-counters">
                        <div className="stats-counter">
                          <span className="stats-label">Correct</span>
                          <span className="stats-value">{correctCount}</span>
                        </div>
                        <div className="stats-counter">
                          <span className="stats-label">Incorrect</span>
                          <span className="stats-value">{incorrectCount}</span>
                        </div>
                        <div className="stats-counter">
                          <span className="stats-label">Total</span>
                          <span className="stats-value">{totalQuestions}</span>
                        </div>
                      </div>
                      <div
                        className={statsChartClass}
                        style={statsChartStyle}
                        role="img"
                        aria-label={`Correct ${correctCount}, Incorrect ${incorrectCount}, Total ${totalQuestions}`}
                      >
                        <div className="stats-chart-label">
                          <span className="stats-chart-total">
                            {totalQuestions}
                          </span>
                          <span className="stats-chart-caption">Total</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
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

            <section className="panel vault-index-panel">
              <div>
                <h2>Vault &amp; Index</h2>
                <p className="muted">
                  Vault path, last opened note, and index status.
                </p>
              </div>
              <div className="setting-row">
                <span className="label">Current vault path</span>
                <div className="setting-inline">
                  <span className="value path-value">{vaultPath ?? "—"}</span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={handleCopyVaultPath}
                    disabled={!vaultPath}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span className="label">Last opened</span>
                <span className="value path-value">
                  {lastOpenedFile ?? "Not loaded yet"}
                </span>
              </div>
              <div className="setting-row">
                <span className="label">Status indicators</span>
                <div className="status-list">
                  <div className="status-item">
                    <label className="status-checkbox">
                      <input
                        type="checkbox"
                        checked={vaultIndexedComplete}
                        disabled
                        aria-label="Fully processed"
                      />
                      <span>Fully processed</span>
                    </label>
                    <span className="helper-text">
                      All notes have been scanned and indexed.
                    </span>
                  </div>
                  <div className="status-item">
                    <div className="status-row">
                      <span>Watcher active</span>
                      <div className="toggle-row">
                        <span className="toggle-label">Coming later</span>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={false}
                            disabled
                            aria-label="Watcher active (coming later)"
                          />
                          <span className="slider" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="status-item">
                    <div className="status-row">
                      <span>Auto-scan</span>
                      <div className="toggle-row">
                        <span className="toggle-label">Coming later</span>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={false}
                            disabled
                            aria-label="Auto-scan (coming later)"
                          />
                          <span className="slider" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="setting-row">
                <span className="label">Actions</span>
                <div className="setting-actions">
                  <button
                    type="button"
                    className="ghost small"
                    onClick={handleRescanVault}
                    disabled={!vaultPath || listState === "loading"}
                  >
                    Rescan vault
                  </button>
                  <button type="button" className="ghost small" disabled>
                    Reset index
                  </button>
                </div>
                <span className="helper-text">Reset index is coming later.</span>
              </div>
            </section>

            <div className="settings-grid">
              <section className="panel">
                <h2>Flashcards</h2>
                <p className="muted">
                  Default behavior for scans and review sessions.
                </p>
                <div className="setting-row">
                  <span className="label">Default scope</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcardScope === "current" ? "active" : ""
                      }`}
                      aria-pressed={flashcardScope === "current"}
                      onClick={() => setFlashcardScope("current")}
                    >
                      Current note
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcardScope === "vault" ? "active" : ""
                      }`}
                      aria-pressed={flashcardScope === "vault"}
                      onClick={() => setFlashcardScope("vault")}
                    >
                      Whole vault
                    </button>
                  </div>
                </div>
                <div className="setting-row">
                  <span className="label">Default order</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcardOrder === "in-order" ? "active" : ""
                      }`}
                      aria-pressed={flashcardOrder === "in-order"}
                      onClick={() => setFlashcardOrder("in-order")}
                    >
                      In order
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcardOrder === "random" ? "active" : ""
                      }`}
                      aria-pressed={flashcardOrder === "random"}
                      onClick={() => setFlashcardOrder("random")}
                    >
                      Random
                    </button>
                  </div>
                </div>
                <div className="setting-row">
                  <span className="label">Page size</span>
                  <div className="pill-grid">
                    {[2, 5, 10].map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`pill pill-button ${
                          flashcardPageSize === size ? "active" : ""
                        }`}
                        aria-pressed={flashcardPageSize === size}
                        onClick={() => setFlashcardPageSize(size as FlashcardPageSize)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-row">
                  <span className="label">Solution reveal</span>
                  <div className="toggle-row">
                    <span className="toggle-label">
                      {solutionRevealEnabled ? "On" : "Off"}
                    </span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={solutionRevealEnabled}
                        onChange={(event) =>
                          setSolutionRevealEnabled(event.target.checked)
                        }
                        aria-label="Solution reveal"
                      />
                      <span className="slider" />
                    </label>
                  </div>
                </div>
                <div className="setting-row">
                  <span className="label">Statistics reset</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        statsResetMode === "scan" ? "active" : ""
                      }`}
                      aria-pressed={statsResetMode === "scan"}
                      onClick={() => setStatsResetMode("scan")}
                    >
                      Per scan
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        statsResetMode === "session" ? "active" : ""
                      }`}
                      aria-pressed={statsResetMode === "session"}
                      onClick={() => setStatsResetMode("session")}
                    >
                      Per session
                    </button>
                  </div>
                </div>
              </section>
              <section className="panel">
                <h2>Performance</h2>
                <p className="muted">
                  Tune vault scans for larger libraries.
                </p>
                <div className="setting-row">
                  <span className="label">Max files per vault scan</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="text-input"
                    value={maxFilesPerScan}
                    onChange={handleMaxFilesPerScanChange}
                    placeholder="Optional"
                    aria-label="Max files per vault scan"
                  />
                  <span className="helper-text">
                    Leave empty for no limit.
                  </span>
                </div>
                <div className="setting-row">
                  <span className="label">Scan parallelism</span>
                  <div className="pill-grid">
                    {(["low", "medium", "high"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={`pill pill-button ${
                          scanParallelism === level ? "active" : ""
                        }`}
                        aria-pressed={scanParallelism === level}
                        onClick={() => setScanParallelism(level)}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-row">
                  <span className="label">Watcher debounce/throttle</span>
                  <input
                    type="text"
                    className="text-input"
                    value="Coming later"
                    disabled
                    aria-label="Watcher debounce or throttle (coming later)"
                  />
                </div>
              </section>
              <section className="panel">
                <h2>Data &amp; Sync</h2>
                <p className="muted">
                  Storage and sync options will land here later.
                </p>
                <div className="setting-row">
                  <span className="label">Local storage path</span>
                  <input
                    type="text"
                    className="text-input"
                    value="—"
                    disabled
                    aria-label="Local storage path"
                  />
                </div>
                <div className="setting-row">
                  <span className="label">Export / Import (JSON)</span>
                  <div className="setting-actions">
                    <button type="button" className="ghost small" disabled>
                      Export JSON
                    </button>
                    <button type="button" className="ghost small" disabled>
                      Import JSON
                    </button>
                  </div>
                  <span className="helper-text">Coming later.</span>
                </div>
                <div className="setting-row">
                  <span className="label">Sync provider</span>
                  <input
                    type="text"
                    className="text-input"
                    value="Coming later"
                    disabled
                    aria-label="Sync provider"
                  />
                </div>
              </section>
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
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
