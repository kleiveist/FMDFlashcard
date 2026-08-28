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
import {
  formatSettingsText,
  type SettingsLanguage,
  tSettings,
} from "../../features/settings/settingsI18n";

type ExamSettingsPanelProps = {
  language: SettingsLanguage;
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
  language: SettingsLanguage;
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
  language,
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
          <h2>{tSettings(language, "settings.examSettings.title")}</h2>
          <p className="muted">
            {tSettings(language, "settings.examSettings.description")}
          </p>
        </div>
      </div>
      <div className="panel-body">
        <div className="exam-settings-grid">
          <label className="setting-inline">
            <span className="label">
              {tSettings(language, "settings.examSettings.maxTotalPoints")}
            </span>
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
            <span className="label">
              {tSettings(language, "settings.examSettings.numberOfTasks")}
            </span>
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
            <span className="label">
              {tSettings(language, "settings.examSettings.duration")}
            </span>
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
              <span className="muted">
                {tSettings(language, "settings.examSettings.minutesShort")}
              </span>
            </div>
          </label>
        </div>

        <div className="exam-points-table" id="exam-task-points">
          {taskPoints.map((points, index) => (
            <div key={`exam-task-point-${index}`} className="exam-points-row">
              <span className="label">
                {formatSettingsText(language, "settings.examSettings.taskLabel", {
                  index: index + 1,
                })}
              </span>
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
            {formatSettingsText(language, "settings.examSettings.summaryAssigned", {
              assigned: sumAssigned,
              max: maxTotalPoints,
            })}
          </div>
          <div className="muted">
            {formatSettingsText(language, "settings.examSettings.summaryRemaining", {
              remaining,
            })}
          </div>
        </div>

        <div className="exam-settings-actions">
          <button
            type="button"
            className="ghost small"
            onClick={onResetStatistics}
            disabled={resetStatisticsPending}
          >
            {tSettings(language, "settings.examSettings.resetStatistics")}
          </button>
        </div>

        {!isValid ? (
          <div className="error">
            {tSettings(language, "settings.examSettings.invalid")}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export const ExamTogglesPanel = ({
  language,
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
        <h2>{tSettings(language, "settings.examToggles.title")}</h2>
      </div>
    </div>
    <div className="panel-body">
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.examToggles.timeLimit")}
        </span>
        <div className="setting-inline">
          <label className="switch">
            <input
              type="checkbox"
              checked={timeLimitEnabled}
              onChange={(event) => onTimeLimitToggle(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">
            {timeLimitEnabled
              ? tSettings(language, "settings.common.enabled")
              : tSettings(language, "settings.common.disabled")}
          </span>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.examToggles.timeline")}
        </span>
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
            {showTimeline
              ? tSettings(language, "settings.common.shown")
              : tSettings(language, "settings.common.hidden")}
          </span>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.examToggles.helpHints")}
        </span>
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
            {helpEnabled
              ? tSettings(language, "settings.common.enabled")
              : tSettings(language, "settings.common.disabled")}
          </span>
        </div>
      </div>
      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.examToggles.taskSources")}
        </span>
        <div className="setting-inline">
          <label className="switch">
            <input
              type="checkbox"
              checked={showTaskSources}
              onChange={(event) => setShowTaskSources(event.target.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">
            {showTaskSources
              ? tSettings(language, "settings.common.shown")
              : tSettings(language, "settings.common.hidden")}
          </span>
        </div>
      </div>

      <div className="setting-row">
        <span className="label">
          {tSettings(language, "settings.examToggles.aiEvaluation")}
        </span>
        <div className="setting-inline">
          <label className="switch">
            <input type="checkbox" checked={aiEvaluation.enabled} disabled />
            <span className="slider" />
          </label>
          <span className="muted">
            {tSettings(language, "settings.examToggles.comingSoon")}
          </span>
        </div>
      </div>
      {onResetStatistics ? (
        <div className="setting-row">
          <span className="label">
            {tSettings(language, "settings.examToggles.runHistory")}
          </span>
          <div className="setting-actions">
            <button
              type="button"
              className="ghost small"
              onClick={onResetStatistics}
              disabled={resetStatisticsPending}
            >
              {tSettings(language, "settings.examToggles.resetStatistics")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  </section>
);

type AutoCardsSettingsPanelProps = {
  language: SettingsLanguage;
  enabledTypes: AutoCardTypeMap;
  onTypeToggle: (type: AutoCardType, value: boolean) => void;
  returnCardsEnabled: boolean;
  setReturnCardsEnabled: (value: boolean) => void;
};

type ExamTaskTypeDefaultsPanelProps = {
  language: SettingsLanguage;
  pointsByType: Record<AutoCardType, number>;
  timeSecondsByType: Record<AutoCardType, number>;
  onPointChange: (type: AutoCardType, value: string) => void;
  onTimeSecondsChange: (type: AutoCardType, value: string) => void;
  onResetPreset: () => void;
};

const AUTO_CARD_TYPE_OPTIONS: Array<{
  type: AutoCardType;
}> = [
  {
    type: "qa",
  },
  {
    type: "tf",
  },
  {
    type: "m1",
  },
  {
    type: "m2",
  },
  {
    type: "cl",
  },
  {
    type: "cd",
  },
  {
    type: "cld",
  },
];

const AUTO_CARD_TYPE_LABEL_KEYS = {
  qa: "settings.autoCardType.qa",
  tf: "settings.autoCardType.tf",
  m1: "settings.autoCardType.m1",
  m2: "settings.autoCardType.m2",
  cl: "settings.autoCardType.cl",
  cd: "settings.autoCardType.cd",
  cld: "settings.autoCardType.cld",
} as const;

export const AutoCardsSettingsPanel = ({
  language,
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
          <h2>{tSettings(language, "settings.autoCards.title")}</h2>
        </div>
      </div>
      <div className="panel-body">
        <div className="muted">{tSettings(language, "settings.autoCards.removed")}</div>
        <div className="muted">{tSettings(language, "settings.autoCards.detail")}</div>
      </div>
    </section>
  );
};

export const ExamTaskTypeDefaultsPanel = ({
  language,
  pointsByType,
  timeSecondsByType,
  onPointChange,
  onTimeSecondsChange,
  onResetPreset,
}: ExamTaskTypeDefaultsPanelProps) => (
  <section className="panel exam-task-type-defaults-panel" id="exam-settings-task-type-defaults">
    <div className="panel-header">
      <div>
        <h2>{tSettings(language, "settings.taskTypeDefaults.title")}</h2>
        <p className="muted">
          {tSettings(language, "settings.taskTypeDefaults.description")}
        </p>
      </div>
      <button type="button" className="ghost small" onClick={onResetPreset}>
        {tSettings(language, "settings.taskTypeDefaults.restorePreset")}
      </button>
    </div>
    <div className="panel-body">
      <div className="muted">
        {formatSettingsText(language, "settings.taskTypeDefaults.presetPoints", {
          qa: EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.qa,
          tf: EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.tf,
          m1: EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.m1,
          m2: EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.m2,
          cl: EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.cl,
          cd: EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.cd,
          cld: EXAM_TASK_TYPE_LEGACY_PRESET_POINTS.cld,
        })}
      </div>
      <div className="muted">
        {formatSettingsText(language, "settings.taskTypeDefaults.presetTime", {
          qa: EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.qa,
          tf: EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.tf,
          m1: EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.m1,
          m2: EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.m2,
          cl: EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.cl,
          cd: EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.cd,
          cld: EXAM_TASK_TYPE_LEGACY_PRESET_TIME_SECONDS.cld,
        })}
      </div>
      {AUTO_CARD_TYPE_OPTIONS.map((option) => (
        <div key={option.type} className="setting-row">
          <span className="label">
            {tSettings(language, AUTO_CARD_TYPE_LABEL_KEYS[option.type])}
          </span>
          <div className="setting-inline">
            <input
              type="number"
              min={0}
              className="text-input exam-compact-input"
              value={pointsByType[option.type]}
              onChange={(event) => onPointChange(option.type, event.target.value)}
            />
            <span className="muted">
              {tSettings(language, "settings.taskTypeDefaults.points")}
            </span>
            <input
              type="number"
              min={0}
              className="text-input exam-compact-input"
              value={timeSecondsByType[option.type]}
              onChange={(event) => onTimeSecondsChange(option.type, event.target.value)}
            />
            <span className="muted">
              {tSettings(language, "settings.taskTypeDefaults.seconds")}
            </span>
          </div>
        </div>
      ))}
    </div>
  </section>
);
