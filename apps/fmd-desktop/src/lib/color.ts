export const DEFAULT_ACCENT = "#E07A5F";

export const normalizeHex = (value: string) => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }
  if (!trimmed.startsWith("#")) {
    return `#${trimmed}`;
  }
  return `#${trimmed.slice(1)}`;
};

export const isValidHex = (value: string) => /^#[0-9A-F]{6}$/.test(value);

export const hexToRgb = (value: string) => {
  if (!isValidHex(value)) {
    return null;
  }
  const hex = value.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
};

export const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (channel: number) =>
    channel.toString(16).toUpperCase().padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const mixChannel = (from: number, to: number, amount: number) =>
  Math.round(from + (to - from) * amount);

export const mixRgb = (
  rgb: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
) => ({
  r: mixChannel(rgb.r, target.r, amount),
  g: mixChannel(rgb.g, target.g, amount),
  b: mixChannel(rgb.b, target.b, amount),
});

export const contrastFor = (rgb: { r: number; g: number; b: number }) => {
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance > 170 ? "#1A1A1A" : "#FFFFFF";
};

export const buildAccentTokens = (value: string, fallback = DEFAULT_ACCENT) => {
  const normalized = normalizeHex(value);
  const rgb = hexToRgb(normalized) ?? hexToRgb(fallback)!;
  const strong = mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.18);
  const highlight = mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.28);
  return {
    accent: rgbToHex(rgb.r, rgb.g, rgb.b),
    accentStrong: rgbToHex(strong.r, strong.g, strong.b),
    accentSoft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    accentHighlight: rgbToHex(highlight.r, highlight.g, highlight.b),
    accentBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
    accentContrast: contrastFor(rgb),
    accentContrastStrong: contrastFor(strong),
  };
};
