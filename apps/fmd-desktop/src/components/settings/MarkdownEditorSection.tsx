/**
 * @file apps/fmd-desktop/src/components/settings/MarkdownEditorSection.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente fuer Markdown-Editor-Settings.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur fuer Editor-Settings auf.
 * - Verdrahtet Props und Callbacks mit Controls.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - ExamEditorSection: React-Komponente.
 * - MarkdownEditorSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

type MarkdownEditorSectionProps = {
  cursorAccessoryEnabled: boolean;
  markdownPreviewDefaultMode: "markdown" | "raw" | "hybrid";
  markdownEditorOpenInNewTabByDefault: boolean;
  onCursorAccessoryEnabledToggle: (value: boolean) => void;
  onMarkdownPreviewDefaultModeChange: (value: "markdown" | "raw" | "hybrid") => void;
  onMarkdownEditorOpenInNewTabByDefaultToggle: (value: boolean) => void;
};

type ExamEditorSectionProps = {
  examEditorShowMoveButtons: boolean;
  onExamEditorShowMoveButtonsToggle: (value: boolean) => void;
};

export const ExamEditorSection = ({
  examEditorShowMoveButtons,
  onExamEditorShowMoveButtonsToggle,
}: ExamEditorSectionProps) => (
  <div className="editor-settings-block">
    <h3>Move buttons</h3>
    <p className="muted">Quick controls for moving content blocks.</p>
    <div className="setting-row">
      <span className="label">Show Up/Down buttons</span>
      <div className="theme-toggle">
        <span className="toggle-label">Off</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={examEditorShowMoveButtons}
            onChange={(event) => onExamEditorShowMoveButtonsToggle(event.target.checked)}
            aria-label="Show Up/Down move buttons in exam editor"
          />
          <span className="slider" />
        </label>
        <span className="toggle-label">On</span>
      </div>
    </div>
  </div>
);

export const MarkdownEditorSection = ({
  cursorAccessoryEnabled,
  markdownPreviewDefaultMode,
  markdownEditorOpenInNewTabByDefault,
  onCursorAccessoryEnabledToggle,
  onMarkdownPreviewDefaultModeChange,
  onMarkdownEditorOpenInNewTabByDefaultToggle,
}: MarkdownEditorSectionProps) => (
  <div className="editor-settings-block">
    <h3>Markdown editor</h3>
    <p className="muted">Behavior and defaults for markdown editing.</p>
    <div className="setting-row">
      <span className="label">Backspace-Hilfstaste anzeigen</span>
      <div className="setting-subrow">
        <div className="theme-toggle">
          <span className="toggle-label">Off</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={cursorAccessoryEnabled}
              onChange={(event) => onCursorAccessoryEnabledToggle(event.target.checked)}
              aria-label="Backspace-Hilfstaste anzeigen"
            />
            <span className="slider" />
          </label>
          <span className="toggle-label">On</span>
        </div>
        <span className="helper-text">
          Zeigt bei kleinen Bildschirmbreiten eine zusaetzliche Backspace-
          Hilfstaste an, sobald ein Textfeld aktiv ist.
        </span>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Default preview mode</span>
      <div className="pill-grid" role="tablist" aria-label="Default preview mode">
        <button
          type="button"
          className={`pill pill-button ${
            markdownPreviewDefaultMode === "markdown" ? "active" : ""
          }`}
          aria-pressed={markdownPreviewDefaultMode === "markdown"}
          onClick={() => onMarkdownPreviewDefaultModeChange("markdown")}
        >
          Markdown-View
        </button>
        <button
          type="button"
          className={`pill pill-button ${
            markdownPreviewDefaultMode === "raw" ? "active" : ""
          }`}
          aria-pressed={markdownPreviewDefaultMode === "raw"}
          onClick={() => onMarkdownPreviewDefaultModeChange("raw")}
        >
          Markdown-Code
        </button>
        <button
          type="button"
          className={`pill pill-button ${
            markdownPreviewDefaultMode === "hybrid" ? "active" : ""
          }`}
          aria-pressed={markdownPreviewDefaultMode === "hybrid"}
          onClick={() => onMarkdownPreviewDefaultModeChange("hybrid")}
        >
          Markdown-Hybridblock
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Immer in neuem Tab oeffnen</span>
      <div className="setting-subrow">
        <div className="theme-toggle">
          <span className="toggle-label">Off</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={markdownEditorOpenInNewTabByDefault}
              onChange={(event) =>
                onMarkdownEditorOpenInNewTabByDefaultToggle(event.target.checked)
              }
              aria-label="Immer in neuem Tab oeffnen"
            />
            <span className="slider" />
          </label>
          <span className="toggle-label">On</span>
        </div>
        <span className="helper-text">
          Wenn aktiv, oeffnen Markdown-Dateien standardmaessig in neuen Tabs.
        </span>
      </div>
    </div>
  </div>
);
