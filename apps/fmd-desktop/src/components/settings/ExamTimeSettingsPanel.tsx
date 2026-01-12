/**
 * @file apps/fmd-desktop/src/components/settings/ExamTimeSettingsPanel.tsx
 *
 * Zweck:
 * - Rendert die Exam Time Settings.
 */

type ExamTimeSettingsPanelProps = {
  timeLimitMinutes: number;
  setTimeLimitMinutes: (value: number) => void;
};

const parseMinutes = (value: string) => {
  if (value.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ExamTimeSettingsPanel = ({
  timeLimitMinutes,
  setTimeLimitMinutes,
}: ExamTimeSettingsPanelProps) => (
  <section className="panel exam-time-panel">
    <div className="panel-header">
      <div>
        <h2>Exam Time</h2>
        <p className="muted">Set the time limit for creating/running an exam.</p>
      </div>
    </div>
    <div className="panel-body">
      <label className="setting-inline">
        <span className="label">DURATION</span>
        <div className="exam-time-input">
          <input
            type="number"
            min={1}
            max={240}
            className="text-input exam-compact-input"
            value={timeLimitMinutes}
            onChange={(event) => setTimeLimitMinutes(parseMinutes(event.target.value))}
          />
          <span className="muted">min</span>
        </div>
      </label>
    </div>
  </section>
);
