/**
 * @file apps/fmd-desktop/src/components/FileList.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente File List.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - FileList: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

type FileListProps = {
  activeFolderPath: string | null;
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const FileList = ({
  activeFolderPath,
  fileCountLabel,
  files,
  listError,
  listState,
  onSelectFile,
  selectedFile,
  vaultPath,
}: FileListProps) => {
  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <div>
          <h2>Notizen</h2>
          <p className="muted">{fileCountLabel}</p>
        </div>
        {listState === "loading" ? <span className="chip">Scanne...</span> : null}
      </div>
      <div className="panel-body">
        {!vaultPath ? (
          <div className="empty-state">Waehle einen Vault, um die Liste zu fuellen.</div>
        ) : null}
        {listError ? <div className="error">{listError}</div> : null}
        {vaultPath && listState === "idle" && files.length === 0 ? (
          <div className="empty-state">
            {activeFolderPath
              ? "Keine Markdown-Dateien in diesem Ordner."
              : "Keine Markdown-Dateien in diesem Vault."}
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
                  onClick={() => onSelectFile(file)}
                >
                  <span className="file-name">{file.relative_path}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
};
