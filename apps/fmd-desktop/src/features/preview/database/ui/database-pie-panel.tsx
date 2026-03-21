/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-pie-panel.tsx
 *
 * View configuration panel for pie/donut settings.
 */

import {
  type DatabaseAttributeMeta,
} from "../database-types";

type PieAggregateType = "count" | "sum" | "avg";

type DatabasePiePanelProps = {
  attributes: DatabaseAttributeMeta[];
  groupField: string | null;
  aggregate: PieAggregateType;
  aggregateField: string | null;
  onChange: (next: {
    groupField?: string | null;
    aggregate?: PieAggregateType;
    aggregateField?: string | null;
  }) => void;
  onClose: () => void;
};

const aggregateOptions: Array<{ value: PieAggregateType; label: string }> = [
  { value: "count", label: "Anzahl" },
  { value: "sum", label: "Summe" },
  { value: "avg", label: "Durchschnitt" },
];

export const DatabasePiePanel = ({
  attributes,
  groupField,
  aggregate,
  aggregateField,
  onChange,
  onClose,
}: DatabasePiePanelProps) => {
  const groupableAttributes = attributes
    .filter((attribute) => attribute.viewCompatibility.supportsPieGrouping);
  const aggregatableAttributes = attributes
    .filter((attribute) => attribute.viewCompatibility.supportsAggregation);

  return (
    <aside
      className="database-block-panel database-block-pie-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Pie Optionen"
    >
      <header className="database-block-panel-header">
        <h5>Pie Optionen</h5>
        <button type="button" className="database-block-panel-close" onClick={onClose} aria-label="Schliessen">
          ×
        </button>
      </header>

      <div className="database-block-panel-controls">
        <label>
          Gruppieren nach
          <select
            value={groupField ?? ""}
            onChange={(event) => onChange({ groupField: event.target.value || null })}
          >
            <option value="">Auto</option>
            {groupableAttributes.map((attribute) => (
              <option key={attribute.key} value={attribute.key}>{attribute.label || attribute.key}</option>
            ))}
          </select>
        </label>

        <label>
          Aggregation
          <select
            value={aggregate}
            onChange={(event) => onChange({ aggregate: event.target.value as PieAggregateType })}
          >
            {aggregateOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          Aggregatfeld
          <select
            value={aggregateField ?? ""}
            onChange={(event) => onChange({ aggregateField: event.target.value || null })}
            disabled={aggregate === "count"}
          >
            <option value="">{aggregate === "count" ? "Nicht benoetigt" : "Feld waehlen"}</option>
            {aggregatableAttributes.map((attribute) => (
              <option key={attribute.key} value={attribute.key}>{attribute.label || attribute.key}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="database-block-state">
        Tags/Multiselect werden als einzelne Buckets (explode) behandelt.
      </p>
    </aside>
  );
};
