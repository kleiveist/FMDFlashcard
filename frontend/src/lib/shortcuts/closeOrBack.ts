/**
 * @file frontend/src/lib/shortcuts/closeOrBack.ts
 *
 * Zweck:
 * - Registriert schliessbare UI-Layer fuer den zentralen Esc-Handler.
 *
 * Verantwortlichkeiten:
 * - Verwalten einer Prioritaetsliste fuer Close/Back-Aktionen.
 * - Liefert den aktuell hoechsten aktiven Layer.
 */

type CloseLayer = {
  id: string;
  priority: number;
  isActive: () => boolean;
  onClose: () => void;
};

type RegisteredCloseLayer = CloseLayer & { order: number };

const closeLayers = new Map<string, RegisteredCloseLayer>();
let closeLayerOrder = 0;

export const registerCloseLayer = (layer: CloseLayer) => {
  const order = closeLayerOrder;
  closeLayerOrder += 1;
  closeLayers.set(layer.id, { ...layer, order });
  return () => {
    closeLayers.delete(layer.id);
  };
};

export const getActiveCloseLayer = () => {
  const active = Array.from(closeLayers.values()).filter((layer) => layer.isActive());
  if (active.length === 0) {
    return null;
  }
  active.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    return right.order - left.order;
  });
  return active[0];
};
