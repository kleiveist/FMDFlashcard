/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-filter-panel.tsx
 *
 * Filter panel for type-aware database conditions.
 */

import {
  type ChangeEvent,
  useMemo,
} from "react";
import {
  getFilterOperatorsForType,
} from "../database-filters";
import {
  type DatabaseAttributeMeta,
  type DatabaseFilterGroup,
  type DatabaseFilterRule,
} from "../database-types";

type DatabaseFilterPanelProps = {
  attributes: DatabaseAttributeMeta[];
  filterGroup: DatabaseFilterGroup;
  onChange: (nextGroup: DatabaseFilterGroup) => void;
  onClose: () => void;
};

const isFilterGroupEntry = (entry: DatabaseFilterRule | DatabaseFilterGroup): entry is DatabaseFilterGroup =>
  "rules" in entry;

const createDefaultRule = (attributes: DatabaseAttributeMeta[]): DatabaseFilterRule => {
  const firstAttribute = attributes[0];
  const type = firstAttribute?.type ?? "text";
  const firstOperator = getFilterOperatorsForType(type)[0]?.value ?? "is";

  return {
    id: `filter-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    field: firstAttribute?.key ?? "",
    op: firstOperator,
    value: "",
  };
};

const toFlatRules = (group: DatabaseFilterGroup) =>
  group.rules.filter((entry): entry is DatabaseFilterRule => !isFilterGroupEntry(entry));

export const DatabaseFilterPanel = ({
  attributes,
  filterGroup,
  onChange,
  onClose,
}: DatabaseFilterPanelProps) => {
  const flatRules = useMemo(() => toFlatRules(filterGroup), [filterGroup]);
  const nestedGroups = useMemo(
    () => filterGroup.rules.filter(isFilterGroupEntry),
    [filterGroup],
  );

  const updateRules = (nextRules: DatabaseFilterRule[]) => {
    onChange({
      ...filterGroup,
      rules: [...nextRules, ...nestedGroups],
    });
  };

  const updateRule = (ruleId: string, patch: Partial<DatabaseFilterRule>) => {
    const nextRules = flatRules.map((rule) =>
      rule.id === ruleId
        ? { ...rule, ...patch }
        : rule);
    updateRules(nextRules);
  };

  const handleGroupOpChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextOp = event.target.value === "or" ? "or" : "and";
    onChange({
      ...filterGroup,
      op: nextOp,
    });
  };

  return (
    <aside
      className="database-block-panel database-block-filter-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Database Filter"
    >
      <header className="database-block-panel-header">
        <h5>Filter</h5>
        <button type="button" className="database-block-panel-close" onClick={onClose} aria-label="Schliessen">
          ×
        </button>
      </header>
      <div className="database-block-panel-controls">
        <label>
          Gruppe
          <select value={filterGroup.op} onChange={handleGroupOpChange}>
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </label>
      </div>
      <div className="database-block-filter-list">
        {flatRules.map((rule) => {
          const attribute = attributes.find((entry) => entry.key === rule.field) ?? attributes[0] ?? null;
          const operators = getFilterOperatorsForType(attribute?.type ?? "text");
          return (
            <div key={rule.id} className="database-block-filter-row">
              <select
                value={rule.field}
                onChange={(event) => {
                  const nextField = event.target.value;
                  const nextAttribute = attributes.find((entry) => entry.key === nextField) ?? null;
                  const nextOperator = getFilterOperatorsForType(nextAttribute?.type ?? "text")[0]?.value ?? "is";
                  updateRule(rule.id, {
                    field: nextField,
                    op: nextOperator,
                  });
                }}
              >
                {attributes.map((entry) => (
                  <option key={entry.key} value={entry.key}>{entry.key}</option>
                ))}
              </select>
              <select
                value={rule.op}
                onChange={(event) => updateRule(rule.id, { op: event.target.value })}
              >
                {operators.map((operator) => (
                  <option key={operator.value} value={operator.value}>{operator.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={typeof rule.value === "string" ? rule.value : String(rule.value ?? "")}
                placeholder="Wert"
                onChange={(event) => updateRule(rule.id, { value: event.target.value })}
              />
              {rule.op === "between" ? (
                <input
                  type="text"
                  value={typeof rule.valueTo === "string" ? rule.valueTo : String(rule.valueTo ?? "")}
                  placeholder="Bis"
                  onChange={(event) => updateRule(rule.id, { valueTo: event.target.value })}
                />
              ) : null}
              <button
                type="button"
                className="database-block-toolbar-button"
                onClick={() => updateRules(flatRules.filter((entry) => entry.id !== rule.id))}
              >
                Entfernen
              </button>
            </div>
          );
        })}
      </div>
      <footer className="database-block-panel-footer">
        <button
          type="button"
          className="database-block-toolbar-button"
          onClick={() => updateRules([...flatRules, createDefaultRule(attributes)])}
        >
          Filter hinzufuegen
        </button>
      </footer>
    </aside>
  );
};
