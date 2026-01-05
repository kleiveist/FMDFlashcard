import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
  type SpacedRepetitionBoxes,
  type SpacedRepetitionOrder,
  type SpacedRepetitionPageSize,
} from "../../../features/spaced-repetition/useSpacedRepetition";

type SrToolsPanelProps = {
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
  spacedRepetitionOrder: SpacedRepetitionOrder;
  setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
};

export const SrToolsPanel = ({
  spacedRepetitionBoxes,
  setSpacedRepetitionBoxes,
  spacedRepetitionOrder,
  setSpacedRepetitionOrder,
  spacedRepetitionPageSize,
  setSpacedRepetitionPageSize,
}: SrToolsPanelProps) => (
  <section className="panel sr-tools-panel">
    <div className="panel-header">
      <div>
        <h2>Spaced Repetition</h2>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">Boxes</span>
        <div className="pill-grid">
          {SPACED_REPETITION_BOXES.map((box) => (
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
      </div>
      <div className="setting-row">
        <span className="label">Page size</span>
        <div className="pill-grid">
          {SPACED_REPETITION_PAGE_SIZES.map((size) => (
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
    </div>
  </section>
);
