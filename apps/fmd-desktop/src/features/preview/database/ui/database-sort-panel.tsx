/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-sort-panel.tsx
 *
 * Multi-level sort panel for database block.
 */

import { type DragEvent } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseSortRule,
  type DatabaseVaultAttributeSuggestion,
  type DatabaseViewType,
} from "../database-types";
import { DatabaseAttributeTypeahead } from "./database-attribute-typeahead";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDragText,
  setDropEffectSafe,
  startInternalDrag,
} from "../../../../lib/dragDrop";

type DatabaseSortPanelProps = {
  attributes: DatabaseAttributeMeta[];
  attributeSuggestions: DatabaseVaultAttributeSuggestion[];
  viewType: DatabaseViewType;
  sortRules: DatabaseSortRule[];
  onChange: (nextRules: DatabaseSortRule[]) => void;
  onClose: () => void;
};

const SORT_PANEL_HINTS: Record<DatabaseViewType, string> = {
  table: "Sortierung ordnet Tabellenzeilen.",
  kanban: "Sortierung ordnet Karten innerhalb jeder Spalte.",
  gantt: "Sortierung ordnet die vertikale Reihenfolge links und rechts synchron.",
  project: "Sortierung ordnet die vertikale Reihenfolge links und rechts synchron.",
  pie: "Sortierung steuert die Reihenfolge von Segmenten und Legende.",
};

const createDefaultSortRule = (suggestions: DatabaseVaultAttributeSuggestion[]): DatabaseSortRule => ({
  id: `sort-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  field: suggestions[0]?.key ?? "",
  dir: "asc",
  nulls: "last",
  natural: true,
});

export const DatabaseSortPanel = ({
  attributes,
  attributeSuggestions,
  viewType,
  sortRules,
  onChange,
  onClose,
}: DatabaseSortPanelProps) => {
  const viewHint = SORT_PANEL_HINTS[viewType];

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
    startInternalDrag(event, {
      channel: DRAG_CHANNELS.DATABASE_SORT_RULE,
      payload: ruleId,
      plainTextFallback: ruleId,
      effectAllowed: "move",
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetRuleId: string) => {
    const sourceRuleId = readInternalDragText(event, {
      channel: DRAG_CHANNELS.DATABASE_SORT_RULE,
    });
    if (!sourceRuleId || sourceRuleId === targetRuleId) {
      endInternalDrag(DRAG_CHANNELS.DATABASE_SORT_RULE);
      return;
    }
    event.preventDefault();

    const sourceIndex = sortRules.findIndex((rule) => rule.id === sourceRuleId);
    const targetIndex = sortRules.findIndex((rule) => rule.id === targetRuleId);
    if (sourceIndex < 0 || targetIndex < 0) {
      endInternalDrag(DRAG_CHANNELS.DATABASE_SORT_RULE);
      return;
    }

    const nextRules = [...sortRules];
    const [moved] = nextRules.splice(sourceIndex, 1);
    if (!moved) {
      endInternalDrag(DRAG_CHANNELS.DATABASE_SORT_RULE);
      return;
    }
    nextRules.splice(targetIndex, 0, moved);
    onChange(nextRules);
    endInternalDrag(DRAG_CHANNELS.DATABASE_SORT_RULE);
  };

  const hasSuggestionSource = attributeSuggestions.length > 0;

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
      <p className="database-block-panel-context">{viewHint}</p>
      {!hasSuggestionSource ? (
        <p className="database-block-state">Keine Vault-Attribute verfuegbar.</p>
      ) : null}
      <div className="database-block-sort-list">
        {sortRules.map((rule) => {
          const selectedAttribute = attributes.find((attribute) =>
            attribute.key.trim().toLowerCase() === rule.field.trim().toLowerCase()) ?? null;
          const isNaturalAllowed = selectedAttribute?.type !== "number";

          return (
            <div
              key={rule.id}
              className="database-block-sort-row"
              draggable
              onDragStart={(event) => handleDragStart(event, rule.id)}
              onDragOver={(event) => {
                event.preventDefault();
                setDropEffectSafe(event, "move");
              }}
              onDrop={(event) => handleDrop(event, rule.id)}
              onDragEnd={() => {
                endInternalDrag(DRAG_CHANNELS.DATABASE_SORT_RULE);
              }}
            >
              <DatabaseAttributeTypeahead
                value={rule.field}
                suggestions={attributeSuggestions}
                strictSelection
                placeholder="Attribut"
                onValueChange={(nextField) => updateRule(rule.id, { field: nextField })}
              />
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
                  disabled={!isNaturalAllowed}
                  onChange={(event) => updateRule(rule.id, { natural: event.target.checked })}
                />
                Natural
              </label>
              <button type="button" className="database-block-toolbar-button" onClick={() => removeRule(rule.id)}>
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
          onClick={() => onChange([...sortRules, createDefaultSortRule(attributeSuggestions)])}
          disabled={!hasSuggestionSource}
        >
          Sortierung hinzufuegen
        </button>
      </footer>
    </aside>
  );
};
