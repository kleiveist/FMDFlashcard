import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileList } from "../components/FileList";
import { PreviewPanel } from "../components/PreviewPanel";
import { useAppState } from "../components/AppStateProvider";
import { asErrorMessage } from "../lib/errors";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

export const DashboardPage = () => {
  const { actions, preview, vault } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editCaretIndex, setEditCaretIndex] = useState<number | null>(null);
  const editReturnToMarkdown = useRef(false);
  const fileCountLabel = useMemo(() => {
    if (!vault.vaultPath) {
      return "No vault selected";
    }
    if (vault.files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${vault.files.length} Markdown-Datei${
      vault.files.length === 1 ? "" : "en"
    }`;
  }, [vault.files.length, vault.vaultPath]);
  const canEdit =
    Boolean(preview.selectedFile) && preview.previewState === "idle";

  useEffect(() => {
    setIsEditing(false);
    setEditDraft("");
    setEditError("");
    setIsSaving(false);
    setEditCaretIndex(null);
    editReturnToMarkdown.current = false;
  }, [preview.selectedFile?.path]);

  const handleEditStart = useCallback(
    (options?: { caretIndex?: number | null; origin?: "raw" | "markdown" }) => {
      if (!preview.selectedFile || preview.previewState !== "idle") {
        return;
      }
      const startedInMarkdown =
        options?.origin === "markdown" ||
        (!options?.origin && !preview.rawPreview);
      if (startedInMarkdown && !preview.rawPreview) {
        preview.setRawPreview(true);
      }
      editReturnToMarkdown.current = startedInMarkdown;
      setEditDraft(preview.preview);
      setEditError("");
      setEditCaretIndex(
        typeof options?.caretIndex === "number" ? options.caretIndex : null,
      );
      setIsEditing(true);
    },
    [preview],
  );

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditError("");
    setEditCaretIndex(null);
    if (editReturnToMarkdown.current) {
      preview.setRawPreview(false);
      editReturnToMarkdown.current = false;
    }
  };

  const handleEditSave = async () => {
    if (!preview.selectedFile) {
      return;
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
      if (editReturnToMarkdown.current) {
        preview.setRawPreview(false);
        editReturnToMarkdown.current = false;
      }
    } catch (error) {
      setEditError(asErrorMessage(error, "Failed to save file."));
    } finally {
      setIsSaving(false);
    }
  };
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
          isSaving={isSaving}
          preview={preview.preview}
          previewError={preview.previewError}
          previewState={preview.previewState}
          rawPreview={preview.rawPreview}
          selectedFile={preview.selectedFile}
          canEdit={canEdit}
          onEditCancel={handleEditCancel}
          onEditChange={setEditDraft}
          onEditCaretApplied={handleEditCaretApplied}
          onEditSave={handleEditSave}
          onEditStart={handleEditStart}
          setRawPreview={preview.setRawPreview}
        />

        <FileList
          fileCountLabel={fileCountLabel}
          files={vault.files}
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
