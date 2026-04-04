/**
 * @file apps/fmd-desktop/src/components/settings/AppearanceSection.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Appearance Section.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/theme.ts: Typen.
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - AppearanceSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useState } from "react";
import { type DesignMode, type ThemeMode } from "../../lib/theme";
import { ACCENT_PALETTE } from "./accentPalette";
import { EditorAccentSettingsBlock } from "./EditorAccentSettingsBlock";

type AppearanceTabId = "appearance" | "editor-accent";

type AppearanceSectionProps = {
  accentColor: string;
  accentDraft: string;
  accentError: string;
  onAccentInputChange: (value: string) => void;
  onAccentPick: (value: string) => void;
  onCopyAccent: () => void;
  markdownEditorAccentEnabled: boolean;
  markdownEditorAccentLightHex: string;
  markdownEditorAccentDarkHex: string;
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: "light" | "medium" | "strong";
  onMarkdownEditorAccentEnabledToggle: (value: boolean) => void;
  onMarkdownEditorAccentHexChange: (
    mode: "light" | "dark",
    value: string,
  ) => void;
  onEditorBlueprintGridToggle: (value: boolean) => void;
  onEditorBlueprintGridIntensityChange: (
    value: "light" | "medium" | "strong",
  ) => void;
  onDesignModeChange: (nextMode: DesignMode) => void;
  onThemeToggle: (nextTheme: ThemeMode) => void;
  designMode: DesignMode;
  theme: ThemeMode;
};

export const AppearanceSection = ({
  accentColor,
  accentDraft,
  accentError,
  onAccentInputChange,
  onAccentPick,
  onCopyAccent,
  markdownEditorAccentEnabled,
  markdownEditorAccentLightHex,
  markdownEditorAccentDarkHex,
  editorBlueprintGrid,
  editorBlueprintGridIntensity,
  onMarkdownEditorAccentEnabledToggle,
  onMarkdownEditorAccentHexChange,
  onEditorBlueprintGridToggle,
  onEditorBlueprintGridIntensityChange,
  onDesignModeChange,
  onThemeToggle,
  designMode,
  theme,
}: AppearanceSectionProps) => {
  const [activeTab, setActiveTab] = useState<AppearanceTabId>("appearance");
  const appearanceTabId = "settings-appearance-tab-appearance";
  const editorAccentTabId = "settings-appearance-tab-editor-accent";
  const appearancePanelId = "settings-appearance-panel-appearance";
  const editorAccentPanelId = "settings-appearance-panel-editor-accent";

  return (
    <div className="appearance-settings-hub">
      <div className="settings-tabs" role="tablist" aria-label="Appearance pages">
        <button
          type="button"
          className={`pill pill-button ${activeTab === "appearance" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "appearance"}
          aria-current={activeTab === "appearance" ? "page" : undefined}
          aria-controls={appearancePanelId}
          id={appearanceTabId}
          onClick={() => setActiveTab("appearance")}
        >
          Appearance
        </button>
        <button
          type="button"
          className={`pill pill-button ${
            activeTab === "editor-accent" ? "active" : ""
          }`}
          role="tab"
          aria-selected={activeTab === "editor-accent"}
          aria-current={activeTab === "editor-accent" ? "page" : undefined}
          aria-controls={editorAccentPanelId}
          id={editorAccentTabId}
          onClick={() => setActiveTab("editor-accent")}
        >
          Accent Editor
        </button>
      </div>
      <div className="settings-tab-content">
        <div
          id={appearancePanelId}
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby={appearanceTabId}
          hidden={activeTab !== "appearance"}
        >
          <section className="panel appearance-panel">
            <div className="panel-header">
              <div>
                <h2>Appearance</h2>
                <p className="muted">
                  Theme, Designmodus und Akzentfarbe praegen die Oberflaeche und bleiben
                  gespeichert.
                </p>
              </div>
            </div>
            <div className="panel-body">
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
                  <span className="label">Designmodus</span>
                  <div
                    className="design-mode-toggle"
                    role="radiogroup"
                    aria-label="Designmodus auswaehlen"
                  >
                    <button
                      type="button"
                      className={`design-mode-option ${
                        designMode === "smart" ? "active" : ""
                      }`}
                      onClick={() => onDesignModeChange("smart")}
                      aria-pressed={designMode === "smart"}
                    >
                      Smart Design
                    </button>
                    <button
                      type="button"
                      className={`design-mode-option ${
                        designMode === "modern" ? "active" : ""
                      }`}
                      onClick={() => onDesignModeChange("modern")}
                      aria-pressed={designMode === "modern"}
                    >
                      Modern Design
                    </button>
                    <button
                      type="button"
                      className={`design-mode-option ${designMode === "edge" ? "active" : ""}`}
                      onClick={() => onDesignModeChange("edge")}
                      aria-pressed={designMode === "edge"}
                    >
                      Edge Design
                    </button>
                  </div>
                  <span className="helper-text">
                    Steuert Form, Dichte, Navigation und Flaechenstil app-weit.
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
                          className={`accent-swatch ${accentColor === color ? "active" : ""}`}
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
            </div>
          </section>
        </div>
        <div
          id={editorAccentPanelId}
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby={editorAccentTabId}
          hidden={activeTab !== "editor-accent"}
        >
          <EditorAccentSettingsBlock
            markdownEditorAccentEnabled={markdownEditorAccentEnabled}
            markdownEditorAccentLightHex={markdownEditorAccentLightHex}
            markdownEditorAccentDarkHex={markdownEditorAccentDarkHex}
            editorBlueprintGrid={editorBlueprintGrid}
            editorBlueprintGridIntensity={editorBlueprintGridIntensity}
            onMarkdownEditorAccentEnabledToggle={
              onMarkdownEditorAccentEnabledToggle
            }
            onMarkdownEditorAccentHexChange={onMarkdownEditorAccentHexChange}
            onEditorBlueprintGridToggle={onEditorBlueprintGridToggle}
            onEditorBlueprintGridIntensityChange={
              onEditorBlueprintGridIntensityChange
            }
          />
        </div>
      </div>
    </div>
  );
};
