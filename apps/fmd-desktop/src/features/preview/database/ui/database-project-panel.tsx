/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-project-panel.tsx
 *
 * View configuration panel for block-based project settings.
 */

import {
  type DatabaseAttributeMeta,
  type DatabaseProjectMissingPlacement,
} from "../database-types";

type DatabaseProjectPanelProps = {
  attributes: DatabaseAttributeMeta[];
  startField: string | null;
  unitField: string | null;
  blockResolution: number;
  defaultUnits: number;
  missingPlacement: DatabaseProjectMissingPlacement;
  onChange: (next: {
    startField?: string | null;
    unitField?: string | null;
    blockResolution?: number;
    defaultUnits?: number;
    missingPlacement?: DatabaseProjectMissingPlacement;
  }) => void;
  onClose: () => void;
};

const isProjectNumericType = (type: DatabaseAttributeMeta["type"]) =>
  type === "number" ||
  type === "unit" ||
  type === "percent" ||
  type === "score" ||
  type === "rating" ||
  type === "progress";

const asPositiveIntegerOrNull = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
};

export const DatabaseProjectPanel = ({
  attributes,
  startField,
  unitField,
  blockResolution,
  defaultUnits,
  missingPlacement,
  onChange,
  onClose,
}: DatabaseProjectPanelProps) => {
  const numericAttributes = attributes.filter((attribute) => isProjectNumericType(attribute.type));

  return (
    <aside
      className="database-block-panel database-block-project-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Project Optionen"
    >
      <header className="database-block-panel-header">
        <h5>Project Optionen</h5>
        <button type="button" className="database-block-panel-close" onClick={onClose} aria-label="Schliessen">
          ×
        </button>
      </header>

      <div className="database-block-panel-controls">
        <label>
          Startfeld
          <select
            value={startField ?? ""}
            onChange={(event) => onChange({ startField: event.target.value || null })}
          >
            <option value="">Auto (projectStart)</option>
            {numericAttributes.map((attribute) => (
              <option key={attribute.key} value={attribute.key}>{attribute.label || attribute.key}</option>
            ))}
          </select>
        </label>

        <label>
          Unitfeld
          <select
            value={unitField ?? ""}
            onChange={(event) => onChange({ unitField: event.target.value || null })}
          >
            <option value="">Auto (units)</option>
            {numericAttributes.map((attribute) => (
              <option key={attribute.key} value={attribute.key}>{attribute.label || attribute.key}</option>
            ))}
          </select>
        </label>

        <label>
          Blockaufloesung
          <input
            type="number"
            min={1}
            step={1}
            value={blockResolution}
            onChange={(event) => {
              const next = asPositiveIntegerOrNull(event.target.value);
              if (next !== null) {
                onChange({ blockResolution: next });
              }
            }}
          />
        </label>

        <label>
          Standard Units
          <input
            type="number"
            min={1}
            step={1}
            value={defaultUnits}
            onChange={(event) => {
              const next = asPositiveIntegerOrNull(event.target.value);
              if (next !== null) {
                onChange({ defaultUnits: next });
              }
            }}
          />
        </label>

        <label>
          Ohne Placement
          <select
            value={missingPlacement}
            onChange={(event) =>
              onChange({
                missingPlacement: event.target.value === "hide-unplaced" ? "hide-unplaced" : "show-unplaced",
              })}
          >
            <option value="show-unplaced">Als unplatziert anzeigen</option>
            <option value="hide-unplaced">Rechts ausblenden</option>
          </select>
        </label>
      </div>

      {numericAttributes.length === 0 ? (
        <p className="database-block-state">
          Keine numerischen Felder vorhanden. Beim Platzieren werden `projectStart` und `units` automatisch angelegt.
        </p>
      ) : null}
      <p className="database-block-state">
        Startslot ist 0-basiert. Ein erneuter Drop verschiebt das bestehende Placement.
      </p>
    </aside>
  );
};
