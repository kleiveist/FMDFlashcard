/**
 * @file apps/fmd-desktop/src/components/settings/PerformanceTabContent.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Performance Tab Content.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - PerformanceTabContent: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { type SettingsLanguage, tSettings } from "../../features/settings/settingsI18n";

const PARALLELISM_LABEL_KEYS = {
  low: "settings.performance.parallelism.low",
  medium: "settings.performance.parallelism.medium",
  high: "settings.performance.parallelism.high",
} as const;

type PerformanceTabContentProps = {
  language: SettingsLanguage;
  maxFilesPerScan: string;
  onMaxFilesPerScanChange: (value: string) => void;
  scanParallelism: "low" | "medium" | "high";
  setScanParallelism: (value: "low" | "medium" | "high") => void;
};

export const PerformanceTabContent = ({
  language,
  maxFilesPerScan,
  onMaxFilesPerScanChange,
  scanParallelism,
  setScanParallelism,
}: PerformanceTabContentProps) => (
  <>
    <div className="setting-row">
      <span className="label">
        {tSettings(language, "settings.performance.maxFilesPerScan")}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="text-input"
        value={maxFilesPerScan}
        onChange={(event) => onMaxFilesPerScanChange(event.target.value)}
        placeholder={tSettings(language, "settings.performance.optional")}
        aria-label="Max files per vault scan"
      />
      <span className="helper-text">
        {tSettings(language, "settings.performance.maxFilesHelper")}
      </span>
    </div>
    <div className="setting-row">
      <span className="label">
        {tSettings(language, "settings.performance.scanParallelism")}
      </span>
      <div className="pill-grid">
        {(["low", "medium", "high"] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`pill pill-button ${scanParallelism === level ? "active" : ""}`}
            aria-pressed={scanParallelism === level}
            onClick={() => setScanParallelism(level)}
          >
            {tSettings(language, PARALLELISM_LABEL_KEYS[level])}
          </button>
        ))}
      </div>
    </div>
  </>
);
