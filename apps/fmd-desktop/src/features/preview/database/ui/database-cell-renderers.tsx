/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-cell-renderers.tsx
 *
 * Lightweight cell rendering primitives for database table view.
 */

import { type ReactNode } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseNormalizedFieldValue,
} from "../database-types";
import { type DatabaseFormulaGroupedCountEntry } from "../../formula/database-formula-types";
import {
  renderMonitoringValue,
  type MonitoringRenderProfile,
} from "../../../monitoring/monitoring-render-rules";
import { MonitoringRenderValue } from "../../../monitoring/MonitoringRenderValue";

type DatabaseCellRendererProps = {
  attribute: DatabaseAttributeMeta;
  value: DatabaseNormalizedFieldValue;
  monitoringProfiles?: MonitoringRenderProfile[];
  compact?: boolean;
};

const formatDateValue = (value: Date, type: DatabaseAttributeMeta["type"]) => {
  if (type === "time") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  }
  if (type === "datetime") {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
};

const renderArrayValue = (value: string[]) => {
  if (value.length === 0) {
    return <span className="database-cell-empty">—</span>;
  }
  return (
    <div className="database-cell-chip-list">
      {value.map((entry) => (
        <span key={entry} className="database-cell-chip">{entry}</span>
      ))}
    </div>
  );
};

const renderStatusValue = (value: Extract<DatabaseNormalizedFieldValue, { raw: string }>) => {
  const raw = String(value.raw ?? "").trim();
  if (!raw) {
    return <span className="database-cell-empty">—</span>;
  }
  return <span className="database-cell-status">{raw}</span>;
};

const isGroupedCountEntry = (value: unknown): value is DatabaseFormulaGroupedCountEntry =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as { value?: unknown }).value === "string" &&
  typeof (value as { count?: unknown }).count === "number";

const renderGroupedCountValue = (entries: DatabaseFormulaGroupedCountEntry[]) => {
  if (entries.length === 0) {
    return <span className="database-cell-empty">—</span>;
  }
  return (
    <div className="database-cell-chip-list">
      {entries.map((entry) => (
        <span key={`${entry.value}:${entry.count}`} className="database-cell-chip">
          {`${entry.count} × ${entry.value}`}
        </span>
      ))}
    </div>
  );
};

const renderPercentValue = (value: Extract<DatabaseNormalizedFieldValue, { value: number }>) => {
  const numeric = Number(value.value ?? Number.NaN);
  if (!Number.isFinite(numeric)) {
    return <span className="database-cell-empty">—</span>;
  }
  const clamped = Math.max(0, Math.min(100, numeric));
  return (
    <div className="database-cell-percent">
      <span className="database-cell-percent-label">{numeric.toFixed(1).replace(/\.0$/, "")}%</span>
      <span className="database-cell-progress-track" aria-hidden="true">
        <span className="database-cell-progress-fill" style={{ width: `${clamped}%` }} />
      </span>
    </div>
  );
};

const renderScoreValue = (value: Extract<DatabaseNormalizedFieldValue, { value: number; max: number; ratio: number }>) => {
  const numerator = Number(value.value ?? Number.NaN);
  const denominator = Number(value.max ?? Number.NaN);
  const ratio = Number(value.ratio ?? Number.NaN);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return <span className="database-cell-empty">—</span>;
  }
  const percentage = Number.isFinite(ratio) ? Math.round(ratio * 100) : null;
  return (
    <span className="database-cell-score">
      {`${numerator}/${denominator}`}
      {percentage !== null ? ` (${percentage}%)` : ""}
    </span>
  );
};

const renderFallback = (value: DatabaseNormalizedFieldValue): ReactNode => {
  if (value === null || typeof value === "undefined") {
    return <span className="database-cell-empty">—</span>;
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : <span className="database-cell-empty">—</span>;
  }
  if (value instanceof Date) {
    return formatDateValue(value, "date");
  }
  if (Array.isArray(value)) {
    return renderArrayValue(value.map((entry) => String(entry)));
  }
  if (typeof value === "object" && value !== null && "raw" in value) {
    const raw = String((value as { raw?: unknown }).raw ?? "");
    return raw || <span className="database-cell-empty">—</span>;
  }
  return String(value);
};

export const DatabaseCellRenderer = ({
  attribute,
  value,
  monitoringProfiles = [],
  compact = false,
}: DatabaseCellRendererProps) => {
  if (value === null || typeof value === "undefined") {
    return <span className="database-cell-empty">—</span>;
  }

  const monitoringResult = renderMonitoringValue({
    attributeKey: attribute.key,
    value,
    profiles: monitoringProfiles,
  });
  if (monitoringResult) {
    const fallback =
      typeof value === "string" || typeof value === "number"
        ? String(value)
        : typeof value === "object" && value !== null && "raw" in value
          ? String((value as { raw?: unknown }).raw ?? "")
          : "";
    return (
      <MonitoringRenderValue
        result={monitoringResult}
        fallback={fallback}
        compact={compact}
      />
    );
  }

  if (attribute.type === "tags" || attribute.type === "multiselect") {
    const values = Array.isArray(value) ? value.map((entry) => String(entry)) : [];
    return renderArrayValue(values);
  }

  if (attribute.type === "status" && typeof value === "object" && value !== null && "raw" in value) {
    return renderStatusValue(value as Extract<DatabaseNormalizedFieldValue, { raw: string }>);
  }

  if (attribute.type === "percent" && typeof value === "object" && value !== null && "value" in value) {
    return renderPercentValue(value as Extract<DatabaseNormalizedFieldValue, { value: number }>);
  }

  if (attribute.type === "score" && typeof value === "object" && value !== null && "max" in value) {
    return renderScoreValue(value as Extract<DatabaseNormalizedFieldValue, { value: number; max: number; ratio: number }>);
  }

  if ((attribute.type === "date" || attribute.type === "time" || attribute.type === "datetime") && value instanceof Date) {
    return formatDateValue(value, attribute.type);
  }

  if (attribute.type === "time" && typeof value === "string") {
    return value;
  }

  if (attribute.type === "image" && typeof value === "string") {
    return <span className="database-cell-image-text">{value}</span>;
  }

  if (attribute.type === "formula" && Array.isArray(value)) {
    const groupedEntries = value.filter((entry) => isGroupedCountEntry(entry));
    if (groupedEntries.length === value.length) {
      return renderGroupedCountValue(groupedEntries);
    }
  }

  if (attribute.type === "link" && typeof value === "string") {
    return <span className="database-cell-link">{value}</span>;
  }

  return renderFallback(value);
};
