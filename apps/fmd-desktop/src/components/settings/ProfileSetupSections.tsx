/**
 * @file apps/fmd-desktop/src/components/settings/ProfileSetupSections.tsx
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

export type ProfileSetupVaultSelection = {
  activeVaultPath: string | null;
  recentVaultPaths: string[];
  onSelectVault: (path: string) => Promise<boolean>;
  onPickVault: () => Promise<boolean>;
  isVaultBusy?: boolean;
};

type ActiveVaultSectionProps = {
  userVault: UserVaultState;
  selection: ProfileSetupVaultSelection;
};

export const ActiveVaultSection = ({
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
      <span className="label">ACTIVE VAULT / WALLET</span>
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
              ? "Select vault"
              : "No active vault selected"}
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
          Open...
        </button>
      </div>
      <span className="helper-text">
        Vault selection stays available even when no profile root or user exists.
      </span>
    </div>
  );
};

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
        <span className="value path-value">{rootPath ?? "-"}</span>
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
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
  showActiveUser?: boolean;
};

export const UserListSection = ({
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
  if (userVault.mode === "auto" && !userVault.autoRootPath) {
    return { message: "No active vault selected yet.", tone: "info" };
  }
  const hasRoot = userVault.status === "idle" && Boolean(userVault.resolvedPath);
  if (spacedRepetition && hasRoot) {
    if (!spacedRepetition.spacedRepetitionSelectedUserId) {
      return { message: "No user selected yet.", tone: "info" };
    }
    if (!spacedRepetition.spacedRepetitionActiveUser) {
      return { message: "No active user loaded yet.", tone: "info" };
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
  vaultSelection: ProfileSetupVaultSelection;
  autoFocusSource?: boolean;
  showActiveUser?: boolean;
};

export const ProfileSetupView = ({
  userVault,
  spacedRepetition,
  vaultSelection,
  autoFocusSource = false,
  showActiveUser = true,
}: ProfileSetupViewProps) => {
  return (
    <>
      <ActiveVaultSection userVault={userVault} selection={vaultSelection} />
      <ProfileSourceSection userVault={userVault} autoFocus={autoFocusSource} />
      <ProfileRootSection userVault={userVault} />
      <UserListSection
        userVault={userVault}
        spacedRepetition={spacedRepetition}
        showActiveUser={showActiveUser}
      />
      <ProfileStatusSection
        userVault={userVault}
        spacedRepetition={spacedRepetition}
      />
    </>
  );
};
