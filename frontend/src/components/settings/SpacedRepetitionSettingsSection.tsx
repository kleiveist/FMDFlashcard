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
import type { FlashcardMode } from "../../features/flashcards/useFlashcards";
import { type SettingsLanguage, tSettings } from "../../features/settings/settingsI18n";

type SpacedRepetitionSettingsSectionProps = {
  language: SettingsLanguage;
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
  flashcardMode: FlashcardMode;
  setFlashcardMode: (value: FlashcardMode) => void;
  autoTimeEnabled: boolean;
  setAutoTimeEnabled: (value: boolean) => void;
};

export const SpacedRepetitionSettingsSection = ({
  language,
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
  flashcardMode,
  setFlashcardMode,
  autoTimeEnabled,
  setAutoTimeEnabled,
}: SpacedRepetitionSettingsSectionProps) => (
  <section className="panel spaced-repetition-panel">
    <div className="panel-header">
      <div>
        <h2>{tSettings(language, "settings.spacedRepetition.title")}</h2>
        <p className="muted">{tSettings(language, "settings.spacedRepetition.description")}</p>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.spacedRepetition.defaultOrder")}
        </span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "in-order" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "in-order"}
            onClick={() => setSpacedRepetitionOrder("in-order")}
          >
            {tSettings(language, "settings.flashcardTools.inOrder")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "random" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "random"}
            onClick={() => setSpacedRepetitionOrder("random")}
          >
            {tSettings(language, "settings.flashcardTools.random")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionOrder === "repetition" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionOrder === "repetition"}
            onClick={() => setSpacedRepetitionOrder("repetition")}
          >
            {tSettings(language, "settings.spacedRepetition.repetition")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.spacedRepetition.mode")}
        </span>
        <select
          className="text-input"
          value={flashcardMode}
          onChange={(event) =>
            setFlashcardMode(event.target.value as FlashcardMode)
          }
          aria-label="Select mode filter"
        >
          <option value="all">{tSettings(language, "settings.flashcardTools.mode.all")}</option>
          <option value="qa">{tSettings(language, "settings.flashcardTools.mode.qa")}</option>
          <option value="multiple-choice">
            {tSettings(language, "settings.flashcardTools.mode.multipleChoice")}
          </option>
          <option value="fill-blank">
            {tSettings(language, "settings.flashcardTools.mode.fillBlank")}
          </option>
          <option value="assignment">
            {tSettings(language, "settings.flashcardTools.mode.assignment")}
          </option>
          <option value="true-false">
            {tSettings(language, "settings.flashcardTools.mode.trueFalse")}
          </option>
          <option value="mix">{tSettings(language, "settings.flashcardTools.mode.mix")}</option>
        </select>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.spacedRepetition.pageSize")}
        </span>
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
        <span className="label">{tSettings(language, "settings.spacedRepetition.boxes")}</span>
        <div className="pill-grid">
          {spacedRepetitionBoxOptions.map((box) => (
            <button
              key={box}
              type="button"
              className={`pill pill-button ${spacedRepetitionBoxes === box ? "active" : ""}`}
              aria-pressed={spacedRepetitionBoxes === box}
              onClick={() => setSpacedRepetitionBoxes(box)}
            >
              {box} {tSettings(language, "settings.spacedRepetition.boxesSuffix")}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.spacedRepetition.autoTime")}
        </span>
        <div className="setting-inline">
          <label className="switch">
            <input
              type="checkbox"
              checked={autoTimeEnabled}
              onChange={(event) => setAutoTimeEnabled(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">
            {autoTimeEnabled
              ? tSettings(language, "settings.common.enabled")
              : tSettings(language, "settings.common.disabled")}
          </span>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.spacedRepetition.repetitionStrength")}
        </span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "weak" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "weak"}
            onClick={() => setSpacedRepetitionRepetitionStrength("weak")}
          >
            {tSettings(language, "settings.spacedRepetition.repetitionStrength.weak")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "medium" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "medium"}
            onClick={() => setSpacedRepetitionRepetitionStrength("medium")}
          >
            {tSettings(language, "settings.spacedRepetition.repetitionStrength.medium")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${
              spacedRepetitionRepetitionStrength === "strong" ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionRepetitionStrength === "strong"}
            onClick={() => setSpacedRepetitionRepetitionStrength("strong")}
          >
            {tSettings(language, "settings.spacedRepetition.repetitionStrength.strong")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.spacedRepetition.helpHints")}
        </span>
        <div className="setting-inline">
          <label className="switch">
            <input
              type="checkbox"
              checked={helpEnabled}
              onChange={(event) => setHelpEnabled(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">
            {helpEnabled
              ? tSettings(language, "settings.common.enabled")
              : tSettings(language, "settings.common.disabled")}
          </span>
        </div>
      </div>
    </div>
  </section>
);
