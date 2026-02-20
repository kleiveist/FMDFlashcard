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
import type { SettingsSubPageId } from "../../features/settings/settingsNavigation";

type VaultSubPageId = Extract<SettingsSubPageId, "vault-index" | "vault-data">;

type VaultIndexSectionProps = {
  activeSubPageId: VaultSubPageId;
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
  activeSubPageId,
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

  if (activeSubPageId === "vault-data") {
    const showHiddenFoldersInputId = "settings-vault-data-show-hidden-folders";
    const showEmptyFoldersInputId = "settings-vault-data-show-empty-folders";
    return (
      <section className="panel vault-data-panel">
        <div className="panel-body">
          <div className="setting-row">
            <label className="label" htmlFor={showHiddenFoldersInputId}>
              Show Hidden Folders
            </label>
            <div className="theme-toggle">
              <span className="toggle-label">Off</span>
              <label className="switch">
                <input
                  id={showHiddenFoldersInputId}
                  type="checkbox"
                  checked={showHiddenFolders}
                  onChange={handleShowHiddenFoldersChange}
                  aria-label="Show Hidden Folders"
                />
                <span className="slider" />
              </label>
              <span className="toggle-label">On</span>
            </div>
          </div>
          <div className="setting-row">
            <label className="label" htmlFor={showEmptyFoldersInputId}>
              Show Empty Folders
            </label>
            <div className="theme-toggle">
              <span className="toggle-label">Off</span>
              <label className="switch">
                <input
                  id={showEmptyFoldersInputId}
                  type="checkbox"
                  checked={showEmptyFolders}
                  onChange={handleShowEmptyFoldersChange}
                  aria-label="Show Empty Folders"
                />
                <span className="slider" />
              </label>
              <span className="toggle-label">On</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const isRefreshing = listState === "loading";
  const lastRefreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleString()
    : "Not refreshed yet";
  const hasLastOpenedFile =
    typeof lastOpenedFile === "string" && lastOpenedFile.trim().length > 0;

  return (
    <section className="panel vault-index-panel">
      <div className="panel-body">
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
        {hasLastOpenedFile ? (
          <div className="setting-row">
            <span className="label">Last opened</span>
            <span className="value path-value">{lastOpenedFile}</span>
          </div>
        ) : null}
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
