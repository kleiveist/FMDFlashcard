/**
 * @file apps/fmd-desktop/src/pages/fast-flashcard/components/FastHistoryPanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Fast History Panel.
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
 * - FastHistoryPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

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
              <h3 className="fast-section-title">Last 5 Sessions</h3>
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
