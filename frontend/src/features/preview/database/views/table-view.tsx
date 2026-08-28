/**
 * @file frontend/src/features/preview/database/views/table-view.tsx
 *
 * Virtualized table view for database records.
 */

import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
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
  columnWidths?: Record<string, number>;
  monitoringProfiles?: MonitoringRenderProfile[];
  onOpenRecord: (record: DatabaseRecord) => void;
  onOpenExamFromRecord?: (record: DatabaseRecord) => void;
  onToggleColumnSort: (columnKey: string) => void;
  onReorderColumns: (fromKey: string, toKey: string) => void;
  onResizeColumn?: (columnKey: string, width: number) => void;
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
const TABLE_DEFAULT_COLUMN_WIDTH = 180;
const TABLE_MIN_COLUMN_WIDTH = 96;
const TABLE_MAX_COLUMN_WIDTH = 640;
const EMPTY_COLUMN_WIDTHS: Record<string, number> = {};
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
  anchorRecordId: string;
};

type ColumnResizeState = {
  columnKey: string;
  pointerStartX: number;
  startWidth: number;
};

const isInteractiveCellTarget = (target: EventTarget | null, currentTarget: HTMLElement) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const interactive = target.closest("button, input, select, textarea, [contenteditable='true']");
  return Boolean(interactive && currentTarget.contains(interactive));
};

const clampColumnWidth = (width: number) =>
  Math.min(TABLE_MAX_COLUMN_WIDTH, Math.max(TABLE_MIN_COLUMN_WIDTH, Math.round(width)));

const getColumnWidth = (widths: Record<string, number>, columnKey: string) => {
  const direct = widths[columnKey];
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return clampColumnWidth(direct);
  }
  const normalizedColumnKey = toLower(columnKey);
  const matchedKey = Object.keys(widths).find((key) => toLower(key) === normalizedColumnKey);
  const matched = matchedKey ? widths[matchedKey] : undefined;
  return typeof matched === "number" && Number.isFinite(matched)
    ? clampColumnWidth(matched)
    : TABLE_DEFAULT_COLUMN_WIDTH;
};

export const DatabaseTableView = ({
  records,
  columns,
  sortRules,
  editable,
  activeEditCell,
  pendingCellMutations,
  columnWidths = EMPTY_COLUMN_WIDTHS,
  monitoringProfiles = [],
  onOpenRecord,
  onOpenExamFromRecord,
  onToggleColumnSort,
  onReorderColumns,
  onResizeColumn,
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const [draftColumnWidths, setDraftColumnWidths] = useState<Record<string, number>>(columnWidths);
  const [resizeState, setResizeState] = useState<ColumnResizeState | null>(null);

  const totalHeight = records.length * TABLE_ROW_HEIGHT;
  const viewportHeight = Math.min(records.length, TABLE_MAX_VISIBLE_ROWS) * TABLE_ROW_HEIGHT;

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / TABLE_ROW_HEIGHT) + TABLE_OVERSCAN * 2;
    const end = Math.min(records.length, start + visibleCount);
    return { start, end };
  }, [records.length, scrollTop, viewportHeight]);

  const visibleRows = records.slice(visibleRange.start, visibleRange.end);
  const effectiveColumnWidths = useMemo(
    () => columns.reduce<Record<string, number>>((next, column) => {
      next[column.key] = getColumnWidth(draftColumnWidths, column.key);
      return next;
    }, {}),
    [columns, draftColumnWidths],
  );
  const gridTemplateColumns = useMemo(
    () => columns.map((column) => `${effectiveColumnWidths[column.key] ?? TABLE_DEFAULT_COLUMN_WIDTH}px`).join(" "),
    [columns, effectiveColumnWidths],
  );
  const tableContentWidth = useMemo(
    () => columns.reduce((sum, column) => sum + (effectiveColumnWidths[column.key] ?? TABLE_DEFAULT_COLUMN_WIDTH), 0),
    [columns, effectiveColumnWidths],
  );
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
      const nextAnchorRecordId = nextRecordIds.includes(bulkSelection.anchorRecordId)
        ? bulkSelection.anchorRecordId
        : nextRecordIds[0]!;
      setBulkSelection({
        ...bulkSelection,
        recordIds: nextRecordIds,
        anchorRecordId: nextAnchorRecordId,
      });
    }
  }, [bulkSelection, columns, records]);

  useEffect(() => {
    setBulkDraftValue(selectedColumn?.type === "boolean" ? false : "");
  }, [selectedColumn?.key, selectedColumn?.type]);

  useEffect(() => {
    setDraftColumnWidths(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    if (!resizeState) {
      return;
    }

    const resolveNextWidth = (clientX: number) =>
      clampColumnWidth(resizeState.startWidth + (clientX - resizeState.pointerStartX));

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = resolveNextWidth(event.clientX);
      setDraftColumnWidths((current) => ({
        ...current,
        [resizeState.columnKey]: nextWidth,
      }));
    };

    const handlePointerUp = (event: PointerEvent) => {
      const nextWidth = resolveNextWidth(event.clientX);
      setDraftColumnWidths((current) => ({
        ...current,
        [resizeState.columnKey]: nextWidth,
      }));
      setResizeState(null);
      onResizeColumn?.(resizeState.columnKey, nextWidth);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onResizeColumn, resizeState]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
    setScrollLeft(event.currentTarget.scrollLeft);
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

  const handleColumnResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    column: DatabaseAttributeMeta,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setResizeState({
      columnKey: column.key,
      pointerStartX: event.clientX,
      startWidth: effectiveColumnWidths[column.key] ?? TABLE_DEFAULT_COLUMN_WIDTH,
    });
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

  const resolveSelectableRangeRecordIds = (
    fromRecordId: string,
    toRecordId: string,
    column: DatabaseAttributeMeta,
  ) => {
    const fromIndex = records.findIndex((entry) => entry.fileId === fromRecordId);
    const toIndex = records.findIndex((entry) => entry.fileId === toRecordId);
    if (fromIndex < 0 || toIndex < 0) {
      return [toRecordId];
    }
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    return records
      .slice(start, end + 1)
      .filter((entry) => !pendingByKey.has(buildMutationKey(entry.fileId, column.key)))
      .map((entry) => entry.fileId);
  };

  const handleBulkCellClick = (
    event: MouseEvent<HTMLElement>,
    record: DatabaseRecord,
    column: DatabaseAttributeMeta,
  ) => {
    if (
      !editable ||
      !column.editable ||
      isInertFormulaAttribute(column) ||
      pendingByKey.has(buildMutationKey(record.fileId, column.key)) ||
      isInteractiveCellTarget(event.target, event.currentTarget)
    ) {
      return;
    }
    const isToggleSelection = event.ctrlKey || event.metaKey;
    const isRangeSelection = event.shiftKey;
    if (isToggleSelection || isRangeSelection) {
      event.preventDefault();
    }
    setBulkSelection((previous) => {
      const sameColumn = previous && toLower(previous.fieldKey) === toLower(column.key);
      if (isRangeSelection && sameColumn) {
        const anchorRecordId = previous.anchorRecordId;
        const rangeRecordIds = resolveSelectableRangeRecordIds(anchorRecordId, record.fileId, column);
        return rangeRecordIds.length > 0
          ? {
            fieldKey: previous.fieldKey,
            recordIds: rangeRecordIds,
            anchorRecordId,
          }
          : null;
      }
      if (!sameColumn || !isToggleSelection) {
        return {
          fieldKey: column.key,
          recordIds: [record.fileId],
          anchorRecordId: record.fileId,
        };
      }
      const selected = new Set(previous.recordIds);
      if (selected.has(record.fileId)) {
        selected.delete(record.fileId);
      } else {
        selected.add(record.fileId);
      }
      const nextRecordIds = Array.from(selected);
      const nextAnchorRecordId = nextRecordIds.includes(previous.anchorRecordId)
        ? previous.anchorRecordId
        : nextRecordIds[0] ?? record.fileId;
      return nextRecordIds.length > 0
        ? {
          fieldKey: previous.fieldKey,
          recordIds: nextRecordIds,
          anchorRecordId: nextAnchorRecordId,
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
        const nextRecordIds = selectedRecords
          .filter((entry) => failedRecordIds.has(entry.fileId))
          .map((entry) => entry.fileId);
        if (nextRecordIds.length === 0) {
          setBulkSelection(null);
          return;
        }
        setBulkSelection({
          fieldKey: selectedColumn.key,
          recordIds: nextRecordIds,
          anchorRecordId: nextRecordIds[0]!,
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
      <div className="database-table-header-viewport">
        <div
          className="database-table-header-row"
          role="row"
          style={{
            gridTemplateColumns,
            width: `${tableContentWidth}px`,
            transform: `translateX(-${scrollLeft}px)`,
          }}
        >
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
                <button
                  type="button"
                  className="database-table-column-resize-handle"
                  aria-label={`Spaltenbreite aendern: ${column.label || column.key}`}
                  title="Spaltenbreite aendern"
                  draggable={false}
                  onPointerDown={(event) => handleColumnResizePointerDown(event, column)}
                  data-md-block-control="true"
                />
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="database-table-scroll"
        role="rowgroup"
        onScroll={handleScroll}
        style={{ maxHeight: `${viewportHeight}px` }}
      >
        <div
          className="database-table-spacer"
          style={{
            height: `${totalHeight}px`,
            width: `${tableContentWidth}px`,
          }}
        >
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
                  gridTemplateColumns,
                  width: `${tableContentWidth}px`,
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
                      className={`database-table-cell${isSelectableCell ? " is-selectable" : ""}${isEditingCell ? " is-editing" : ""}${
                        isSelectedCell ? " is-selected" : ""
                      }${
                        pendingByKey.has(buildMutationKey(record.fileId, column.key))
                          ? " is-pending"
                          : ""
                      }${isInertFormulaCell ? " is-inert" : ""}`}
                      role="cell"
                      aria-readonly={isInertFormulaCell ? "true" : undefined}
                      aria-selected={isSelectedCell ? "true" : undefined}
                      onClick={(event) => handleBulkCellClick(event, record, column)}
                      onDoubleClick={() => {
                        if (isInertFormulaCell || !editable || !column.editable) {
                          return;
                        }
                        onStartCellEdit(record, column);
                      }}
                    >
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
