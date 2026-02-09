/**
 * @file apps/fmd-desktop/src/components/settings/DataSyncTabContent.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponenten fuer Data & Sync und Export/Import.
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
 * - DataSyncSettingsView: React-Komponente.
 * - ExportImportSettingsView: React-Komponente.
 * - LanguageTabContent: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useEffect, useRef, useState } from "react";
import type { UserVaultImportStrategy } from "../../lib/userVault";
import type { UserVaultState } from "../../features/user-vault/useUserVault";
import { isSyncProviderEnabled, isWordPressEnabled } from "../../lib/featureFlags";
import type { UserRegistryControlsProps } from "../UserToolsPanel";
import {
  ProfileSetupView,
  type ProfileSetupVaultSelection,
} from "./ProfileSetupSections";

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

type DataSyncSettingsViewMode = "settings" | "onboarding";

type DataSyncSettingsViewProps = {
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
  vaultSelection: ProfileSetupVaultSelection;
  mode?: DataSyncSettingsViewMode;
};

type SyncProviderSectionProps = {
  label?: string;
};

export const SyncProviderSection = ({ label = "SYNC PROVIDER" }: SyncProviderSectionProps) => {
  const syncProviderEnabled = isSyncProviderEnabled();
  return (
    <div className="setting-row">
      <span className="label">{label}</span>
      <div className="setting-inline">
        <span className="value">
          {syncProviderEnabled
            ? "Enabled via VITE_SYNC_PROVIDER_ENABLED"
            : "Disabled (flag off)"}
        </span>
        <button type="button" className="ghost small" disabled>
          {syncProviderEnabled ? "Active" : "Coming soon"}
        </button>
      </div>
      <span className="helper-text">
        Set VITE_SYNC_PROVIDER_ENABLED=true to allow the integration to initialize.
        No calls are made while disabled.
      </span>
    </div>
  );
};

export const DataSyncSettingsView = ({
  userVault,
  spacedRepetition,
  vaultSelection,
  mode = "settings",
}: DataSyncSettingsViewProps) => {
  const isOnboarding = mode === "onboarding";
  const didBootstrapRef = useRef(false);

  useEffect(() => {
    if (isOnboarding) {
      didBootstrapRef.current = false;
      return;
    }
    if (didBootstrapRef.current) {
      return;
    }
    didBootstrapRef.current = true;
    void userVault.bootstrapProfileContext("profileSetupOpened:settings");
  }, [isOnboarding, userVault.bootstrapProfileContext]);

  return (
    <>
      {isOnboarding ? (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-header-content">
              <span className="eyebrow">User required</span>
              <h3>Set up your user</h3>
              <p className="muted">
                Create or load a user to save progress for this vault. You can edit
                these settings later in Settings &gt; Data &amp; Sync.
              </p>
            </div>
          </div>
        </section>
      ) : null}
      {!isOnboarding ? (
        <ProfileSetupView
          userVault={userVault}
          spacedRepetition={spacedRepetition}
          vaultSelection={vaultSelection}
        />
      ) : null}
    </>
  );
};

type ExportImportSettingsViewProps = {
  userVault: UserVaultState;
};

export const ExportImportSettingsView = ({
  userVault,
}: ExportImportSettingsViewProps) => {
  const [importStrategy, setImportStrategy] =
    useState<UserVaultImportStrategy>("merge");
  const wordpressEnabled = isWordPressEnabled();
  const canManageVault = Boolean(userVault.resolvedPath);
  const hasProfiles = userVault.profiles.length > 0;
  const canExportActive = canManageVault && Boolean(userVault.activeProfileId);
  const canExportAll = canManageVault && hasProfiles;
  const canImport = canExportActive;

  const handleExportActive = async () => {
    if (!canExportActive) {
      // TODO: enable exports once a profile exists.
      console.info("[settings] Export profile requested without an active profile.");
      return;
    }
    await userVault.handleExport("active");
  };

  const handleExportAll = async () => {
    if (!canExportAll) {
      // TODO: enable exports once profiles exist.
      console.info("[settings] Export all profiles requested without profiles.");
      return;
    }
    await userVault.handleExport("all");
  };

  const handleImport = async () => {
    if (!canImport) {
      // TODO: enable imports once a profile exists.
      console.info("[settings] Import requested without an active profile.");
      return;
    }
    await userVault.handleImport(importStrategy);
  };

  return (
    <>
      <div className="setting-row">
        <span className="label">EXPORT / IMPORT (JSON)</span>
        <div className="setting-actions">
          <button
            type="button"
            className="ghost small"
            onClick={handleExportActive}
            disabled={!canExportActive || userVault.isBusy}
          >
            Export user
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={handleExportAll}
            disabled={!canExportAll || userVault.isBusy}
          >
            Export all users
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">Import JSON</span>
        <div className="setting-inline">
          <select
            className="text-input"
            value={importStrategy}
            onChange={(event) =>
              setImportStrategy(event.target.value as UserVaultImportStrategy)
            }
            disabled={!canImport || userVault.isBusy}
            aria-label="Import strategy"
          >
            <option value="merge">Merge</option>
            <option value="overwrite">Overwrite</option>
          </select>
          <button
            type="button"
            className="ghost small"
            onClick={handleImport}
            disabled={!canImport || userVault.isBusy}
          >
            Import JSON
          </button>
        </div>
      <span className="helper-text">
          Merge keeps existing entries and adds new ones. Overwrite replaces data.
      </span>
      </div>
      <div className="setting-row">
        <span className="label">WORDPRESS</span>
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
      <SyncProviderSection />
      {userVault.error ? (
        <div className="setting-row">
          <span className="label">Status</span>
          <span className="helper-text error-text">{userVault.error}</span>
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
