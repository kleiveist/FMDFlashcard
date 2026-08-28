/**
 * @file frontend/src/components/StudyTimeBar.tsx
 *
 * Zweck:
 * - Schlanker Progress-Bar fuer Study-View-Header.
 */

import { useMemo, type CSSProperties } from "react";

type StudyTimeBarProps = {
  elapsedMs: number;
  maxMs: number | null;
  isRunning: boolean;
};

export const StudyTimeBar = ({ elapsedMs, maxMs, isRunning }: StudyTimeBarProps) => {
  const progressStyle = useMemo(() => {
    if (!maxMs || maxMs <= 0) {
      return undefined;
    }
    const progress = Math.max(0, Math.min(1, elapsedMs / maxMs));
    return { "--study-time-progress": `${Math.round(progress * 100)}%` } as CSSProperties;
  }, [elapsedMs, maxMs]);

  const isIndeterminate = !maxMs || maxMs <= 0;
  const className = [
    "study-time-bar",
    isIndeterminate ? "is-indeterminate" : "",
    !isRunning ? "is-paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={className} style={progressStyle} aria-hidden="true" />;
};
