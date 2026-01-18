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
 * - MarkdownEditorSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

type MarkdownEditorSectionProps = {
  examEditorShowMoveButtons: boolean;
  editorExactColors: boolean;
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: "light" | "medium" | "strong";
  onExamEditorShowMoveButtonsToggle: (value: boolean) => void;
  onEditorExactColorsToggle: (value: boolean) => void;
  onEditorBlueprintGridToggle: (value: boolean) => void;
  onEditorBlueprintGridIntensityChange: (
    value: "light" | "medium" | "strong",
  ) => void;
};

const GRID_INTENSITY_OPTIONS: Array<"light" | "medium" | "strong"> = [
  "light",
  "medium",
  "strong",
];

export const MarkdownEditorSection = ({
  examEditorShowMoveButtons,
  editorExactColors,
  editorBlueprintGrid,
  editorBlueprintGridIntensity,
  onExamEditorShowMoveButtonsToggle,
  onEditorExactColorsToggle,
  onEditorBlueprintGridToggle,
  onEditorBlueprintGridIntensityChange,
}: MarkdownEditorSectionProps) => (
  <section className="panel editor-settings-panel">
    <div>
      <h2>Editor Settings</h2>
      <p className="muted">Tune exam and markdown editor behavior.</p>
    </div>
    <div className="editor-settings-grid">
      <div className="editor-settings-block">
        <h3>Exam editor</h3>
        <p className="muted">Canvas controls and structure tools.</p>
        <div className="setting-row">
          <span className="label">Show Up/Down buttons</span>
          <div className="theme-toggle">
            <span className="toggle-label">Off</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={examEditorShowMoveButtons}
                onChange={(event) =>
                  onExamEditorShowMoveButtonsToggle(event.target.checked)
                }
                aria-label="Show Up/Down move buttons in exam editor"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">On</span>
          </div>
        </div>
      </div>
      <div className="editor-settings-block">
        <h3>Markdown editor</h3>
        <p className="muted">Tune editor colors and grid helpers.</p>
        <div className="setting-row">
          <span className="label">Exact colors (markdown editor)</span>
          <div className="theme-toggle">
            <span className="toggle-label">Off</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={editorExactColors}
                onChange={(event) => onEditorExactColorsToggle(event.target.checked)}
                aria-label="Exact markdown editor colors"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">On</span>
          </div>
        </div>
        <div className="setting-row">
          <span className="label">Blueprint grid (markdown editor)</span>
          <div className="appearance-editor-inline">
            <div className="theme-toggle">
              <span className="toggle-label">Off</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={editorBlueprintGrid}
                  onChange={(event) =>
                    onEditorBlueprintGridToggle(event.target.checked)
                  }
                  aria-label="Blueprint grid for markdown editor"
                />
                <span className="slider" />
              </label>
              <span className="toggle-label">On</span>
            </div>
            <div className="appearance-grid-intensity">
              <span className="toggle-label">Intensity</span>
              <div className="pill-grid">
                {GRID_INTENSITY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`pill pill-button ${
                      editorBlueprintGridIntensity === option ? "active" : ""
                    }`}
                    aria-pressed={editorBlueprintGridIntensity === option}
                    onClick={() => onEditorBlueprintGridIntensityChange(option)}
                  >
                    {option.charAt(0).toUpperCase()}
                    {option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
