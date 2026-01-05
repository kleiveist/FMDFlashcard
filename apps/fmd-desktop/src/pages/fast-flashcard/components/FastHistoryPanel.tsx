import type { FastFlashcardSessionSummary } from "../hooks/useFastSession";
import { formatSessionPace, formatSessionTimestamp } from "../hooks/useFastSession";

type FastHistoryPanelProps = {
  sessionHistory: FastFlashcardSessionSummary[];
  topSessions: FastFlashcardSessionSummary[];
  lastSessions: FastFlashcardSessionSummary[];
};

export const FastHistoryPanel = ({
  sessionHistory,
  topSessions,
  lastSessions,
}: FastHistoryPanelProps) => (
  <section className="panel fast-history-panel">
    <div className="panel-header">
      <div>
        <h2>Session History</h2>
        <p className="muted">Top scores and recent runs.</p>
      </div>
    </div>
    <div className="panel-body">
      {sessionHistory.length === 0 ? (
        <div className="empty-state">No sessions yet.</div>
      ) : (
        <div className="fast-history-sections">
          <div className="fast-session-section">
            <div>
              <h3 className="fast-section-title">Top 3 Sessions</h3>
              <p className="muted">Highest scores so far.</p>
            </div>
            <div className="fast-session-table">
              <div className="fast-session-row header">
                <span className="fast-session-cell timestamp">Date/Time</span>
                <span className="fast-session-cell">Score</span>
                <span className="fast-session-cell">Accuracy</span>
                <span className="fast-session-cell">Pace</span>
              </div>
              {topSessions.map((session) => (
                <div key={session.id} className="fast-session-row">
                  <span className="fast-session-cell timestamp">
                    {formatSessionTimestamp(session.endedAt)}
                  </span>
                  <span className="fast-session-cell">{session.score}</span>
                  <span className="fast-session-cell">{session.accuracy}%</span>
                  <span className="fast-session-cell">
                    {formatSessionPace(session.pace)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="fast-session-section">
            <div>
              <h3 className="fast-section-title">Last 10 Sessions</h3>
              <p className="muted">Most recent timer runs.</p>
            </div>
            <div className="fast-session-table">
              <div className="fast-session-row header">
                <span className="fast-session-cell timestamp">Date/Time</span>
                <span className="fast-session-cell">Score</span>
                <span className="fast-session-cell">Accuracy</span>
                <span className="fast-session-cell">Pace</span>
              </div>
              {lastSessions.map((session) => (
                <div key={session.id} className="fast-session-row">
                  <span className="fast-session-cell timestamp">
                    {formatSessionTimestamp(session.endedAt)}
                  </span>
                  <span className="fast-session-cell">{session.score}</span>
                  <span className="fast-session-cell">{session.accuracy}%</span>
                  <span className="fast-session-cell">
                    {formatSessionPace(session.pace)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </section>
);
