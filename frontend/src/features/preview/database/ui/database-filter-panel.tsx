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
  type DatabaseFilterGroup,
  type DatabaseFilterRule,
  type DatabaseVaultAttributeSuggestion,
  type DatabaseViewType,
} from "../database-types";
import { DatabaseAttributeTypeahead } from "./database-attribute-typeahead";

type DatabaseFilterPanelProps = {
  attributes: DatabaseAttributeMeta[];
  attributeSuggestions: DatabaseVaultAttributeSuggestion[];
  valueSuggestionsByField?: Record<string, DatabaseVaultAttributeSuggestion[]>;
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

const resolveAttribute = (attributes: DatabaseAttributeMeta[], field: string) => {
  const lower = field.trim().toLowerCase();
  return attributes.find((attribute) => attribute.key.trim().toLowerCase() === lower) ?? attributes[0] ?? null;
};

const toLower = (value: string) => value.trim().toLowerCase();

const createDefaultRule = (
  attributes: DatabaseAttributeMeta[],
  suggestions: DatabaseVaultAttributeSuggestion[],
): DatabaseFilterRule => {
  const firstField = suggestions[0]?.key ?? attributes[0]?.key ?? "";
  const firstAttribute = resolveAttribute(attributes, firstField);
  const type = firstAttribute?.type ?? "text";
  const firstOperator = getFilterOperatorsForType(type)[0]?.value ?? "is";

  return {
    id: nextId("filter-rule"),
    field: firstField,
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

const toRuleValueText = (value: unknown) =>
  typeof value === "string" ? value : String(value ?? "");

export const DatabaseFilterPanel = ({
  attributes,
  attributeSuggestions,
  valueSuggestionsByField = {},
  viewType,
  filterGroup,
  onChange,
  onClose,
}: DatabaseFilterPanelProps) => {
  const viewHint = FILTER_PANEL_HINTS[viewType];

  const handleGroupOpChange = (groupId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const nextOp = event.target.value === "or" ? "or" : "and";
    onChange(replaceGroupById(filterGroup, groupId, (group) => ({ ...group, op: nextOp })));
  };

  const handleAddRule = (groupId: string) => {
    onChange(replaceGroupById(filterGroup, groupId, (group) => ({
      ...group,
      rules: [...group.rules, createDefaultRule(attributes, attributeSuggestions)],
    })));
  };

  const handleAddGroup = (groupId: string) => {
    onChange(replaceGroupById(filterGroup, groupId, (group) => ({
      ...group,
      rules: [...group.rules, createDefaultGroup()],
    })));
  };

  const handleFieldChange = (ruleId: string, nextField: string) => {
    const nextAttribute = resolveAttribute(attributes, nextField);
    const nextOperator = getFilterOperatorsForType(nextAttribute?.type ?? "text")[0]?.value ?? "is";
    onChange(updateRuleById(filterGroup, ruleId, (rule) => ({
      ...rule,
      field: nextField,
      op: nextOperator,
      value: "",
      valueTo: "",
    })));
  };

  const resolveValueSuggestions = (field: string) =>
    valueSuggestionsByField[toLower(field)] ?? [];

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
            disabled={attributeSuggestions.length === 0}
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
          const showValueInput = !valueIsOptional(entry.op);
          const showBetween = entry.op === "between";
          const valueSuggestions = resolveValueSuggestions(entry.field);

          return (
            <div key={entry.id} className="database-block-filter-row">
              <DatabaseAttributeTypeahead
                value={entry.field}
                suggestions={attributeSuggestions}
                strictSelection
                placeholder="Attribut"
                onValueChange={(nextField) => handleFieldChange(entry.id, nextField)}
              />

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
                <DatabaseAttributeTypeahead
                  value={toRuleValueText(entry.value)}
                  placeholder="Wert"
                  suggestions={valueSuggestions}
                  noResultsLabel="Keine passenden Werte gefunden"
                  onValueChange={(nextValue) => onChange(updateRuleById(filterGroup, entry.id, (rule) => ({
                    ...rule,
                    value: nextValue,
                  })))}
                />
              ) : (
                <span className="database-block-filter-value-empty">—</span>
              )}

              {showBetween ? (
                <DatabaseAttributeTypeahead
                  value={toRuleValueText(entry.valueTo)}
                  placeholder="Bis"
                  suggestions={valueSuggestions}
                  noResultsLabel="Keine passenden Werte gefunden"
                  onValueChange={(nextValue) => onChange(updateRuleById(filterGroup, entry.id, (rule) => ({
                    ...rule,
                    valueTo: nextValue,
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
      {attributeSuggestions.length === 0 ? (
        <p className="database-block-state">Keine Vault-Attribute verfuegbar.</p>
      ) : null}

      {renderGroup(filterGroup, 0, true)}
    </aside>
  );
};
