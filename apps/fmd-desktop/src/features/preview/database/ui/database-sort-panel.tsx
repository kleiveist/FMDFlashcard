/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-sort-panel.tsx
 *
 * Multi-level sort panel for database block.
 */

import { type DragEvent } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseSortRule,
} from "../database-types";

type DatabaseSortPanelProps = {
  attributes: DatabaseAttributeMeta[];
  sortRules: DatabaseSortRule[];
  onChange: (nextRules: DatabaseSortRule[]) => void;
  onClose: () => void;
};

const createDefaultSortRule = (attributes: DatabaseAttributeMeta[]): DatabaseSortRule => ({
  id: `sort-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  field: attributes[0]?.key ?? "",
  dir: "asc",
  nulls: "last",
  natural: true,
});

export const DatabaseSortPanel = ({
  attributes,
  sortRules,
  onChange,
  onClose,
}: DatabaseSortPanelProps) => {
  if (attributes.length === 0) {
    return (
      <aside
        className="database-block-panel database-block-sort-panel"
        data-md-block-control="true"
        role="dialog"
        aria-label="Database Sortierung"
      >
        <header className="database-block-panel-header">
          <h5>Sortierung</h5>
          <button type="button" className="database-block-panel-close" onClick={onClose} aria-label="Schliessen">
            ×
          </button>
        </header>
        <p className="database-block-state">Keine Attribute verfuegbar.</p>
      </aside>
    );
  }

  const updateRule = (ruleId: string, patch: Partial<DatabaseSortRule>) => {
    onChange(
      sortRules.map((rule) =>
        rule.id === ruleId
          ? { ...rule, ...patch }
          : rule),
    );
  };

  const removeRule = (ruleId: string) => {
    onChange(sortRules.filter((rule) => rule.id !== ruleId));
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, ruleId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ruleId);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetRuleId: string) => {
    const sourceRuleId = event.dataTransfer.getData("text/plain");
    if (!sourceRuleId || sourceRuleId === targetRuleId) {
      return;
    }
    event.preventDefault();

    const sourceIndex = sortRules.findIndex((rule) => rule.id === sourceRuleId);
    const targetIndex = sortRules.findIndex((rule) => rule.id === targetRuleId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextRules = [...sortRules];
    const [moved] = nextRules.splice(sourceIndex, 1);
    if (!moved) {
      return;
    }
    nextRules.splice(targetIndex, 0, moved);
    onChange(nextRules);
  };

  return (
    <aside
      className="database-block-panel database-block-sort-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Database Sortierung"
    >
      <header className="database-block-panel-header">
        <h5>Sortierung</h5>
        <button type="button" className="database-block-panel-close" onClick={onClose} aria-label="Schliessen">
          ×
        </button>
      </header>
      <div className="database-block-sort-list">
        {sortRules.map((rule) => (
          <div
            key={rule.id}
            className="database-block-sort-row"
            draggable
            onDragStart={(event) => handleDragStart(event, rule.id)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => handleDrop(event, rule.id)}
          >
            <select
              value={rule.field}
              onChange={(event) => updateRule(rule.id, { field: event.target.value })}
            >
              {attributes.map((attribute) => (
                <option key={attribute.key} value={attribute.key}>{attribute.key}</option>
              ))}
            </select>
            <select
              value={rule.dir}
              onChange={(event) => updateRule(rule.id, { dir: event.target.value === "desc" ? "desc" : "asc" })}
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
            <select
              value={rule.nulls ?? "last"}
              onChange={(event) => updateRule(rule.id, { nulls: event.target.value === "first" ? "first" : "last" })}
            >
              <option value="last">Nulls last</option>
              <option value="first">Nulls first</option>
            </select>
            <label className="database-block-sort-natural">
              <input
                type="checkbox"
                checked={Boolean(rule.natural)}
                onChange={(event) => updateRule(rule.id, { natural: event.target.checked })}
              />
              Natural
            </label>
            <button type="button" className="database-block-toolbar-button" onClick={() => removeRule(rule.id)}>
              Entfernen
            </button>
          </div>
        ))}
      </div>
      <footer className="database-block-panel-footer">
        <button
          type="button"
          className="database-block-toolbar-button"
          onClick={() => onChange([...sortRules, createDefaultSortRule(attributes)])}
        >
          Sortierung hinzufuegen
        </button>
      </footer>
    </aside>
  );
};
