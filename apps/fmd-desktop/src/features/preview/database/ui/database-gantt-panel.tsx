/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-gantt-panel.tsx
 *
 * View configuration panel for timeline/gantt settings.
 */

import {
  type DatabaseAttributeMeta,
  type DatabaseGanttZoom,
} from "../database-types";

type DatabaseGanttPanelProps = {
  attributes: DatabaseAttributeMeta[];
  startField: string | null;
  endField: string | null;
  zoom: DatabaseGanttZoom;
  onChange: (next: {
    startField?: string | null;
    endField?: string | null;
    zoom?: DatabaseGanttZoom;
  }) => void;
  onClose: () => void;
};

const zoomOptions: Array<{ value: DatabaseGanttZoom; label: string }> = [
  { value: "day", label: "Tag" },
  { value: "week", label: "Woche" },
  { value: "month", label: "Monat" },
  { value: "quarter", label: "Quartal" },
];

export const DatabaseGanttPanel = ({
  attributes,
  startField,
  endField,
  zoom,
  onChange,
  onClose,
}: DatabaseGanttPanelProps) => {
  const timelineAttributes = attributes
    .filter((attribute) => attribute.viewCompatibility.supportsTimeline);

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

      {timelineAttributes.length === 0 ? (
        <p className="database-block-state">
          Keine Datumsfelder vorhanden. Waehl ein Feld vom Typ date/datetime.
        </p>
      ) : (
        <>
          <div className="database-block-panel-controls">
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

            <label>
              Zoom
              <select
                value={zoom}
                onChange={(event) => onChange({ zoom: event.target.value as DatabaseGanttZoom })}
              >
                {zoomOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="database-block-state">
            Falls nur ein Datum vorhanden ist, wird ein Milestone angezeigt.
          </p>
        </>
      )}
    </aside>
  );
};
