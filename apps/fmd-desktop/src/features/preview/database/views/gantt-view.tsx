/**
 * @file apps/fmd-desktop/src/features/preview/database/views/gantt-view.tsx
 *
 * Timeline/gantt visualization for database records.
 */

import { useMemo } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseGanttZoom,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "../database-types";

type DatabaseGanttViewProps = {
  records: DatabaseRecord[];
  startAttribute: DatabaseAttributeMeta | null;
  endAttribute: DatabaseAttributeMeta | null;
  zoom: DatabaseGanttZoom;
  onOpenRecord?: (record: DatabaseRecord) => void;
};

type GanttEntry = {
  record: DatabaseRecord;
  title: string;
  startTs: number;
  endTs: number;
  isMilestone: boolean;
  tooltip: string;
};

const MAX_TICK_COUNT = 240;

const toLower = (value: string) => value.trim().toLowerCase();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getRecordValueByField = (record: DatabaseRecord, field: string): DatabaseNormalizedFieldValue => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = toLower(field);
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => toLower(key) === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

const toDateTimestamp = (value: DatabaseNormalizedFieldValue): number | null => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "raw" in value) {
    const parsed = Date.parse(String(value.raw ?? ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

const toStartOfZoom = (timestamp: number, zoom: DatabaseGanttZoom) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  if (zoom === "week") {
    const day = date.getDay();
    const distanceToMonday = (day + 6) % 7;
    date.setDate(date.getDate() - distanceToMonday);
    return date;
  }
  if (zoom === "month") {
    date.setDate(1);
    return date;
  }
  if (zoom === "quarter") {
    const month = date.getMonth();
    date.setMonth(month - (month % 3), 1);
    return date;
  }
  return date;
};

const addZoomStep = (date: Date, zoom: DatabaseGanttZoom, step = 1) => {
  const next = new Date(date.getTime());
  if (zoom === "day") {
    next.setDate(next.getDate() + step);
    return next;
  }
  if (zoom === "week") {
    next.setDate(next.getDate() + step * 7);
    return next;
  }
  if (zoom === "month") {
    next.setMonth(next.getMonth() + step, 1);
    return next;
  }
  next.setMonth(next.getMonth() + step * 3, 1);
  return next;
};

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

const getTickLabel = (timestamp: number, zoom: DatabaseGanttZoom) => {
  const date = new Date(timestamp);
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
    const end = addZoomStep(toStartOfZoom(timestamp, "week"), "week", 1);
    return `${formatDate(timestamp)} - ${formatDate(end.getTime() - 1)}`;
  }
  return formatDate(timestamp);
};

const getRowTitle = (record: DatabaseRecord) => {
  const fromSystem = record.systemFields.Dateiname;
  if (typeof fromSystem === "string" && fromSystem.trim().length > 0) {
    return fromSystem;
  }
  return record.relativePath;
};

const buildEntry = (
  record: DatabaseRecord,
  startKey: string,
  endKey: string | null,
): GanttEntry | null => {
  const startValue = getRecordValueByField(record, startKey);
  const endValue = endKey ? getRecordValueByField(record, endKey) : null;

  const startTs = toDateTimestamp(startValue);
  const endTs = toDateTimestamp(endValue);
  const title = getRowTitle(record);
  const status = toStatusLabel(record);

  if (startTs === null && endTs === null) {
    return null;
  }

  if (startTs !== null && endTs !== null) {
    const begin = Math.min(startTs, endTs);
    const finish = Math.max(startTs, endTs);
    const tooltip = [
      title,
      `${formatDate(begin)} - ${formatDate(finish)}`,
      status ? `Status: ${status}` : null,
      record.relativePath,
    ].filter(Boolean).join("\n");

    return {
      record,
      title,
      startTs: begin,
      endTs: finish,
      isMilestone: begin === finish,
      tooltip,
    };
  }

  const milestoneTs = startTs ?? endTs;
  if (milestoneTs === null) {
    return null;
  }

  const tooltip = [
    title,
    `Milestone: ${formatDate(milestoneTs)}`,
    status ? `Status: ${status}` : null,
    record.relativePath,
  ].filter(Boolean).join("\n");

  return {
    record,
    title,
    startTs: milestoneTs,
    endTs: milestoneTs,
    isMilestone: true,
    tooltip,
  };
};

export const DatabaseGanttView = ({
  records,
  startAttribute,
  endAttribute,
  zoom,
  onOpenRecord,
}: DatabaseGanttViewProps) => {
  const entries = useMemo(() => {
    if (!startAttribute) {
      return [];
    }
    return records
      .map((record) => buildEntry(record, startAttribute.key, endAttribute?.key ?? null))
      .filter((entry): entry is GanttEntry => Boolean(entry));
  }, [endAttribute?.key, records, startAttribute]);

  const timeline = useMemo(() => {
    if (entries.length === 0) {
      return null;
    }

    const minTs = Math.min(...entries.map((entry) => entry.startTs));
    const maxTs = Math.max(...entries.map((entry) => entry.endTs));

    const rangeStartDate = toStartOfZoom(minTs, zoom);
    let rangeEndDate = toStartOfZoom(maxTs, zoom);
    if (rangeEndDate.getTime() <= maxTs) {
      rangeEndDate = addZoomStep(rangeEndDate, zoom, 1);
    }
    if (rangeEndDate.getTime() <= rangeStartDate.getTime()) {
      rangeEndDate = addZoomStep(rangeStartDate, zoom, 1);
    }

    const boundaries = [rangeStartDate];
    let cursor = rangeStartDate;
    let safety = 0;
    while (cursor.getTime() < rangeEndDate.getTime() && safety < MAX_TICK_COUNT) {
      cursor = addZoomStep(cursor, zoom, 1);
      boundaries.push(cursor);
      safety += 1;
    }

    const rangeStart = rangeStartDate.getTime();
    const rangeEnd = boundaries[boundaries.length - 1]?.getTime() ?? rangeEndDate.getTime();
    const rangeSpan = Math.max(1, rangeEnd - rangeStart);

    const segments = boundaries.slice(0, -1)
      .map((startBoundary, index) => {
        const endBoundary = boundaries[index + 1];
        if (!endBoundary) {
          return null;
        }
        const startPercent = ((startBoundary.getTime() - rangeStart) / rangeSpan) * 100;
        const endPercent = ((endBoundary.getTime() - rangeStart) / rangeSpan) * 100;
        return {
          key: `${startBoundary.getTime()}-${endBoundary.getTime()}`,
          label: getTickLabel(startBoundary.getTime(), zoom),
          left: startPercent,
          width: Math.max(0.3, endPercent - startPercent),
        };
      })
      .filter((segment): segment is { key: string; label: string; left: number; width: number } => Boolean(segment));

    const positionedEntries = entries.map((entry) => {
      const startPosition = clamp(((entry.startTs - rangeStart) / rangeSpan) * 100, 0, 100);
      const endPosition = clamp(((entry.endTs - rangeStart) / rangeSpan) * 100, 0, 100);
      const width = Math.max(0.8, endPosition - startPosition);
      return {
        ...entry,
        startPosition,
        width,
      };
    });

    return {
      segments,
      entries: positionedEntries,
    };
  }, [entries, zoom]);

  if (!startAttribute || !startAttribute.viewCompatibility.supportsTimeline) {
    return (
      <div className="database-view-empty">
        Waehle ein Start-Datumsfeld fuer Timeline/Gantt.
      </div>
    );
  }

  if (endAttribute && !endAttribute.viewCompatibility.supportsTimeline) {
    return (
      <div className="database-view-empty">
        End-/Due-Feld muss ein Datumsfeld sein.
      </div>
    );
  }

  if (!timeline || timeline.entries.length === 0) {
    return (
      <div className="database-view-empty">
        Keine gueltigen Datumswerte gefunden. Pruefe Start-/Endfeld.
      </div>
    );
  }

  return (
    <div className="database-gantt-view">
      <div className="database-gantt-header" role="row">
        <div className="database-gantt-header-title">Datensatz</div>
        <div className="database-gantt-header-scale">
          {timeline.segments.map((segment) => (
            <span
              key={segment.key}
              className="database-gantt-header-tick"
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
              title={segment.label}
            >
              {segment.label}
            </span>
          ))}
        </div>
      </div>
      <div className="database-gantt-body">
        {timeline.entries.map((entry) => (
          <div key={entry.record.fileId} className="database-gantt-row" role="row">
            <button
              type="button"
              className="database-gantt-row-title"
              onClick={() => onOpenRecord?.(entry.record)}
              title={entry.record.relativePath}
              data-md-block-control="true"
            >
              {entry.title}
            </button>
            <div className="database-gantt-row-track" title={entry.tooltip}>
              {entry.isMilestone ? (
                <span
                  className="database-gantt-milestone"
                  style={{ left: `${entry.startPosition}%` }}
                />
              ) : (
                <span
                  className="database-gantt-bar"
                  style={{
                    left: `${entry.startPosition}%`,
                    width: `${entry.width}%`,
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
