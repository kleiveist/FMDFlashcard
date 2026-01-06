import { type ThemeMode } from "../../lib/theme";

type AppearanceSectionProps = {
  accentColor: string;
  accentDraft: string;
  accentError: string;
  editorExactColors: boolean;
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: "light" | "medium" | "strong";
  onAccentInputChange: (value: string) => void;
  onAccentPick: (value: string) => void;
  onCopyAccent: () => void;
  onEditorExactColorsToggle: (value: boolean) => void;
  onEditorBlueprintGridToggle: (value: boolean) => void;
  onEditorBlueprintGridIntensityChange: (
    value: "light" | "medium" | "strong",
  ) => void;
  onThemeToggle: (nextTheme: ThemeMode) => void;
  theme: ThemeMode;
};

const ACCENT_PALETTE = [
  "#E07A5F",
  "#2F8F83",
  "#3A7D44",
  "#3B82F6",
  "#D97706",
  "#DC2626",
];
const GRID_INTENSITY_OPTIONS: Array<"light" | "medium" | "strong"> = [
  "light",
  "medium",
  "strong",
];

export const AppearanceSection = ({
  accentColor,
  accentDraft,
  accentError,
  editorExactColors,
  editorBlueprintGrid,
  editorBlueprintGridIntensity,
  onAccentInputChange,
  onAccentPick,
  onCopyAccent,
  onEditorExactColorsToggle,
  onEditorBlueprintGridToggle,
  onEditorBlueprintGridIntensityChange,
  onThemeToggle,
  theme,
}: AppearanceSectionProps) => (
  <section className="panel appearance-panel">
    <h2>Appearance</h2>
    <p className="muted">
      Theme und Akzentfarbe praegen die Oberflaeche und bleiben gespeichert.
    </p>
    <div className="appearance-layout">
      <div className="appearance-main">
        <div className="setting-row">
          <span className="label">Theme</span>
          <div className="theme-toggle">
            <span className="toggle-label">Hell</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={(event) =>
                  onThemeToggle(event.target.checked ? "dark" : "light")
                }
                aria-label="Theme umschalten"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">Dunkel</span>
          </div>
          <span className="helper-text">
            Wechselt Hintergrund, Kontrast und Panels.
          </span>
        </div>
        <div className="setting-row">
          <span className="label">Akzentfarbe</span>
          <div className="accent-controls">
            <input
              type="color"
              className="color-wheel"
              value={accentColor}
              onChange={(event) => onAccentPick(event.target.value)}
              aria-label="Akzentfarbe auswaehlen"
            />
            <div className="accent-palette">
              {ACCENT_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`accent-swatch ${
                    accentColor === color ? "active" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onAccentPick(color)}
                  aria-label={`Akzentfarbe ${color}`}
                />
              ))}
            </div>
          </div>
          <div className="accent-hex">
            <input
              type="text"
              className="hex-input"
              value={accentDraft}
              onChange={(event) => onAccentInputChange(event.target.value)}
              placeholder="#RRGGBB"
              aria-label="Akzentfarbe als HEX"
            />
            <button type="button" className="ghost small" onClick={onCopyAccent}>
              Kopieren
            </button>
          </div>
          <span className={`helper-text ${accentError ? "error-text" : ""}`}>
            {accentError || "HEX Wert der Akzentfarbe (#RRGGBB)."}
          </span>
        </div>
      </div>
      <div className="appearance-editor-panel">
        <header className="appearance-editor-header">
          <h3>Markdown Editor</h3>
        </header>
        <div className="setting-row">
          <span className="label">EXACT COLORS (MARKDOWN EDITOR)</span>
          <div className="theme-toggle">
            <span className="toggle-label">Off</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={editorExactColors}
                onChange={(event) =>
                  onEditorExactColorsToggle(event.target.checked)
                }
                aria-label="Exact markdown editor colors"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">On</span>
          </div>
        </div>
        <div className="setting-row">
          <span className="label">BLUEPRINT GRID (MARKDOWN EDITOR)</span>
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
