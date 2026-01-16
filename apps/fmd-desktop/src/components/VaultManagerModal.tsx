/**
 * @file apps/fmd-desktop/src/components/VaultManagerModal.tsx
 *
 * Zweck:
 * - Rendert das Vault Manager Modal.
 */

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
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

type ContextMenuState = {
  x: number;
  y: number;
  path: string;
};

type VaultManagerModalProps = {
  isOpen: boolean;
  vaults: RecentVaultEntry[];
  activeVaultPath: string | null;
  userVault: UserVaultState;
  activeVaultError: string;
  onClose: () => void;
  onOpenVault: () => Promise<boolean>;
  onRescanVault: (source?: string) => Promise<boolean>;
  onSwitchVault: (path: string) => Promise<boolean>;
  onRemoveVault: (path: string) => void;
  onClearVault: () => void;
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
  activeVaultError,
  onClose,
  onOpenVault,
  onRescanVault,
  onSwitchVault,
  onRemoveVault,
  onClearVault,
}: VaultManagerModalProps) => {
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>(emptyProfileState);
  const [actionError, setActionError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingRemovePath, setPendingRemovePath] = useState<string | null>(null);

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
      setContextMenu(null);
      setPendingRemovePath(null);
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete") {
        return;
      }
      if (pendingRemovePath) {
        return;
      }
      const activeEntry = vaults.find(
        (entry) => normalizeVaultPath(entry.path) === activeVaultKey,
      );
      if (!activeEntry) {
        return;
      }
      event.preventDefault();
      setPendingRemovePath(activeEntry.path);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeVaultKey, isOpen, pendingRemovePath, vaults]);

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

  const handleRefreshActiveVault = useCallback(
    async (source: string) => {
      if (!activeVaultKey) {
        return;
      }
      setActionError("");
      setIsBusy(true);
      try {
        const success = await onRescanVault(source);
        if (!success) {
          setActionError(
            activeVaultError || "Vault refresh failed. Please try again.",
          );
        }
      } finally {
        setIsBusy(false);
      }
    },
    [activeVaultError, activeVaultKey, onRescanVault],
  );

  const openContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, path: string) => {
      event.preventDefault();
      setSelectedVaultPath(path);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        path,
      });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const requestRemoveVault = useCallback((path: string) => {
    setPendingRemovePath(path);
    setContextMenu(null);
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!pendingRemovePath) {
      return;
    }
    const targetPath = pendingRemovePath;
    setPendingRemovePath(null);
    setActionError("");
    setIsBusy(true);
    try {
      const normalizedTarget = normalizeVaultPath(targetPath);
      const remaining = vaults.filter(
        (entry) => normalizeVaultPath(entry.path) !== normalizedTarget,
      );
      const fallbackPath = remaining[0]?.path ?? null;
      onRemoveVault(targetPath);
      if (normalizedTarget && normalizedTarget === activeVaultKey) {
        if (fallbackPath) {
          const switched = await onSwitchVault(fallbackPath);
          if (switched) {
            setSelectedVaultPath(fallbackPath);
          } else {
            setActionError("Vault could not be opened.");
            onClearVault();
            setSelectedVaultPath(null);
          }
        } else {
          onClearVault();
          setSelectedVaultPath(null);
        }
        return;
      }
      if (
        selectedVaultPath &&
        normalizeVaultPath(selectedVaultPath) === normalizedTarget
      ) {
        setSelectedVaultPath(fallbackPath);
      }
    } finally {
      setIsBusy(false);
    }
  }, [
    activeVaultKey,
    onClearVault,
    onRemoveVault,
    onSwitchVault,
    pendingRemovePath,
    selectedVaultPath,
    vaults,
  ]);

  const handleCancelRemove = useCallback(() => {
    setPendingRemovePath(null);
  }, []);

  if (!isOpen) {
    return null;
  }

  const portalTarget = typeof document === "undefined" ? null : document.body;
  const selectedEntry = selectedVaultPath
    ? vaults.find((entry) => entry.path === selectedVaultPath) ?? null
    : null;
  const profileCount = profileState.profiles.length;
  const isProfileReady = profileState.status === "idle";
  const canManageProfiles = Boolean(resolvedUserVaultPath) && !selectedVaultMissing;
  const canLoadProfile = canManageProfiles && isProfileReady && profileCount > 0;
  const canCreateProfile = canManageProfiles && isProfileReady && profileCount === 0;
  const hasActiveVault = Boolean(activeVaultKey);
  const pendingRemoveName = pendingRemovePath
    ? vaultBaseName(pendingRemovePath)
    : "";

  const modal = (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel vault-manager-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-manager-title"
      >
        <div className="vault-manager-header">
          <h3 id="vault-manager-title">Manage Vaults</h3>
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
                    onContextMenu={(event) => openContextMenu(event, entry.path)}
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
                  className="ghost small"
                  onClick={() => void handleRefreshActiveVault("vault-manager:actions")}
                  disabled={!hasActiveVault || isBusy}
                >
                  Refresh Active Vault
                </button>
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
                      onClick={() => requestRemoveVault(selectedEntry.path)}
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
        {contextMenu ? (
          <div
            className="context-menu-backdrop vault-manager-context-backdrop"
            role="presentation"
            onMouseDown={closeContextMenu}
          >
            <div
              className="context-menu vault-manager-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
              className="context-menu-item"
              onClick={() => {
                closeContextMenu();
                void handleRefreshActiveVault("vault-manager:context-menu");
              }}
              disabled={!hasActiveVault || isBusy}
            >
              Refresh Active Vault
            </button>
              <button
                type="button"
                className="context-menu-item"
                onClick={() => requestRemoveVault(contextMenu.path)}
                disabled={isBusy}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
        {pendingRemovePath ? (
          <div
            className="modal-backdrop vault-manager-confirm-backdrop"
            role="presentation"
            onMouseDown={handleCancelRemove}
          >
            <div
              className="modal-panel vault-manager-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="vault-manager-remove-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <h3 id="vault-manager-remove-title">
                Remove vault "{pendingRemoveName}" from list?
              </h3>
              <p className="muted">This will not delete files from disk.</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={handleCancelRemove}
                  disabled={isBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleConfirmRemove()}
                  disabled={isBusy}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : modal;
};
