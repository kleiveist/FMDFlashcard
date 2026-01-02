import { useState } from "react";

type DataSyncView = "data-sync" | "language";
type AppLanguage = "de" | "en";

const LANGUAGE_LABELS: Record<
  AppLanguage,
  { heading: string; placeholder: string; deLabel: string; enLabel: string }
> = {
  de: {
    heading: "Sprache",
    placeholder: "Kommt spaeter.",
    deLabel: "Deutsch",
    enLabel: "Englisch",
  },
  en: {
    heading: "Language",
    placeholder: "Coming later.",
    deLabel: "German",
    enLabel: "English",
  },
};

type DataSyncSectionProps = {
  language: AppLanguage;
  onLanguageChange: (value: AppLanguage) => void;
};

export const DataSyncSection = ({
  language,
  onLanguageChange,
}: DataSyncSectionProps) => {
  const [view, setView] = useState<DataSyncView>("data-sync");
  const labels = LANGUAGE_LABELS[language];

  return (
    <section className="panel data-sync-panel">
      <div className="panel-header">
        <div>
          <h2>Data &amp; Sync</h2>
          {view === "data-sync" ? (
            <p className="muted">Storage and sync options will land here later.</p>
          ) : null}
        </div>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${view === "data-sync" ? "active" : ""}`}
            aria-pressed={view === "data-sync"}
            onClick={() => setView("data-sync")}
          >
            Data &amp; Sync
          </button>
          <button
            type="button"
            className={`pill pill-button ${view === "language" ? "active" : ""}`}
            aria-pressed={view === "language"}
            onClick={() => setView("language")}
          >
            Language
          </button>
        </div>
      </div>
      {view === "data-sync" ? (
        <>
          <div className="setting-row">
            <span className="label">Local storage path</span>
            <input
              type="text"
              className="text-input"
              value="—"
              disabled
              aria-label="Local storage path"
            />
          </div>
          <div className="setting-row">
            <span className="label">Export / Import (JSON)</span>
            <div className="setting-actions">
              <button type="button" className="ghost small" disabled>
                Export JSON
              </button>
              <button type="button" className="ghost small" disabled>
                Import JSON
              </button>
            </div>
            <span className="helper-text">Coming later.</span>
          </div>
          <div className="setting-row">
            <span className="label">Sync provider</span>
            <input
              type="text"
              className="text-input"
              value="Coming later"
              disabled
              aria-label="Sync provider"
            />
          </div>
        </>
      ) : (
        <>
          <p className="muted">{labels.placeholder}</p>
          <div className="setting-row">
            <span className="label">{labels.heading}</span>
            <div className="pill-grid">
              <button
                type="button"
                className={`pill pill-button ${language === "de" ? "active" : ""}`}
                aria-pressed={language === "de"}
                onClick={() => onLanguageChange("de")}
              >
                {labels.deLabel}
              </button>
              <button
                type="button"
                className={`pill pill-button ${language === "en" ? "active" : ""}`}
                aria-pressed={language === "en"}
                onClick={() => onLanguageChange("en")}
              >
                {labels.enLabel}
              </button>
            </div>
            <span className="helper-text">{labels.placeholder}</span>
          </div>
        </>
      )}
    </section>
  );
};
