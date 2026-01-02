import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

type FileListProps = {
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const FileList = ({
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
          <div className="empty-state">Keine Markdown-Dateien in diesem Vault.</div>
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
