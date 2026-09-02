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
  type SpacedRepetitionPageSize,
} from "../../../features/spaced-repetition/useSpacedRepetition";
import { CollapsiblePanelHeader } from "../../../components/CollapsiblePanelHeader";
import { type FlashcardMode } from "../../../features/flashcards/useFlashcards";

type SrToolsPanelProps = {
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
  flashcardFilterMode: FlashcardMode;
  setFlashcardFilterMode: (value: FlashcardMode) => void;
  autoTimeEnabled: boolean;
  setAutoTimeEnabled: (value: boolean) => void;
  statusLabel?: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
};

export const SrToolsPanel = ({
  spacedRepetitionBoxes,
  setSpacedRepetitionBoxes,
  spacedRepetitionPageSize,
  setSpacedRepetitionPageSize,
  flashcardFilterMode,
  setFlashcardFilterMode,
  autoTimeEnabled,
  setAutoTimeEnabled,
  statusLabel,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
}: SrToolsPanelProps) => (
  <section className="panel sr-tools-panel">
    {isCollapsible && onToggleCollapse && controlsId ? (
      <CollapsiblePanelHeader
        title="Spaced Repetition"
        description={statusLabel}
        isCollapsed={isCollapsed}
        onToggle={onToggleCollapse}
        controlsId={controlsId}
      />
    ) : (
      <div className="panel-header">
        <div>
          <h2>Spaced Repetition</h2>
          {statusLabel ? <p className="muted">{statusLabel}</p> : null}
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
        <span className="label">MODE</span>
        <select
          className="text-input"
          value={flashcardFilterMode}
          onChange={(event) => setFlashcardFilterMode(event.target.value as FlashcardMode)}
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
        <span className="label">Auto Time</span>
        <div className="setting-inline">
          <button
            type="button"
            className={`pill pill-button ${autoTimeEnabled ? "active" : ""}`}
            aria-pressed={autoTimeEnabled}
            onClick={() => setAutoTimeEnabled(!autoTimeEnabled)}
          >
            Auto Time
          </button>
        </div>
      </div>
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
        <span className="label">Page size</span>
        <div className="pill-grid">
          {SPACED_REPETITION_PAGE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`pill pill-button ${spacedRepetitionPageSize === size ? "active" : ""}`}
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
