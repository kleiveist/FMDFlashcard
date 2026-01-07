type ExamTaskBreakdown = {
  index: number;
  awardedPoints: number;
  maxPoints: number;
  isCorrect: boolean | null;
};

type ExamResults = {
  breakdown: ExamTaskBreakdown[];
  totalAwarded: number;
  totalMax: number;
  percentage: number;
};

type ExamResultsPanelProps = {
  results: ExamResults;
};

export const ExamResultsPanel = ({ results }: ExamResultsPanelProps) => {
  return (
    <div className="exam-results">
      <header className="exam-task-header">
        <div>
          <p className="eyebrow">RESULTS</p>
          <h2>Exam results</h2>
          <p className="muted">Final score and per-task breakdown.</p>
        </div>
      </header>

      <div className="exam-results-summary">
        <div className="exam-results-score">
          <span className="value">{results.totalAwarded}</span>
          <span className="muted">/ {results.totalMax} points</span>
        </div>
        <div className="exam-results-percent">{results.percentage}%</div>
      </div>

      <div className="status-list">
        {results.breakdown.map((item) => {
          const showCorrectness = item.isCorrect !== null;
          return (
            <div key={`exam-result-${item.index}`} className="status-item">
              <div className="status-row">
                <span>Task {item.index}</span>
                <span>
                  {item.awardedPoints} / {item.maxPoints}
                </span>
              </div>
              {showCorrectness ? (
                <div className="muted">
                  {item.isCorrect ? "Correct" : "Incorrect"}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
