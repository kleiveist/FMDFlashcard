/**
 * @file apps/fmd-desktop/src/components/settings/ExamSettingsSection.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Exam Settings Section.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/features/settings/useAppSettings.ts: Typen.
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - ExamSettingsSection: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useMemo, useRef } from "react";
import type { ExamAiEvaluation } from "../../features/settings/useAppSettings";

type ExamSettingsSectionProps = {
  maxTotalPoints: number;
  taskCount: number;
  taskPoints: number[];
  durationMinutes: number;
  timeLimitEnabled: boolean;
  showTimeline: boolean;
  helpEnabled: boolean;
  autoCardsEnabled: boolean;
  autoCardsReturnOnCorrect: boolean;
  aiEvaluation: ExamAiEvaluation;
  resetStatisticsPending?: boolean;
  setMaxTotalPoints: (value: number) => void;
  setTaskCount: (value: number) => void;
  setTaskPoints: (value: number[]) => void;
  setDurationMinutes: (value: number) => void;
  setTimeLimitEnabled: (value: boolean) => void;
  setShowTimeline: (value: boolean) => void;
  setHelpEnabled: (value: boolean) => void;
  setAutoCardsEnabled: (value: boolean) => void;
  setAutoCardsReturnOnCorrect: (value: boolean) => void;
  onResetStatistics: () => void;
};

const clampInput = (value: string) => {
  if (value.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ExamSettingsSection = ({
  maxTotalPoints,
  taskCount,
  taskPoints,
  durationMinutes,
  timeLimitEnabled,
  showTimeline,
  helpEnabled,
  autoCardsEnabled,
  autoCardsReturnOnCorrect,
  aiEvaluation,
  resetStatisticsPending,
  setMaxTotalPoints,
  setTaskCount,
  setTaskPoints,
  setDurationMinutes,
  setTimeLimitEnabled,
  setShowTimeline,
  setHelpEnabled,
  setAutoCardsEnabled,
  setAutoCardsReturnOnCorrect,
  onResetStatistics,
}: ExamSettingsSectionProps) => {
  const sumAssigned = useMemo(
    () => taskPoints.reduce((sum, value) => sum + value, 0),
    [taskPoints],
  );
  const remaining = maxTotalPoints - sumAssigned;
  const isValid = sumAssigned === maxTotalPoints;
  const lastDurationRef = useRef<number>(durationMinutes > 0 ? durationMinutes : 30);

  const handleTaskPointChange = (index: number, value: string) => {
    const nextPoints = [...taskPoints];
    nextPoints[index] = clampInput(value);
    setTaskPoints(nextPoints);
  };
  const handleDurationChange = (value: string) => {
    const parsed = clampInput(value);
    const clamped = Math.min(240, Math.max(0, parsed));
    if (clamped > 0) {
      lastDurationRef.current = clamped;
    }
    setDurationMinutes(clamped);
  };
  return (
    <div className="exam-settings-layout">
      <section className="panel exam-settings-panel">
        <div className="panel-header">
          <div>
            <h2>Exam Settings</h2>
            <p className="muted">Define the max score and task point allocation.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="exam-settings-grid">
            <label className="setting-inline">
              <span className="label">MAX TOTAL POINTS</span>
              <input
                type="number"
                min={0}
                className="text-input exam-compact-input"
                value={maxTotalPoints}
                onChange={(event) => setMaxTotalPoints(clampInput(event.target.value))}
              />
            </label>
            <label className="setting-inline">
              <span className="label">NUMBER OF TASKS</span>
              <input
                type="number"
                min={1}
                max={20}
                className="text-input exam-compact-input"
                value={taskCount}
                onChange={(event) => setTaskCount(clampInput(event.target.value))}
              />
            </label>
            <label className="setting-inline">
              <span className="label">DURATION</span>
              <div className="exam-time-input">
                <input
                  type="number"
                  min={0}
                  max={240}
                  className="text-input exam-compact-input"
                  value={durationMinutes}
                  onChange={(event) => handleDurationChange(event.target.value)}
                />
                <span className="muted">min</span>
              </div>
            </label>
          </div>

          <div className="exam-points-table">
            {taskPoints.map((points, index) => (
              <div key={`exam-task-point-${index}`} className="exam-points-row">
                <span className="label">Task {index + 1}</span>
                <input
                  type="number"
                  min={0}
                  className="text-input exam-compact-input"
                  value={points}
                  onChange={(event) => handleTaskPointChange(index, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="exam-settings-summary">
            <div className="muted">
              Sum assigned: {sumAssigned} / Max total: {maxTotalPoints}
            </div>
            <div className="muted">Remaining: {remaining}</div>
          </div>

          <div className="exam-settings-actions">
            <button
              type="button"
              className="ghost small"
              onClick={onResetStatistics}
              disabled={resetStatisticsPending}
            >
              Reset Statistics
            </button>
          </div>

          {!isValid ? (
            <div className="error">
              Assigned points must match the max total before starting an exam.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel exam-settings-toggles-panel">
        <div className="panel-header">
          <div>
            <h2>Exam Toggles</h2>
          </div>
        </div>
        <div className="panel-body">
          <div className="setting-row">
            <span className="label">TIME LIMIT</span>
            <div className="setting-inline">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={timeLimitEnabled}
                  onChange={(event) => {
                    const nextEnabled = event.target.checked;
                    setTimeLimitEnabled(nextEnabled);
                    if (nextEnabled && durationMinutes === 0) {
                      const nextDuration =
                        lastDurationRef.current > 0 ? lastDurationRef.current : 30;
                      setDurationMinutes(nextDuration);
                    }
                  }}
                />
                <span className="slider" />
              </label>
              <span className="muted">
                {timeLimitEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <div className="setting-row">
            <span className="label">TIMELINE</span>
            <div className="setting-inline">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showTimeline}
                  onChange={(event) => setShowTimeline(event.target.checked)}
                />
                <span className="slider" />
              </label>
              <span className="muted">
                {showTimeline ? "Shown" : "Hidden"}
              </span>
            </div>
          </div>
          <div className="setting-row">
            <span className="label">HELP / HINTS</span>
            <div className="setting-inline">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={helpEnabled}
                  onChange={(event) => setHelpEnabled(event.target.checked)}
                />
                <span className="slider" />
              </label>
              <span className="muted">
                {helpEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <div className="setting-row">
            <span className="label">AUTO CARDS</span>
            <div className="setting-inline">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoCardsEnabled}
                  onChange={(event) => setAutoCardsEnabled(event.target.checked)}
                />
                <span className="slider" />
              </label>
              <span className="muted">Auto add cards after grading.</span>
            </div>
          </div>
          <div className="setting-row">
            <span className="label">RETURN CARD</span>
            <div className="setting-inline">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoCardsReturnOnCorrect}
                  onChange={(event) =>
                    setAutoCardsReturnOnCorrect(event.target.checked)
                  }
                />
                <span className="slider" />
              </label>
              <span className="muted">Remove cards again when correct.</span>
            </div>
          </div>

          <div className="setting-row">
            <span className="label">AI EVALUATION</span>
            <div className="setting-inline">
              <label className="switch">
                <input type="checkbox" checked={aiEvaluation.enabled} disabled />
                <span className="slider" />
              </label>
              <span className="muted">Coming soon.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
