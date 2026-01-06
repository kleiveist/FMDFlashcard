import type { LoadState } from "../../../lib/types";
import type { VaultFile } from "../../../lib/tree";

type ExamFilePanelProps = {
  files: VaultFile[];
  listState: LoadState;
  listError: string;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
  onSelectFile: (file: VaultFile) => void;
};

export const ExamFilePanel = ({
  files,
  listState,
  listError,
  selectedFile,
  vaultPath,
  onSelectFile,
}: ExamFilePanelProps) => {
  const fileCountLabel = !vaultPath
    ? "No vault selected"
    : files.length === 0
      ? "Keine Exam-Dateien"
      : `${files.length} Exam-Datei${files.length === 1 ? "" : "en"}`;

  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <div>
          <h2>Exam Files</h2>
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
            Keine Exam-Dateien gefunden. Fuege einen #exam ... # Block hinzu.
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
