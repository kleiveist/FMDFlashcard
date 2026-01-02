import { useMemo, type CSSProperties } from "react";

type StatsPanelProps = {
  correctCount: number;
  correctPercent: number;
  incorrectCount: number;
  totalQuestions: number;
};

export const StatsPanel = ({
  correctCount,
  correctPercent,
  incorrectCount,
  totalQuestions,
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

  return (
    <section className="panel stats-panel">
      <div className="panel-header">
        <div>
          <h2>Statistics</h2>
        </div>
      </div>
      <div className="panel-body">
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
