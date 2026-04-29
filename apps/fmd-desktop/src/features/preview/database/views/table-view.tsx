/**
 * @file apps/fmd-desktop/src/features/preview/database/views/table-view.tsx
 *
 * Virtualized table view for database records.
 */

import {
  type DragEvent,
  type KeyboardEvent,
  type UIEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DatabaseCellRenderer } from "../ui/database-cell-renderers";
import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
  type DatabaseSortRule,
} from "../database-types";
import { type MonitoringRenderProfile } from "../../../monitoring/monitoring-render-rules";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDragText,
  setDropEffectSafe,
  startInternalDrag,
} from "../../../../lib/dragDrop";

export type DatabaseTableBulkEditResult = {
  updated: number;
  failed: number;
  failedRecordIds: string[];
};

type DatabaseTableViewProps = {
  records: DatabaseRecord[];
  columns: DatabaseAttributeMeta[];
  sortRules: DatabaseSortRule[];
  editable: boolean;
  activeEditCell: {
    recordId: string;
    fieldKey: string;
    draftValue: string | boolean;
  } | null;
  pendingCellMutations: string[];
  monitoringProfiles?: MonitoringRenderProfile[];
  onOpenRecord: (record: DatabaseRecord) => void;
  onOpenExamFromRecord?: (record: DatabaseRecord) => void;
  onToggleColumnSort: (columnKey: string) => void;
  onReorderColumns: (fromKey: string, toKey: string) => void;
  onStartCellEdit: (record: DatabaseRecord, column: DatabaseAttributeMeta) => void;
  onEditCellDraftChange: (nextDraft: string | boolean) => void;
  onCommitCellEdit: (
    record: DatabaseRecord,
    column: DatabaseAttributeMeta,
    draftOverride?: string | boolean,
  ) => void;
  onBulkCommitCellEdit: (
    records: DatabaseRecord[],
    column: DatabaseAttributeMeta,
    draftValue: string | boolean,
  ) => Promise<DatabaseTableBulkEditResult>;
  onCancelCellEdit: () => void;
};

const TABLE_ROW_HEIGHT = 34;
const TABLE_OVERSCAN = 10;
const TABLE_MAX_VISIBLE_ROWS = 50;
const OPEN_RECORD_COLUMN_KEYS = new Set([
  "dateiname",
  "dateiname mit endung",
  "dateipfad",
]);

const toLower = (value: string) => value.trim().toLowerCase();

const buildMutationKey = (recordId: string, fieldKey: string) => `${recordId}::${toLower(fieldKey)}`;

const asTextValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(", ");
  }
  if (value && typeof value === "object" && "raw" in value) {
    return String((value as { raw?: unknown }).raw ?? "");
  }
  return "";
};

const resolveEditorInputType = (type: DatabaseAttributeMeta["type"]) => {
  if (type === "number" || type === "unit" || type === "percent") {
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

const getRecordValueByField = (record: DatabaseRecord, field: string) => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = field.trim().toLowerCase();
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => key.trim().toLowerCase() === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

const isExamFieldKey = (key: string) => toLower(key) === "exam";
const isInertFormulaAttribute = (attribute: DatabaseAttributeMeta) =>
  attribute.type === "formula" && toLower(attribute.key).startsWith("f-");

const isExamCellEligible = (record: DatabaseRecord, field: string) =>
  getRecordValueByField(record, field) === true;

type BulkCellSelection = {
  fieldKey: string;
  recordIds: string[];
};

export const DatabaseTableView = ({
  records,
  columns,
  sortRules,
  editable,
  activeEditCell,
  pendingCellMutations,
  monitoringProfiles = [],
  onOpenRecord,
  onOpenExamFromRecord,
  onToggleColumnSort,
  onReorderColumns,
  onStartCellEdit,
  onEditCellDraftChange,
  onCommitCellEdit,
  onBulkCommitCellEdit,
  onCancelCellEdit,
}: DatabaseTableViewProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);
  const [dropTargetColumnKey, setDropTargetColumnKey] = useState<string | null>(null);
  const [bulkSelection, setBulkSelection] = useState<BulkCellSelection | null>(null);
  const [bulkDraftValue, setBulkDraftValue] = useState<string | boolean>("");
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  const totalHeight = records.length * TABLE_ROW_HEIGHT;
  const viewportHeight = Math.min(records.length, TABLE_MAX_VISIBLE_ROWS) * TABLE_ROW_HEIGHT;

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / TABLE_ROW_HEIGHT) + TABLE_OVERSCAN * 2;
    const end = Math.min(records.length, start + visibleCount);
    return { start, end };
  }, [records.length, scrollTop, viewportHeight]);

  const visibleRows = records.slice(visibleRange.start, visibleRange.end);
  const pendingByKey = useMemo(
    () => new Set(pendingCellMutations),
    [pendingCellMutations],
  );
  const valueOptionsByField = useMemo(() => {
    const map = new Map<string, string[]>();
    columns.forEach((column) => {
      const key = toLower(column.key);
      const values = new Set<string>();
      records.forEach((record) => {
        const value = getRecordValueByField(record, column.key);
        const text = asTextValue(value).trim();
        if (text) {
          values.add(text);
        }
      });
      map.set(key, Array.from(values).slice(0, 200));
    });
    return map;
  }, [columns, records]);
  const sortRuleByKey = useMemo(() => {
    const next = new Map<string, DatabaseSortRule>();
    sortRules.forEach((rule) => {
      const normalized = toLower(rule.field);
      if (!normalized || next.has(normalized)) {
        return;
      }
      next.set(normalized, rule);
    });
    return next;
  }, [sortRules]);
  const selectedColumn = useMemo(
    () => bulkSelection
      ? columns.find((column) => toLower(column.key) === toLower(bulkSelection.fieldKey)) ?? null
      : null,
    [bulkSelection, columns],
  );
  const selectedRecordIds = useMemo(
    () => new Set(bulkSelection?.recordIds ?? []),
    [bulkSelection],
  );
  const selectedRecords = useMemo(
    () => records.filter((entry) => selectedRecordIds.has(entry.fileId)),
    [records, selectedRecordIds],
  );
  const hasSelectedPendingCells = Boolean(
    selectedColumn &&
    selectedRecords.some((entry) => pendingByKey.has(buildMutationKey(entry.fileId, selectedColumn.key))),
  );

  useEffect(() => {
    if (!bulkSelection) {
      return;
    }
    const availableRecordIds = new Set(records.map((entry) => entry.fileId));
    const nextRecordIds = bulkSelection.recordIds.filter((recordId) => availableRecordIds.has(recordId));
    const hasSelectedColumn = columns.some((column) => toLower(column.key) === toLower(bulkSelection.fieldKey));
    if (!hasSelectedColumn || nextRecordIds.length === 0) {
      setBulkSelection(null);
      return;
    }
    if (nextRecordIds.length !== bulkSelection.recordIds.length) {
      setBulkSelection({
        ...bulkSelection,
        recordIds: nextRecordIds,
      });
    }
  }, [bulkSelection, columns, records]);

  useEffect(() => {
    setBulkDraftValue(selectedColumn?.type === "boolean" ? false : "");
  }, [selectedColumn?.key, selectedColumn?.type]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const handleHeaderDragStart = (event: DragEvent<HTMLDivElement>, columnKey: string) => {
    startInternalDrag(event, {
      channel: DRAG_CHANNELS.DATABASE_COLUMN,
      payload: columnKey,
      plainTextFallback: columnKey,
      effectAllowed: "move",
    });
    setDraggedColumnKey(columnKey);
    setDropTargetColumnKey(null);
  };

  const handleHeaderDragOver = (event: DragEvent<HTMLDivElement>, targetColumnKey: string) => {
    event.preventDefault();
    setDropEffectSafe(event, "move");
    const sourceKey = readInternalDragText(event, {
      channel: DRAG_CHANNELS.DATABASE_COLUMN,
    });
    if (!sourceKey || toLower(sourceKey) === toLower(targetColumnKey)) {
      if (dropTargetColumnKey !== null) {
        setDropTargetColumnKey(null);
      }
      return;
    }
    if (toLower(dropTargetColumnKey ?? "") !== toLower(targetColumnKey)) {
      setDropTargetColumnKey(targetColumnKey);
    }
  };

  const handleHeaderDrop = (event: DragEvent<HTMLDivElement>, targetColumnKey: string) => {
    event.preventDefault();
    const sourceKey = readInternalDragText(event, {
      channel: DRAG_CHANNELS.DATABASE_COLUMN,
    });
    if (!sourceKey || toLower(sourceKey) === toLower(targetColumnKey)) {
      setDraggedColumnKey(null);
      setDropTargetColumnKey(null);
      endInternalDrag(DRAG_CHANNELS.DATABASE_COLUMN);
      return;
    }
    onReorderColumns(sourceKey, targetColumnKey);
    setDraggedColumnKey(null);
    setDropTargetColumnKey(null);
    endInternalDrag(DRAG_CHANNELS.DATABASE_COLUMN);
  };

  const handleHeaderDragEnd = () => {
    setDraggedColumnKey(null);
    setDropTargetColumnKey(null);
    endInternalDrag(DRAG_CHANNELS.DATABASE_COLUMN);
  };

  const handleEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    record: DatabaseRecord,
    column: DatabaseAttributeMeta,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancelCellEdit();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitCellEdit(record, column);
    }
  };

  const toggleBulkCellSelection = (record: DatabaseRecord, column: DatabaseAttributeMeta) => {
    setBulkSelection((previous) => {
      const sameColumn = previous && toLower(previous.fieldKey) === toLower(column.key);
      if (!sameColumn) {
        return {
          fieldKey: column.key,
          recordIds: [record.fileId],
        };
      }
      const selected = new Set(previous.recordIds);
      if (selected.has(record.fileId)) {
        selected.delete(record.fileId);
      } else {
        selected.add(record.fileId);
      }
      const nextRecordIds = Array.from(selected);
      return nextRecordIds.length > 0
        ? {
          fieldKey: previous.fieldKey,
          recordIds: nextRecordIds,
        }
        : null;
    });
  };

  const handleApplyBulkEdit = async () => {
    if (!selectedColumn || selectedRecords.length < 2 || isBulkApplying) {
      return;
    }
    setIsBulkApplying(true);
    try {
      const result = await onBulkCommitCellEdit(selectedRecords, selectedColumn, bulkDraftValue);
      if (result.failedRecordIds.length > 0) {
        const failedRecordIds = new Set(result.failedRecordIds);
        setBulkSelection({
          fieldKey: selectedColumn.key,
          recordIds: selectedRecords
            .filter((entry) => failedRecordIds.has(entry.fileId))
            .map((entry) => entry.fileId),
        });
        return;
      }
      setBulkSelection(null);
    } finally {
      setIsBulkApplying(false);
    }
  };

  const handleBulkEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setBulkSelection(null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void handleApplyBulkEdit();
    }
  };

  if (columns.length === 0) {
    return <div className="database-table-empty">Keine Attribute gefunden.</div>;
  }

  const bulkEditor = selectedColumn && selectedRecords.length > 0 ? (
    <div className="database-table-bulk-edit" data-md-block-control="true">
      <span className="database-table-bulk-edit-summary">
        {`${selectedRecords.length} Zelle${selectedRecords.length === 1 ? "" : "n"} in ${selectedColumn.label || selectedColumn.key}`}
      </span>
      {selectedColumn.type === "boolean" ? (
        <label className="database-table-bulk-boolean-editor">
          <input
            type="checkbox"
            checked={Boolean(bulkDraftValue)}
            onChange={(event) => setBulkDraftValue(event.target.checked)}
            onKeyDown={handleBulkEditorKeyDown}
            disabled={isBulkApplying}
            data-md-block-control="true"
          />
          Wert setzen
        </label>
      ) : (
        <>
          <input
            type={resolveEditorInputType(selectedColumn.type)}
            className="database-table-bulk-editor"
            value={typeof bulkDraftValue === "string" ? bulkDraftValue : ""}
            placeholder="Gemeinsamer Wert"
            onChange={(event) => setBulkDraftValue(event.target.value)}
            onKeyDown={handleBulkEditorKeyDown}
            list={selectedColumn.type === "select" || selectedColumn.type === "status"
              ? `database-bulk-cell-options-${toLower(selectedColumn.key).replace(/[^a-z0-9_-]/g, "-")}`
              : undefined}
            disabled={isBulkApplying}
            data-md-block-control="true"
          />
          {(selectedColumn.type === "select" || selectedColumn.type === "status") ? (
            <datalist id={`database-bulk-cell-options-${toLower(selectedColumn.key).replace(/[^a-z0-9_-]/g, "-")}`}>
              {(valueOptionsByField.get(toLower(selectedColumn.key)) ?? []).map((optionValue) => (
                <option key={optionValue} value={optionValue} />
              ))}
            </datalist>
          ) : null}
        </>
      )}
      <button
        type="button"
        className="database-block-toolbar-button"
        onClick={() => void handleApplyBulkEdit()}
        disabled={selectedRecords.length < 2 || hasSelectedPendingCells || isBulkApplying}
        data-md-block-control="true"
      >
        Anwenden
      </button>
      <button
        type="button"
        className="database-block-toolbar-button"
        onClick={() => setBulkSelection(null)}
        disabled={isBulkApplying}
        data-md-block-control="true"
      >
        Auswahl loeschen
      </button>
    </div>
  ) : null;

  return (
    <div className="database-table-view">
      {bulkEditor}
      <div className="database-table-header-row" role="row">
        {columns.map((column) => {
          const sortRule = sortRuleByKey.get(toLower(column.key)) ?? null;
          const sortDirection = sortRule?.dir ?? null;
          const isDragging = Boolean(draggedColumnKey) && toLower(draggedColumnKey ?? "") === toLower(column.key);
          const isDropTarget = Boolean(dropTargetColumnKey) &&
            toLower(dropTargetColumnKey ?? "") === toLower(column.key);
          return (
            <div
              key={column.key}
              className={`database-table-header-cell${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop-target" : ""}`}
              role="columnheader"
              aria-sort={
                sortDirection === "asc"
                  ? "ascending"
                  : sortDirection === "desc"
                  ? "descending"
                  : "none"
              }
              draggable
              onDragStart={(event) => handleHeaderDragStart(event, column.key)}
              onDragOver={(event) => handleHeaderDragOver(event, column.key)}
              onDrop={(event) => handleHeaderDrop(event, column.key)}
              onDragEnd={handleHeaderDragEnd}
              data-md-block-control="true"
            >
              <button
                type="button"
                className={`database-table-header-button${sortDirection ? " is-sorted" : ""}`}
                onClick={() => onToggleColumnSort(column.key)}
                data-md-block-control="true"
              >
                <span className="database-table-header-label">{column.label}</span>
                {sortDirection ? (
                  <span className="database-table-header-sort-indicator" aria-hidden="true">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
      <div
        className="database-table-scroll"
        role="rowgroup"
        onScroll={handleScroll}
        style={{ maxHeight: `${viewportHeight}px` }}
      >
        <div className="database-table-spacer" style={{ height: `${totalHeight}px` }}>
          {visibleRows.map((record, localIndex) => {
            const rowIndex = visibleRange.start + localIndex;
            const top = rowIndex * TABLE_ROW_HEIGHT;
            return (
              <div
                key={record.fileId}
                className="database-table-row"
                role="row"
                style={{
                  top: `${top}px`,
                  height: `${TABLE_ROW_HEIGHT}px`,
                }}
                data-md-block-control="true"
              >
                {columns.map((column) => {
                  const isInertFormulaCell = isInertFormulaAttribute(column);
                  const isSelectableCell = editable && column.editable && !isInertFormulaCell;
                  const isSelectedCell = bulkSelection !== null &&
                    toLower(bulkSelection.fieldKey) === toLower(column.key) &&
                    selectedRecordIds.has(record.fileId);
                  const isEditingCell = !isInertFormulaCell &&
                    activeEditCell !== null &&
                    activeEditCell.recordId === record.fileId &&
                    toLower(activeEditCell.fieldKey) === toLower(column.key);

                  return (
                    <span
                      key={`${record.fileId}:${column.key}`}
                      className={`database-table-cell${isEditingCell ? " is-editing" : ""}${
                        isSelectedCell ? " is-selected" : ""
                      }${
                        pendingByKey.has(buildMutationKey(record.fileId, column.key))
                          ? " is-pending"
                          : ""
                      }${isInertFormulaCell ? " is-inert" : ""}`}
                      role="cell"
                      aria-readonly={isInertFormulaCell ? "true" : undefined}
                      onDoubleClick={() => {
                        if (isInertFormulaCell || !editable || !column.editable) {
                          return;
                        }
                        onStartCellEdit(record, column);
                      }}
                    >
                      {isSelectableCell ? (
                        <input
                          type="checkbox"
                          className="database-table-cell-select"
                          checked={isSelectedCell}
                          aria-label={`Zelle fuer Bulk Edit auswaehlen: ${column.label || column.key} ${record.relativePath}`}
                          onChange={() => toggleBulkCellSelection(record, column)}
                          onDoubleClick={(event) => event.stopPropagation()}
                          disabled={pendingByKey.has(buildMutationKey(record.fileId, column.key))}
                          data-md-block-control="true"
                        />
                      ) : null}
                      {isEditingCell && activeEditCell ? (
                        column.type === "boolean" ? (
                          <label className="database-table-cell-boolean-editor">
                            <input
                              type="checkbox"
                              checked={Boolean(activeEditCell.draftValue)}
                              onChange={(event) => {
                                onEditCellDraftChange(event.target.checked);
                                onCommitCellEdit(record, column, event.target.checked);
                              }}
                              onKeyDown={(event) => handleEditorKeyDown(event, record, column)}
                              disabled={pendingByKey.has(buildMutationKey(record.fileId, column.key))}
                              autoFocus
                              data-md-block-control="true"
                            />
                          </label>
                        ) : (
                          <>
                            <input
                              type={resolveEditorInputType(column.type)}
                              value={typeof activeEditCell.draftValue === "string" ? activeEditCell.draftValue : ""}
                              className="database-table-cell-editor"
                              onChange={(event) => onEditCellDraftChange(event.target.value)}
                              onBlur={() => onCommitCellEdit(record, column)}
                              onKeyDown={(event) => handleEditorKeyDown(event, record, column)}
                              list={column.type === "select" || column.type === "status"
                                ? `database-cell-options-${toLower(column.key).replace(/[^a-z0-9_-]/g, "-")}`
                                : undefined}
                              disabled={pendingByKey.has(buildMutationKey(record.fileId, column.key))}
                              autoFocus
                              data-md-block-control="true"
                            />
                            {(column.type === "select" || column.type === "status") ? (
                              <datalist id={`database-cell-options-${toLower(column.key).replace(/[^a-z0-9_-]/g, "-")}`}>
                                {(valueOptionsByField.get(toLower(column.key)) ?? []).map((optionValue) => (
                                  <option key={optionValue} value={optionValue} />
                                ))}
                              </datalist>
                            ) : null}
                          </>
                        )
                      ) : OPEN_RECORD_COLUMN_KEYS.has(column.key.trim().toLowerCase()) ? (
                        <button
                          type="button"
                          className="database-table-open-record"
                          onClick={() => onOpenRecord(record)}
                          title="Datei oeffnen"
                          data-md-block-control="true"
                        >
                          <DatabaseCellRenderer
                            attribute={column}
                            value={getRecordValueByField(record, column.key)}
                            monitoringProfiles={monitoringProfiles}
                          />
                        </button>
                      ) : isExamFieldKey(column.key) ? (
                        isExamCellEligible(record, column.key) && onOpenExamFromRecord ? (
                          <button
                            type="button"
                            className="database-exam-action"
                            onClick={() => onOpenExamFromRecord(record)}
                            title="Exam starten"
                            data-md-block-control="true"
                          >
                            Exam
                          </button>
                        ) : (
                          <span className="database-cell-empty">—</span>
                        )
                      ) : (
                        <DatabaseCellRenderer
                          attribute={column}
                          value={getRecordValueByField(record, column.key)}
                          monitoringProfiles={monitoringProfiles}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
