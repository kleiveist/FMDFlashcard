import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileList } from "../components/FileList";
import { PreviewPanel } from "../components/PreviewPanel";
import { VaultTree } from "../components/VaultTree";
import { useAppState } from "../components/AppStateProvider";
import { asErrorMessage } from "../lib/errors";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

export const DashboardPage = () => {
  const { actions, preview, vault } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileCountLabel = useMemo(() => {
    if (!vault.vaultPath) {
      return "Kein Vault gewaehlt";
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
  }, [preview.selectedFile?.path]);

  const handleEditStart = () => {
    if (!preview.selectedFile || preview.previewState !== "idle") {
      return;
    }
    setEditDraft(preview.preview);
    setEditError("");
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditError("");
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
    } catch (error) {
      setEditError(asErrorMessage(error, "Failed to save file."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dashboard-page">
      <header className="content-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Vault</h1>
          <p className="muted">
            Waehle einen Vault, scanne Markdown-Dateien und sieh dir Inhalte sofort
            an.
          </p>
        </div>
      </header>

      <div className="workspace">
        <VaultTree
          fileCountLabel={fileCountLabel}
          files={vault.files}
          listError={vault.listError}
          listState={vault.listState}
          onSelectFile={actions.handleSelectFile}
          selectedFile={preview.selectedFile}
          vaultPath={vault.vaultPath}
        />

        <PreviewPanel
          emptyPreview={emptyPreview}
          editDraft={editDraft}
          editError={editError}
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
