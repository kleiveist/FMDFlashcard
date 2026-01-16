/**
 * @file apps/fmd-desktop/src/components/settings/DataSyncTabContent.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Data Sync Tab Content.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/settings/VaultIndexSection.tsx: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - DataSyncTabContent: React-Komponente.
 * - LanguageTabContent: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useEffect, useState } from "react";
import type { UserVaultImportStrategy } from "../../lib/userVault";
import type { UserVaultState } from "../../features/user-vault/useUserVault";
import { isWordPressEnabled, logWordPressFeatureStatus } from "../../lib/featureFlags";

type AppLanguage = "de" | "en";

const LANGUAGE_LABELS: Record<
  AppLanguage,
  { heading: string; placeholder: string; deLabel: string; enLabel: string }
> = {
  de: {
    heading: "Sprache",
    placeholder: "Kommt spaeter.",
    deLabel: "Deutsch",
    enLabel: "Englisch",
  },
  en: {
    heading: "Language",
    placeholder: "Coming later.",
    deLabel: "German",
    enLabel: "English",
  },
};

type DataSyncTabContentProps = {
  userVault: UserVaultState;
};

export const DataSyncTabContent = ({ userVault }: DataSyncTabContentProps) => {
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [importStrategy, setImportStrategy] =
    useState<UserVaultImportStrategy>("merge");
  const wordpressEnabled = isWordPressEnabled();
  const isCustomMode = userVault.mode === "custom";
  const canManageVault = Boolean(userVault.resolvedPath);
  const canManageProfiles = canManageVault && userVault.profiles.length > 0;
  const canExportActive = canManageVault && Boolean(userVault.activeProfileId);

  useEffect(() => {
    if (userVault.activeProfileId) {
      setSelectedProfileId(userVault.activeProfileId);
      return;
    }
    setSelectedProfileId("");
  }, [userVault.activeProfileId]);

  useEffect(() => {
    logWordPressFeatureStatus();
  }, []);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      return;
    }
    await userVault.handleCreateProfile(newProfileName);
    setNewProfileName("");
  };

  const handleLoadProfile = async () => {
    if (!selectedProfileId) {
      return;
    }
    await userVault.handleSelectProfile(selectedProfileId);
  };

  const handleExportActive = async () => {
    await userVault.handleExport("active");
  };

  const handleExportAll = async () => {
    await userVault.handleExport("all");
  };

  const handleImport = async () => {
    await userVault.handleImport(importStrategy);
  };

  return (
    <>
      <div className="setting-row">
        <span className="label">User Vault Mode</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${userVault.mode === "auto" ? "active" : ""}`}
            aria-pressed={userVault.mode === "auto"}
            onClick={() => userVault.handleModeChange("auto")}
          >
            Auto (Vault/user)
          </button>
          <button
            type="button"
            className={`pill pill-button ${userVault.mode === "custom" ? "active" : ""}`}
            aria-pressed={userVault.mode === "custom"}
            onClick={() => userVault.handleModeChange("custom")}
          >
            Custom path
          </button>
          <button type="button" className="pill pill-button" disabled>
            Sync provider
          </button>
        </div>
        <span className="helper-text">
          Auto uses the current vault path. Custom stays fixed across vault switches.
        </span>
      </div>
      <div className="setting-row">
        <span className="label">Active path</span>
        <div className="setting-inline">
          <span className="value path-value">{userVault.resolvedPath ?? "—"}</span>
          <button
            type="button"
            className="ghost small"
            onClick={userVault.handlePickCustomPath}
            disabled={!isCustomMode || userVault.isBusy}
          >
            Change
          </button>
        </div>
        <span className="helper-text">
          {isCustomMode
            ? "Pick a folder outside the vault if you prefer."
            : "Set a vault to enable Auto mode."}
        </span>
      </div>
      <div className="setting-row">
        <span className="label">Profiles</span>
        <div className="status-list">
          <div className="status-row">
            <span className="value">Found profiles: {userVault.profiles.length}</span>
            <span className="value">
              Active profile: {userVault.activeProfile?.name ?? "—"}
            </span>
          </div>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">Create profile</span>
        <div className="setting-inline">
          <input
            type="text"
            className="text-input"
            value={newProfileName}
            onChange={(event) => setNewProfileName(event.target.value)}
            placeholder="Profile name"
            aria-label="Profile name"
            disabled={!canManageVault || userVault.isBusy}
          />
          <button
            type="button"
            className="ghost small"
            onClick={handleCreateProfile}
            disabled={!canManageVault || userVault.isBusy || !newProfileName.trim()}
          >
            Create
          </button>
        </div>
        <span className="helper-text">Date is added automatically.</span>
      </div>
      <div className="setting-row">
        <span className="label">Load profile</span>
        <div className="setting-inline">
          <select
            className="text-input"
            value={selectedProfileId}
            onChange={(event) => setSelectedProfileId(event.target.value)}
            disabled={!canManageProfiles || userVault.isBusy}
            aria-label="Select profile"
          >
            <option value="" disabled>
              Select profile
            </option>
            {userVault.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost small"
            onClick={handleLoadProfile}
            disabled={
              !canManageProfiles ||
              userVault.isBusy ||
              !selectedProfileId ||
              selectedProfileId === userVault.activeProfileId
            }
          >
            Load
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">Export / Import (JSON)</span>
        <div className="setting-actions">
          <button
            type="button"
            className="ghost small"
            onClick={handleExportActive}
            disabled={!canExportActive || userVault.isBusy}
          >
            Export profile
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={handleExportAll}
            disabled={!canManageProfiles || userVault.isBusy}
          >
            Export all profiles
          </button>
        </div>
        <div className="setting-inline">
          <select
            className="text-input"
            value={importStrategy}
            onChange={(event) =>
              setImportStrategy(event.target.value as UserVaultImportStrategy)
            }
            disabled={!canExportActive || userVault.isBusy}
            aria-label="Import strategy"
          >
            <option value="merge">Merge</option>
            <option value="overwrite">Overwrite</option>
          </select>
          <button
            type="button"
            className="ghost small"
            onClick={handleImport}
            disabled={!canExportActive || userVault.isBusy}
          >
            Import JSON
          </button>
        </div>
        <span className="helper-text">
          Merge keeps existing entries and adds new ones. Overwrite replaces data.
        </span>
      </div>
      <div className="setting-row">
        <span className="label">WordPress</span>
        <div className="setting-inline">
          <span className="value">
            {wordpressEnabled
              ? "Enabled via VITE_WORDPRESS_ENABLED"
              : "Disabled (flag off)"}
          </span>
          <button type="button" className="ghost small" disabled>
            {wordpressEnabled ? "Active" : "Coming soon"}
          </button>
        </div>
        <span className="helper-text">
          Set VITE_WORDPRESS_ENABLED=true to allow the integration to initialize.
          No calls are made while disabled.
        </span>
      </div>
      <div className="setting-row">
        <span className="label">Sync provider</span>
        <input
          type="text"
          className="text-input"
          value="Coming later."
          disabled
          aria-label="Sync provider"
        />
      </div>
      {userVault.error ? (
        <div className="setting-row">
          <span className="label">Status</span>
          <span className="helper-text">{userVault.error}</span>
        </div>
      ) : null}
    </>
  );
};

type LanguageTabContentProps = {
  language: AppLanguage;
  onLanguageChange: (value: AppLanguage) => void;
};

export const LanguageTabContent = ({
  language,
  onLanguageChange,
}: LanguageTabContentProps) => {
  const labels = LANGUAGE_LABELS[language];
  return (
    <>
      <p className="muted">{labels.placeholder}</p>
      <div className="setting-row">
        <span className="label">{labels.heading}</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${language === "de" ? "active" : ""}`}
            aria-pressed={language === "de"}
            onClick={() => onLanguageChange("de")}
          >
            {labels.deLabel}
          </button>
          <button
            type="button"
            className={`pill pill-button ${language === "en" ? "active" : ""}`}
            aria-pressed={language === "en"}
            onClick={() => onLanguageChange("en")}
          >
            {labels.enLabel}
          </button>
        </div>
        <span className="helper-text">{labels.placeholder}</span>
      </div>
    </>
  );
};
