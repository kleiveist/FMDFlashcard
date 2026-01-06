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

export const DataSyncTabContent = () => (
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
        value="Coming later."
        disabled
        aria-label="Sync provider"
      />
    </div>
  </>
);

type LanguageTabContentProps = {
  language: AppLanguage;
  onLanguageChange: (value: AppLanguage) => void;
};

export const LanguageTabContent = ({
  language,
  onLanguageChange,
}: LanguageTabContentProps) => {
  const labels = LANGUAGE_LABELS[language];
  return (
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
  );
};
