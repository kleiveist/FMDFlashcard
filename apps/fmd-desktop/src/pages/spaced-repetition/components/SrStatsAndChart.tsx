import type { CSSProperties } from "react";
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
}: SrStatsAndChartProps) => (
  <section className="panel sr-diagram-panel">
    <div className="panel-header">
      <div>
        <h2>Statistics Diagram</h2>
        <p className="muted">Progress trends over time.</p>
      </div>
    </div>
    <div className="panel-body">
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
                    points={buildLineChartPoints(spacedRepetitionCompletedChartData)}
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
                <span className="stats-value">{spacedRepetitionCorrectCount}</span>
              </div>
              <div className="stats-counter">
                <span className="stats-label">Incorrect</span>
                <span className="stats-value">{spacedRepetitionIncorrectCount}</span>
              </div>
              <div className="stats-counter">
                <span className="stats-label">Total</span>
                <span className="stats-value">{spacedRepetitionTotalQuestions}</span>
              </div>
            </div>
            <div
              className={statsChartClass}
              style={statsChartStyle}
              role="img"
              aria-label={`Correct ${spacedRepetitionCorrectCount}, Incorrect ${spacedRepetitionIncorrectCount}, Total ${spacedRepetitionTotalQuestions}`}
            >
              <div className="stats-chart-label">
                <span className="stats-chart-total">{spacedRepetitionTotalQuestions}</span>
                <span className="stats-chart-caption">Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
