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
  const [vaultView, setVaultView] = useState<DashboardView>(initialVaultView);
  const [examControls, setExamControls] = useState<ExamEditorControlsState | null>(
    null,
  );
  const isDesktopViewport = useMediaQuery("(min-width: 1201px)", false);
  const [examPanelsCollapsed, setExamPanelsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(min-width: 1201px)").matches;
  });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const didApplyPreviewDefaultModeRef = useRef(false);
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
  }, [preview.selectedFile?.path]);

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

  const handleEditAutosave = useCallback(async () => {
    if (!preview.selectedFile || !isEditing || isSaving) {
      return false;
    }
    if (editDraft === preview.preview) {
      setIsEditing(false);
      setEditCaretIndex(null);
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
      setIsEditing(false);
      setEditCaretIndex(null);
      return true;
    } catch (error) {
      setEditError(asErrorMessage(error, "Failed to save file."));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [editDraft, isEditing, isSaving, preview]);

  const handleFrontmatterSave = useCallback(
    async (nextMarkdown: string) => {
      if (!preview.selectedFile || isEditing || isSaving) {
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
        return true;
      } catch (error) {
        setEditError(asErrorMessage(error, "Failed to save file."));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [isEditing, isSaving, preview],
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
        actions.handleSelectFile(resolvedFile);
      }
    },
    [actions, wikilinkFileLookup],
  );

  const handleVaultViewChange = useCallback(
    async (nextView: DashboardView) => {
      if (nextView === vaultView) {
        return;
      }
      if (isEditing) {
        const saved = await handleEditAutosave();
        if (!saved) {
          return;
        }
      }
      setVaultView(nextView);
      onVaultViewChange?.(nextView);
    },
    [handleEditAutosave, isEditing, onVaultViewChange, vaultView],
  );

  useImperativeHandle(
    ref,
    () => ({
      requestVaultViewChange: (nextView: DashboardView) => {
        void handleVaultViewChange(nextView);
      },
    }),
    [handleVaultViewChange],
  );

  const handleToggleRawPreview = useCallback(async () => {
    if (isEditing) {
      const saved = await handleEditAutosave();
      if (!saved) {
        return;
      }
    }
    preview.setRawPreview((current) => !current);
  }, [handleEditAutosave, isEditing, preview]);
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
            selectedFile={preview.selectedFile}
            vaultFiles={vault.files}
            vaultPngAssets={vault.pngAssets}
            vaultPath={vault.vaultPath}
            sourceRelativePath={preview.selectedFile?.relative_path ?? null}
            canEdit={canEdit}
            markdownEditorStyle={markdownEditorStyle}
            onEditChange={setEditDraft}
            onEditCaretApplied={handleEditCaretApplied}
            onEditExit={handleEditAutosave}
            onEditStart={handleEditStart}
            onToggleRawPreview={handleToggleRawPreview}
            onFrontmatterSave={handleFrontmatterSave}
            onNavigateWikilink={handleFrontmatterWikilinkNavigate}
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
            vaultPath={vault.vaultPath ?? null}
            pointsProfiles={pointsProfiles}
            showMoveButtons={settings.examEditorShowMoveButtons}
            variant="study"
            onControlsReady={setExamControls}
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
              onRescanVault={actions.handleRescanVault}
              onSelectFile={actions.handleSelectFile}
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
                onRescanVault={actions.handleRescanVault}
                onSelectFile={actions.handleSelectFile}
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
            onRescanVault={actions.handleRescanVault}
            onSelectFile={actions.handleSelectFile}
            onToggleCollapsed={handleToggleNoteCollapsed}
            selectedFile={preview.selectedFile}
            showCollapseStrip={vaultView === "exam"}
            vaultPath={vault.vaultPath}
          />
        </NoteModal>
      ) : null}
    </div>
  );
};

export const DashboardPage = forwardRef(DashboardPageInner);
DashboardPage.displayName = "DashboardPage";
