/**
 * @file apps/fmd-desktop/src/components/settings/EditorAccentSettingsBlock.tsx
 *
 * Zweck:
 * - Rendert den Bereich fuer Editor-Akzent und Blueprint-Grid.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidHex, normalizeHex } from "../../lib/color";

type AccentMode = "light" | "dark";

type EditorAccentSettingsBlockProps = {
  markdownEditorAccentEnabled: boolean;
  markdownEditorAccentLightHex: string;
  markdownEditorAccentDarkHex: string;
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: "light" | "medium" | "strong";
  onMarkdownEditorAccentEnabledToggle: (value: boolean) => void;
  onMarkdownEditorAccentHexChange: (mode: AccentMode, value: string) => void;
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

const ACCENT_MODE_OPTIONS: AccentMode[] = ["light", "dark"];

export const EditorAccentSettingsBlock = ({
  markdownEditorAccentEnabled,
  markdownEditorAccentLightHex,
  markdownEditorAccentDarkHex,
  editorBlueprintGrid,
  editorBlueprintGridIntensity,
  onMarkdownEditorAccentEnabledToggle,
  onMarkdownEditorAccentHexChange,
  onEditorBlueprintGridToggle,
  onEditorBlueprintGridIntensityChange,
}: EditorAccentSettingsBlockProps) => {
  const [accentMode, setAccentMode] = useState<AccentMode>("light");
  const [isCopied, setIsCopied] = useState(false);
  const [accentDrafts, setAccentDrafts] = useState<Record<AccentMode, string>>({
    light: markdownEditorAccentLightHex,
    dark: markdownEditorAccentDarkHex,
  });
  const [accentErrors, setAccentErrors] = useState<Record<AccentMode, string>>({
    light: "",
    dark: "",
  });
  const copyTimeoutRef = useRef<number | null>(null);
  const activeAccentHex =
    accentMode === "dark"
      ? markdownEditorAccentDarkHex
      : markdownEditorAccentLightHex;
  const activeDraft = accentDrafts[accentMode] ?? activeAccentHex;
  const activeError = accentErrors[accentMode];

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeAccentHex);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = activeAccentHex;
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
  }, [activeAccentHex]);

  const handleAccentInputChange = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value);
      setAccentDrafts((prev) => ({ ...prev, [accentMode]: normalized }));
      if (!normalized) {
        setAccentErrors((prev) => ({ ...prev, [accentMode]: "" }));
        return;
      }
      if (isValidHex(normalized)) {
        setAccentErrors((prev) => ({ ...prev, [accentMode]: "" }));
        onMarkdownEditorAccentHexChange(accentMode, normalized);
      } else {
        setAccentErrors((prev) => ({
          ...prev,
          [accentMode]: "HEX must be #RRGGBB.",
        }));
      }
    },
    [accentMode, onMarkdownEditorAccentHexChange],
  );

  const handleAccentPick = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value);
      if (!isValidHex(normalized)) {
        return;
      }
      setAccentDrafts((prev) => ({ ...prev, [accentMode]: normalized }));
      setAccentErrors((prev) => ({ ...prev, [accentMode]: "" }));
      onMarkdownEditorAccentHexChange(accentMode, normalized);
    },
    [accentMode, onMarkdownEditorAccentHexChange],
  );

  useEffect(() => {
    setAccentDrafts((prev) => ({
      ...prev,
      light: markdownEditorAccentLightHex,
    }));
  }, [markdownEditorAccentLightHex]);

  useEffect(() => {
    setAccentDrafts((prev) => ({
      ...prev,
      dark: markdownEditorAccentDarkHex,
    }));
  }, [markdownEditorAccentDarkHex]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="editor-settings-block">
      <h3>Accent Editor</h3>
      <p className="muted">Custom colors and blueprint helpers.</p>
      <div className="setting-row">
        <span className="label">ACCENT COLOR (MARKDOWN EDITOR)</span>
        <div className="setting-subrow">
          <div className="theme-toggle">
            <span className="toggle-label">Off</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={markdownEditorAccentEnabled}
                onChange={(event) =>
                  onMarkdownEditorAccentEnabledToggle(event.target.checked)
                }
                aria-label="Enable custom markdown editor accent colors"
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">On</span>
          </div>
          {markdownEditorAccentEnabled ? (
            <>
              <div
                className="pill-grid"
                role="tablist"
                aria-label="Markdown editor accent mode"
              >
                {ACCENT_MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`pill pill-button ${accentMode === mode ? "active" : ""}`}
                    aria-pressed={accentMode === mode}
                    onClick={() => setAccentMode(mode)}
                  >
                    {mode === "dark" ? "Dark" : "Light"}
                  </button>
                ))}
              </div>
              <div className="accent-hex">
                <input
                  type="color"
                  className="color-wheel"
                  value={activeAccentHex}
                  onChange={(event) => handleAccentPick(event.target.value)}
                  aria-label={`Select markdown editor accent color for ${accentMode} mode`}
                />
                <input
                  type="text"
                  className="hex-input"
                  value={activeDraft}
                  onChange={(event) => handleAccentInputChange(event.target.value)}
                  aria-label={`Accent hex for ${accentMode} mode`}
                />
                <button type="button" className="ghost small" onClick={handleCopy}>
                  {isCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <span className={`helper-text ${activeError ? "error-text" : ""}`}>
                {activeError || "HEX value of the accent color (#RRGGBB)."}
              </span>
            </>
          ) : (
            <span className="helper-text">
              Uses the app Accent Color from Appearance.
            </span>
          )}
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
                onChange={(event) => onEditorBlueprintGridToggle(event.target.checked)}
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
  );
};
