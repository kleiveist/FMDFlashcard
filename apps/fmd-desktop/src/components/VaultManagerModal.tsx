/**
 * @file apps/fmd-desktop/src/components/VaultManagerModal.tsx
 *
 * Zweck:
 * - Rendert das Vault Manager Modal.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { asErrorMessage } from "../lib/errors";
import { normalizeVaultPath, vaultBaseName } from "../lib/path";
import { resolveUserVaultPath } from "../lib/userVault";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import {
  createUserVaultProfile,
  listUserVaultProfiles,
  loadUserVaultMeta,
  setActiveProfileId,
  type UserVaultProfileSummary,
} from "../features/user-vault/storage";
import { useVaultPathInfo } from "../features/vault/useVaultPathInfo";
import type { RecentVaultEntry } from "../features/settings/useAppSettings";
import type { UserVaultState } from "../features/user-vault/useUserVault";

type ProfileState = {
  status: "idle" | "loading" | "error";
  error: string;
  profiles: UserVaultProfileSummary[];
  activeProfileId: string | null;
};

type VaultManagerModalProps = {
  isOpen: boolean;
  vaults: RecentVaultEntry[];
  activeVaultPath: string | null;
  userVault: UserVaultState;
  onClose: () => void;
  onOpenVault: () => Promise<boolean>;
  onSwitchVault: (path: string) => Promise<boolean>;
  onRemoveVault: (path: string) => void;
};

const emptyProfileState: ProfileState = {
  status: "idle",
  error: "",
  profiles: [],
  activeProfileId: null,
};

export const VaultManagerModal = ({
  isOpen,
  vaults,
  activeVaultPath,
  userVault,
  onClose,
  onOpenVault,
  onSwitchVault,
  onRemoveVault,
}: VaultManagerModalProps) => {
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>(emptyProfileState);
  const [actionError, setActionError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const vaultPaths = useMemo(() => vaults.map((entry) => entry.path), [vaults]);
  const pathInfo = useVaultPathInfo(vaultPaths, isOpen);
  const activeVaultKey = useMemo(
    () => normalizeVaultPath(activeVaultPath ?? ""),
    [activeVaultPath],
  );

  const resolvedUserVaultPath = useMemo(
    () => resolveUserVaultPath(userVault.mode, selectedVaultPath, userVault.customPath),
    [selectedVaultPath, userVault.customPath, userVault.mode],
  );

  const selectedPathInfo = selectedVaultPath
    ? pathInfo[selectedVaultPath] ?? null
    : null;
  const selectedVaultMissing =
    Boolean(selectedPathInfo) &&
    (!selectedPathInfo?.exists || !selectedPathInfo?.isDir);

  const reloadProfileState = useCallback(async () => {
    if (!resolvedUserVaultPath) {
      setProfileState(emptyProfileState);
      return;
    }
    setProfileState({
      status: "loading",
      error: "",
      profiles: [],
      activeProfileId: null,
    });
    try {
      const [profiles, meta] = await Promise.all([
        listUserVaultProfiles(resolvedUserVaultPath),
        loadUserVaultMeta(resolvedUserVaultPath),
      ]);
      const activeProfileId = profiles.some(
        (profile) => profile.id === meta.activeProfileId,
      )
        ? meta.activeProfileId
        : null;
      setProfileState({
        status: "idle",
        error: "",
        profiles,
        activeProfileId,
      });
    } catch (error) {
      setProfileState({
        status: "error",
        error: asErrorMessage(error, "Profile status could not be loaded."),
        profiles: [],
        activeProfileId: null,
      });
    }
  }, [resolvedUserVaultPath]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedVaultPath((current) => {
      if (activeVaultPath) {
        return activeVaultPath;
      }
      if (current && vaults.some((entry) => entry.path === current)) {
        return current;
      }
      return vaults[0]?.path ?? null;
    });
  }, [activeVaultPath, isOpen, vaults]);

  useEffect(() => {
    if (!isOpen) {
      setActionError("");
      setProfileState(emptyProfileState);
      return;
    }
    setActionError("");
    void reloadProfileState();
  }, [isOpen, reloadProfileState, selectedVaultPath]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    return registerCloseLayer({
      id: "vault-manager-modal",
      priority: 300,
      isActive: () => isOpen,
      onClose,
    });
  }, [isOpen, onClose]);

  const ensureVaultActive = useCallback(async () => {
    if (!selectedVaultPath) {
      return false;
    }
    const selectedKey = normalizeVaultPath(selectedVaultPath);
    if (!selectedKey || selectedKey === activeVaultKey) {
      return true;
    }
    const switched = await onSwitchVault(selectedVaultPath);
    if (!switched) {
      setActionError("Vault could not be opened.");
    }
    return switched;
  }, [activeVaultKey, onSwitchVault, selectedVaultPath]);

  const handleOpenVault = useCallback(async () => {
    setActionError("");
    setIsBusy(true);
    try {
      await onOpenVault();
    } catch (error) {
      setActionError(asErrorMessage(error, "Vault could not be opened."));
    } finally {
      setIsBusy(false);
    }
  }, [onOpenVault]);

  const handleLoadProfile = useCallback(async () => {
    if (!resolvedUserVaultPath) {
      return;
    }
    if (profileState.profiles.length === 0) {
      return;
    }
    setActionError("");
    setIsBusy(true);
    try {
      if (!(await ensureVaultActive())) {
        return;
      }
      const targetProfileId =
        profileState.activeProfileId ?? profileState.profiles[0]?.id ?? null;
      if (!targetProfileId) {
        return;
      }
      await setActiveProfileId(resolvedUserVaultPath, targetProfileId);
      await reloadProfileState();
      if (userVault.resolvedPath === resolvedUserVaultPath) {
        await userVault.refreshProfiles();
      }
    } catch (error) {
      setActionError(asErrorMessage(error, "Profile could not be loaded."));
    } finally {
      setIsBusy(false);
    }
  }, [
    ensureVaultActive,
    profileState.activeProfileId,
    profileState.profiles,
    reloadProfileState,
    resolvedUserVaultPath,
    userVault,
  ]);

  const handleCreateProfile = useCallback(async () => {
    if (!resolvedUserVaultPath || !selectedVaultPath) {
      return;
    }
    setActionError("");
    setIsBusy(true);
    try {
      if (!(await ensureVaultActive())) {
        return;
      }
      const profileName = vaultBaseName(selectedVaultPath);
      const profile = await createUserVaultProfile(resolvedUserVaultPath, profileName);
      await setActiveProfileId(resolvedUserVaultPath, profile.id);
      await reloadProfileState();
      if (userVault.resolvedPath === resolvedUserVaultPath) {
        await userVault.refreshProfiles();
      }
    } catch (error) {
      setActionError(asErrorMessage(error, "Profile could not be created."));
    } finally {
      setIsBusy(false);
    }
  }, [
    ensureVaultActive,
    reloadProfileState,
    resolvedUserVaultPath,
    selectedVaultPath,
    userVault,
  ]);

  if (!isOpen) {
    return null;
  }

  const portalTarget = typeof document === "undefined" ? null : document.body;
  const selectedEntry = selectedVaultPath
    ? vaults.find((entry) => entry.path === selectedVaultPath) ?? null
    : null;
  const profileCount = profileState.profiles.length;
  const isProfileLoading = profileState.status === "loading";
  const isProfileReady = profileState.status === "idle";
  const canManageProfiles = Boolean(resolvedUserVaultPath) && !selectedVaultMissing;
  const canLoadProfile = canManageProfiles && isProfileReady && profileCount > 0;
  const canCreateProfile = canManageProfiles && isProfileReady && profileCount === 0;

  const modal = (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel vault-manager-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-manager-title"
      >
        <div className="vault-manager-header">
          <h3 id="vault-manager-title">Vault verwalten</h3>
          <button type="button" className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="vault-manager-content">
          <aside className="vault-manager-list" aria-label="Vault list">
            {vaults.length === 0 ? (
              <div className="empty-state">No vaults found.</div>
            ) : (
              vaults.map((entry) => {
                const entryKey = normalizeVaultPath(entry.path);
                const isActive = entryKey === activeVaultKey;
                const isSelected = entry.path === selectedVaultPath;
                const info = pathInfo[entry.path];
                const isMissing = info ? !info.exists || !info.isDir : false;
                return (
                  <button
                    key={entry.path}
                    type="button"
                    className={`vault-manager-item${
                      isSelected ? " active" : ""
                    }`}
                    onClick={() => {
                      setSelectedVaultPath(entry.path);
                      setActionError("");
                    }}
                    aria-pressed={isSelected}
                    title={entry.path}
                  >
                    <span className="vault-manager-item-main">
                      <span className="vault-manager-item-name">
                        {vaultBaseName(entry.path)}
                      </span>
                      <span className="vault-manager-item-path">{entry.path}</span>
                    </span>
                    <span className="vault-manager-item-meta">
                      {isActive ? <span className="chip">Active</span> : null}
                      {isMissing ? <span className="chip">Missing</span> : null}
                    </span>
                  </button>
                );
              })
            )}
          </aside>
          <section className="vault-manager-details" aria-live="polite">
            <div className="vault-manager-details-header">
              <span className="label">Actions</span>
              <div className="vault-manager-actions">
                <button
                  type="button"
                  className="primary small"
                  onClick={handleOpenVault}
                  disabled={isBusy}
                >
                  Open Vault
                </button>
              </div>
            </div>
            {actionError ? (
              <div className="error" role="status">
                {actionError}
              </div>
            ) : null}
            {selectedEntry ? (
              <>
                <div className="vault-manager-section">
                  <span className="label">Path</span>
                  <span className="vault-manager-path">{selectedEntry.path}</span>
                </div>
                {selectedVaultMissing ? (
                  <div className="vault-manager-warning">
                    Vault folder is missing. Remove it from the list if it is no
                    longer available.
                  </div>
                ) : null}
                <div className="vault-manager-section">
                  <span className="value">Found profiles: {profileCount}</span>
                  <div className="vault-manager-profile-actions">
                    {profileState.status === "loading" ? (
                      <span className="muted">Loading profiles...</span>
                    ) : null}
                    {canLoadProfile ? (
                      <button
                        type="button"
                        className="ghost small"
                        onClick={handleLoadProfile}
                        disabled={isBusy}
                      >
                        LOAD PROFILE
                      </button>
                    ) : null}
                    {canCreateProfile ? (
                      <button
                        type="button"
                        className="ghost small"
                        onClick={handleCreateProfile}
                        disabled={isBusy}
                      >
                        CREATE PROFILE
                      </button>
                    ) : null}
                  </div>
                  {profileState.error ? (
                    <div className="error" role="status">
                      {profileState.error}
                    </div>
                  ) : null}
                  {canCreateProfile ? (
                    <div className="vault-manager-warning">
                      Warning: Without a profile, statistics cannot be saved.
                    </div>
                  ) : null}
                </div>
                {selectedVaultMissing ? (
                  <div className="vault-manager-section">
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => onRemoveVault(selectedEntry.path)}
                      disabled={isBusy}
                    >
                      Remove from recents
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">Select a vault to see details.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : modal;
};
