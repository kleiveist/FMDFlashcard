/**
 * @file apps/fmd-desktop/src/components/settings/VaultIndexSection.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Vault Index Section.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/components/settings/DataSyncTabContent.tsx: UI-Komponente.
 *
 * Exportiert:
 * - VaultIndexSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import type { ChangeEvent } from "react";
import { type LoadState } from "../../lib/types";

type VaultIndexSectionProps = {
  lastOpenedFile: string | null;
  listState: LoadState;
  listError: string;
  lastRefreshAt: string | null;
  onCopyVaultPath: () => Promise<void>;
  onShowHiddenFoldersToggle: (value: boolean) => void;
  onShowEmptyFoldersToggle: (value: boolean) => void;
  onRescanVault: (source?: string) => Promise<boolean>;
  onResetIndex: () => void;
  vaultIndexedComplete: boolean;
  showHiddenFolders: boolean;
  showEmptyFolders: boolean;
  vaultPath: string | null;
};

export const VaultIndexSection = ({
  lastOpenedFile,
  listState,
  listError,
  lastRefreshAt,
  onCopyVaultPath,
  onShowHiddenFoldersToggle,
  onShowEmptyFoldersToggle,
  onRescanVault,
  onResetIndex,
  vaultIndexedComplete,
  showHiddenFolders,
  showEmptyFolders,
  vaultPath,
}: VaultIndexSectionProps) => {
  const handleShowHiddenFoldersChange = (event: ChangeEvent<HTMLInputElement>) => {
    onShowHiddenFoldersToggle(event.target.checked);
  };
  const handleShowEmptyFoldersChange = (event: ChangeEvent<HTMLInputElement>) => {
    onShowEmptyFoldersToggle(event.target.checked);
  };
  const isRefreshing = listState === "loading";
  const lastRefreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleString()
    : "Not refreshed yet";

  return (
    <section className="panel vault-index-panel">
      <div className="panel-header">
        <div>
          <h2>Vault &amp; Index</h2>
        </div>
      </div>
      <div className="panel-body">
        <p className="muted">Vault path, last opened note, and index status.</p>
        <div className="setting-row">
          <span className="label">Current vault path</span>
          <div className="setting-inline">
            <span className="value path-value">{vaultPath ?? "—"}</span>
            <button
              type="button"
              className="ghost small"
              onClick={onCopyVaultPath}
              disabled={!vaultPath}
            >
              Copy
            </button>
          </div>
        </div>
        <div className="setting-row">
          <span className="label">Last opened</span>
          <span className="value path-value">
            {lastOpenedFile ?? "Not loaded yet"}
          </span>
        </div>
        <div className="setting-row">
          <span className="label">Show hidden folders</span>
          <div className="theme-toggle">
            <span className="toggle-label">Off</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={showHiddenFolders}
                onChange={handleShowHiddenFoldersChange}
                aria-label="Show hidden folders"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">On</span>
          </div>
          <span className="helper-text">
            Folders starting with a dot (e.g., .git, .obsidian).
          </span>
        </div>
        <div className="setting-row">
          <span className="label">Show empty folders</span>
          <div className="theme-toggle">
            <span className="toggle-label">Off</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={showEmptyFolders}
                onChange={handleShowEmptyFoldersChange}
                aria-label="Show empty folders"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">On</span>
          </div>
          <span className="helper-text">
            Show folders that do not contain markdown files.
          </span>
        </div>
        <div className="setting-row">
          <span className="label">Status indicators</span>
          <div className="status-list">
            <div className="status-item">
              <label className="status-checkbox">
                <input
                  type="checkbox"
                  checked={vaultIndexedComplete}
                  disabled
                  aria-label="Fully processed"
                />
                <span>Fully processed</span>
              </label>
              <span className="helper-text">
                All notes have been scanned and indexed.
              </span>
            </div>
          </div>
        </div>
        <div className="setting-row">
          <span className="label">Actions</span>
          <div className="setting-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => onRescanVault("settings:vault-index")}
              disabled={!vaultPath || isRefreshing}
            >
              Rescan vault
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={onResetIndex}
              disabled={!vaultPath || isRefreshing}
            >
              Reset index
            </button>
          </div>
          <span className="helper-text">
            Reset index clears the current vault registration.
          </span>
          <div className="setting-inline">
            <span className="muted">
              {isRefreshing ? "Refreshing active vault..." : `Last refresh: ${lastRefreshLabel}`}
            </span>
          </div>
          {listError ? (
            <div className="error" role="status">
              {listError}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
