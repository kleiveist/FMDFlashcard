/**
 * @file apps/fmd-desktop/src/components/settings/AppearanceSection.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Appearance Section.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/theme.ts: Typen.
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - AppearanceSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { type ThemeMode } from "../../lib/theme";
import { ACCENT_PALETTE } from "./accentPalette";

type AppearanceSectionProps = {
  accentColor: string;
  accentDraft: string;
  accentError: string;
  onAccentInputChange: (value: string) => void;
  onAccentPick: (value: string) => void;
  onCopyAccent: () => void;
  onThemeToggle: (nextTheme: ThemeMode) => void;
  theme: ThemeMode;
};

export const AppearanceSection = ({
  accentColor,
  accentDraft,
  accentError,
  onAccentInputChange,
  onAccentPick,
  onCopyAccent,
  onThemeToggle,
  theme,
}: AppearanceSectionProps) => (
  <section className="panel appearance-panel">
    <h2>Appearance</h2>
    <p className="muted">
      Theme und Akzentfarbe praegen die Oberflaeche und bleiben gespeichert.
    </p>
    <div className="appearance-main">
      <div className="setting-row">
        <span className="label">Theme</span>
        <div className="theme-toggle">
          <span className="toggle-label">Hell</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={theme === "dark"}
              onChange={(event) =>
                onThemeToggle(event.target.checked ? "dark" : "light")
              }
              aria-label="Theme umschalten"
            />
            <span className="slider" />
          </label>
          <span className="toggle-label">Dunkel</span>
        </div>
        <span className="helper-text">
          Wechselt Hintergrund, Kontrast und Panels.
        </span>
      </div>
      <div className="setting-row">
        <span className="label">Akzentfarbe</span>
        <div className="accent-controls">
          <input
            type="color"
            className="color-wheel"
            value={accentColor}
            onChange={(event) => onAccentPick(event.target.value)}
            aria-label="Akzentfarbe auswaehlen"
          />
          <div className="accent-palette">
            {ACCENT_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={`accent-swatch ${accentColor === color ? "active" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => onAccentPick(color)}
                aria-label={`Akzentfarbe ${color}`}
              />
            ))}
          </div>
        </div>
        <div className="accent-hex">
          <input
            type="text"
            className="hex-input"
            value={accentDraft}
            onChange={(event) => onAccentInputChange(event.target.value)}
            placeholder="#RRGGBB"
            aria-label="Akzentfarbe als HEX"
          />
          <button type="button" className="ghost small" onClick={onCopyAccent}>
            Kopieren
          </button>
        </div>
        <span className={`helper-text ${accentError ? "error-text" : ""}`}>
          {accentError || "HEX Wert der Akzentfarbe (#RRGGBB)."}
        </span>
      </div>
    </div>
  </section>
);
