/**
 * @file apps/fmd-desktop/src/features/preview/database/views/kanban-view.tsx
 *
 * Kanban visualization for grouped database records.
 */

import { useMemo } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "../database-types";

type DatabaseKanbanViewProps = {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
  pendingRecordIds: string[];
  onMoveRecord: (record: DatabaseRecord, nextGroupValue: string) => void;
  onOpenRecord: (record: DatabaseRecord) => void;
};

const EMPTY_GROUP_LABEL = "(leer)";

const toLower = (value: string) => value.trim().toLowerCase();

const getRecordValueByField = (record: DatabaseRecord, field: string) => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = toLower(field);
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => toLower(key) === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

const stringifyGroupValue = (value: DatabaseNormalizedFieldValue) => {
  if (value === null || typeof value === "undefined") {
    return EMPTY_GROUP_LABEL;
  }
  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((entry) => String(entry).trim()).filter(Boolean).join(", ")
      : EMPTY_GROUP_LABEL;
  }
  if (typeof value === "object" && "raw" in value) {
    const raw = String(value.raw ?? "").trim();
    return raw || EMPTY_GROUP_LABEL;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  const text = String(value).trim();
  return text || EMPTY_GROUP_LABEL;
};

export const DatabaseKanbanView = ({
  records,
  groupAttribute,
  pendingRecordIds,
  onMoveRecord,
  onOpenRecord,
}: DatabaseKanbanViewProps) => {
  const pendingIds = useMemo(() => new Set(pendingRecordIds), [pendingRecordIds]);
  const recordsById = useMemo(
    () => new Map(records.map((record) => [record.fileId, record])),
    [records],
  );
  const grouped = useMemo(() => {
    if (!groupAttribute) {
      return [] as Array<{ label: string; records: DatabaseRecord[] }>;
    }
    const buckets = new Map<string, DatabaseRecord[]>();
    records.forEach((record) => {
      const label = stringifyGroupValue(getRecordValueByField(record, groupAttribute.key));
      const bucket = buckets.get(label);
      if (bucket) {
        bucket.push(record);
      } else {
        buckets.set(label, [record]);
      }
    });
    const labels = Array.from(buckets.keys()).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" }));
    return labels.map((label) => ({
      label,
      records: buckets.get(label) ?? [],
    }));
  }, [groupAttribute, records]);

  if (!groupAttribute || !groupAttribute.viewCompatibility.supportsKanbanGrouping) {
    return (
      <div className="database-view-empty">
        Waehle ein Status-/Select-/Kategoriefeld fuer Kanban.
      </div>
    );
  }

  return (
    <div className="database-kanban-view">
      {grouped.map((group) => (
        <section
          key={group.label}
          className="database-kanban-column"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const recordId = event.dataTransfer.getData("text/plain");
            if (!recordId) {
              return;
            }
            const record = recordsById.get(recordId);
            if (!record) {
              return;
            }
            const previousValue = stringifyGroupValue(getRecordValueByField(record, groupAttribute.key));
            if (previousValue === group.label) {
              return;
            }
            onMoveRecord(record, group.label === EMPTY_GROUP_LABEL ? "" : group.label);
          }}
        >
          <header className="database-kanban-column-header">
            <h6>{group.label}</h6>
            <span>{group.records.length}</span>
          </header>
          <div className="database-kanban-column-body">
            {group.records.map((record) => (
              <article
                key={record.fileId}
                className={`database-kanban-card${pendingIds.has(record.fileId) ? " is-pending" : ""}`}
                draggable={!pendingIds.has(record.fileId)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", record.fileId);
                }}
              >
                <button
                  type="button"
                  className="database-kanban-card-title"
                  onClick={() => onOpenRecord(record)}
                  data-md-block-control="true"
                >
                  {record.systemFields.Dateiname ? String(record.systemFields.Dateiname) : record.fileId}
                </button>
                <p className="database-kanban-card-meta">
                  {record.relativePath}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
