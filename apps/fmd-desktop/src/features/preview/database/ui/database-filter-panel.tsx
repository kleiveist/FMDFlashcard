/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-filter-panel.tsx
 *
 * Filter panel for type-aware database conditions.
 */

import {
  type ChangeEvent,
} from "react";
import {
  getFilterOperatorsForType,
} from "../database-filters";
import {
  type DatabaseAttributeMeta,
  type DatabaseFieldType,
  type DatabaseFilterGroup,
  type DatabaseFilterRule,
  type DatabaseViewType,
} from "../database-types";

type DatabaseFilterPanelProps = {
  attributes: DatabaseAttributeMeta[];
  viewType: DatabaseViewType;
  filterGroup: DatabaseFilterGroup;
  onChange: (nextGroup: DatabaseFilterGroup) => void;
  onClose: () => void;
};

const FILTER_PANEL_HINTS: Record<DatabaseViewType, string> = {
  table: "Filter wirkt auf Tabellenzeilen.",
  kanban: "Filter wirkt auf Karten im Kanban-Board.",
  gantt: "Filter wirkt synchron auf Liste links und Balkenzeilen rechts.",
  project: "Filter wirkt synchron auf Liste links und Blockzeilen rechts.",
  pie: "Filter wirkt auf die Datengrundlage des Pie-Charts.",
};

const isFilterGroupEntry = (entry: DatabaseFilterRule | DatabaseFilterGroup): entry is DatabaseFilterGroup =>
  "rules" in entry;

const nextId = (() => {
  let sequence = 0;
  return (prefix: string) => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };
})();

const createDefaultRule = (attributes: DatabaseAttributeMeta[]): DatabaseFilterRule => {
  const firstAttribute = attributes[0];
  const type = firstAttribute?.type ?? "text";
  const firstOperator = getFilterOperatorsForType(type)[0]?.value ?? "is";

  return {
    id: nextId("filter-rule"),
    field: firstAttribute?.key ?? "",
    op: firstOperator,
    value: "",
  };
};

const createDefaultGroup = (): DatabaseFilterGroup => ({
  id: nextId("filter-group"),
  op: "and",
  rules: [],
});

const replaceGroupById = (
  root: DatabaseFilterGroup,
  groupId: string,
  update: (group: DatabaseFilterGroup) => DatabaseFilterGroup,
): DatabaseFilterGroup => {
  if (root.id === groupId) {
    return update(root);
  }
  return {
    ...root,
    rules: root.rules.map((entry) =>
      isFilterGroupEntry(entry)
        ? replaceGroupById(entry, groupId, update)
        : entry),
  };
};

const removeGroupById = (root: DatabaseFilterGroup, groupId: string): DatabaseFilterGroup => ({
  ...root,
  rules: root.rules
    .map((entry) =>
      isFilterGroupEntry(entry)
        ? removeGroupById(entry, groupId)
        : entry)
    .filter((entry) => (isFilterGroupEntry(entry) ? entry.id !== groupId : true)),
});

const removeRuleById = (root: DatabaseFilterGroup, ruleId: string): DatabaseFilterGroup => ({
  ...root,
  rules: root.rules
    .map((entry) =>
      isFilterGroupEntry(entry)
        ? removeRuleById(entry, ruleId)
        : entry)
    .filter((entry) => (isFilterGroupEntry(entry) ? true : entry.id !== ruleId)),
});

const updateRuleById = (
  root: DatabaseFilterGroup,
  ruleId: string,
  update: (rule: DatabaseFilterRule) => DatabaseFilterRule,
): DatabaseFilterGroup => ({
  ...root,
  rules: root.rules.map((entry) => {
    if (isFilterGroupEntry(entry)) {
      return updateRuleById(entry, ruleId, update);
    }
    return entry.id === ruleId ? update(entry) : entry;
  }),
});

const valueIsOptional = (op: string) =>
  op === "is empty" ||
  op === "is not empty" ||
  op === "is true" ||
  op === "is false";

const resolveInputType = (type: DatabaseFieldType) => {
  if (
    type === "number" ||
    type === "unit" ||
    type === "percent" ||
    type === "score" ||
    type === "rating" ||
    type === "progress"
  ) {
    return "number";
  }
  if (type === "date") {
    return "date";
  }
  if (type === "time") {
    return "time";
  }
  if (type === "datetime") {
    return "datetime-local";
  }
  return "text";
};

const toRuleValueText = (value: unknown) =>
  typeof value === "string" ? value : String(value ?? "");

const resolveAttribute = (attributes: DatabaseAttributeMeta[], field: string) => {
  const lower = field.trim().toLowerCase();
  return attributes.find((attribute) => attribute.key.trim().toLowerCase() === lower) ?? attributes[0] ?? null;
};

export const DatabaseFilterPanel = ({
  attributes,
  viewType,
  filterGroup,
  onChange,
  onClose,
}: DatabaseFilterPanelProps) => {
  const viewHint = FILTER_PANEL_HINTS[viewType];

  if (attributes.length === 0) {
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
        <p className="database-block-panel-context">{viewHint}</p>
        <p className="database-block-state">Keine Attribute verfuegbar.</p>
      </aside>
    );
  }

  const handleGroupOpChange = (groupId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const nextOp = event.target.value === "or" ? "or" : "and";
    onChange(replaceGroupById(filterGroup, groupId, (group) => ({ ...group, op: nextOp })));
  };

  const handleAddRule = (groupId: string) => {
    onChange(replaceGroupById(filterGroup, groupId, (group) => ({
      ...group,
      rules: [...group.rules, createDefaultRule(attributes)],
    })));
  };

  const handleAddGroup = (groupId: string) => {
    onChange(replaceGroupById(filterGroup, groupId, (group) => ({
      ...group,
      rules: [...group.rules, createDefaultGroup()],
    })));
  };

  const renderGroup = (group: DatabaseFilterGroup, depth: number, isRoot: boolean) => (
    <section key={group.id} className="database-block-filter-group" style={{ marginLeft: `${depth * 10}px` }}>
      <div className="database-block-filter-group-header">
        <label>
          Gruppe
          <select value={group.op} onChange={(event) => handleGroupOpChange(group.id, event)}>
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </label>
        <div className="database-block-filter-group-actions">
          <button
            type="button"
            className="database-block-toolbar-button"
            onClick={() => handleAddRule(group.id)}
          >
            Regel
          </button>
          <button
            type="button"
            className="database-block-toolbar-button"
            onClick={() => handleAddGroup(group.id)}
          >
            Gruppe
          </button>
          {!isRoot ? (
            <button
              type="button"
              className="database-block-toolbar-button"
              onClick={() => onChange(removeGroupById(filterGroup, group.id))}
            >
              Entfernen
            </button>
          ) : null}
        </div>
      </div>

      <div className="database-block-filter-list">
        {group.rules.map((entry) => {
          if (isFilterGroupEntry(entry)) {
            return renderGroup(entry, depth + 1, false);
          }

          const attribute = resolveAttribute(attributes, entry.field);
          const operators = getFilterOperatorsForType(attribute?.type ?? "text");
          const ruleInputType = resolveInputType(attribute?.type ?? "text");
          const showValueInput = !valueIsOptional(entry.op);
          const showBetween = entry.op === "between";

          return (
            <div key={entry.id} className="database-block-filter-row">
              <select
                value={entry.field}
                onChange={(event) => {
                  const nextField = event.target.value;
                  const nextAttribute = resolveAttribute(attributes, nextField);
                  const nextOperator = getFilterOperatorsForType(nextAttribute?.type ?? "text")[0]?.value ?? "is";
                  onChange(updateRuleById(filterGroup, entry.id, (rule) => ({
                    ...rule,
                    field: nextField,
                    op: nextOperator,
                    value: "",
                    valueTo: "",
                  })));
                }}
              >
                {attributes.map((attributeEntry) => (
                  <option key={attributeEntry.key} value={attributeEntry.key}>{attributeEntry.key}</option>
                ))}
              </select>

              <select
                value={entry.op}
                onChange={(event) => {
                  const nextOp = event.target.value;
                  onChange(updateRuleById(filterGroup, entry.id, (rule) => ({
                    ...rule,
                    op: nextOp,
                    valueTo: nextOp === "between" ? rule.valueTo ?? "" : undefined,
                  })));
                }}
              >
                {operators.map((operator) => (
                  <option key={operator.value} value={operator.value}>{operator.label}</option>
                ))}
              </select>

              {showValueInput ? (
                <input
                  type={ruleInputType}
                  value={toRuleValueText(entry.value)}
                  placeholder="Wert"
                  onChange={(event) => onChange(updateRuleById(filterGroup, entry.id, (rule) => ({
                    ...rule,
                    value: event.target.value,
                  })))}
                />
              ) : (
                <span className="database-block-filter-value-empty">—</span>
              )}

              {showBetween ? (
                <input
                  type={ruleInputType}
                  value={toRuleValueText(entry.valueTo)}
                  placeholder="Bis"
                  onChange={(event) => onChange(updateRuleById(filterGroup, entry.id, (rule) => ({
                    ...rule,
                    valueTo: event.target.value,
                  })))}
                />
              ) : null}

              <button
                type="button"
                className="database-block-toolbar-button"
                onClick={() => onChange(removeRuleById(filterGroup, entry.id))}
              >
                Entfernen
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

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
      <p className="database-block-panel-context">{viewHint}</p>

      {renderGroup(filterGroup, 0, true)}
    </aside>
  );
};
