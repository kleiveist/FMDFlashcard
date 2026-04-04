/**
 * @file apps/fmd-desktop/src/features/preview/database/views/gantt-view.tsx
 *
 * Editable timeline/gantt visualization for database records.
 */

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addTimelineZoomStep,
  getTimelineDefaultDurationMs,
  parseTimelineTimestamp,
  toStartOfTimelineZoom,
} from "../database-time";
import {
  type DatabaseAttributeMeta,
  type DatabaseGanttZoom,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
  type DatabaseTimelineMode,
} from "../database-types";

type DatabaseGanttViewProps = {
  records: DatabaseRecord[];
  startAttribute: DatabaseAttributeMeta | null;
  endAttribute: DatabaseAttributeMeta | null;
  mode: DatabaseTimelineMode;
  baseDate: string | null;
  zoom: DatabaseGanttZoom;
  visibleProperties: DatabaseAttributeMeta[];
  editable?: boolean;
  pendingRecordIds?: string[];
  onOpenRecord?: (record: DatabaseRecord) => void;
  onCommitRange?: (params: {
    record: DatabaseRecord;
    startTimestamp: number;
    endTimestamp: number;
  }) => void;
};

type GanttEntry = {
  record: DatabaseRecord;
  title: string;
  startTs: number;
  endTs: number;
  isMilestone: boolean;
  tooltip: string;
};

type InteractionState =
  | {
      kind: "move";
      recordId: string;
      originStartTs: number;
      originEndTs: number;
      pointerStartX: number;
    }
  | {
      kind: "resize-start";
      recordId: string;
      originStartTs: number;
      originEndTs: number;
      pointerStartX: number;
    }
  | {
      kind: "resize-end";
      recordId: string;
      originStartTs: number;
      originEndTs: number;
      pointerStartX: number;
    };

const MAX_TICK_COUNT = 640;
const SIDEBAR_WIDTH = 280;

const SEGMENT_WIDTH_BY_ZOOM: Record<DatabaseGanttZoom, number> = {
  minute: 64,
  hour: 80,
  day: 132,
  week: 156,
  month: 180,
  quarter: 206,
  year: 230,
};

const toLower = (value: string) => value.trim().toLowerCase();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const formatDateTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

const getTickLabel = (
  timestamp: number,
  zoom: DatabaseGanttZoom,
  mode: DatabaseTimelineMode,
) => {
  const date = new Date(timestamp);
  if (zoom === "year") {
    return String(date.getFullYear());
  }
  if (zoom === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `Q${quarter} ${date.getFullYear()}`;
  }
  if (zoom === "month") {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
    });
  }
  if (zoom === "week") {
    const end = addTimelineZoomStep(toStartOfTimelineZoom(timestamp, "week"), "week", 1);
    return `${formatDate(timestamp)} - ${formatDate(end.getTime() - 1)}`;
  }
  if (zoom === "day") {
    return mode === "time"
      ? date.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit" })
      : formatDate(timestamp);
  }
  if (zoom === "hour") {
    return `${pad2(date.getHours())}:00`;
  }
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const resolveModeAnchorTimestamp = (mode: DatabaseTimelineMode, baseDate: string | null) => {
  if (mode !== "time") {
    return Date.now();
  }
  const now = new Date();
  const currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return parseTimelineTimestamp({
    value: currentTime,
    fieldType: "time",
    mode: "time",
    baseDate,
  }) ?? Date.now();
};

const getRowTitle = (record: DatabaseRecord) => {
  const fromSystem = record.systemFields.Dateiname;
  if (typeof fromSystem === "string" && fromSystem.trim().length > 0) {
    return fromSystem;
  }
  return record.relativePath;
};

const getRecordValueByField = (record: DatabaseRecord, field: string): DatabaseNormalizedFieldValue => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = toLower(field);
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => toLower(key) === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

const toStatusLabel = (record: DatabaseRecord): string | null => {
  const statusValue = Object.entries(record.normalizedFields)
    .find(([key]) => toLower(key) === "status")?.[1];

  if (!statusValue) {
    return null;
  }
  if (typeof statusValue === "string") {
    return statusValue;
  }
  if (statusValue && typeof statusValue === "object" && "raw" in statusValue) {
    const raw = String(statusValue.raw ?? "").trim();
    return raw || null;
  }
  return String(statusValue);
};

const stringifyMetaValue = (
  value: DatabaseNormalizedFieldValue,
  type: DatabaseAttributeMeta["type"],
): string | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (value instanceof Date) {
    if (type === "time") {
      return value.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (type === "date") {
      return value.toLocaleDateString();
    }
    return value.toLocaleString();
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry) => String(entry).trim()).filter(Boolean);
    return entries.length > 0 ? entries.join(", ") : null;
  }
  if (typeof value === "object") {
    if ("raw" in value) {
      const raw = String(value.raw ?? "").trim();
      return raw || null;
    }
    if ("value" in value && typeof value.value === "number" && Number.isFinite(value.value)) {
      return String(value.value);
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

const buildEntry = ({
  record,
  startAttribute,
  endAttribute,
  mode,
  baseDate,
}: {
  record: DatabaseRecord;
  startAttribute: DatabaseAttributeMeta;
  endAttribute: DatabaseAttributeMeta | null;
  mode: DatabaseTimelineMode;
  baseDate: string | null;
}): GanttEntry | null => {
  const startValue = getRecordValueByField(record, startAttribute.key);
  const endValue = endAttribute ? getRecordValueByField(record, endAttribute.key) : null;

  const startTs = parseTimelineTimestamp({
    value: startValue,
    fieldType: startAttribute.type,
    mode,
    baseDate,
  });
  const endTs = endAttribute
    ? parseTimelineTimestamp({
        value: endValue,
        fieldType: endAttribute.type,
        mode,
        baseDate,
      })
    : null;

  if (startTs === null && endTs === null) {
    return null;
  }

  const title = getRowTitle(record);
  const status = toStatusLabel(record);
  const start = startTs ?? endTs ?? 0;
  const end = endTs ?? startTs ?? 0;
  const begin = Math.min(start, end);
  const finish = Math.max(start, end);
  const isMilestone = begin === finish;

  const tooltipParts = [title];
  if (mode === "time") {
    tooltipParts.push(
      isMilestone
        ? `Zeitpunkt: ${formatTime(begin)}`
        : `${formatTime(begin)} - ${formatTime(finish)}`,
    );
  } else if (mode === "datetime") {
    tooltipParts.push(
      isMilestone
        ? `Zeitpunkt: ${formatDateTime(begin)}`
        : `${formatDateTime(begin)} - ${formatDateTime(finish)}`,
    );
  } else {
    tooltipParts.push(
      isMilestone
        ? `Zeitpunkt: ${formatDate(begin)}`
        : `${formatDate(begin)} - ${formatDate(finish)}`,
    );
  }
  if (status) {
    tooltipParts.push(`Status: ${status}`);
  }
  tooltipParts.push(record.relativePath);

  return {
    record,
    title,
    startTs: begin,
    endTs: finish,
    isMilestone,
    tooltip: tooltipParts.join("\n"),
  };
};

export const DatabaseGanttView = ({
  records,
  startAttribute,
  endAttribute,
  mode,
  baseDate,
  zoom,
  visibleProperties,
  editable = false,
  pendingRecordIds = [],
  onOpenRecord,
  onCommitRange,
}: DatabaseGanttViewProps) => {
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [draftByRecordId, setDraftByRecordId] = useState<Record<string, { startTs: number; endTs: number }>>({});
  const [isNarrowLayout, setIsNarrowLayout] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1200 : false,
  );
  const [isSidebarOverlayOpen, setIsSidebarOverlayOpen] = useState(false);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const hasInitialAnchorRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      const narrow = window.innerWidth < 1200;
      setIsNarrowLayout(narrow);
      if (!narrow) {
        setIsSidebarOverlayOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const entryByRecordId = useMemo(() => {
    const map = new Map<string, GanttEntry>();
    if (!startAttribute) {
      return map;
    }
    records.forEach((record) => {
      const entry = buildEntry({
        record,
        startAttribute,
        endAttribute,
        mode,
        baseDate,
      });
      if (entry) {
        map.set(record.fileId, entry);
      }
    });
    return map;
  }, [baseDate, endAttribute, mode, records, startAttribute]);

  const pendingIds = useMemo(() => new Set(pendingRecordIds), [pendingRecordIds]);
  const recordById = useMemo(() => new Map(records.map((record) => [record.fileId, record])), [records]);

  const timelineScale = useMemo(() => {
    const scheduled = Array.from(entryByRecordId.values());
    const now = resolveModeAnchorTimestamp(mode, baseDate);
    const defaultDuration = getTimelineDefaultDurationMs(mode);
    const minTs = scheduled.length > 0
      ? Math.min(...scheduled.map((entry) => entry.startTs), now)
      : now;
    const maxTs = scheduled.length > 0
      ? Math.max(...scheduled.map((entry) => entry.endTs), now + defaultDuration)
      : now + defaultDuration;

    const rangeStartDate = toStartOfTimelineZoom(minTs - defaultDuration, zoom);
    let rangeEndDate = toStartOfTimelineZoom(maxTs + defaultDuration, zoom);
    if (rangeEndDate.getTime() <= maxTs) {
      rangeEndDate = addTimelineZoomStep(rangeEndDate, zoom, 1);
    }
    if (rangeEndDate.getTime() <= rangeStartDate.getTime()) {
      rangeEndDate = addTimelineZoomStep(rangeStartDate, zoom, 1);
    }

    const boundaries: number[] = [rangeStartDate.getTime()];
    let cursor = rangeStartDate;
    let safety = 0;
    while (cursor.getTime() < rangeEndDate.getTime() && safety < MAX_TICK_COUNT) {
      cursor = addTimelineZoomStep(cursor, zoom, 1);
      boundaries.push(cursor.getTime());
      safety += 1;
    }

    const segmentWidth = SEGMENT_WIDTH_BY_ZOOM[zoom] ?? 140;
    const totalWidth = Math.max(segmentWidth, (boundaries.length - 1) * segmentWidth);

    const timestampToX = (timestamp: number) => {
      if (timestamp <= boundaries[0]!) {
        return 0;
      }
      const lastBoundary = boundaries[boundaries.length - 1]!;
      if (timestamp >= lastBoundary) {
        return totalWidth;
      }
      for (let index = 0; index < boundaries.length - 1; index += 1) {
        const left = boundaries[index]!;
        const right = boundaries[index + 1]!;
        if (timestamp >= left && timestamp <= right) {
          const span = Math.max(1, right - left);
          const ratio = (timestamp - left) / span;
          return (index * segmentWidth) + (ratio * segmentWidth);
        }
      }
      return totalWidth;
    };

    const xToTimestamp = (x: number) => {
      const boundedX = clamp(x, 0, totalWidth);
      const rawIndex = Math.floor(boundedX / segmentWidth);
      const index = clamp(rawIndex, 0, Math.max(0, boundaries.length - 2));
      const left = boundaries[index]!;
      const right = boundaries[index + 1]!;
      const ratio = (boundedX - (index * segmentWidth)) / segmentWidth;
      return left + ((right - left) * clamp(ratio, 0, 1));
    };

    const segments = boundaries.slice(0, -1).map((startBoundary, index) => ({
      key: `${startBoundary}-${boundaries[index + 1]}`,
      label: getTickLabel(startBoundary, zoom, mode),
      left: index * segmentWidth,
      width: segmentWidth,
    }));

    return {
      boundaries,
      segments,
      segmentWidth,
      totalWidth,
      timestampToX,
      xToTimestamp,
    };
  }, [baseDate, entryByRecordId, mode, zoom]);

  useEffect(() => {
    hasInitialAnchorRef.current = false;
  }, [mode, zoom, startAttribute?.key, endAttribute?.key, records.length, baseDate]);

  useEffect(() => {
    const node = gridScrollRef.current;
    if (!node || hasInitialAnchorRef.current) {
      return;
    }
    const modeAnchorTimestamp = resolveModeAnchorTimestamp(mode, baseDate);
    const anchorTimestamp = (() => {
      const entries = Array.from(entryByRecordId.values());
      if (entries.length > 0) {
        const nearest = entries.reduce((previous, current) => {
          const previousDistance = Math.abs(previous.startTs - modeAnchorTimestamp);
          const currentDistance = Math.abs(current.startTs - modeAnchorTimestamp);
          return currentDistance < previousDistance ? current : previous;
        });
        return nearest.startTs;
      }
      return modeAnchorTimestamp;
    })();
    const anchorX = timelineScale.timestampToX(anchorTimestamp);
    node.scrollLeft = Math.max(0, anchorX - (node.clientWidth * 0.35));
    hasInitialAnchorRef.current = true;
  }, [baseDate, entryByRecordId, mode, timelineScale]);

  useEffect(() => {
    if (!interaction) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - interaction.pointerStartX;
      const originStartX = timelineScale.timestampToX(interaction.originStartTs);
      const originEndX = timelineScale.timestampToX(interaction.originEndTs);
      const nextStartRaw = timelineScale.xToTimestamp(originStartX + deltaX);
      const nextEndRaw = timelineScale.xToTimestamp(originEndX + deltaX);
      const nextStart = Math.min(nextStartRaw, nextEndRaw);
      const nextEnd = Math.max(nextStartRaw, nextEndRaw);

      let draftStart = interaction.originStartTs;
      let draftEnd = interaction.originEndTs;
      if (interaction.kind === "move") {
        draftStart = nextStart;
        draftEnd = nextEnd;
      } else if (interaction.kind === "resize-start") {
        draftStart = Math.min(nextStartRaw, interaction.originEndTs);
      } else {
        draftEnd = Math.max(nextEndRaw, interaction.originStartTs);
      }

      setDraftByRecordId((current) => ({
        ...current,
        [interaction.recordId]: {
          startTs: Math.min(draftStart, draftEnd),
          endTs: Math.max(draftStart, draftEnd),
        },
      }));
    };

    const handlePointerUp = () => {
      const record = recordById.get(interaction.recordId);
      const draft = draftByRecordId[interaction.recordId];
      const nextRange = draft ?? {
        startTs: interaction.originStartTs,
        endTs: interaction.originEndTs,
      };
      setInteraction(null);
      setDraftByRecordId((current) => {
        const next = { ...current };
        delete next[interaction.recordId];
        return next;
      });
      if (!record || !onCommitRange) {
        return;
      }
      const changed = Math.round(nextRange.startTs) !== Math.round(interaction.originStartTs) ||
        Math.round(nextRange.endTs) !== Math.round(interaction.originEndTs);
      if (!changed) {
        return;
      }
      onCommitRange({
        record,
        startTimestamp: nextRange.startTs,
        endTimestamp: nextRange.endTs,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draftByRecordId, interaction, onCommitRange, recordById, timelineScale]);

  if (startAttribute && !startAttribute.viewCompatibility.supportsTimeline) {
    return (
      <div className="database-view-empty">
        Startfeld muss ein Zeit-/Datumsfeld sein.
      </div>
    );
  }

  if (endAttribute && !endAttribute.viewCompatibility.supportsTimeline) {
    return (
      <div className="database-view-empty">
        Endfeld muss ein Zeit-/Datumsfeld sein.
      </div>
    );
  }

  const sidebarWidth = isNarrowLayout ? 0 : SIDEBAR_WIDTH;

  return (
    <div className={`database-gantt-view${isNarrowLayout ? " is-narrow" : ""}`}>
      {!startAttribute ? (
        <p className="database-block-state">
          Noch kein Start-Zeitfeld konfiguriert. Zieh einen Eintrag in die Timeline, um `start`/`end` automatisch anzulegen.
        </p>
      ) : null}
      {isNarrowLayout ? (
        <div className="database-gantt-mobile-controls">
          <button
            type="button"
            className="database-block-toolbar-button"
            onClick={() => setIsSidebarOverlayOpen((current) => !current)}
            data-md-block-control="true"
          >
            {isSidebarOverlayOpen ? "Liste ausblenden" : "Liste anzeigen"}
          </button>
        </div>
      ) : null}

      <div className="database-gantt-grid-scroll" ref={gridScrollRef}>
        <div
          className="database-gantt-grid"
          style={{
            gridTemplateColumns: `${sidebarWidth}px ${timelineScale.totalWidth}px`,
          }}
        >
          {!isNarrowLayout ? (
            <div className="database-gantt-sidebar-header">Datensatz</div>
          ) : null}
          <div className="database-gantt-header-scale">
            {timelineScale.segments.map((segment) => (
              <span
                key={segment.key}
                className="database-gantt-header-tick"
                style={{ left: `${segment.left}px`, width: `${segment.width}px` }}
                title={segment.label}
              >
                {segment.label}
              </span>
            ))}
          </div>

          {records.map((record) => {
            const entry = entryByRecordId.get(record.fileId) ?? null;
            const draft = draftByRecordId[record.fileId];
            const displayStart = draft?.startTs ?? entry?.startTs ?? null;
            const displayEnd = draft?.endTs ?? entry?.endTs ?? null;
            const hasRange = displayStart !== null && displayEnd !== null;
            const startX = hasRange ? timelineScale.timestampToX(Math.min(displayStart, displayEnd)) : null;
            const endX = hasRange ? timelineScale.timestampToX(Math.max(displayStart, displayEnd)) : null;
            const width = startX !== null && endX !== null ? Math.max(8, endX - startX) : 0;
            const isMilestone = hasRange && Math.abs((displayEnd ?? 0) - (displayStart ?? 0)) < 1000;
            const rowTitle = getRowTitle(record);
            const isPending = pendingIds.has(record.fileId);
            const excludedPropertyKeys = new Set<string>([
              ...(startAttribute ? [startAttribute.key] : []),
              ...(endAttribute ? [endAttribute.key] : []),
            ].map((key) => toLower(key)));
            const propertyRows = visibleProperties
              .filter((attribute) => !excludedPropertyKeys.has(toLower(attribute.key)))
              .map((attribute) => {
                const value = stringifyMetaValue(
                  getRecordValueByField(record, attribute.key),
                  attribute.type,
                );
                if (!value) {
                  return null;
                }
                return {
                  key: attribute.key,
                  label: attribute.label || attribute.key,
                  value,
                };
              })
              .filter((entry): entry is { key: string; label: string; value: string } => Boolean(entry));
            const rowMetaLeft = hasRange && endX !== null
              ? clamp(endX + 10, 8, Math.max(8, timelineScale.totalWidth - 200))
              : 10;

            return (
              <Fragment key={record.fileId}>
                {!isNarrowLayout ? (
                  <div className={`database-gantt-sidebar-row${hasRange ? "" : " is-unscheduled"}`}>
                    <button
                      type="button"
                      className="database-gantt-sidebar-row-title"
                      onClick={() => onOpenRecord?.(record)}
                      title={record.relativePath}
                      draggable={editable}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", record.fileId);
                      }}
                      data-md-block-control="true"
                    >
                      {rowTitle}
                    </button>
                    <span className="database-gantt-sidebar-row-meta">
                      {hasRange ? "Geplant" : "Unzugeordnet"}
                    </span>
                  </div>
                ) : null}
                <div
                  className={`database-gantt-row-track${isPending ? " is-pending" : ""}`}
                  title={entry?.tooltip}
                  onDragOver={(event) => {
                    if (!editable) {
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    if (!editable || !onCommitRange) {
                      return;
                    }
                    const droppedRecordId = event.dataTransfer.getData("text/plain");
                    const droppedRecord = recordById.get(droppedRecordId);
                    if (!droppedRecord) {
                      return;
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    const xInViewport = event.clientX - rect.left;
                    const absoluteX = xInViewport + (gridScrollRef.current?.scrollLeft ?? 0) - sidebarWidth;
                    const startTimestamp = timelineScale.xToTimestamp(absoluteX);
                    const endTimestamp = startTimestamp + getTimelineDefaultDurationMs(mode);
                    onCommitRange({
                      record: droppedRecord,
                      startTimestamp,
                      endTimestamp: Math.max(startTimestamp, endTimestamp),
                    });
                  }}
                >
                  {hasRange ? (
                    isMilestone ? (
                      <span
                        className="database-gantt-milestone"
                        style={{ left: `${startX ?? 0}px` }}
                      />
                    ) : (
                      <span
                        className="database-gantt-bar"
                        style={{
                          left: `${startX ?? 0}px`,
                          width: `${width}px`,
                        }}
                        onPointerDown={(event) => {
                          if (!editable || isPending || !entry) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          setInteraction({
                            kind: "move",
                            recordId: record.fileId,
                            originStartTs: entry.startTs,
                            originEndTs: entry.endTs,
                            pointerStartX: event.clientX,
                          });
                        }}
                      >
                        <span
                          className="database-gantt-bar-handle is-start"
                          onPointerDown={(event) => {
                            if (!editable || isPending || !entry) {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            setInteraction({
                              kind: "resize-start",
                              recordId: record.fileId,
                              originStartTs: entry.startTs,
                              originEndTs: entry.endTs,
                              pointerStartX: event.clientX,
                            });
                          }}
                        />
                        <span
                          className="database-gantt-bar-handle is-end"
                          onPointerDown={(event) => {
                            if (!editable || isPending || !entry) {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            setInteraction({
                              kind: "resize-end",
                              recordId: record.fileId,
                              originStartTs: entry.startTs,
                              originEndTs: entry.endTs,
                              pointerStartX: event.clientX,
                            });
                          }}
                        />
                      </span>
                    )
                  ) : (
                    <span className="database-gantt-unscheduled-hint">
                      Kein Zeitbereich
                    </span>
                  )}
                  {propertyRows.length > 0 ? (
                    <div
                      className="database-gantt-row-meta"
                      style={{ left: `${rowMetaLeft}px` }}
                    >
                      {propertyRows.map((entry) => (
                        <p key={entry.key}>
                          <strong>{entry.label}:</strong> {entry.value}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {isNarrowLayout && isSidebarOverlayOpen ? (
        <aside className="database-gantt-sidebar-overlay" data-md-block-control="true">
          <header>
            <h6>Dateien</h6>
            <button
              type="button"
              className="database-block-panel-close"
              onClick={() => setIsSidebarOverlayOpen(false)}
              aria-label="Liste schliessen"
            >
              ×
            </button>
          </header>
          <div className="database-gantt-sidebar-overlay-list">
            {records.map((record) => {
              const hasRange = entryByRecordId.has(record.fileId);
              return (
                <button
                  key={record.fileId}
                  type="button"
                  className={`database-gantt-sidebar-overlay-row${hasRange ? "" : " is-unscheduled"}`}
                  title={record.relativePath}
                  draggable={editable}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", record.fileId);
                  }}
                  onClick={() => onOpenRecord?.(record)}
                >
                  <span>{getRowTitle(record)}</span>
                  <span>{hasRange ? "Geplant" : "Unzugeordnet"}</span>
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}
    </div>
  );
};
