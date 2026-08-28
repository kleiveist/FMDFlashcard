/**
 * @file frontend/src/components/settings/ResetSessionHistoryModal.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Reset Session History Modal.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - frontend/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - ResetSessionHistoryModal: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useEffect } from "react";
import { registerCloseLayer } from "../../lib/shortcuts/closeOrBack";
import { type SettingsLanguage, tSettings } from "../../features/settings/settingsI18n";

type ResetSessionHistoryModalProps = {
  language: SettingsLanguage;
  isOpen: boolean;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ResetSessionHistoryModal = ({
  language,
  isOpen,
  isPending = false,
  onCancel,
  onConfirm,
}: ResetSessionHistoryModalProps) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    return registerCloseLayer({
      id: "reset-session-history-modal",
      priority: 300,
      isActive: () => true,
      onClose: onCancel,
    });
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-session-history-title"
        aria-describedby="reset-session-history-body"
      >
        <h3 id="reset-session-history-title">
          {tSettings(language, "settings.resetHistory.title")}
        </h3>
        <div className="modal-body" id="reset-session-history-body">
          <p className="muted">
            {tSettings(language, "settings.resetHistory.description")}
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={isPending}>
            {tSettings(language, "settings.common.cancel")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending
              ? tSettings(language, "settings.common.resetting")
              : tSettings(language, "settings.common.reset")}
          </button>
        </div>
      </div>
    </div>
  );
};
