import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileList } from "../components/FileList";
import { PreviewPanel } from "../components/PreviewPanel";
import { useAppState } from "../components/AppStateProvider";
import { asErrorMessage } from "../lib/errors";
import { normalizeRelativePath } from "../lib/path";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

export const DashboardPage = () => {
  const { actions, preview, vault } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editCaretIndex, setEditCaretIndex] = useState<number | null>(null);
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

      <div className="workspace">
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
          listError={vault.listError}
          listState={vault.listState}
          onSelectFile={actions.handleSelectFile}
          selectedFile={preview.selectedFile}
          vaultPath={vault.vaultPath}
        />
      </div>
    </div>
  );
};
