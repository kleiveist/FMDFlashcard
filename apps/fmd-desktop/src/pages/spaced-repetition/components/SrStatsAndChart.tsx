/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/components/SrStatsAndChart.tsx
 *
 * Zweck:
 * - Rendert die Seite Sr Stats And Chart.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/chart.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts: Typen.
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrBoxesPanel.tsx: UI-Komponente.
 *
 * Exportiert:
 * - SrStatsAndChart: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { type CSSProperties, type ReactNode, useState } from "react";
import { KpiGrid } from "../../../components/KpiGrid";
import { ChevronDownIcon } from "../../../components/icons";
import { buildLineChartPoints } from "../../../lib/chart";
import { type SpacedRepetitionStatsView } from "../../../features/spaced-repetition/useSpacedRepetition";
import { SrBoxesPanel } from "./SrBoxesPanel";

type SrStatsAndChartProps = {
  statsView: SpacedRepetitionStatsView;
  setSpacedRepetitionStatsView: (value: SpacedRepetitionStatsView) => void;
  spacedRepetitionBoxCounts: number[];
  maxBoxCount: number;
  activeBoxFilter: number | null;
  toggleBoxFilter: (boxNumber: number) => void;
  vaultName: string;
  vaultFilesCount: number;
  spacedRepetitionFlashcardsLength: number;
  spacedRepetitionCompletedChartData: number[];
  spacedRepetitionCompletedChartLabels: string[];
  statsChartClass: string;
  statsChartStyle: CSSProperties;
  spacedRepetitionCorrectCount: number;
  spacedRepetitionIncorrectCount: number;
  spacedRepetitionTotalQuestions: number;
  kpiItems: { label: string; value: number }[];
  headerActions?: ReactNode;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
};

export const SrStatsAndChart = ({
  statsView,
  setSpacedRepetitionStatsView,
  spacedRepetitionBoxCounts,
  maxBoxCount,
  activeBoxFilter,
  toggleBoxFilter,
  vaultName,
  vaultFilesCount,
  spacedRepetitionFlashcardsLength,
  spacedRepetitionCompletedChartData,
  spacedRepetitionCompletedChartLabels,
  statsChartClass,
  statsChartStyle,
  spacedRepetitionCorrectCount,
  spacedRepetitionIncorrectCount,
  spacedRepetitionTotalQuestions,
  kpiItems,
  headerActions,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
}: SrStatsAndChartProps) => {
  const [view, setView] = useState<"diagram" | "stats">("diagram");
  const activeTitle = view === "diagram" ? "Statistics Diagram" : "Statistics";
  const showCollapseToggle = Boolean(isCollapsible && onToggleCollapse && controlsId);

  return (
    <section className="panel sr-diagram-panel">
      <div className="panel-header sr-panel-header">
        <div className="sr-panel-header-main">
          <div className="sr-panel-header-content">
            <div className="sr-stats-toggle" role="group" aria-label="Statistics view">
              <button
                type="button"
                className={`pill pill-button ${view === "diagram" ? "active" : ""}`}
                aria-pressed={view === "diagram"}
                onClick={() => setView("diagram")}
              >
                Statistics Diagram
              </button>
              <button
                type="button"
                className={`pill pill-button ${view === "stats" ? "active" : ""}`}
                aria-pressed={view === "stats"}
                onClick={() => setView("stats")}
              >
                Statistics
              </button>
            </div>
            <h2 className="sr-panel-title">{activeTitle}</h2>
          </div>
          {headerActions ? (
            <div className="sr-panel-header-actions">{headerActions}</div>
          ) : null}
        </div>
        {showCollapseToggle ? (
          <button
            type="button"
            className="sr-panel-collapse"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand statistics panel" : "Collapse statistics panel"}
            aria-expanded={!isCollapsed}
            aria-controls={controlsId}
          >
            <span
              className={`panel-header-chevron ${isCollapsed ? "" : "is-open"}`}
              aria-hidden="true"
            >
              <ChevronDownIcon />
            </span>
          </button>
        ) : null}
      </div>
      <div
        className={`panel-body ${view === "stats" ? "sr-stats-body" : ""}`}
        id={controlsId}
        hidden={Boolean(isCollapsible && isCollapsed)}
        aria-hidden={Boolean(isCollapsible && isCollapsed)}
      >
        {view === "diagram" ? (
          <div className="sr-stats-top">
            <div className="sr-stats-left">
              <div className="sr-stats-switch">
                <span className="label">View</span>
                <div className="pill-grid">
                  <button
                    type="button"
                    className={`pill pill-button ${statsView === "boxes" ? "active" : ""}`}
                    aria-pressed={statsView === "boxes"}
                    onClick={() => setSpacedRepetitionStatsView("boxes")}
                  >
                    Boxes
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${statsView === "vault" ? "active" : ""}`}
                    aria-pressed={statsView === "vault"}
                    onClick={() => setSpacedRepetitionStatsView("vault")}
                  >
                    Active vault
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${
                      statsView === "completed" ? "active" : ""
                    }`}
                    aria-pressed={statsView === "completed"}
                    onClick={() => setSpacedRepetitionStatsView("completed")}
                  >
                    Completed per day
                  </button>
                </div>
              </div>
              {statsView === "boxes" ? (
                <SrBoxesPanel
                  spacedRepetitionBoxCounts={spacedRepetitionBoxCounts}
                  maxBoxCount={maxBoxCount}
                  activeBoxFilter={activeBoxFilter}
                  toggleBoxFilter={toggleBoxFilter}
                />
              ) : statsView === "vault" ? (
                <div className="sr-vault-card">
                  <div className="sr-vault-row">
                    <span className="label">Vault</span>
                    <span className="value">{vaultName}</span>
                  </div>
                  <div className="sr-vault-row">
                    <span className="label">Notes</span>
                    <span className="value">{vaultFilesCount}</span>
                  </div>
                  <div className="sr-vault-row">
                    <span className="label">Cards loaded</span>
                    <span className="value">{spacedRepetitionFlashcardsLength}</span>
                  </div>
                </div>
              ) : (
                <div className="chart-card">
                  <div className="chart-header">
                    <span className="label">Completed per day</span>
                    <span className="chart-meta">Last 7 days</span>
                  </div>
                  <div className="chart-canvas">
                    <svg
                      className="sr-chart"
                      viewBox="0 0 100 40"
                      role="img"
                      aria-label="Completed per day"
                    >
                      <line
                        x1="0"
                        y1="40"
                        x2="100"
                        y2="40"
                        className="sr-chart-axis"
                      />
                      <polyline
                        className="sr-chart-line"
                        points={buildLineChartPoints(
                          spacedRepetitionCompletedChartData
                        )}
                      />
                    </svg>
                  </div>
                  <div className="chart-axis">
                    {spacedRepetitionCompletedChartLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="sr-stats-right">
              <span className="label">Statistics</span>
              <div className="stats-summary">
                <div className="stats-counters">
                  <div className="stats-counter">
                    <span className="stats-label">Correct</span>
                    <span className="stats-value">
                      {spacedRepetitionCorrectCount}
                    </span>
                  </div>
                  <div className="stats-counter">
                    <span className="stats-label">Incorrect</span>
                    <span className="stats-value">
                      {spacedRepetitionIncorrectCount}
                    </span>
                  </div>
                  <div className="stats-counter">
                    <span className="stats-label">Total</span>
                    <span className="stats-value">
                      {spacedRepetitionTotalQuestions}
                    </span>
                  </div>
                </div>
                <div
                  className={statsChartClass}
                  style={statsChartStyle}
                  role="img"
                  aria-label={`Correct ${spacedRepetitionCorrectCount}, Incorrect ${spacedRepetitionIncorrectCount}, Total ${spacedRepetitionTotalQuestions}`}
                >
                  <div className="stats-chart-label">
                    <span className="stats-chart-total">
                      {spacedRepetitionTotalQuestions}
                    </span>
                    <span className="stats-chart-caption">Total</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <KpiGrid items={kpiItems} />
        )}
      </div>
    </section>
  );
};
