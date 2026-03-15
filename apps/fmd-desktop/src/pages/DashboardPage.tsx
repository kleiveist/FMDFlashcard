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
  sortFrontmatterKeySuggestions,
} from "../features/preview/frontmatter";
import { deriveMarkdownEditorColors } from "../lib/markdownEditorColors";
import { normalizeRelativePath, normalizeVaultPath } from "../lib/path";
import { useMediaQuery } from "../lib/useMediaQuery";
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

export { shouldApplyPreviewDefaultMode, type DashboardView };

type MarkdownDocumentMode = "edit" | "write";
type ExamLeaveGuardTarget = "main-editor" | "profile-modal";
type PendingExamLeaveAction =
  | "file-select"
  | "vault-view-change"
  | "dashboard-leave"
  | "profile-modal-close";

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
  }: DashboardPageProps,
  ref: ForwardedRef<DashboardPageHandle>,
) => {
  const { actions, pointsProfiles, preview, settings, vault } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editCaretIndex, setEditCaretIndex] = useState<number | null>(null);
  const [isHybridBlockDirty, setIsHybridBlockDirty] = useState(false);
  const [documentMode, setDocumentMode] = useState<MarkdownDocumentMode>("edit");
  const [pendingWriteFilePath, setPendingWriteFilePath] = useState<string | null>(null);
  const [vaultView, setVaultView] = useState<DashboardView>(initialVaultView);
  const [examControls, setExamControls] = useState<ExamEditorControlsState | null>(
    null,
  );
  const examControlsRef = useRef<ExamEditorControlsState | null>(null);
  const [isTaskProfileEditorModalOpen, setIsTaskProfileEditorModalOpen] = useState(false);
  const [taskProfileEditorControls, setTaskProfileEditorControls] =
    useState<ExamEditorControlsState | null>(null);
  const taskProfileEditorControlsRef = useRef<ExamEditorControlsState | null>(null);
  const [pendingExamLeaveAction, setPendingExamLeaveAction] =
    useState<PendingExamLeaveAction | null>(null);
  const [pendingExamLeaveTarget, setPendingExamLeaveTarget] =
    useState<ExamLeaveGuardTarget | null>(null);
  const [isExamLeaveSavePending, setIsExamLeaveSavePending] = useState(false);
  const isDesktopViewport = useMediaQuery("(min-width: 1201px)", false);
  const [examPanelsCollapsed, setExamPanelsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(min-width: 1201px)").matches;
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
  const canEdit =
    Boolean(preview.selectedFile) && preview.previewState === "idle";
  const hasUnsavedMarkdownDraftChanges =
    Boolean(preview.selectedFile) && editDraft !== preview.preview;
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
  const handleTaskProfileEditorControlsReady = useCallback(
    (controls: ExamEditorControlsState | null) => {
      taskProfileEditorControlsRef.current = controls;
      setTaskProfileEditorControls(controls);
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
    setIsEditing(false);
    setEditDraft("");
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
    preview.setRawPreview(settings.markdownPreviewDefaultMode === "raw");
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

  const handleEditStart = useCallback(
    (options?: { caretIndex?: number | null; origin?: "raw" | "markdown" }) => {
      if (!preview.selectedFile || preview.previewState !== "idle") {
        return;
      }
      setEditDraft(preview.preview);
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
      if (!preview.selectedFile || isSaving) {
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
          path: preview.selectedFile.path,
          contents: editDraft,
        });
        preview.setPreview(editDraft);
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
    [editDraft, isSaving, preview],
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
    if (preview.rawPreview || isEditing) {
      return;
    }
    if (isHybridBlockDirty) {
      return;
    }
    if (!settings.markdownViewEditEnabled) {
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
    preview.previewState,
    preview.rawPreview,
    preview.selectedFile,
    saveDraftToDisk,
    settings.markdownViewEditEnabled,
    vaultView,
  ]);

  const handleWriteSave = useCallback(async () => {
    await saveDraftToDisk({ exitWriteMode: true });
  }, [saveDraftToDisk]);

  const handleWriteCancel = useCallback(() => {
    setEditError("");
    setEditDraft(preview.preview);
    setIsHybridBlockDirty(false);
    setDocumentMode("edit");
    setIsEditing(false);
    setEditCaretIndex(null);
  }, [preview.preview]);

  const persistMarkdownBeforeNavigation = useCallback(async () => {
    if (documentMode === "write") {
      setEditError("Bitte Write-Entwurf zuerst speichern oder abbrechen.");
      return false;
    }
    if (isHybridBlockDirty) {
      setEditError("Bitte den aktiven Block zuerst abschliessen.");
      return false;
    }
    if (isEditing) {
      return handleEditAutosave();
    }
    if (
      documentMode === "edit" &&
      vaultView === "markdown" &&
      settings.markdownViewEditEnabled &&
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
    settings.markdownViewEditEnabled,
    vaultView,
  ]);

  const resolveDirtyExamContext = useCallback((): {
    target: ExamLeaveGuardTarget;
    controls: ExamEditorControlsState;
  } | null => {
    const modalControls = taskProfileEditorControlsRef.current;
    if (
      isTaskProfileEditorModalOpen &&
      modalControls?.hasUnsavedChanges
    ) {
      return { target: "profile-modal", controls: modalControls };
    }
    const mainControls = examControlsRef.current;
    if (vaultView === "exam" && mainControls?.hasUnsavedChanges) {
      return { target: "main-editor", controls: mainControls };
    }
    return null;
  }, [isTaskProfileEditorModalOpen, vaultView]);

  const completePendingExamLeave = useCallback((allowed: boolean) => {
    const resolve = pendingExamLeaveResolveRef.current;
    pendingExamLeaveProceedRef.current = null;
    pendingExamLeaveResolveRef.current = null;
    setPendingExamLeaveAction(null);
    setPendingExamLeaveTarget(null);
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
      const dirtyContext = resolveDirtyExamContext();
      if (!dirtyContext) {
        await proceed();
        return true;
      }
      return new Promise<boolean>((resolve) => {
        pendingExamLeaveProceedRef.current = proceed;
        pendingExamLeaveResolveRef.current = resolve;
        setPendingExamLeaveAction(action);
        setPendingExamLeaveTarget(dirtyContext.target);
        setIsExamLeaveSavePending(false);
      });
    },
    [pendingExamLeaveAction, resolveDirtyExamContext],
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
    (file: Parameters<typeof actions.handleSelectFile>[0]) => {
      void (async () => {
        await runDashboardNavigationGuard("file-select", async () => {
          setDocumentMode("edit");
          actions.handleSelectFile(file);
        });
      })();
    },
    [actions, runDashboardNavigationGuard],
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

  const handleToggleRawPreview = useCallback(async () => {
    const saved = await persistMarkdownBeforeNavigation();
    if (!saved) {
      return;
    }
    preview.setRawPreview((current) => !current);
  }, [persistMarkdownBeforeNavigation, preview]);
  const handleEditCaretApplied = useCallback(() => {
    setEditCaretIndex(null);
  }, []);
  const handleExamSave = useCallback(
    ({ path, markdown }: { path: string; markdown: string }) => {
      if (preview.selectedFile?.path === path) {
        preview.setPreview(markdown);
      }
      if (!vault.files.some((file) => file.path === path)) {
        const relativePath = resolveVaultRelativePath(path);
        if (relativePath) {
          const nextFiles = [
            ...vault.files,
            { path, relative_path: relativePath },
          ].sort((a, b) => a.relative_path.localeCompare(b.relative_path));
          vault.setFiles(nextFiles);
        }
      }
    },
    [
      preview.selectedFile?.path,
      preview.setPreview,
      resolveVaultRelativePath,
      vault.files,
      vault.setFiles,
    ],
  );
  const closeTaskProfileEditorModal = useCallback(() => {
    setIsTaskProfileEditorModalOpen(false);
    taskProfileEditorControlsRef.current = null;
    setTaskProfileEditorControls(null);
  }, []);

  const handleCloseTaskProfileEditorModal = useCallback(() => {
    void requestExamLeaveGuard("profile-modal-close", async () => {
      closeTaskProfileEditorModal();
    });
  }, [closeTaskProfileEditorModal, requestExamLeaveGuard]);

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
      setIsTaskProfileEditorModalOpen(true);
    },
    [
      pointsProfiles,
      pointsProfiles.createProfile,
      pointsProfiles.defaultProfileId,
      pointsProfiles.resolveProfileByName,
      pointsProfiles.selectedProfileId,
      pointsProfiles.setSelectedProfileId,
    ],
  );

  useEffect(() => {
    if (!isTaskProfileEditorModalOpen || !taskProfileEditorControls) {
      return;
    }
    if (taskProfileEditorControls.mode !== "points") {
      taskProfileEditorControls.onModeChange("points");
    }
  }, [isTaskProfileEditorModalOpen, taskProfileEditorControls]);

  const noteModalActive = noteModalEnabled && isNoteModalOpen;
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
  const pendingExamLeaveControls =
    pendingExamLeaveTarget === "profile-modal"
      ? taskProfileEditorControls
      : pendingExamLeaveTarget === "main-editor"
        ? examControls
        : null;
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

  return (
    <div className="dashboard-page">
      {vaultView === "exam" ? (
        <header className="content-header">
          <div className="vault-header-row">
            <div className="vault-saved-path">
              <span className="muted">Saved path:</span>
              <span className="save-path">
                {examControls?.savePath ?? "Not saved yet"}
              </span>
              {examControls?.saveState === "saving" ? (
                <span className="pill">Saving...</span>
              ) : examControls?.saveState === "saved" ? (
                <span className="pill success">Saved</span>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

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
        className={`workspace${panelsCollapsed ? " note-collapsed" : ""}`}
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
            rawPreview={preview.rawPreview}
            markdownViewEditEnabled={settings.markdownViewEditEnabled}
            documentMode={documentMode}
            markdownHybridEnabled
            selectedFile={preview.selectedFile}
            vaultFiles={vault.files}
            vaultPngAssets={vault.pngAssets}
            vaultPath={vault.vaultPath}
            sourceRelativePath={preview.selectedFile?.relative_path ?? null}
            canEdit={canEdit}
            markdownEditorStyle={markdownEditorStyle}
            onEditChange={setEditDraft}
            onHybridDirtyChange={setIsHybridBlockDirty}
            onEditCaretApplied={handleEditCaretApplied}
            onEditExit={handleEditAutosave}
            onEditStart={handleEditStart}
            onToggleRawPreview={handleToggleRawPreview}
            onWriteSave={handleWriteSave}
            onWriteCancel={handleWriteCancel}
            onFrontmatterSave={handleFrontmatterSave}
            onNavigateWikilink={handleFrontmatterWikilinkNavigate}
            onOpenTaskProfileEditor={handleOpenTaskProfileEditor}
            taskProfileSummariesByName={frontmatterTaskProfileSummaries}
            valueSuggestionsByKey={frontmatterValueSuggestions}
            keySuggestions={frontmatterKeySuggestions}
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
          noteModalEnabled ? null : (
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
          )
        ) : (
          <div className="note-column">
            {panelsCollapsed ? (
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
            ) : examControls ? (
              <section className="panel toolbar-panel exam-editor-controls-panel">
                <div className="exam-editor-toolbar">
                  <div className="pill-grid" role="tablist" aria-label="Editor mode">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        examControls.mode === "structure" ? "active" : ""
                      }`}
                      onClick={() => examControls.onModeChange("structure")}
                      role="tab"
                      aria-selected={examControls.mode === "structure"}
                    >
                      Structure
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        examControls.mode === "content" ? "active" : ""
                      }`}
                      onClick={() => examControls.onModeChange("content")}
                      role="tab"
                      aria-selected={examControls.mode === "content"}
                    >
                      Content
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        examControls.mode === "points" ? "active" : ""
                      }`}
                      onClick={() => examControls.onModeChange("points")}
                      role="tab"
                      aria-selected={examControls.mode === "points"}
                    >
                      Points
                    </button>
                  </div>
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
                </div>
              </section>
            ) : null}
            {noteModalEnabled ? null : (
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
            )}
          </div>
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
      <ModalShell
        isOpen={isTaskProfileEditorModalOpen}
        title="Points Profile Editor"
        onClose={handleCloseTaskProfileEditorModal}
        className="task-profile-editor-modal-panel"
        bodyClassName="task-profile-editor-modal-body"
      >
        <ExamEditorView
          sourcePath={preview.selectedFile?.path ?? null}
          sourceRelativePath={preview.selectedFile?.relative_path ?? null}
          sourceMarkdown={preview.previewState === "idle" ? preview.preview : undefined}
          activeFolderPath={normalizedActiveFolderPath || null}
          vaultFiles={vault.files}
          vaultPngAssets={vault.pngAssets}
          vaultPath={vault.vaultPath ?? null}
          pointsProfiles={pointsProfiles}
          showMoveButtons={settings.examEditorShowMoveButtons}
          variant="study"
          onControlsReady={handleTaskProfileEditorControlsReady}
          onSave={handleExamSave}
        />
      </ModalShell>
    </div>
  );
};

export const DashboardPage = forwardRef(DashboardPageInner);
DashboardPage.displayName = "DashboardPage";
