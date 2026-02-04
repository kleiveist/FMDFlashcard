/**
 * @file apps/fmd-desktop/src/components/UserVaultGateModals.tsx
 *
 * Zweck:
 * - Rendert Onboarding-Gates fuer den Wallet-Flow.
 */

import { useEffect, useRef } from "react";
import type { UserVaultState } from "../features/user-vault/useUserVault";
import { ModalShell } from "./ModalShell";
import { SyncProviderSection } from "./settings/DataSyncTabContent";
import { ProfileSetupView } from "./settings/ProfileSetupSections";
import { type UserRegistryControlsProps } from "./UserToolsPanel";

type GateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
};

const useFocusRestore = (isOpen: boolean) => {
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (isOpen) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    if (lastFocusedRef.current && document.contains(lastFocusedRef.current)) {
      lastFocusedRef.current.focus();
    }
  }, [isOpen]);
};

const UserVaultProfileSetupModal = ({
  isOpen,
  onClose,
  userVault,
  spacedRepetition,
}: GateModalProps) => {
  useFocusRestore(isOpen);
  const activeUserName = spacedRepetition.spacedRepetitionActiveUser?.trim() ?? "";
  const hasValidRoot =
    Boolean(userVault.resolvedPath) && userVault.status === "idle";
  const hasActiveUser = Boolean(activeUserName);
  const canClose = hasValidRoot && hasActiveUser;
  return (
    <ModalShell
      isOpen={isOpen}
      title="Profile setup"
      onClose={onClose}
      canClose={canClose}
      initialFocusSelector='[data-autofocus="profile-source"]'
      bodyClassName="hub-modal-scroll"
    >
      <div className="settings-tab-content">
        <ProfileSetupView
          userVault={userVault}
          spacedRepetition={spacedRepetition}
          autoFocusSource
        />
      </div>
    </ModalShell>
  );
};

export const UserVaultCustomPathModal = (props: GateModalProps) => (
  <UserVaultProfileSetupModal {...props} />
);

export const UserVaultProfileModal = (props: GateModalProps) => (
  <UserVaultProfileSetupModal {...props} />
);

export const UserVaultSyncProviderModal = ({
  isOpen,
  onClose,
  userVault,
  spacedRepetition: _spacedRepetition,
}: GateModalProps) => {
  useFocusRestore(isOpen);
  return (
    <ModalShell
      isOpen={isOpen}
      title="Sync provider"
      onClose={onClose}
      bodyClassName="hub-modal-scroll"
    >
      <div className="settings-tab-content">
        <SyncProviderSection />
        {userVault.error ? (
          <div className="setting-row">
            <span className="label">Status</span>
            <span className="helper-text error-text">{userVault.error}</span>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
};
