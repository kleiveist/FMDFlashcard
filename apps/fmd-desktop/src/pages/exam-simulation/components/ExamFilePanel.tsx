/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamFilePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam File Panel.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { ExamCombinationMode } from "../../../lib/examMixedSession";
import type { LoadState } from "../../../lib/types";
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

type ExamFilePanelProps = {
  files: ExamFileEntry[];
  listState: LoadState;
  listError: string;
  selectedPaths: string[];
  vaultPath: string | null;
  runSummaryFlowText?: string;
  selectedProfileId: string | null;
  profileOptions: ProfileOption[];
  onProfileChange: (profileId: string) => void;
  onToggleFile: (path: string) => void;
  onSetSelectedPaths: (paths: string[]) => void;
  onClearSelection: () => void;
  onMoveSelectedFile: (sourcePath: string, targetPath: string) => void;
  combinationMode?: ExamCombinationMode;
  onCombinationModeChange?: (mode: ExamCombinationMode) => void;
  className?: string;
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

const FILE_ROW_HEIGHT = 84;
const FILE_LIST_OVERSCAN = 5;
const FILE_LIST_VISIBLE_ROWS = 8;
const FILE_VIEWPORT_TOOLBAR_HEIGHT = 72;
const FILE_ROW_COLUMNS = 3;

export const ExamFilePanel = ({
  files,
  listState,
  listError,
  selectedPaths,
  vaultPath,
  runSummaryFlowText,
  selectedProfileId,
  profileOptions,
  onProfileChange,
  onToggleFile,
  onSetSelectedPaths,
  onClearSelection,
  onMoveSelectedFile,
  combinationMode,
  onCombinationModeChange,
  className,
}: ExamFilePanelProps) => {
  const [search, setSearch] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [moveSourcePath, setMoveSourcePath] = useState<string | null>(null);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<ChipDropHint | null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(FILE_VIEWPORT_TOOLBAR_HEIGHT);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectedOrderRef = useRef<HTMLDivElement | null>(null);
  const validFiles = useMemo(
    () => files.filter((entry) => entry.status === "valid"),
    [files],
  );
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const selectedEntries = useMemo(
    () =>
      selectedPaths
        .map((path) => validFiles.find((file) => file.path === path))
        .filter((entry): entry is ExamFileEntry => Boolean(entry)),
    [selectedPaths, validFiles],
  );

  useEffect(() => {
    if (selectedEntries.length === selectedPaths.length) {
      return;
    }
    onSetSelectedPaths(selectedEntries.map((entry) => entry.path));
  }, [onSetSelectedPaths, selectedEntries, selectedPaths.length]);

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
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoveSourcePath(null);
        setDragSourcePath(null);
        setDropHint(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveSourcePath]);

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
    onMoveSelectedFile(moveSourcePath, path);
    setMoveSourcePath(null);
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
    if (event.key === "Escape" && (moveSourcePath || dragSourcePath || dropHint)) {
      event.preventDefault();
      setMoveSourcePath(null);
      setDragSourcePath(null);
      setDropHint(null);
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
    const sourceIndex = selectedPaths.indexOf(sourcePath);
    const targetIndex = selectedPaths.indexOf(targetPath);
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
    if (desiredIndex < 0 || desiredIndex >= selectedPaths.length) {
      return null;
    }
    return selectedPaths[desiredIndex] ?? null;
  };

  const handleSelectedChipDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    path: string,
  ) => {
    setDragSourcePath(path);
    setMoveSourcePath(path);
    setDropHint(null);
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
    const position = resolveChipDropPosition(event);
    const targetPath = resolveDropTargetPath(sourcePath, path, position);
    if (targetPath) {
      onMoveSelectedFile(sourcePath, targetPath);
    }
    setDropHint(null);
    setDragSourcePath(null);
    setMoveSourcePath(null);
  };

  const handleSelectedChipDragEnd = () => {
    setDropHint(null);
    setDragSourcePath(null);
    setMoveSourcePath(null);
  };

  return (
    <section className={["panel list-panel", className].filter(Boolean).join(" ")}>
      <div className="panel-header">
        <div>
          <h2>Exam files</h2>
        </div>
        <div className="exam-file-panel-status">
          <span className="chip exam-file-selected-chip">{selectedCount} selected</span>
          {listState === "loading" ? <span className="chip">Scanning...</span> : null}
        </div>
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
                <option value="">Select profile</option>
                {profileOptions.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            {runSummaryFlowText ? (
              <p className="exam-mix-flow-text">{runSummaryFlowText}</p>
            ) : null}

            <div className="exam-selected-summary">
              <div className="exam-selected-summary-head">
                <strong>Selection</strong>
              </div>
              {combinationMode && onCombinationModeChange ? (
                <div className="pill-grid exam-selected-mode-grid">
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
                {selectedEntries.length > 0 ? (
                  selectedEntries.map((entry) => {
                    const { fileName } = splitExamFilePathParts(entry.relative_path);
                    const isMoveSource = moveSourcePath === entry.path;
                    const isDragging = dragSourcePath === entry.path;
                    const dropPosition =
                      dropHint?.path === entry.path ? dropHint.position : null;
                    return (
                      <button
                        key={entry.path}
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
                    );
                  })
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
              className="exam-file-list-viewport"
              style={{ height: `${viewportHeight + toolbarHeight}px` }}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
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
                  <button
                    type="button"
                    className="ghost small"
                    onClick={onClearSelection}
                    disabled={selectedCount === 0}
                  >
                    Clear selection
                  </button>
                </div>
              </div>

              {filteredEntries.length === 0 ? (
                <div className="empty-state exam-file-list-empty">
                  No files match the current filter.
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
                        {row.entries.map((entry) => {
                          const isSelected = selectedSet.has(entry.path);
                          const { fileName, folderPath } = splitExamFilePathParts(
                            entry.relative_path,
                          );
                          return (
                            <div
                              key={entry.path}
                              className={`exam-file-row-item ${isSelected ? "selected" : ""}`}
                            >
                              <button
                                type="button"
                                className="exam-file-row-button"
                                onClick={() => onToggleFile(entry.path)}
                                aria-pressed={isSelected}
                              >
                                <span className="exam-file-row-check" aria-hidden="true">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    tabIndex={-1}
                                  />
                                </span>
                                <span className="exam-file-row-main">
                                  <span className="exam-file-row-title">{fileName}</span>
                                  <span className="exam-file-row-path">
                                    {folderPath || "(root)"}
                                  </span>
                                  <span className="exam-file-row-meta">
                                    <span className="exam-file-row-tasks">
                                      {entry.taskCount} Tasks
                                    </span>
                                    <span className={`exam-file-row-status status-${entry.status}`}>
                                      {EXAM_FILE_STATUS_LABELS[entry.status]}
                                    </span>
                                  </span>
                                  {entry.status !== "valid" ? (
                                    <span className="exam-file-row-reason">
                                      {resolveExamFileStatusReason(entry)}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};
