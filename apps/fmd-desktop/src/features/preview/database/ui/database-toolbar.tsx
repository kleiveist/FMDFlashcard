/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-toolbar.tsx
 *
 * Unified toolbar shell for database block interactions.
 */

import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDragText,
  setDropEffectSafe,
  startInternalDrag,
} from "../../../../lib/dragDrop";
import { type DatabaseViewType } from "../database-types";

type DatabaseToolbarButtonRef = (node: HTMLButtonElement | null) => void;

type DatabaseToolbarProps = {
  activeViewId: string;
  activeViewName: string;
  savedViews: Array<{ id: string; name: string }>;
  sourceLabel: string;
  viewType: DatabaseViewType;
  searchQuery: string;
  showSearch: boolean;
  onSearchChange: (nextValue: string) => void;
  onViewTypeChange: (nextView: DatabaseViewType) => void;
  onSelectSavedView: (viewId: string) => void;
  onCreateSavedView: (name: string) => void;
  onRenameSavedView: (viewId: string, nextName: string) => void;
  onDeleteSavedView: (viewId: string) => void;
  onDuplicateSavedView: (viewId: string) => void;
  onReorderSavedViews: (sourceViewId: string, targetViewId: string) => void;
  onMoveSavedView: (viewId: string, direction: "up" | "down") => void;
  isSourcePanelOpen: boolean;
  isFilterPanelOpen: boolean;
  isSortPanelOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isKanbanPanelOpen: boolean;
  isGanttPanelOpen: boolean;
  isProjectPanelOpen: boolean;
  isPiePanelOpen: boolean;
  hasAnyPanelOpen: boolean;
  onToggleSourcePanel: () => void;
  onToggleFilterPanel: () => void;
  onToggleSortPanel: () => void;
  onTogglePropertiesPanel: () => void;
  onToggleKanbanPanel: () => void;
  onToggleGanttPanel: () => void;
  onToggleProjectPanel: () => void;
  onTogglePiePanel: () => void;
  onCloseAllPanels: () => void;
  sourceButtonRef?: DatabaseToolbarButtonRef;
  sortButtonRef?: DatabaseToolbarButtonRef;
  filterButtonRef?: DatabaseToolbarButtonRef;
  propertiesButtonRef?: DatabaseToolbarButtonRef;
  kanbanButtonRef?: DatabaseToolbarButtonRef;
  ganttButtonRef?: DatabaseToolbarButtonRef;
  projectButtonRef?: DatabaseToolbarButtonRef;
  pieButtonRef?: DatabaseToolbarButtonRef;
};

type ViewContextMenuState = {
  viewId: string;
  top: number;
  left: number;
};

const viewOptions: Array<{ value: DatabaseViewType; label: string }> = [
  { value: "table", label: "Table" },
  { value: "kanban", label: "Kanban" },
  { value: "gantt", label: "Timeline" },
  { value: "project", label: "Project" },
  { value: "pie", label: "Pie" },
];

type ToolbarIconKind = "sort" | "filter" | "properties" | "search" | "chevron";

const ToolbarIcon = ({ kind }: { kind: ToolbarIconKind }) => {
  switch (kind) {
    case "sort":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3 3h7" />
          <path d="M3 8h5" />
          <path d="M3 13h3" />
          <path d="M11 3v10" />
          <path d="m9 11 2 2 2-2" />
        </svg>
      );
    case "filter":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2 3h12" />
          <path d="m4.5 3 3.5 4v5l2-1.2V7L13.5 3" />
        </svg>
      );
    case "properties":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3 4h10" />
          <circle cx="6" cy="4" r="1.2" />
          <path d="M3 8h10" />
          <circle cx="10" cy="8" r="1.2" />
          <path d="M3 12h10" />
          <circle cx="7.5" cy="12" r="1.2" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="7" cy="7" r="4" />
          <path d="m10.2 10.2 3.2 3.2" />
        </svg>
      );
    case "chevron":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="m4.5 6 3.5 4 3.5-4" />
        </svg>
      );
    default:
      return null;
  }
};

const IconOnlyButton = ({
  kind,
  label,
  active,
  expanded,
  onClick,
  buttonRef,
}: {
  kind: "sort" | "filter" | "properties" | "search";
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
  buttonRef?: DatabaseToolbarButtonRef;
}) => (
  <button
    ref={buttonRef}
    type="button"
    className={`database-block-toolbar-button database-block-toolbar-button-icon-only${
      active ? " is-active" : ""
    }`}
    onClick={onClick}
    aria-expanded={expanded}
    aria-label={label}
    title={label}
    data-md-block-control="true"
  >
    <span className="database-block-toolbar-button-icon" aria-hidden="true">
      <ToolbarIcon kind={kind} />
    </span>
  </button>
);

export const DatabaseToolbar = ({
  activeViewId,
  activeViewName,
  savedViews,
  sourceLabel,
  viewType,
  searchQuery,
  showSearch,
  onSearchChange,
  onViewTypeChange,
  onSelectSavedView,
  onCreateSavedView,
  onRenameSavedView,
  onDeleteSavedView,
  onDuplicateSavedView,
  onReorderSavedViews,
  onMoveSavedView,
  isSourcePanelOpen,
  isFilterPanelOpen,
  isSortPanelOpen,
  isPropertiesPanelOpen,
  isKanbanPanelOpen,
  isGanttPanelOpen,
  isProjectPanelOpen,
  isPiePanelOpen,
  hasAnyPanelOpen,
  onToggleSourcePanel,
  onToggleFilterPanel,
  onToggleSortPanel,
  onTogglePropertiesPanel,
  onToggleKanbanPanel,
  onToggleGanttPanel,
  onToggleProjectPanel,
  onTogglePiePanel,
  onCloseAllPanels,
  sourceButtonRef,
  sortButtonRef,
  filterButtonRef,
  propertiesButtonRef,
  kanbanButtonRef,
  ganttButtonRef,
  projectButtonRef,
  pieButtonRef,
}: DatabaseToolbarProps) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const viewAnchorRef = useRef<HTMLDivElement | null>(null);
  const viewDropdownRef = useRef<HTMLDivElement | null>(null);
  const viewContextMenuRef = useRef<HTMLDivElement | null>(null);
  const inlineRenameInputRef = useRef<HTMLInputElement | null>(null);
  const searchAnchorRef = useRef<HTMLDivElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [pendingSearchOpen, setPendingSearchOpen] = useState(false);
  const [viewDropdownStyle, setViewDropdownStyle] = useState<CSSProperties | undefined>(undefined);
  const [searchDropdownStyle, setSearchDropdownStyle] = useState<CSSProperties | undefined>(undefined);
  const [newViewName, setNewViewName] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [draggingViewId, setDraggingViewId] = useState<string | null>(null);
  const [dragOverViewId, setDragOverViewId] = useState<string | null>(null);
  const [viewContextMenu, setViewContextMenu] = useState<ViewContextMenuState | null>(null);
  const normalizedActiveViewName = activeViewName.trim() || "View";

  const normalizedSavedViews = useMemo(
    () => savedViews.filter((savedView) => savedView.id.trim().length > 0),
    [savedViews],
  );
  const handleViewChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as DatabaseViewType;
    onViewTypeChange(next);
  };

  const closeViewOverlays = useCallback(() => {
    setViewContextMenu(null);
    setEditingViewId(null);
    setRenameDraft("");
    setDraggingViewId(null);
    setDragOverViewId(null);
  }, []);

  const openRenameForView = useCallback((viewId: string) => {
    const target = normalizedSavedViews.find((savedView) => savedView.id === viewId);
    if (!target) {
      return;
    }
    setViewContextMenu(null);
    setEditingViewId(viewId);
    setRenameDraft(target.name);
  }, [normalizedSavedViews]);

  const submitRenameForView = useCallback((viewId: string | null, rawName?: string) => {
    if (!viewId) {
      setEditingViewId(null);
      setRenameDraft("");
      return;
    }
    const trimmedName = (rawName ?? renameDraft).trim();
    if (!trimmedName) {
      const source = normalizedSavedViews.find((savedView) => savedView.id === viewId);
      setRenameDraft(source?.name ?? "");
      return;
    }
    onRenameSavedView(viewId, trimmedName);
    setEditingViewId(null);
    setRenameDraft("");
  }, [normalizedSavedViews, onRenameSavedView, renameDraft]);

  const handleViewItemDragStart = (event: DragEvent<HTMLButtonElement>, viewId: string) => {
    setViewContextMenu(null);
    setEditingViewId(null);
    setRenameDraft("");
    setDraggingViewId(viewId);
    startInternalDrag(event, {
      channel: DRAG_CHANNELS.DATABASE_SAVED_VIEW,
      payload: viewId,
      plainTextFallback: viewId,
      effectAllowed: "move",
    });
  };

  const handleViewItemDrop = (event: DragEvent<HTMLButtonElement>, targetViewId: string) => {
    event.preventDefault();
    const sourceViewId = readInternalDragText(event, { channel: DRAG_CHANNELS.DATABASE_SAVED_VIEW });
    if (sourceViewId && sourceViewId !== targetViewId) {
      onReorderSavedViews(sourceViewId, targetViewId);
    }
    setDragOverViewId(null);
    setDraggingViewId(null);
    endInternalDrag(DRAG_CHANNELS.DATABASE_SAVED_VIEW);
  };

  const clampMenuPosition = useCallback((top: number, left: number) => {
    const viewportWidth = Math.max(window.innerWidth || 0, 240);
    const viewportHeight = Math.max(window.innerHeight || 0, 200);
    const estimatedWidth = 190;
    const estimatedHeight = 180;
    const nextLeft = Math.max(6, Math.min(left, viewportWidth - estimatedWidth - 6));
    const nextTop = Math.max(6, Math.min(top, viewportHeight - estimatedHeight - 6));
    return {
      top: nextTop,
      left: nextLeft,
    };
  }, []);

  const positionDropdowns = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const gutter = 4;
    const minLeft = rootRect.left + gutter;
    const maxRight = rootRect.right - gutter;

    if (isViewDropdownOpen) {
      const anchor = viewAnchorRef.current;
      const panel = viewDropdownRef.current;
      if (anchor && panel) {
        const anchorRect = anchor.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const availableWidth = Math.max(0, maxRight - minLeft);
        const width = Math.min(panelRect.width, availableWidth);
        let left = anchorRect.left;
        if (left + width > maxRight) {
          left = maxRight - width;
        }
        if (left < minLeft) {
          left = minLeft;
        }
        const offset = Math.round(left - anchorRect.left);
        setViewDropdownStyle((previous) => {
          const nextInset = `${offset}px`;
          const nextWidth = `${Math.round(width)}px`;
          if (
            previous?.insetInlineStart === nextInset &&
            previous?.inlineSize === nextWidth
          ) {
            return previous;
          }
          return {
            insetInlineStart: nextInset,
            inlineSize: nextWidth,
          };
        });
      }
    }

    if (isSearchDropdownOpen) {
      const anchor = searchAnchorRef.current;
      if (anchor) {
        const anchorRect = anchor.getBoundingClientRect();
        const available = Math.max(0, anchorRect.right - minLeft);
        const width = Math.max(0, Math.min(320, available));
        setSearchDropdownStyle((previous) => {
          const nextWidth = `${Math.round(width)}px`;
          if (
            previous?.insetInlineEnd === "0px" &&
            previous?.inlineSize === nextWidth
          ) {
            return previous;
          }
          return {
            insetInlineEnd: "0px",
            inlineSize: nextWidth,
          };
        });
      }
    }
  }, [isSearchDropdownOpen, isViewDropdownOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const isInsideToolbar = rootRef.current?.contains(target) ?? false;
      if (!isInsideToolbar) {
        setIsViewDropdownOpen(false);
        setIsSearchDropdownOpen(false);
        setPendingSearchOpen(false);
        closeViewOverlays();
        return;
      }

      if (
        viewContextMenu &&
        viewContextMenuRef.current &&
        !viewContextMenuRef.current.contains(target)
      ) {
        setViewContextMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsViewDropdownOpen(false);
      setIsSearchDropdownOpen(false);
      setPendingSearchOpen(false);
      closeViewOverlays();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeViewOverlays, viewContextMenu]);

  useEffect(() => {
    if (!isViewDropdownOpen && !isSearchDropdownOpen) {
      return;
    }
    const update = () => {
      positionDropdowns();
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isSearchDropdownOpen, isViewDropdownOpen, positionDropdowns, normalizedSavedViews.length]);

  useEffect(() => {
    if (!hasAnyPanelOpen || !isSearchDropdownOpen) {
      return;
    }
    setIsSearchDropdownOpen(false);
  }, [hasAnyPanelOpen, isSearchDropdownOpen]);

  useEffect(() => {
    if (hasAnyPanelOpen || !pendingSearchOpen) {
      return;
    }
    setIsSearchDropdownOpen(true);
    setPendingSearchOpen(false);
  }, [hasAnyPanelOpen, pendingSearchOpen]);

  useEffect(() => {
    if (isViewDropdownOpen) {
      return;
    }
    setViewDropdownStyle(undefined);
    closeViewOverlays();
  }, [closeViewOverlays, isViewDropdownOpen]);

  useEffect(() => {
    if (isSearchDropdownOpen) {
      return;
    }
    setSearchDropdownStyle(undefined);
  }, [isSearchDropdownOpen]);

  useEffect(() => {
    if (!editingViewId || !isViewDropdownOpen) {
      return;
    }
    inlineRenameInputRef.current?.focus();
    inlineRenameInputRef.current?.select();
  }, [editingViewId, isViewDropdownOpen]);

  useEffect(() => {
    if (editingViewId && !normalizedSavedViews.some((savedView) => savedView.id === editingViewId)) {
      setEditingViewId(null);
      setRenameDraft("");
    }
    if (viewContextMenu && !normalizedSavedViews.some((savedView) => savedView.id === viewContextMenu.viewId)) {
      setViewContextMenu(null);
    }
  }, [editingViewId, normalizedSavedViews, viewContextMenu]);

  const submitCreateView = () => {
    const trimmedName = newViewName.trim();
    if (!trimmedName) {
      return;
    }
    closeViewOverlays();
    onCreateSavedView(trimmedName);
    setNewViewName("");
    setIsViewDropdownOpen(false);
  };

  return (
    <header className="database-block-toolbar" ref={rootRef} data-md-block-control="true">
      <div className="database-block-toolbar-row-main">
        <label className="database-block-view-name-wrap">
          <span className="database-block-toolbar-label">Name</span>
          <div
            className="database-block-toolbar-dropdown-anchor database-block-toolbar-dropdown-anchor-name"
            ref={viewAnchorRef}
          >
            <button
              type="button"
              className={`database-block-toolbar-button database-block-view-name-button${
                isViewDropdownOpen ? " is-active" : ""
              }`}
              aria-expanded={isViewDropdownOpen}
              aria-label={`View ${normalizedActiveViewName}`}
              title={normalizedActiveViewName}
              data-md-block-control="true"
              onClick={() => {
                setIsViewDropdownOpen((value) => !value);
                setIsSearchDropdownOpen(false);
                closeViewOverlays();
              }}
            >
              <span className="database-block-view-name-text">{normalizedActiveViewName}</span>
              <span className="database-block-toolbar-button-icon" aria-hidden="true">
                <ToolbarIcon kind="chevron" />
              </span>
            </button>
            {isViewDropdownOpen ? (
              <div
                ref={viewDropdownRef}
                className="database-block-toolbar-dropdown-panel database-block-view-dropdown"
                style={viewDropdownStyle}
                data-md-block-control="true"
              >
                <div className="database-block-view-dropdown-list">
                  {normalizedSavedViews.map((savedView, index) => {
                    const isActive = savedView.id === activeViewId;
                    const isEditing = savedView.id === editingViewId;
                    const canDelete = normalizedSavedViews.length > 1;
                    const canMoveUp = index > 0;
                    const canMoveDown = index < normalizedSavedViews.length - 1;

                    return (
                      <div
                        key={savedView.id}
                        className={`database-block-view-dropdown-row${
                          draggingViewId === savedView.id ? " is-drag-source" : ""
                        }${
                          dragOverViewId === savedView.id && draggingViewId !== savedView.id
                            ? " is-drag-target"
                            : ""
                        }`}
                      >
                        {isEditing ? (
                          <input
                            ref={(node) => {
                              inlineRenameInputRef.current = node;
                            }}
                            type="text"
                            value={renameDraft}
                            className="database-block-view-dropdown-rename-input"
                            data-md-block-control="true"
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onBlur={(event) => {
                              submitRenameForView(savedView.id, event.currentTarget.value);
                            }}
                            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                                return;
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditingViewId(null);
                                setRenameDraft("");
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            draggable
                            className={`database-block-view-dropdown-item${isActive ? " is-active" : ""}`}
                            onClick={() => {
                              onSelectSavedView(savedView.id);
                              setIsViewDropdownOpen(false);
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const nextPosition = clampMenuPosition(event.clientY, event.clientX);
                              setEditingViewId(null);
                              setRenameDraft("");
                              setViewContextMenu({
                                viewId: savedView.id,
                                top: nextPosition.top,
                                left: nextPosition.left,
                              });
                            }}
                            onDragStart={(event) => handleViewItemDragStart(event, savedView.id)}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setDragOverViewId(savedView.id);
                              setDropEffectSafe(event, "move");
                            }}
                            onDragLeave={(event) => {
                              const related = event.relatedTarget;
                              if (
                                related instanceof Node &&
                                event.currentTarget.contains(related)
                              ) {
                                return;
                              }
                              setDragOverViewId((previous) => (previous === savedView.id ? null : previous));
                            }}
                            onDrop={(event) => handleViewItemDrop(event, savedView.id)}
                            onDragEnd={() => {
                              setDragOverViewId(null);
                              setDraggingViewId(null);
                              endInternalDrag(DRAG_CHANNELS.DATABASE_SAVED_VIEW);
                            }}
                          >
                            <span className="database-block-view-dropdown-item-name">{savedView.name}</span>
                            <span className="database-block-view-dropdown-item-meta" aria-hidden="true">
                              ...
                            </span>
                          </button>
                        )}
                        {viewContextMenu?.viewId === savedView.id ? (
                          <div
                            ref={viewContextMenuRef}
                            role="menu"
                            className="database-block-view-context-menu"
                            style={{
                              top: `${viewContextMenu.top}px`,
                              left: `${viewContextMenu.left}px`,
                            }}
                          >
                            <button
                              type="button"
                              className="database-block-view-context-menu-item"
                              onClick={() => openRenameForView(savedView.id)}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="database-block-view-context-menu-item"
                              onClick={() => {
                                setViewContextMenu(null);
                                onDuplicateSavedView(savedView.id);
                              }}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="database-block-view-context-menu-item"
                              disabled={!canMoveUp}
                              onClick={() => {
                                setViewContextMenu(null);
                                onMoveSavedView(savedView.id, "up");
                              }}
                            >
                              Move up
                            </button>
                            <button
                              type="button"
                              className="database-block-view-context-menu-item"
                              disabled={!canMoveDown}
                              onClick={() => {
                                setViewContextMenu(null);
                                onMoveSavedView(savedView.id, "down");
                              }}
                            >
                              Move down
                            </button>
                            <button
                              type="button"
                              className="database-block-view-context-menu-item is-danger"
                              disabled={!canDelete}
                              onClick={() => {
                                setViewContextMenu(null);
                                if (!canDelete) {
                                  return;
                                }
                                const confirmed = window.confirm(
                                  `Delete view "${savedView.name}"?`,
                                );
                                if (!confirmed) {
                                  return;
                                }
                                onDeleteSavedView(savedView.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="database-block-view-dropdown-create">
                  <input
                    type="text"
                    value={newViewName}
                    placeholder="Neue View"
                    className="database-block-toolbar-create-view-input"
                    data-md-block-control="true"
                    onChange={(event) => setNewViewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitCreateView();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="database-block-toolbar-button"
                    onClick={submitCreateView}
                    data-md-block-control="true"
                  >
                    Create View
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </label>

        <button
          ref={sourceButtonRef}
          type="button"
          className={`database-block-toolbar-button database-block-source-button${
            isSourcePanelOpen ? " is-active" : ""
          }`}
          onClick={onToggleSourcePanel}
          aria-expanded={isSourcePanelOpen}
          data-md-block-control="true"
        >
          {sourceLabel}
        </button>

        <label className="database-block-view-select-wrap">
          <span className="database-block-toolbar-label">View</span>
          <select
            className="database-block-view-select"
            value={viewType}
            onChange={handleViewChange}
          >
            {viewOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <IconOnlyButton
          kind="sort"
          label="Sortieren"
          active={isSortPanelOpen}
          expanded={isSortPanelOpen}
          onClick={onToggleSortPanel}
          buttonRef={sortButtonRef}
        />
        <IconOnlyButton
          kind="filter"
          label="Filtern"
          active={isFilterPanelOpen}
          expanded={isFilterPanelOpen}
          onClick={onToggleFilterPanel}
          buttonRef={filterButtonRef}
        />
        <IconOnlyButton
          kind="properties"
          label="Eigenschaften"
          active={isPropertiesPanelOpen}
          expanded={isPropertiesPanelOpen}
          onClick={onTogglePropertiesPanel}
          buttonRef={propertiesButtonRef}
        />

        {showSearch ? (
          <div
            className="database-block-toolbar-dropdown-anchor database-block-toolbar-dropdown-anchor-search"
            ref={searchAnchorRef}
          >
            <IconOnlyButton
              kind="search"
              label="Suche"
              active={isSearchDropdownOpen}
              expanded={isSearchDropdownOpen}
              onClick={() => {
                setIsViewDropdownOpen(false);
                if (hasAnyPanelOpen) {
                  onCloseAllPanels();
                  setPendingSearchOpen(true);
                  return;
                }
                setPendingSearchOpen(false);
                setIsSearchDropdownOpen((value) => !value);
              }}
            />
            {isSearchDropdownOpen ? (
              <div
                ref={searchDropdownRef}
                className="database-block-toolbar-dropdown-panel database-block-search-dropdown"
                style={searchDropdownStyle}
                data-md-block-control="true"
              >
                <input
                  type="search"
                  className="database-block-toolbar-search-input"
                  value={searchQuery}
                  placeholder="Suche"
                  onChange={(event) => onSearchChange(event.target.value)}
                  data-md-block-control="true"
                  autoFocus
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="database-block-toolbar-row-secondary">
        {viewType === "kanban" ? (
          <button
            ref={kanbanButtonRef}
            type="button"
            className={`database-block-toolbar-button${isKanbanPanelOpen ? " is-active" : ""}`}
            onClick={onToggleKanbanPanel}
            aria-expanded={isKanbanPanelOpen}
            data-md-block-control="true"
          >
            Kanban Optionen
          </button>
        ) : null}
        {viewType === "gantt" ? (
          <button
            ref={ganttButtonRef}
            type="button"
            className={`database-block-toolbar-button${isGanttPanelOpen ? " is-active" : ""}`}
            onClick={onToggleGanttPanel}
            aria-expanded={isGanttPanelOpen}
            data-md-block-control="true"
          >
            Timeline Optionen
          </button>
        ) : null}
        {viewType === "project" ? (
          <button
            ref={projectButtonRef}
            type="button"
            className={`database-block-toolbar-button${isProjectPanelOpen ? " is-active" : ""}`}
            onClick={onToggleProjectPanel}
            aria-expanded={isProjectPanelOpen}
            data-md-block-control="true"
          >
            Project Optionen
          </button>
        ) : null}
        {viewType === "pie" ? (
          <button
            ref={pieButtonRef}
            type="button"
            className={`database-block-toolbar-button${isPiePanelOpen ? " is-active" : ""}`}
            onClick={onTogglePiePanel}
            aria-expanded={isPiePanelOpen}
            data-md-block-control="true"
          >
            Pie Optionen
          </button>
        ) : null}
      </div>
    </header>
  );
};
