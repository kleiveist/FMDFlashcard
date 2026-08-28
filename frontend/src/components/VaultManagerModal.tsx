/**
 * @file frontend/src/components/VaultManagerModal.tsx
 *
 * Zweck:
 * - Rendert das Vault Manager Modal.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { createPortal } from "react-dom";
import { asErrorMessage } from "../lib/errors";
import { normalizeVaultPath, vaultBaseName } from "../lib/path";
import { resolveActiveProfileRoot } from "../lib/userVault";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import {
  createUserVaultProfile,
  listUserVaultProfiles,
  loadUserVaultMeta,
  setActiveProfileId,
  type UserVaultProfileSummary,
} from "../features/user-vault/storage";
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
  vaultId: string;
  path: string;
};

type VaultRecheckResult = {
  vaultId: string;
  path: string | null;
  available: boolean;
  loaded: boolean;
  lastError: string | null;
  message: string;
};

type ActionFeedback = {
  tone: "success" | "info";
  message: string;
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
  onRecheckVault: (
    vaultId: string,
    options?: { loadIfAvailable?: boolean; source?: string },
  ) => Promise<VaultRecheckResult>;
  onRelinkVault: (
    vaultId: string,
    nextPath: string,
    source?: string,
  ) => Promise<VaultRecheckResult>;
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
  onRecheckVault,
  onRelinkVault,
  onSwitchVault,
  onRemoveVault,
  onClearVault,
}: VaultManagerModalProps) => {
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>(emptyProfileState);
  const [actionError, setActionError] = useState("");
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingRemovePath, setPendingRemovePath] = useState<string | null>(null);

  const activeVaultKey = useMemo(
    () => normalizeVaultPath(activeVaultPath ?? ""),
    [activeVaultPath],
  );
  const activeVaultEntry = useMemo(
    () =>
      vaults.find((entry) => normalizeVaultPath(entry.path) === activeVaultKey) ??
      null,
    [activeVaultKey, vaults],
  );
  const activeVaultMissing = activeVaultEntry?.status === "missing";
  const activeVaultActionLabel = activeVaultMissing
    ? "Recheck Active Vault"
    : "Refresh Active Vault";
  const selectedEntry = useMemo(
    () => vaults.find((entry) => entry.path === selectedVaultPath) ?? null,
    [selectedVaultPath, vaults],
  );
  const selectedVaultMissing = selectedEntry?.status === "missing";

  const resolvedUserVaultPath = useMemo(
    () =>
      resolveActiveProfileRoot(
        userVault.mode,
        selectedVaultPath,
        userVault.customPath,
      ),
    [selectedVaultPath, userVault.customPath, userVault.mode],
  );

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
      setActionFeedback(null);
      setProfileState(emptyProfileState);
      setContextMenu(null);
      setPendingRemovePath(null);
      return;
    }
    setActionError("");
    setActionFeedback(null);
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
    setActionFeedback(null);
    setIsBusy(true);
    try {
      await onOpenVault();
    } catch (error) {
      setActionError(asErrorMessage(error, "Vault could not be opened."));
    } finally {
      setIsBusy(false);
    }
  }, [onOpenVault]);

  const handleSelectVaultPath = useCallback((path: string) => {
    setSelectedVaultPath(path);
    setActionError("");
    setActionFeedback(null);
  }, []);

  const handleActivateVaultPath = useCallback(
    async (path: string) => {
      if (!path) {
        return;
      }
      handleSelectVaultPath(path);
      if (isBusy) {
        return;
      }
      const normalizedTarget = normalizeVaultPath(path);
      if (!normalizedTarget || normalizedTarget === activeVaultKey) {
        return;
      }
      setActionFeedback(null);
      setIsBusy(true);
      try {
        const switched = await onSwitchVault(path);
        if (!switched) {
          setActionError("Vault could not be opened.");
        }
      } catch (error) {
        setActionError(asErrorMessage(error, "Vault could not be opened."));
      } finally {
        setIsBusy(false);
      }
    },
    [activeVaultKey, handleSelectVaultPath, isBusy, onSwitchVault],
  );

  const applyRecheckFeedback = useCallback((result: VaultRecheckResult) => {
    if (result.available && result.loaded) {
      setActionFeedback({
        tone: "success",
        message: "Vault verfuegbar und geladen.",
      });
      return;
    }
    if (!result.available) {
      setActionFeedback({
        tone: "info",
        message: result.lastError
          ? `Vault noch missing: ${result.lastError}`
          : "Vault noch missing.",
      });
      return;
    }
    setActionFeedback({
      tone: "info",
      message: "Vault verfuegbar.",
    });
  }, []);

  const runVaultRecheck = useCallback(
    async (
      vaultId: string,
      options: { loadIfAvailable?: boolean; source?: string } = {},
    ) => {
      setActionError("");
      setActionFeedback(null);
      setIsBusy(true);
      try {
        const result = await onRecheckVault(vaultId, options);
        if (result.path) {
          setSelectedVaultPath(result.path);
        }
        if (result.available && result.path && result.path === selectedVaultPath) {
          await reloadProfileState();
        }
        applyRecheckFeedback(result);
      } catch (error) {
        setActionError(asErrorMessage(error, "Vault recheck failed."));
      } finally {
        setIsBusy(false);
      }
    },
    [
      applyRecheckFeedback,
      onRecheckVault,
      reloadProfileState,
      selectedVaultPath,
    ],
  );

  const handleLocateVault = useCallback(
    async (vaultId: string) => {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Vault-Ordner auswaehlen",
      });
      if (!selected || Array.isArray(selected)) {
        return;
      }
      setActionError("");
      setActionFeedback(null);
      setIsBusy(true);
      try {
        const result = await onRelinkVault(
          vaultId,
          selected,
          "vault-manager:locate",
        );
        if (result.path) {
          setSelectedVaultPath(result.path);
        }
        applyRecheckFeedback(result);
      } catch (error) {
        setActionError(asErrorMessage(error, "Vault relink failed."));
      } finally {
        setIsBusy(false);
      }
    },
    [applyRecheckFeedback, onRelinkVault],
  );

  const handleActivateVaultEntry = useCallback(
    async (entry: RecentVaultEntry) => {
      handleSelectVaultPath(entry.path);
      if (isBusy) {
        return;
      }
      if (entry.status === "missing") {
        await runVaultRecheck(entry.id, {
          loadIfAvailable: true,
          source: "vault-manager:dblclick-missing",
        });
        return;
      }
      await handleActivateVaultPath(entry.path);
    },
    [handleActivateVaultPath, handleSelectVaultPath, isBusy, runVaultRecheck],
  );

  const handleVaultKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, entry: RecentVaultEntry) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleActivateVaultEntry(entry);
        return;
      }
      if (event.key === " " || event.key === "Spacebar" || event.key === "Space") {
        event.preventDefault();
        handleSelectVaultPath(entry.path);
      }
    },
    [handleActivateVaultEntry, handleSelectVaultPath],
  );

  const handleLoadProfile = useCallback(async () => {
    if (!resolvedUserVaultPath) {
      return;
    }
    if (profileState.profiles.length === 0) {
      return;
    }
    setActionError("");
    setActionFeedback(null);
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
    setActionFeedback(null);
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
      if (!activeVaultEntry) {
        return;
      }
      if (activeVaultEntry.status === "missing") {
        await runVaultRecheck(activeVaultEntry.id, {
          loadIfAvailable: true,
          source: `${source}:active-missing`,
        });
        return;
      }
      setActionError("");
      setActionFeedback(null);
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
    [
      activeVaultEntry,
      activeVaultError,
      onRescanVault,
      runVaultRecheck,
    ],
  );

  const openContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>, vault: RecentVaultEntry) => {
      event.preventDefault();
      handleSelectVaultPath(vault.path);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        path: vault.path,
        vaultId: vault.id,
      });
    },
    [handleSelectVaultPath],
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
    setActionFeedback(null);
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
  const profileCount = profileState.profiles.length;
  const isProfileReady = profileState.status === "idle";
  const canManageProfiles = Boolean(resolvedUserVaultPath) && !selectedVaultMissing;
  const canLoadProfile = canManageProfiles && isProfileReady && profileCount > 0;
  const canCreateProfile = canManageProfiles && isProfileReady && profileCount === 0;
  const hasActiveVault = Boolean(activeVaultPath);
  const pendingRemoveName = pendingRemovePath
    ? vaultBaseName(pendingRemovePath)
    : "";
  const contextEntry = contextMenu
    ? vaults.find((entry) => entry.id === contextMenu.vaultId) ?? null
    : null;
  const contextVaultMissing = contextEntry?.status === "missing";

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
          <aside
            className="vault-manager-list"
            role="listbox"
            aria-label="Vault list"
          >
            {vaults.length === 0 ? (
              <div className="empty-state">No vaults found.</div>
            ) : (
              vaults.map((entry) => {
                const entryKey = normalizeVaultPath(entry.path);
                const isActive = entryKey === activeVaultKey;
                const isSelected = entry.path === selectedVaultPath;
                const isMissing = entry.status === "missing";
                return (
                  <div
                    key={entry.id}
                    className={`vault-manager-item${
                      isSelected ? " active" : ""
                    }`}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={() => handleSelectVaultPath(entry.path)}
                    onDoubleClick={() => void handleActivateVaultEntry(entry)}
                    onKeyDown={(event) => handleVaultKeyDown(event, entry)}
                    onContextMenu={(event) => openContextMenu(event, entry)}
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
                      {isMissing ? (
                        <span className="vault-manager-item-actions">
                          <button
                            type="button"
                            className="vault-manager-item-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              void runVaultRecheck(entry.id, {
                                loadIfAvailable: false,
                                source: "vault-manager:item-recheck",
                              });
                            }}
                            disabled={isBusy}
                            title="Recheck vault"
                            aria-label="Recheck vault"
                          >
                            ↻
                          </button>
                          <button
                            type="button"
                            className="vault-manager-item-action-text"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleLocateVault(entry.id);
                            }}
                            disabled={isBusy}
                          >
                            Locate...
                          </button>
                        </span>
                      ) : null}
                    </span>
                  </div>
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
                  {activeVaultActionLabel}
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
            {actionFeedback ? (
              <div
                className={
                  actionFeedback.tone === "success"
                    ? "vault-manager-feedback success"
                    : "vault-manager-feedback"
                }
                role="status"
              >
                {actionFeedback.message}
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
                    Vault folder is marked missing. Recheck or locate the folder to
                    recover this entry.
                    {selectedEntry.lastError ? (
                      <div className="vault-manager-warning-detail">
                        Last error: {selectedEntry.lastError}
                      </div>
                    ) : null}
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
                    <div className="vault-manager-profile-actions">
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() =>
                          void runVaultRecheck(selectedEntry.id, {
                            loadIfAvailable: true,
                            source: "vault-manager:selected-recheck",
                          })
                        }
                        disabled={isBusy}
                      >
                        Recheck
                      </button>
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => void handleLocateVault(selectedEntry.id)}
                        disabled={isBusy}
                      >
                        Locate...
                      </button>
                    </div>
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
                {activeVaultActionLabel}
              </button>
              {contextVaultMissing && contextEntry ? (
                <>
                  <button
                    type="button"
                    className="context-menu-item"
                    onClick={() => {
                      closeContextMenu();
                      void runVaultRecheck(contextEntry.id, {
                        loadIfAvailable: true,
                        source: "vault-manager:context-recheck",
                      });
                    }}
                    disabled={isBusy}
                  >
                    Recheck
                  </button>
                  <button
                    type="button"
                    className="context-menu-item"
                    onClick={() => {
                      closeContextMenu();
                      void handleLocateVault(contextEntry.id);
                    }}
                    disabled={isBusy}
                  >
                    Locate...
                  </button>
                </>
              ) : null}
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
