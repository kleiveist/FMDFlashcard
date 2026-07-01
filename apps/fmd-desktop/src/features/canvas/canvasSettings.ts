export type CanvasCustomColorSlot = {
  slot: number;
  name: string;
  value: string | null;
};

export type CanvasSettings = {
  customColors: CanvasCustomColorSlot[];
  lastPalette?: string | null;
};

const CANVAS_CUSTOM_COLOR_SLOT_COUNT = 6;
const hexPattern = /^#[0-9a-f]{6}$/i;

export const normalizeCanvasHex = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return hexPattern.test(withHash) ? withHash.toLowerCase() : null;
};

export const buildEmptyCanvasCustomColorSlots = (): CanvasCustomColorSlot[] =>
  Array.from({ length: CANVAS_CUSTOM_COLOR_SLOT_COUNT }, (_, index) => ({
    slot: index + 1,
    name: `Custom ${index + 1}`,
    value: null,
  }));

export const normalizeCanvasCustomColorSlots = (
  value: unknown,
): CanvasCustomColorSlot[] => {
  const slots = buildEmptyCanvasCustomColorSlots();
  if (!Array.isArray(value)) {
    return slots;
  }
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const candidate = entry as {
      slot?: unknown;
      name?: unknown;
      value?: unknown;
    };
    const slotNumber =
      typeof candidate.slot === "number" && Number.isInteger(candidate.slot)
        ? candidate.slot
        : index + 1;
    if (slotNumber < 1 || slotNumber > CANVAS_CUSTOM_COLOR_SLOT_COUNT) {
      return;
    }
    const normalizedName =
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name.trim()
        : `Custom ${slotNumber}`;
    slots[slotNumber - 1] = {
      slot: slotNumber,
      name: normalizedName,
      value: normalizeCanvasHex(candidate.value),
    };
  });
  return slots;
};

export const normalizeCanvasSettings = (value: unknown): CanvasSettings => {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { customColors?: unknown; lastPalette?: unknown })
      : {};
  return {
    customColors: normalizeCanvasCustomColorSlots(candidate.customColors),
    lastPalette:
      typeof candidate.lastPalette === "string" && candidate.lastPalette.trim()
        ? candidate.lastPalette.trim()
        : null,
  };
};
