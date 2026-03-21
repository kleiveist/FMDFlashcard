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
          <button
            type="button"
            className={`database-block-toolbar-button${isSortPanelOpen ? " is-active" : ""}`}
            onClick={onToggleSortPanel}
            aria-expanded={isSortPanelOpen}
            data-md-block-control="true"
          >
            Sortieren
          </button>
          <button
            type="button"
            className={`database-block-toolbar-button${isFilterPanelOpen ? " is-active" : ""}`}
            onClick={onToggleFilterPanel}
            aria-expanded={isFilterPanelOpen}
            data-md-block-control="true"
          >
            Filtern
          </button>
          <button
            type="button"
            className={`database-block-toolbar-button${isPropertiesPanelOpen ? " is-active" : ""}`}
            onClick={onTogglePropertiesPanel}
            aria-expanded={isPropertiesPanelOpen}
            data-md-block-control="true"
          >
            Eigenschaften
          </button>
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
