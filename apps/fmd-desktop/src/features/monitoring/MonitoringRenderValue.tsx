import { type MonitoringRenderResult } from "./monitoring-render-rules";

type MonitoringRenderValueProps = {
  result: MonitoringRenderResult | null;
  fallback?: string;
  compact?: boolean;
  showText?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return clamp(value, 0, 100);
};

const polarToCartesian = (cx: number, cy: number, radius: number, angleDegrees: number) => {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
};

const describePieSlicePath = (percent: number) => {
  if (percent <= 0 || percent >= 100) {
    return null;
  }
  const cx = 18;
  const cy = 18;
  const radius = 15;
  const startAngle = -90;
  const sweepAngle = (percent / 100) * 360;
  const endAngle = startAngle + sweepAngle;
  const startPoint = polarToCartesian(cx, cy, radius, startAngle);
  const endPoint = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = sweepAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${startPoint.x} ${startPoint.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`,
    "Z",
  ].join(" ");
};

export const MonitoringRenderValue = ({
  result,
  fallback = "",
  compact = false,
  showText = true,
}: MonitoringRenderValueProps) => {
  if (!result) {
    return <span>{fallback || "—"}</span>;
  }

  const percent = asPercent(result.progressVisual?.percent ?? result.percentValue);
  const text = result.displayText || fallback || result.rawText || "—";
  const shouldShowText = showText || (!result.progressVisual && !result.badge);
  const renderProgressVisual = () => {
    if (!result.progressVisual || percent === null) {
      return null;
    }
    if (result.progressVisual.style === "bar") {
      return (
        <span
          className={`monitoring-render-progress${compact ? " is-compact" : ""}`}
          aria-hidden="true"
        >
          <span className="monitoring-render-progress-fill" style={{ width: `${percent}%` }} />
        </span>
      );
    }
    if (result.progressVisual.style === "pie") {
      const piePath = describePieSlicePath(percent);
      return (
        <span className={`monitoring-render-pie${compact ? " is-compact" : ""}`} aria-hidden="true">
          <svg className="monitoring-render-pie-svg" viewBox="0 0 36 36" focusable="false">
            <circle cx="18" cy="18" r="15" className="monitoring-render-pie-track" />
            {percent >= 100 ? (
              <circle cx="18" cy="18" r="15" className="monitoring-render-pie-fill" />
            ) : piePath ? (
              <path d={piePath} className="monitoring-render-pie-fill" />
            ) : null}
          </svg>
        </span>
      );
    }
    const ringRadius = 15;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringStrokeLength = (percent / 100) * ringCircumference;
    return (
      <span className={`monitoring-render-ring${compact ? " is-compact" : ""}`} aria-hidden="true">
        <svg className="monitoring-render-ring-svg" viewBox="0 0 36 36" focusable="false">
          <circle cx="18" cy="18" r={ringRadius} className="monitoring-render-ring-track" />
          <circle
            cx="18"
            cy="18"
            r={ringRadius}
            className="monitoring-render-ring-fill"
            strokeDasharray={`${ringStrokeLength} ${ringCircumference}`}
            transform="rotate(-90 18 18)"
          />
          <circle cx="18" cy="18" r="11" className="monitoring-render-ring-inner" />
        </svg>
      </span>
    );
  };

  if (compact) {
    return (
      <span className="monitoring-render-compact">
        {shouldShowText ? <span className="monitoring-render-text">{text}</span> : null}
        {result.badge ? <span className="monitoring-render-badge">{result.badge}</span> : null}
        {renderProgressVisual()}
      </span>
    );
  }

  return (
    <div className="monitoring-render-value">
      {shouldShowText ? <span className="monitoring-render-text">{text}</span> : null}
      {result.badge ? <span className="monitoring-render-badge">{result.badge}</span> : null}
      {renderProgressVisual()}
    </div>
  );
};
