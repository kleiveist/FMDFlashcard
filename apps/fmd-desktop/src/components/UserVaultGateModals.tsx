/**
 * @file apps/fmd-desktop/src/components/UserVaultGateModals.tsx
 *
 * Zweck:
 * - Rendert Onboarding-Gates fuer den Wallet-Flow.
 */

import { useEffect, useRef, useState } from "react";
import type { UserVaultState } from "../features/user-vault/useUserVault";
import { ModalShell } from "./ModalShell";
import {
  ActivePathSection,
  SyncProviderSection,
} from "./settings/DataSyncTabContent";
import {
  UserRegistryControls,
  type UserRegistryControlsProps,
} from "./UserToolsPanel";
import { SrDeleteModal } from "../pages/spaced-repetition/components/SrDeleteModal";

type GateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userVault: UserVaultState;
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
};

const UserRegistryModalBody = ({
  spacedRepetition,
}: {
  spacedRepetition: UserRegistryControlsProps["spacedRepetition"];
}) => {
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
      <UserRegistryControls
        spacedRepetition={spacedRepetition}
        handleDeleteOpen={handleDeleteOpen}
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
  spacedRepetition,
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
        <UserRegistryModalBody spacedRepetition={spacedRepetition} />
      </div>
    </ModalShell>
  );
};

export const UserVaultProfileModal = ({
  isOpen,
  onClose,
  userVault,
  spacedRepetition,
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
        <UserRegistryModalBody spacedRepetition={spacedRepetition} />
      </div>
    </ModalShell>
  );
};

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
