/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamFilePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam File Panel.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { ExamCombinationMode } from "../../../lib/examMixedSession";
import type { LoadState } from "../../../lib/types";
import {
  areExamSelectionRowsEqual,
  buildExamSelectionRowsFromPaths,
  flattenExamSelectionRows,
  locateExamSelectionPath,
  normalizeExamSelectionRows,
  placeExamSelectionPath,
  type ExamSelectionPlacementTarget,
  type ExamSelectionRows,
} from "../../../lib/examSelectionRows";
import {
  EXAM_FILE_STATUS_LABELS,
  resolveExamFileStatusReason,
  splitExamFilePathParts,
  type ExamFileEntry,
} from "../../../features/exam/types";

type ProfileOption = {
  id: string;
  name: string;
};

type ExamFilePanelCompactSummary = {
  maxPoints: number;
  taskCount: number;
  minDurationMinutes: number;
};

type ExamFileOpenOptions = {
  openInNewTab?: boolean;
};

type ExamFilePanelProps = {
  files: ExamFileEntry[];
  listState: LoadState;
  listError: string;
  selectedPathRows?: ExamSelectionRows;
  selectedPaths?: string[];
  vaultPath: string | null;
  compactSummary?: ExamFilePanelCompactSummary;
  selectedProfileId: string | null;
  profileOptions: ProfileOption[];
  onProfileChange: (profileId: string) => void;
  onToggleFile: (path: string) => void;
  onOpenFile?: (entry: ExamFileEntry, options?: ExamFileOpenOptions) => void;
  onSetSelectedPathRows?: (rows: ExamSelectionRows) => void;
  onSetSelectedPaths?: (paths: string[]) => void;
  onClearSelection: () => void;
  onPlaceSelectedFile?: (
    sourcePath: string,
    target: ExamSelectionPlacementTarget,
  ) => void;
  onMoveSelectedFile?: (sourcePath: string, targetPath: string) => void;
  showClearSelectionButton?: boolean;
  listScrollMode?: "internal" | "external";
  combinationMode?: ExamCombinationMode;
  onCombinationModeChange?: (mode: ExamCombinationMode) => void;
  className?: string;
  hidePanelStatus?: boolean;
};

type ExamListRow =
  | {
      kind: "group";
      key: string;
      label: string;
    }
  | {
      kind: "file-row";
      key: string;
      entries: ExamFileEntry[];
    };

type ChipDropHint = {
  path: string;
  position: "before" | "after";
};

type SlotDropHint = ExamSelectionPlacementTarget;
type FileOpenPopupState = {
  entry: ExamFileEntry;
  x: number;
  y: number;
};

const FILE_ROW_HEIGHT = 84;
const FILE_LIST_OVERSCAN = 5;
const FILE_LIST_VISIBLE_ROWS = 8;
const FILE_VIEWPORT_TOOLBAR_HEIGHT = 72;
const FILE_ROW_COLUMNS = 3;

export const ExamFilePanel = ({
  files,
  listState,
  listError,
  selectedPathRows,
  selectedPaths,
  vaultPath,
  compactSummary,
  selectedProfileId,
  profileOptions,
  onProfileChange,
  onToggleFile,
  onOpenFile,
  onSetSelectedPathRows,
  onSetSelectedPaths,
  onClearSelection,
  onPlaceSelectedFile,
  onMoveSelectedFile,
  showClearSelectionButton = true,
  listScrollMode = "internal",
  combinationMode,
  onCombinationModeChange,
  className,
  hidePanelStatus = false,
}: ExamFilePanelProps) => {
  const [search, setSearch] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [moveSourcePath, setMoveSourcePath] = useState<string | null>(null);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<ChipDropHint | null>(null);
  const [slotDropHint, setSlotDropHint] = useState<SlotDropHint | null>(null);
  const [fileOpenPopup, setFileOpenPopup] = useState<FileOpenPopupState | null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(FILE_VIEWPORT_TOOLBAR_HEIGHT);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectedOrderRef = useRef<HTMLDivElement | null>(null);
  const validFiles = useMemo(
    () => files.filter((entry) => entry.status === "valid"),
    [files],
  );
  const validPathSet = useMemo(
    () => new Set(validFiles.map((entry) => entry.path)),
    [validFiles],
  );
  const selectedRows = useMemo(
    () =>
      selectedPathRows
        ? selectedPathRows
        : buildExamSelectionRowsFromPaths(selectedPaths ?? []),
    [selectedPathRows, selectedPaths],
  );
  const normalizedSelectedRows = useMemo(
    () =>
      normalizeExamSelectionRows(selectedRows, {
        validPaths: validPathSet,
      }),
    [selectedRows, validPathSet],
  );
  const selectedPathsFlat = useMemo(
    () => flattenExamSelectionRows(normalizedSelectedRows),
    [normalizedSelectedRows],
  );
  const selectedSet = useMemo(() => new Set(selectedPathsFlat), [selectedPathsFlat]);
  const validFilesByPath = useMemo(
    () => new Map(validFiles.map((entry) => [entry.path, entry])),
    [validFiles],
  );
  const selectedRowEntries = useMemo(
    () =>
      normalizedSelectedRows
        .map((row) =>
          row
            .map((path) => validFilesByPath.get(path))
            .filter((entry): entry is ExamFileEntry => Boolean(entry)),
        )
        .filter((row) => row.length > 0),
    [normalizedSelectedRows, validFilesByPath],
  );
  const selectedEntries = useMemo(
    () => selectedRowEntries.flatMap((row) => row),
    [selectedRowEntries],
  );
  const applySelectedRows = useCallback(
    (rows: ExamSelectionRows) => {
      if (onSetSelectedPathRows) {
        onSetSelectedPathRows(rows);
      }
      if (onSetSelectedPaths) {
        onSetSelectedPaths(flattenExamSelectionRows(rows));
      }
    },
    [onSetSelectedPathRows, onSetSelectedPaths],
  );
  const placeSelectedPath = useCallback(
    (sourcePath: string, target: ExamSelectionPlacementTarget) => {
      if (onPlaceSelectedFile) {
        onPlaceSelectedFile(sourcePath, target);
        return;
      }
      const nextRows = placeExamSelectionPath(normalizedSelectedRows, sourcePath, target, {
        validPaths: validPathSet,
      });
      applySelectedRows(nextRows);
    },
    [
      applySelectedRows,
      normalizedSelectedRows,
      onPlaceSelectedFile,
      validPathSet,
    ],
  );

  useEffect(() => {
    if (areExamSelectionRowsEqual(selectedRows, normalizedSelectedRows)) {
      return;
    }
    applySelectedRows(normalizedSelectedRows);
  }, [applySelectedRows, normalizedSelectedRows, selectedRows]);

  useEffect(() => {
    const toolbarElement = toolbarRef.current;
    if (!toolbarElement) {
      return;
    }

    const updateHeight = () => setToolbarHeight(toolbarElement.offsetHeight);
    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(toolbarElement);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!moveSourcePath) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (selectedOrderRef.current?.contains(target)) {
        return;
      }
      setMoveSourcePath(null);
      setDragSourcePath(null);
      setDropHint(null);
      setSlotDropHint(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoveSourcePath(null);
        setDragSourcePath(null);
        setDropHint(null);
        setSlotDropHint(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveSourcePath]);

  useEffect(() => {
    if (!fileOpenPopup) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFileOpenPopup(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileOpenPopup]);

  useEffect(() => {
    if (!fileOpenPopup) {
      return;
    }
    const exists = validFiles.some((entry) => entry.path === fileOpenPopup.entry.path);
    if (!exists) {
      setFileOpenPopup(null);
    }
  }, [fileOpenPopup, validFiles]);

  const selectedCount = selectedEntries.length;

  const normalizedSearch = search.trim().toLowerCase();
  const filteredEntries = useMemo(() => {
    return validFiles
      .slice()
      .sort((left, right) => left.relative_path.localeCompare(right.relative_path))
      .filter((entry) => {
        if (!normalizedSearch) {
          return true;
        }
        const { fileName, folderPath } = splitExamFilePathParts(entry.relative_path);
        const haystack = `${fileName} ${folderPath} ${entry.relative_path}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [normalizedSearch, validFiles]);

  const rows = useMemo<ExamListRow[]>(() => {
    const nextRows: ExamListRow[] = [];
    let activeGroup = "";
    let groupEntries: ExamFileEntry[] = [];

    const flushGroupEntries = () => {
      if (groupEntries.length === 0) {
        return;
      }
      for (let index = 0; index < groupEntries.length; index += FILE_ROW_COLUMNS) {
        const chunk = groupEntries.slice(index, index + FILE_ROW_COLUMNS);
        nextRows.push({
          kind: "file-row",
          key: `file-row:${activeGroup}:${index / FILE_ROW_COLUMNS}`,
          entries: chunk,
        });
      }
      groupEntries = [];
    };

    filteredEntries.forEach((entry) => {
      const { folderPath } = splitExamFilePathParts(entry.relative_path);
      const groupLabel = folderPath || "(root)";
      if (groupLabel !== activeGroup) {
        flushGroupEntries();
        activeGroup = groupLabel;
        nextRows.push({
          kind: "group",
          key: `group:${groupLabel}`,
          label: groupLabel,
        });
      }
      groupEntries.push(entry);
    });
    flushGroupEntries();

    return nextRows;
  }, [filteredEntries]);

  const totalHeight = rows.length * FILE_ROW_HEIGHT;
  const useInternalListScroll = listScrollMode === "internal";
  const viewportHeight = Math.max(
    FILE_ROW_HEIGHT,
    Math.min(rows.length, FILE_LIST_VISIBLE_ROWS) * FILE_ROW_HEIGHT,
  );
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / FILE_ROW_HEIGHT));
  const effectiveScrollTop = Math.max(0, scrollTop - toolbarHeight);
  const visibleStart = Math.max(
    0,
    Math.floor(effectiveScrollTop / FILE_ROW_HEIGHT) - FILE_LIST_OVERSCAN,
  );
  const visibleEnd = Math.min(
    rows.length,
    visibleStart + visibleCount + FILE_LIST_OVERSCAN * 2,
  );
  const visibleRows = rows.slice(visibleStart, visibleEnd);

  const handleSelectedReorderTap = (path: string) => {
    if (!moveSourcePath) {
      setMoveSourcePath(path);
      return;
    }
    if (moveSourcePath === path) {
      setMoveSourcePath(null);
      return;
    }
    if (onMoveSelectedFile) {
      onMoveSelectedFile(moveSourcePath, path);
    } else {
      const targetPosition = locateExamSelectionPath(normalizedSelectedRows, path);
      if (targetPosition) {
        placeSelectedPath(moveSourcePath, targetPosition);
      }
    }
    setMoveSourcePath(null);
    setSlotDropHint(null);
  };

  const handleSelectedChipKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    path: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectedReorderTap(path);
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && moveSourcePath === path) {
      event.preventDefault();
      onToggleFile(path);
      setMoveSourcePath(null);
      setDragSourcePath(null);
      setDropHint(null);
      setSlotDropHint(null);
      return;
    }
    if (
      event.key === "Escape" &&
      (moveSourcePath || dragSourcePath || dropHint || slotDropHint)
    ) {
      event.preventDefault();
      setMoveSourcePath(null);
      setDragSourcePath(null);
      setDropHint(null);
      setSlotDropHint(null);
    }
  };

  const resolveChipDropPosition = (
    event: Pick<ReactDragEvent<HTMLButtonElement>, "currentTarget" | "clientX">,
  ): "before" | "after" => {
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    return event.clientX > midpoint ? "after" : "before";
  };

  const resolveDropTargetPath = (
    sourcePath: string,
    targetPath: string,
    position: "before" | "after",
  ): string | null => {
    const sourceIndex = selectedPathsFlat.indexOf(sourcePath);
    const targetIndex = selectedPathsFlat.indexOf(targetPath);
    if (sourceIndex < 0 || targetIndex < 0) {
      return null;
    }
    const desiredIndex =
      targetIndex +
      (position === "after" ? 1 : 0) -
      (sourceIndex < targetIndex ? 1 : 0);
    if (desiredIndex === sourceIndex) {
      return null;
    }
    if (desiredIndex < 0 || desiredIndex >= selectedPathsFlat.length) {
      return null;
    }
    return selectedPathsFlat[desiredIndex] ?? null;
  };

  const handleSelectedChipDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    path: string,
  ) => {
    setDragSourcePath(path);
    setMoveSourcePath(path);
    setDropHint(null);
    setSlotDropHint(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", path);
      } catch {
        // ignore dataTransfer limitations in certain runtimes
      }
    }
  };

  const handleSelectedChipDragOver = (
    event: ReactDragEvent<HTMLButtonElement>,
    path: string,
  ) => {
    const sourcePath = dragSourcePath ?? moveSourcePath;
    if (!sourcePath) {
      return;
    }
    if (sourcePath === path) {
      if (dropHint) {
        setDropHint(null);
      }
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const position = resolveChipDropPosition(event);
    setDropHint((current) =>
      current?.path === path && current.position === position ? current : { path, position },
    );
    if (!onPlaceSelectedFile && onMoveSelectedFile) {
      setSlotDropHint(null);
      return;
    }
    const targetPosition = locateExamSelectionPath(normalizedSelectedRows, path);
    if (!targetPosition) {
      setSlotDropHint(null);
      return;
    }
    setSlotDropHint({
      rowIndex: targetPosition.rowIndex,
      slotIndex: targetPosition.slotIndex + (position === "after" ? 1 : 0),
    });
  };

  const handleSelectedChipDragLeave = (
    event: ReactDragEvent<HTMLButtonElement>,
    path: string,
  ) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setDropHint((current) => (current?.path === path ? null : current));
  };

  const handleSelectedChipDrop = (
    event: ReactDragEvent<HTMLButtonElement>,
    path: string,
  ) => {
    const sourcePath = dragSourcePath ?? moveSourcePath;
    if (!sourcePath) {
      return;
    }
    event.preventDefault();
    const hint = slotDropHint;
    if (hint && (onPlaceSelectedFile || !onMoveSelectedFile)) {
      placeSelectedPath(sourcePath, hint);
    } else {
      const position = resolveChipDropPosition(event);
      const targetPath = resolveDropTargetPath(sourcePath, path, position);
      if (targetPath && onMoveSelectedFile) {
        onMoveSelectedFile(sourcePath, targetPath);
      }
    }
    setDropHint(null);
    setSlotDropHint(null);
    setDragSourcePath(null);
    setMoveSourcePath(null);
  };

  const handleSelectedChipDragEnd = () => {
    setDropHint(null);
    setSlotDropHint(null);
    setDragSourcePath(null);
    setMoveSourcePath(null);
  };

  const handleSlotPlaceTap = (target: ExamSelectionPlacementTarget) => {
    if (!moveSourcePath) {
      return;
    }
    placeSelectedPath(moveSourcePath, target);
    setMoveSourcePath(null);
    setDragSourcePath(null);
    setDropHint(null);
    setSlotDropHint(null);
  };

  const handleSlotDragOver = (
    event: ReactDragEvent<HTMLButtonElement>,
    target: ExamSelectionPlacementTarget,
  ) => {
    const sourcePath = dragSourcePath ?? moveSourcePath;
    if (!sourcePath) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    setSlotDropHint((current) =>
      current?.rowIndex === target.rowIndex && current.slotIndex === target.slotIndex
        ? current
        : target,
    );
  };

  const handleSlotDrop = (
    event: ReactDragEvent<HTMLButtonElement>,
    target: ExamSelectionPlacementTarget,
  ) => {
    const sourcePath = dragSourcePath ?? moveSourcePath;
    if (!sourcePath) {
      return;
    }
    event.preventDefault();
    placeSelectedPath(sourcePath, target);
    setMoveSourcePath(null);
    setDragSourcePath(null);
    setDropHint(null);
    setSlotDropHint(null);
  };

  const renderFileRowEntries = (entries: ExamFileEntry[]) =>
    entries.map((entry) => {
      const isSelected = selectedSet.has(entry.path);
      const { fileName, folderPath } = splitExamFilePathParts(entry.relative_path);

      const openFileDirect = (options?: ExamFileOpenOptions) => {
        setFileOpenPopup(null);
        onOpenFile?.(entry, options);
      };

      const openFilePopup = (
        event: Pick<ReactMouseEvent<HTMLElement>, "currentTarget" | "clientX" | "clientY">,
      ) => {
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        const anchorX = Number.isFinite(event.clientX) && event.clientX > 0
          ? event.clientX
          : rect.left;
        const anchorY = Number.isFinite(event.clientY) && event.clientY > 0
          ? event.clientY
          : rect.bottom;
        setFileOpenPopup({
          entry,
          x: Math.max(8, Math.round(anchorX)),
          y: Math.max(8, Math.round(anchorY + 6)),
        });
      };

      const handleTitleClick = (event: ReactMouseEvent<HTMLSpanElement>) => {
        if (!onOpenFile) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) {
          openFileDirect({ openInNewTab: true });
          return;
        }
        openFilePopup(event);
      };

      const handleTitleKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
        if (!onOpenFile) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          openFilePopup({
            currentTarget: event.currentTarget,
            clientX: 0,
            clientY: 0,
          });
        }
      };

      const handleFileRowClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
        if (onOpenFile && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.stopPropagation();
          openFileDirect({ openInNewTab: true });
          return;
        }
        onToggleFile(entry.path);
      };

      const handleFileRowContextMenu = (
        event: ReactMouseEvent<HTMLButtonElement>,
      ) => {
        if (!onOpenFile) {
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          openFileDirect({ openInNewTab: true });
        }
      };

      return (
        <div key={entry.path} className={`exam-file-row-item ${isSelected ? "selected" : ""}`}>
          <button
            type="button"
            className="exam-file-row-button"
            onClick={handleFileRowClick}
            onContextMenu={handleFileRowContextMenu}
            aria-pressed={isSelected}
          >
            <span className="exam-file-row-check" aria-hidden="true">
              <input type="checkbox" checked={isSelected} readOnly tabIndex={-1} />
            </span>
            <span className="exam-file-row-main">
              <span
                className={`exam-file-row-title ${onOpenFile ? "is-open-action" : ""}`}
                role={onOpenFile ? "button" : undefined}
                tabIndex={onOpenFile ? 0 : undefined}
                onClick={handleTitleClick}
                onKeyDown={handleTitleKeyDown}
                title={onOpenFile ? "Open file actions" : undefined}
                aria-label={onOpenFile ? `Open actions for ${fileName}` : undefined}
              >
                {fileName}
              </span>
              <span className="exam-file-row-path">{folderPath || "(root)"}</span>
              <span className="exam-file-row-meta">
                <span className="exam-file-row-tasks">{entry.taskCount} Tasks</span>
                <span className={`exam-file-row-status status-${entry.status}`}>
                  {EXAM_FILE_STATUS_LABELS[entry.status]}
                </span>
              </span>
              {entry.status !== "valid" ? (
                <span className="exam-file-row-reason">{resolveExamFileStatusReason(entry)}</span>
              ) : null}
            </span>
          </button>
        </div>
      );
    });

  const fileOpenPopupLayer = fileOpenPopup && onOpenFile
    ? createPortal(
        <div
          className="context-menu-backdrop"
          role="presentation"
          onMouseDown={() => setFileOpenPopup(null)}
        >
          <div
            className="context-menu exam-file-open-menu"
            style={{ left: `${fileOpenPopup.x}px`, top: `${fileOpenPopup.y}px` }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                onOpenFile(fileOpenPopup.entry);
                setFileOpenPopup(null);
              }}
            >
              Open file
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  const renderPlacementSlot = (
    target: ExamSelectionPlacementTarget,
    label: string,
    key: string,
    variant: "inline" | "row-break" = "inline",
  ) => {
    const isActive =
      slotDropHint?.rowIndex === target.rowIndex &&
      slotDropHint.slotIndex === target.slotIndex;
    return (
      <button
        key={key}
        type="button"
        className={`exam-selected-slot ${variant === "row-break" ? "is-row-break" : ""} ${
          isActive ? "is-active" : ""
        }`.trim()}
        onClick={() => handleSlotPlaceTap(target)}
        onDragOver={(event) => handleSlotDragOver(event, target)}
        onDrop={(event) => handleSlotDrop(event, target)}
        onDragLeave={() =>
          setSlotDropHint((current) =>
            current?.rowIndex === target.rowIndex &&
            current.slotIndex === target.slotIndex
              ? null
              : current,
          )
        }
        aria-label={label}
        title={label}
      >
        <span aria-hidden="true" />
      </button>
    );
  };

  return (
    <section className={["panel list-panel exam-file-panel", className].filter(Boolean).join(" ")}>
      <div className="panel-header">
        <div>
          <h2>Exam files</h2>
        </div>
        {!hidePanelStatus ? (
          <div className="exam-file-panel-status">
            {combinationMode && onCombinationModeChange ? (
              <div className="exam-file-panel-mode-grid">
                <button
                  type="button"
                  className={`pill pill-button exam-selected-mode-nested ${
                    combinationMode === "nested" ? "active" : ""
                  }`}
                  onClick={() => onCombinationModeChange("nested")}
                >
                  Nested
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    combinationMode === "sequential-shuffled" ? "active" : ""
                  }`}
                  onClick={() => onCombinationModeChange("sequential-shuffled")}
                >
                  Sequential + internal shuffle
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    combinationMode === "sequential" ? "active" : ""
                  }`}
                  onClick={() => onCombinationModeChange("sequential")}
                >
                  Sequential
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    combinationMode === "fully-mixed" ? "active" : ""
                  }`}
                  onClick={() => onCombinationModeChange("fully-mixed")}
                >
                  Fully mixed
                </button>
              </div>
            ) : null}
            <div className="exam-file-panel-kpis">
              <span className="chip exam-file-selected-chip exam-file-panel-kpi">
                {selectedCount} selected
              </span>
              {compactSummary ? (
                <>
                  <span className="chip exam-file-panel-kpi">
                    {compactSummary.taskCount} tasks
                  </span>
                  <span className="chip exam-file-panel-kpi">
                    {compactSummary.maxPoints} max points
                  </span>
                  <span className="chip exam-file-panel-kpi">
                    {compactSummary.minDurationMinutes} min duration
                  </span>
                </>
              ) : null}
            </div>
            {listState === "loading" ? <span className="chip">Scanning...</span> : null}
          </div>
        ) : null}
      </div>
      <div className="panel-body exam-file-panel-body">
        {!vaultPath ? (
          <div className="empty-state">Select a vault to load exam files.</div>
        ) : null}
        {listError ? <div className="error">{listError}</div> : null}
        {vaultPath ? (
          <>
            <label className="field exam-run-profile-field exam-file-run-profile-field">
              <span className="label">Run profile</span>
              <select
                className="text-input"
                value={selectedProfileId ?? ""}
                onChange={(event) => onProfileChange(event.target.value)}
              >
                <option value="">Standard (no profile)</option>
                {profileOptions.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="exam-selected-summary">
              <div className="exam-selected-summary-head">
                <strong>Selection</strong>
              </div>
              <p className="muted exam-selected-order-hint">
                Reorder with drag (mouse) or two taps (touch): pick source first, then
                target. Click outside this row or press Escape to cancel.
              </p>
              <div
                ref={selectedOrderRef}
                className="exam-selected-order"
                role="list"
                aria-label="Selected exam files"
              >
                {selectedRowEntries.length > 0 ? (
                  <div className="exam-selected-order-rows">
                    {selectedRowEntries.map((rowEntries, rowIndex) => {
                      const canCreateNextRow =
                        rowIndex < 2 && selectedRowEntries.length === rowIndex + 1;
                      return (
                        <Fragment key={`selected-row-${rowIndex}`}>
                          <div className="exam-selected-order-row" role="list">
                            {renderPlacementSlot(
                              { rowIndex, slotIndex: 0 },
                              `Insert at start of row ${rowIndex + 1}`,
                              `slot-${rowIndex}-0`,
                            )}
                            {rowEntries.map((entry, columnIndex) => {
                              const { fileName } = splitExamFilePathParts(entry.relative_path);
                              const isMoveSource = moveSourcePath === entry.path;
                              const isDragging = dragSourcePath === entry.path;
                              const dropPosition =
                                dropHint?.path === entry.path ? dropHint.position : null;
                              return (
                                <Fragment key={entry.path}>
                                  <button
                                    type="button"
                                    className={`exam-selected-chip ${
                                      isMoveSource ? "is-move-source" : ""
                                    } ${isDragging ? "is-dragging" : ""} ${
                                      dropPosition ? `drop-${dropPosition}` : ""
                                    }`.trim()}
                                    onClick={() => handleSelectedReorderTap(entry.path)}
                                    onKeyDown={(event) => handleSelectedChipKeyDown(event, entry.path)}
                                    draggable
                                    onDragStart={(event) => handleSelectedChipDragStart(event, entry.path)}
                                    onDragOver={(event) => handleSelectedChipDragOver(event, entry.path)}
                                    onDragLeave={(event) => handleSelectedChipDragLeave(event, entry.path)}
                                    onDrop={(event) => handleSelectedChipDrop(event, entry.path)}
                                    onDragEnd={handleSelectedChipDragEnd}
                                    role="listitem"
                                    title={entry.relative_path}
                                    aria-pressed={isMoveSource}
                                  >
                                    <span className="exam-selected-chip-name">{fileName}</span>
                                    <span className="exam-selected-chip-meta">{entry.taskCount} Tasks</span>
                                  </button>
                                  {renderPlacementSlot(
                                    { rowIndex, slotIndex: columnIndex + 1 },
                                    `Insert in row ${rowIndex + 1} at position ${columnIndex + 2}`,
                                    `slot-${rowIndex}-${columnIndex + 1}`,
                                  )}
                                </Fragment>
                              );
                            })}
                          </div>
                          {canCreateNextRow ? (
                            <div className="exam-selected-row-break">
                              {renderPlacementSlot(
                                { rowIndex: rowIndex + 1, slotIndex: 0 },
                                `Create row ${rowIndex + 2}`,
                                `row-slot-${rowIndex + 1}`,
                                "row-break",
                              )}
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="exam-selected-chip exam-selected-chip-placeholder"
                    role="listitem"
                    aria-live="polite"
                  >
                    <span className="exam-selected-chip-name">No file selected</span>
                    <span className="exam-selected-chip-meta">
                      Pick files below to enable reorder.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div
              className={`exam-file-list-viewport ${
                useInternalListScroll ? "" : "external-scroll"
              }`.trim()}
              style={
                useInternalListScroll
                  ? { height: `${viewportHeight + toolbarHeight}px` }
                  : undefined
              }
              onScroll={
                useInternalListScroll
                  ? (event) => setScrollTop(event.currentTarget.scrollTop)
                  : undefined
              }
            >
              <div className="exam-file-toolbar exam-file-viewport-toolbar" ref={toolbarRef}>
                <label className="field exam-file-search-field">
                  <span className="label">Search</span>
                  <input
                    type="search"
                    className="text-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter by filename or path"
                  />
                </label>
                <div className="exam-file-toolbar-actions">
                  {showClearSelectionButton ? (
                    <button
                      type="button"
                      className="ghost small"
                      onClick={onClearSelection}
                      disabled={selectedCount === 0}
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
              </div>

              {filteredEntries.length === 0 ? (
                <div className="empty-state exam-file-list-empty">
                  No files match the current filter.
                </div>
              ) : !useInternalListScroll ? (
                <div className="exam-file-list-standard">
                  {rows.map((row) => {
                    if (row.kind === "group") {
                      return (
                        <div key={row.key} className="exam-file-group-row is-static">
                          {row.label}
                        </div>
                      );
                    }

                    return (
                      <div key={row.key} className="exam-file-row is-static">
                        {renderFileRowEntries(row.entries)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="exam-file-list-virtual"
                  style={{ height: `${totalHeight}px` }}
                >
                  {visibleRows.map((row, offset) => {
                    const rowIndex = visibleStart + offset;
                    const top = rowIndex * FILE_ROW_HEIGHT;
                    if (row.kind === "group") {
                      return (
                        <div
                          key={row.key}
                          className="exam-file-group-row"
                          style={{ transform: `translateY(${top}px)` }}
                        >
                          {row.label}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={row.key}
                        className="exam-file-row"
                        style={{ transform: `translateY(${top}px)` }}
                      >
                        {renderFileRowEntries(row.entries)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
      {fileOpenPopupLayer}
    </section>
  );
};
