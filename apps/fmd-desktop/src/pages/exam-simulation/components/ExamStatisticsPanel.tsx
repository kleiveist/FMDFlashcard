/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamStatisticsPanel.tsx
 *
 * Zweck:
 * - Rendert Statistikbereiche fuer Exam Runs.
 */

import { useMemo, useState, type CSSProperties } from "react";
import {
  filterExamRuns,
  formatExamDuration,
  formatExamGradeScale,
  formatExamTimestamp,
  getExamFileName,
  getExamRunUserKey,
  resolveExamStatusDescriptor,
  sortExamRunsByDateDesc,
  type ExamGradeScaleId,
  type ExamRun,
  type ExamRunStatusFilter,
} from "../../../lib/examRuns";

type ExamStatisticsPanelProps = {
  runs: ExamRun[];
  gradeScaleId: ExamGradeScaleId;
  onDeleteRun: (runId: string) => void;
  deleteError?: string;
  showTabs?: boolean;
  activeTab?: StatsTab;
  onActiveTabChange?: (tab: StatsTab) => void;
};

export type StatsTab = "last" | "history";

export const ExamStatisticsPanel = ({
  runs,
  gradeScaleId,
  onDeleteRun,
  deleteError,
  showTabs = true,
  activeTab,
  onActiveTabChange,
}: ExamStatisticsPanelProps) => {
  const [internalActiveTab, setInternalActiveTab] = useState<StatsTab>("last");
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ExamRunStatusFilter>("all");
  const [query, setQuery] = useState("");
  const resolvedTab = activeTab ?? internalActiveTab;

  const handleTabChange = (tab: StatsTab) => {
    if (activeTab === undefined) {
      setInternalActiveTab(tab);
    }
    onActiveTabChange?.(tab);
  };

  const sortedRuns = useMemo(() => sortExamRunsByDateDesc(runs), [runs]);
  const lastRun = sortedRuns[0] ?? null;
  const hasRuns = sortedRuns.length > 0;
  const gradeScaleLabel = formatExamGradeScale(gradeScaleId);

  const userOptions = useMemo(() => {
    const options = new Map<string, string>();
    sortedRuns.forEach((run) => {
      const key = getExamRunUserKey(run);
      if (!key) {
        return;
      }
      const label = run.userName || "Unknown";
      if (!options.has(key)) {
        options.set(key, label);
      }
    });
    return Array.from(options, ([id, label]) => ({ id, label }));
  }, [sortedRuns]);

  const filteredRuns = useMemo(
    () =>
      filterExamRuns(sortedRuns, {
        userId: userFilter === "all" ? "" : userFilter,
        status: statusFilter,
        query,
      }),
    [query, sortedRuns, statusFilter, userFilter],
  );

  const renderLastSession = () => {
    const hasLastRun = Boolean(lastRun);
    const scoreLabel = lastRun
      ? `${lastRun.achievedPoints} / ${lastRun.maxPoints}`
      : "—";
    const percentLabel = lastRun ? `${lastRun.percent}%` : "—";
    const statusDescriptor = lastRun ? resolveExamStatusDescriptor(lastRun.percent) : null;
    const statusLabel = statusDescriptor ? statusDescriptor.token : "—";
    const scoreFill =
      lastRun && lastRun.maxPoints > 0
        ? Math.min(1, Math.max(0, lastRun.achievedPoints / lastRun.maxPoints))
        : 0;
    const percentFill = lastRun
      ? Math.min(1, Math.max(0, lastRun.percent / 100))
      : 0;
    const scoreStyle = hasLastRun
      ? ({ "--stat-fill": `${scoreFill * 100}%` } as CSSProperties)
      : undefined;
    const percentStyle = hasLastRun
      ? ({ "--stat-fill": `${percentFill * 100}%` } as CSSProperties)
      : undefined;
    const statusToneClass = statusDescriptor ? ` status-${statusDescriptor.tone}` : "";
    const lastRunFileName = lastRun ? getExamFileName(lastRun.examFilePath) : "—";
    return (
      <div className="exam-last-session">
        <div className="exam-stats-grid">
          <div
            className={`exam-stats-card${hasLastRun ? " is-filled" : " is-empty"}${statusToneClass}`}
            style={scoreStyle}
          >
            <span className="exam-stats-label">Score</span>
            <span className="exam-stats-value">{scoreLabel}</span>
          </div>
          <div
            className={`exam-stats-card${hasLastRun ? " is-filled" : " is-empty"}${statusToneClass}`}
            style={percentStyle}
          >
            <span className="exam-stats-label">Percent</span>
            <span className="exam-stats-value">{percentLabel}</span>
          </div>
          <div className="exam-stats-card">
            <span className="exam-stats-label">Status</span>
            <span className="exam-stats-value">{statusLabel}</span>
          </div>
        </div>
        {hasLastRun ? (
          <div className="exam-stats-meta">
            <div className="exam-stats-meta-row">
              <span className="label">User</span>
              <span className="value">{lastRun?.userName || "Unknown"}</span>
            </div>
            <div className="exam-stats-meta-row">
              <span className="label">Exam file</span>
              <span
                className="value exam-file-value"
                title={hasLastRun ? lastRunFileName : undefined}
              >
                {lastRunFileName}
              </span>
            </div>
            <div className="exam-stats-meta-row">
              <span className="label">Started</span>
              <span className="value">
                {lastRun ? formatExamTimestamp(lastRun.startedAt) : "—"}
              </span>
            </div>
            <div className="exam-stats-meta-row">
              <span className="label">Ended</span>
              <span className="value">
                {lastRun ? formatExamTimestamp(lastRun.endedAt) : "—"}
              </span>
            </div>
            <div className="exam-stats-meta-row">
              <span className="label">Duration</span>
              <span className="value">
                {lastRun ? formatExamDuration(lastRun.durationMs) : "—"}
              </span>
            </div>
          </div>
        ) : (
          <div className="empty-state">Noch keine Bewertung vorhanden.</div>
        )}
        <span className="helper-text">Notenskala: {gradeScaleLabel}</span>
      </div>
    );
  };

  const renderHistory = () => {
    const emptyLabel = hasRuns
      ? "No exam runs match this filter."
      : "Noch keine Bewertung vorhanden.";
    return (
      <div className="exam-history">
        <div className="exam-history-filters">
          <label className="exam-history-filter">
            <span className="label">User</span>
            <select
              className="text-input"
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              aria-label="Filter by user"
            >
              <option value="all">All users</option>
              {userOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="exam-history-filter">
            <span className="label">Status</span>
            <select
              className="text-input"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ExamRunStatusFilter)
              }
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="passed">Passed only</option>
              <option value="failed">Not passed only</option>
            </select>
          </label>
          <label className="exam-history-filter">
            <span className="label">Exam file</span>
            <input
              type="text"
              className="text-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search file"
              aria-label="Search by exam file"
            />
          </label>
        </div>
        {filteredRuns.length === 0 ? (
          <div className="empty-state">{emptyLabel}</div>
        ) : (
          <div className="exam-history-table">
            <div className="exam-history-row header">
              <span className="exam-history-cell timestamp">Date</span>
              <span className="exam-history-cell user">User</span>
              <span className="exam-history-cell file">Exam file</span>
              <span className="exam-history-cell">Points</span>
              <span className="exam-history-cell">Percent</span>
              <span className="exam-history-cell">Status</span>
              <span className="exam-history-cell">Duration</span>
              <span className="exam-history-cell action" aria-hidden="true" />
            </div>
            {filteredRuns.map((run) => {
              const fileName = getExamFileName(run.examFilePath);
              return (
                <div key={run.id} className="exam-history-row">
                  <span className="exam-history-cell timestamp">
                    {formatExamTimestamp(run.endedAt)}
                  </span>
                  <span className="exam-history-cell user">
                    {run.userName || "Unknown"}
                  </span>
                  <span className="exam-history-cell file" title={fileName}>
                    <span className="exam-file-value">{fileName}</span>
                  </span>
                  <span className="exam-history-cell">
                    {run.achievedPoints} / {run.maxPoints}
                  </span>
                  <span className="exam-history-cell">{run.percent}%</span>
                  <span className="exam-history-cell">
                    {resolveExamStatusDescriptor(run.percent).token}
                  </span>
                  <span className="exam-history-cell">
                    {formatExamDuration(run.durationMs)}
                  </span>
                  <span className="exam-history-cell action">
                    <button
                      type="button"
                      className="ghost small danger exam-history-delete"
                      aria-label="Eintrag loeschen"
                      title="Loeschen"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteRun(run.id);
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {deleteError ? (
          <span className="helper-text exam-history-error" role="status">
            {deleteError}
          </span>
        ) : null}
        <span className="helper-text">Notenskala: {gradeScaleLabel}</span>
      </div>
    );
  };

  return (
    <div className="exam-stats">
      {showTabs ? (
        <div
          className="pill-grid exam-stats-tabs"
          role="tablist"
          aria-label="Statistics tabs"
        >
          <button
            type="button"
            className={`pill pill-button ${resolvedTab === "last" ? "active" : ""}`}
            onClick={() => handleTabChange("last")}
            role="tab"
            aria-selected={resolvedTab === "last"}
          >
            Last Session
          </button>
          <button
            type="button"
            className={`pill pill-button ${resolvedTab === "history" ? "active" : ""}`}
            onClick={() => handleTabChange("history")}
            role="tab"
            aria-selected={resolvedTab === "history"}
          >
            History
          </button>
        </div>
      ) : null}
      {resolvedTab === "last" ? renderLastSession() : renderHistory()}
    </div>
  );
};
