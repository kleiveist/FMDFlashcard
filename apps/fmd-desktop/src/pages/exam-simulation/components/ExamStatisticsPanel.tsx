/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamStatisticsPanel.tsx
 *
 * Zweck:
 * - Rendert Statistikbereiche fuer Exam Runs.
 */

import { useMemo, useState } from "react";
import {
  filterExamRuns,
  formatExamDuration,
  formatExamGradeScale,
  formatExamTimestamp,
  getExamFileName,
  getExamRunUserKey,
  sortExamRunsByDateDesc,
  type ExamGradeScaleId,
  type ExamRun,
  type ExamRunStatusFilter,
} from "../../../lib/examRuns";

type ExamStatisticsPanelProps = {
  runs: ExamRun[];
  gradeScaleId: ExamGradeScaleId;
};

type StatsTab = "last" | "history";

const getStatusToken = (percent: number) => {
  if (percent === 100) {
    return "💎 1";
  }
  if (percent >= 91) {
    return "🔵 1";
  }
  if (percent >= 82) {
    return "🟢 2";
  }
  if (percent >= 76) {
    return "🟡 3";
  }
  if (percent >= 51) {
    return "🟠 4";
  }
  if (percent >= 1) {
    return "🔴 5";
  }
  return "⚪ 0";
};

export const ExamStatisticsPanel = ({
  runs,
  gradeScaleId,
}: ExamStatisticsPanelProps) => {
  const [activeTab, setActiveTab] = useState<StatsTab>("last");
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ExamRunStatusFilter>("all");
  const [query, setQuery] = useState("");

  const sortedRuns = useMemo(() => sortExamRunsByDateDesc(runs), [runs]);
  const lastRun = sortedRuns[0] ?? null;
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
    const statusLabel = lastRun ? getStatusToken(lastRun.percent) : "—";
    const gradeLabel = lastRun?.grade ?? "—";
    return (
      <div className="exam-last-session">
        <div className="exam-stats-grid">
          <div className={`exam-stats-card${hasLastRun ? "" : " is-empty"}`}>
            <span className="exam-stats-label">Score</span>
            <span className="exam-stats-value">{scoreLabel}</span>
          </div>
          <div className={`exam-stats-card${hasLastRun ? "" : " is-empty"}`}>
            <span className="exam-stats-label">Percent</span>
            <span className="exam-stats-value">{percentLabel}</span>
          </div>
          <div className="exam-stats-card">
            <span className="exam-stats-label">Status</span>
            <span className="exam-stats-value">{statusLabel}</span>
          </div>
          <div className="exam-stats-card">
            <span className="exam-stats-label">Grade</span>
            <span className="exam-stats-value">{gradeLabel}</span>
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
              <span className="value" title={lastRun?.examFilePath}>
                {lastRun ? getExamFileName(lastRun.examFilePath) : "—"}
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
          <div className="empty-state">No exam runs recorded yet.</div>
        )}
        <span className="helper-text">Notenskala: {gradeScaleLabel}</span>
      </div>
    );
  };

  const renderHistory = () => {
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
          <div className="empty-state">No exam runs match this filter.</div>
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
              <span className="exam-history-cell">Grade</span>
            </div>
            {filteredRuns.map((run) => (
              <div key={run.id} className="exam-history-row">
                <span className="exam-history-cell timestamp">
                  {formatExamTimestamp(run.endedAt)}
                </span>
                <span className="exam-history-cell user">
                  {run.userName || "Unknown"}
                </span>
                <span className="exam-history-cell file" title={run.examFilePath}>
                  {getExamFileName(run.examFilePath)}
                </span>
                <span className="exam-history-cell">
                  {run.achievedPoints} / {run.maxPoints}
                </span>
                <span className="exam-history-cell">{run.percent}%</span>
                <span className="exam-history-cell">
                  {getStatusToken(run.percent)}
                </span>
                <span className="exam-history-cell">
                  {formatExamDuration(run.durationMs)}
                </span>
                <span className="exam-history-cell">{run.grade ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
        <span className="helper-text">Notenskala: {gradeScaleLabel}</span>
      </div>
    );
  };

  return (
    <div className="exam-stats">
      <div className="pill-grid exam-stats-tabs" role="tablist" aria-label="Statistics tabs">
        <button
          type="button"
          className={`pill pill-button ${activeTab === "last" ? "active" : ""}`}
          onClick={() => setActiveTab("last")}
          role="tab"
          aria-selected={activeTab === "last"}
        >
          Last session
        </button>
        <button
          type="button"
          className={`pill pill-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
          role="tab"
          aria-selected={activeTab === "history"}
        >
          History
        </button>
      </div>
      {activeTab === "last" ? renderLastSession() : renderHistory()}
    </div>
  );
};
