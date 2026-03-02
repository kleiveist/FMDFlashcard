import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  deleteTableColumns,
  deleteTableRows,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableRow,
  normalizeMarkdownTableCellPreviewValue,
  normalizeColumnSelectionAfterMutation,
  normalizeRowSelectionAfterMutation,
  parseMarkdownPipeTable,
  repairMarkdownPipeTable,
  serializeMarkdownPipeTable,
  type IndexedSelectionState,
  type MarkdownPipeTableModel,
  type MarkdownPipeTableRowBand,
} from "../../lib/markdownTables";

export type MarkdownHybridTableCellLocation = {
  rowBand: MarkdownPipeTableRowBand;
  rowIndex: number;
  columnIndex: number;
};

export type MarkdownHybridTableActivationRequest = {
  focusTarget?: "frame" | "code";
  cell?: MarkdownHybridTableCellLocation | null;
  rowSelection?: IndexedSelectionState | null;
  columnSelection?: IndexedSelectionState | null;
};

export type MarkdownHybridTableSessionController = {
  blockIndex: number;
  flush: () => boolean;
  isDirty: boolean;
};

type MarkdownHybridTableBlockProps = {
  blockIndex: number;
  raw: string;
  active: boolean;
  disabled?: boolean;
  renderPreview: (markdown: string) => ReactNode;
  pendingActivation?: MarkdownHybridTableActivationRequest | null;
  onConsumePendingActivation: () => void;
  onRequestActivate: (request?: MarkdownHybridTableActivationRequest) => void;
  onCommitRaw: (nextRaw: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  registerSession: (controller: MarkdownHybridTableSessionController | null) => void;
  onGlobalUndo: () => boolean;
  onGlobalRedo: () => boolean;
};

type TableViewMode = "grid" | "code";

type TableContextMenuState = {
  type: "row" | "column";
  x: number;
  y: number;
};

type TablePointerDragState =
  | {
    type: "row";
    sourceIndex: number;
    startX: number;
    startY: number;
    shiftKey: boolean;
    additiveKey: boolean;
    isMove: boolean;
    canMove: boolean;
  }
  | {
    type: "column";
    sourceIndex: number;
    startX: number;
    startY: number;
    shiftKey: boolean;
    additiveKey: boolean;
    isMove: boolean;
    canMove: boolean;
  };

type TableDropIndicator =
  | {
    type: "row";
    index: number;
    offset: number;
  }
  | {
    type: "column";
    index: number;
    offset: number;
  };

const defaultTableModel: MarkdownPipeTableModel = {
  header: [{ raw: "Column A" }, { raw: "Column B" }],
  separator: ["---", "---"],
  bodyRows: [[{ raw: "Value 1" }, { raw: "Value 2" }]],
  columnCount: 2,
};

const isSameCell = (
  left: MarkdownHybridTableCellLocation | null,
  right: MarkdownHybridTableCellLocation | null,
) =>
  Boolean(
    left &&
      right &&
      left.rowBand === right.rowBand &&
      left.rowIndex === right.rowIndex &&
      left.columnIndex === right.columnIndex,
  );

const TABLE_ROW_GUTTER_WIDTH_PX = 72;
const TABLE_COLUMN_MIN_WIDTH_PX = 140;
const TABLE_COLUMN_MAX_WIDTH_PX = 420;
const TABLE_COLUMN_BASE_PADDING_PX = 44;
const TABLE_COLUMN_CHAR_WIDTH_PX = 7;

const estimateCellContentLength = (value: string) => {
  const normalized = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[*_`~>#-]+/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
  if (!normalized) {
    return 0;
  }
  return normalized
    .split("\n")
    .reduce((maxLength, line) => Math.max(maxLength, line.trim().length), 0);
};

const getColumnPixelWidth = (model: MarkdownPipeTableModel, columnIndex: number) => {
  const headerLength = estimateCellContentLength(model.header[columnIndex]?.raw ?? "");
  const bodyLength = model.bodyRows.reduce((maxLength, row) => {
    return Math.max(maxLength, estimateCellContentLength(row[columnIndex]?.raw ?? ""));
  }, 0);
  const measuredLength = Math.max(headerLength, bodyLength, 8);
  return Math.max(
    TABLE_COLUMN_MIN_WIDTH_PX,
    Math.min(
      TABLE_COLUMN_MAX_WIDTH_PX,
      Math.round(TABLE_COLUMN_BASE_PADDING_PX + measuredLength * TABLE_COLUMN_CHAR_WIDTH_PX),
    ),
  );
};

const getColumnTemplate = (model: MarkdownPipeTableModel) => {
  const tracks = Array.from({ length: model.columnCount }, (_, columnIndex) => {
    const width = getColumnPixelWidth(model, columnIndex);
    const isLastColumn = columnIndex === model.columnCount - 1;
    return isLastColumn
      ? `minmax(${TABLE_COLUMN_MIN_WIDTH_PX}px, 1fr)`
      : `minmax(${TABLE_COLUMN_MIN_WIDTH_PX}px, ${width}px)`;
  }).join(" ");
  return `${TABLE_ROW_GUTTER_WIDTH_PX}px ${tracks}`;
};

const toCellStorageValue = (value: string) =>
  value.replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");

const fromCellStorageValue = (value: string) =>
  value.replace(/<br\s*\/?>/gi, "\n");

const getCellValue = (
  model: MarkdownPipeTableModel,
  location: MarkdownHybridTableCellLocation,
) => {
  if (location.rowBand === "header") {
    return model.header[location.columnIndex]?.raw ?? "";
  }
  return model.bodyRows[location.rowIndex]?.[location.columnIndex]?.raw ?? "";
};

const updateModelCell = (
  model: MarkdownPipeTableModel,
  location: MarkdownHybridTableCellLocation,
  nextValue: string,
) => {
  const next: MarkdownPipeTableModel = {
    ...model,
    header: model.header.map((cell) => ({ raw: cell.raw })),
    separator: [...model.separator],
    bodyRows: model.bodyRows.map((row) => row.map((cell) => ({ raw: cell.raw }))),
    columnCount: model.columnCount,
  };
  if (location.rowBand === "header") {
    const headerCell = next.header[location.columnIndex];
    if (headerCell) {
      headerCell.raw = nextValue;
    }
    return next;
  }
  const row = next.bodyRows[location.rowIndex];
  const cell = row?.[location.columnIndex];
  if (cell) {
    cell.raw = nextValue;
  }
  return next;
};

const clampColumnIndex = (value: number, model: MarkdownPipeTableModel) =>
  Math.max(0, Math.min(value, Math.max(0, model.columnCount - 1)));

const clampBodyRowIndex = (value: number, model: MarkdownPipeTableModel) =>
  Math.max(0, Math.min(value, Math.max(0, model.bodyRows.length - 1)));

const DRAG_THRESHOLD_PX = 6;

const remapMovedIndex = (index: number, fromIndex: number, toIndex: number) => {
  if (index === fromIndex) {
    return toIndex;
  }
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
    return index - 1;
  }
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) {
    return index + 1;
  }
  return index;
};

const sortUniqueSelectionIndices = (values: number[]) =>
  [...new Set(values)].sort((left, right) => left - right);

const getSelectionRange = (fromIndex: number, toIndex: number) => {
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
};

const resolveSelectionState = (
  current: IndexedSelectionState | null,
  index: number,
  maxCount: number,
  options?: { shiftKey?: boolean; additiveKey?: boolean },
): IndexedSelectionState | null => {
  if (maxCount <= 0) {
    return null;
  }
  const clampedIndex = Math.max(0, Math.min(index, maxCount - 1));
  if (options?.shiftKey) {
    const anchorIndex = current?.anchorIndex ?? clampedIndex;
    return {
      anchorIndex,
      selectedIndices: getSelectionRange(anchorIndex, clampedIndex),
    };
  }
  if (options?.additiveKey) {
    return {
      anchorIndex: current?.anchorIndex ?? clampedIndex,
      selectedIndices: sortUniqueSelectionIndices([
        ...(current?.selectedIndices ?? []),
        clampedIndex,
      ]),
    };
  }
  return {
    anchorIndex: clampedIndex,
    selectedIndices: [clampedIndex],
  };
};

export const MarkdownHybridTableBlock = ({
  blockIndex,
  raw,
  active,
  disabled = false,
  renderPreview,
  pendingActivation,
  onConsumePendingActivation,
  onRequestActivate,
  onCommitRaw,
  onDirtyChange,
  registerSession,
  onGlobalUndo,
  onGlobalRedo,
}: MarkdownHybridTableBlockProps) => {
  const parsedModel = useMemo(() => {
    const parsed = parseMarkdownPipeTable(raw);
    if (parsed) {
      return parsed;
    }
    const repaired = repairMarkdownPipeTable(raw);
    if (repaired.ok) {
      return repaired.model;
    }
    return defaultTableModel;
  }, [raw]);
  const columnCount = parsedModel.columnCount;
  const visualRowCount = parsedModel.bodyRows.length + 1;
  const tableRootRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableShellRef = useRef<HTMLDivElement | null>(null);
  const cellTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const tablePointerDragRef = useRef<TablePointerDragState | null>(null);
  const pendingCellCommitRef = useRef<{ location: MarkdownHybridTableCellLocation; value: string } | null>(null);
  const columnLaneRefs = useRef<Array<HTMLElement | null>>([]);
  const bodyRowLaneRefs = useRef<Array<HTMLElement | null>>([]);

  const [viewMode, setViewMode] = useState<TableViewMode>("grid");
  const [activeCell, setActiveCell] = useState<MarkdownHybridTableCellLocation | null>(null);
  const [cellDraft, setCellDraft] = useState("");
  const [cellDirty, setCellDirty] = useState(false);
  const [rowSelection, setRowSelection] = useState<IndexedSelectionState | null>(null);
  const [columnSelection, setColumnSelection] = useState<IndexedSelectionState | null>(null);
  const [contextMenuState, setContextMenuState] = useState<TableContextMenuState | null>(null);
  const [codeDraft, setCodeDraft] = useState(raw);
  const [codeDirty, setCodeDirty] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [repairNotice, setRepairNotice] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<{ type: "row" | "column"; index: number } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<TableDropIndicator | null>(null);
  const isDirty = cellDirty || codeDirty;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (cellDirty) {
      return;
    }
    if (!activeCell) {
      return;
    }
    const nextDraft = fromCellStorageValue(getCellValue(parsedModel, activeCell));
    const pendingCommit = pendingCellCommitRef.current;
    if (pendingCommit && isSameCell(pendingCommit.location, activeCell)) {
      if (pendingCommit.value !== nextDraft) {
        return;
      }
      pendingCellCommitRef.current = null;
    }
    setCellDraft((current) => (current === nextDraft ? current : nextDraft));
  }, [activeCell, cellDirty, parsedModel]);

  useEffect(() => {
    if (codeDirty) {
      return;
    }
    setCodeDraft(raw);
  }, [codeDirty, raw]);

  useEffect(() => {
    columnLaneRefs.current = columnLaneRefs.current.slice(0, parsedModel.columnCount);
    bodyRowLaneRefs.current = bodyRowLaneRefs.current.slice(0, parsedModel.bodyRows.length);
  }, [parsedModel.bodyRows.length, parsedModel.columnCount]);

  const commitModel = useCallback(
    (nextModel: MarkdownPipeTableModel) => {
      const serialized = serializeMarkdownPipeTable(nextModel);
      if (serialized !== raw) {
        onCommitRaw(serialized);
      }
      return serialized;
    },
    [onCommitRaw, raw],
  );

  const flushActiveCell = useCallback(() => {
    if (!activeCell || !cellDirty) {
      return true;
    }
    const nextStoredValue = toCellStorageValue(cellDraft);
    const currentStoredValue = getCellValue(parsedModel, activeCell);
    if (nextStoredValue === currentStoredValue) {
      pendingCellCommitRef.current = null;
      setCellDirty(false);
      return true;
    }
    pendingCellCommitRef.current = {
      location: activeCell,
      value: fromCellStorageValue(nextStoredValue),
    };
    const nextModel = updateModelCell(parsedModel, activeCell, nextStoredValue);
    commitModel(nextModel);
    setCellDirty(false);
    return true;
  }, [activeCell, cellDirty, cellDraft, commitModel, parsedModel]);

  const flushCodeView = useCallback(() => {
    if (viewMode !== "code") {
      return true;
    }
    const repaired = repairMarkdownPipeTable(codeDraft);
    if (!repaired.ok) {
      setCodeError(repaired.error);
      const textarea = codeTextareaRef.current;
      if (textarea) {
        window.requestAnimationFrame(() => {
          try {
            textarea.focus({ preventScroll: true });
          } catch {
            textarea.focus();
          }
        });
      }
      return false;
    }
    if (repaired.changed) {
      setRepairNotice("The code view was normalized back into a valid pipe table.");
    } else {
      setRepairNotice(null);
    }
    setCodeError(null);
    setCodeDirty(false);
    setCodeDraft(repaired.markdown);
    if (repaired.markdown !== raw) {
      onCommitRaw(repaired.markdown);
    }
    setViewMode("grid");
    return true;
  }, [codeDraft, onCommitRaw, raw, viewMode]);

  const flush = useCallback(() => {
    if (!flushActiveCell()) {
      return false;
    }
    if (!flushCodeView()) {
      return false;
    }
    return true;
  }, [flushActiveCell, flushCodeView]);

  useEffect(() => {
    if (!active) {
      registerSession(null);
      return;
    }
    registerSession({
      blockIndex,
      flush,
      isDirty,
    });
    return () => {
      registerSession(null);
    };
  }, [active, blockIndex, flush, isDirty, registerSession]);

  useEffect(() => {
    if (!active || !pendingActivation) {
      return;
    }
    if (pendingActivation.focusTarget === "code") {
      setViewMode("code");
    }
    if (pendingActivation.cell) {
      setViewMode("grid");
      setActiveCell(pendingActivation.cell);
      setCellDraft(fromCellStorageValue(getCellValue(parsedModel, pendingActivation.cell)));
      setCellDirty(false);
    }
    if (pendingActivation.rowSelection) {
      setRowSelection(pendingActivation.rowSelection);
      setColumnSelection(null);
    }
    if (pendingActivation.columnSelection) {
      setColumnSelection(pendingActivation.columnSelection);
      setRowSelection(null);
    }
    onConsumePendingActivation();
  }, [active, onConsumePendingActivation, parsedModel, pendingActivation]);

  useLayoutEffect(() => {
    if (!active || disabled) {
      return;
    }
    const target = viewMode === "code"
      ? codeTextareaRef.current
      : activeCell
      ? cellTextareaRef.current
      : tableRootRef.current;
    if (!target) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
      if (target instanceof HTMLTextAreaElement) {
        const length = target.value.length;
        target.setSelectionRange(length, length);
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [active, activeCell, disabled, viewMode]);

  useLayoutEffect(() => {
    if (!active || viewMode !== "grid" || !activeCell) {
      return;
    }
    const textarea = cellTextareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [active, activeCell, cellDraft, viewMode]);

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest(".markdown-hybrid-table-context-menu")) {
        return;
      }
      setContextMenuState(null);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenuState]);

  const clearSelections = useCallback(() => {
    setRowSelection(null);
    setColumnSelection(null);
    setContextMenuState(null);
    setDragSource(null);
    setDropIndicator(null);
  }, []);

  const selectRow = useCallback((rowIndex: number, options?: { shiftKey?: boolean; additiveKey?: boolean }) => {
    setRowSelection((current) => resolveSelectionState(current, rowIndex, visualRowCount, options));
    setColumnSelection(null);
  }, [visualRowCount]);

  const selectColumn = useCallback(
    (columnIndex: number, options?: { shiftKey?: boolean; additiveKey?: boolean }) => {
      setColumnSelection((current) => resolveSelectionState(current, columnIndex, columnCount, options));
      setRowSelection(null);
    },
    [columnCount],
  );

  const handleClearRowSelectionContents = useCallback(() => {
    if (!rowSelection) {
      return;
    }
    if (!flushActiveCell()) {
      return;
    }
    const selectedRows = new Set(rowSelection.selectedIndices);
    const nextModel: MarkdownPipeTableModel = {
      ...parsedModel,
      header: parsedModel.header.map((cell) => ({
        raw: selectedRows.has(0) ? "" : cell.raw,
      })),
      separator: [...parsedModel.separator],
      bodyRows: parsedModel.bodyRows.map((row, rowIndex) =>
        row.map((cell) => ({
          raw: selectedRows.has(rowIndex + 1) ? "" : cell.raw,
        }))),
      columnCount: parsedModel.columnCount,
    };
    commitModel(nextModel);
    setActiveCell(null);
    setCellDraft("");
    setCellDirty(false);
  }, [commitModel, flushActiveCell, parsedModel, rowSelection]);

  const handleClearColumnSelectionContents = useCallback(() => {
    if (!columnSelection) {
      return;
    }
    if (!flushActiveCell()) {
      return;
    }
    const selectedColumns = new Set(columnSelection.selectedIndices);
    const nextModel: MarkdownPipeTableModel = {
      ...parsedModel,
      header: parsedModel.header.map((cell, columnIndex) => ({
        raw: selectedColumns.has(columnIndex) ? "" : cell.raw,
      })),
      separator: [...parsedModel.separator],
      bodyRows: parsedModel.bodyRows.map((row) =>
        row.map((cell, columnIndex) => ({
          raw: selectedColumns.has(columnIndex) ? "" : cell.raw,
        }))),
      columnCount: parsedModel.columnCount,
    };
    commitModel(nextModel);
    setRowSelection(null);
    setActiveCell(null);
    setCellDraft("");
    setCellDirty(false);
  }, [columnSelection, commitModel, flushActiveCell, parsedModel]);

  const activateCell = useCallback(
    (location: MarkdownHybridTableCellLocation) => {
      if (disabled) {
        return;
      }
      if (!active) {
        onRequestActivate({
          cell: location,
          focusTarget: "frame",
        });
        return;
      }
      if (activeCell && isSameCell(activeCell, location)) {
        return;
      }
      if (!flushActiveCell()) {
        return;
      }
      clearSelections();
      setViewMode("grid");
      setActiveCell(location);
      setCellDraft(fromCellStorageValue(getCellValue(parsedModel, location)));
      setCellDirty(false);
      setCodeError(null);
    },
    [active, activeCell, clearSelections, disabled, flushActiveCell, onRequestActivate, parsedModel],
  );

  const moveCellFocus = useCallback(
    (location: MarkdownHybridTableCellLocation) => {
      const columnIndex = clampColumnIndex(location.columnIndex, parsedModel);
      if (location.rowBand === "header") {
        activateCell({ rowBand: "header", rowIndex: 0, columnIndex });
        return;
      }
      const bodyIndex = clampBodyRowIndex(location.rowIndex, parsedModel);
      activateCell({ rowBand: "body", rowIndex: bodyIndex, columnIndex });
    },
    [activateCell, parsedModel],
  );

  const commitCellAndMove = useCallback(
    (nextLocation: MarkdownHybridTableCellLocation) => {
      if (!flushActiveCell()) {
        return;
      }
      moveCellFocus(nextLocation);
    },
    [flushActiveCell, moveCellFocus],
  );

  const handleFrameMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      if (active) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onRequestActivate({ focusTarget: "frame" });
    },
    [active, disabled, onRequestActivate],
  );

  const handleToggleView = useCallback(() => {
    if (disabled) {
      return;
    }
    if (!active) {
      onRequestActivate({ focusTarget: "frame" });
      return;
    }
    if (viewMode === "code") {
      flushCodeView();
      return;
    }
    if (!flushActiveCell()) {
      return;
    }
    clearSelections();
    setCodeError(null);
    setRepairNotice(null);
    setCodeDraft(raw);
    setCodeDirty(false);
    setViewMode("code");
  }, [active, clearSelections, disabled, flushActiveCell, flushCodeView, onRequestActivate, raw, viewMode]);

  const handleCodeChange = useCallback((value: string) => {
    setCodeDraft(value);
    setCodeDirty(value !== raw);
    setCodeError(null);
  }, [raw]);

  const handleDeleteColumnSelection = useCallback(() => {
    if (!columnSelection) {
      return;
    }
    if (!flushActiveCell()) {
      return;
    }
    const indices = columnSelection.selectedIndices;
    if (parsedModel.columnCount - indices.length < 1) {
      return;
    }
    const nextModel = deleteTableColumns(parsedModel, indices);
    commitModel(nextModel);
    setColumnSelection((current) =>
      normalizeColumnSelectionAfterMutation(current, {
        kind: "delete",
        removedIndices: indices,
      }, nextModel.columnCount));
    if (activeCell) {
      if (indices.includes(activeCell.columnIndex)) {
        setActiveCell({
          ...activeCell,
          columnIndex: Math.max(0, Math.min(activeCell.columnIndex, nextModel.columnCount - 1)),
        });
        setCellDirty(false);
      } else {
        setActiveCell((current) =>
          current
            ? {
              ...current,
              columnIndex: current.columnIndex -
                indices.filter((index) => index < current.columnIndex).length,
            }
            : current);
      }
    }
  }, [activeCell, columnSelection, commitModel, flushActiveCell, parsedModel]);

  const handleDeleteRowSelection = useCallback(() => {
    if (!rowSelection) {
      return;
    }
    const bodyIndices = rowSelection.selectedIndices
      .filter((index) => index > 0)
      .map((index) => index - 1);
    if (bodyIndices.length === 0) {
      return;
    }
    if (!flushActiveCell()) {
      return;
    }
    const nextModel = deleteTableRows(parsedModel, bodyIndices);
    commitModel(nextModel);
    setRowSelection((current) =>
      normalizeRowSelectionAfterMutation(current, {
        kind: "delete",
        removedIndices: bodyIndices.map((index) => index + 1),
      }, nextModel.bodyRows.length + 1));
    if (activeCell?.rowBand === "body") {
      if (bodyIndices.includes(activeCell.rowIndex)) {
        if (nextModel.bodyRows.length === 0) {
          setActiveCell({ rowBand: "header", rowIndex: 0, columnIndex: activeCell.columnIndex });
        } else {
          setActiveCell({
            rowBand: "body",
            rowIndex: Math.max(0, Math.min(activeCell.rowIndex, nextModel.bodyRows.length - 1)),
            columnIndex: activeCell.columnIndex,
          });
        }
        setCellDirty(false);
      } else {
        setActiveCell((current) =>
          current && current.rowBand === "body"
            ? {
              ...current,
              rowIndex: current.rowIndex - bodyIndices.filter((index) => index < current.rowIndex).length,
            }
            : current);
      }
    }
  }, [activeCell, commitModel, flushActiveCell, parsedModel, rowSelection]);

  const handleInsertRowAt = useCallback(
    (rowIndex: number) => {
      if (!flushActiveCell()) {
        return;
      }
      const nextModel = insertTableRow(parsedModel, rowIndex, "body");
      commitModel(nextModel);
      setRepairNotice(null);
      setRowSelection({ anchorIndex: rowIndex + 1, selectedIndices: [rowIndex + 1] });
      setColumnSelection(null);
      setActiveCell({ rowBand: "body", rowIndex, columnIndex: 0 });
      setCellDraft("");
      setCellDirty(false);
    },
    [commitModel, flushActiveCell, parsedModel],
  );

  const handleInsertColumnAt = useCallback(
    (columnIndex: number) => {
      if (!flushActiveCell()) {
        return;
      }
      const nextModel = insertTableColumn(parsedModel, columnIndex);
      commitModel(nextModel);
      setColumnSelection({ anchorIndex: columnIndex, selectedIndices: [columnIndex] });
      setRowSelection(null);
      setActiveCell({ rowBand: "header", rowIndex: 0, columnIndex });
      setCellDraft("");
      setCellDirty(false);
    },
    [commitModel, flushActiveCell, parsedModel],
  );

  const handleRowMouseDown = useCallback(
    (rowIndex: number) => (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!active) {
        onRequestActivate({
          rowSelection: { anchorIndex: rowIndex, selectedIndices: [rowIndex] },
          focusTarget: "frame",
        });
        return;
      }
      if (!flushActiveCell()) {
        return;
      }
      tablePointerDragRef.current = {
        type: "row",
        sourceIndex: rowIndex,
        startX: event.clientX,
        startY: event.clientY,
        shiftKey: event.shiftKey,
        additiveKey: event.ctrlKey || event.metaKey,
        isMove: false,
        canMove: rowIndex > 0,
      };
    },
    [active, disabled, flushActiveCell, onRequestActivate],
  );

  const handleColumnMouseDown = useCallback(
    (columnIndex: number) => (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!active) {
        onRequestActivate({
          columnSelection: { anchorIndex: columnIndex, selectedIndices: [columnIndex] },
          focusTarget: "frame",
        });
        return;
      }
      if (!flushActiveCell()) {
        return;
      }
      tablePointerDragRef.current = {
        type: "column",
        sourceIndex: columnIndex,
        startX: event.clientX,
        startY: event.clientY,
        shiftKey: event.shiftKey,
        additiveKey: event.ctrlKey || event.metaKey,
        isMove: false,
        canMove: true,
      };
    },
    [active, disabled, flushActiveCell, onRequestActivate],
  );

  const resolveColumnDropBoundaryFromPointer = useCallback((clientX: number): TableDropIndicator | null => {
    const lanes = columnLaneRefs.current.filter(Boolean);
    const shell = tableShellRef.current;
    if (!shell || lanes.length === 0) {
      return null;
    }
    const shellRect = shell.getBoundingClientRect();
    const laneRects = lanes.map((lane) => lane!.getBoundingClientRect());
    const midpoints = laneRects.map((rect) => rect.left + rect.width / 2);
    let index = laneRects.length;
    for (let laneIndex = 0; laneIndex < midpoints.length; laneIndex += 1) {
      if (clientX < midpoints[laneIndex]!) {
        index = laneIndex;
        break;
      }
    }
    const offset = index <= 0
      ? laneRects[0]!.left - shellRect.left
      : index >= laneRects.length
      ? laneRects[laneRects.length - 1]!.right - shellRect.left
      : laneRects[index]!.left - shellRect.left;
    return { type: "column", index, offset };
  }, []);

  const resolveRowDropBoundaryFromPointer = useCallback((clientY: number): TableDropIndicator | null => {
    const lanes = bodyRowLaneRefs.current.filter(Boolean);
    const shell = tableShellRef.current;
    if (!shell || lanes.length === 0) {
      return null;
    }
    const shellRect = shell.getBoundingClientRect();
    const laneRects = lanes.map((lane) => lane!.getBoundingClientRect());
    const midpoints = laneRects.map((rect) => rect.top + rect.height / 2);
    let index = laneRects.length;
    for (let laneIndex = 0; laneIndex < midpoints.length; laneIndex += 1) {
      if (clientY < midpoints[laneIndex]!) {
        index = laneIndex;
        break;
      }
    }
    const offset = index <= 0
      ? laneRects[0]!.top - shellRect.top
      : index >= laneRects.length
      ? laneRects[laneRects.length - 1]!.bottom - shellRect.top
      : laneRects[index]!.top - shellRect.top;
    return { type: "row", index, offset };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const dragState = tablePointerDragRef.current;
      if (!dragState) {
        return;
      }
      if (!dragState.isMove) {
        const deltaX = event.clientX - dragState.startX;
        const deltaY = event.clientY - dragState.startY;
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
          return;
        }
        if (!dragState.canMove) {
          return;
        }
        dragState.isMove = true;
        setActiveCell(null);
        if (dragState.type === "row") {
          selectRow(dragState.sourceIndex);
          setDragSource({ type: "row", index: dragState.sourceIndex });
          setDropIndicator(resolveRowDropBoundaryFromPointer(event.clientY));
        } else {
          selectColumn(dragState.sourceIndex);
          setDragSource({ type: "column", index: dragState.sourceIndex });
          setDropIndicator(resolveColumnDropBoundaryFromPointer(event.clientX));
        }
        return;
      }
      if (dragState.type === "row") {
        setDropIndicator(resolveRowDropBoundaryFromPointer(event.clientY));
        return;
      }
      setDropIndicator(resolveColumnDropBoundaryFromPointer(event.clientX));
    };
    const handleMouseUp = (event: globalThis.MouseEvent) => {
      const dragState = tablePointerDragRef.current;
      tablePointerDragRef.current = null;
      if (!dragState) {
        return;
      }
      if (!dragState.isMove) {
        setDragSource(null);
        setDropIndicator(null);
        setActiveCell(null);
        if (dragState.type === "row") {
          selectRow(dragState.sourceIndex, {
            shiftKey: dragState.shiftKey,
            additiveKey: dragState.additiveKey,
          });
        } else {
          selectColumn(dragState.sourceIndex, {
            shiftKey: dragState.shiftKey,
            additiveKey: dragState.additiveKey,
          });
        }
        return;
      }

      const resolvedDropIndicator = dragState.type === "row"
        ? resolveRowDropBoundaryFromPointer(event.clientY)
        : resolveColumnDropBoundaryFromPointer(event.clientX);

      setDragSource(null);
      setDropIndicator(null);

      if (!resolvedDropIndicator) {
        return;
      }

      if (dragState.type === "row") {
        const fromIndex = dragState.sourceIndex - 1;
        const targetIndex = resolvedDropIndicator.index > fromIndex
          ? resolvedDropIndicator.index - 1
          : resolvedDropIndicator.index;
        if (targetIndex !== fromIndex) {
          const nextModel = moveTableRow(parsedModel, fromIndex, targetIndex);
          commitModel(nextModel);
          const nextVisualIndex = targetIndex + 1;
          setRowSelection({ anchorIndex: nextVisualIndex, selectedIndices: [nextVisualIndex] });
          setColumnSelection(null);
          if (activeCell?.rowBand === "body") {
            setActiveCell({
              ...activeCell,
              rowIndex: remapMovedIndex(activeCell.rowIndex, fromIndex, targetIndex),
            });
          }
        } else {
          selectRow(dragState.sourceIndex);
        }
        return;
      }

      const targetIndex = resolvedDropIndicator.index > dragState.sourceIndex
        ? resolvedDropIndicator.index - 1
        : resolvedDropIndicator.index;
      if (targetIndex !== dragState.sourceIndex) {
        const nextModel = moveTableColumn(parsedModel, dragState.sourceIndex, resolvedDropIndicator.index);
        commitModel(nextModel);
        setColumnSelection({ anchorIndex: targetIndex, selectedIndices: [targetIndex] });
        setRowSelection(null);
        if (activeCell) {
          setActiveCell({
            ...activeCell,
            columnIndex: remapMovedIndex(activeCell.columnIndex, dragState.sourceIndex, targetIndex),
          });
        }
      } else {
        selectColumn(dragState.sourceIndex);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    activeCell,
    commitModel,
    parsedModel,
    resolveColumnDropBoundaryFromPointer,
    resolveRowDropBoundaryFromPointer,
    selectColumn,
    selectRow,
  ]);

  const handleCellKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!activeCell) {
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const direction = event.shiftKey ? -1 : 1;
        const nextColumn = activeCell.columnIndex + direction;
        if (nextColumn >= 0 && nextColumn < parsedModel.columnCount) {
          commitCellAndMove({
            rowBand: activeCell.rowBand,
            rowIndex: activeCell.rowIndex,
            columnIndex: nextColumn,
          });
          return;
        }
        if (activeCell.rowBand === "header") {
          commitCellAndMove({
            rowBand: "body",
            rowIndex: parsedModel.bodyRows.length > 0 ? 0 : 0,
            columnIndex: direction > 0 ? 0 : Math.max(0, parsedModel.columnCount - 1),
          });
          return;
        }
        const nextRowIndex = activeCell.rowIndex + (direction > 0 ? 1 : -1);
        if (nextRowIndex >= 0 && nextRowIndex < parsedModel.bodyRows.length) {
          commitCellAndMove({
            rowBand: "body",
            rowIndex: nextRowIndex,
            columnIndex: direction > 0 ? 0 : Math.max(0, parsedModel.columnCount - 1),
          });
          return;
        }
        if (direction > 0) {
          handleInsertRowAt(parsedModel.bodyRows.length);
        }
        return;
      }
      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const textarea = event.currentTarget;
        const nextSelectionStart = textarea.selectionStart ?? textarea.value.length;
        const nextSelectionEnd = textarea.selectionEnd ?? nextSelectionStart;
        textarea.setRangeText("\n\n", nextSelectionStart, nextSelectionEnd, "end");
        setCellDraft(textarea.value);
        setCellDirty(textarea.value !== fromCellStorageValue(getCellValue(parsedModel, activeCell)));
        textarea.style.height = "0px";
        textarea.style.height = `${textarea.scrollHeight}px`;
        return;
      }
      if (event.key === "Enter" && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (activeCell.rowBand === "header") {
          commitCellAndMove({
            rowBand: "body",
            rowIndex: 0,
            columnIndex: activeCell.columnIndex,
          });
          return;
        }
        const nextRowIndex = activeCell.rowIndex + 1;
        if (nextRowIndex < parsedModel.bodyRows.length) {
          commitCellAndMove({
            rowBand: "body",
            rowIndex: nextRowIndex,
            columnIndex: activeCell.columnIndex,
          });
          return;
        }
        handleInsertRowAt(parsedModel.bodyRows.length);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCellDirty(false);
        setCellDraft(fromCellStorageValue(getCellValue(parsedModel, activeCell)));
        setActiveCell(null);
        try {
          tableRootRef.current?.focus({ preventScroll: true });
        } catch {
          tableRootRef.current?.focus();
        }
      }
    },
    [activeCell, commitCellAndMove, getCellValue, handleInsertRowAt, parsedModel],
  );

  const handleRootKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || !active || event.defaultPrevented) {
        return;
      }
      if (event.key === "Escape") {
        clearSelections();
        setActiveCell(null);
        setContextMenuState(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !event.metaKey && !event.ctrlKey) {
        if (columnSelection) {
          event.preventDefault();
          handleDeleteColumnSelection();
          return;
        }
        if (rowSelection) {
          event.preventDefault();
          handleDeleteRowSelection();
        }
        return;
      }
      if (!event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !isDirty) {
        if (onGlobalUndo()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        ((event.shiftKey && event.key.toLowerCase() === "z") ||
          (!event.metaKey && event.key.toLowerCase() === "y")) &&
        !isDirty
      ) {
        if (onGlobalRedo()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    },
    [
      active,
      clearSelections,
      columnSelection,
      disabled,
      handleDeleteColumnSelection,
      handleDeleteRowSelection,
      isDirty,
      onGlobalRedo,
      onGlobalUndo,
      rowSelection,
    ],
  );

  const gridTemplateColumns = useMemo(() => getColumnTemplate(parsedModel), [parsedModel]);
  const renderCellContent = (location: MarkdownHybridTableCellLocation) => {
    const isEditing = active && isSameCell(activeCell, location) && viewMode === "grid";
    const value = isEditing ? cellDraft : getCellValue(parsedModel, location);
    if (isEditing) {
      return (
        <textarea
          ref={cellTextareaRef}
          className="markdown-hybrid-table-cell-editor"
          data-md-block-control="true"
          value={value}
          rows={Math.max(1, value.split("\n").length)}
          onChange={(event) => {
            setCellDraft(event.currentTarget.value);
            setCellDirty(event.currentTarget.value !== fromCellStorageValue(getCellValue(parsedModel, location)));
            event.currentTarget.style.height = "0px";
            event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
          }}
          onBlur={() => {
            flushActiveCell();
          }}
          onKeyDown={handleCellKeyDown}
        />
      );
    }
    return (
      <div className="markdown-table-cell-preview markdown-hybrid-table-cell-preview">
        {renderPreview(normalizeMarkdownTableCellPreviewValue(value))}
      </div>
    );
  };

  const contextMenu = contextMenuState ? (
    <div
      className="markdown-hybrid-table-context-menu"
      role="menu"
      style={{ left: contextMenuState.x, top: contextMenuState.y }}
      data-md-block-control="true"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {contextMenuState.type === "row" ? (
        <>
          <button
            type="button"
            className="markdown-hybrid-table-context-menu-item"
            onClick={() => {
              const anchor = rowSelection?.selectedIndices[0] ?? visualRowCount - 1;
              handleInsertRowAt(Math.max(0, anchor - 1));
              setContextMenuState(null);
            }}
          >
            Insert row above
          </button>
          <button
            type="button"
            className="markdown-hybrid-table-context-menu-item"
            onClick={() => {
              const anchor = rowSelection
                ? rowSelection.selectedIndices[rowSelection.selectedIndices.length - 1] ?? visualRowCount - 1
                : visualRowCount - 1;
              handleInsertRowAt(Math.max(0, anchor));
              setContextMenuState(null);
            }}
          >
            Insert row below
          </button>
          <button
            type="button"
            className="markdown-hybrid-table-context-menu-item is-danger"
            onClick={() => {
              handleDeleteRowSelection();
              setContextMenuState(null);
            }}
          >
            Delete row
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="markdown-hybrid-table-context-menu-item"
            onClick={() => {
              const anchor = columnSelection?.selectedIndices[0] ?? columnCount - 1;
              handleInsertColumnAt(anchor);
              setContextMenuState(null);
            }}
          >
            Insert column left
          </button>
          <button
            type="button"
            className="markdown-hybrid-table-context-menu-item"
            onClick={() => {
              const anchor = columnSelection
                ? columnSelection.selectedIndices[columnSelection.selectedIndices.length - 1] ?? columnCount - 1
                : columnCount - 1;
              handleInsertColumnAt(anchor + 1);
              setContextMenuState(null);
            }}
          >
            Insert column right
          </button>
          <button
            type="button"
            className="markdown-hybrid-table-context-menu-item is-danger"
            onClick={() => {
              handleDeleteColumnSelection();
              setContextMenuState(null);
            }}
          >
            Delete column
          </button>
        </>
      )}
      <button
        type="button"
        className="markdown-hybrid-table-context-menu-item"
        onClick={() => {
          if (contextMenuState.type === "row") {
            handleClearRowSelectionContents();
          } else {
            handleClearColumnSelectionContents();
          }
          setContextMenuState(null);
        }}
      >
        {contextMenuState.type === "row" ? "Clear row contents" : "Clear column contents"}
      </button>
    </div>
  ) : null;

  return (
    <div
      ref={tableRootRef}
      className={`markdown-hybrid-table-block${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}${
        viewMode === "code" ? " is-code-view" : " is-grid-view"
      }`}
      data-md-block-control="true"
      tabIndex={active && !disabled ? 0 : -1}
      onMouseDown={handleFrameMouseDown}
      onKeyDown={handleRootKeyDown}
    >
      {active ? (
        <div className="markdown-hybrid-table-block-header">
          <button
            type="button"
            className="markdown-hybrid-table-view-toggle"
            data-md-block-control="true"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={handleToggleView}
          >
            {viewMode === "code" ? "Grid View" : "Code View"}
          </button>
        </div>
      ) : null}
      {repairNotice ? (
        <div className="markdown-hybrid-table-repair-notice">{repairNotice}</div>
      ) : null}
      {viewMode === "code" ? (
        <div className="markdown-hybrid-table-code-shell">
          {codeError ? (
            <div className="markdown-hybrid-table-code-error">{codeError}</div>
          ) : null}
          <textarea
            ref={codeTextareaRef}
            className="markdown-hybrid-table-code-editor"
            data-md-block-control="true"
            value={codeDraft}
            rows={Math.max(3, codeDraft.split("\n").length)}
            onChange={(event) => handleCodeChange(event.currentTarget.value)}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          />
        </div>
      ) : (
        <div ref={tableScrollRef} className="markdown-hybrid-table-scroll">
          <div ref={tableShellRef} className="markdown-table markdown-hybrid-table-shell">
            {dropIndicator?.type === "column" ? (
              <div
                className="markdown-hybrid-table-column-drop-indicator"
                data-md-block-control="true"
                style={{ left: dropIndicator.offset }}
              />
            ) : null}
            {dropIndicator?.type === "row" ? (
              <div
                className="markdown-hybrid-table-row-drop-indicator"
                data-md-block-control="true"
                style={{ top: dropIndicator.offset }}
              />
            ) : null}
            <div
              className="markdown-hybrid-table-grid"
              style={{ gridTemplateColumns }}
            >
              <div className="markdown-hybrid-table-corner" />
              {parsedModel.header.map((_headerCell, columnIndex) => {
                const isSelected = Boolean(columnSelection?.selectedIndices.includes(columnIndex));
                return (
                  <div
                    key={`column-lane-${columnIndex}`}
                    ref={(node) => {
                      columnLaneRefs.current[columnIndex] = node;
                    }}
                    className={`markdown-hybrid-table-column-lane${isSelected ? " is-selected" : ""}${
                      dragSource?.type === "column" && dragSource.index === columnIndex ? " is-drag-source" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="markdown-hybrid-table-column-select"
                      data-md-block-control="true"
                      data-md-table-column-index={columnIndex}
                      onMouseDown={handleColumnMouseDown(columnIndex)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const selectionOptions = {
                          shiftKey: event.shiftKey,
                          additiveKey: event.ctrlKey || event.metaKey,
                        };
                        if (!active) {
                          onRequestActivate({
                            columnSelection: resolveSelectionState(
                              columnSelection,
                              columnIndex,
                              columnCount,
                              selectionOptions,
                            ) ?? { anchorIndex: columnIndex, selectedIndices: [columnIndex] },
                            focusTarget: "frame",
                          });
                          return;
                        }
                        if (!flushActiveCell()) {
                          return;
                        }
                        selectColumn(columnIndex, selectionOptions);
                        setActiveCell(null);
                        setContextMenuState({ type: "column", x: event.clientX, y: event.clientY });
                      }}
                    >
                      Col {columnIndex + 1}
                    </button>
                    {active ? (
                      <div className="markdown-hybrid-table-column-actions">
                        <button
                          type="button"
                          className="markdown-hybrid-table-column-insert"
                          data-md-block-control="true"
                          title="Insert column left"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={() => handleInsertColumnAt(columnIndex)}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div
                className={`markdown-hybrid-table-row-lane markdown-hybrid-table-row-lane-header${
                  rowSelection?.selectedIndices.includes(0) ? " is-selected" : ""
                }${dragSource?.type === "row" && dragSource.index === 0 ? " is-drag-source" : ""}${
                  dropIndicator?.type === "row" && dropIndicator.index === 0 ? " has-drop-indicator" : ""
                }`}
              >
                <button
                  type="button"
                  className={`markdown-hybrid-table-row-select markdown-hybrid-table-row-select-header${
                    rowSelection?.selectedIndices.includes(0) ? " is-selected" : ""
                  }`}
                  data-md-block-control="true"
                  data-md-table-row-index="0"
                  onMouseDown={handleRowMouseDown(0)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const selectionOptions = {
                      shiftKey: event.shiftKey,
                      additiveKey: event.ctrlKey || event.metaKey,
                    };
                    if (!active) {
                      onRequestActivate({
                        rowSelection: resolveSelectionState(rowSelection, 0, visualRowCount, selectionOptions) ?? {
                          anchorIndex: 0,
                          selectedIndices: [0],
                        },
                        focusTarget: "frame",
                      });
                      return;
                    }
                    if (!flushActiveCell()) {
                      return;
                    }
                    selectRow(0, selectionOptions);
                    setActiveCell(null);
                    setContextMenuState({ type: "row", x: event.clientX, y: event.clientY });
                  }}
                >
                  Head
                </button>
              </div>
              {parsedModel.header.map((_headerCell, columnIndex) => {
                const location: MarkdownHybridTableCellLocation = {
                  rowBand: "header",
                  rowIndex: 0,
                  columnIndex,
                };
                const isRowSelected = Boolean(rowSelection?.selectedIndices.includes(0));
                const isColumnSelected = Boolean(columnSelection?.selectedIndices.includes(columnIndex));
                return (
                  <div
                    key={`header-cell-${columnIndex}`}
                    className={`markdown-hybrid-table-cell markdown-hybrid-table-cell-header${
                      isRowSelected ? " is-row-selected" : ""
                    }${isColumnSelected ? " is-column-selected" : ""}${
                      active && isSameCell(activeCell, location) ? " is-editing" : ""
                    }`}
                    data-md-block-control="true"
                    onMouseDown={(event) => {
                      if (active && isSameCell(activeCell, location)) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      activateCell(location);
                    }}
                  >
                    {renderCellContent(location)}
                  </div>
                );
              })}

              {parsedModel.bodyRows.map((row, rowIndex) => {
                const visualIndex = rowIndex + 1;
                const isRowSelected = Boolean(rowSelection?.selectedIndices.includes(visualIndex));
                return (
                  <FragmentRow
                    key={`body-row-${rowIndex}`}
                    rowIndex={rowIndex}
                    visualIndex={visualIndex}
                    row={row}
                    active={active}
                    activeCell={activeCell}
                    columnSelection={columnSelection}
                    disabled={disabled}
                    onActivateCell={activateCell}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const selectionOptions = {
                        shiftKey: event.shiftKey,
                        additiveKey: event.ctrlKey || event.metaKey,
                      };
                      if (!active) {
                        onRequestActivate({
                          rowSelection: resolveSelectionState(
                            rowSelection,
                            visualIndex,
                            visualRowCount,
                            selectionOptions,
                          ) ?? { anchorIndex: visualIndex, selectedIndices: [visualIndex] },
                          focusTarget: "frame",
                        });
                        return;
                      }
                      if (!flushActiveCell()) {
                        return;
                      }
                      selectRow(visualIndex, selectionOptions);
                      setActiveCell(null);
                      setContextMenuState({ type: "row", x: event.clientX, y: event.clientY });
                    }}
                    onInsertAbove={() => handleInsertRowAt(rowIndex)}
                    onRowMouseDown={handleRowMouseDown(visualIndex)}
                    renderCellContent={renderCellContent}
                    rowLaneRef={(node) => {
                      bodyRowLaneRefs.current[rowIndex] = node;
                    }}
                    isRowSelected={isRowSelected}
                    isDragSource={dragSource?.type === "row" && dragSource.index === visualIndex}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
      {contextMenu}
    </div>
  );
};

const FragmentRow = ({
  rowIndex,
  visualIndex,
  row,
  active,
  activeCell,
  columnSelection,
  disabled,
  onActivateCell,
  onContextMenu,
  onInsertAbove,
  onRowMouseDown,
  renderCellContent,
  rowLaneRef,
  isRowSelected,
  isDragSource,
}: {
  rowIndex: number;
  visualIndex: number;
  row: MarkdownPipeTableModel["bodyRows"][number];
  active: boolean;
  activeCell: MarkdownHybridTableCellLocation | null;
  columnSelection: IndexedSelectionState | null;
  disabled: boolean;
  onActivateCell: (location: MarkdownHybridTableCellLocation) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onInsertAbove: () => void;
  onRowMouseDown: (event: MouseEvent<HTMLButtonElement>) => void;
  renderCellContent: (location: MarkdownHybridTableCellLocation) => ReactNode;
  rowLaneRef: (node: HTMLDivElement | null) => void;
  isRowSelected: boolean;
  isDragSource: boolean;
}) => (
  <>
    <div
      ref={rowLaneRef}
      className={`markdown-hybrid-table-row-lane${isRowSelected ? " is-selected" : ""}${
        isDragSource ? " is-drag-source" : ""
      }`}
    >
      <button
        type="button"
        className="markdown-hybrid-table-row-select"
        data-md-block-control="true"
        data-md-table-row-index={String(visualIndex)}
        onMouseDown={onRowMouseDown}
        onContextMenu={onContextMenu}
      >
        Row {visualIndex}
      </button>
      {active && !disabled ? (
        <div className="markdown-hybrid-table-row-actions">
          <button
            type="button"
            className="markdown-hybrid-table-row-insert"
            data-md-block-control="true"
            title="Insert row above"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={onInsertAbove}
          >
            +
          </button>
        </div>
      ) : null}
    </div>
    {row.map((_cell, columnIndex) => {
      const location: MarkdownHybridTableCellLocation = {
        rowBand: "body",
        rowIndex,
        columnIndex,
      };
      const isColumnSelected = Boolean(columnSelection?.selectedIndices.includes(columnIndex));
      return (
        <div
          key={`body-cell-${rowIndex}-${columnIndex}`}
          className={`markdown-hybrid-table-cell${
            isRowSelected ? " is-row-selected" : ""
          }${isColumnSelected ? " is-column-selected" : ""}${
            active && isSameCell(activeCell, location) ? " is-editing" : ""
          }`}
          data-md-block-control="true"
          onMouseDown={(event) => {
            if (active && isSameCell(activeCell, location)) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            onActivateCell(location);
          }}
        >
          {renderCellContent(location)}
        </div>
      );
    })}
  </>
);
