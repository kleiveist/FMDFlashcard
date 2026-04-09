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

import { type SettingsLanguage, tSettings } from "../../features/settings/settingsI18n";

type MarkdownEditorSectionProps = {
  language: SettingsLanguage;
  cursorAccessoryEnabled: boolean;
  markdownPreviewDefaultMode: "markdown" | "raw" | "hybrid";
  markdownEditorOpenInNewTabByDefault: boolean;
  onCursorAccessoryEnabledToggle: (value: boolean) => void;
  onMarkdownPreviewDefaultModeChange: (value: "markdown" | "raw" | "hybrid") => void;
  onMarkdownEditorOpenInNewTabByDefaultToggle: (value: boolean) => void;
};

type ExamEditorSectionProps = {
  language: SettingsLanguage;
  examEditorShowMoveButtons: boolean;
  onExamEditorShowMoveButtonsToggle: (value: boolean) => void;
};

export const ExamEditorSection = ({
  language,
  examEditorShowMoveButtons,
  onExamEditorShowMoveButtonsToggle,
}: ExamEditorSectionProps) => (
  <div className="editor-settings-block">
    <h3>{tSettings(language, "settings.examEditor.moveButtons")}</h3>
    <p className="muted">
      {tSettings(language, "settings.examEditor.moveButtons.description")}
    </p>
    <div className="setting-row">
      <span className="label">
        {tSettings(language, "settings.examEditor.showUpDownButtons")}
      </span>
      <div className="theme-toggle">
        <span className="toggle-label">{tSettings(language, "settings.common.off")}</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={examEditorShowMoveButtons}
            onChange={(event) => onExamEditorShowMoveButtonsToggle(event.target.checked)}
            aria-label="Show Up/Down move buttons in exam editor"
          />
          <span className="slider" />
        </label>
        <span className="toggle-label">{tSettings(language, "settings.common.on")}</span>
      </div>
    </div>
  </div>
);

export const MarkdownEditorSection = ({
  language,
  cursorAccessoryEnabled,
  markdownPreviewDefaultMode,
  markdownEditorOpenInNewTabByDefault,
  onCursorAccessoryEnabledToggle,
  onMarkdownPreviewDefaultModeChange,
  onMarkdownEditorOpenInNewTabByDefaultToggle,
}: MarkdownEditorSectionProps) => (
  <div className="editor-settings-block">
    <h3>{tSettings(language, "settings.markdownEditor.title")}</h3>
    <p className="muted">{tSettings(language, "settings.markdownEditor.description")}</p>
    <div className="setting-row">
      <span className="label">
        {tSettings(language, "settings.markdownEditor.backspaceAccessory")}
      </span>
      <div className="setting-subrow">
        <div className="theme-toggle">
          <span className="toggle-label">{tSettings(language, "settings.common.off")}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={cursorAccessoryEnabled}
              onChange={(event) => onCursorAccessoryEnabledToggle(event.target.checked)}
              aria-label="Backspace-Hilfstaste anzeigen"
            />
            <span className="slider" />
          </label>
          <span className="toggle-label">{tSettings(language, "settings.common.on")}</span>
        </div>
        <span className="helper-text">
          {tSettings(language, "settings.markdownEditor.backspaceAccessory.helper")}
        </span>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">
        {tSettings(language, "settings.markdownEditor.defaultPreviewMode")}
      </span>
      <div className="pill-grid" role="tablist" aria-label="Default preview mode">
        <button
          type="button"
          className={`pill pill-button ${
            markdownPreviewDefaultMode === "markdown" ? "active" : ""
          }`}
          aria-pressed={markdownPreviewDefaultMode === "markdown"}
          onClick={() => onMarkdownPreviewDefaultModeChange("markdown")}
        >
          {tSettings(language, "settings.markdownEditor.previewMode.markdown")}
        </button>
        <button
          type="button"
          className={`pill pill-button ${
            markdownPreviewDefaultMode === "raw" ? "active" : ""
          }`}
          aria-pressed={markdownPreviewDefaultMode === "raw"}
          onClick={() => onMarkdownPreviewDefaultModeChange("raw")}
        >
          {tSettings(language, "settings.markdownEditor.previewMode.raw")}
        </button>
        <button
          type="button"
          className={`pill pill-button ${
            markdownPreviewDefaultMode === "hybrid" ? "active" : ""
          }`}
          aria-pressed={markdownPreviewDefaultMode === "hybrid"}
          onClick={() => onMarkdownPreviewDefaultModeChange("hybrid")}
        >
          {tSettings(language, "settings.markdownEditor.previewMode.hybrid")}
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">
        {tSettings(language, "settings.markdownEditor.openInNewTab")}
      </span>
      <div className="setting-subrow">
        <div className="theme-toggle">
          <span className="toggle-label">{tSettings(language, "settings.common.off")}</span>
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
          <span className="toggle-label">{tSettings(language, "settings.common.on")}</span>
        </div>
        <span className="helper-text">
          {tSettings(language, "settings.markdownEditor.openInNewTab.helper")}
        </span>
      </div>
    </div>
  </div>
);
