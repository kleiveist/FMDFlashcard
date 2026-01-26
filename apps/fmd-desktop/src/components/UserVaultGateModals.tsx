/**
 * @file apps/fmd-desktop/src/components/UserVaultGateModals.tsx
 *
 * Zweck:
 * - Rendert Onboarding-Gates fuer den Wallet-Flow.
 */

import { useEffect, useRef } from "react";
import type { UserVaultState } from "../features/user-vault/useUserVault";
import { ModalShell } from "./ModalShell";
import { ActivePathSection, ProfileSections, SyncProviderSection } from "./settings/DataSyncTabContent";

type GateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userVault: UserVaultState;
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

export const UserVaultCustomPathModal = ({
  isOpen,
  onClose,
  userVault,
}: GateModalProps) => {
  useFocusRestore(isOpen);
  return (
    <ModalShell
      isOpen={isOpen}
      title="Active path required"
      onClose={onClose}
      bodyClassName="hub-modal-scroll"
    >
      <div className="settings-tab-content">
        <ActivePathSection
          userVault={userVault}
          label="ACTIVE PATH"
          helperText="Pick a folder outside the vault if you prefer."
          allowPickWhenAuto
        />
        <ProfileSections
          userVault={userVault}
          showLoad={false}
          labels={{ profiles: "PROFILES", create: "CREATE PROFILE" }}
        />
      </div>
    </ModalShell>
  );
};

export const UserVaultProfileModal = ({
  isOpen,
  onClose,
  userVault,
}: GateModalProps) => {
  useFocusRestore(isOpen);
  return (
    <ModalShell
      isOpen={isOpen}
      title="Profile setup"
      onClose={onClose}
      bodyClassName="hub-modal-scroll"
    >
      <div className="settings-tab-content">
        <ProfileSections userVault={userVault} />
      </div>
    </ModalShell>
  );
};

export const UserVaultSyncProviderModal = ({
  isOpen,
  onClose,
  userVault,
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
