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

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileList } from "../components/FileList";
import { PreviewPanel } from "../components/PreviewPanel";
import { useAppState } from "../components/AppStateProvider";
import { asErrorMessage } from "../lib/errors";
import { normalizeRelativePath } from "../lib/path";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";
const notePanelStorageKey = "fmd.notePanelCollapsed";

export const DashboardPage = () => {
  const { actions, preview, vault } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editCaretIndex, setEditCaretIndex] = useState<number | null>(null);
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

  useEffect(() => {
    setIsEditing(false);
    setEditDraft("");
    setEditError("");
    setIsSaving(false);
    setEditCaretIndex(null);
  }, [preview.selectedFile?.path]);

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

  const handleToggleNoteCollapsed = useCallback(() => {
    setNoteCollapsed((current) => !current);
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

  return (
    <div className="dashboard-page">
      <header className="content-header">
        <div>
          <p className="eyebrow">Makedon</p>
          <h1>Vault</h1>
          <p className="muted">
            Waehle einen Vault, scanne Markdown-Dateien und sieh dir Inhalte sofort
            an.
          </p>
        </div>
      </header>

      <div className={`workspace${noteCollapsed ? " note-collapsed" : ""}`}>
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
          selectedFile={preview.selectedFile}
          canEdit={canEdit}
          onEditChange={setEditDraft}
          onEditCaretApplied={handleEditCaretApplied}
          onEditExit={handleEditAutosave}
          onEditStart={handleEditStart}
          onToggleRawPreview={handleToggleRawPreview}
        />

        <FileList
          activeFolderPath={normalizedActiveFolderPath || null}
          fileCountLabel={fileCountLabel}
          files={visibleFiles}
          isCollapsed={noteCollapsed}
          listError={vault.listError}
          listState={vault.listState}
          onSelectFile={actions.handleSelectFile}
          onToggleCollapsed={handleToggleNoteCollapsed}
          selectedFile={preview.selectedFile}
          vaultPath={vault.vaultPath}
        />
      </div>
    </div>
  );
};
