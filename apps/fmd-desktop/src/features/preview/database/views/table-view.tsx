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
const OPEN_RECORD_COLUMN_KEYS = new Set([
  "dateiname",
  "dateiname mit endung",
  "dateipfad",
]);

const getRecordValueByField = (record: DatabaseRecord, field: string) => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = field.trim().toLowerCase();
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => key.trim().toLowerCase() === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

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
              <div
                key={record.fileId}
                className="database-table-row"
                role="row"
                onDoubleClick={() => onOpenRecord(record)}
                style={{
                  top: `${top}px`,
                  height: `${TABLE_ROW_HEIGHT}px`,
                }}
                data-md-block-control="true"
              >
                {columns.map((column) => (
                  <span key={`${record.fileId}:${column.key}`} className="database-table-cell" role="cell">
                    {OPEN_RECORD_COLUMN_KEYS.has(column.key.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        className="database-table-open-record"
                        onClick={() => onOpenRecord(record)}
                        title="Datei oeffnen"
                        data-md-block-control="true"
                      >
                        <DatabaseCellRenderer
                          attribute={column}
                          value={getRecordValueByField(record, column.key)}
                        />
                      </button>
                    ) : (
                      <DatabaseCellRenderer
                        attribute={column}
                        value={getRecordValueByField(record, column.key)}
                      />
                    )}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
