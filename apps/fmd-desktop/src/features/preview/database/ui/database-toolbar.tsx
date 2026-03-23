/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-toolbar.tsx
 *
 * Toolbar shell for database block interactions.
 */

import { type ChangeEvent } from "react";
import { type DatabaseViewType } from "../database-types";

type DatabaseToolbarProps = {
  title: string;
  sourceLabel: string;
  viewType: DatabaseViewType;
  kanbanGroupBy: string | null;
  kanbanGroupByOptions: Array<{ key: string; label: string }>;
  searchQuery: string;
  showSearch: boolean;
  onTitleChange: (nextTitle: string) => void;
  onTitleBlur: (nextTitle: string) => void;
  onSearchChange: (nextValue: string) => void;
  onViewTypeChange: (nextView: DatabaseViewType) => void;
  onKanbanGroupByChange: (nextValue: string | null) => void;
  isSourcePanelOpen: boolean;
  isFilterPanelOpen: boolean;
  isSortPanelOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isGanttPanelOpen: boolean;
  isPiePanelOpen: boolean;
  onToggleSourcePanel: () => void;
  onToggleFilterPanel: () => void;
  onToggleSortPanel: () => void;
  onTogglePropertiesPanel: () => void;
  onToggleGanttPanel: () => void;
  onTogglePiePanel: () => void;
};

const viewOptions: Array<{ value: DatabaseViewType; label: string }> = [
  { value: "table", label: "Table" },
  { value: "kanban", label: "Kanban" },
  { value: "gantt", label: "Timeline" },
  { value: "pie", label: "Pie" },
];

type CompactToolbarActionKind = "sort" | "filter" | "properties";

const CompactToolbarActionIcon = ({ kind }: { kind: CompactToolbarActionKind }) => {
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
    default:
      return null;
  }
};

const CompactToolbarActionButton = ({
  kind,
  label,
  active,
  expanded,
  onClick,
}: {
  kind: CompactToolbarActionKind;
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={`database-block-toolbar-button database-block-toolbar-button-compactable${
      active ? " is-active" : ""
    }`}
    onClick={onClick}
    aria-expanded={expanded}
    aria-label={label}
    title={label}
    data-md-block-control="true"
  >
    <span className="database-block-toolbar-button-icon" aria-hidden="true">
      <CompactToolbarActionIcon kind={kind} />
    </span>
    <span className="database-block-toolbar-button-label">{label}</span>
  </button>
);

export const DatabaseToolbar = ({
  title,
  sourceLabel,
  viewType,
  kanbanGroupBy,
  kanbanGroupByOptions,
  searchQuery,
  showSearch,
  onTitleChange,
  onTitleBlur,
  onSearchChange,
  onViewTypeChange,
  onKanbanGroupByChange,
  isSourcePanelOpen,
  isFilterPanelOpen,
  isSortPanelOpen,
  isPropertiesPanelOpen,
  isGanttPanelOpen,
  isPiePanelOpen,
  onToggleSourcePanel,
  onToggleFilterPanel,
  onToggleSortPanel,
  onTogglePropertiesPanel,
  onToggleGanttPanel,
  onTogglePiePanel,
}: DatabaseToolbarProps) => {
  const handleViewChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as DatabaseViewType;
    onViewTypeChange(next);
  };

  return (
    <header className="database-block-toolbar" data-md-block-control="true">
      <div className="database-block-toolbar-main">
        <label className="database-block-title-field">
          <span className="database-block-toolbar-label">Name</span>
          <input
            type="text"
            className="database-block-title-input"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={(event) => onTitleBlur(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            placeholder="Database Name"
            data-md-block-control="true"
          />
        </label>
        <button
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
      </div>
      <div className="database-block-toolbar-actions">
        <div className="database-block-toolbar-action-buttons">
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
          <CompactToolbarActionButton
            kind="sort"
            label="Sortieren"
            active={isSortPanelOpen}
            expanded={isSortPanelOpen}
            onClick={onToggleSortPanel}
          />
          <CompactToolbarActionButton
            kind="filter"
            label="Filtern"
            active={isFilterPanelOpen}
            expanded={isFilterPanelOpen}
            onClick={onToggleFilterPanel}
          />
          <CompactToolbarActionButton
            kind="properties"
            label="Eigenschaften"
            active={isPropertiesPanelOpen}
            expanded={isPropertiesPanelOpen}
            onClick={onTogglePropertiesPanel}
          />
          {viewType === "gantt" ? (
            <button
              type="button"
              className={`database-block-toolbar-button${isGanttPanelOpen ? " is-active" : ""}`}
              onClick={onToggleGanttPanel}
              aria-expanded={isGanttPanelOpen}
              data-md-block-control="true"
            >
              Timeline Optionen
            </button>
          ) : null}
          {viewType === "pie" ? (
            <button
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
        {showSearch ? (
          <div className="database-block-toolbar-search-wrap">
            <input
              type="search"
              className="database-block-search"
              value={searchQuery}
              placeholder="Suche"
              onChange={(event) => onSearchChange(event.target.value)}
              data-md-block-control="true"
            />
          </div>
        ) : null}
      </div>
    </header>
  );
};
