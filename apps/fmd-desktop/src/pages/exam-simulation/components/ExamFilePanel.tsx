/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamFilePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam File Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - ExamFilePanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import type { LoadState } from "../../../lib/types";
import type { VaultFile } from "../../../lib/tree";

type ExamFilePanelProps = {
  files: VaultFile[];
  listState: LoadState;
  listError: string;
  selectedPaths: string[];
  vaultPath: string | null;
  onToggleFile: (file: VaultFile) => void;
  className?: string;
};

export const ExamFilePanel = ({
  files,
  listState,
  listError,
  selectedPaths,
  vaultPath,
  onToggleFile,
  className,
}: ExamFilePanelProps) => {
  const selectedSet = new Set(selectedPaths);
  const selectedCount = selectedPaths.length;
  const fileCountLabel = !vaultPath
    ? "No vault selected"
    : files.length === 0
      ? "Keine Exam-Dateien"
      : `${files.length} Exam-Datei${files.length === 1 ? "" : "en"}`;
  const isScrollable = files.length > 5;

  return (
    <section className={["panel list-panel", className].filter(Boolean).join(" ")}>
      <div className="panel-header">
        <div>
          <h2>Exam Files</h2>
          <p className="muted">{fileCountLabel}</p>
        </div>
        <div className="exam-file-panel-status">
          {selectedCount > 0 ? (
            <span className="chip exam-file-selected-chip">
              {selectedCount} ausgewaehlt
            </span>
          ) : null}
          {listState === "loading" ? <span className="chip">Scanne...</span> : null}
        </div>
      </div>
      <div className="panel-body">
        {!vaultPath ? (
          <div className="empty-state">Waehle einen Vault, um die Liste zu fuellen.</div>
        ) : null}
        {listError ? <div className="error">{listError}</div> : null}
        {vaultPath && listState === "idle" && files.length === 0 ? (
          <div className="empty-state">
            Keine Exam-Dateien gefunden. Fuege einen #exam ... #endexam Block hinzu.
          </div>
        ) : null}
        {vaultPath && listState !== "error" ? (
          <div className={`exam-file-list ${isScrollable ? "is-scrollable" : ""}`}>
            <ul className="file-list">
              {files.map((file) => {
                const isSelected = selectedSet.has(file.path);
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      className={`file-item exam-file-item ${
                        isSelected ? "selected active" : ""
                      }`}
                      onClick={() => onToggleFile(file)}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={`exam-file-check ${isSelected ? "selected" : ""}`}
                        aria-hidden="true"
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                      <span className="file-name">{file.relative_path}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
};
