/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-properties-panel.tsx
 *
 * Properties panel for visible database columns.
 */

import { type DragEvent, useMemo, useState } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseFieldType,
  type DatabaseRecord,
  type DatabaseVaultAttributeSuggestion,
  type DatabaseViewType,
} from "../database-types";
import { DatabaseAttributeTypeahead } from "./database-attribute-typeahead";
import {
  CORE_ATTRIBUTE_TYPE_OPTIONS,
  DATABASE_EXTENDED_TYPE_OPTIONS,
  mapCoreTypeToDatabaseFieldType,
  resolveDatabaseFieldTypeIcon,
  resolveDatabaseFieldTypeLabel,
  type CoreAttributeTypeId,
} from "../../attribute-type-catalog";
import {
  buildDefaultDatabaseFormulaDefinitionV1,
  type DatabaseFormulaDefinitionV1,
} from "../../formula/database-formula-types";
import { normalizeFormulaSourceForPersist } from "../../formula/formula-source-registry";
import {
  FormulaAttributeBuilder,
  type FormulaBuilderAttributeOption,
} from "../../formula/formula-attribute-builder";
import { FrontmatterPropertyIconView } from "../../frontmatter-property-icons";
import { TrashIcon } from "../../../../components/icons";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDragText,
  setDropEffectSafe,
  startInternalDrag,
} from "../../../../lib/dragDrop";

type DatabasePropertiesPanelProps = {
  attributes: DatabaseAttributeMeta[];
  records: DatabaseRecord[];
  attributeSuggestions: DatabaseVaultAttributeSuggestion[];
  viewType: DatabaseViewType;
  visibleColumnKeys: string[];
  kanbanShowCover: boolean;
  availableFolders?: string[];
  historyFolderPath?: string | null;
  historyWarning?: string | null;
  onKanbanShowCoverChange: (next: boolean) => void;
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
  onCreateFormula: (payload: { key: string; definition: DatabaseFormulaDefinitionV1 }) => void;
  onRemoveFormula: (key: string) => void;
  isMutatingFrontmatter: boolean;
  onClose: () => void;
};

const toLower = (value: string) => value.trim().toLowerCase();
const shortTextNumericPattern = /[-+]?(?:\d+(?:[.,]\d+)?|\.\d+)/g;

const supportsMathByFieldType = (type: DatabaseFieldType) => {
  if (
    type === "number" ||
    type === "unit" ||
    type === "percent" ||
    type === "score" ||
    type === "rating" ||
    type === "progress" ||
    type === "status" ||
    type === "formula"
  ) {
    return true;
  }
  return false;
};

const getCaseInsensitiveRecordValue = (record: DatabaseRecord, key: string) => {
  if (key in record.normalizedFields) {
    return record.normalizedFields[key];
  }
  const normalizedKey = toLower(key);
  const matchedKey = Object.keys(record.normalizedFields).find(
    (entryKey) => toLower(entryKey) === normalizedKey,
  );
  return matchedKey ? record.normalizedFields[matchedKey] : null;
};

const isShortNumericText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 32) {
    return false;
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) {
    return false;
  }
  const numericMatches = trimmed.match(shortTextNumericPattern) ?? [];
  return numericMatches.length === 1;
};

const hasMathCompatibleTextValues = (records: DatabaseRecord[], key: string) => {
  for (const record of records) {
    const raw = getCaseInsensitiveRecordValue(record, key);
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return true;
    }
    if (typeof raw === "string" && isShortNumericText(raw)) {
      return true;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const candidate = raw as { raw?: unknown; value?: unknown; rank?: unknown };
      if (typeof candidate.value === "number" && Number.isFinite(candidate.value)) {
        return true;
      }
      if (typeof candidate.rank === "number" && Number.isFinite(candidate.rank)) {
        return true;
      }
      if (typeof candidate.raw === "string" && isShortNumericText(candidate.raw)) {
        return true;
      }
    }
  }
  return false;
};

const dedupeCaseInsensitive = (keys: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  keys.forEach((key) => {
    const trimmed = key.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(trimmed);
  });
  return next;
};

const toCreateTypeSelection = (
  value: string,
): {
  fieldType: DatabaseFieldType;
  coreTypeId: CoreAttributeTypeId | null;
} => {
  if (value.startsWith("core:")) {
    const coreTypeId = value.slice("core:".length) as CoreAttributeTypeId;
    return {
      fieldType: mapCoreTypeToDatabaseFieldType(coreTypeId),
      coreTypeId,
    };
  }
  const fieldType = value.startsWith("extended:")
    ? (value.slice("extended:".length) as DatabaseFieldType)
    : "text";
  return {
    fieldType,
    coreTypeId: null,
  };
};

export const DatabasePropertiesPanel = ({
  attributes,
  records,
  attributeSuggestions,
  viewType,
  visibleColumnKeys,
  kanbanShowCover,
  availableFolders,
  historyFolderPath = null,
  historyWarning = null,
  onKanbanShowCoverChange,
  onToggleVisibility,
  onReorderVisibleColumns,
  onHideAll,
  onRestoreDefault,
  onCreateAttribute,
  onCreateFormula,
  onRemoveFormula,
  isMutatingFrontmatter,
  onClose,
}: DatabasePropertiesPanelProps) => {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DatabaseFieldType | "all">("all");
  const [newAttributeKey, setNewAttributeKey] = useState("");
  const [createTypeSelection, setCreateTypeSelection] = useState<string>("core:text");
  const [newAttributeValue, setNewAttributeValue] = useState("");
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [formulaDefinition, setFormulaDefinition] = useState<DatabaseFormulaDefinitionV1>(
    buildDefaultDatabaseFormulaDefinitionV1(),
  );

  const selectedCreateType = useMemo(
    () => toCreateTypeSelection(createTypeSelection),
    [createTypeSelection],
  );

  const isFormulaCreateMode = selectedCreateType.fieldType === "formula";
  const createKeySuggestionFilter = useMemo(
    () =>
      isFormulaCreateMode
        ? (suggestion: DatabaseVaultAttributeSuggestion) =>
            suggestion.normalizedKey.trim().toLowerCase().startsWith("f-")
        : undefined,
    [isFormulaCreateMode],
  );

  const formulaAttributeOptions = useMemo<FormulaBuilderAttributeOption[]>(
    () =>
      attributes
        .filter((attribute) => toLower(attribute.key) !== toLower(newAttributeKey))
        .map((attribute) => ({
          key: attribute.key,
          label: attribute.label || attribute.key,
          supportsMath:
            supportsMathByFieldType(attribute.type) ||
            (attribute.type === "text" && hasMathCompatibleTextValues(records, attribute.key)),
        })),
    [attributes, newAttributeKey, records],
  );

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

  const viewLabel = useMemo(() => {
    switch (viewType) {
      case "table":
        return "Table";
      case "kanban":
        return "Kanban";
      case "gantt":
        return "Timeline";
      case "project":
        return "Project";
      case "pie":
        return "Pie";
      default:
        return viewType;
    }
  }, [viewType]);

  const handleDragStart = (event: DragEvent<HTMLLIElement>, key: string) => {
    startInternalDrag(event, {
      channel: DRAG_CHANNELS.DATABASE_VISIBLE_COLUMN,
      payload: key,
      plainTextFallback: key,
      effectAllowed: "move",
    });
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>, targetKey: string) => {
    const sourceKey = readInternalDragText(event, {
      channel: DRAG_CHANNELS.DATABASE_VISIBLE_COLUMN,
    });
    if (!sourceKey || sourceKey === targetKey) {
      endInternalDrag(DRAG_CHANNELS.DATABASE_VISIBLE_COLUMN);
      return;
    }
    event.preventDefault();
    onReorderVisibleColumns(sourceKey, targetKey);
    endInternalDrag(DRAG_CHANNELS.DATABASE_VISIBLE_COLUMN);
  };

  const resetCreateDraft = () => {
    setNewAttributeKey("");
    setCreateTypeSelection("core:text");
    setNewAttributeValue("");
    setOverwriteExisting(false);
    setFormulaDefinition(buildDefaultDatabaseFormulaDefinitionV1());
  };

  const handleCreateAttributeSubmit = async () => {
    const trimmedKey = newAttributeKey.trim();
    if (!trimmedKey) {
      setCreateError("Bitte einen Attribut-Namen angeben.");
      return;
    }
    if (trimmedKey.includes(":")) {
      setCreateError("Attribut-Name darf kein ':' enthalten.");
      return;
    }

    if (isFormulaCreateMode) {
      if (!trimmedKey.startsWith("f-")) {
        setCreateError("Formel-Attribute muessen mit 'f-' beginnen.");
        return;
      }
      const selectedAttributeKeys = dedupeCaseInsensitive(formulaDefinition.attributeKeys);
      if (selectedAttributeKeys.length === 0) {
        setCreateError("Bitte mindestens ein Quell-Attribut fuer die Formel waehlen.");
        return;
      }

      const normalizedSource = normalizeFormulaSourceForPersist(formulaDefinition.source);

      if (normalizedSource.type === "explicit-folder" && !normalizedSource.path) {
        setCreateError("Bitte einen Ordner fuer die Formelquelle angeben.");
        return;
      }

      if (normalizedSource.type === "multi-folder" && (normalizedSource.paths ?? []).length === 0) {
        setCreateError("Bitte mindestens einen Ordner fuer die Formelquelle angeben.");
        return;
      }

      onCreateFormula({
        key: trimmedKey,
        definition: {
          ...formulaDefinition,
          attributeKeys: selectedAttributeKeys,
          source: normalizedSource,
        },
      });
      setCreateError("");
      resetCreateDraft();
      return;
    }

    await onCreateAttribute({
      key: trimmedKey,
      type: selectedCreateType.fieldType,
      initialValue: newAttributeValue,
      overwriteExisting,
    });
    setCreateError("");
    resetCreateDraft();
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
        <button
          type="button"
          className="database-block-panel-close"
          onClick={onClose}
          aria-label="Schliessen"
        >
          ×
        </button>
      </header>
      <p className="database-block-state">Aktiver View: {viewLabel}</p>
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
        {viewType === "kanban" ? (
          <label className="database-block-properties-toggle">
            <input
              type="checkbox"
              checked={kanbanShowCover}
              onChange={(event) => onKanbanShowCoverChange(event.target.checked)}
            />
            Cover anzeigen
          </label>
        ) : null}
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
                setDropEffectSafe(event, "move");
              }}
              onDrop={(event) => handleDrop(event, attribute.key)}
              onDragEnd={() => {
                endInternalDrag(DRAG_CHANNELS.DATABASE_VISIBLE_COLUMN);
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(event) => onToggleVisibility(attribute.key, event.target.checked)}
                />
                <span className="database-block-properties-icon" aria-hidden="true">
                  <FrontmatterPropertyIconView
                    icon={resolveDatabaseFieldTypeIcon(attribute.type)}
                  />
                </span>
                <span className="database-block-properties-key">
                  {attribute.label || attribute.key}
                </span>
                <span className="database-block-properties-type">
                  {resolveDatabaseFieldTypeLabel(attribute.type)}
                </span>
                <span className="database-block-properties-origin">{attribute.origin}</span>
                {attribute.origin === "formula" ? (
                  <button
                    type="button"
                    className="database-block-properties-delete"
                    draggable={false}
                    aria-label={`Formel-Property ${attribute.key} entfernen`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemoveFormula(attribute.key);
                    }}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
                {attribute.legacyFormulaIncompatible ? (
                  <span className="database-block-properties-origin">Legacy inkompatibel</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

      <section className="database-block-properties-create">
        <h6>Attribut hinzufügen</h6>
        <div className="database-block-panel-controls">
          <DatabaseAttributeTypeahead
            value={newAttributeKey}
            suggestions={attributeSuggestions}
            suggestionFilter={createKeySuggestionFilter}
            placeholder={isFormulaCreateMode ? "f-status" : "Name"}
            onValueChange={setNewAttributeKey}
          />
          <select
            value={createTypeSelection}
            onChange={(event) => setCreateTypeSelection(event.target.value)}
          >
            <optgroup label="Kern">
              {CORE_ATTRIBUTE_TYPE_OPTIONS.map((option) => (
                <option key={`core-${option.id}`} value={`core:${option.id}`}>
                  {option.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Erweitert">
              {DATABASE_EXTENDED_TYPE_OPTIONS.map((option) => (
                <option key={`extended-${option.fieldType}`} value={`extended:${option.fieldType}`}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
          {!isFormulaCreateMode ? (
            <input
              type="text"
              value={newAttributeValue}
              onChange={(event) => setNewAttributeValue(event.target.value)}
              placeholder="Startwert"
            />
          ) : null}
        </div>

        {isFormulaCreateMode ? (
          <FormulaAttributeBuilder
            idPrefix="database-create-formula"
            value={formulaDefinition}
            attributes={formulaAttributeOptions}
            folderSuggestions={availableFolders}
            historyFolderPath={historyFolderPath}
            historyWarning={historyWarning}
            onChange={setFormulaDefinition}
          />
        ) : (
          <label className="database-block-properties-toggle">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(event) => setOverwriteExisting(event.target.checked)}
            />
            Bestehende Werte überschreiben
          </label>
        )}

        {createError ? <p className="database-block-state">{createError}</p> : null}

        <button
          type="button"
          className="database-block-toolbar-button"
          onClick={() => void handleCreateAttributeSubmit()}
          disabled={isMutatingFrontmatter}
        >
          {isMutatingFrontmatter ? "Speichert..." : "Attribut anlegen"}
        </button>
      </section>

      <footer className="database-block-panel-footer">
        <button type="button" className="database-block-toolbar-button" onClick={onHideAll}>
          Alle ausblenden
        </button>
        <button type="button" className="database-block-toolbar-button" onClick={onRestoreDefault}>
          Standard wiederherstellen
        </button>
      </footer>
    </aside>
  );
};
