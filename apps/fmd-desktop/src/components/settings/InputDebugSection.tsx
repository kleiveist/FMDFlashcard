import { useMemo, useState } from "react";
import { useInputDebug } from "../../features/input-debug/useInputDebug";

type InputDebugSectionProps = {
  enabled: boolean;
  redactContent: boolean;
  setEnabled: (value: boolean) => void;
  setRedactContent: (value: boolean) => void;
};

export const InputDebugSection = ({
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
      return "n/a";
    }
    return new Date(lastEventTs).toLocaleString();
  }, [lastEventTs]);

  const handleRedactionToggle = (next: boolean) => {
    if (!next) {
      const confirmed = window.confirm(
        "Turning off redaction may capture typed content in the exported log. Continue?",
      );
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
        setStatusMessage("Export canceled.");
        return;
      }
      setStatusMessage(`Exported ${result.eventCount} events to ${result.path}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusError(true);
      setStatusMessage(`Export failed: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = () => {
    clear();
    setStatusError(false);
    setStatusMessage("Input log cleared.");
  };

  return (
    <section className="panel input-debug-panel">
      <div className="panel-header">
        <div>
          <h2>Debug</h2>
          <p className="muted">
            Only for debugging. No typed content is stored by default.
          </p>
        </div>
      </div>
      <div className="panel-body">
        <div className="setting-row">
          <span className="label">INPUT DEBUG MODE</span>
          <div className="setting-inline">
            <label className="switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className="muted">{enabled ? "On" : "Off"}</span>
          </div>
        </div>

        <div className="setting-row">
          <span className="label">REDACT CONTENT</span>
          <div className="setting-inline">
            <label className="switch">
              <input
                type="checkbox"
                checked={redactContent}
                onChange={(event) => handleRedactionToggle(event.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className="muted">{redactContent ? "On" : "Off"}</span>
          </div>
          {!redactContent ? (
            <span className="helper-text input-debug-warning">
              Content redaction is disabled. Typed text may appear in exported logs.
            </span>
          ) : null}
        </div>

        <div className="setting-row">
          <span className="label">EXPORT OPTIONS</span>
          <label className="status-checkbox">
            <input
              type="checkbox"
              checked={includeSystemInfo}
              onChange={(event) => setIncludeSystemInfo(event.target.checked)}
            />
            <span>Include system information</span>
          </label>
          <div className="setting-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => void handleExport()}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export Input Log"}
            </button>
            <button type="button" className="ghost small" onClick={handleClear}>
              Clear Input Log
            </button>
          </div>
          <p className="muted input-debug-meta">
            Events in buffer: {bufferCount} | last event: {lastEventLabel}
          </p>
          {statusMessage ? (
            <p className={`muted input-debug-status ${statusError ? "is-error" : "is-success"}`}>
              {statusMessage}
            </p>
          ) : null}
        </div>

        {diagnosticHints.length > 0 ? (
          <div className="input-debug-hints">
            <h3>Diagnostic hints</h3>
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
