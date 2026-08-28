/**
 * @file frontend/src/features/preview/database/ui/database-gantt-panel.tsx
 *
 * View configuration panel for timeline/gantt settings.
 */

import {
  type DatabaseAttributeMeta,
  type DatabaseGanttZoom,
  type DatabaseTimelineMode,
} from "../database-types";
import {
  coerceTimelineZoom,
  getTimelineAllowedZooms,
  normalizeTimelineBaseDate,
} from "../database-time";

type DatabaseGanttPanelProps = {
  attributes: DatabaseAttributeMeta[];
  startField: string | null;
  endField: string | null;
  mode: DatabaseTimelineMode;
  baseDate: string | null;
  zoom: DatabaseGanttZoom;
  onChange: (next: {
    startField?: string | null;
    endField?: string | null;
    mode?: DatabaseTimelineMode;
    baseDate?: string | null;
    zoom?: DatabaseGanttZoom;
  }) => void;
  onClose: () => void;
};

const timelineModeOptions: Array<{ value: DatabaseTimelineMode; label: string }> = [
  { value: "date", label: "Datum" },
  { value: "time", label: "Uhrzeit" },
  { value: "datetime", label: "Datum + Uhrzeit" },
];

const zoomLabelByValue: Record<DatabaseGanttZoom, string> = {
  minute: "Minute",
  hour: "Stunde",
  day: "Tag",
  week: "Woche",
  month: "Monat",
  quarter: "Quartal",
  year: "Jahr",
};

export const DatabaseGanttPanel = ({
  attributes,
  startField,
  endField,
  mode,
  baseDate,
  zoom,
  onChange,
  onClose,
}: DatabaseGanttPanelProps) => {
  const timelineAttributes = attributes
    .filter((attribute) => attribute.viewCompatibility.supportsTimeline);
  const zoomOptions = getTimelineAllowedZooms(mode)
    .map((value) => ({ value, label: zoomLabelByValue[value] }));
  const effectiveZoom = coerceTimelineZoom(mode, zoom);

  return (
    <aside
      className="database-block-panel database-block-gantt-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Timeline Optionen"
    >
      <header className="database-block-panel-header">
        <h5>Timeline Optionen</h5>
        <button type="button" className="database-block-panel-close" onClick={onClose} aria-label="Schliessen">
          ×
        </button>
      </header>

      <div className="database-block-panel-controls">
        <label>
          Modus
          <select
            value={mode}
            onChange={(event) => {
              const nextMode = event.target.value as DatabaseTimelineMode;
              const nextZoom = coerceTimelineZoom(nextMode, effectiveZoom);
              onChange({ mode: nextMode, zoom: nextZoom });
            }}
          >
            {timelineModeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Startfeld
          <select
            value={startField ?? ""}
            onChange={(event) => onChange({ startField: event.target.value || null })}
          >
            <option value="">Auto</option>
            {timelineAttributes.map((attribute) => (
              <option key={attribute.key} value={attribute.key}>{attribute.label || attribute.key}</option>
            ))}
          </select>
        </label>

        <label>
          Endfeld
          <select
            value={endField ?? ""}
            onChange={(event) => onChange({ endField: event.target.value || null })}
          >
            <option value="">Nur Start (Milestone)</option>
            {timelineAttributes.map((attribute) => (
              <option key={attribute.key} value={attribute.key}>{attribute.label || attribute.key}</option>
            ))}
          </select>
        </label>

        {mode === "time" ? (
          <label>
            Basisdatum
            <input
              type="date"
              value={baseDate ?? ""}
              onChange={(event) =>
                onChange({ baseDate: normalizeTimelineBaseDate(event.target.value) })}
            />
          </label>
        ) : null}

        <label>
          Zoom
          <select
            value={effectiveZoom}
            onChange={(event) => onChange({ zoom: event.target.value as DatabaseGanttZoom })}
          >
            {zoomOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {timelineAttributes.length === 0 ? (
        <p className="database-block-state">
          Keine Zeitfelder vorhanden. Beim Platzieren in der Timeline werden `start`/`end` automatisch angelegt.
        </p>
      ) : null}
      <p className="database-block-state">
        Falls nur ein Startwert vorhanden ist, wird ein Milestone angezeigt.
      </p>
    </aside>
  );
};
