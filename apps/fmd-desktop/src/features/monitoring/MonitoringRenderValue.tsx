import { type CSSProperties } from "react";
import { type MonitoringRenderResult } from "./monitoring-render-rules";

type MonitoringRenderValueProps = {
  result: MonitoringRenderResult | null;
  fallback?: string;
  compact?: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const asPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return clamp(value, 0, 100);
};

export const MonitoringRenderValue = ({
  result,
  fallback = "",
  compact = false,
}: MonitoringRenderValueProps) => {
  if (!result) {
    return <span>{fallback || "—"}</span>;
  }

  const percent = asPercent(result.percentValue);
  const text = result.displayText || fallback || result.rawText || "—";

  if (compact) {
    return <span className="monitoring-render-compact">{text}</span>;
  }

  const ringStyle: CSSProperties | undefined =
    result.progressRing && percent !== null
      ? {
          background: `conic-gradient(var(--accent-strong) ${percent}%, color-mix(in srgb, var(--db-border) 70%, transparent) ${percent}% 100%)`,
        }
      : undefined;

  return (
    <div className="monitoring-render-value">
      <span className="monitoring-render-text">{text}</span>
      {result.badge ? <span className="monitoring-render-badge">{result.badge}</span> : null}
      {result.progressBar && percent !== null ? (
        <span className="monitoring-render-progress" aria-hidden="true">
          <span className="monitoring-render-progress-fill" style={{ width: `${percent}%` }} />
        </span>
      ) : null}
      {result.progressRing && percent !== null ? (
        <span className="monitoring-render-ring" aria-hidden="true" style={ringStyle}>
          <span className="monitoring-render-ring-core">{Math.round(percent)}%</span>
        </span>
      ) : null}
    </div>
  );
};
