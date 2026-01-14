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
  isCollapsed: boolean;
  listError: string;
  listState: LoadState;
  onSelectFile: (file: VaultFile) => void;
  onToggleCollapsed: () => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const FileList = ({
  activeFolderPath,
  fileCountLabel,
  files,
  isCollapsed,
  listError,
  listState,
  onSelectFile,
  onToggleCollapsed,
  selectedFile,
  vaultPath,
}: FileListProps) => {
  return (
    <section
      className={`panel list-panel note-panel ${isCollapsed ? "is-collapsed" : ""}`}
    >
      {isCollapsed ? (
        <button
          type="button"
          className="panel-header note-toggle note-handle"
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
          aria-controls="note-panel-body"
          aria-label="Expand Note panel"
        >
          <span className="note-handle-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="panel-header note-toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
          aria-controls="note-panel-body"
          aria-label="Collapse Note panel"
        >
          <span className="note-heading">
            <span className="note-title">Note</span>
            <span className="muted note-meta">{fileCountLabel}</span>
          </span>
          {listState === "loading" ? (
            <span className="chip note-meta">Scanne...</span>
          ) : null}
        </button>
      )}
      <div
        className="panel-body"
        id="note-panel-body"
        hidden={isCollapsed}
        aria-hidden={isCollapsed}
      >
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
