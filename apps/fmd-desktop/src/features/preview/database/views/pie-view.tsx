/**
 * @file apps/fmd-desktop/src/features/preview/database/views/pie-view.tsx
 *
 * Pie/donut visualization with type-aware aggregations.
 */

import { type CSSProperties, useMemo } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "../database-types";

type DatabasePieViewProps = {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
  aggregate: "count" | "sum" | "avg";
  aggregateAttribute: DatabaseAttributeMeta | null;
  visibleProperties: DatabaseAttributeMeta[];
};

type PieBucket = {
  label: string;
  value: number;
  sourceCount: number;
  records: DatabaseRecord[];
};

const PIE_MONO_TONE_STEPS = [88, 80, 72, 64, 56, 48, 40, 32, 24, 18];

const EMPTY_LABEL = "(leer)";

const toLower = (value: string) => value.trim().toLowerCase();
const isExamFieldKey = (key: string) => toLower(key) === "exam";

const getRecordValueByField = (record: DatabaseRecord, field: string): DatabaseNormalizedFieldValue => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = toLower(field);
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => toLower(key) === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

const toLabel = (value: DatabaseNormalizedFieldValue): string => {
  if (value === null || typeof value === "undefined") {
    return EMPTY_LABEL;
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => String(entry).trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized.join(", ") : EMPTY_LABEL;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && "raw" in value) {
    const raw = String(value.raw ?? "").trim();
    return raw || EMPTY_LABEL;
  }
  const text = String(value).trim();
  return text || EMPTY_LABEL;
};

const getGroupLabels = (
  groupType: DatabaseAttributeMeta["type"],
  value: DatabaseNormalizedFieldValue,
): string[] => {
  if (groupType === "tags" || groupType === "multiselect") {
    if (Array.isArray(value)) {
      const labels = value
        .map((entry) => String(entry).trim())
        .filter(Boolean);
      return labels.length > 0 ? labels : [EMPTY_LABEL];
    }
    if (typeof value === "string") {
      const labels = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      return labels.length > 0 ? labels : [EMPTY_LABEL];
    }
    return [EMPTY_LABEL];
  }
  return [toLabel(value)];
};

const toAggregatableNumber = (
  value: DatabaseNormalizedFieldValue,
  type: DatabaseAttributeMeta["type"],
): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (value && typeof value === "object") {
    if (type === "percent" && "value" in value) {
      const numeric = Number((value as { value?: unknown }).value ?? Number.NaN);
      return Number.isFinite(numeric) ? numeric : Number.NaN;
    }
    if (type === "score" && "ratio" in value) {
      const ratio = Number((value as { ratio?: unknown }).ratio ?? Number.NaN);
      return Number.isFinite(ratio) ? ratio * 100 : Number.NaN;
    }
    if ("value" in value) {
      const numeric = Number((value as { value?: unknown }).value ?? Number.NaN);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    if ("ratio" in value) {
      const ratio = Number((value as { ratio?: unknown }).ratio ?? Number.NaN);
      if (Number.isFinite(ratio)) {
        return ratio;
      }
    }
    if ("rank" in value) {
      const rank = Number((value as { rank?: unknown }).rank ?? Number.NaN);
      if (Number.isFinite(rank)) {
        return rank;
      }
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return Number.NaN;
    }
    const normalized = trimmed.endsWith("%") ? trimmed.slice(0, -1).trim() : trimmed;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
};

const stringifyDetailValue = (
  value: DatabaseNormalizedFieldValue,
  type: DatabaseAttributeMeta["type"],
): string | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (value instanceof Date) {
    if (type === "date") {
      return value.toLocaleDateString();
    }
    if (type === "time") {
      return value.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return value.toLocaleString();
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

const formatBucketValue = (value: number, aggregate: "count" | "sum" | "avg") => {
  if (aggregate === "count") {
    return String(Math.round(value));
  }
  const fractionDigits = Math.abs(value % 1) > 0 ? 2 : 0;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
};

const resolvePieAccentColor = (index: number) => {
  const stepIndex = index % PIE_MONO_TONE_STEPS.length;
  const cycle = Math.floor(index / PIE_MONO_TONE_STEPS.length);
  const accentToken = cycle % 2 === 0 ? "var(--accent-strong)" : "var(--accent)";
  const accentWeight = Math.max(18, PIE_MONO_TONE_STEPS[stepIndex]! - cycle * 6);
  return `color-mix(in srgb, ${accentToken} ${accentWeight}%, var(--db-surface-raised))`;
};

export const DatabasePieView = ({
  records,
  groupAttribute,
  aggregate,
  aggregateAttribute,
  visibleProperties,
}: DatabasePieViewProps) => {
  const validationError = useMemo(() => {
    if (!groupAttribute || !groupAttribute.viewCompatibility.supportsPieGrouping) {
      return "Waehle ein gruppierbares Feld fuer Pie/Donut.";
    }

    if (aggregate !== "count") {
      if (!aggregateAttribute) {
        return "Waehle ein numerisches Aggregatfeld fuer Summe/Durchschnitt.";
      }
      if (!aggregateAttribute.viewCompatibility.supportsAggregation) {
        return "Das gewaehlt Aggregatfeld ist nicht numerisch aggregierbar.";
      }
    }

    return null;
  }, [aggregate, aggregateAttribute, groupAttribute]);

  const buckets = useMemo(() => {
    if (!groupAttribute || validationError) {
      return [] as PieBucket[];
    }

    const aggregateMap = new Map<string, { sum: number; count: number }>();
    const recordsByBucket = new Map<string, DatabaseRecord[]>();

    records.forEach((record) => {
      const labels = getGroupLabels(
        groupAttribute.type,
        getRecordValueByField(record, groupAttribute.key),
      );

      if (aggregate === "count") {
        labels.forEach((label) => {
          const current = aggregateMap.get(label) ?? { sum: 0, count: 0 };
          aggregateMap.set(label, {
            sum: current.sum + 1,
            count: current.count + 1,
          });
          const bucketRecords = recordsByBucket.get(label) ?? [];
          recordsByBucket.set(label, [...bucketRecords, record]);
        });
        return;
      }

      if (!aggregateAttribute) {
        return;
      }

      const rawAggregateValue = getRecordValueByField(record, aggregateAttribute.key);
      const numeric = toAggregatableNumber(rawAggregateValue, aggregateAttribute.type);
      if (!Number.isFinite(numeric)) {
        return;
      }

      labels.forEach((label) => {
        const current = aggregateMap.get(label) ?? { sum: 0, count: 0 };
        aggregateMap.set(label, {
          sum: current.sum + numeric,
          count: current.count + 1,
        });
        const bucketRecords = recordsByBucket.get(label) ?? [];
        recordsByBucket.set(label, [...bucketRecords, record]);
      });
    });

    return Array.from(aggregateMap.entries())
      .map(([label, stats]) => {
        if (aggregate === "avg") {
          return {
            label,
            value: stats.count > 0 ? stats.sum / stats.count : 0,
            sourceCount: stats.count,
            records: recordsByBucket.get(label) ?? [],
          };
        }
        return {
          label,
          value: stats.sum,
          sourceCount: stats.count,
          records: recordsByBucket.get(label) ?? [],
        };
      })
      .filter((bucket) => Number.isFinite(bucket.value) && bucket.value >= 0);
  }, [aggregate, aggregateAttribute, groupAttribute, records, validationError]);

  const legendDetailsByLabel = useMemo(() => {
    if (!groupAttribute || visibleProperties.length === 0) {
      return new Map<string, Array<{ key: string; label: string; text: string }>>();
    }

    const excludedKeys = new Set<string>([
      groupAttribute.key,
      ...(aggregateAttribute ? [aggregateAttribute.key] : []),
      "Exam",
    ].map((key) => toLower(key)));

    const selectedProperties = visibleProperties
      .filter((property) =>
        !excludedKeys.has(toLower(property.key)) && !isExamFieldKey(property.key));

    const detailMap = new Map<string, Array<{ key: string; label: string; text: string }>>();
    buckets.forEach((bucket) => {
      const details = selectedProperties
        .map((property) => {
          const values: string[] = [];
          const seen = new Set<string>();
          bucket.records.forEach((record) => {
            const value = stringifyDetailValue(
              getRecordValueByField(record, property.key),
              property.type,
            );
            if (!value) {
              return;
            }
            const normalized = value.toLowerCase();
            if (seen.has(normalized)) {
              return;
            }
            seen.add(normalized);
            values.push(value);
          });
          if (values.length === 0) {
            return null;
          }
          const sample = values.slice(0, 3);
          const remaining = values.length - sample.length;
          return {
            key: property.key,
            label: property.label || property.key,
            text: remaining > 0
              ? `${sample.join(", ")} (+${remaining} weitere)`
              : sample.join(", "),
          };
        })
        .filter((entry): entry is { key: string; label: string; text: string } => Boolean(entry));
      detailMap.set(bucket.label, details);
    });

    return detailMap;
  }, [aggregateAttribute, buckets, groupAttribute, visibleProperties]);

  const total = useMemo(
    () => buckets.reduce((sum, bucket) => sum + bucket.value, 0),
    [buckets],
  );

  if (validationError) {
    return <div className="database-view-empty">{validationError}</div>;
  }

  if (buckets.length === 0 || total <= 0) {
    return (
      <div className="database-view-empty">
        Keine Daten fuer die aktuelle Pie-Konfiguration verfuegbar.
      </div>
    );
  }

  const size = 200;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="database-pie-view">
      <div className="database-pie-chart-wrap">
        <svg
          className="database-pie-chart"
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Pie chart grouped by ${groupAttribute?.label ?? groupAttribute?.key ?? "field"}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="color-mix(in srgb, var(--db-border) 75%, transparent)"
            strokeWidth={strokeWidth}
          />
          {buckets.map((bucket, index) => {
            const ratio = bucket.value / total;
            const dash = ratio * circumference;
            const dashArray = `${dash} ${Math.max(0, circumference - dash)}`;
            const dashOffset = -offset;
            const bucketColor = resolvePieAccentColor(index);
            offset += dash;

            return (
              <circle
                key={bucket.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={bucketColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${bucket.label}: ${formatBucketValue(bucket.value, aggregate)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="database-pie-center">
          <strong>{formatBucketValue(total, aggregate)}</strong>
          <span>{aggregate}</span>
        </div>
      </div>

      <ul className="database-pie-legend">
        {buckets.map((bucket, index) => {
          const percent = total > 0 ? (bucket.value / total) * 100 : 0;
          const bucketColor = resolvePieAccentColor(index);
          const details = legendDetailsByLabel.get(bucket.label) ?? [];
          return (
            <li key={bucket.label}>
              <span
                className="database-pie-legend-dot"
                style={{ "--db-pie-dot-color": bucketColor } as CSSProperties}
                aria-hidden="true"
              />
              <span className="database-pie-legend-label">{bucket.label}</span>
              <span className="database-pie-legend-value">
                {formatBucketValue(bucket.value, aggregate)}
              </span>
              <span className="database-pie-legend-percent">
                {percent.toFixed(1)}%
              </span>
              {details.length > 0 ? (
                <div className="database-pie-legend-details">
                  {details.map((detail) => (
                    <p key={detail.key}>
                      <strong>{detail.label}:</strong> {detail.text}
                    </p>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
