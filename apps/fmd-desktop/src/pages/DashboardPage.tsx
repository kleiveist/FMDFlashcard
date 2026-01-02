import { useMemo } from "react";
import { FileList } from "../components/FileList";
import { PreviewPanel } from "../components/PreviewPanel";
import { VaultTree } from "../components/VaultTree";
import { useAppState } from "../components/AppStateProvider";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

export const DashboardPage = () => {
  const { actions, preview, vault } = useAppState();
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

  return (
    <>
      <header className="content-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Vault Uebersicht</h1>
          <p className="muted">
            Waehle einen Vault, scanne Markdown-Dateien und sieh dir Inhalte sofort
            an.
          </p>
        </div>
      </header>

      <VaultTree
        fileCountLabel={fileCountLabel}
        files={vault.files}
        listError={vault.listError}
        listState={vault.listState}
        onSelectFile={actions.handleSelectFile}
        selectedFile={preview.selectedFile}
        vaultPath={vault.vaultPath}
      />

      <div className="workspace">
        <FileList
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
          preview={preview.preview}
          previewError={preview.previewError}
          previewState={preview.previewState}
          rawPreview={preview.rawPreview}
          selectedFile={preview.selectedFile}
          setRawPreview={preview.setRawPreview}
        />
      </div>
    </>
  );
};
