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

import { useMemo } from "react";
import type { ExamAiEvaluation } from "../../features/settings/useAppSettings";

type ExamSettingsSectionProps = {
  maxTotalPoints: number;
  taskCount: number;
  taskPoints: number[];
  aiEvaluation: ExamAiEvaluation;
  setMaxTotalPoints: (value: number) => void;
  setTaskCount: (value: number) => void;
  setTaskPoints: (value: number[]) => void;
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
  aiEvaluation,
  setMaxTotalPoints,
  setTaskCount,
  setTaskPoints,
}: ExamSettingsSectionProps) => {
  const sumAssigned = useMemo(
    () => taskPoints.reduce((sum, value) => sum + value, 0),
    [taskPoints],
  );
  const remaining = maxTotalPoints - sumAssigned;
  const isValid = sumAssigned === maxTotalPoints;

  const handleTaskPointChange = (index: number, value: string) => {
    const nextPoints = [...taskPoints];
    nextPoints[index] = clampInput(value);
    setTaskPoints(nextPoints);
  };

  return (
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

        <div className="setting-row">
          <span className="label">AI EVALUATION</span>
          <div className="setting-inline">
            <label className="switch">
              <input type="checkbox" checked={aiEvaluation.enabled} disabled />
              <span className="slider" />
            </label>
            <span className="muted">
              Coming soon{aiEvaluation.provider ? ` (provider: ${aiEvaluation.provider})` : ""}.
            </span>
          </div>
        </div>

        {!isValid ? (
          <div className="error">
            Assigned points must match the max total before starting an exam.
          </div>
        ) : null}
      </div>
    </section>
  );
};
