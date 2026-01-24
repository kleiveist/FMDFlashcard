/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/components/SrToolsPanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Sr Tools Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts: Feature-Logik oder Hook.
 * - apps/fmd-desktop/src/pages/spaced-repetition/SpacedRepetitionPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - SrToolsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
  type SpacedRepetitionBoxes,
  type SpacedRepetitionOrder,
  type SpacedRepetitionPageSize,
} from "../../../features/spaced-repetition/useSpacedRepetition";
import { CollapsiblePanelHeader } from "../../../components/CollapsiblePanelHeader";

type SrToolsPanelProps = {
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
  spacedRepetitionOrder: SpacedRepetitionOrder;
  setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
};

export const SrToolsPanel = ({
  spacedRepetitionBoxes,
  setSpacedRepetitionBoxes,
  spacedRepetitionOrder,
  setSpacedRepetitionOrder,
  spacedRepetitionPageSize,
  setSpacedRepetitionPageSize,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
}: SrToolsPanelProps) => (
  <section className="panel sr-tools-panel">
    {isCollapsible && onToggleCollapse && controlsId ? (
      <CollapsiblePanelHeader
        title="Spaced Repetition"
        isCollapsed={isCollapsed}
        onToggle={onToggleCollapse}
        controlsId={controlsId}
      />
    ) : (
      <div className="panel-header">
        <div>
          <h2>Spaced Repetition</h2>
        </div>
      </div>
    )}
    <div
      className="panel-body"
      id={controlsId}
      hidden={Boolean(isCollapsible && isCollapsed)}
      aria-hidden={Boolean(isCollapsible && isCollapsed)}
    >
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
