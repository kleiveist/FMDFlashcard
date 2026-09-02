import { useMemo, useState } from "react";
import { useInputDebug } from "../../features/input-debug/useInputDebug";
import {
  formatSettingsText,
  type SettingsLanguage,
  tSettings,
} from "../../features/settings/settingsI18n";

type InputDebugSectionProps = {
  language: SettingsLanguage;
  enabled: boolean;
  redactContent: boolean;
  setEnabled: (value: boolean) => void;
  setRedactContent: (value: boolean) => void;
};

export const InputDebugSection = ({
  language,
  enabled,
  redactContent,
  setEnabled,
  setRedactContent,
}: InputDebugSectionProps) => {
  const { bufferCount, lastEventTs, diagnosticHints, clear, exportLog } = useInputDebug();
  const [includeSystemInfo, setIncludeSystemInfo] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);

  const lastEventLabel = useMemo(() => {
    if (!lastEventTs) {
      return tSettings(language, "settings.inputDebug.lastEventNone");
    }
    return new Date(lastEventTs).toLocaleString();
  }, [language, lastEventTs]);

  const handleRedactionToggle = (next: boolean) => {
    if (!next) {
      const confirmed = window.confirm(tSettings(language, "settings.inputDebug.redactionConfirm"));
      if (!confirmed) {
        return;
      }
    }
    setRedactContent(next);
  };

  const handleExport = async () => {
    setStatusMessage(null);
    setStatusError(false);
    setIsExporting(true);
    try {
      const result = await exportLog(includeSystemInfo);
      if (!result) {
        setStatusMessage(tSettings(language, "settings.inputDebug.exportCanceled"));
        return;
      }
      setStatusMessage(
        formatSettingsText(language, "settings.inputDebug.exported", {
          count: result.eventCount,
          path: result.path,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusError(true);
      setStatusMessage(
        formatSettingsText(language, "settings.inputDebug.exportFailed", { message }),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = () => {
    clear();
    setStatusError(false);
    setStatusMessage(tSettings(language, "settings.inputDebug.inputLogCleared"));
  };

  return (
    <section className="panel input-debug-panel">
      <div className="panel-header">
        <div>
          <h2>{tSettings(language, "settings.inputDebug.title")}</h2>
          <p className="muted">{tSettings(language, "settings.inputDebug.description")}</p>
        </div>
      </div>
      <div className="panel-body">
        <div className="setting-row">
          <span className="label">{tSettings(language, "settings.inputDebug.inputMode")}</span>
          <div className="setting-inline">
            <label className="switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className="muted">
              {enabled
                ? tSettings(language, "settings.common.on")
                : tSettings(language, "settings.common.off")}
            </span>
          </div>
        </div>

        <div className="setting-row">
          <span className="label">{tSettings(language, "settings.inputDebug.redactContent")}</span>
          <div className="setting-inline">
            <label className="switch">
              <input
                type="checkbox"
                checked={redactContent}
                onChange={(event) => handleRedactionToggle(event.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className="muted">
              {redactContent
                ? tSettings(language, "settings.common.on")
                : tSettings(language, "settings.common.off")}
            </span>
          </div>
          {!redactContent ? (
            <span className="helper-text input-debug-warning">
              {tSettings(language, "settings.inputDebug.warning")}
            </span>
          ) : null}
        </div>

        <div className="setting-row">
          <span className="label">{tSettings(language, "settings.inputDebug.exportOptions")}</span>
          <label className="status-checkbox">
            <input
              type="checkbox"
              checked={includeSystemInfo}
              onChange={(event) => setIncludeSystemInfo(event.target.checked)}
            />
            <span>{tSettings(language, "settings.inputDebug.includeSystemInfo")}</span>
          </label>
          <div className="setting-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => void handleExport()}
              disabled={isExporting}
            >
              {isExporting
                ? tSettings(language, "settings.inputDebug.exporting")
                : tSettings(language, "settings.inputDebug.exportInputLog")}
            </button>
            <button type="button" className="ghost small" onClick={handleClear}>
              {tSettings(language, "settings.inputDebug.clearInputLog")}
            </button>
          </div>
          <p className="muted input-debug-meta">
            {formatSettingsText(language, "settings.inputDebug.eventsInBuffer", {
              count: bufferCount,
              last: lastEventLabel,
            })}
          </p>
          {statusMessage ? (
            <p className={`muted input-debug-status ${statusError ? "is-error" : "is-success"}`}>
              {statusMessage}
            </p>
          ) : null}
        </div>

        {diagnosticHints.length > 0 ? (
          <div className="input-debug-hints">
            <h3>{tSettings(language, "settings.inputDebug.diagnosticHints")}</h3>
            <ul>
              {diagnosticHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
};
