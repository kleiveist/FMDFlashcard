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

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidHex, normalizeHex } from "../../lib/color";
import { ACCENT_PALETTE } from "./accentPalette";

type MarkdownEditorSectionProps = {
  accentColor: string;
  examEditorShowMoveButtons: boolean;
  markdownEditorExactColorsEnabled: boolean;
  markdownEditorCustomAccentHex: string | null;
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: "light" | "medium" | "strong";
  onExamEditorShowMoveButtonsToggle: (value: boolean) => void;
  onMarkdownEditorExactColorsToggle: (value: boolean) => void;
  onMarkdownEditorAccentPick: (value: string) => void;
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
  accentColor,
  examEditorShowMoveButtons,
  markdownEditorExactColorsEnabled,
  markdownEditorCustomAccentHex,
  editorBlueprintGrid,
  editorBlueprintGridIntensity,
  onExamEditorShowMoveButtonsToggle,
  onMarkdownEditorExactColorsToggle,
  onMarkdownEditorAccentPick,
  onEditorBlueprintGridToggle,
  onEditorBlueprintGridIntensityChange,
}: MarkdownEditorSectionProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const normalizedCustom = markdownEditorCustomAccentHex
    ? normalizeHex(markdownEditorCustomAccentHex)
    : "";
  const hasValidCustom = isValidHex(normalizedCustom);
  const effectiveAccentHex =
    markdownEditorExactColorsEnabled && hasValidCustom
      ? normalizedCustom
      : accentColor;

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(effectiveAccentHex);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = effectiveAccentHex;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy markdown editor accent", error);
    }
  }, [effectiveAccentHex]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
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
            <span className="label">EXACT COLORS (MARKDOWN EDITOR)</span>
            <div className="theme-toggle">
              <span className="toggle-label">Off</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={markdownEditorExactColorsEnabled}
                  onChange={(event) =>
                    onMarkdownEditorExactColorsToggle(event.target.checked)
                  }
                  aria-label="Exact markdown editor colors"
                />
                <span className="slider" />
              </label>
              <span className="toggle-label">On</span>
            </div>
            {!markdownEditorExactColorsEnabled ? (
              <span className="helper-text">
                Uses the app Accent Color automatically (adapts to light/dark).
              </span>
            ) : null}
          </div>
          {markdownEditorExactColorsEnabled ? (
            <div className="setting-row">
              <span className="label">Accent color (Markdown editor)</span>
              <div className="accent-controls">
                <div className="accent-palette">
                  {ACCENT_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`accent-swatch ${
                        effectiveAccentHex === color ? "active" : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => onMarkdownEditorAccentPick(color)}
                      aria-label={`Accent color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="accent-hex">
                <input
                  type="text"
                  className="hex-input"
                  value={effectiveAccentHex}
                  readOnly
                  aria-label="Accent color for markdown editor as hex"
                />
                <button
                  type="button"
                  className="ghost small"
                  onClick={handleCopy}
                >
                  {isCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <span className="helper-text">
                HEX value of the accent color (#RRGGBB).
              </span>
            </div>
          ) : null}
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
};
