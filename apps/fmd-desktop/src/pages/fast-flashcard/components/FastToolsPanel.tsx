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
    setFastFlashcardOrder: (value: FlashcardOrder) => void;
    setFastFlashcardMode: (value: FlashcardMode) => void;
    setFastFlashcardScope: (value: FlashcardScope) => void;
  };
  selectedDuration: number;
  setSelectedDuration: (value: number) => void;
  isTimeModeEnabled: boolean;
};

export const FastToolsPanel = ({
  fastFlashcards,
  settings,
  selectedDuration,
  setSelectedDuration,
  isTimeModeEnabled,
}: FastToolsPanelProps) => (
  <section className="panel fast-tools-panel">
    <div className="panel-header">
      <div>
        <h2>Fast Flashcard Tools</h2>
        <p className="muted">Scan current notes for cards.</p>
      </div>
    </div>
    <div className="panel-body">
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
            {FAST_FLASHCARD_DURATIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                className={`pill pill-button ${
                  selectedDuration === duration ? "active" : ""
                }`}
                aria-pressed={selectedDuration === duration}
                disabled={isTimeModeEnabled}
                title={isTimeModeEnabled ? "Stop timer to change duration" : undefined}
                onClick={() => setSelectedDuration(duration)}
              >
                {duration}s
              </button>
            ))}
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
