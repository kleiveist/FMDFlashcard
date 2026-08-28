/**
 * @file frontend/src/components/settings/FlashcardsSettingsSection.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Flashcards Settings Section.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - frontend/src/features/flashcards/useFlashcards.ts: Typen.
 * - frontend/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - FlashcardsSettingsSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import type {
  FlashcardMode,
  FlashcardOrder,
  FlashcardPageSize,
  FlashcardScope,
  StatsResetMode,
} from "../../features/flashcards/useFlashcards";
import { type SettingsLanguage, tSettings } from "../../features/settings/settingsI18n";

type FlashcardsSettingsSectionProps = {
  language: SettingsLanguage;
  flashcardMode: FlashcardMode;
  flashcardOrder: FlashcardOrder;
  flashcardPageSize: FlashcardPageSize;
  flashcardPageSizes: FlashcardPageSize[];
  flashcardScope: FlashcardScope;
  setFlashcardMode: (value: FlashcardMode) => void;
  setFlashcardOrder: (value: FlashcardOrder) => void;
  setFlashcardPageSize: (value: FlashcardPageSize) => void;
  setFlashcardScope: (value: FlashcardScope) => void;
  setStatsResetMode: (value: StatsResetMode) => void;
  statsResetMode: StatsResetMode;
  helpEnabled: boolean;
  setHelpEnabled: (value: boolean) => void;
};

export const FlashcardsSettingsSection = ({
  language,
  flashcardMode,
  flashcardOrder,
  flashcardPageSize,
  flashcardPageSizes,
  flashcardScope,
  setFlashcardMode,
  setFlashcardOrder,
  setFlashcardPageSize,
  setFlashcardScope,
  setStatsResetMode,
  statsResetMode,
  helpEnabled,
  setHelpEnabled,
}: FlashcardsSettingsSectionProps) => (
  <section className="panel settings-flashcards-panel">
    <div className="panel-header">
      <div>
        <h2>{tSettings(language, "settings.flashcardTools.title")}</h2>
        <p className="muted">{tSettings(language, "settings.flashcardTools.description")}</p>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.flashcardTools.defaultOrder")}
        </span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              flashcardOrder === "in-order" ? "active" : ""
            }`}
            aria-pressed={flashcardOrder === "in-order"}
            onClick={() => setFlashcardOrder("in-order")}
          >
            {tSettings(language, "settings.flashcardTools.inOrder")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${flashcardOrder === "random" ? "active" : ""}`}
            aria-pressed={flashcardOrder === "random"}
            onClick={() => setFlashcardOrder("random")}
          >
            {tSettings(language, "settings.flashcardTools.random")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">{tSettings(language, "settings.flashcardTools.mode")}</span>
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
          {tSettings(language, "settings.flashcardTools.pageSize")}
        </span>
        <div className="pill-grid">
          {flashcardPageSizes.map((size) => (
            <button
              key={size}
              type="button"
              className={`pill pill-button ${
                flashcardPageSize === size ? "active" : ""
              }`}
              aria-pressed={flashcardPageSize === size}
              onClick={() => setFlashcardPageSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.flashcardTools.defaultScope")}
        </span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${
              flashcardScope === "current" ? "active" : ""
            }`}
            aria-pressed={flashcardScope === "current"}
            onClick={() => setFlashcardScope("current")}
          >
            {tSettings(language, "settings.flashcardTools.currentNote")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${flashcardScope === "vault" ? "active" : ""}`}
            aria-pressed={flashcardScope === "vault"}
            onClick={() => setFlashcardScope("vault")}
          >
            {tSettings(language, "settings.flashcardTools.wholeVault")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.flashcardTools.statisticsReset")}
        </span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${statsResetMode === "scan" ? "active" : ""}`}
            aria-pressed={statsResetMode === "scan"}
            onClick={() => setStatsResetMode("scan")}
          >
            {tSettings(language, "settings.flashcardTools.perScan")}
          </button>
          <button
            type="button"
            className={`pill pill-button ${statsResetMode === "session" ? "active" : ""}`}
            aria-pressed={statsResetMode === "session"}
            onClick={() => setStatsResetMode("session")}
          >
            {tSettings(language, "settings.flashcardTools.perSession")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.flashcardTools.helpHints")}
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
