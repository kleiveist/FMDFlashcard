/**
 * @file apps/fmd-desktop/src/components/settings/ProfileSetupSections.tsx
 *
 * Zweck:
 * - Wiederverwendbare Profile-Setup-Sektionen fuer Settings und Gate-Modals.
 */

import { useState } from "react";
import type { UserVaultState } from "../../features/user-vault/useUserVault";
import {
  UserRegistryControls,
  type UserRegistryControlsProps,
} from "../UserToolsPanel";
import { SrDeleteModal } from "../../pages/spaced-repetition/components/SrDeleteModal";

type ProfileSourceSectionProps = {
  userVault: UserVaultState;
  autoFocus?: boolean;
};

export const ProfileSourceSection = ({
  userVault,
  autoFocus = false,
}: ProfileSourceSectionProps) => (
  <div className="setting-row">
    <span className="label">Profile Source</span>
    <div className="pill-grid">
      <button
        type="button"
        className={`pill pill-button ${userVault.mode === "auto" ? "active" : ""}`}
        aria-pressed={userVault.mode === "auto"}
        onClick={() => userVault.handleModeChange("auto")}
        {...(autoFocus ? { "data-autofocus": "profile-source" } : {})}
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

type ProfileRootSectionProps = {
  userVault: UserVaultState;
  label?: string;
  helperText?: string;
  allowPickWhenAuto?: boolean;
};

export const ProfileRootSection = ({
  userVault,
  label = "Profile root",
  helperText,
  allowPickWhenAuto = false,
}: ProfileRootSectionProps) => {
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

type UserListSectionProps = {
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
  canManageUsers: boolean;
  showActiveUser?: boolean;
};

export const UserListSection = ({
  spacedRepetition,
  canManageUsers,
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
  const disableCreate = !canManageUsers || !trimmedNewUserName;
  const disableLoad = !canManageUsers || !hasSelection;
  const disableDelete = !canManageUsers || !hasSelection;
  const disableSelect = !canManageUsers;

  const handleDeleteOpen = () => {
    if (!hasSelection || !canManageUsers) {
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
        spacedRepetition={spacedRepetition}
        handleDeleteOpen={handleDeleteOpen}
        showActiveUser={showActiveUser}
        disableCreate={disableCreate}
        disableLoad={disableLoad}
        disableDelete={disableDelete}
        disableSelect={disableSelect}
      />
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

type ProfileStatus = {
  message: string;
  tone: "info" | "error";
};

const resolveProfileStatus = (
  userVault: UserVaultState,
  spacedRepetition?: UserRegistryControlsProps["spacedRepetition"],
): ProfileStatus | null => {
  if (userVault.status === "loading") {
    return { message: "Loading profile root...", tone: "info" };
  }
  if (userVault.error) {
    return { message: userVault.error, tone: "error" };
  }
  const hasRoot = userVault.status === "idle" && Boolean(userVault.resolvedPath);
  if (spacedRepetition && hasRoot) {
    if (!spacedRepetition.spacedRepetitionSelectedUserId) {
      return { message: "No user selected.", tone: "error" };
    }
    if (!spacedRepetition.spacedRepetitionActiveUserId) {
      return { message: "No active user loaded.", tone: "error" };
    }
  }
  return null;
};

type ProfileStatusSectionProps = {
  userVault: UserVaultState;
  spacedRepetition?: UserRegistryControlsProps["spacedRepetition"];
  label?: string;
};

export const ProfileStatusSection = ({
  userVault,
  spacedRepetition,
  label = "Status",
}: ProfileStatusSectionProps) => {
  const status = resolveProfileStatus(userVault, spacedRepetition);

  if (!userVault.migrationWarning && !status) {
    return null;
  }

  return (
    <>
      {userVault.migrationWarning ? (
        <div className="setting-row">
          <span className="label">Warning</span>
          <span className="helper-text">{userVault.migrationWarning}</span>
        </div>
      ) : null}
      {status ? (
        <div className="setting-row">
          <span className="label">{label}</span>
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
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
  autoFocusSource?: boolean;
  showActiveUser?: boolean;
};

export const ProfileSetupView = ({
  userVault,
  spacedRepetition,
  autoFocusSource = false,
  showActiveUser = true,
}: ProfileSetupViewProps) => {
  const canManageUsers =
    userVault.status === "idle" && Boolean(userVault.resolvedPath) && !userVault.isBusy;

  return (
    <>
      <ProfileSourceSection userVault={userVault} autoFocus={autoFocusSource} />
      <ProfileRootSection userVault={userVault} />
      <UserListSection
        spacedRepetition={spacedRepetition}
        canManageUsers={canManageUsers}
        showActiveUser={showActiveUser}
      />
      <ProfileStatusSection
        userVault={userVault}
        spacedRepetition={spacedRepetition}
      />
    </>
  );
};
