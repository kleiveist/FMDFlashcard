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
import type { ExamAiEvaluation } from "../../features/settings/useAppSettings";
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
  timeLimitEnabled: boolean;
  showTimeline: boolean;
  helpEnabled: boolean;
  aiEvaluation: ExamAiEvaluation;
  onTimeLimitToggle: (value: boolean) => void;
  setShowTimeline: (value: boolean) => void;
  setHelpEnabled: (value: boolean) => void;
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
  timeLimitEnabled,
  showTimeline,
  helpEnabled,
  aiEvaluation,
  onTimeLimitToggle,
  setShowTimeline,
  setHelpEnabled,
}: ExamTogglesPanelProps) => (
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
);

type AutoCardsSettingsPanelProps = {
  enabledTypes: AutoCardTypeMap;
  onTypeToggle: (type: AutoCardType, value: boolean) => void;
  returnCardsEnabled: boolean;
  setReturnCardsEnabled: (value: boolean) => void;
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
}: AutoCardsSettingsPanelProps) => (
  <section className="panel exam-auto-cards-panel">
    <div className="panel-header">
      <div>
        <h2>Auto Cards</h2>
        <p className="muted">
          Choose which interaction types are converted into auto cards after grading.
        </p>
      </div>
    </div>
    <div className="panel-body">
      <div className="settings-subsection">
        <h3>Auto-Card Sources</h3>
        <p className="muted">
          Combined tasks are included when at least one enabled type appears.
        </p>
      </div>
      {AUTO_CARD_TYPE_OPTIONS.map((option) => (
        <div key={option.type} className="setting-row">
          <span className="label">{option.label}</span>
          <div className="setting-inline">
            <label className="switch">
              <input
                type="checkbox"
                checked={enabledTypes[option.type]}
                onChange={(event) => onTypeToggle(option.type, event.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className="muted">
              {enabledTypes[option.type] ? "Enabled" : "Disabled"}
            </span>
          </div>
          <span className="helper-text">{option.description}</span>
        </div>
      ))}

      <div className="settings-subsection">
        <h3>Return Cards</h3>
        <p className="muted">
          When enabled, correctly answered auto cards are removed again.
        </p>
      </div>
      <div className="setting-row">
        <span className="label">RETURN CARDS</span>
        <div className="setting-inline">
          <label className="switch">
            <input
              type="checkbox"
              checked={returnCardsEnabled}
              onChange={(event) => setReturnCardsEnabled(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">{returnCardsEnabled ? "Enabled" : "Disabled"}</span>
        </div>
        <span className="helper-text">
          Remove auto cards again when they are answered correctly.
        </span>
      </div>
    </div>
  </section>
);
