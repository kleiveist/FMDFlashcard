/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/components/SrDeleteModal.tsx
 *
 * Zweck:
 * - Rendert die Seite Sr Delete Modal.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/spaced-repetition/SpacedRepetitionPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - SrDeleteModal: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useEffect } from "react";
import { registerCloseLayer } from "../../../lib/shortcuts/closeOrBack";
import {
  formatSettingsText,
  type SettingsLanguage,
  tSettings,
} from "../../../features/settings/settingsI18n";

type SrDeleteModalProps = {
  language?: SettingsLanguage;
  isDeleteDialogOpen: boolean;
  deleteTargetName: string;
  deleteConfirmInput: string;
  setDeleteConfirmInput: (value: string) => void;
  handleDeleteCancel: () => void;
  handleDeleteConfirm: () => void;
  canConfirmDelete: boolean;
};

export const SrDeleteModal = ({
  language = "en",
  isDeleteDialogOpen,
  deleteTargetName,
  deleteConfirmInput,
  setDeleteConfirmInput,
  handleDeleteCancel,
  handleDeleteConfirm,
  canConfirmDelete,
}: SrDeleteModalProps) => {
  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return;
    }
    return registerCloseLayer({
      id: "sr-delete-modal",
      priority: 300,
      isActive: () => true,
      onClose: handleDeleteCancel,
    });
  }, [handleDeleteCancel, isDeleteDialogOpen]);

  if (!isDeleteDialogOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
      >
        <h3 id="delete-user-title">{tSettings(language, "settings.deleteUser.title")}</h3>
        <p className="muted">
          {tSettings(language, "settings.deleteUser.description")}
        </p>
        <div className="modal-body">
          <span className="label">
            {formatSettingsText(language, "settings.deleteUser.typeToConfirm", {
              name: deleteTargetName,
            })}
          </span>
          <input
            type="text"
            className="text-input"
            value={deleteConfirmInput}
            onChange={(event) => setDeleteConfirmInput(event.target.value)}
            aria-label="Type the username to confirm deletion"
          />
          <span className="helper-text">
            {tSettings(language, "settings.deleteUser.helper")}
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={handleDeleteCancel}>
            {tSettings(language, "settings.common.cancel")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleDeleteConfirm}
            disabled={!canConfirmDelete}
          >
            {tSettings(language, "settings.user.delete")}
          </button>
        </div>
      </div>
    </div>
  );
};
