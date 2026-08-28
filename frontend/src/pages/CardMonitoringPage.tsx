/**
 * @file frontend/src/pages/CardMonitoringPage.tsx
 *
 * Central management page for vault-wide #card ... #endcard wrappers.
 */

import { invoke } from "@tauri-apps/api/core";
import {
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ModalShell } from "../components/ModalShell";
import { useAppState } from "../components/AppStateProvider";
import { parseFlashcardEntries, type FlashcardDetectedType } from "../lib/flashcards";
import { compareNaturalPath } from "../lib/naturalSort";
import type { LoadState } from "../lib/types";
import {
  applyCardWrapperRemovals,
  buildCardMonitoringEntries,
  buildCardMonitoringGroups,
  buildCardMonitoringSavePlan,
  filterCardMonitoringEntries,
  type CardMonitoringEntry,
  type CardMonitoringFileGroup,
  type CardMonitoringFilterState,
  type CardMonitoringSortBy,
  type CardMonitoringSortState,
} from "../features/card-monitoring/card-monitoring-model";

const CARD_TYPE_LABELS: Record<FlashcardDetectedType, string> = {
  qa: "Q/A",
  "multiple-choice": "Multiple Choice",
  "fill-blank": "Fill Blank",
  assignment: "Assignment",
  "true-false": "True/False",
};

const CARD_TYPE_ORDER: FlashcardDetectedType[] = [
  "qa",
  "multiple-choice",
  "fill-blank",
  "assignment",
  "true-false",
];

const DEFAULT_FILTERS: CardMonitoringFilterState = {
  folderPath: "",
  filePath: "",
  cardType: "all",
  query: "",
};

const DEFAULT_SORT: CardMonitoringSortState = {
  sortBy: "file-name",
  direction: "asc",
};

const VIRTUAL_ROW_HEIGHT = 44;
const VIRTUAL_OVERSCAN_ROWS = 8;
const VIRTUAL_ROW_THRESHOLD = 200;

type CardMonitoringRow =
  | {
      kind: "folder";
      key: string;
      displayName: string;
      fileCount: number;
      cardCount: number;
    }
  | {
      kind: "file";
      key: string;
      file: CardMonitoringFileGroup;
      selectedCount: number;
      stagedCount: number;
    }
  | {
      kind: "card";
      key: string;
      entry: CardMonitoringEntry;
      isSelected: boolean;
      isStaged: boolean;
    };

export type CardMonitoringPageHandle = {
  requestLeaveCardMonitoring: () => Promise<boolean>;
};

type CardMonitoringPageProps = object;

const pruneSelection = (values: Set<string>, validIds: Set<string>) => {
  const next = new Set<string>();
  values.forEach((value) => {
    if (validIds.has(value)) {
      next.add(value);
    }
  });
  return next;
};

const fileCardIds = (file: CardMonitoringFileGroup) => file.entries.map((entry) => entry.id);

const CardMonitoringPageComponent = (
  _props: CardMonitoringPageProps,
  ref: ForwardedRef<CardMonitoringPageHandle>,
) => {
  const { actions, preview, vault } = useAppState();
  const [scanState, setScanState] = useState<LoadState>("idle");
  const [scanError, setScanError] = useState("");
  const [entries, setEntries] = useState<CardMonitoringEntry[]>([]);
  const [filters, setFilters] = useState<CardMonitoringFilterState>(DEFAULT_FILTERS);
  const [sortState, setSortState] = useState<CardMonitoringSortState>(DEFAULT_SORT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [stagedRemovalIds, setStagedRemovalIds] = useState<Set<string>>(() => new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving">("idle");
  const [saveError, setSaveError] = useState("");
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const leaveResolveRef = useRef<((allowLeave: boolean) => void) | null>(null);
  const scanRequestIdRef = useRef(0);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const [listViewportHeight, setListViewportHeight] = useState(520);
  const [listScrollTop, setListScrollTop] = useState(0);

  const hasStagedChanges = stagedRemovalIds.size > 0;

  const requestLeaveCardMonitoring = useCallback(() => {
    if (saveState === "saving") {
      return Promise.resolve(false);
    }
    if (!hasStagedChanges) {
      return Promise.resolve(true);
    }
    setIsLeaveConfirmOpen(true);
    return new Promise<boolean>((resolve) => {
      leaveResolveRef.current = resolve;
    });
  }, [hasStagedChanges, saveState]);

  const resolveLeaveDecision = useCallback((allowLeave: boolean) => {
    const resolve = leaveResolveRef.current;
    leaveResolveRef.current = null;
    setIsLeaveConfirmOpen(false);
    resolve?.(allowLeave);
  }, []);

  useEffect(
    () => () => {
      leaveResolveRef.current?.(false);
      leaveResolveRef.current = null;
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      requestLeaveCardMonitoring,
    }),
    [requestLeaveCardMonitoring],
  );

  const scanCardMonitoring = useCallback(async () => {
    scanRequestIdRef.current += 1;
    const requestId = scanRequestIdRef.current;

    if (!vault.vaultPath) {
      setEntries([]);
      setScanState("idle");
      setScanError("");
      setSelectedIds(() => new Set());
      setStagedRemovalIds(() => new Set());
      return;
    }

    const markdownFiles = vault.files.filter((file) =>
      file.relative_path.toLowerCase().endsWith(".md"),
    );

    if (markdownFiles.length === 0) {
      setEntries([]);
      setScanState("idle");
      setScanError("");
      setSelectedIds(() => new Set());
      setStagedRemovalIds(() => new Set());
      return;
    }

    setScanState("loading");
    setScanError("");

    const scannedFiles = await Promise.allSettled(
      markdownFiles.map(async (file) => {
        const contents = await invoke<string>("read_text_file", {
          path: file.path,
        });
        return {
          sourcePath: file.path,
          relativePath: file.relative_path,
          parsedEntries: parseFlashcardEntries(contents),
        };
      }),
    );

    if (requestId !== scanRequestIdRef.current) {
      return;
    }

    const successfulScans: {
      sourcePath: string;
      relativePath: string;
      parsedEntries: ReturnType<typeof parseFlashcardEntries>;
    }[] = [];
    let failures = 0;

    scannedFiles.forEach((result) => {
      if (result.status === "fulfilled") {
        if (result.value.parsedEntries.length > 0) {
          successfulScans.push(result.value);
        }
        return;
      }
      failures += 1;
    });

    const nextEntries = buildCardMonitoringEntries(successfulScans);

    setEntries(nextEntries);
    setScanState("idle");
    if (failures > 0 && nextEntries.length === 0) {
      setScanError("Card monitoring scan failed for one or more files.");
    } else {
      setScanError("");
    }

    const validIds = new Set(nextEntries.map((entry) => entry.id));
    setSelectedIds((prev) => pruneSelection(prev, validIds));
    setStagedRemovalIds((prev) => pruneSelection(prev, validIds));
  }, [vault.files, vault.vaultPath]);

  useEffect(() => {
    void scanCardMonitoring();
  }, [scanCardMonitoring]);

  useEffect(() => {
    const viewport = listViewportRef.current;
    if (!viewport) {
      return;
    }

    const measure = () => {
      const nextHeight = Math.max(220, Math.floor(viewport.clientHeight));
      setListViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const folderOptions = useMemo(
    () =>
      Array.from(new Set(entries.map((entry) => entry.folderPath)))
        .sort(compareNaturalPath)
        .map((value) => ({
          value,
          label: value || "(Vault root)",
        })),
    [entries],
  );

  const fileOptions = useMemo(
    () =>
      Array.from(new Set(entries.map((entry) => entry.relativePath)))
        .sort(compareNaturalPath)
        .map((value) => ({ value, label: value })),
    [entries],
  );

  const typeOptions = useMemo(() => {
    const available = new Set(entries.map((entry) => entry.cardType));
    return CARD_TYPE_ORDER.filter((type) => available.has(type)).map((type) => ({
      value: type,
      label: CARD_TYPE_LABELS[type],
    }));
  }, [entries]);

  const filteredEntries = useMemo(
    () => filterCardMonitoringEntries(entries, filters),
    [entries, filters],
  );

  const groups = useMemo(
    () => buildCardMonitoringGroups(filteredEntries, sortState),
    [filteredEntries, sortState],
  );

  const filteredIdSet = useMemo(
    () => new Set(filteredEntries.map((entry) => entry.id)),
    [filteredEntries],
  );

  const rows = useMemo<CardMonitoringRow[]>(() => {
    const nextRows: CardMonitoringRow[] = [];

    groups.forEach((folder) => {
      nextRows.push({
        kind: "folder",
        key: `folder:${folder.folderPath}`,
        displayName: folder.displayName,
        fileCount: folder.fileCount,
        cardCount: folder.cardCount,
      });

      folder.files.forEach((file) => {
        const ids = fileCardIds(file);
        const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
        const stagedCount = ids.filter((id) => stagedRemovalIds.has(id)).length;

        nextRows.push({
          kind: "file",
          key: `file:${file.sourcePath}`,
          file,
          selectedCount,
          stagedCount,
        });

        file.entries.forEach((entry) => {
          nextRows.push({
            kind: "card",
            key: `card:${entry.id}`,
            entry,
            isSelected: selectedIds.has(entry.id),
            isStaged: stagedRemovalIds.has(entry.id),
          });
        });
      });
    });

    return nextRows;
  }, [groups, selectedIds, stagedRemovalIds]);

  const useVirtualRows = rows.length >= VIRTUAL_ROW_THRESHOLD;
  const totalVirtualHeight = rows.length * VIRTUAL_ROW_HEIGHT;
  const virtualVisibleCount = Math.ceil(listViewportHeight / VIRTUAL_ROW_HEIGHT);
  const virtualStartIndex = Math.max(
    0,
    Math.floor(listScrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN_ROWS,
  );
  const virtualEndIndex = Math.min(
    rows.length,
    virtualStartIndex + virtualVisibleCount + VIRTUAL_OVERSCAN_ROWS * 2,
  );
  const visibleRows = useVirtualRows ? rows.slice(virtualStartIndex, virtualEndIndex) : rows;

  const selectedFilteredCount = useMemo(
    () =>
      Array.from(selectedIds).reduce(
        (count, id) => (filteredIdSet.has(id) ? count + 1 : count),
        0,
      ),
    [filteredIdSet, selectedIds],
  );

  const selectedCount = selectedIds.size;
  const stagedCount = stagedRemovalIds.size;

  const toggleCardSelection = useCallback((entryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const toggleFileSelection = useCallback((file: CardMonitoringFileGroup) => {
    const ids = fileCardIds(file);
    if (ids.length === 0) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredEntries.map((entry) => entry.id)));
  }, [filteredEntries]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(() => new Set());
  }, []);

  const handleStageSelected = useCallback(() => {
    if (selectedCount === 0) {
      return;
    }
    setStagedRemovalIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    setSaveError("");
  }, [selectedCount, selectedIds]);

  const handleUnstageSelected = useCallback(() => {
    if (selectedCount === 0) {
      return;
    }
    setStagedRemovalIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [selectedCount, selectedIds]);

  const handleDiscardStaged = useCallback(() => {
    setStagedRemovalIds(() => new Set());
    setSaveError("");
  }, []);

  const handleSave = useCallback(async () => {
    if (saveState === "saving" || stagedRemovalIds.size === 0) {
      return;
    }

    const stagedEntries = entries.filter((entry) => stagedRemovalIds.has(entry.id));
    if (stagedEntries.length === 0) {
      setStagedRemovalIds(() => new Set());
      return;
    }

    setSaveState("saving");
    setSaveError("");

    const failedEntryIds = new Set<string>();
    let wroteAnyFile = false;

    try {
      const plan = buildCardMonitoringSavePlan(
        stagedEntries.map((entry) => ({
          id: entry.id,
          sourcePath: entry.sourcePath,
          sourceRange: entry.sourceRange,
        })),
      );

      for (const filePlan of plan) {
        try {
          const contents = await invoke<string>("read_text_file", {
            path: filePlan.sourcePath,
          });
          const removalResult = applyCardWrapperRemovals(contents, filePlan.ranges);

          if (removalResult.changed) {
            await invoke("write_text_file_atomic", {
              path: filePlan.sourcePath,
              contents: removalResult.nextContents,
            });
            wroteAnyFile = true;
            if (preview.selectedFile?.path === filePlan.sourcePath) {
              preview.setPreview(removalResult.nextContents);
            }
          }

          if (removalResult.skippedCount > 0) {
            filePlan.entryIds.forEach((id) => failedEntryIds.add(id));
          }
        } catch (error) {
          console.error("Failed to save card monitoring updates", error);
          filePlan.entryIds.forEach((id) => failedEntryIds.add(id));
        }
      }

      if (wroteAnyFile) {
        await actions.handleRescanVault("card-monitoring-save");
      }

      if (failedEntryIds.size > 0) {
        setSaveError("Some card wrappers could not be removed. Please rescan and retry.");
        setStagedRemovalIds(failedEntryIds);
      } else {
        setStagedRemovalIds(() => new Set());
      }

      await scanCardMonitoring();
    } finally {
      setSaveState("idle");
    }
  }, [actions, entries, preview, saveState, scanCardMonitoring, stagedRemovalIds]);

  const handleOpenEntryFile = useCallback(
    (entry: CardMonitoringEntry) => {
      const file = vault.files.find((candidate) => candidate.path === entry.sourcePath);
      if (!file) {
        return;
      }
      actions.handleSelectFile(file);
    },
    [actions, vault.files],
  );

  const handleSortDirectionToggle = useCallback(() => {
    setSortState((current) => ({
      ...current,
      direction: current.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const saveSummary =
    saveState === "saving"
      ? "Saving staged changes..."
      : stagedCount > 0
        ? `${stagedCount} staged for removal`
        : "No staged changes";

  return (
    <>
      <section className="panel card-monitoring-panel">
        <div className="panel-header card-monitoring-header">
          <div>
            <h2>Card Monitoring</h2>
            <p className="muted">
              Vault-wide overview and staged bulk management for #card wrappers.
            </p>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => void scanCardMonitoring()}
              disabled={scanState === "loading" || saveState === "saving"}
            >
              Rescan
            </button>
          </div>
        </div>

        <div className="card-monitoring-filters">
          <label className="field">
            <span className="label">Search</span>
            <input
              type="search"
              className="text-input"
              value={filters.query}
              onChange={(event) =>
                setFilters((current) => ({ ...current, query: event.target.value }))
              }
              placeholder="Prompt, file or folder"
            />
          </label>

          <label className="field">
            <span className="label">Folder</span>
            <select
              className="text-input"
              value={filters.folderPath}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  folderPath: event.target.value,
                  filePath: "",
                }))
              }
            >
              <option value="">All folders</option>
              {folderOptions.map((option) => (
                <option key={option.value || "root"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">File</span>
            <select
              className="text-input"
              value={filters.filePath}
              onChange={(event) =>
                setFilters((current) => ({ ...current, filePath: event.target.value }))
              }
            >
              <option value="">All files</option>
              {fileOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Card type</span>
            <select
              className="text-input"
              value={filters.cardType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  cardType: event.target.value as CardMonitoringFilterState["cardType"],
                }))
              }
            >
              <option value="all">All types</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Sort by</span>
            <select
              className="text-input"
              value={sortState.sortBy}
              onChange={(event) =>
                setSortState((current) => ({
                  ...current,
                  sortBy: event.target.value as CardMonitoringSortBy,
                }))
              }
            >
              <option value="file-name">Filename</option>
              <option value="folder-path">Folder path</option>
              <option value="cards-per-file">Cards per file</option>
              <option value="card-order">Card order</option>
            </select>
          </label>

          <button
            type="button"
            className="ghost small card-monitoring-sort-direction"
            onClick={handleSortDirectionToggle}
            aria-label="Toggle sort direction"
            title="Toggle sort direction"
          >
            {sortState.direction === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        <div className="card-monitoring-actions">
          <div className="card-monitoring-actions-summary muted">
            <span>{filteredEntries.length} cards</span>
            <span>{selectedCount} selected</span>
            <span>{selectedFilteredCount} selected in filtered view</span>
            <span>{saveSummary}</span>
          </div>

          <div className="card-monitoring-actions-buttons">
            <button
              type="button"
              className="ghost small"
              onClick={handleSelectAllFiltered}
              disabled={filteredEntries.length === 0}
            >
              Select filtered
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={handleClearSelection}
              disabled={selectedCount === 0}
            >
              Clear selection
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={handleStageSelected}
              disabled={selectedCount === 0}
            >
              Stage remove wrapper
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={handleUnstageSelected}
              disabled={selectedCount === 0 || stagedCount === 0}
            >
              Unstage selected
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={handleDiscardStaged}
              disabled={stagedCount === 0}
            >
              Discard staged
            </button>
            <button
              type="button"
              className="primary small"
              onClick={() => void handleSave()}
              disabled={stagedCount === 0 || saveState === "saving"}
            >
              Save
            </button>
          </div>
        </div>

        {scanError ? <div className="error">{scanError}</div> : null}
        {saveError ? <div className="error">{saveError}</div> : null}

        <div
          ref={listViewportRef}
          className={`card-monitoring-list-viewport ${
            useVirtualRows ? "is-virtual" : ""
          }`.trim()}
          onScroll={
            useVirtualRows
              ? (event) => setListScrollTop(event.currentTarget.scrollTop)
              : undefined
          }
        >
          {scanState === "loading" ? (
            <div className="empty-state">Scanning vault for #card wrappers...</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">No #card ... #endcard wrappers found.</div>
          ) : useVirtualRows ? (
            <div
              className="card-monitoring-list-virtual"
              style={{ height: `${totalVirtualHeight}px` }}
            >
              {visibleRows.map((row, index) => {
                const rowIndex = virtualStartIndex + index;
                return (
                  <div
                    key={row.key}
                    className="card-monitoring-row-shell"
                    style={{ transform: `translateY(${rowIndex * VIRTUAL_ROW_HEIGHT}px)` }}
                  >
                    {row.kind === "folder" ? (
                      <div className="card-monitoring-row card-monitoring-row-folder">
                        <span>{row.displayName}</span>
                        <span className="muted">
                          {row.fileCount} files • {row.cardCount} cards
                        </span>
                      </div>
                    ) : row.kind === "file" ? (
                      <div className="card-monitoring-row card-monitoring-row-file">
                        <label className="choice-row card-monitoring-file-selector">
                          <input
                            type="checkbox"
                            checked={
                              row.file.entries.length > 0 &&
                              row.selectedCount === row.file.entries.length
                            }
                            onChange={() => toggleFileSelection(row.file)}
                          />
                          <span>
                            {row.file.fileName}
                            <span className="muted"> ({row.file.entries.length} shown / {row.file.fileCardCount} total)</span>
                          </span>
                        </label>
                        <span className="muted">
                          {row.selectedCount} selected • {row.stagedCount} staged
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`card-monitoring-row card-monitoring-row-card ${
                          row.isStaged ? "is-staged" : ""
                        }`.trim()}
                      >
                        <label className="choice-row card-monitoring-card-selector">
                          <input
                            type="checkbox"
                            checked={row.isSelected}
                            onChange={() => toggleCardSelection(row.entry.id)}
                          />
                          <span className="card-monitoring-card-order">
                            #{row.entry.cardIndexInFile}
                          </span>
                          <span className="card-monitoring-card-type chip">
                            {CARD_TYPE_LABELS[row.entry.cardType]}
                          </span>
                          <span className="card-monitoring-card-prompt">{row.entry.prompt}</span>
                        </label>
                        <div className="card-monitoring-card-actions">
                          {row.isStaged ? <span className="chip">Staged</span> : null}
                          <button
                            type="button"
                            className="ghost small"
                            onClick={() => handleOpenEntryFile(row.entry)}
                          >
                            Open file
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-monitoring-list">
              {rows.map((row) => {
                if (row.kind === "folder") {
                  return (
                    <div
                      key={row.key}
                      className="card-monitoring-row card-monitoring-row-folder"
                    >
                      <span>{row.displayName}</span>
                      <span className="muted">
                        {row.fileCount} files • {row.cardCount} cards
                      </span>
                    </div>
                  );
                }

                if (row.kind === "file") {
                  return (
                    <div
                      key={row.key}
                      className="card-monitoring-row card-monitoring-row-file"
                    >
                      <label className="choice-row card-monitoring-file-selector">
                        <input
                          type="checkbox"
                          checked={
                            row.file.entries.length > 0 &&
                            row.selectedCount === row.file.entries.length
                          }
                          onChange={() => toggleFileSelection(row.file)}
                        />
                        <span>
                          {row.file.fileName}
                          <span className="muted"> ({row.file.entries.length} shown / {row.file.fileCardCount} total)</span>
                        </span>
                      </label>
                      <span className="muted">
                        {row.selectedCount} selected • {row.stagedCount} staged
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={row.key}
                    className={`card-monitoring-row card-monitoring-row-card ${
                      row.isStaged ? "is-staged" : ""
                    }`.trim()}
                  >
                    <label className="choice-row card-monitoring-card-selector">
                      <input
                        type="checkbox"
                        checked={row.isSelected}
                        onChange={() => toggleCardSelection(row.entry.id)}
                      />
                      <span className="card-monitoring-card-order">#{row.entry.cardIndexInFile}</span>
                      <span className="card-monitoring-card-type chip">
                        {CARD_TYPE_LABELS[row.entry.cardType]}
                      </span>
                      <span className="card-monitoring-card-prompt">{row.entry.prompt}</span>
                    </label>
                    <div className="card-monitoring-card-actions">
                      {row.isStaged ? <span className="chip">Staged</span> : null}
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => handleOpenEntryFile(row.entry)}
                      >
                        Open file
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ModalShell
        isOpen={isLeaveConfirmOpen}
        title="Discard staged card changes?"
        onClose={() => resolveLeaveDecision(false)}
      >
        <div className="hub-modal-scroll card-monitoring-leave-modal">
          <p>
            You have staged card-wrapper removals that are not saved yet. Leave this page and discard staged changes?
          </p>
          <div className="card-monitoring-leave-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => resolveLeaveDecision(false)}
            >
              Stay
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setStagedRemovalIds(() => new Set());
                setSaveError("");
                resolveLeaveDecision(true);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  );
};

export const CardMonitoringPage = forwardRef<
  CardMonitoringPageHandle,
  CardMonitoringPageProps
>(
  CardMonitoringPageComponent,
);

CardMonitoringPage.displayName = "CardMonitoringPage";
