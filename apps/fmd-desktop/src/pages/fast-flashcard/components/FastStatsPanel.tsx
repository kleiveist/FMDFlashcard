/**
 * @file apps/fmd-desktop/src/pages/fast-flashcard/components/FastStatsPanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Fast Stats Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts: Typen.
 * - apps/fmd-desktop/src/pages/fast-flashcard/FastFlashcardPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - FastStatsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import type { CSSProperties } from "react";
import { CollapsiblePanelHeader } from "../../../components/CollapsiblePanelHeader";
import type { FastFlashcardSessionStats } from "../hooks/useFastSession";

type FastStatsPanelProps = {
  isTimeModeEnabled: boolean;
  timeModeActive: boolean;
  timeStatusLabel: string;
  timeProgressStyle: CSSProperties;
  selectedDuration: number;
  statsChartClass: string;
  statsChartStyle: CSSProperties;
  statsCorrect: number;
  statsIncorrect: number;
  statsTotal: number;
  sessionStats: FastFlashcardSessionStats;
  sessionCompleted: number;
  sessionMissed: number;
  sessionAccuracy: number;
  sessionPace: string;
  sessionScore: number;
  sessionMultiplier: number;
  handleTimeToggle: () => void;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
};

export const FastStatsPanel = ({
  isTimeModeEnabled,
  timeModeActive,
  timeStatusLabel,
  timeProgressStyle,
  selectedDuration,
  statsChartClass,
  statsChartStyle,
  statsCorrect,
  statsIncorrect,
  statsTotal,
  sessionStats,
  sessionCompleted,
  sessionMissed,
  sessionAccuracy,
  sessionPace,
  sessionScore,
  sessionMultiplier,
  handleTimeToggle,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
}: FastStatsPanelProps) => (
  <section className="panel fast-stats-panel">
    {isCollapsible && onToggleCollapse && controlsId ? (
      <CollapsiblePanelHeader
        title="Statistics Diagram"
        description="Progress trends over time"
        isCollapsed={isCollapsed}
        onToggle={onToggleCollapse}
        controlsId={controlsId}
      />
    ) : (
      <div className="panel-header">
        <div>
          <h2>Statistics Diagram</h2>
          <p className="muted">Progress trends over time</p>
        </div>
      </div>
    )}
    <div
      className="panel-body"
      id={controlsId}
      hidden={Boolean(isCollapsible && isCollapsed)}
      aria-hidden={Boolean(isCollapsible && isCollapsed)}
    >
      {!isCollapsible ? (
        <div className="fast-stats-switch">
          <span className="label">View</span>
          <button
            type="button"
            className={`timer-start-button ${isTimeModeEnabled ? "active" : ""}`}
            onClick={handleTimeToggle}
            aria-pressed={isTimeModeEnabled}
          >
            <span className="timer-start-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="7.5" />
                <path d="M12 7.5v4.4l2.8 1.8" />
              </svg>
            </span>
            <span className="timer-start-text">
              <span className="timer-start-meta">Time</span>
              <span className="timer-start-action">
                {isTimeModeEnabled ? "Stop" : "Start"}
              </span>
            </span>
          </button>
        </div>
      ) : null}
      <div className="fast-stats-blocks">
        <div className={`fast-time-block ${isCollapsible ? "fast-time-block--hidden" : ""}`}>
          <div className="fast-block-header">
            <span className="label">Time</span>
            <span
              className={`fast-time-status ${
                timeModeActive ? "active" : "inactive"
              }`}
            >
              {timeStatusLabel}
            </span>
          </div>
          <div className="fast-time-meter" style={timeProgressStyle} aria-hidden="true" />
          <div className="fast-time-scale">
            <span>0s</span>
            <span>{selectedDuration}s</span>
          </div>
        </div>
        <div className="fast-stats-block">
          <div className="fast-stats-block-header">
            <span className="label">Statistics</span>
          </div>
          <div className="fast-stats-grid">
            <div className="fast-stats-labels">
              <span className="stats-label">Correct</span>
              <span className="stats-label">Incorrect</span>
              <span className="stats-label">Total</span>
            </div>
            <div
              className={statsChartClass}
              style={statsChartStyle}
              role="img"
              aria-label={`Total ${statsTotal}`}
            >
              <div className="stats-chart-label">
                <span className="stats-chart-total">{statsTotal}</span>
                <span className="stats-chart-caption">Total</span>
              </div>
            </div>
            <div className="fast-stats-values">
              <span className="stats-value">{statsCorrect}</span>
              <span className="stats-value">{statsIncorrect}</span>
              <span className="stats-value">{statsTotal}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="fast-session-section">
        <div className="fast-section-header">
          <div>
            <h3 className="fast-section-title">Session Momentum</h3>
            <p className="muted">Your progress for the current timer run.</p>
          </div>
        </div>
        <div className="fast-session-grid">
          <div className="fast-session-card">
            <span className="label">Cards</span>
            <span className="fast-session-value">{sessionCompleted}</span>
            <span className="fast-session-sub">Completed</span>
          </div>
          <div className="fast-session-card">
            <span className="label">Accuracy</span>
            <span className="fast-session-value">{sessionAccuracy}%</span>
            <span className="fast-session-sub">
              {sessionStats.correct} correct / {sessionMissed} missed
            </span>
          </div>
          <div className="fast-session-card">
            <span className="label">Pace</span>
            <span className="fast-session-value">{sessionPace}</span>
            <span className="fast-session-sub">cards / min</span>
          </div>
          <div className="fast-session-card">
            <span className="label">Score</span>
            <span className="fast-session-value">{sessionScore}</span>
            <span className="fast-session-sub">
              +10 / -5 • x{sessionMultiplier.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
);
