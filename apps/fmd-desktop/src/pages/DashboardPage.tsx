/**
 * @file apps/fmd-desktop/src/pages/DashboardPage.tsx
 *
 * Zweck:
 * - Rendert die Seite Dashboard.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/FileList.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/PreviewPanel.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: UI-Komponente.
 *
 * Exportiert:
 * - DashboardPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import {
  type CSSProperties,
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileList } from "../components/FileList";
import { NoteModal } from "../components/NoteModal";
import { ModalShell } from "../components/ModalShell";
import { PreviewPanel } from "../components/PreviewPanel";
import { useAppState } from "../components/AppStateProvider";
import { asErrorMessage } from "../lib/errors";
import { isValidHex, normalizeHex } from "../lib/color";
import {
  buildFrontmatterSuggestionIndex,
  buildFrontmatterValueSuggestionMapFromIndex,
  extractWikilinkTarget,
  parseFrontmatterDocument,
  sortFrontmatterKeySuggestions,
} from "../features/preview/frontmatter";
import { deriveMarkdownEditorColors } from "../lib/markdownEditorColors";
import { normalizeRelativePath, normalizeVaultPath } from "../lib/path";
import { compareNaturalPath } from "../lib/naturalSort";
import { useMediaQuery } from "../lib/useMediaQuery";
import { DESKTOP_QUERY } from "../lib/breakpoints";
import { ExamEditorView } from "./exam-editor/ExamEditorView";
import type { ExamEditorControlsState } from "./exam-editor/types";
import {
  shouldApplyPreviewDefaultMode,
  type DashboardView,
} from "./dashboardPreviewMode";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";
const notePanelStorageKey = "fmd.notePanelCollapsed";

const stripMarkdownExtension = (value: string) =>
  value.replace(/\.md$/i, "");

const dedupeCaseInsensitive = (keys: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  keys.forEach((key) => {
    const trimmed = key.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(trimmed);
  });
  return next;
};

export { shouldApplyPreviewDefaultMode, type DashboardView };

type MarkdownDocumentMode = "edit" | "write";
type MarkdownEditorTab = {
  path: string;
  relativePath: string;
};
type PendingExamLeaveAction =
  | "file-select"
  | "vault-view-change"
  | "dashboard-leave";

type DashboardPageProps = {
  initialVaultView?: DashboardView;
  onVaultViewChange?: (nextView: DashboardView) => void;
  isNoteModalOpen?: boolean;
  noteModalEnabled?: boolean;
  onNoteModalClose?: () => void;
  showGate?: boolean;
  gateEyebrow?: string;
  gateTitle?: string;
  gateDescription?: string;
  gateCtaLabel?: string;
  onOpenGate?: () => void;
  onOpenPointsProfilesPage?: () => void;
  onOpenExamFromDatabaseRecord?: (target: { path: string; relativePath: string }) => void;
};

export type DashboardPageHandle = {
  requestVaultViewChange: (nextView: DashboardView) => void;
  requestLeaveDashboard: () => Promise<boolean>;
};

const DashboardPageInner = (
  {
    initialVaultView = "markdown",
    onVaultViewChange,
    isNoteModalOpen = false,
    noteModalEnabled = false,
    onNoteModalClose,
    showGate = false,
    gateEyebrow,
    gateTitle,
    gateDescription,
    gateCtaLabel,
    onOpenGate,
    onOpenPointsProfilesPage,
    onOpenExamFromDatabaseRecord,
  }: DashboardPageProps,
  ref: ForwardedRef<DashboardPageHandle>,
) => {
  const {
    actions,
    examFiles: rawExamFiles,
    pointsProfiles,
    preview,
    settings,
    vault,
  } = useAppState();
  const examFiles = rawExamFiles ?? [];
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editDraftSourcePath, setEditDraftSourcePath] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editCaretIndex, setEditCaretIndex] = useState<number | null>(null);
  const [isHybridBlockDirty, setIsHybridBlockDirty] = useState(false);
  const [documentMode, setDocumentMode] = useState<MarkdownDocumentMode>("edit");
  const [pendingWriteFilePath, setPendingWriteFilePath] = useState<string | null>(null);
  const [markdownTabs, setMarkdownTabs] = useState<MarkdownEditorTab[]>([]);
  const [vaultView, setVaultView] = useState<DashboardView>(initialVaultView);
  const [examControls, setExamControls] = useState<ExamEditorControlsState | null>(
    null,
  );
  const examControlsRef = useRef<ExamEditorControlsState | null>(null);
  const [pendingExamLeaveAction, setPendingExamLeaveAction] =
    useState<PendingExamLeaveAction | null>(null);
  const [isExamLeaveSavePending, setIsExamLeaveSavePending] = useState(false);
  const previousSelectedMarkdownPathRef = useRef<string | null>(null);
  const isDesktopViewport = useMediaQuery(DESKTOP_QUERY, false);
  const [examPanelsCollapsed, setExamPanelsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(DESKTOP_QUERY).matches;
  });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const didApplyPreviewDefaultModeRef = useRef(false);
  const pendingExamLeaveProceedRef = useRef<(() => void | Promise<void>) | null>(null);
  const pendingExamLeaveResolveRef = useRef<((allowed: boolean) => void) | null>(null);
  const [noteCollapsed, setNoteCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem(notePanelStorageKey) === "true";
    } catch {
      return false;
    }
  });
  const [frontmatterValueSuggestions, setFrontmatterValueSuggestions] = useState<
    Record<string, string[]>
  >({});
  const [frontmatterKeySuggestions, setFrontmatterKeySuggestions] = useState<string[]>(
    [],
  );
  const [frontmatterFormulaAttributeKeysByFile, setFrontmatterFormulaAttributeKeysByFile] = useState<
    Record<string, string[]> | null
  >(null);
  const [frontmatterValuesByFile, setFrontmatterValuesByFile] = useState<
    Record<string, Record<string, unknown>> | null
  >(null);
  const frontmatterTaskProfileSummaries = useMemo(
    () =>
      Object.fromEntries(
        pointsProfiles.profiles.map((profile) => [
          profile.name.trim().toLowerCase(),
          {
            taskCount: profile.taskCount,
            maxTotalPoints: profile.maxTotalPoints,
          },
        ]),
      ),
    [pointsProfiles.profiles],
  );
  const isExamDesktop = vaultView === "exam" && isDesktopViewport;
  const showInlineNotePanel = !noteModalEnabled;
  const panelsCollapsed = isExamDesktop ? examPanelsCollapsed : noteCollapsed;
  const normalizedActiveFolderPath = useMemo(() => {
    if (!vault.activeFolderPath) {
      return "";
    }
    return normalizeRelativePath(vault.activeFolderPath).replace(/\/+$/, "");
  }, [vault.activeFolderPath]);
  const visibleFiles = useMemo(() => {
    if (!normalizedActiveFolderPath) {
      return vault.files;
    }
    const prefix = `${normalizedActiveFolderPath}/`;
    return vault.files.filter((file) =>
      normalizeRelativePath(file.relative_path).startsWith(prefix),
    );
  }, [normalizedActiveFolderPath, vault.files]);
  const wikilinkFileLookup = useMemo(() => {
    const byExactRelative = new Map<string, (typeof vault.files)[number]>();
    const byRelativeWithoutExtension = new Map<string, (typeof vault.files)[number]>();
    const byBasenameWithoutExtension = new Map<string, (typeof vault.files)[number]>();

    vault.files.forEach((file) => {
      const relative = normalizeRelativePath(file.relative_path);
      const relativeLower = relative.toLowerCase();
      const withoutExtension = stripMarkdownExtension(relativeLower);
      const basename = withoutExtension.split("/").pop() ?? withoutExtension;
      if (!byExactRelative.has(relativeLower)) {
        byExactRelative.set(relativeLower, file);
      }
      if (!byRelativeWithoutExtension.has(withoutExtension)) {
        byRelativeWithoutExtension.set(withoutExtension, file);
      }
      if (!byBasenameWithoutExtension.has(basename)) {
        byBasenameWithoutExtension.set(basename, file);
      }
    });

    return {
      byExactRelative,
      byRelativeWithoutExtension,
      byBasenameWithoutExtension,
    };
  }, [vault.files]);
  const fileCountLabel = useMemo(() => {
    if (!vault.vaultPath) {
      return "No vault selected";
    }
    const count = visibleFiles.length;
    const base = `${count} Markdown-Datei${count === 1 ? "" : "en"}`;
    if (!normalizedActiveFolderPath) {
      return base;
    }
    return `${base} im Ordner ${normalizedActiveFolderPath}`;
  }, [normalizedActiveFolderPath, visibleFiles.length, vault.vaultPath]);
  const runnableExamRelativePaths = useMemo(
    () =>
      examFiles
        .filter((file) => file.status === "valid")
        .map((file) => normalizeRelativePath(file.relative_path)),
    [examFiles],
  );
  const canEdit =
    Boolean(preview.selectedFile) && preview.previewState === "idle";
  const selectedMarkdownPath = preview.selectedFile?.path ?? null;
  const isDraftSyncedToSelectedFile =
    Boolean(selectedMarkdownPath) &&
    editDraftSourcePath === selectedMarkdownPath;
  const hasUnsavedMarkdownDraftChanges =
    preview.previewState === "idle" &&
    isDraftSyncedToSelectedFile &&
    editDraft !== preview.preview;
  const markdownEditorAccentHex = useMemo(() => {
    if (!settings.markdownEditorAccentEnabled) {
      return settings.accentColor;
    }
    const accentValue =
      settings.theme === "dark"
        ? settings.markdownEditorAccentDarkHex
        : settings.markdownEditorAccentLightHex;
    const normalized = normalizeHex(accentValue ?? "");
    return isValidHex(normalized) ? normalized : settings.accentColor;
  }, [
    settings.accentColor,
    settings.markdownEditorAccentEnabled,
    settings.markdownEditorAccentDarkHex,
    settings.markdownEditorAccentLightHex,
    settings.theme,
  ]);
  const markdownEditorStyle = useMemo(
    () =>
      deriveMarkdownEditorColors({
        accentHex: markdownEditorAccentHex,
        themeMode: settings.theme,
      }) as CSSProperties,
    [markdownEditorAccentHex, settings.theme],
  );
  const handleExamControlsReady = useCallback(
    (controls: ExamEditorControlsState | null) => {
      examControlsRef.current = controls;
      setExamControls(controls);
    },
    [],
  );

  const resolveVaultRelativePath = useCallback(
    (absolutePath: string) => {
      if (!vault.vaultPath) {
        return null;
      }
      const normalizedVault = normalizeVaultPath(vault.vaultPath);
      const normalizedAbsolute = normalizeVaultPath(absolutePath);
      if (!normalizedVault || !normalizedAbsolute) {
        return null;
      }
      if (normalizedAbsolute === normalizedVault) {
        return "";
      }
      if (!normalizedAbsolute.startsWith(`${normalizedVault}/`)) {
        return null;
      }
      const relative = normalizedAbsolute.slice(normalizedVault.length + 1);
      return normalizeRelativePath(relative);
    },
    [vault.vaultPath],
  );

  useEffect(() => {
    const selected = preview.selectedFile;
    if (!selected) {
      previousSelectedMarkdownPathRef.current = null;
      return;
    }
    const selectedPath = selected.path;
    const selectedRelativePath = selected.relative_path;
    const previousSelectedPath = previousSelectedMarkdownPathRef.current;
    previousSelectedMarkdownPathRef.current = selectedPath;
    const shouldOpenInNewTab =
      preview.selectedFileOpenInNewTab ||
      settings.markdownEditorOpenInNewTabByDefault;

    setMarkdownTabs((previous) => {
      const existingIndex = previous.findIndex((tab) => tab.path === selectedPath);
      if (existingIndex >= 0) {
        const existing = previous[existingIndex];
        if (existing?.relativePath === selectedRelativePath) {
          return previous;
        }
        const next = previous.slice();
        next[existingIndex] = {
          path: selectedPath,
          relativePath: selectedRelativePath,
        };
        return next;
      }
      const nextTab: MarkdownEditorTab = {
        path: selectedPath,
        relativePath: selectedRelativePath,
      };
      if (previous.length === 0) {
        return [nextTab];
      }
      if (shouldOpenInNewTab) {
        return [...previous, nextTab];
      }
      const replaceIndex = previousSelectedPath
        ? previous.findIndex((tab) => tab.path === previousSelectedPath)
        : -1;
      const fallbackReplaceIndex = replaceIndex >= 0 ? replaceIndex : previous.length - 1;
      const next = previous.slice();
      next[fallbackReplaceIndex] = nextTab;
      return next;
    });
  }, [
    preview.selectedFile,
    preview.selectedFileOpenInNewTab,
    settings.markdownEditorOpenInNewTabByDefault,
  ]);

  useEffect(() => {
    if (!vault.vaultPath) {
      setMarkdownTabs([]);
      return;
    }
    const validPathSet = new Set(vault.files.map((file) => file.path));
    setMarkdownTabs((previous) => {
      const next = previous.filter((tab) => validPathSet.has(tab.path));
      return next.length === previous.length ? previous : next;
    });
  }, [vault.files, vault.vaultPath]);

  useEffect(() => {
    setIsEditing(false);
    setEditDraft("");
    setEditDraftSourcePath(null);
    setEditError("");
    setIsSaving(false);
    setEditCaretIndex(null);
    setIsHybridBlockDirty(false);
    setDocumentMode("edit");
  }, [preview.selectedFile?.path]);

  useEffect(() => {
    if (!preview.selectedFile || preview.previewState !== "idle") {
      return;
    }
    setEditDraft(preview.preview);
    setEditDraftSourcePath(preview.selectedFile.path);
  }, [preview.preview, preview.previewState, preview.selectedFile?.path]);

  useEffect(() => {
    if (!pendingWriteFilePath) {
      return;
    }
    if (preview.selectedFile?.path !== pendingWriteFilePath) {
      return;
    }
    if (preview.previewState !== "idle") {
      return;
    }
    setDocumentMode("write");
    setEditDraft(preview.preview);
    setEditDraftSourcePath(preview.selectedFile.path);
    setPendingWriteFilePath(null);
  }, [
    pendingWriteFilePath,
    preview.preview,
    preview.previewState,
    preview.selectedFile?.path,
  ]);

  useEffect(() => {
    if (
      !shouldApplyPreviewDefaultMode({
        didApplyDefault: didApplyPreviewDefaultModeRef.current,
        settingsLoaded: settings.settingsLoaded,
        isEditing,
        vaultView,
      })
    ) {
      return;
    }
    const defaultMode = settings.markdownPreviewDefaultMode;
    const nextEditorMode =
      defaultMode === "raw"
        ? "code"
        : defaultMode;
    preview.setEditorModeWithDefaults(nextEditorMode);
    didApplyPreviewDefaultModeRef.current = true;
  }, [
    isEditing,
    preview,
    settings.markdownPreviewDefaultMode,
    settings.settingsLoaded,
    vaultView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(notePanelStorageKey, String(noteCollapsed));
    } catch {
      // Ignore storage failures (e.g. privacy mode).
    }
  }, [noteCollapsed]);

  useEffect(() => {
    let cancelled = false;
    const rebuildSuggestions = async () => {
      if (!vault.vaultPath || vault.files.length === 0) {
        if (!cancelled) {
          setFrontmatterValueSuggestions({});
          setFrontmatterKeySuggestions([]);
          setFrontmatterFormulaAttributeKeysByFile({});
          setFrontmatterValuesByFile({});
        }
        return;
      }
      const markdownDocuments = await Promise.all(
        vault.files.map(async (file) => {
          try {
            return await invoke<string>("read_text_file", {
              path: file.path,
            });
          } catch {
            return "";
          }
        }),
      );
      if (cancelled) {
        return;
      }
      const suggestionIndex = buildFrontmatterSuggestionIndex(markdownDocuments);
      setFrontmatterValueSuggestions(
        buildFrontmatterValueSuggestionMapFromIndex(suggestionIndex.valueIndex),
      );
      setFrontmatterKeySuggestions(
        sortFrontmatterKeySuggestions(suggestionIndex.keyIndex),
      );
      const nextFormulaAttributeKeysByFile: Record<string, string[]> = {};
      const nextFrontmatterValuesByFile: Record<string, Record<string, unknown>> = {};
      vault.files.forEach((file, index) => {
        const normalizedRelativePath = normalizeRelativePath(file.relative_path).replace(/^\/+/, "");
        if (!/\.md$/i.test(normalizedRelativePath)) {
          return;
        }
        const parsed = parseFrontmatterDocument(markdownDocuments[index] ?? "");
        if (!parsed.hasFrontmatter || parsed.error) {
          return;
        }
        const keys = dedupeCaseInsensitive(
          parsed.properties.map((property) => property.key),
        );
        const valuesByKey: Record<string, unknown> = {};
        parsed.properties.forEach((property) => {
          if (property.kind === "formula") {
            return;
          }
          valuesByKey[property.key] = property.value;
        });
        if (Object.keys(valuesByKey).length > 0) {
          nextFrontmatterValuesByFile[normalizedRelativePath] = valuesByKey;
        }
        if (keys.length === 0) {
          return;
        }
        nextFormulaAttributeKeysByFile[normalizedRelativePath] = keys;
      });
      setFrontmatterFormulaAttributeKeysByFile(nextFormulaAttributeKeysByFile);
      setFrontmatterValuesByFile(nextFrontmatterValuesByFile);
    };
    void rebuildSuggestions();
    return () => {
      cancelled = true;
    };
  }, [preview.preview, preview.selectedFile?.path, vault.files, vault.vaultPath]);

  useEffect(() => {
    if (!panelsCollapsed || typeof document === "undefined") {
      return;
    }
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }
    const rightPanel =
      document.querySelector(".note-column") ??
      document.querySelector(".note-panel");
    if (rightPanel?.contains(active)) {
      workspaceRef.current?.focus();
    }
  }, [panelsCollapsed, vaultView]);

  const handleToggleNoteCollapsed = useCallback(() => {
    setNoteCollapsed((current) => !current);
  }, []);

  const handleToggleExamPanelsCollapsed = useCallback(() => {
    setExamPanelsCollapsed((current) => !current);
  }, []);

  const handleEditDraftChange = useCallback(
    (nextValue: string) => {
      setEditDraft(nextValue);
      setEditDraftSourcePath(preview.selectedFile?.path ?? null);
    },
    [preview.selectedFile?.path],
  );

  const handleEditStart = useCallback(
    (options?: { caretIndex?: number | null; origin?: "raw" | "markdown" }) => {
      if (!preview.selectedFile || preview.previewState !== "idle") {
        return;
      }
      setEditDraft(preview.preview);
      setEditDraftSourcePath(preview.selectedFile.path);
      setEditError("");
      setEditCaretIndex(
        typeof options?.caretIndex === "number" ? options.caretIndex : null,
      );
      setIsEditing(true);
    },
    [preview],
  );

  const saveDraftToDisk = useCallback(
    async ({
      closeLegacyEditor = false,
      exitWriteMode = false,
    }: {
      closeLegacyEditor?: boolean;
      exitWriteMode?: boolean;
    } = {}) => {
      const selectedPath = preview.selectedFile?.path ?? null;
      if (!selectedPath || isSaving) {
        return false;
      }
      if (preview.previewState !== "idle") {
        return false;
      }
      if (editDraftSourcePath !== selectedPath) {
        return false;
      }
      if (editDraft === preview.preview) {
        setIsHybridBlockDirty(false);
        if (closeLegacyEditor) {
          setIsEditing(false);
          setEditCaretIndex(null);
        }
        if (exitWriteMode) {
          setDocumentMode("edit");
        }
        return true;
      }
      setIsSaving(true);
      setEditError("");
      try {
        await invoke("write_text_file", {
          path: selectedPath,
          contents: editDraft,
        });
        preview.setPreview(editDraft);
        setEditDraftSourcePath(selectedPath);
        setIsHybridBlockDirty(false);
        if (closeLegacyEditor) {
          setIsEditing(false);
          setEditCaretIndex(null);
        }
        if (exitWriteMode) {
          setDocumentMode("edit");
        }
        return true;
      } catch (error) {
        setEditError(asErrorMessage(error, "Failed to save file."));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [editDraft, editDraftSourcePath, isSaving, preview],
  );

  const handleEditAutosave = useCallback(async () => {
    if (!preview.selectedFile || !isEditing) {
      return false;
    }
    return saveDraftToDisk({ closeLegacyEditor: true });
  }, [isEditing, preview.selectedFile, saveDraftToDisk]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (vaultView !== "markdown") {
      return;
    }
    if (documentMode !== "edit") {
      return;
    }
    if (preview.editorMode !== "markdown" || isEditing) {
      return;
    }
    if (isHybridBlockDirty) {
      return;
    }
    if (!preview.selectedFile || preview.previewState !== "idle") {
      return;
    }
    if (!hasUnsavedMarkdownDraftChanges || isSaving) {
      return;
    }
    const handle = window.setTimeout(() => {
      void saveDraftToDisk();
    }, 350);
    return () => window.clearTimeout(handle);
  }, [
    documentMode,
    hasUnsavedMarkdownDraftChanges,
    isHybridBlockDirty,
    isEditing,
    isSaving,
    preview.editorMode,
    preview.previewState,
    preview.selectedFile,
    saveDraftToDisk,
    vaultView,
  ]);

  const handleWriteSave = useCallback(async () => {
    await saveDraftToDisk({ exitWriteMode: true });
  }, [saveDraftToDisk]);

  const handleWriteCancel = useCallback(() => {
    setEditError("");
    setEditDraft(preview.preview);
    setEditDraftSourcePath(preview.selectedFile?.path ?? null);
    setIsHybridBlockDirty(false);
    setDocumentMode("edit");
    setIsEditing(false);
    setEditCaretIndex(null);
  }, [preview.preview, preview.selectedFile?.path]);

  const persistMarkdownBeforeNavigation = useCallback(async (
    options?: {
      skipHybridDirtyCheck?: boolean;
    },
  ) => {
    if (documentMode === "write") {
      setEditError("Bitte Write-Entwurf zuerst speichern oder abbrechen.");
      return false;
    }
    if (isHybridBlockDirty && !options?.skipHybridDirtyCheck) {
      setEditError("Bitte den aktiven Block zuerst abschliessen.");
      return false;
    }
    if (isEditing) {
      return handleEditAutosave();
    }
    if (
      documentMode === "edit" &&
      vaultView === "markdown" &&
      hasUnsavedMarkdownDraftChanges
    ) {
      return saveDraftToDisk();
    }
    return true;
  }, [
    documentMode,
    handleEditAutosave,
    hasUnsavedMarkdownDraftChanges,
    isHybridBlockDirty,
    isEditing,
    saveDraftToDisk,
    vaultView,
  ]);

  const resolveDirtyExamControls = useCallback((): ExamEditorControlsState | null => {
    const controls = examControlsRef.current;
    if (vaultView === "exam" && controls?.hasUnsavedChanges) {
      return controls;
    }
    return null;
  }, [vaultView]);

  const completePendingExamLeave = useCallback((allowed: boolean) => {
    const resolve = pendingExamLeaveResolveRef.current;
    pendingExamLeaveProceedRef.current = null;
    pendingExamLeaveResolveRef.current = null;
    setPendingExamLeaveAction(null);
    setIsExamLeaveSavePending(false);
    resolve?.(allowed);
  }, []);

  const runPendingExamLeaveAction = useCallback(async () => {
    const action = pendingExamLeaveProceedRef.current;
    if (!action) {
      completePendingExamLeave(true);
      return true;
    }
    try {
      await action();
      completePendingExamLeave(true);
      return true;
    } catch (error) {
      console.error("Failed to execute pending dashboard leave action", error);
      completePendingExamLeave(false);
      return false;
    }
  }, [completePendingExamLeave]);

  const requestExamLeaveGuard = useCallback(
    async (
      action: PendingExamLeaveAction,
      proceed: () => void | Promise<void>,
    ) => {
      if (pendingExamLeaveAction) {
        return false;
      }
      const dirtyControls = resolveDirtyExamControls();
      if (!dirtyControls) {
        await proceed();
        return true;
      }
      return new Promise<boolean>((resolve) => {
        pendingExamLeaveProceedRef.current = proceed;
        pendingExamLeaveResolveRef.current = resolve;
        setPendingExamLeaveAction(action);
        setIsExamLeaveSavePending(false);
      });
    },
    [pendingExamLeaveAction, resolveDirtyExamControls],
  );

  const runDashboardNavigationGuard = useCallback(
    async (
      action: PendingExamLeaveAction,
      proceed: () => void | Promise<void>,
    ) => {
      const markdownReady = await persistMarkdownBeforeNavigation();
      if (!markdownReady) {
        return false;
      }
      return requestExamLeaveGuard(action, proceed);
    },
    [persistMarkdownBeforeNavigation, requestExamLeaveGuard],
  );

  useEffect(
    () => () => {
      pendingExamLeaveResolveRef.current?.(false);
      pendingExamLeaveProceedRef.current = null;
      pendingExamLeaveResolveRef.current = null;
    },
    [],
  );

  const handleNoteFileCreated = useCallback(
    (
      file: { path: string },
      meta: { origin: "new-button" | "context-menu" },
    ) => {
      if (meta.origin !== "new-button") {
        return;
      }
      setPendingWriteFilePath(file.path);
    },
    [],
  );

  const handleSelectMarkdownFile = useCallback(
    (
      file: Parameters<typeof actions.handleSelectFile>[0],
      options?: Parameters<typeof actions.handleSelectFile>[1],
    ) => {
      void (async () => {
        await runDashboardNavigationGuard("file-select", async () => {
          setDocumentMode("edit");
          actions.handleSelectFile(file, options);
        });
      })();
    },
    [actions, runDashboardNavigationGuard],
  );

  const resolveMarkdownFileByPath = useCallback(
    (path: string) => {
      if (!path) {
        return null;
      }
      const normalizedTargetPath = normalizeVaultPath(path);
      return (
        vault.files.find((file) => {
          const normalizedFilePath = normalizeVaultPath(file.path);
          if (!normalizedFilePath || !normalizedTargetPath) {
            return file.path === path;
          }
          return normalizedFilePath === normalizedTargetPath;
        }) ?? null
      );
    },
    [vault.files],
  );

  const handleSelectMarkdownTab = useCallback(
    (path: string) => {
      if (!path || preview.selectedFile?.path === path) {
        return;
      }
      const targetFile = resolveMarkdownFileByPath(path);
      if (!targetFile) {
        return;
      }
      handleSelectMarkdownFile(targetFile);
    },
    [handleSelectMarkdownFile, preview.selectedFile?.path, resolveMarkdownFileByPath],
  );

  const handleCloseMarkdownTab = useCallback(
    (path: string) => {
      const closingIndex = markdownTabs.findIndex((tab) => tab.path === path);
      if (closingIndex < 0) {
        return;
      }
      const remainingTabs = markdownTabs.filter((tab) => tab.path !== path);
      const activePath = preview.selectedFile?.path ?? null;
      const nextActivePath =
        activePath === path
          ? (remainingTabs[closingIndex]?.path ??
            remainingTabs[closingIndex - 1]?.path ??
            null)
          : activePath;

      void (async () => {
        await runDashboardNavigationGuard("file-select", async () => {
          setMarkdownTabs(remainingTabs);
          if (activePath !== path) {
            return;
          }
          if (!nextActivePath) {
            preview.resetPreview();
            return;
          }
          const nextFile = resolveMarkdownFileByPath(nextActivePath);
          if (!nextFile) {
            preview.resetPreview();
            return;
          }
          actions.handleSelectFile(nextFile);
        });
      })();
    },
    [
      actions,
      markdownTabs,
      preview,
      resolveMarkdownFileByPath,
      runDashboardNavigationGuard,
    ],
  );

  const handleReorderMarkdownTabs = useCallback(
    (sourcePath: string, targetPath: string, position: "before" | "after") => {
      if (!sourcePath || !targetPath || sourcePath === targetPath) {
        return;
      }
      setMarkdownTabs((previous) => {
        const sourceIndex = previous.findIndex((tab) => tab.path === sourcePath);
        const targetIndex = previous.findIndex((tab) => tab.path === targetPath);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
          return previous;
        }
        const next = previous.slice();
        const [movedTab] = next.splice(sourceIndex, 1);
        if (!movedTab) {
          return previous;
        }
        const adjustedTargetIndex = next.findIndex((tab) => tab.path === targetPath);
        if (adjustedTargetIndex < 0) {
          return previous;
        }
        const insertIndex = position === "before"
          ? adjustedTargetIndex
          : adjustedTargetIndex + 1;
        next.splice(insertIndex, 0, movedTab);
        const orderChanged = next.some((tab, index) => tab.path !== previous[index]?.path);
        return orderChanged ? next : previous;
      });
    },
    [],
  );

  const handleFrontmatterSave = useCallback(
    async (nextMarkdown: string) => {
      if (!preview.selectedFile || isEditing || isSaving) {
        return false;
      }
      if (documentMode === "write") {
        setEditError("Frontmatter-Aenderungen sind im Write-Modus deaktiviert.");
        return false;
      }
      if (editDraft !== preview.preview) {
        setEditError("Bitte zuerst die offenen Text-Aenderungen speichern.");
        return false;
      }
      if (nextMarkdown === preview.preview) {
        return true;
      }
      setIsSaving(true);
      setEditError("");
      try {
        await invoke("write_text_file", {
          path: preview.selectedFile.path,
          contents: nextMarkdown,
        });
        preview.setPreview(nextMarkdown);
        setEditDraft(nextMarkdown);
        setEditDraftSourcePath(preview.selectedFile.path);
        return true;
      } catch (error) {
        setEditError(asErrorMessage(error, "Failed to save file."));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [documentMode, editDraft, isEditing, isSaving, preview],
  );

  const handleFrontmatterWikilinkNavigate = useCallback(
    (wikilink: string) => {
      const target = extractWikilinkTarget(wikilink);
      if (!target) {
        return;
      }
      const pathPartRaw = target.split(/[?#]/)[0] ?? "";
      const pathPart = pathPartRaw.trim();
      if (!pathPart) {
        return;
      }
      const normalizedTarget = normalizeRelativePath(pathPart).replace(/^\/+/, "");
      const targetLower = normalizedTarget.toLowerCase();
      const targetWithoutExtension = stripMarkdownExtension(targetLower);
      const basenameWithoutExtension =
        targetWithoutExtension.split("/").pop() ?? targetWithoutExtension;
      const resolvedFile =
        wikilinkFileLookup.byExactRelative.get(targetLower) ??
        wikilinkFileLookup.byExactRelative.get(`${targetWithoutExtension}.md`) ??
        wikilinkFileLookup.byRelativeWithoutExtension.get(targetWithoutExtension) ??
        wikilinkFileLookup.byBasenameWithoutExtension.get(basenameWithoutExtension);
      if (resolvedFile) {
        handleSelectMarkdownFile(resolvedFile);
      }
    },
    [handleSelectMarkdownFile, wikilinkFileLookup],
  );

  const handleVaultViewChange = useCallback(
    async (nextView: DashboardView) => {
      if (nextView === vaultView) {
        return true;
      }
      return runDashboardNavigationGuard("vault-view-change", async () => {
        setVaultView(nextView);
        onVaultViewChange?.(nextView);
      });
    },
    [onVaultViewChange, runDashboardNavigationGuard, vaultView],
  );

  useImperativeHandle(
    ref,
    () => ({
      requestVaultViewChange: (nextView: DashboardView) => {
        void handleVaultViewChange(nextView);
      },
      requestLeaveDashboard: () =>
        runDashboardNavigationGuard("dashboard-leave", async () => {}),
    }),
    [handleVaultViewChange, runDashboardNavigationGuard],
  );

  const handleSelectEditorMode = useCallback(async (
    nextEditorMode: Parameters<typeof preview.setEditorModeWithDefaults>[0],
  ) => {
    if (preview.editorMode === nextEditorMode) {
      return;
    }
    const saved = await persistMarkdownBeforeNavigation({
      skipHybridDirtyCheck: preview.editorMode === "hybrid",
    });
    if (!saved) {
      return;
    }
    preview.setEditorModeWithDefaults(nextEditorMode);
  }, [persistMarkdownBeforeNavigation, preview]);

  const handleToggleEditEnabled = useCallback(async () => {
    if (preview.editorMode === "hybrid") {
      preview.setEditEnabled(true);
      return;
    }
    const saved = await persistMarkdownBeforeNavigation();
    if (!saved) {
      return;
    }
    preview.setEditEnabled((current) => !current);
  }, [persistMarkdownBeforeNavigation, preview]);
  const handleEditCaretApplied = useCallback(() => {
    setEditCaretIndex(null);
  }, []);
  const handleExamSave = useCallback(
    ({
      path,
      markdown,
      renamedFromPath,
    }: {
      path: string;
      markdown: string;
      renamedFromPath?: string;
    }) => {
      const normalizedSavedPath = normalizeVaultPath(path);
      const normalizedRenamedFromPath = renamedFromPath
        ? normalizeVaultPath(renamedFromPath)
        : "";
      const savedRelativePath = resolveVaultRelativePath(path);
      const selectedPath = preview.selectedFile?.path ?? "";
      const selectedMatchesRenamedPath =
        Boolean(normalizedRenamedFromPath) &&
        normalizeVaultPath(selectedPath) === normalizedRenamedFromPath;

      if (selectedMatchesRenamedPath && savedRelativePath) {
        actions.handleSelectFile({
          path,
          relative_path: savedRelativePath,
        });
      } else if (preview.selectedFile?.path === path) {
        preview.setPreview(markdown);
      }

      vault.setFiles((previous) => {
        const filtered = previous.filter((file) => {
          const filePath = normalizeVaultPath(file.path);
          if (!filePath) {
            return true;
          }
          if (
            normalizedRenamedFromPath &&
            filePath === normalizedRenamedFromPath
          ) {
            return false;
          }
          return true;
        });
        if (!savedRelativePath) {
          return filtered;
        }
        const withoutSavedPath = filtered.filter(
          (file) => normalizeVaultPath(file.path) !== normalizedSavedPath,
        );
        return [
          ...withoutSavedPath,
          { path, relative_path: savedRelativePath },
        ].sort((a, b) => compareNaturalPath(a.relative_path, b.relative_path));
      });
    },
    [
      actions,
      preview.selectedFile?.path,
      preview.setPreview,
      resolveVaultRelativePath,
      vault.setFiles,
    ],
  );
  const handleOpenTaskProfileEditor = useCallback(
    async ({ taskValue }: { taskValue: string | null; propertyKey: string }) => {
      const requestedName = taskValue?.trim() ?? "";
      if (requestedName) {
        const existing = pointsProfiles.resolveProfileByName(requestedName);
        if (existing) {
          pointsProfiles.setSelectedProfileId(existing.id);
        } else {
          const created = await pointsProfiles.createProfile(requestedName, {
            seedFromProfileId:
              pointsProfiles.selectedProfileId ?? pointsProfiles.defaultProfileId ?? null,
          });
          if (!created.ok) {
            console.warn("Failed to auto-create points profile from Task attribute", created.error);
          } else if (created.profile) {
            pointsProfiles.setSelectedProfileId(created.profile.id);
          }
        }
      } else if (pointsProfiles.defaultProfileId) {
        pointsProfiles.setSelectedProfileId(pointsProfiles.defaultProfileId);
      }
      onOpenPointsProfilesPage?.();
    },
    [
      onOpenPointsProfilesPage,
      pointsProfiles,
      pointsProfiles.createProfile,
      pointsProfiles.defaultProfileId,
      pointsProfiles.resolveProfileByName,
      pointsProfiles.selectedProfileId,
      pointsProfiles.setSelectedProfileId,
    ],
  );

  const noteModalActive = noteModalEnabled && isNoteModalOpen;
  const handleOpenExamFromDatabase = useCallback(
    (target: { path: string; relativePath: string }) => {
      onOpenExamFromDatabaseRecord?.(target);
    },
    [onOpenExamFromDatabaseRecord],
  );
  const handleNoteModalClose = useCallback(() => {
    onNoteModalClose?.();
  }, [onNoteModalClose]);

  useEffect(() => {
    if (!noteModalActive) {
      return;
    }
    if (noteCollapsed) {
      setNoteCollapsed(false);
    }
  }, [noteCollapsed, noteModalActive]);

  useEffect(() => {
    if (initialVaultView === vaultView) {
      return;
    }
    void handleVaultViewChange(initialVaultView);
  }, [handleVaultViewChange, initialVaultView, vaultView]);

  const handleTogglePanelsCollapsed = isExamDesktop
    ? handleToggleExamPanelsCollapsed
    : handleToggleNoteCollapsed;
  const pendingExamLeaveControls = examControlsRef.current;
  const canSavePendingExamChanges = Boolean(
    pendingExamLeaveControls?.canSave &&
      !pendingExamLeaveControls.isSaving &&
      !isExamLeaveSavePending,
  );

  const handlePendingExamLeaveCancel = useCallback(() => {
    completePendingExamLeave(false);
  }, [completePendingExamLeave]);

  const handlePendingExamLeaveDiscard = useCallback(() => {
    void runPendingExamLeaveAction();
  }, [runPendingExamLeaveAction]);

  const handlePendingExamLeaveSave = useCallback(() => {
    const controls = pendingExamLeaveControls;
    if (
      !controls ||
      !controls.canSave ||
      controls.isSaving ||
      isExamLeaveSavePending
    ) {
      return;
    }
    void (async () => {
      setIsExamLeaveSavePending(true);
      const saved = await controls.onSaveAndWait();
      setIsExamLeaveSavePending(false);
      if (!saved) {
        return;
      }
      await runPendingExamLeaveAction();
    })();
  }, [isExamLeaveSavePending, pendingExamLeaveControls, runPendingExamLeaveAction]);

  const examModeTabs = examControls ? (
    <div className="pill-grid" role="tablist" aria-label="Editor mode">
      <button
        type="button"
        className={`pill pill-button ${examControls.mode === "structure" ? "active" : ""}`}
        onClick={() => examControls.onModeChange("structure")}
        role="tab"
        aria-selected={examControls.mode === "structure"}
      >
        Structure
      </button>
      <button
        type="button"
        className={`pill pill-button ${examControls.mode === "content" ? "active" : ""}`}
        onClick={() => examControls.onModeChange("content")}
        role="tab"
        aria-selected={examControls.mode === "content"}
      >
        Content
      </button>
    </div>
  ) : null;
  const examEditorActions = examControls ? (
    <div className="exam-editor-action-buttons">
      <button
        type="button"
        className="ghost small"
        onClick={examControls.onNewExam}
      >
        New exam
      </button>
      <button
        type="button"
        className="ghost small"
        onClick={examControls.onSaveAs}
        disabled={!examControls.canSave || examControls.isSaving}
      >
        Save as
      </button>
      <button
        type="button"
        className="primary small"
        onClick={examControls.onSave}
        disabled={!examControls.canSave || examControls.isSaving}
      >
        Save
      </button>
    </div>
  ) : null;
  const examSaveState =
    examControls?.saveState === "saving" ? (
      <span className="pill">Saving...</span>
    ) : examControls?.saveState === "saved" ? (
      <span className="pill success">Saved</span>
    ) : null;
  const desktopExamToolbar =
    vaultView === "exam" && isExamDesktop && examControls ? (
      <section className="panel toolbar-panel exam-editor-controls-panel exam-editor-controls-panel-top">
        <div className="exam-editor-toolbar exam-editor-toolbar-main">
          {examEditorActions}
          {examModeTabs}
        </div>
        <div className="exam-editor-save-row exam-editor-toolbar-save">
          <span className="muted">Saved path:</span>
          <span className="save-path">{examControls.savePath ?? "Not saved yet"}</span>
          {examSaveState}
        </div>
      </section>
    ) : null;

  return (
    <div className="dashboard-page">
      {vaultView === "exam" && !isExamDesktop ? (
        <header className="content-header">
          <div className="vault-header-row">
            <div className="vault-saved-path">
              <span className="muted">Saved path:</span>
              <span className="save-path">
                {examControls?.savePath ?? "Not saved yet"}
              </span>
              {examSaveState}
            </div>
          </div>
        </header>
      ) : null}
      {desktopExamToolbar}

      {showGate ? (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-header-content">
              {gateEyebrow ? <span className="eyebrow">{gateEyebrow}</span> : null}
              {gateTitle ? <h3>{gateTitle}</h3> : null}
              {gateDescription ? <p className="muted">{gateDescription}</p> : null}
            </div>
            <button
              type="button"
              className="primary"
              onClick={onOpenGate}
              disabled={!onOpenGate}
            >
              {gateCtaLabel ?? "Continue"}
            </button>
          </div>
        </section>
      ) : null}
      <div
        className={`workspace${panelsCollapsed ? " note-collapsed" : ""}${
          showInlineNotePanel ? "" : " no-inline-note"
        }`}
        ref={workspaceRef}
        tabIndex={-1}
      >
        {vaultView === "markdown" ? (
          <PreviewPanel
            emptyPreview={emptyPreview}
            editDraft={editDraft}
            editError={editError}
            editCaretIndex={editCaretIndex}
            isEditing={isEditing}
            preview={preview.preview}
            previewError={preview.previewError}
            previewState={preview.previewState}
            editorMode={preview.editorMode}
            editEnabled={preview.editEnabled}
            documentMode={documentMode}
            selectedFile={preview.selectedFile}
            vaultFiles={vault.files}
            vaultPngAssets={vault.pngAssets}
            vaultPath={vault.vaultPath}
            sourceRelativePath={preview.selectedFile?.relative_path ?? null}
            canEdit={canEdit}
            markdownEditorStyle={markdownEditorStyle}
            onEditChange={handleEditDraftChange}
            onHybridDirtyChange={setIsHybridBlockDirty}
            onEditCaretApplied={handleEditCaretApplied}
            onEditExit={handleEditAutosave}
            onEditStart={handleEditStart}
            onSelectEditorMode={handleSelectEditorMode}
            onToggleEditEnabled={handleToggleEditEnabled}
            onWriteSave={handleWriteSave}
            onWriteCancel={handleWriteCancel}
            onFrontmatterSave={handleFrontmatterSave}
            onNavigateWikilink={handleFrontmatterWikilinkNavigate}
            runnableExamRelativePaths={runnableExamRelativePaths}
            onOpenExamFromDatabaseRecord={handleOpenExamFromDatabase}
            onOpenTaskProfileEditor={handleOpenTaskProfileEditor}
            taskProfileSummariesByName={frontmatterTaskProfileSummaries}
            valueSuggestionsByKey={frontmatterValueSuggestions}
            keySuggestions={frontmatterKeySuggestions}
            formulaAttributeKeysByFile={frontmatterFormulaAttributeKeysByFile ?? undefined}
            frontmatterValuesByFile={frontmatterValuesByFile ?? undefined}
            markdownTabs={markdownTabs}
            activeMarkdownTabPath={preview.selectedFile?.path ?? null}
            onSelectMarkdownTab={handleSelectMarkdownTab}
            onCloseMarkdownTab={handleCloseMarkdownTab}
            onReorderMarkdownTabs={handleReorderMarkdownTabs}
            monitoringProfiles={settings.monitoringRenderProfiles}
          />
        ) : (
          <ExamEditorView
            sourcePath={preview.selectedFile?.path ?? null}
            sourceRelativePath={preview.selectedFile?.relative_path ?? null}
            sourceMarkdown={
              preview.previewState === "idle" ? preview.preview : undefined
            }
            activeFolderPath={normalizedActiveFolderPath || null}
            vaultFiles={vault.files}
            vaultPngAssets={vault.pngAssets}
            vaultPath={vault.vaultPath ?? null}
            pointsProfiles={pointsProfiles}
            showMoveButtons={settings.examEditorShowMoveButtons}
            variant="study"
            onControlsReady={handleExamControlsReady}
            onSave={handleExamSave}
          />
        )}

        {vaultView === "markdown" ? (
          showInlineNotePanel ? (
            <FileList
              activeFolderPath={normalizedActiveFolderPath || null}
              fileCountLabel={fileCountLabel}
              files={visibleFiles}
              isCollapsed={noteCollapsed}
              listError={vault.listError}
              listState={vault.listState}
              onClearSelection={preview.resetPreview}
              onFileCreated={handleNoteFileCreated}
              onRescanVault={actions.handleRescanVault}
              onSelectFile={handleSelectMarkdownFile}
              onToggleCollapsed={handleToggleNoteCollapsed}
              selectedFile={preview.selectedFile}
              vaultPath={vault.vaultPath}
            />
          ) : null
        ) : (
          !isExamDesktop || showInlineNotePanel ? (
            <div className="note-column">
              {!isExamDesktop && panelsCollapsed ? (
                <section className="panel toolbar-panel exam-editor-controls-panel is-collapsed">
                  <button
                    type="button"
                    className="exam-editor-controls-handle"
                    onClick={handleTogglePanelsCollapsed}
                    aria-label="Expand editor panels"
                  >
                    <span className="note-handle-icon" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M15 6l-6 6 6 6" />
                      </svg>
                    </span>
                  </button>
                </section>
              ) : !isExamDesktop && examControls ? (
                <section className="panel toolbar-panel exam-editor-controls-panel">
                  <div className="exam-editor-toolbar">
                    {examEditorActions}
                    {examModeTabs}
                  </div>
                </section>
              ) : null}
              {showInlineNotePanel ? (
                <FileList
                  activeFolderPath={normalizedActiveFolderPath || null}
                  fileCountLabel={fileCountLabel}
                  files={visibleFiles}
                  isCollapsed={panelsCollapsed}
                  listError={vault.listError}
                  listState={vault.listState}
                  onClearSelection={preview.resetPreview}
                  onFileCreated={handleNoteFileCreated}
                  onRescanVault={actions.handleRescanVault}
                  onSelectFile={handleSelectMarkdownFile}
                  onToggleCollapsed={handleTogglePanelsCollapsed}
                  selectedFile={preview.selectedFile}
                  showCollapseStrip
                  vaultPath={vault.vaultPath}
                />
              ) : null}
            </div>
          ) : null
        )}
      </div>
      {noteModalEnabled ? (
        <NoteModal isOpen={noteModalActive} onClose={handleNoteModalClose}>
          <FileList
            activeFolderPath={normalizedActiveFolderPath || null}
            fileCountLabel={fileCountLabel}
            files={visibleFiles}
            isCollapsed={noteCollapsed}
            listError={vault.listError}
            listState={vault.listState}
            onClearSelection={preview.resetPreview}
            onFileCreated={handleNoteFileCreated}
            onRescanVault={actions.handleRescanVault}
            onSelectFile={handleSelectMarkdownFile}
            onToggleCollapsed={handleToggleNoteCollapsed}
            selectedFile={preview.selectedFile}
            showCollapseStrip={vaultView === "exam"}
            vaultPath={vault.vaultPath}
          />
        </NoteModal>
      ) : null}
      <ModalShell
        isOpen={pendingExamLeaveAction !== null}
        title="Unsaved changes"
        onClose={handlePendingExamLeaveCancel}
      >
        <div className="hub-modal-scroll">
          <p className="muted">
            You have unsaved changes in the Exam Editor. What should happen before
            leaving?
          </p>
          {!pendingExamLeaveControls?.canSave ? (
            <div className="error">
              Save is unavailable right now (for example because of validation
              errors).
            </div>
          ) : null}
          <div className="modal-actions">
            <button
              type="button"
              className="primary"
              onClick={handlePendingExamLeaveSave}
              disabled={!canSavePendingExamChanges}
            >
              {isExamLeaveSavePending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={handlePendingExamLeaveDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="ghost"
              onClick={handlePendingExamLeaveCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};

export const DashboardPage = forwardRef(DashboardPageInner);
DashboardPage.displayName = "DashboardPage";
