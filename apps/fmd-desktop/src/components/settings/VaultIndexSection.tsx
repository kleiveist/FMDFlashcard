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
import {
  formatSettingsText,
  type SettingsLanguage,
  tSettings,
} from "../../features/settings/settingsI18n";

type VaultIndexSectionProps = {
  language: SettingsLanguage;
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
  language,
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
  const showHiddenFoldersInputId = "settings-vault-index-show-hidden-folders";
  const showEmptyFoldersInputId = "settings-vault-index-show-empty-folders";

  const isRefreshing = listState === "loading";
  const lastRefreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleString()
    : tSettings(language, "settings.vaultIndex.notRefreshedYet");
  const hasLastOpenedFile = typeof lastOpenedFile === "string" && lastOpenedFile.trim().length > 0;

  return (
    <section className="panel vault-index-panel">
      <div className="panel-body">
        <div className="setting-row">
          <span className="label">
            {tSettings(language, "settings.vaultIndex.currentVaultPath")}
          </span>
          <div className="setting-inline">
            <span className="value path-value">{vaultPath ?? "—"}</span>
            <button
              type="button"
              className="ghost small"
              onClick={onCopyVaultPath}
              disabled={!vaultPath}
            >
              {tSettings(language, "settings.common.copy")}
            </button>
          </div>
        </div>
        {hasLastOpenedFile ? (
          <div className="setting-row">
            <span className="label">{tSettings(language, "settings.vaultIndex.lastOpened")}</span>
            <span className="value path-value">{lastOpenedFile}</span>
          </div>
        ) : null}
        <div className="setting-row">
          <span className="label">
            {tSettings(language, "settings.vaultIndex.statusIndicators")}
          </span>
          <div className="status-list">
            <div className="status-item">
              <label className="status-checkbox">
                <input
                  type="checkbox"
                  checked={vaultIndexedComplete}
                  disabled
                  aria-label="Fully processed"
                />
                <span>{tSettings(language, "settings.vaultIndex.fullyProcessed")}</span>
              </label>
              <span className="helper-text">
                {tSettings(language, "settings.vaultIndex.fullyProcessedHelper")}
              </span>
            </div>
          </div>
        </div>
        <div className="setting-row">
          <span className="label">{tSettings(language, "settings.vaultIndex.actions")}</span>
          <div className="setting-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => onRescanVault("settings:vault-index")}
              disabled={!vaultPath || isRefreshing}
            >
              {tSettings(language, "settings.vaultIndex.rescanVault")}
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={onResetIndex}
              disabled={!vaultPath || isRefreshing}
            >
              {tSettings(language, "settings.vaultIndex.resetIndex")}
            </button>
          </div>
          <span className="helper-text">
            {tSettings(language, "settings.vaultIndex.resetIndexHelper")}
          </span>
          <div className="setting-inline">
            <span className="muted">
              {isRefreshing
                ? tSettings(language, "settings.vaultIndex.refreshing")
                : formatSettingsText(language, "settings.vaultIndex.lastRefresh", {
                    value: lastRefreshLabel,
                  })}
            </span>
          </div>
          {listError ? (
            <div className="error" role="status">
              {listError}
            </div>
          ) : null}
        </div>
        <div className="setting-row">
          <label className="label" htmlFor={showHiddenFoldersInputId}>
            {tSettings(language, "settings.vaultIndex.showHiddenFolders")}
          </label>
          <div className="theme-toggle">
            <span className="toggle-label">{tSettings(language, "settings.common.off")}</span>
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
            <span className="toggle-label">{tSettings(language, "settings.common.on")}</span>
          </div>
        </div>
        <div className="setting-row">
          <label className="label" htmlFor={showEmptyFoldersInputId}>
            {tSettings(language, "settings.vaultIndex.showEmptyFolders")}
          </label>
          <div className="theme-toggle">
            <span className="toggle-label">{tSettings(language, "settings.common.off")}</span>
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
            <span className="toggle-label">{tSettings(language, "settings.common.on")}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
