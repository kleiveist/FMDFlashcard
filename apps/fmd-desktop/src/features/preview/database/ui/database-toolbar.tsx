/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-toolbar.tsx
 *
 * Unified toolbar shell for database block interactions.
 */

import { type ChangeEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DatabaseViewType } from "../database-types";

type DatabaseToolbarButtonRef = (node: HTMLButtonElement | null) => void;

type DatabaseToolbarProps = {
  activeViewId: string;
  activeViewName: string;
  savedViews: Array<{ id: string; name: string }>;
  sourceLabel: string;
  viewType: DatabaseViewType;
  kanbanGroupBy: string | null;
  kanbanGroupByOptions: Array<{ key: string; label: string }>;
  searchQuery: string;
  showSearch: boolean;
  onSearchChange: (nextValue: string) => void;
  onViewTypeChange: (nextView: DatabaseViewType) => void;
  onKanbanGroupByChange: (nextValue: string | null) => void;
  onSelectSavedView: (viewId: string) => void;
  onCreateSavedView: (name: string) => void;
  isSourcePanelOpen: boolean;
  isFilterPanelOpen: boolean;
  isSortPanelOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isGanttPanelOpen: boolean;
  isProjectPanelOpen: boolean;
  isPiePanelOpen: boolean;
  onToggleSourcePanel: () => void;
  onToggleFilterPanel: () => void;
  onToggleSortPanel: () => void;
  onTogglePropertiesPanel: () => void;
  onToggleGanttPanel: () => void;
  onToggleProjectPanel: () => void;
  onTogglePiePanel: () => void;
  sourceButtonRef?: DatabaseToolbarButtonRef;
  sortButtonRef?: DatabaseToolbarButtonRef;
  filterButtonRef?: DatabaseToolbarButtonRef;
  propertiesButtonRef?: DatabaseToolbarButtonRef;
  ganttButtonRef?: DatabaseToolbarButtonRef;
  projectButtonRef?: DatabaseToolbarButtonRef;
  pieButtonRef?: DatabaseToolbarButtonRef;
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
  kanbanGroupBy,
  kanbanGroupByOptions,
  searchQuery,
  showSearch,
  onSearchChange,
  onViewTypeChange,
  onKanbanGroupByChange,
  onSelectSavedView,
  onCreateSavedView,
  isSourcePanelOpen,
  isFilterPanelOpen,
  isSortPanelOpen,
  isPropertiesPanelOpen,
  isGanttPanelOpen,
  isProjectPanelOpen,
  isPiePanelOpen,
  onToggleSourcePanel,
  onToggleFilterPanel,
  onToggleSortPanel,
  onTogglePropertiesPanel,
  onToggleGanttPanel,
  onToggleProjectPanel,
  onTogglePiePanel,
  sourceButtonRef,
  sortButtonRef,
  filterButtonRef,
  propertiesButtonRef,
  ganttButtonRef,
  projectButtonRef,
  pieButtonRef,
}: DatabaseToolbarProps) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const viewAnchorRef = useRef<HTMLDivElement | null>(null);
  const viewDropdownRef = useRef<HTMLDivElement | null>(null);
  const searchAnchorRef = useRef<HTMLDivElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [viewDropdownStyle, setViewDropdownStyle] = useState<CSSProperties | undefined>(undefined);
  const [searchDropdownStyle, setSearchDropdownStyle] = useState<CSSProperties | undefined>(undefined);
  const [newViewName, setNewViewName] = useState("");
  const normalizedActiveViewName = activeViewName.trim() || "View";

  const normalizedSavedViews = useMemo(
    () => savedViews.filter((savedView) => savedView.id.trim().length > 0),
    [savedViews],
  );

  const handleViewChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as DatabaseViewType;
    onViewTypeChange(next);
  };

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
      if (rootRef.current?.contains(target)) {
        return;
      }
      setIsViewDropdownOpen(false);
      setIsSearchDropdownOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsViewDropdownOpen(false);
      setIsSearchDropdownOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
    if (isViewDropdownOpen) {
      return;
    }
    setViewDropdownStyle(undefined);
  }, [isViewDropdownOpen]);

  useEffect(() => {
    if (isSearchDropdownOpen) {
      return;
    }
    setSearchDropdownStyle(undefined);
  }, [isSearchDropdownOpen]);

  const submitCreateView = () => {
    const trimmedName = newViewName.trim();
    if (!trimmedName) {
      return;
    }
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
                  {normalizedSavedViews.map((savedView) => (
                    <button
                      key={savedView.id}
                      type="button"
                      className={`database-block-view-dropdown-item${
                        savedView.id === activeViewId ? " is-active" : ""
                      }`}
                      onClick={() => {
                        onSelectSavedView(savedView.id);
                        setIsViewDropdownOpen(false);
                      }}
                    >
                      {savedView.name}
                    </button>
                  ))}
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
                setIsSearchDropdownOpen((value) => !value);
                setIsViewDropdownOpen(false);
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
          <label className="database-block-view-select-wrap">
            <span className="database-block-toolbar-label">Group by</span>
            <select
              className="database-block-view-select"
              value={kanbanGroupBy ?? ""}
              onChange={(event) => onKanbanGroupByChange(event.target.value || null)}
            >
              <option value="">Auto</option>
              {kanbanGroupByOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
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
