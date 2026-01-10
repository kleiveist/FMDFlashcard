/**
 * @file apps/fmd-desktop/src/components/VaultCreateModal.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Vault Create Modal.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/VaultTree.tsx: Nutzt dieses Modul.
 * - react: React-API.
 *
 * Exportiert:
 * - VaultCreateModal: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type VaultCreateModalProps = {
  isOpen: boolean;
  kind: "file" | "folder";
  name: string;
  error: string;
  isPending?: boolean;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const VaultCreateModal = ({
  isOpen,
  kind,
  name,
  error,
  isPending = false,
  onNameChange,
  onCancel,
  onConfirm,
}: VaultCreateModalProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const title = kind === "file" ? "Create New File" : "Create New Folder";
  const portalTarget = typeof document === "undefined" ? null : document.body;

  const modal = (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-create-title"
      >
        <h3 id="vault-create-title">{title}</h3>
        <form
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isPending) {
              onConfirm();
            }
          }}
        >
          <label className="label" htmlFor="vault-create-input">
            Name
          </label>
          <input
            ref={inputRef}
            id="vault-create-input"
            className="text-input"
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(error) || undefined}
          />
          {error ? <span className="helper-text error-text">{error}</span> : null}
        </form>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : modal;
};
