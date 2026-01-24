/**
 * @file apps/fmd-desktop/src/components/settings/SpacedRepetitionSettingsSection.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Spaced Repetition Settings Section.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts: Typen.
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - SpacedRepetitionSettingsSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import type {
  SpacedRepetitionBoxes,
  SpacedRepetitionOrder,
  SpacedRepetitionPageSize,
  SpacedRepetitionRepetitionStrength,
} from "../../features/spaced-repetition/useSpacedRepetition";

type SpacedRepetitionSettingsSectionProps = {
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  spacedRepetitionBoxOptions: SpacedRepetitionBoxes[];
  spacedRepetitionOrder: SpacedRepetitionOrder;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  spacedRepetitionPageSizes: SpacedRepetitionPageSize[];
  spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
  setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
  setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
  setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
  setSpacedRepetitionRepetitionStrength: (
    value: SpacedRepetitionRepetitionStrength,
  ) => void;
  helpEnabled: boolean;
  setHelpEnabled: (value: boolean) => void;
};

export const SpacedRepetitionSettingsSection = ({
  spacedRepetitionBoxes,
  spacedRepetitionBoxOptions,
  spacedRepetitionOrder,
  spacedRepetitionPageSize,
  spacedRepetitionPageSizes,
  spacedRepetitionRepetitionStrength,
  setSpacedRepetitionBoxes,
  setSpacedRepetitionOrder,
  setSpacedRepetitionPageSize,
  setSpacedRepetitionRepetitionStrength,
  helpEnabled,
  setHelpEnabled,
}: SpacedRepetitionSettingsSectionProps) => (
  <section className="panel spaced-repetition-panel">
    <div className="panel-header">
      <div>
        <h2>Spaced Repetition Tools</h2>
        <p className="muted">Configure spaced repetition behavior.</p>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">DEFAULT ORDER</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "in-order" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "in-order"}
            onClick={() => setSpacedRepetitionOrder("in-order")}
          >
            In order
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "random" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "random"}
            onClick={() => setSpacedRepetitionOrder("random")}
          >
            Random
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "repetition" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "repetition"}
            onClick={() => setSpacedRepetitionOrder("repetition")}
          >
            Repetition
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">PAGE SIZE</span>
        <div className="pill-grid">
          {spacedRepetitionPageSizes.map((size) => (
            <button
              key={size}
              type="button"
              className={`pill pill-button ${
                spacedRepetitionPageSize === size ? "active" : ""
              }`}
              aria-pressed={spacedRepetitionPageSize === size}
              onClick={() => setSpacedRepetitionPageSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">BOXES</span>
        <div className="pill-grid">
          {spacedRepetitionBoxOptions.map((box) => (
            <button
              key={box}
              type="button"
              className={`pill pill-button ${spacedRepetitionBoxes === box ? "active" : ""}`}
              aria-pressed={spacedRepetitionBoxes === box}
              onClick={() => setSpacedRepetitionBoxes(box)}
            >
              {box} Boxes
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">REPETITION STRENGTH</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "weak" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "weak"}
            onClick={() => setSpacedRepetitionRepetitionStrength("weak")}
          >
            Weak
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "medium" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "medium"}
            onClick={() => setSpacedRepetitionRepetitionStrength("medium")}
          >
            Medium
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "strong" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "strong"}
            onClick={() => setSpacedRepetitionRepetitionStrength("strong")}
          >
            Strong
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">HELP / HINTS</span>
        <div className="setting-inline">
          <label className="switch">
            <input
              type="checkbox"
              checked={helpEnabled}
              onChange={(event) => setHelpEnabled(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">{helpEnabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>
    </div>
  </section>
);
