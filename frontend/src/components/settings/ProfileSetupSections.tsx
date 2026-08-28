/**
 * @file frontend/src/components/settings/ProfileSetupSections.tsx
 *
 * Zweck:
 * - Wiederverwendbare Profile-Setup-Sektionen fuer Settings und Gate-Modals.
 */

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import type { UserVaultState } from "../../features/user-vault/useUserVault";
import { normalizeVaultPath, vaultBaseName } from "../../lib/path";
import {
  UserRegistryControls,
  type UserRegistryControlsProps,
} from "../UserToolsPanel";
import { SrDeleteModal } from "../../pages/spaced-repetition/components/SrDeleteModal";
import { type SettingsLanguage, tSettings } from "../../features/settings/settingsI18n";

export type ProfileSetupVaultSelection = {
  activeVaultPath: string | null;
  recentVaultPaths: string[];
  onSelectVault: (path: string) => Promise<boolean>;
  onPickVault: () => Promise<boolean>;
  isVaultBusy?: boolean;
};

type ActiveVaultSectionProps = {
  language: SettingsLanguage;
  userVault: UserVaultState;
  selection: ProfileSetupVaultSelection;
};

export const ActiveVaultSection = ({
  language,
  userVault,
  selection,
}: ActiveVaultSectionProps) => {
  const [isSwitching, setIsSwitching] = useState(false);
  const normalizedActiveVaultPath = normalizeVaultPath(selection.activeVaultPath ?? "");

  const vaultOptions = useMemo(() => {
    const seen = new Set<string>();
    const values: string[] = [];
    [selection.activeVaultPath, ...selection.recentVaultPaths].forEach((candidate) => {
      const trimmed = candidate?.trim() ?? "";
      if (!trimmed) {
        return;
      }
      const normalized = normalizeVaultPath(trimmed);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      values.push(trimmed);
    });
    return values;
  }, [selection.activeVaultPath, selection.recentVaultPaths]);

  const isSelectorBusy = Boolean(selection.isVaultBusy || userVault.isBusy || isSwitching);

  const handleSelectVault = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const nextPath = event.target.value;
      const normalizedNextPath = normalizeVaultPath(nextPath);
      if (!nextPath || normalizedNextPath === normalizedActiveVaultPath) {
        return;
      }
      setIsSwitching(true);
      try {
        const switched = await selection.onSelectVault(nextPath);
        if (switched) {
          await userVault.bootstrapProfileContext("vaultSelected", {
            vaultPath: nextPath,
          });
        }
      } finally {
        setIsSwitching(false);
      }
    },
    [normalizedActiveVaultPath, selection, userVault],
  );

  const handlePickVault = useCallback(async () => {
    setIsSwitching(true);
    try {
      const opened = await selection.onPickVault();
      if (opened) {
        await userVault.bootstrapProfileContext("vaultSelected");
      }
    } finally {
      setIsSwitching(false);
    }
  }, [selection, userVault]);

  return (
    <div className="setting-row">
      <span className="label">
        {tSettings(language, "settings.profile.activeVaultWallet")}
      </span>
      <div className="setting-inline">
        <select
          className="text-input"
          value={selection.activeVaultPath ?? ""}
          onChange={handleSelectVault}
          disabled={isSelectorBusy}
          aria-label="Active vault selection"
          data-autofocus="active-vault"
        >
          <option value="">
            {selection.activeVaultPath
              ? tSettings(language, "settings.profile.selectVault")
              : tSettings(language, "settings.profile.noActiveVault")}
          </option>
          {vaultOptions.map((path) => (
            <option key={path} value={path}>
              {vaultBaseName(path)} - {path}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ghost small"
          onClick={handlePickVault}
          disabled={isSelectorBusy}
        >
          {tSettings(language, "settings.profile.open")}
        </button>
      </div>
      <span className="helper-text">
        {tSettings(language, "settings.profile.activeVaultHelper")}
      </span>
    </div>
  );
};

type ProfileSourceSectionProps = {
  language: SettingsLanguage;
  userVault: UserVaultState;
  autoFocus?: boolean;
};

export const ProfileSourceSection = ({
  language,
  userVault,
  autoFocus = false,
}: ProfileSourceSectionProps) => (
  <div className="setting-row">
    <span className="label">{tSettings(language, "settings.profile.source")}</span>
    <div className="pill-grid">
      <button
        type="button"
        className={`pill pill-button ${userVault.mode === "auto" ? "active" : ""}`}
        aria-pressed={userVault.mode === "auto"}
        onClick={() => userVault.handleModeChange("auto")}
        {...(autoFocus ? { "data-autofocus": "profile-source" } : {})}
      >
        {tSettings(language, "settings.profile.source.auto")}
      </button>
      <button
        type="button"
        className={`pill pill-button ${userVault.mode === "custom" ? "active" : ""}`}
        aria-pressed={userVault.mode === "custom"}
        onClick={() => userVault.handleModeChange("custom")}
      >
        {tSettings(language, "settings.profile.source.custom")}
      </button>
      <button type="button" className="pill pill-button" disabled>
        {tSettings(language, "settings.profile.source.syncProvider")}
      </button>
    </div>
    <span className="helper-text">
      {tSettings(language, "settings.profile.source.helper")}
    </span>
  </div>
);

type ProfileRootSectionProps = {
  language: SettingsLanguage;
  userVault: UserVaultState;
  label?: string;
  helperText?: string;
  allowPickWhenAuto?: boolean;
};

export const ProfileRootSection = ({
  language,
  userVault,
  label,
  helperText,
  allowPickWhenAuto = false,
}: ProfileRootSectionProps) => {
  const isCustomMode = userVault.mode === "custom";
  const resolvedLabel = label ?? tSettings(language, "settings.profile.root");
  const canPick = allowPickWhenAuto ? !userVault.isBusy : isCustomMode && !userVault.isBusy;
  const rootPath = isCustomMode ? userVault.customRootPath : userVault.autoRootPath;
  const resolvedHelper =
    helperText ??
    (isCustomMode
      ? tSettings(language, "settings.profile.root.helper.custom")
      : tSettings(language, "settings.profile.root.helper.auto"));

  const handlePickPath = async () => {
    if (allowPickWhenAuto && userVault.mode !== "custom") {
      userVault.handleModeChange("custom");
    }
    await userVault.handlePickCustomPath();
  };

  return (
    <div className="setting-row">
      <span className="label">{resolvedLabel}</span>
      <div className="setting-inline">
        <span className="value path-value">{rootPath ?? "-"}</span>
        <button
          type="button"
          className="ghost small"
          onClick={handlePickPath}
          disabled={!canPick}
        >
          {tSettings(language, "settings.profile.root.change")}
        </button>
      </div>
      <span className="helper-text">{resolvedHelper}</span>
    </div>
  );
};

type UserListSectionProps = {
  language: SettingsLanguage;
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
  showActiveUser?: boolean;
};

export const UserListSection = ({
  language,
  userVault,
  spacedRepetition,
  showActiveUser = true,
}: UserListSectionProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const selectedUser = spacedRepetition.spacedRepetitionUsers.find(
    (user) => user.id === spacedRepetition.spacedRepetitionSelectedUserId,
  );
  const deleteTargetName = selectedUser?.name ?? "";
  const deleteInputValue = deleteConfirmInput.trim();
  const canConfirmDelete =
    Boolean(deleteTargetName) && deleteInputValue === deleteTargetName;
  const hasSelection = Boolean(spacedRepetition.spacedRepetitionSelectedUserId);
  const trimmedNewUserName = spacedRepetition.spacedRepetitionNewUserName.trim();
  const disableCreate = userVault.isBusy || !trimmedNewUserName;
  const disableLoad = userVault.isBusy || !hasSelection;
  const disableDelete = userVault.isBusy || !hasSelection;
  const disableSelect = userVault.isBusy;

  const handleDeleteOpen = () => {
    if (!hasSelection || userVault.isBusy) {
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
      <UserRegistryControls
        language={language}
        spacedRepetition={spacedRepetition}
        handleDeleteOpen={handleDeleteOpen}
        showActiveUser={showActiveUser}
        disableCreate={disableCreate}
        disableLoad={disableLoad}
        disableDelete={disableDelete}
        disableSelect={disableSelect}
      />
      <SrDeleteModal
        language={language}
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

type ProfileStatus = {
  message: string;
  tone: "info" | "error";
};

const resolveProfileStatus = (
  language: SettingsLanguage,
  userVault: UserVaultState,
  spacedRepetition?: UserRegistryControlsProps["spacedRepetition"],
): ProfileStatus | null => {
  if (userVault.status === "loading") {
    return { message: tSettings(language, "settings.profile.status.loading"), tone: "info" };
  }
  if (userVault.error) {
    return { message: userVault.error, tone: "error" };
  }
  if (userVault.mode === "auto" && !userVault.autoRootPath) {
    return { message: tSettings(language, "settings.profile.status.noActiveVault"), tone: "info" };
  }
  const hasRoot = userVault.status === "idle" && Boolean(userVault.resolvedPath);
  if (spacedRepetition && hasRoot) {
    if (!spacedRepetition.spacedRepetitionSelectedUserId) {
      return { message: tSettings(language, "settings.profile.status.noUserSelected"), tone: "info" };
    }
    if (!spacedRepetition.spacedRepetitionActiveUser) {
      return { message: tSettings(language, "settings.profile.status.noActiveUser"), tone: "info" };
    }
  }
  return null;
};

type ProfileStatusSectionProps = {
  language: SettingsLanguage;
  userVault: UserVaultState;
  spacedRepetition?: UserRegistryControlsProps["spacedRepetition"];
  label?: string;
};

export const ProfileStatusSection = ({
  language,
  userVault,
  spacedRepetition,
  label,
}: ProfileStatusSectionProps) => {
  const resolvedLabel = label ?? tSettings(language, "settings.profile.status");
  const status = resolveProfileStatus(language, userVault, spacedRepetition);

  if (!userVault.migrationWarning && !status) {
    return null;
  }

  return (
    <>
      {userVault.migrationWarning ? (
        <div className="setting-row">
          <span className="label">{tSettings(language, "settings.profile.warning")}</span>
          <span className="helper-text">{userVault.migrationWarning}</span>
        </div>
      ) : null}
      {status ? (
        <div className="setting-row">
          <span className="label">{resolvedLabel}</span>
          <span
            className={`helper-text ${status.tone === "error" ? "error-text" : ""}`}
          >
            {status.message}
          </span>
        </div>
      ) : null}
    </>
  );
};

type ProfileSetupViewProps = {
  language?: SettingsLanguage;
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
  vaultSelection: ProfileSetupVaultSelection;
  autoFocusSource?: boolean;
  showActiveUser?: boolean;
  showActiveVault?: boolean;
};

export const ProfileSetupView = ({
  language = "en",
  userVault,
  spacedRepetition,
  vaultSelection,
  autoFocusSource = false,
  showActiveUser = true,
  showActiveVault = true,
}: ProfileSetupViewProps) => {
  return (
    <>
      {showActiveVault ? (
        <ActiveVaultSection
          language={language}
          userVault={userVault}
          selection={vaultSelection}
        />
      ) : null}
      <ProfileSourceSection
        language={language}
        userVault={userVault}
        autoFocus={autoFocusSource}
      />
      <ProfileRootSection
        language={language}
        userVault={userVault}
        label={tSettings(language, "settings.profile.root")}
      />
      <UserListSection
        language={language}
        userVault={userVault}
        spacedRepetition={spacedRepetition}
        showActiveUser={showActiveUser}
      />
      <ProfileStatusSection
        language={language}
        userVault={userVault}
        spacedRepetition={spacedRepetition}
      />
    </>
  );
};
