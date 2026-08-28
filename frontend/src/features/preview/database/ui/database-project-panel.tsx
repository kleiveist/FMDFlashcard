/**
 * @file frontend/src/features/preview/database/ui/database-project-panel.tsx
 *
 * View configuration panel for block-based project settings.
 */

import {
  type DatabaseAttributeMeta,
} from "../database-types";

type DatabaseProjectPanelProps = {
  attributes: DatabaseAttributeMeta[];
  startField: string | null;
  unitField: string | null;
  blockResolution: number;
  onChange: (next: {
    startField?: string | null;
    unitField?: string | null;
    blockResolution?: number;
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

const PROJECT_BLOCK_RESOLUTION_OPTIONS = [1, 2, 4] as const;

const normalizeBlockResolutionOption = (value: number) =>
  PROJECT_BLOCK_RESOLUTION_OPTIONS.includes(value as typeof PROJECT_BLOCK_RESOLUTION_OPTIONS[number])
    ? value
    : 1;

export const DatabaseProjectPanel = ({
  attributes,
  startField,
  unitField,
  blockResolution,
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
            <option value="">Auto (unitsstart)</option>
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
          <select
            value={normalizeBlockResolutionOption(blockResolution)}
            onChange={(event) => onChange({ blockResolution: Number(event.target.value) })}
          >
            {PROJECT_BLOCK_RESOLUTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} {option === 1 ? "Block" : "Bloecke"} pro Unit
              </option>
            ))}
          </select>
        </label>

      </div>

      {numericAttributes.length === 0 ? (
        <p className="database-block-state">
          Keine numerischen Felder vorhanden. Beim Platzieren werden `unitsstart` und `units` automatisch angelegt.
        </p>
      ) : null}
      <p className="database-block-state">
        Startslot ist 0-basiert. Ein erneuter Drop verschiebt das bestehende Placement.
      </p>
    </aside>
  );
};
