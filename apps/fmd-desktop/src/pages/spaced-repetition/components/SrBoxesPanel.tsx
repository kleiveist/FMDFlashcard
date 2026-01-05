import type { CSSProperties } from "react";

type SrBoxesPanelProps = {
  spacedRepetitionBoxCounts: number[];
  maxBoxCount: number;
  activeBoxFilter: number | null;
  toggleBoxFilter: (boxNumber: number) => void;
};

export const SrBoxesPanel = ({
  spacedRepetitionBoxCounts,
  maxBoxCount,
  activeBoxFilter,
  toggleBoxFilter,
}: SrBoxesPanelProps) => (
  <div className="sr-box-chart">
    <div className="sr-box-chart-header">
      <span className="label">BOXES</span>
    </div>
    <div className="sr-box-chart-grid">
      {spacedRepetitionBoxCounts.map((count, index) => {
        const heightPercent =
          maxBoxCount > 0 ? Math.round((count / maxBoxCount) * 100) : 0;
        const barStyle = {
          "--bar-height": count > 0 ? `${Math.max(heightPercent, 6)}%` : "0%",
        } as CSSProperties;
        const boxNumber = index + 1;
        const isFilterActive = activeBoxFilter === boxNumber;

        return (
          <button
            key={`box-${boxNumber}`}
            type="button"
            className={`sr-box-column ${isFilterActive ? "active" : ""}`}
            aria-pressed={isFilterActive}
            onClick={() => toggleBoxFilter(boxNumber)}
          >
            <span className="sr-box-count">{count}</span>
            <div className="sr-box-bar" style={barStyle}>
              <div className="sr-box-bar-fill" />
            </div>
            <span className="sr-box-label">{boxNumber}</span>
          </button>
        );
      })}
    </div>
  </div>
);
