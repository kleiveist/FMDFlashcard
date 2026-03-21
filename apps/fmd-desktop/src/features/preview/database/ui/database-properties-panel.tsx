/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-properties-panel.tsx
 *
 * Properties panel for visible database columns.
 */

import { type DragEvent, useMemo, useState } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseFieldType,
} from "../database-types";

type DatabasePropertiesPanelProps = {
  attributes: DatabaseAttributeMeta[];
  visibleColumnKeys: string[];
  onToggleVisibility: (key: string, visible: boolean) => void;
  onReorderVisibleColumns: (fromKey: string, toKey: string) => void;
  onHideAll: () => void;
  onRestoreDefault: () => void;
  onCreateAttribute: (payload: {
    key: string;
    type: DatabaseFieldType;
    initialValue: string;
    overwriteExisting: boolean;
  }) => Promise<void>;
  onCreateFormula: (payload: {
    key: string;
    label?: string;
    type: DatabaseFieldType;
    formula: string;
  }) => void;
  isMutatingFrontmatter: boolean;
  onClose: () => void;
};

const fieldTypeOptions: DatabaseFieldType[] = [
  "text",
  "longtext",
  "number",
  "percent",
  "boolean",
  "date",
  "datetime",
  "select",
  "multiselect",
  "tags",
  "link",
  "file",
  "image",
  "status",
  "rating",
  "relation",
  "formula",
  "duration",
  "progress",
  "score",
];

const resolveTypeIcon = (type: DatabaseFieldType) => {
  switch (type) {
    case "number":
    case "percent":
    case "score":
      return "#";
    case "date":
    case "datetime":
      return "🕒";
    case "tags":
    case "multiselect":
      return "🏷";
    case "boolean":
      return "✓";
    case "link":
      return "↗";
    case "formula":
      return "ƒ";
    default:
      return "Aa";
  }
};

export const DatabasePropertiesPanel = ({
  attributes,
  visibleColumnKeys,
  onToggleVisibility,
  onReorderVisibleColumns,
  onHideAll,
  onRestoreDefault,
  onCreateAttribute,
  onCreateFormula,
  isMutatingFrontmatter,
  onClose,
}: DatabasePropertiesPanelProps) => {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DatabaseFieldType | "all">("all");
  const [newAttributeKey, setNewAttributeKey] = useState("");
  const [newAttributeType, setNewAttributeType] = useState<DatabaseFieldType>("text");
  const [newAttributeValue, setNewAttributeValue] = useState("");
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [newFormulaKey, setNewFormulaKey] = useState("");
  const [newFormulaLabel, setNewFormulaLabel] = useState("");
  const [newFormulaType, setNewFormulaType] = useState<DatabaseFieldType>("formula");
  const [newFormulaExpression, setNewFormulaExpression] = useState("");

  const visibleByKey = useMemo(
    () => new Set(visibleColumnKeys.map((key) => key.toLowerCase())),
    [visibleColumnKeys],
  );

  const filteredAttributes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return attributes.filter((attribute) => {
      if (typeFilter !== "all" && attribute.type !== typeFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        attribute.key.toLowerCase().includes(normalizedQuery) ||
        attribute.type.toLowerCase().includes(normalizedQuery) ||
        attribute.origin.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [attributes, query, typeFilter]);

  const typeOptions = useMemo(
    () => ["all", ...new Set(attributes.map((attribute) => attribute.type))],
    [attributes],
  );

  const handleDragStart = (event: DragEvent<HTMLLIElement>, key: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>, targetKey: string) => {
    const sourceKey = event.dataTransfer.getData("text/plain");
    if (!sourceKey || sourceKey === targetKey) {
      return;
    }
    event.preventDefault();
    onReorderVisibleColumns(sourceKey, targetKey);
  };

  const handleCreateAttributeSubmit = async () => {
    if (!newAttributeKey.trim()) {
      return;
    }
    await onCreateAttribute({
      key: newAttributeKey.trim(),
      type: newAttributeType,
      initialValue: newAttributeValue,
      overwriteExisting,
    });
    setNewAttributeKey("");
    setNewAttributeValue("");
    setOverwriteExisting(false);
  };

  const handleCreateFormulaSubmit = () => {
    if (!newFormulaKey.trim() || !newFormulaExpression.trim()) {
      return;
    }
    onCreateFormula({
      key: newFormulaKey.trim(),
      label: newFormulaLabel.trim() || undefined,
      type: newFormulaType,
      formula: newFormulaExpression.trim(),
    });
    setNewFormulaKey("");
    setNewFormulaLabel("");
    setNewFormulaExpression("");
  };

  return (
    <aside
      className="database-block-panel database-block-properties-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Database Eigenschaften"
    >
      <header className="database-block-panel-header">
        <h5>Eigenschaften</h5>
        <button type="button" className="database-block-panel-close" onClick={onClose} aria-label="Schliessen">
          ×
        </button>
      </header>
      <div className="database-block-panel-controls">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Eigenschaft suchen"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as DatabaseFieldType | "all")}
        >
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "Alle Typen" : option}
            </option>
          ))}
        </select>
      </div>
      <ul className="database-block-properties-list">
        {filteredAttributes.map((attribute) => {
          const isVisible = visibleByKey.has(attribute.key.toLowerCase());
          return (
            <li
              key={attribute.key}
              className={`database-block-properties-item${isVisible ? " is-visible" : ""}`}
              draggable={isVisible}
              onDragStart={(event) => handleDragStart(event, attribute.key)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => handleDrop(event, attribute.key)}
            >
              <label>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(event) => onToggleVisibility(attribute.key, event.target.checked)}
                />
                <span className="database-block-properties-icon" aria-hidden="true">{resolveTypeIcon(attribute.type)}</span>
                <span className="database-block-properties-key">{attribute.label || attribute.key}</span>
                <span className="database-block-properties-type">{attribute.type}</span>
                <span className="database-block-properties-origin">{attribute.origin}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <section className="database-block-properties-create">
        <h6>Attribut hinzufügen</h6>
        <div className="database-block-panel-controls">
          <input
            type="text"
            value={newAttributeKey}
            onChange={(event) => setNewAttributeKey(event.target.value)}
            placeholder="Name"
          />
          <select
            value={newAttributeType}
            onChange={(event) => setNewAttributeType(event.target.value as DatabaseFieldType)}
          >
            {fieldTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input
            type="text"
            value={newAttributeValue}
            onChange={(event) => setNewAttributeValue(event.target.value)}
            placeholder="Startwert"
          />
        </div>
        <label className="database-block-properties-toggle">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(event) => setOverwriteExisting(event.target.checked)}
          />
          Bestehende Werte überschreiben
        </label>
        <button
          type="button"
          className="database-block-toolbar-button"
          onClick={() => void handleCreateAttributeSubmit()}
          disabled={isMutatingFrontmatter}
        >
          {isMutatingFrontmatter ? "Speichert..." : "Attribut anlegen"}
        </button>
      </section>

      <section className="database-block-properties-create">
        <h6>Formel hinzufügen</h6>
        <div className="database-block-panel-controls">
          <input
            type="text"
            value={newFormulaKey}
            onChange={(event) => setNewFormulaKey(event.target.value)}
            placeholder="Key"
          />
          <input
            type="text"
            value={newFormulaLabel}
            onChange={(event) => setNewFormulaLabel(event.target.value)}
            placeholder="Label (optional)"
          />
          <select
            value={newFormulaType}
            onChange={(event) => setNewFormulaType(event.target.value as DatabaseFieldType)}
          >
            {fieldTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input
            type="text"
            value={newFormulaExpression}
            onChange={(event) => setNewFormulaExpression(event.target.value)}
            placeholder="concat(percent, ' / ', status)"
          />
        </div>
        <button
          type="button"
          className="database-block-toolbar-button"
          onClick={handleCreateFormulaSubmit}
        >
          Formel anlegen
        </button>
      </section>

      <footer className="database-block-panel-footer">
        <button type="button" className="database-block-toolbar-button" onClick={onHideAll}>Alle ausblenden</button>
        <button type="button" className="database-block-toolbar-button" onClick={onRestoreDefault}>Standard wiederherstellen</button>
      </footer>
    </aside>
  );
};
