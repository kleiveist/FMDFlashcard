import type {
  FlashcardMode,
  FlashcardOrder,
  FlashcardPageSize,
  FlashcardScope,
  StatsResetMode,
} from "../../features/flashcards/useFlashcards";

type FlashcardsSettingsSectionProps = {
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
};

export const FlashcardsSettingsSection = ({
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
}: FlashcardsSettingsSectionProps) => (
  <section className="panel settings-flashcards-panel">
    <h2>Flashcard Tools</h2>
    <p className="muted">Default behavior for scans and review sessions.</p>
    <div className="setting-row">
      <span className="label">Default scope</span>
      <div className="pill-grid">
        <button
          type="button"
          className={`pill pill-button ${
            flashcardScope === "current" ? "active" : ""
          }`}
          aria-pressed={flashcardScope === "current"}
          onClick={() => setFlashcardScope("current")}
        >
          Current note
        </button>
        <button
          type="button"
          className={`pill pill-button ${flashcardScope === "vault" ? "active" : ""}`}
          aria-pressed={flashcardScope === "vault"}
          onClick={() => setFlashcardScope("vault")}
        >
          Whole vault
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Default order</span>
      <div className="pill-grid">
        <button
          type="button"
          className={`pill pill-button ${
            flashcardOrder === "in-order" ? "active" : ""
          }`}
          aria-pressed={flashcardOrder === "in-order"}
          onClick={() => setFlashcardOrder("in-order")}
        >
          In order
        </button>
        <button
          type="button"
          className={`pill pill-button ${flashcardOrder === "random" ? "active" : ""}`}
          aria-pressed={flashcardOrder === "random"}
          onClick={() => setFlashcardOrder("random")}
        >
          Random
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Mode</span>
      <select
        className="text-input"
        value={flashcardMode}
        onChange={(event) =>
          setFlashcardMode(event.target.value as FlashcardMode)
        }
        aria-label="Select mode filter"
      >
        <option value="all">All</option>
        <option value="qa">Q&amp;A</option>
        <option value="multiple-choice">Multiple Choice</option>
        <option value="fill-blank">Fill-in-the-blank</option>
        <option value="assignment">Assignment</option>
        <option value="true-false">True/False</option>
        <option value="mix">Mix</option>
      </select>
    </div>
    <div className="setting-row">
      <span className="label">Page size</span>
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
      <span className="label">Statistics reset</span>
      <div className="pill-grid">
        <button
          type="button"
          className={`pill pill-button ${statsResetMode === "scan" ? "active" : ""}`}
          aria-pressed={statsResetMode === "scan"}
          onClick={() => setStatsResetMode("scan")}
        >
          Per scan
        </button>
        <button
          type="button"
          className={`pill pill-button ${statsResetMode === "session" ? "active" : ""}`}
          aria-pressed={statsResetMode === "session"}
          onClick={() => setStatsResetMode("session")}
        >
          Per session
        </button>
      </div>
    </div>
  </section>
);
