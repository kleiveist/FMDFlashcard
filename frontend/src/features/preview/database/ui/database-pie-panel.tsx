/**
 * @file frontend/src/features/preview/database/ui/database-pie-panel.tsx
 *
 * View configuration panel for pie/donut settings.
 */

import { type CSSProperties } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabasePieColorSpectrum,
} from "../database-types";
import { type DatabasePieValueOption } from "../pie-values";

type PieAggregateType = "count" | "sum" | "avg";

type DatabasePiePanelProps = {
  attributes: DatabaseAttributeMeta[];
  groupField: string | null;
  aggregate: PieAggregateType;
  aggregateField: string | null;
  valueOptions: DatabasePieValueOption[];
  excludedValues: string[];
  colorSpectrum: DatabasePieColorSpectrum;
  onChange: (next: {
    groupField?: string | null;
    aggregate?: PieAggregateType;
    aggregateField?: string | null;
    excludedValues?: string[];
    colorSpectrum?: DatabasePieColorSpectrum;
  }) => void;
  onClose: () => void;
};

const aggregateOptions: Array<{ value: PieAggregateType; label: string }> = [
  { value: "count", label: "Anzahl" },
  { value: "sum", label: "Summe" },
  { value: "avg", label: "Durchschnitt" },
];

const colorSpectrumOptions: Array<{ value: DatabasePieColorSpectrum; label: string }> = [
  { value: "standard", label: "Standard (Akzent)" },
  { value: "ocean", label: "Ozean" },
  { value: "sunset", label: "Sonnenuntergang" },
  { value: "forest", label: "Wald" },
  { value: "pastel", label: "Pastell" },
];

const colorSpectrumSwatches: Record<DatabasePieColorSpectrum, string> = {
  standard: "linear-gradient(135deg, color-mix(in srgb, var(--accent-strong) 82%, var(--db-surface-base)), color-mix(in srgb, var(--accent) 76%, var(--db-surface-base)))",
  ocean: "linear-gradient(135deg, #006994, #4DCCBD)",
  sunset: "linear-gradient(135deg, #7C2D12, #F59E0B)",
  forest: "linear-gradient(135deg, #14532D, #4ADE80)",
  pastel: "linear-gradient(135deg, #9D4EDD, #F9A8D4)",
};

export const DatabasePiePanel = ({
  attributes,
  groupField,
  aggregate,
  aggregateField,
  valueOptions,
  excludedValues,
  colorSpectrum,
  onChange,
  onClose,
}: DatabasePiePanelProps) => {
  const groupableAttributes = attributes
    .filter((attribute) => attribute.viewCompatibility.supportsPieGrouping);
  const aggregatableAttributes = attributes
    .filter((attribute) => attribute.viewCompatibility.supportsAggregation);
  const excludedValueSet = new Set(excludedValues);
  const fallbackAggregateField = aggregateField && aggregatableAttributes.some((attribute) =>
    attribute.key === aggregateField)
    ? aggregateField
    : (aggregatableAttributes[0]?.key ?? null);

  const handleValueToggle = (value: string, checked: boolean) => {
    if (checked) {
      onChange({
        excludedValues: excludedValues.filter((entry) => entry !== value),
      });
      return;
    }
    onChange({
      excludedValues: [...excludedValues, value],
    });
  };

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
            onChange={(event) => {
              const nextAggregate = event.target.value as PieAggregateType;
              onChange({
                aggregate: nextAggregate,
                aggregateField: nextAggregate === "count" ? null : fallbackAggregateField,
              });
            }}
          >
            {aggregateOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

      </div>

      <section className="database-pie-spectrum">
        <h6>Farbspektrum</h6>
        <div className="database-pie-spectrum-grid" role="radiogroup" aria-label="Farbspektrum">
          {colorSpectrumOptions.map((option) => {
            const isActive = colorSpectrum === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`database-pie-spectrum-option${isActive ? " is-active" : ""}`}
                role="radio"
                aria-checked={isActive}
                onClick={() => onChange({ colorSpectrum: option.value })}
              >
                <span
                  className="database-pie-spectrum-dot"
                  style={{ "--db-pie-spectrum-swatch": colorSpectrumSwatches[option.value] } as CSSProperties}
                  aria-hidden="true"
                />
                <span className="database-pie-spectrum-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {valueOptions.length > 0 ? (
        <section className="database-pie-values">
          <h6>Werte</h6>
          <ul className="database-pie-value-list">
            {valueOptions.map((option) => {
              const isChecked = !excludedValueSet.has(option.value);
              return (
                <li key={option.value} className="database-pie-value-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) => handleValueToggle(option.value, event.target.checked)}
                    />
                    <span className="database-pie-value-label">{option.value}</span>
                    <span className="database-pie-value-count">{option.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="database-block-state">Keine Werte fuer das Gruppierfeld gefunden.</p>
      )}

      <p className="database-block-state">
        Tags/Multiselect werden als einzelne Buckets (explode) behandelt.
      </p>
    </aside>
  );
};
