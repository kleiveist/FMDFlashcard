/**
 * @file frontend/src/features/preview/database/views/pie-view.tsx
 *
 * Pie/donut visualization with type-aware aggregations.
 */

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseNormalizedFieldValue,
  type DatabasePieColorSpectrum,
  type DatabaseRecord,
} from "../database-types";
import {
  getDatabasePieGroupLabels,
  normalizeDatabasePieExcludedValues,
} from "../pie-values";
import {
  formatMonitoringCompactText,
  renderMonitoringValue,
  type MonitoringRenderProfile,
} from "../../../monitoring/monitoring-render-rules";

type DatabasePieViewProps = {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
  aggregate: "count" | "sum" | "avg";
  aggregateAttribute: DatabaseAttributeMeta | null;
  excludedValues?: string[];
  colorSpectrum?: DatabasePieColorSpectrum;
  visibleProperties: DatabaseAttributeMeta[];
  monitoringProfiles?: MonitoringRenderProfile[];
};

type PieBucket = {
  label: string;
  value: number;
  sourceCount: number;
  records: DatabaseRecord[];
};

type DatabasePieLayoutProfile = {
  isStacked: boolean;
  chartSize: number;
  legendMinInlineSize: number;
};

type PieResizeDragState = {
  startX: number;
  startY: number;
  startScale: number;
};

const PIE_MONO_TONE_STEPS = [88, 80, 72, 64, 56, 48, 40, 32, 24, 18];
const PIE_DEFAULT_WIDTH = 720;
const PIE_STACK_BREAKPOINT = 760;
const PIE_CHART_MIN_SIZE = 160;
const PIE_CHART_MAX_SIZE = 320;
const PIE_LEGEND_MIN_INLINE_SIZE = 240;
const PIE_LEGEND_MAX_INLINE_SIZE = 460;
const PIE_VIEW_HORIZONTAL_PADDING = 24;
const PIE_VIEW_GAP = 12;
const PIE_INTERACTIVE_SCALE_MIN = 70;
const PIE_INTERACTIVE_SCALE_MAX = 140;
const PIE_INTERACTIVE_CHART_MIN_SIZE = 112;
const PIE_INTERACTIVE_LEGEND_MIN_INLINE_SIZE = 160;
const PIE_RESIZE_DRAG_SENSITIVITY = 0.35;
const PIE_COLOR_SPECTRUMS: Record<Exclude<DatabasePieColorSpectrum, "standard">, string[]> = {
  ocean: ["#006994", "#0A9396", "#2A9D8F", "#4DCCBD", "#76D7EA", "#BDEBFF"],
  sunset: ["#7C2D12", "#B45309", "#DC2626", "#EA580C", "#F59E0B", "#FECACA"],
  forest: ["#14532D", "#166534", "#15803D", "#16A34A", "#4ADE80", "#BBF7D0"],
  pastel: ["#9D4EDD", "#60A5FA", "#34D399", "#F9A8D4", "#FDE68A", "#FDBA74"],
};

const toLower = (value: string) => value.trim().toLowerCase();
const isExamFieldKey = (key: string) => toLower(key) === "exam";

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const normalizeDatabasePieColorSpectrum = (
  value: DatabasePieColorSpectrum | null | undefined,
): DatabasePieColorSpectrum => {
  switch (value) {
    case "ocean":
    case "sunset":
    case "forest":
    case "pastel":
    case "standard":
      return value;
    default:
      return "standard";
  }
};

export const resolveDatabasePieLayoutProfile = (containerWidth: number): DatabasePieLayoutProfile => {
  const safeWidth = containerWidth > 0 ? containerWidth : PIE_DEFAULT_WIDTH;
  const innerWidth = Math.max(140, safeWidth - PIE_VIEW_HORIZONTAL_PADDING);
  const isStacked = innerWidth < PIE_STACK_BREAKPOINT;

  const chartTarget = isStacked
    ? innerWidth * 0.72
    : innerWidth - PIE_LEGEND_MIN_INLINE_SIZE - PIE_VIEW_GAP;

  const chartUpperBound = Math.min(PIE_CHART_MAX_SIZE, innerWidth);
  const chartLowerBound = Math.min(PIE_CHART_MIN_SIZE, chartUpperBound);
  const chartSize = Math.round(clampNumber(chartTarget, chartLowerBound, chartUpperBound));

  const legendTarget = isStacked
    ? innerWidth
    : innerWidth - chartSize - PIE_VIEW_GAP;
  const legendUpperBound = Math.min(PIE_LEGEND_MAX_INLINE_SIZE, innerWidth);
  const legendLowerBound = Math.min(PIE_LEGEND_MIN_INLINE_SIZE, legendUpperBound);
  const legendMinInlineSize = Math.round(
    clampNumber(legendTarget, legendLowerBound, legendUpperBound),
  );

  return {
    isStacked,
    chartSize,
    legendMinInlineSize,
  };
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
  attributeKey: string,
  value: DatabaseNormalizedFieldValue,
  type: DatabaseAttributeMeta["type"],
  monitoringProfiles: MonitoringRenderProfile[],
): string | null => {
  const monitoringText = formatMonitoringCompactText(
    renderMonitoringValue({
      attributeKey,
      value,
      profiles: monitoringProfiles,
    }),
    value,
  ).trim();
  if (monitoringText) {
    return monitoringText;
  }
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

const resolveStandardPieAccentColor = (index: number) => {
  const stepIndex = index % PIE_MONO_TONE_STEPS.length;
  const cycle = Math.floor(index / PIE_MONO_TONE_STEPS.length);
  const accentToken = cycle % 2 === 0 ? "var(--accent-strong)" : "var(--accent)";
  const accentWeight = Math.max(18, PIE_MONO_TONE_STEPS[stepIndex]! - cycle * 6);
  return `color-mix(in srgb, ${accentToken} ${accentWeight}%, var(--db-surface-raised))`;
};

const resolvePieAccentColor = (
  index: number,
  spectrum: DatabasePieColorSpectrum,
) => {
  if (spectrum === "standard") {
    return resolveStandardPieAccentColor(index);
  }
  const palette = PIE_COLOR_SPECTRUMS[spectrum];
  if (!palette || palette.length === 0) {
    return resolveStandardPieAccentColor(index);
  }
  return palette[index % palette.length] ?? resolveStandardPieAccentColor(index);
};

export const DatabasePieView = ({
  records,
  groupAttribute,
  aggregate,
  aggregateAttribute,
  excludedValues,
  colorSpectrum,
  visibleProperties,
  monitoringProfiles = [],
}: DatabasePieViewProps) => {
  const pieViewRef = useRef<HTMLDivElement | null>(null);
  const pieResizeDragRef = useRef<PieResizeDragState | null>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [pieScalePercent, setPieScalePercent] = useState(100);
  const [isPieResizeDragging, setIsPieResizeDragging] = useState(false);
  const normalizedColorSpectrum = useMemo(
    () => normalizeDatabasePieColorSpectrum(colorSpectrum),
    [colorSpectrum],
  );

  useEffect(() => {
    const node = pieViewRef.current;
    if (!node) {
      return;
    }

    const measure = (width: number) => {
      if (!Number.isFinite(width) || width <= 0) {
        return;
      }
      setViewWidth((previous) => Math.abs(previous - width) >= 1 ? width : previous);
    };

    const measureFromDom = () => {
      measure(node.getBoundingClientRect().width);
    };

    measureFromDom();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) {
        return;
      }
      measure(entry.contentRect.width);
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const layoutProfile = useMemo(
    () => resolveDatabasePieLayoutProfile(viewWidth),
    [viewWidth],
  );
  const scaledChartSize = useMemo(
    () =>
      Math.round(
        clampNumber(
          layoutProfile.chartSize * (pieScalePercent / 100),
          PIE_INTERACTIVE_CHART_MIN_SIZE,
          PIE_CHART_MAX_SIZE * (PIE_INTERACTIVE_SCALE_MAX / 100),
        ),
      ),
    [layoutProfile.chartSize, pieScalePercent],
  );
  const scaledLegendMinInlineSize = useMemo(() => {
    if (layoutProfile.isStacked) {
      return layoutProfile.legendMinInlineSize;
    }
    const safeWidth = viewWidth > 0 ? viewWidth : PIE_DEFAULT_WIDTH;
    const innerWidth = Math.max(140, safeWidth - PIE_VIEW_HORIZONTAL_PADDING);
    const availableWidth = innerWidth - scaledChartSize - PIE_VIEW_GAP;
    return Math.round(
      clampNumber(
        availableWidth,
        PIE_INTERACTIVE_LEGEND_MIN_INLINE_SIZE,
        PIE_LEGEND_MAX_INLINE_SIZE,
      ),
    );
  }, [layoutProfile.isStacked, layoutProfile.legendMinInlineSize, scaledChartSize, viewWidth]);

  useEffect(() => {
    if (!isPieResizeDragging) {
      return;
    }

    const endResizeDrag = () => {
      pieResizeDragRef.current = null;
      setIsPieResizeDragging(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = pieResizeDragRef.current;
      if (!dragState || (event.buttons & 1) !== 1) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - dragState.startX;
      const deltaY = dragState.startY - event.clientY;
      const nextScale = clampNumber(
        dragState.startScale + (deltaX + deltaY) * PIE_RESIZE_DRAG_SENSITIVITY,
        PIE_INTERACTIVE_SCALE_MIN,
        PIE_INTERACTIVE_SCALE_MAX,
      );
      setPieScalePercent(Math.round(nextScale));
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 0 && (event.buttons & 1) === 1) {
        return;
      }
      event.preventDefault();
      endResizeDrag();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", endResizeDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", endResizeDrag);
    };
  }, [isPieResizeDragging]);

  const handlePieResizeGripMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    pieResizeDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startScale: pieScalePercent,
    };
    setIsPieResizeDragging(true);
  };

  const normalizedExcludedValues = useMemo(
    () => normalizeDatabasePieExcludedValues(excludedValues),
    [excludedValues],
  );
  const excludedValueSet = useMemo(
    () => new Set(normalizedExcludedValues),
    [normalizedExcludedValues],
  );

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
      const labels = getDatabasePieGroupLabels(
        groupAttribute.key,
        groupAttribute.type,
        getRecordValueByField(record, groupAttribute.key),
        monitoringProfiles,
      ).filter((label) => !excludedValueSet.has(label));

      if (labels.length === 0) {
        return;
      }

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
  }, [
    aggregate,
    aggregateAttribute,
    excludedValueSet,
    groupAttribute,
    monitoringProfiles,
    records,
    validationError,
  ]);

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
              property.key,
              getRecordValueByField(record, property.key),
              property.type,
              monitoringProfiles,
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
  }, [aggregateAttribute, buckets, groupAttribute, monitoringProfiles, visibleProperties]);

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

  const size = 236;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div
      ref={pieViewRef}
      className={`database-pie-view${layoutProfile.isStacked ? " is-stacked" : ""}`}
      style={{
        "--db-pie-chart-size": `${scaledChartSize}px`,
        "--db-pie-legend-min-inline-size": `${scaledLegendMinInlineSize}px`,
      } as CSSProperties}
    >
      <div className={`database-pie-chart-wrap${isPieResizeDragging ? " is-resizing" : ""}`}>
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
            const bucketColor = resolvePieAccentColor(index, normalizedColorSpectrum);
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
        <button
          type="button"
          className={`database-pie-resize-grip${isPieResizeDragging ? " is-active" : ""}`}
          data-md-block-control="true"
          aria-label={`Pie-Kreis mit Linksklick ziehen (aktuell ${pieScalePercent} Prozent)`}
          onMouseDown={handlePieResizeGripMouseDown}
        />
      </div>

      <ul className="database-pie-legend">
        {buckets.map((bucket, index) => {
          const percent = total > 0 ? (bucket.value / total) * 100 : 0;
          const bucketColor = resolvePieAccentColor(index, normalizedColorSpectrum);
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
