/**
 * @file apps/fmd-desktop/src/components/VaultDeleteModal.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Vault Delete Modal.
 *
 * Verantwortlichkeiten:
 * - Bietet eine Bestaetigung zum Loeschen von Dateien an.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/VaultTree.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - VaultDeleteModal: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";

type VaultDeleteModalProps = {
  isOpen: boolean;
  fileName: string;
  error: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const VaultDeleteModal = ({
  isOpen,
  fileName,
  error,
  isPending = false,
  onCancel,
  onConfirm,
}: VaultDeleteModalProps) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    return registerCloseLayer({
      id: "vault-delete-modal",
      priority: 300,
      isActive: () => true,
      onClose: onCancel,
    });
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const portalTarget = typeof document === "undefined" ? null : document.body;

  const modal = (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-delete-title"
      >
        <h3 id="vault-delete-title">Delete file?</h3>
        <p className="muted">
          Do you really want to delete <strong>{fileName}</strong>?
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : modal;
};
