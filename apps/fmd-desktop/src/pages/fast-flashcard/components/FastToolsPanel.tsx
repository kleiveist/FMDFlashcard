/**
 * @file apps/fmd-desktop/src/pages/fast-flashcard/components/FastToolsPanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Fast Tools Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/settings/FastFlashcardToolsSettings.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/features/fast-flashcard/constants.ts: Feature-Logik oder Hook.
 *
 * Exportiert:
 * - FastToolsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { FastFlashcardToolsSettings } from "../../../components/settings/FastFlashcardToolsSettings";
import { CollapsiblePanelHeader } from "../../../components/CollapsiblePanelHeader";
import { FAST_FLASHCARD_DURATIONS } from "../../../features/fast-flashcard/constants";
import type {
  FlashcardMode,
  FlashcardOrder,
  FlashcardScope,
} from "../../../features/flashcards/useFlashcards";

type FastToolsPanelProps = {
  fastFlashcards: {
    handleFlashcardScan: () => void;
    isFlashcardScanning: boolean;
  };
  settings: {
    fastFlashcardOrder: FlashcardOrder;
    fastFlashcardMode: FlashcardMode;
    fastFlashcardScope: FlashcardScope;
    fastFlashcardAutoTimeEnabled: boolean;
    setFastFlashcardOrder: (value: FlashcardOrder) => void;
    setFastFlashcardMode: (value: FlashcardMode) => void;
    setFastFlashcardScope: (value: FlashcardScope) => void;
    setFastFlashcardAutoTimeEnabled: (value: boolean) => void;
  };
  selectedDuration: number;
  setSelectedDuration: (value: number) => void;
  isTimeModeEnabled: boolean;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
};

export const FastToolsPanel = ({
  fastFlashcards,
  settings,
  selectedDuration,
  setSelectedDuration,
  isTimeModeEnabled,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
}: FastToolsPanelProps) => (
  <section className="panel fast-tools-panel">
    {isCollapsible && onToggleCollapse && controlsId ? (
      <CollapsiblePanelHeader
        title="Fast Flashcard Tools"
        description="Scan current notes for cards."
        isCollapsed={isCollapsed}
        onToggle={onToggleCollapse}
        controlsId={controlsId}
      />
    ) : (
      <div className="panel-header">
        <div>
          <h2>Fast Flashcard Tools</h2>
          <p className="muted">Scan current notes for cards.</p>
        </div>
      </div>
    )}
    <div
      className="panel-body"
      id={controlsId}
      hidden={Boolean(isCollapsible && isCollapsed)}
      aria-hidden={Boolean(isCollapsible && isCollapsed)}
    >
      <button
        type="button"
        className="primary"
        onClick={fastFlashcards.handleFlashcardScan}
        disabled={fastFlashcards.isFlashcardScanning}
      >
        {fastFlashcards.isFlashcardScanning ? "Scanning..." : "Flashcard"}
      </button>
      <div className="flashcard-controls">
        <div className="toolbar-section">
          <span className="label">Duration</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                settings.fastFlashcardAutoTimeEnabled ? "active" : ""
              }`}
              aria-pressed={settings.fastFlashcardAutoTimeEnabled}
              disabled={isTimeModeEnabled}
              title={isTimeModeEnabled ? "Stop timer to change mode" : undefined}
              onClick={() =>
                settings.setFastFlashcardAutoTimeEnabled(!settings.fastFlashcardAutoTimeEnabled)
              }
            >
              Auto Time
            </button>
            {!settings.fastFlashcardAutoTimeEnabled
              ? FAST_FLASHCARD_DURATIONS.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    className={`pill pill-button ${selectedDuration === duration ? "active" : ""}`}
                    aria-pressed={selectedDuration === duration}
                    disabled={isTimeModeEnabled}
                    title={isTimeModeEnabled ? "Stop timer to change duration" : undefined}
                    onClick={() => setSelectedDuration(duration)}
                  >
                    {duration}s
                  </button>
                ))
              : null}
          </div>
        </div>
        <FastFlashcardToolsSettings
          fastFlashcardOrder={settings.fastFlashcardOrder}
          fastFlashcardMode={settings.fastFlashcardMode}
          fastFlashcardScope={settings.fastFlashcardScope}
          setFastFlashcardOrder={settings.setFastFlashcardOrder}
          setFastFlashcardMode={settings.setFastFlashcardMode}
          setFastFlashcardScope={settings.setFastFlashcardScope}
        />
      </div>
    </div>
  </section>
);
