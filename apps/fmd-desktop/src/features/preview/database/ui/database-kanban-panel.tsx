/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-kanban-panel.tsx
 *
 * View configuration panel for Kanban grouping and visible values.
 */

import { type DatabaseAttributeMeta } from "../database-types";
import { type DatabaseKanbanValueOption } from "../kanban-values";

type DatabaseKanbanPanelProps = {
  attributes: DatabaseAttributeMeta[];
  groupField: string | null;
  valueOptions: DatabaseKanbanValueOption[];
  excludedValues: string[];
  onChange: (next: {
    groupField?: string | null;
    excludedValues?: string[];
  }) => void;
  onClose: () => void;
};

export const DatabaseKanbanPanel = ({
  attributes,
  groupField,
  valueOptions,
  excludedValues,
  onChange,
  onClose,
}: DatabaseKanbanPanelProps) => {
  const groupableAttributes = attributes
    .filter((attribute) => attribute.viewCompatibility.supportsKanbanGrouping);
  const excludedValueSet = new Set(excludedValues);

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
      className="database-block-panel database-block-kanban-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Kanban Optionen"
    >
      <header className="database-block-panel-header">
        <h5>Kanban Optionen</h5>
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
      </div>

      {valueOptions.length > 0 ? (
        <section className="database-kanban-values">
          <h6>Werte</h6>
          <ul className="database-kanban-value-list">
            {valueOptions.map((option) => {
              const isChecked = !excludedValueSet.has(option.value);
              return (
                <li key={option.value} className="database-kanban-value-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) => handleValueToggle(option.value, event.target.checked)}
                    />
                    <span className="database-kanban-value-label">{option.label}</span>
                    <span className="database-kanban-value-count">{option.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="database-block-state">Keine Werte fuer das Gruppierfeld gefunden.</p>
      )}
    </aside>
  );
};
