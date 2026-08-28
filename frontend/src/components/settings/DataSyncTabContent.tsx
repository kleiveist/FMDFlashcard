/**
 * @file apps/fmd-desktop/src/components/settings/DataSyncTabContent.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponenten fuer Profile Source und Export/Import.
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
  type SettingsLanguage,
  tSettings,
} from "../../features/settings/settingsI18n";
import {
  ProfileSetupView,
  type ProfileSetupVaultSelection,
} from "./ProfileSetupSections";

type AppLanguage = SettingsLanguage;

type DataSyncSettingsViewMode = "settings" | "onboarding";

type DataSyncSettingsViewProps = {
  language?: SettingsLanguage;
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
  vaultSelection: ProfileSetupVaultSelection;
  mode?: DataSyncSettingsViewMode;
};

type SyncProviderSectionProps = {
  language?: SettingsLanguage;
  label?: string;
};

export const SyncProviderSection = ({
  language = "en",
  label,
}: SyncProviderSectionProps) => {
  const syncProviderEnabled = isSyncProviderEnabled();
  return (
    <div className="setting-row">
      <span className="label">
        {label ?? tSettings(language, "settings.dataSync.syncProvider")}
      </span>
      <div className="setting-inline">
        <span className="value">
          {syncProviderEnabled
            ? tSettings(language, "settings.dataSync.enabledViaFlag")
            : tSettings(language, "settings.dataSync.disabledFlag")}
        </span>
        <button type="button" className="ghost small" disabled>
          {syncProviderEnabled
            ? tSettings(language, "settings.dataSync.active")
            : tSettings(language, "settings.dataSync.comingSoon")}
        </button>
      </div>
      <span className="helper-text">
        {tSettings(language, "settings.dataSync.syncProviderHelper")}
      </span>
    </div>
  );
};

export const DataSyncSettingsView = ({
  language = "en",
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
              <span className="eyebrow">
                {tSettings(language, "settings.dataSync.onboarding.eyebrow")}
              </span>
              <h3>{tSettings(language, "settings.dataSync.onboarding.title")}</h3>
              <p className="muted">
                {tSettings(language, "settings.dataSync.onboarding.description")}
              </p>
            </div>
          </div>
        </section>
      ) : null}
      {!isOnboarding ? (
        <ProfileSetupView
          language={language}
          userVault={userVault}
          spacedRepetition={spacedRepetition}
          vaultSelection={vaultSelection}
          showActiveVault={false}
        />
      ) : null}
    </>
  );
};

type ExportImportSettingsViewProps = {
  language?: SettingsLanguage;
  userVault: UserVaultState;
};

export const ExportImportSettingsView = ({
  language = "en",
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
        <span className="label">
          {tSettings(language, "settings.dataSync.exportImportJson")}
        </span>
        <div className="setting-actions">
          <button
            type="button"
            className="ghost small"
            onClick={handleExportActive}
            disabled={!canExportActive || userVault.isBusy}
          >
            {tSettings(language, "settings.dataSync.exportUser")}
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={handleExportAll}
            disabled={!canExportAll || userVault.isBusy}
          >
            {tSettings(language, "settings.dataSync.exportAllUsers")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">{tSettings(language, "settings.dataSync.importJson")}</span>
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
            <option value="merge">
              {tSettings(language, "settings.dataSync.importStrategy.merge")}
            </option>
            <option value="overwrite">
              {tSettings(language, "settings.dataSync.importStrategy.overwrite")}
            </option>
          </select>
          <button
            type="button"
            className="ghost small"
            onClick={handleImport}
            disabled={!canImport || userVault.isBusy}
          >
            {tSettings(language, "settings.dataSync.importButton")}
          </button>
        </div>
        <span className="helper-text">
          {tSettings(language, "settings.dataSync.importHelper")}
        </span>
      </div>
      <div className="setting-row">
        <span className="label">{tSettings(language, "settings.dataSync.wordpress")}</span>
        <div className="setting-inline">
          <span className="value">
            {wordpressEnabled
              ? tSettings(language, "settings.dataSync.enabledViaWordpressFlag")
              : tSettings(language, "settings.dataSync.disabledFlag")}
          </span>
          <button type="button" className="ghost small" disabled>
            {wordpressEnabled
              ? tSettings(language, "settings.dataSync.active")
              : tSettings(language, "settings.dataSync.comingSoon")}
          </button>
        </div>
        <span className="helper-text">
          {tSettings(language, "settings.dataSync.wordpressHelper")}
        </span>
      </div>
      <SyncProviderSection language={language} />
      {userVault.error ? (
        <div className="setting-row">
          <span className="label">{tSettings(language, "settings.dataSync.status")}</span>
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
  return (
    <>
      <p className="muted">{tSettings(language, "settings.language.placeholder")}</p>
      <div className="setting-row">
        <span className="label">{tSettings(language, "settings.language.label")}</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${language === "de" ? "active" : ""}`}
            aria-pressed={language === "de"}
            onClick={() => onLanguageChange("de")}
          >
            {tSettings(language, "settings.language.buttonGerman")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${language === "en" ? "active" : ""}`}
            aria-pressed={language === "en"}
            onClick={() => onLanguageChange("en")}
          >
            {tSettings(language, "settings.language.buttonEnglish")}
          </button>
        </div>
        <span className="helper-text">
          {tSettings(language, "settings.language.placeholder")}
        </span>
      </div>
    </>
  );
};
