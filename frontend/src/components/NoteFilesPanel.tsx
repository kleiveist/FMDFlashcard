/**
 * @file apps/fmd-desktop/src/components/NoteFilesPanel.tsx
 *
 * Zweck:
 * - Rendert eine Liste von Notizdateien mit Flashcards.
 */

import type { FlashcardFileEntry } from "../features/flashcards/useFlashcards";
import type { LoadState } from "../lib/types";
import type { VaultFile } from "../lib/tree";

type NoteFilesPanelProps = {
  files: FlashcardFileEntry[];
  listState?: LoadState;
  listError?: string;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
  onSelectFile: (file: VaultFile) => void;
  className?: string;
};

export const NoteFilesPanel = ({
  files,
  listState = "idle",
  listError = "",
  selectedFile,
  vaultPath,
  onSelectFile,
  className,
}: NoteFilesPanelProps) => {
  const fileCountLabel = !vaultPath
    ? "No vault selected"
    : files.length === 0
      ? "Keine Notizen mit Flashcards"
      : `${files.length} Note File${files.length === 1 ? "" : "s"}`;
  const isScrollable = files.length > 5;

  return (
    <section className={["panel list-panel", className].filter(Boolean).join(" ")}>
      <div className="panel-header">
        <div>
          <h2>Note Files</h2>
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
            Keine Markdown-Dateien mit Flashcards gefunden.
          </div>
        ) : null}
        {vaultPath && listState !== "error" ? (
          <div className={`exam-file-list ${isScrollable ? "is-scrollable" : ""}`}>
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
          </div>
        ) : null}
      </div>
    </section>
  );
};
