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

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidHex, normalizeHex } from "../../lib/color";
import { ModalShell } from "../ModalShell";

type AccentMode = "light" | "dark";

type MarkdownEditorSectionProps = {
  markdownEditorAccentEnabled: boolean;
  markdownEditorAccentLightHex: string;
  markdownEditorAccentDarkHex: string;
  markdownEditorAccentCustomSwatches: string[];
  editorBlueprintGrid: boolean;
  editorBlueprintGridIntensity: "light" | "medium" | "strong";
  markdownViewEditEnabled: boolean;
  markdownPreviewDefaultMode: "markdown" | "raw";
  onMarkdownEditorAccentEnabledToggle: (value: boolean) => void;
  onMarkdownEditorAccentHexChange: (mode: AccentMode, value: string) => void;
  onMarkdownEditorAccentCustomSwatchAdd: (value: string) => void;
  onEditorBlueprintGridToggle: (value: boolean) => void;
  onEditorBlueprintGridIntensityChange: (
    value: "light" | "medium" | "strong",
  ) => void;
  onMarkdownViewEditToggle: (value: boolean) => void;
  onMarkdownPreviewDefaultModeChange: (value: "markdown" | "raw") => void;
};

type ExamEditorSectionProps = {
  examEditorShowMoveButtons: boolean;
  onExamEditorShowMoveButtonsToggle: (value: boolean) => void;
};

const GRID_INTENSITY_OPTIONS: Array<"light" | "medium" | "strong"> = [
  "light",
  "medium",
  "strong",
];

const ACCENT_MODE_OPTIONS: AccentMode[] = ["light", "dark"];

const MARKDOWN_EDITOR_PALETTE = [
  "#0F172A",
  "#1E293B",
  "#334155",
  "#475569",
  "#64748B",
  "#94A3B8",
  "#CBD5E1",
  "#E2E8F0",
  "#7F1D1D",
  "#991B1B",
  "#B91C1C",
  "#DC2626",
  "#EF4444",
  "#F87171",
  "#FCA5A5",
  "#FEE2E2",
  "#7C2D12",
  "#9A3412",
  "#C2410C",
  "#EA580C",
  "#F97316",
  "#FB923C",
  "#FDBA74",
  "#FFEDD5",
  "#713F12",
  "#854D0E",
  "#A16207",
  "#CA8A04",
  "#EAB308",
  "#FACC15",
  "#FDE047",
  "#FEF9C3",
  "#14532D",
  "#166534",
  "#15803D",
  "#16A34A",
  "#22C55E",
  "#4ADE80",
  "#86EFAC",
  "#DCFCE7",
  "#134E4A",
  "#115E59",
  "#0F766E",
  "#0D9488",
  "#14B8A6",
  "#2DD4BF",
  "#5EEAD4",
  "#CCFBF1",
  "#0C4A6E",
  "#075985",
  "#0369A1",
  "#0284C7",
  "#0EA5E9",
  "#38BDF8",
  "#7DD3FC",
  "#E0F2FE",
  "#312E81",
  "#3730A3",
  "#4F46E5",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#EC4899",
  "#F472B6",
];

export const ExamEditorSection = ({
  examEditorShowMoveButtons,
  onExamEditorShowMoveButtonsToggle,
}: ExamEditorSectionProps) => (
  <section className="panel editor-settings-panel">
    <div>
      <h2>Exam editor</h2>
      <p className="muted">Canvas controls and structure tools.</p>
    </div>
    <div className="editor-settings-grid">
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
    </div>
  </section>
);

export const MarkdownEditorSection = ({
  markdownEditorAccentEnabled,
  markdownEditorAccentLightHex,
  markdownEditorAccentDarkHex,
  markdownEditorAccentCustomSwatches,
  editorBlueprintGrid,
  editorBlueprintGridIntensity,
  markdownViewEditEnabled,
  markdownPreviewDefaultMode,
  onMarkdownEditorAccentEnabledToggle,
  onMarkdownEditorAccentHexChange,
  onMarkdownEditorAccentCustomSwatchAdd,
  onEditorBlueprintGridToggle,
  onEditorBlueprintGridIntensityChange,
  onMarkdownViewEditToggle,
  onMarkdownPreviewDefaultModeChange,
}: MarkdownEditorSectionProps) => {
  const [accentMode, setAccentMode] = useState<AccentMode>("light");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
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
  const normalizedDraft = normalizeHex(activeDraft);
  const isDraftValid = isValidHex(normalizedDraft);
  const canAddCustom =
    markdownEditorAccentEnabled &&
    isDraftValid &&
    !markdownEditorAccentCustomSwatches.includes(normalizedDraft);
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
      setIsPaletteOpen(false);
    },
    [accentMode, onMarkdownEditorAccentHexChange],
  );

  const handleAddCustomSwatch = useCallback(() => {
    if (!isDraftValid) {
      return;
    }
    onMarkdownEditorAccentCustomSwatchAdd(normalizedDraft);
  }, [isDraftValid, normalizedDraft, onMarkdownEditorAccentCustomSwatchAdd]);

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
    if (!markdownEditorAccentEnabled) {
      setIsPaletteOpen(false);
    }
  }, [markdownEditorAccentEnabled]);

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
        <h2>Markdown editor</h2>
        <p className="muted">Tune editor colors and grid helpers.</p>
      </div>
      <div className="editor-settings-grid">
        <div className="editor-settings-block">
          <h3>Accent &amp; grid</h3>
          <p className="muted">Custom colors and blueprint helpers.</p>
          <div className="setting-row">
            <span className="label">ACCENT COLOR (MARKDOWN EDITOR)</span>
            <div className="markdown-accent-controls">
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
                        className={`pill pill-button ${
                          accentMode === mode ? "active" : ""
                        }`}
                        aria-pressed={accentMode === mode}
                        onClick={() => setAccentMode(mode)}
                      >
                        {mode === "dark" ? "Dark" : "Light"}
                      </button>
                    ))}
                  </div>
                  <div className="markdown-accent-row">
                    <button
                      type="button"
                      className="markdown-accent-preview markdown-accent-trigger"
                      style={{ backgroundColor: activeAccentHex }}
                      onClick={() => setIsPaletteOpen(true)}
                      aria-label="Open accent palette"
                      aria-expanded={isPaletteOpen}
                    />
                    <input
                      type="text"
                      className="hex-input"
                      value={activeDraft}
                      onChange={(event) => handleAccentInputChange(event.target.value)}
                      aria-label={`Accent hex for ${accentMode} mode`}
                    />
                    <button
                      type="button"
                      className="ghost small"
                      onClick={handleCopy}
                    >
                      {isCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <span
                    className={`helper-text ${activeError ? "error-text" : ""}`}
                  >
                    {activeError || "HEX value of the accent color (#RRGGBB)."}
                  </span>
                  <ModalShell
                    isOpen={isPaletteOpen}
                    title="Markdown editor palette"
                    onClose={() => setIsPaletteOpen(false)}
                    className="markdown-accent-modal"
                    bodyClassName="hub-modal-scroll markdown-accent-modal-body"
                  >
                    <div className="markdown-accent-picker">
                      <div className="markdown-accent-grid">
                        {MARKDOWN_EDITOR_PALETTE.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`markdown-accent-swatch ${
                              activeAccentHex === color ? "active" : ""
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => handleAccentPick(color)}
                            aria-label={`Accent color ${color}`}
                          />
                        ))}
                      </div>
                      <div className="markdown-accent-custom">
                        <div className="markdown-accent-custom-header">
                          <span className="muted">Custom</span>
                          <button
                            type="button"
                            className="ghost small"
                            onClick={handleAddCustomSwatch}
                            disabled={!canAddCustom}
                            aria-label="Add custom color"
                          >
                            +
                          </button>
                        </div>
                        <div className="markdown-accent-custom-swatches">
                          {markdownEditorAccentCustomSwatches.length === 0 ? (
                            <span className="muted">No custom colors yet.</span>
                          ) : (
                            markdownEditorAccentCustomSwatches.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`markdown-accent-swatch ${
                                  activeAccentHex === color ? "active" : ""
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => handleAccentPick(color)}
                                aria-label={`Custom accent color ${color}`}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </ModalShell>
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
          <div className="setting-row">
            <span className="label">Markdown view edit (experimental)</span>
            <div className="theme-toggle">
              <span className="toggle-label">Off</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={markdownViewEditEnabled}
                  onChange={(event) =>
                    onMarkdownViewEditToggle(event.target.checked)
                  }
                  aria-label="Enable markdown view editing (experimental)"
                />
                <span className="slider" />
              </label>
              <span className="toggle-label">On</span>
            </div>
          </div>
          {markdownViewEditEnabled ? (
            <span className="helper-text">
              Experimental: Markdown view editing may rewrite formatting. Prefer Raw
              text for safe editing.
            </span>
          ) : null}
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
                Markdown
              </button>
              <button
                type="button"
                className={`pill pill-button ${
                  markdownPreviewDefaultMode === "raw" ? "active" : ""
                }`}
                aria-pressed={markdownPreviewDefaultMode === "raw"}
                onClick={() => onMarkdownPreviewDefaultModeChange("raw")}
              >
                Rohtext
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
