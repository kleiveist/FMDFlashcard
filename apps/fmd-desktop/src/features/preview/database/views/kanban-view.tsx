/**
 * @file apps/fmd-desktop/src/features/preview/database/views/kanban-view.tsx
 *
 * Kanban visualization for grouped database records.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { type MouseEvent as ReactMouseEvent } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseFieldType,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "../database-types";
import {
  formatMonitoringCompactText,
  renderMonitoringValue,
  type MonitoringRenderProfile,
} from "../../../monitoring/monitoring-render-rules";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDragText,
  setDropEffectSafe,
  startInternalDrag,
} from "../../../../lib/dragDrop";

type DatabaseKanbanViewProps = {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
  attributes: DatabaseAttributeMeta[];
  visibleProperties: DatabaseAttributeMeta[];
  showCover: boolean;
  orderByGroup?: Record<string, string[]>;
  monitoringProfiles?: MonitoringRenderProfile[];
  pendingRecordIds: string[];
  onMoveRecord: (
    record: DatabaseRecord,
    nextGroupValue: string,
    context: { previousGroupKey: string; nextGroupKey: string },
  ) => void;
  onReorderRecordWithinGroup: (
    groupKey: string,
    recordId: string,
    direction: "up" | "down",
  ) => void;
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

const stringifyRawGroupValue = (value: DatabaseNormalizedFieldValue) => {
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

const formatGroupLabel = (
  key: string,
  rawValue: string,
  monitoringProfiles: MonitoringRenderProfile[],
) => {
  const monitoringText = formatMonitoringCompactText(
    renderMonitoringValue({
      attributeKey: key,
      value: rawValue === EMPTY_GROUP_LABEL ? "" : rawValue,
      profiles: monitoringProfiles,
    }),
    rawValue,
  );
  const trimmed = monitoringText.trim();
  return trimmed || rawValue;
};

const applyGroupOrder = (
  records: DatabaseRecord[],
  order: string[] | undefined,
) => {
  if (!order || order.length === 0 || records.length <= 1) {
    return records;
  }
  const orderIndex = new Map<string, number>();
  order.forEach((recordId, index) => {
    if (!orderIndex.has(recordId)) {
      orderIndex.set(recordId, index);
    }
  });
  const prioritized: DatabaseRecord[] = [];
  const fallback: DatabaseRecord[] = [];
  records.forEach((record) => {
    if (orderIndex.has(record.fileId)) {
      prioritized.push(record);
      return;
    }
    fallback.push(record);
  });
  prioritized.sort((left, right) =>
    (orderIndex.get(left.fileId) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndex.get(right.fileId) ?? Number.MAX_SAFE_INTEGER));
  return [...prioritized, ...fallback];
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
  orderByGroup = {},
  monitoringProfiles = [],
  pendingRecordIds,
  onMoveRecord,
  onReorderRecordWithinGroup,
  onOpenRecord,
  onOpenExamFromRecord,
}: DatabaseKanbanViewProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingIds = useMemo(() => new Set(pendingRecordIds), [pendingRecordIds]);
  const [touchSelectedRecordId, setTouchSelectedRecordId] = useState<string | null>(null);
  const [touchSourceGroupKey, setTouchSourceGroupKey] = useState<string | null>(null);
  const touchSelectedRecordIdRef = useRef<string | null>(null);
  const touchSourceGroupKeyRef = useRef<string | null>(null);
  const recordsById = useMemo(
    () => new Map(records.map((record) => [record.fileId, record])),
    [records],
  );
  const grouped = useMemo(() => {
    if (!groupAttribute) {
      return [] as Array<{ key: string; label: string; records: DatabaseRecord[] }>;
    }
    const buckets = new Map<string, DatabaseRecord[]>();
    records.forEach((record) => {
      const rawLabel = stringifyRawGroupValue(
        getRecordValueByField(record, groupAttribute.key),
      );
      const bucket = buckets.get(rawLabel);
      if (bucket) {
        bucket.push(record);
      } else {
        buckets.set(rawLabel, [record]);
      }
    });
    return Array.from(buckets.entries())
      .map(([key, bucketRecords]) => ({
        key,
        label: formatGroupLabel(groupAttribute.key, key, monitoringProfiles),
        records: applyGroupOrder(bucketRecords, orderByGroup[key]),
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
  }, [groupAttribute, monitoringProfiles, orderByGroup, records]);
  const clearTouchSelection = () => {
    touchSelectedRecordIdRef.current = null;
    touchSourceGroupKeyRef.current = null;
    setTouchSelectedRecordId(null);
    setTouchSourceGroupKey(null);
  };

  const selectTouchSourceRecord = (record: DatabaseRecord, groupKey: string) => {
    if (pendingIds.has(record.fileId)) {
      return;
    }
    if (
      touchSelectedRecordIdRef.current === record.fileId &&
      touchSourceGroupKeyRef.current === groupKey
    ) {
      clearTouchSelection();
      return;
    }
    touchSelectedRecordIdRef.current = record.fileId;
    touchSourceGroupKeyRef.current = groupKey;
    setTouchSelectedRecordId(record.fileId);
    setTouchSourceGroupKey(groupKey);
  };

  const moveTouchSelectionToGroup = (targetGroupKey: string) => {
    if (!groupAttribute || !touchSelectedRecordIdRef.current) {
      return;
    }
    const record = recordsById.get(touchSelectedRecordIdRef.current);
    if (!record || pendingIds.has(record.fileId)) {
      clearTouchSelection();
      return;
    }
    const previousGroupValue = stringifyRawGroupValue(
      getRecordValueByField(record, groupAttribute.key),
    );
    if (previousGroupValue === targetGroupKey) {
      // Keep selection when tapping within the same column body/section.
      return;
    }
    onMoveRecord(record, targetGroupKey === EMPTY_GROUP_LABEL ? "" : targetGroupKey, {
      previousGroupKey: previousGroupValue,
      nextGroupKey: targetGroupKey,
    });
    clearTouchSelection();
  };

  const handleColumnTap = (
    groupKey: string,
  ) => {
    if (!touchSelectedRecordIdRef.current) {
      return;
    }
    moveTouchSelectionToGroup(groupKey);
  };

  const handleCardTap = (
    event: ReactMouseEvent<HTMLElement>,
    groupKey: string,
    record: DatabaseRecord,
  ) => {
    const target = event.target as HTMLElement | null;
    const nearestControl = target?.closest("[data-md-block-control='true']") ?? null;
    if (nearestControl && nearestControl !== event.currentTarget) {
      return;
    }
    event.stopPropagation();
    const selectedRecordId = touchSelectedRecordIdRef.current;
    const sourceGroupKey = touchSourceGroupKeyRef.current;
    if (selectedRecordId && sourceGroupKey && sourceGroupKey !== groupKey) {
      moveTouchSelectionToGroup(groupKey);
      return;
    }
    selectTouchSourceRecord(record, groupKey);
  };

  const handleBodyTap = (
    event: ReactMouseEvent<HTMLDivElement>,
    groupKey: string,
  ) => {
    const target = event.target as HTMLElement | null;
    const nearestControl = target?.closest("[data-md-block-control='true']") ?? null;
    if (nearestControl && nearestControl !== event.currentTarget) {
      return;
    }
    event.stopPropagation();
    handleColumnTap(groupKey);
  };

  const handleSectionTap = (
    event: ReactMouseEvent<HTMLElement>,
    groupKey: string,
  ) => {
    const target = event.target as HTMLElement | null;
    const nearestControl = target?.closest("[data-md-block-control='true']") ?? null;
    if (nearestControl && nearestControl !== event.currentTarget) {
      return;
    }
    handleColumnTap(groupKey);
  };

  useEffect(() => {
    if (!groupAttribute || !touchSelectedRecordId) {
      return;
    }
    const selectedRecord = recordsById.get(touchSelectedRecordId);
    if (!selectedRecord || pendingIds.has(selectedRecord.fileId)) {
      clearTouchSelection();
      return;
    }
    const nextGroupKey = stringifyRawGroupValue(
      getRecordValueByField(selectedRecord, groupAttribute.key),
    );
    if (touchSourceGroupKey !== nextGroupKey) {
      touchSourceGroupKeyRef.current = nextGroupKey;
      setTouchSourceGroupKey(nextGroupKey);
    }
  }, [
    groupAttribute,
    pendingIds,
    recordsById,
    touchSelectedRecordId,
    touchSourceGroupKey,
  ]);

  useEffect(() => {
    touchSelectedRecordIdRef.current = touchSelectedRecordId;
  }, [touchSelectedRecordId]);

  useEffect(() => {
    touchSourceGroupKeyRef.current = touchSourceGroupKey;
  }, [touchSourceGroupKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      clearTouchSelection();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const hostDatabaseBlock = rootRef.current?.closest(".database-block");
      const targetDatabaseBlock = target.closest(".database-block");
      if (hostDatabaseBlock && targetDatabaseBlock === hostDatabaseBlock) {
        return;
      }
      if (!hostDatabaseBlock && rootRef.current?.contains(target)) {
        return;
      }
      clearTouchSelection();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  if (!groupAttribute || !groupAttribute.viewCompatibility.supportsKanbanGrouping) {
    return (
      <div className="database-view-empty">
        Waehle ein Status-/Select-/Kategoriefeld fuer Kanban.
      </div>
    );
  }

  return (
    <div className="database-kanban-view" ref={rootRef}>
      {grouped.map((group) => (
        <section
          key={group.key}
          className={`database-kanban-column${
            touchSelectedRecordId && touchSourceGroupKey === group.key
              ? " is-touch-source"
              : ""
          }`}
          onClick={(event) => handleSectionTap(event, group.key)}
          data-md-block-control="true"
          onDragOver={(event) => {
            event.preventDefault();
            setDropEffectSafe(event, "move");
          }}
          onDrop={(event) => {
            event.preventDefault();
            const recordId = readInternalDragText(event, {
              channel: DRAG_CHANNELS.DATABASE_RECORD,
            });
            if (!recordId) {
              endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
              return;
            }
            const record = recordsById.get(recordId);
            if (!record) {
              endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
              return;
            }
            const previousGroupValue = stringifyRawGroupValue(
              getRecordValueByField(record, groupAttribute.key),
            );
            if (previousGroupValue === group.key) {
              endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
              return;
            }
            clearTouchSelection();
            onMoveRecord(record, group.key === EMPTY_GROUP_LABEL ? "" : group.key, {
              previousGroupKey: previousGroupValue,
              nextGroupKey: group.key,
            });
            endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
          }}
        >
          <header className="database-kanban-column-header">
            <h6>{group.label}</h6>
            <span>{group.records.length}</span>
          </header>
          <div
            className="database-kanban-column-body"
            onClick={(event) => handleBodyTap(event, group.key)}
            data-md-block-control="true"
          >
            {group.records.map((record, index) => {
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
                  const rawMetaValue = getRecordValueByField(record, attribute.key);
                  const monitoringText = formatMonitoringCompactText(
                    renderMonitoringValue({
                      attributeKey: attribute.key,
                      value: rawMetaValue,
                      profiles: monitoringProfiles,
                    }),
                    rawMetaValue,
                  );
                  const value = monitoringText ||
                    stringifyMetaValue(
                      rawMetaValue,
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
                    touchSelectedRecordId === record.fileId ? " is-touch-selected" : ""
                  }${
                    coverSource ? " has-cover" : ""
                  }`}
                  draggable={!pendingIds.has(record.fileId)}
                  onClick={(event) => handleCardTap(event, group.key, record)}
                  data-md-block-control="true"
                  onDragStart={(event) => {
                    startInternalDrag(event, {
                      channel: DRAG_CHANNELS.DATABASE_RECORD,
                      payload: record.fileId,
                      plainTextFallback: record.fileId,
                      effectAllowed: "move",
                    });
                  }}
                  onDragEnd={() => {
                    endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
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
                  <div className="database-kanban-card-order-actions">
                    <button
                      type="button"
                      className="database-block-toolbar-button"
                      onClick={() => onReorderRecordWithinGroup(group.key, record.fileId, "up")}
                      disabled={index === 0 || pendingIds.has(record.fileId)}
                      title="Nach oben"
                      data-md-block-control="true"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="database-block-toolbar-button"
                      onClick={() => onReorderRecordWithinGroup(group.key, record.fileId, "down")}
                      disabled={index >= group.records.length - 1 || pendingIds.has(record.fileId)}
                      title="Nach unten"
                      data-md-block-control="true"
                    >
                      ↓
                    </button>
                  </div>
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
