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

import { useEffect, useState } from "react";
import type { UserVaultImportStrategy } from "../../lib/userVault";
import type { UserVaultState } from "../../features/user-vault/useUserVault";
import { isSyncProviderEnabled, isWordPressEnabled } from "../../lib/featureFlags";

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
  mode?: DataSyncSettingsViewMode;
};

type ProfileFormState = {
  newProfileName: string;
  setNewProfileName: (value: string) => void;
  selectedProfileId: string;
  setSelectedProfileId: (value: string) => void;
  handleCreateProfile: () => Promise<void>;
  handleLoadProfile: () => Promise<void>;
};

const useProfileForm = (userVault: UserVaultState): ProfileFormState => {
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");

  useEffect(() => {
    if (userVault.activeProfileId) {
      setSelectedProfileId(userVault.activeProfileId);
      return;
    }
    setSelectedProfileId("");
  }, [userVault.activeProfileId]);

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

  return {
    handleCreateProfile,
    handleLoadProfile,
    newProfileName,
    selectedProfileId,
    setNewProfileName,
    setSelectedProfileId,
  };
};

type UserVaultModeSectionProps = {
  userVault: UserVaultState;
};

const UserVaultModeSection = ({ userVault }: UserVaultModeSectionProps) => (
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
);

type ActivePathSectionProps = {
  userVault: UserVaultState;
  label?: string;
  helperText?: string;
  allowPickWhenAuto?: boolean;
};

export const ActivePathSection = ({
  userVault,
  label = "Active path",
  helperText,
  allowPickWhenAuto = false,
}: ActivePathSectionProps) => {
  const isCustomMode = userVault.mode === "custom";
  const canPick = allowPickWhenAuto ? !userVault.isBusy : isCustomMode && !userVault.isBusy;
  const resolvedHelper =
    helperText ??
    (isCustomMode
      ? "Pick a folder outside the vault if you prefer."
      : "Set a vault to enable Auto mode.");

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
        <span className="value path-value">{userVault.resolvedPath ?? "—"}</span>
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

type ProfilesSummarySectionProps = {
  userVault: UserVaultState;
  label?: string;
};

export const ProfilesSummarySection = ({
  userVault,
  label = "Profiles",
}: ProfilesSummarySectionProps) => (
  <div className="setting-row">
    <span className="label">{label}</span>
    <div className="status-list">
      <div className="status-row">
        <span className="value">Found profiles: {userVault.profiles.length}</span>
        <span className="value">
          Active profile: {userVault.activeProfile?.name ?? "—"}
        </span>
      </div>
    </div>
  </div>
);

type CreateProfileSectionProps = {
  userVault: UserVaultState;
  form: ProfileFormState;
  label?: string;
};

export const CreateProfileSection = ({
  userVault,
  form,
  label = "Create profile",
}: CreateProfileSectionProps) => {
  const canManageVault = Boolean(userVault.resolvedPath);
  return (
    <div className="setting-row">
      <span className="label">{label}</span>
      <div className="setting-inline">
        <input
          type="text"
          className="text-input"
          value={form.newProfileName}
          onChange={(event) => form.setNewProfileName(event.target.value)}
          placeholder="Profile name"
          aria-label="Profile name"
          disabled={!canManageVault || userVault.isBusy}
        />
        <button
          type="button"
          className="ghost small"
          onClick={form.handleCreateProfile}
          disabled={
            !canManageVault || userVault.isBusy || !form.newProfileName.trim()
          }
        >
          Create
        </button>
      </div>
      <span className="helper-text">Date is added automatically.</span>
    </div>
  );
};

type LoadProfileSectionProps = {
  userVault: UserVaultState;
  form: ProfileFormState;
  label?: string;
};

export const LoadProfileSection = ({
  userVault,
  form,
  label = "Load profile",
}: LoadProfileSectionProps) => {
  const canManageVault = Boolean(userVault.resolvedPath);
  const canManageProfiles = canManageVault && userVault.profiles.length > 0;
  return (
    <div className="setting-row">
      <span className="label">{label}</span>
      <div className="setting-inline">
        <select
          className="text-input"
          value={form.selectedProfileId}
          onChange={(event) => form.setSelectedProfileId(event.target.value)}
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
          onClick={form.handleLoadProfile}
          disabled={
            !canManageProfiles ||
            userVault.isBusy ||
            !form.selectedProfileId ||
            form.selectedProfileId === userVault.activeProfileId
          }
        >
          Load
        </button>
      </div>
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

type ProfileSectionsProps = {
  userVault: UserVaultState;
  showLoad?: boolean;
  labels?: {
    profiles?: string;
    create?: string;
    load?: string;
  };
};

export const ProfileSections = ({
  userVault,
  showLoad = true,
  labels,
}: ProfileSectionsProps) => {
  const form = useProfileForm(userVault);
  return (
    <>
      <ProfilesSummarySection userVault={userVault} label={labels?.profiles} />
      <CreateProfileSection userVault={userVault} form={form} label={labels?.create} />
      {showLoad ? (
        <LoadProfileSection userVault={userVault} form={form} label={labels?.load} />
      ) : null}
    </>
  );
};

export const DataSyncSettingsView = ({
  userVault,
  mode = "settings",
}: DataSyncSettingsViewProps) => {
  const isOnboarding = mode === "onboarding";

  return (
    <>
      {isOnboarding ? (
        <section className="panel">
          <div className="panel-header">
            <div className="panel-header-content">
              <span className="eyebrow">Profile required</span>
              <h3>Set up your profile</h3>
              <p className="muted">
                Create or load a profile to save progress for this vault. You can
                edit these settings later in Settings &gt; Data &amp; Sync.
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
      <ProfileSections userVault={userVault} />
      {userVault.error ? (
        <div className="setting-row">
          <span className="label">Status</span>
          <span className="helper-text error-text">{userVault.error}</span>
        </div>
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
            Export profile
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={handleExportAll}
            disabled={!canExportAll || userVault.isBusy}
          >
            Export all profiles
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
