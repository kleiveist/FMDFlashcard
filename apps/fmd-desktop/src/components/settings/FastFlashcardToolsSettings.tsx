import { type FlashcardMode, type FlashcardOrder, type FlashcardScope } from "../../features/flashcards/useFlashcards";

type FastFlashcardToolsSettingsProps = {
  fastFlashcardOrder: FlashcardOrder;
  fastFlashcardMode: FlashcardMode;
  fastFlashcardScope: FlashcardScope;
  setFastFlashcardOrder: (value: FlashcardOrder) => void;
  setFastFlashcardMode: (value: FlashcardMode) => void;
  setFastFlashcardScope: (value: FlashcardScope) => void;
  showSectionDividers?: boolean;
};

export const FastFlashcardToolsSettings = ({
  fastFlashcardOrder,
  fastFlashcardMode,
  fastFlashcardScope,
  setFastFlashcardOrder,
  setFastFlashcardMode,
  setFastFlashcardScope,
  showSectionDividers = false,
}: FastFlashcardToolsSettingsProps) => {
  const containerClass = [
    "fast-flashcard-tools-settings",
    showSectionDividers ? "fast-flashcard-tools-settings--dividers" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">ORDER</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardOrder === "in-order" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardOrder === "in-order"}
              onClick={() => setFastFlashcardOrder("in-order")}
            >
              In order
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardOrder === "random" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardOrder === "random"}
              onClick={() => setFastFlashcardOrder("random")}
            >
              Random
            </button>
          </div>
        </div>
      </div>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">MODE</span>
          <select
            className="text-input"
            value={fastFlashcardMode}
            onChange={(event) =>
              setFastFlashcardMode(event.target.value as FlashcardMode)
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
      </div>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">DEFAULT SCOPE</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardScope === "current" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardScope === "current"}
              onClick={() => setFastFlashcardScope("current")}
            >
              Current note
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardScope === "vault" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardScope === "vault"}
              onClick={() => setFastFlashcardScope("vault")}
            >
              Whole vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
