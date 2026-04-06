/**
 * @file apps/fmd-desktop/src/features/preview/database/views/kanban-view.tsx
 *
 * Kanban visualization for grouped database records.
 */

import { useMemo } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseFieldType,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "../database-types";

type DatabaseKanbanViewProps = {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
  attributes: DatabaseAttributeMeta[];
  visibleProperties: DatabaseAttributeMeta[];
  showCover: boolean;
  pendingRecordIds: string[];
  onMoveRecord: (record: DatabaseRecord, nextGroupValue: string) => void;
  onOpenRecord: (record: DatabaseRecord) => void;
  onOpenExamFromRecord?: (record: DatabaseRecord) => void;
};

const EMPTY_GROUP_LABEL = "(leer)";

const toLower = (value: string) => value.trim().toLowerCase();
const isExamFieldKey = (key: string) => toLower(key) === "exam";

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

const stringifyMetaValue = (value: DatabaseNormalizedFieldValue, type: DatabaseFieldType): string | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (value instanceof Date) {
    return type === "date"
      ? value.toLocaleDateString()
      : value.toLocaleString();
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry) => String(entry).trim()).filter(Boolean);
    return entries.length > 0 ? entries.join(", ") : null;
  }
  if (typeof value === "object") {
    const objectValue = value as {
      value?: unknown;
      raw?: unknown;
    };
    if (typeof objectValue.value === "number" && Number.isFinite(objectValue.value)) {
      return String(objectValue.value);
    }
    if (typeof objectValue.raw !== "undefined") {
      const raw = String(objectValue.raw ?? "").trim();
      return raw || null;
    }
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  const text = String(value).trim();
  return text || null;
};

const normalizeCoverCandidate = (raw: string): string => {
  const trimmed = raw.trim();
  const wikilink = trimmed.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (wikilink?.[1]) {
    return wikilink[1].trim();
  }
  return trimmed;
};

const resolveCoverSource = (
  record: DatabaseRecord,
  attributes: DatabaseAttributeMeta[],
): string | null => {
  const preferredKeys = ["cover", "image", "thumbnail"];
  for (const key of preferredKeys) {
    const raw = getRecordValueByField(record, key);
    const resolved = stringifyMetaValue(raw, "image");
    if (resolved) {
      return normalizeCoverCandidate(resolved);
    }
  }

  const imageAttributes = attributes.filter((attribute) => attribute.type === "image");
  for (const attribute of imageAttributes) {
    const raw = getRecordValueByField(record, attribute.key);
    const resolved = stringifyMetaValue(raw, attribute.type);
    if (resolved) {
      return normalizeCoverCandidate(resolved);
    }
  }
  return null;
};

export const DatabaseKanbanView = ({
  records,
  groupAttribute,
  attributes,
  visibleProperties,
  showCover,
  pendingRecordIds,
  onMoveRecord,
  onOpenRecord,
  onOpenExamFromRecord,
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
            {group.records.map((record) => {
              const coverSource = showCover ? resolveCoverSource(record, attributes) : null;
              const metaRows = visibleProperties
                .filter((attribute) =>
                  toLower(attribute.key) !== toLower(groupAttribute.key))
                .map((attribute) => {
                  if (isExamFieldKey(attribute.key)) {
                    const isExamEligible = getRecordValueByField(record, attribute.key) === true;
                    if (!isExamEligible || !onOpenExamFromRecord) {
                      return null;
                    }
                    return {
                      key: attribute.key,
                      kind: "action" as const,
                    };
                  }
                  const value = stringifyMetaValue(
                    getRecordValueByField(record, attribute.key),
                    attribute.type,
                  );
                  if (!value) {
                    return null;
                  }
                  return {
                    key: attribute.key,
                    kind: "text" as const,
                    label: attribute.label || attribute.key,
                    value,
                  };
                })
                .filter((entry): entry is (
                  | { key: string; kind: "text"; label: string; value: string }
                  | { key: string; kind: "action" }
                ) => Boolean(entry));

              const hoverOnlyMeta = Boolean(showCover && coverSource);

              return (
                <article
                  key={record.fileId}
                  className={`database-kanban-card${pendingIds.has(record.fileId) ? " is-pending" : ""}${
                    coverSource ? " has-cover" : ""
                  }`}
                  draggable={!pendingIds.has(record.fileId)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", record.fileId);
                  }}
                >
                  {coverSource ? (
                    <div className="database-kanban-card-cover">
                      <img
                        src={coverSource}
                        alt=""
                        className="database-kanban-card-cover-image"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
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
                  {metaRows.length > 0 ? (
                    <div className={`database-kanban-card-properties${hoverOnlyMeta ? " is-hover-only" : ""}`}>
                      {metaRows.map((entry) => (
                        <p key={entry.key} className="database-kanban-card-meta-row">
                          {entry.kind === "action" ? (
                            <button
                              type="button"
                              className="database-exam-action"
                              onClick={() => onOpenExamFromRecord?.(record)}
                              title="Exam starten"
                              data-md-block-control="true"
                            >
                              Exam
                            </button>
                          ) : (
                            <>
                              <strong>{entry.label}:</strong> {entry.value}
                            </>
                          )}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
