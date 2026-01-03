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
}: SpacedRepetitionSettingsSectionProps) => (
  <section className="panel spaced-repetition-panel">
    <h2>Spaced Repetition</h2>
    <p className="muted">Configure spaced repetition behavior.</p>
    <div className="setting-row">
      <span className="label">Boxes</span>
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
      <span className="label">Default order</span>
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
      <span className="helper-text">
        In order keeps scan order. Random shuffles on load. Repetition prioritizes
        lower boxes and skips the last box.
      </span>
      {spacedRepetitionOrder === "repetition" && (
        <div className="setting-subrow">
          <span className="label">Repetition strength</span>
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
      )}
    </div>
    <div className="setting-row">
      <span className="label">Page size</span>
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
  </section>
);
