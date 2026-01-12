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

import { useState, type ChangeEvent } from "react";
import { type LoadState } from "../../lib/types";
import { DataSyncTabContent } from "./DataSyncTabContent";

type VaultIndexTab = "vault" | "data-sync";

type VaultIndexSectionProps = {
  lastOpenedFile: string | null;
  listState: LoadState;
  onCopyVaultPath: () => void;
  onHiddenFoldersLevelChange: (value: number) => void;
  onRescanVault: () => void;
  onResetIndex: () => void;
  vaultIndexedComplete: boolean;
  hiddenFoldersLevel: number;
  vaultPath: string | null;
};

export const VaultIndexSection = ({
  lastOpenedFile,
  listState,
  onCopyVaultPath,
  onHiddenFoldersLevelChange,
  onRescanVault,
  onResetIndex,
  vaultIndexedComplete,
  hiddenFoldersLevel,
  vaultPath,
}: VaultIndexSectionProps) => {
  const [activeTab, setActiveTab] = useState<VaultIndexTab>("vault");
  const isVaultTab = activeTab === "vault";
  const handleHiddenFoldersChange = (event: ChangeEvent<HTMLInputElement>) => {
    onHiddenFoldersLevelChange(Number(event.target.value));
  };
  const renderHiddenFoldersControl = (
    label: string,
    ariaLabel: string,
    helperText: string,
    controlId: string,
  ) => (
    <div className="setting-row">
      <span className="label">{`${label} (${hiddenFoldersLevel})`}</span>
      <div className="setting-inline">
        <input
          type="range"
          className="range-input"
          min={0}
          max={90}
          step={1}
          value={hiddenFoldersLevel}
          onChange={handleHiddenFoldersChange}
          id={controlId}
          aria-label={ariaLabel}
        />
      </div>
      <span className="helper-text">{helperText}</span>
    </div>
  );

  return (
    <section className="panel vault-index-panel">
      <div className="panel-header settings-tab-header">
        <div>
          <h2>Vault &amp; Index</h2>
        </div>
        <div className="settings-tabs" role="tablist" aria-label="Vault settings tabs">
          <button
            type="button"
            className={`pill pill-button ${isVaultTab ? "active" : ""}`}
            onClick={() => setActiveTab("vault")}
            role="tab"
            aria-selected={isVaultTab}
            aria-controls="vault-index-tab-panel"
            id="vault-index-tab"
          >
            Vault &amp; Index
          </button>
          <button
            type="button"
            className={`pill pill-button ${isVaultTab ? "" : "active"}`}
            onClick={() => setActiveTab("data-sync")}
            role="tab"
            aria-selected={!isVaultTab}
            aria-controls="data-sync-tab-panel"
            id="data-sync-tab"
          >
            Data &amp; Sync
          </button>
        </div>
      </div>
      {isVaultTab ? (
        <div
          className="settings-tab-panel"
          role="tabpanel"
          id="vault-index-tab-panel"
          aria-labelledby="vault-index-tab"
        >
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
          {renderHiddenFoldersControl(
            "Hidden folders (Vault)",
            "Hidden folders level for vault tree",
            "0 hides hidden folders in the vault tree. Values above 0 show them.",
            "hidden-folders-vault",
          )}
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
          {renderHiddenFoldersControl(
            "Hidden folders (Index)",
            "Hidden folders level for index",
            "0 excludes hidden folders from indexing. Values above 0 include them.",
            "hidden-folders-index",
          )}
          <div className="setting-row">
            <span className="label">Actions</span>
            <div className="setting-actions">
              <button
                type="button"
                className="ghost small"
                onClick={onRescanVault}
                disabled={!vaultPath || listState === "loading"}
              >
                Rescan vault
              </button>
              <button
                type="button"
                className="ghost small"
                onClick={onResetIndex}
                disabled={!vaultPath || listState === "loading"}
              >
                Reset index
              </button>
            </div>
            <span className="helper-text">
              Reset index clears the current vault registration.
            </span>
          </div>
        </div>
      ) : (
        <div
          className="settings-tab-panel"
          role="tabpanel"
          id="data-sync-tab-panel"
          aria-labelledby="data-sync-tab"
        >
          <p className="muted">Storage and sync options will land here later.</p>
          <div className="settings-tab-content">
            <DataSyncTabContent />
          </div>
        </div>
      )}
    </section>
  );
};
