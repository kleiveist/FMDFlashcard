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
 * - ExamSettingsPanel: React-Komponente.
 * - ExamTogglesPanel: React-Komponente.
 * - AutoCardsSettingsPanel: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useMemo } from "react";
import {
  EXAM_TASK_TYPE_LEGACY_PRESET_POINTS,
  EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS,
  type ExamAiEvaluation,
} from "../../features/settings/useAppSettings";
import type { AutoCardType, AutoCardTypeMap } from "../../lib/exam/autoCards";

type ExamSettingsPanelProps = {
  maxTotalPoints: number;
  taskCount: number;
  taskPoints: number[];
  durationMinutes: number;
  resetStatisticsPending?: boolean;
  setMaxTotalPoints: (value: number) => void;
  setTaskCount: (value: number) => void;
  setTaskPoints: (value: number[]) => void;
  onDurationChange: (value: string) => void;
  onResetStatistics: () => void;
};

type ExamTogglesPanelProps = {
  resetStatisticsPending?: boolean;
  onResetStatistics?: () => void;
  timeLimitEnabled: boolean;
  showTimeline: boolean;
  helpEnabled: boolean;
  showTaskSources: boolean;
  aiEvaluation: ExamAiEvaluation;
  onTimeLimitToggle: (value: boolean) => void;
  setShowTimeline: (value: boolean) => void;
  setHelpEnabled: (value: boolean) => void;
  setShowTaskSources: (value: boolean) => void;
};

const clampInput = (value: string) => {
  if (value.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ExamSettingsPanel = ({
  maxTotalPoints,
  taskCount,
  taskPoints,
  durationMinutes,
  resetStatisticsPending,
  setMaxTotalPoints,
  setTaskCount,
  setTaskPoints,
  onDurationChange,
  onResetStatistics,
}: ExamSettingsPanelProps) => {
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
    <section className="panel exam-settings-panel" id="exam-settings-section">
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
              id="exam-max-total-points"
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
              id="exam-task-count"
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
                id="exam-duration"
                onChange={(event) => onDurationChange(event.target.value)}
              />
              <span className="muted">min</span>
            </div>
          </label>
        </div>

        <div className="exam-points-table" id="exam-task-points">
          {taskPoints.map((points, index) => (
            <div key={`exam-task-point-${index}`} className="exam-points-row">
              <span className="label">Task {index + 1}</span>
              <input
                type="number"
                min={0}
                className="text-input exam-compact-input"
                value={points}
                id={`exam-task-point-${index + 1}`}
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
  );
};

export const ExamTogglesPanel = ({
  resetStatisticsPending,
  onResetStatistics,
  timeLimitEnabled,
  showTimeline,
  helpEnabled,
  showTaskSources,
  aiEvaluation,
  onTimeLimitToggle,
  setShowTimeline,
  setHelpEnabled,
  setShowTaskSources,
}: ExamTogglesPanelProps) => (
  <section className="panel exam-settings-toggles-panel" id="exam-settings-section">
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
              onChange={(event) => onTimeLimitToggle(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">{timeLimitEnabled ? "Enabled" : "Disabled"}</span>
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
          <span className="muted">{showTimeline ? "Shown" : "Hidden"}</span>
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
          <span className="muted">{helpEnabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">TASK SOURCES</span>
        <div className="setting-inline">
          <label className="switch">
            <input
              type="checkbox"
              checked={showTaskSources}
              onChange={(event) => setShowTaskSources(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">{showTaskSources ? "Shown" : "Hidden"}</span>
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
      {onResetStatistics ? (
        <div className="setting-row">
          <span className="label">RUN HISTORY</span>
          <div className="setting-actions">
            <button
              type="button"
              className="ghost small"
              onClick={onResetStatistics}
              disabled={resetStatisticsPending}
            >
              Reset Statistics
            </button>
          </div>
        </div>
      ) : null}
    </div>
  </section>
);

type AutoCardsSettingsPanelProps = {
  enabledTypes: AutoCardTypeMap;
  onTypeToggle: (type: AutoCardType, value: boolean) => void;
  returnCardsEnabled: boolean;
  setReturnCardsEnabled: (value: boolean) => void;
};

type ExamTaskTypeDefaultsPanelProps = {
  pointsByType: Record<AutoCardType, number>;
  timeSecondsByType: Record<AutoCardType, number>;
  onPointChange: (type: AutoCardType, value: string) => void;
  onTimeSecondsChange: (type: AutoCardType, value: string) => void;
  onResetPreset: () => void;
};

const AUTO_CARD_TYPE_OPTIONS: Array<{
  type: AutoCardType;
  label: string;
  description: string;
}> = [
  {
    type: "qa",
    label: "Q&A (QA)",
    description: "Free-text answers with an official solution.",
  },
  {
    type: "tf",
    label: "True/False (TF)",
    description: "Statement-based true/false interactions.",
  },
  {
    type: "m1",
    label: "Multiple Choice (M1)",
    description: "Single-correct multiple choice.",
  },
  {
    type: "m2",
    label: "Multiple Choice (M2)",
    description: "Multiple-correct multiple choice.",
  },
  {
    type: "cl",
    label: "Cloze Typed (CL)",
    description: "Typed blanks only.",
  },
  {
    type: "cd",
    label: "Cloze Drag (CD)",
    description: "Drag-token blanks only.",
  },
  {
    type: "cld",
    label: "Cloze Mixed (CLD)",
    description: "Combination of typed blanks and drag tokens.",
  },
];

export const AutoCardsSettingsPanel = ({
  enabledTypes,
  onTypeToggle,
  returnCardsEnabled,
  setReturnCardsEnabled,
}: AutoCardsSettingsPanelProps) => {
  void enabledTypes;
  void onTypeToggle;
  void returnCardsEnabled;
  void setReturnCardsEnabled;

  return (
    <section className="panel exam-auto-cards-panel">
      <div className="panel-header">
        <div>
          <h2>Auto Cards</h2>
        </div>
      </div>
      <div className="panel-body">
        <div className="muted">
          Exam finish-time auto card conversion was removed.
        </div>
        <div className="muted">
          Use the task detail popup in Exam Results to wrap or unwrap a task with
          <code> #card ... #endcard </code>
          directly in the source file.
        </div>
      </div>
    </section>
  );
};

export const ExamTaskTypeDefaultsPanel = ({
  pointsByType,
  timeSecondsByType,
  onPointChange,
  onTimeSecondsChange,
  onResetPreset,
}: ExamTaskTypeDefaultsPanelProps) => (
  <section className="panel exam-task-type-defaults-panel" id="exam-settings-task-type-defaults">
    <div className="panel-header">
      <div>
        <h2>Task Type Points</h2>
        <p className="muted">
          Standardwerte fuer Exams ohne zugewiesenes Points-Profil.
        </p>
      </div>
      <button type="button" className="ghost small" onClick={onResetPreset}>
        Preset wiederherstellen
      </button>
    </div>
    <div className="panel-body">
      <div className="muted">
        Preset: QA {EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.qa}, TF{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.tf}, M1{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.m1}, M2{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.m2}, CL{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.cl}, CD{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.cd}, CLD{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.cld}
      </div>
      <div className="muted">
        Time preset (sec): QA {EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.qa}, TF{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.tf}, M1{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.m1}, M2{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.m2}, CL{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.cl}, CD{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.cd}, CLD{" "}
        {EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.cld}
      </div>
      {AUTO_CARD_TYPE_OPTIONS.map((option) => (
        <div key={option.type} className="setting-row">
          <span className="label">{option.label}</span>
          <div className="setting-inline">
            <input
              type="number"
              min={0}
              className="text-input exam-compact-input"
              value={pointsByType[option.type]}
              onChange={(event) => onPointChange(option.type, event.target.value)}
            />
            <span className="muted">points</span>
            <input
              type="number"
              min={0}
              className="text-input exam-compact-input"
              value={timeSecondsByType[option.type]}
              onChange={(event) => onTimeSecondsChange(option.type, event.target.value)}
            />
            <span className="muted">sec</span>
          </div>
        </div>
      ))}
    </div>
  </section>
);
