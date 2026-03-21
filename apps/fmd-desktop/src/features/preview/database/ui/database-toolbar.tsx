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
  searchQuery: string;
  showSearch: boolean;
  onSearchChange: (nextValue: string) => void;
  onViewTypeChange: (nextView: DatabaseViewType) => void;
  onToggleFilterPanel: () => void;
  onToggleSortPanel: () => void;
  onTogglePropertiesPanel: () => void;
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
  searchQuery,
  showSearch,
  onSearchChange,
  onViewTypeChange,
  onToggleFilterPanel,
  onToggleSortPanel,
  onTogglePropertiesPanel,
}: DatabaseToolbarProps) => {
  const handleViewChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as DatabaseViewType;
    onViewTypeChange(next);
  };

  return (
    <header className="database-block-toolbar" data-md-block-control="true">
      <div className="database-block-toolbar-main">
        <h4 className="database-block-title">{title || "Database"}</h4>
        <span className="database-block-source">{sourceLabel}</span>
      </div>
      <div className="database-block-toolbar-actions">
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
        <button type="button" className="database-block-toolbar-button" onClick={onToggleSortPanel}>
          Sortieren
        </button>
        <button type="button" className="database-block-toolbar-button" onClick={onToggleFilterPanel}>
          Filtern
        </button>
        <button type="button" className="database-block-toolbar-button" onClick={onTogglePropertiesPanel}>
          Eigenschaften
        </button>
        {showSearch ? (
          <input
            type="search"
            className="database-block-search"
            value={searchQuery}
            placeholder="Suche"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        ) : null}
      </div>
    </header>
  );
};
