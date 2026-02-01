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

import { useState } from "react";
import type { UserVaultImportStrategy } from "../../lib/userVault";
import type { UserVaultState } from "../../features/user-vault/useUserVault";
import { isSyncProviderEnabled, isWordPressEnabled } from "../../lib/featureFlags";
import {
  UserRegistryControls,
  type UserRegistryControlsProps,
} from "../UserToolsPanel";
import { SrDeleteModal } from "../../pages/spaced-repetition/components/SrDeleteModal";

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
  mode?: DataSyncSettingsViewMode;
};


type UserVaultModeSectionProps = {
  userVault: UserVaultState;
};

const UserVaultModeSection = ({ userVault }: UserVaultModeSectionProps) => (
  <div className="setting-row">
    <span className="label">Profile Source</span>
    <div className="pill-grid">
      <button
        type="button"
        className={`pill pill-button ${userVault.mode === "auto" ? "active" : ""}`}
        aria-pressed={userVault.mode === "auto"}
        onClick={() => userVault.handleModeChange("auto")}
      >
        Auto (Vault/profile)
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
      Auto uses the current vault profile root. Custom stays fixed across vault switches.
    </span>
  </div>
);

type ActivePathSectionProps = {
  userVault: UserVaultState;
  label?: string;
  helperText?: string;
  allowPickWhenAuto?: boolean;
};

export const ActivePathSection = ({
  userVault,
  label = "Profile root",
  helperText,
  allowPickWhenAuto = false,
}: ActivePathSectionProps) => {
  const isCustomMode = userVault.mode === "custom";
  const canPick = allowPickWhenAuto ? !userVault.isBusy : isCustomMode && !userVault.isBusy;
  const rootPath = isCustomMode ? userVault.customRootPath : userVault.autoRootPath;
  const resolvedHelper =
    helperText ??
    (isCustomMode
      ? "Pick a profile root folder that contains users."
      : "Select a vault to enable Auto profile root.");

  const handlePickPath = async () => {
    if (allowPickWhenAuto && userVault.mode !== "custom") {
      userVault.handleModeChange("custom");
    }
    await userVault.handlePickCustomPath();
  };

  return (
    <div className="setting-row">
      <span className="label">{label}</span>
      <div className="setting-inline">
        <span className="value path-value">{rootPath ?? "—"}</span>
        <button
          type="button"
          className="ghost small"
          onClick={handlePickPath}
          disabled={!canPick}
        >
          Change
        </button>
      </div>
      <span className="helper-text">{resolvedHelper}</span>
    </div>
  );
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
  mode = "settings",
}: DataSyncSettingsViewProps) => {
  const isOnboarding = mode === "onboarding";
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const selectedUser = spacedRepetition.spacedRepetitionUsers.find(
    (user) => user.id === spacedRepetition.spacedRepetitionSelectedUserId,
  );
  const deleteTargetName = selectedUser?.name ?? "";
  const deleteInputValue = deleteConfirmInput.trim();
  const canConfirmDelete =
    Boolean(deleteTargetName) && deleteInputValue === deleteTargetName;

  const handleDeleteOpen = () => {
    if (!selectedUser) {
      return;
    }
    setDeleteConfirmInput("");
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  };

  const handleDeleteConfirm = () => {
    if (!canConfirmDelete) {
      return;
    }
    spacedRepetition.handleSpacedRepetitionDeleteUser();
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  };

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
        <UserVaultModeSection userVault={userVault} />
      ) : null}
      {!isOnboarding ? (
        <ActivePathSection userVault={userVault} />
      ) : null}
      {!isOnboarding ? (
        <UserRegistryControls
          spacedRepetition={spacedRepetition}
          handleDeleteOpen={handleDeleteOpen}
        />
      ) : null}
      {userVault.migrationWarning ? (
        <div className="setting-row">
          <span className="label">Warning</span>
          <span className="helper-text">{userVault.migrationWarning}</span>
        </div>
      ) : null}
      {userVault.error ? (
        <div className="setting-row">
          <span className="label">Status</span>
          <span className="helper-text error-text">{userVault.error}</span>
        </div>
      ) : null}
      <SrDeleteModal
        isDeleteDialogOpen={isDeleteDialogOpen}
        deleteTargetName={deleteTargetName}
        deleteConfirmInput={deleteConfirmInput}
        setDeleteConfirmInput={setDeleteConfirmInput}
        handleDeleteCancel={handleDeleteCancel}
        handleDeleteConfirm={handleDeleteConfirm}
        canConfirmDelete={canConfirmDelete}
      />
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
