/**
 * @file apps/fmd-desktop/src/features/preview/database/views/table-view.tsx
 *
 * Virtualized table view for database records.
 */

import {
  type UIEvent,
  useMemo,
  useState,
} from "react";
import { DatabaseCellRenderer } from "../ui/database-cell-renderers";
import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
} from "../database-types";

type DatabaseTableViewProps = {
  records: DatabaseRecord[];
  columns: DatabaseAttributeMeta[];
  onOpenRecord: (record: DatabaseRecord) => void;
};

const TABLE_ROW_HEIGHT = 34;
const TABLE_OVERSCAN = 10;
const TABLE_VIEWPORT_HEIGHT = 320;

export const DatabaseTableView = ({
  records,
  columns,
  onOpenRecord,
}: DatabaseTableViewProps) => {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = records.length * TABLE_ROW_HEIGHT;

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN);
    const visibleCount = Math.ceil(TABLE_VIEWPORT_HEIGHT / TABLE_ROW_HEIGHT) + TABLE_OVERSCAN * 2;
    const end = Math.min(records.length, start + visibleCount);
    return { start, end };
  }, [records.length, scrollTop]);

  const visibleRows = records.slice(visibleRange.start, visibleRange.end);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  if (columns.length === 0) {
    return <div className="database-table-empty">Keine Attribute gefunden.</div>;
  }

  return (
    <div className="database-table-view">
      <div className="database-table-header-row" role="row">
        {columns.map((column) => (
          <div key={column.key} className="database-table-header-cell" role="columnheader">
            {column.label}
          </div>
        ))}
      </div>
      <div
        className="database-table-scroll"
        role="rowgroup"
        onScroll={handleScroll}
        style={{ maxHeight: `${TABLE_VIEWPORT_HEIGHT}px` }}
      >
        <div className="database-table-spacer" style={{ height: `${totalHeight}px` }}>
          {visibleRows.map((record, localIndex) => {
            const rowIndex = visibleRange.start + localIndex;
            const top = rowIndex * TABLE_ROW_HEIGHT;
            return (
              <button
                key={record.fileId}
                type="button"
                className="database-table-row"
                role="row"
                onClick={() => onOpenRecord(record)}
                style={{
                  top: `${top}px`,
                  height: `${TABLE_ROW_HEIGHT}px`,
                }}
              >
                {columns.map((column) => (
                  <span key={`${record.fileId}:${column.key}`} className="database-table-cell" role="cell">
                    <DatabaseCellRenderer
                      attribute={column}
                      value={record.normalizedFields[column.key] ?? null}
                    />
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
