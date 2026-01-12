/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamTimeBar.tsx
 *
 * Zweck:
 * - Zeigt die Exam-Zeitleiste mit Restzeit.
 */

import { useMemo, type CSSProperties } from "react";

type ExamTimeBarProps = {
  timeLimitMs: number;
  timeRemainingMs: number | null;
  isRunning: boolean;
  isTimeUp: boolean;
  className?: string;
};

const formatTime = (valueMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const ExamTimeBar = ({
  timeLimitMs,
  timeRemainingMs,
  isRunning,
  isTimeUp,
  className,
}: ExamTimeBarProps) => {
  const limitMinutes = Math.max(1, Math.round(timeLimitMs / 60000));
  const remainingMs = timeRemainingMs ?? timeLimitMs;
  const progress = timeLimitMs > 0 ? remainingMs / timeLimitMs : 0;
  const isWarning = isRunning && !isTimeUp && progress <= 0.2;
  const barStyle = useMemo(
    () =>
      ({
        "--exam-time-progress": `${Math.max(0, Math.min(1, progress)) * 100}%`,
      }) as CSSProperties,
    [progress],
  );

  const label = isTimeUp
    ? "Time up"
    : isRunning
      ? `Remaining: ${formatTime(remainingMs)}`
      : `Time limit: ${limitMinutes} min`;
  const subLabel = isRunning ? `Total: ${limitMinutes} min` : null;

  return (
    <div
      className={[
        "exam-time-bar",
        isRunning ? "is-running" : "is-idle",
        isWarning ? "is-warning" : "",
        isTimeUp ? "is-time-up" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="exam-time-bar-header">
        <span className="label">{label}</span>
        {subLabel ? <span className="muted">{subLabel}</span> : null}
      </div>
      <div className="exam-time-bar-track" style={barStyle} aria-hidden="true" />
    </div>
  );
};
