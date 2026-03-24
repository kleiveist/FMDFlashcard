/**
 * @file apps/fmd-desktop/src/components/StatsPanel.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Stats Panel.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/FlashcardPage.tsx: Nutzt dieses Modul.
 * - react: React-API.
 *
 * Exportiert:
 * - StatsPanel: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { CollapsiblePanelHeader } from "./CollapsiblePanelHeader";

type StatsPanelProps = {
  correctCount: number;
  correctPercent: number;
  incorrectCount: number;
  totalQuestions: number;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
  headerActions?: ReactNode;
};

export const StatsPanel = ({
  correctCount,
  correctPercent,
  incorrectCount,
  totalQuestions,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
  headerActions,
}: StatsPanelProps) => {
  const statsTotal = correctCount + incorrectCount;
  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${correctPercent}%`,
      }) as CSSProperties,
    [correctPercent],
  );
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";

  const collapseEnabled = Boolean(isCollapsible && onToggleCollapse && controlsId);
  const isHidden = collapseEnabled && isCollapsed;

  return (
    <section className="panel stats-panel">
      {collapseEnabled ? (
        <CollapsiblePanelHeader
          title="Statistics"
          isCollapsed={isCollapsed}
          onToggle={onToggleCollapse ?? (() => {})}
          controlsId={controlsId ?? ""}
        />
      ) : (
        <div className="panel-header stats-panel-header">
          <div>
            <h2>Statistics</h2>
          </div>
          {headerActions ? (
            <div className="stats-panel-header-actions">{headerActions}</div>
          ) : null}
        </div>
      )}
      <div
        className="panel-body"
        id={controlsId}
        hidden={isHidden}
        aria-hidden={isHidden}
      >
        <div className="stats-summary">
          <div className="stats-counters">
            <div className="stats-counter">
              <span className="stats-label">Correct</span>
              <span className="stats-value">{correctCount}</span>
            </div>
            <div className="stats-counter">
              <span className="stats-label">Incorrect</span>
              <span className="stats-value">{incorrectCount}</span>
            </div>
            <div className="stats-counter">
              <span className="stats-label">Total</span>
              <span className="stats-value">{totalQuestions}</span>
            </div>
          </div>
          <div
            className={statsChartClass}
            style={statsChartStyle}
            role="img"
            aria-label={`Correct ${correctCount}, Incorrect ${incorrectCount}, Total ${totalQuestions}`}
          >
            <div className="stats-chart-label">
              <span className="stats-chart-total">{totalQuestions}</span>
              <span className="stats-chart-caption">Total</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
