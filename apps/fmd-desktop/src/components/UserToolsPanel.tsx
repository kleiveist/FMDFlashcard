/**
 * @file apps/fmd-desktop/src/components/UserToolsPanel.tsx
 *
 * Zweck:
 * - Rendert die User Tools fuer Study/Spaced Repetition und Exam.
 *
 * Verantwortlichkeiten:
 * - Zeigt Active User, Start und User-Management an.
 * - Teilt Layout und Logik zwischen Study und Exam.
 */

import { CollapsiblePanelHeader } from "./CollapsiblePanelHeader";
import type { ExamStage } from "../pages/exam-simulation/examSimulationTypes";
import { type SettingsLanguage, tSettings } from "../features/settings/settingsI18n";

export type ExamStageControls = {
  stage: ExamStage;
  canStartExam: boolean;
  phaseDisabled?: boolean;
  onStartExam: () => void;
  onSubmitExam: () => void;
  onStartScoring: () => void;
  onFinishManualScoring: () => void;
  onFinalizeExam: () => void;
  onBackToResults: () => void;
  onResetExam: () => void;
};

type ExamPhaseButton = {
  label: string;
  onClick: () => void;
  disabled: boolean;
};

export type ExamPrimaryButton = {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: "primary" | "ghost";
};

export const resolveExamPhaseButton = (examStageControls: ExamStageControls): ExamPhaseButton => {
  switch (examStageControls.stage) {
    case "idle":
      return {
        label: "Start",
        onClick: examStageControls.onStartExam,
        disabled: !examStageControls.canStartExam,
      };
    case "running":
      return {
        label: "Submit",
        onClick: examStageControls.onSubmitExam,
        disabled: false,
      };
    case "review":
      return {
        label: "Proceed to Scoring",
        onClick: examStageControls.onStartScoring,
        disabled: false,
      };
    case "scoring_manual":
      return {
        label: "Finish",
        onClick: examStageControls.onFinishManualScoring,
        disabled: Boolean(examStageControls.phaseDisabled),
      };
    case "finish_scoring":
      return {
        label: "Finish",
        onClick: examStageControls.onFinalizeExam,
        disabled: Boolean(examStageControls.phaseDisabled),
      };
    case "correction":
      return {
        label: "Back to Results",
        onClick: examStageControls.onBackToResults,
        disabled: false,
      };
    case "finished":
    default:
      return {
        label: "Results",
        onClick: examStageControls.onFinalizeExam,
        disabled: true,
      };
  }
};

export const resolveExamPrimaryButton = (
  examStageControls: ExamStageControls,
): ExamPrimaryButton => {
  if (examStageControls.stage === "finished") {
    return {
      label: "Reset",
      onClick: examStageControls.onResetExam,
      disabled: false,
      variant: "ghost",
    };
  }
  const phaseButton = resolveExamPhaseButton(examStageControls);
  return {
    ...phaseButton,
    variant: "primary",
  };
};

type UserRegistryState = {
  spacedRepetitionActiveUser: string | null;
  spacedRepetitionSelectedUserId: string;
  spacedRepetitionUsers: { id: string; name: string }[];
  spacedRepetitionNewUserName: string;
  spacedRepetitionUserError: string;
  handleSpacedRepetitionActiveUserLoadCards: () => void;
  setSpacedRepetitionSelectedUserId: (value: string) => void;
  setSpacedRepetitionNewUserName: (value: string) => void;
  setSpacedRepetitionUserError: (value: string) => void;
  handleSpacedRepetitionCreateUser: () => void;
  handleSpacedRepetitionDeleteUser: () => void;
  handleSpacedRepetitionLoadUser: () => void;
};

export type UserRegistryControlsProps = {
  language?: SettingsLanguage;
  spacedRepetition: UserRegistryState;
  handleDeleteOpen: () => void;
  showActiveUser?: boolean;
  disableCreate?: boolean;
  disableLoad?: boolean;
  disableDelete?: boolean;
  disableSelect?: boolean;
};

export const UserRegistryControls = ({
  language = "en",
  spacedRepetition,
  handleDeleteOpen,
  showActiveUser = true,
  disableCreate = false,
  disableLoad = false,
  disableDelete = false,
  disableSelect = false,
}: UserRegistryControlsProps) => (
  <>
    {showActiveUser ? (
      <div className="setting-row">
        <span className="label">{tSettings(language, "settings.user.activeUser")}</span>
        <div className="setting-inline">
          <span className="value">{spacedRepetition.spacedRepetitionActiveUser ?? "—"}</span>
        </div>
      </div>
    ) : null}
    <div className="setting-row">
      <span className="label">{tSettings(language, "settings.user.userList")}</span>
      <select
        className="text-input"
        value={spacedRepetition.spacedRepetitionSelectedUserId}
        onChange={(event) => spacedRepetition.setSpacedRepetitionSelectedUserId(event.target.value)}
        aria-label="Select user"
        disabled={disableSelect}
      >
        <option value="">{tSettings(language, "settings.user.selectUser")}</option>
        {spacedRepetition.spacedRepetitionUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
    <div className="setting-row">
      <span className="label">{tSettings(language, "settings.user.newUser")}</span>
      <div className="setting-inline">
        <input
          type="text"
          className="text-input"
          value={spacedRepetition.spacedRepetitionNewUserName}
          onChange={(event) => {
            spacedRepetition.setSpacedRepetitionNewUserName(event.target.value);
            if (spacedRepetition.spacedRepetitionUserError) {
              spacedRepetition.setSpacedRepetitionUserError("");
            }
          }}
          placeholder={tSettings(language, "settings.user.userName")}
          aria-label="New user name"
        />
        <button
          type="button"
          className="ghost small"
          onClick={spacedRepetition.handleSpacedRepetitionCreateUser}
          disabled={disableCreate}
        >
          {tSettings(language, "settings.user.create")}
        </button>
      </div>
      {spacedRepetition.spacedRepetitionUserError ? (
        <span className="helper-text error-text">{spacedRepetition.spacedRepetitionUserError}</span>
      ) : null}
    </div>
    <div className="setting-row">
      <span className="label">{tSettings(language, "settings.user.actions")}</span>
      <div className="setting-actions">
        <button
          type="button"
          className="ghost small"
          onClick={spacedRepetition.handleSpacedRepetitionLoadUser}
          disabled={disableLoad || !spacedRepetition.spacedRepetitionSelectedUserId}
        >
          {tSettings(language, "settings.user.load")}
        </button>
        <button
          type="button"
          className="ghost small"
          onClick={handleDeleteOpen}
          disabled={disableDelete || !spacedRepetition.spacedRepetitionSelectedUserId}
        >
          {tSettings(language, "settings.user.delete")}
        </button>
      </div>
    </div>
  </>
);

type UserToolsPanelProps = {
  spacedRepetition: UserRegistryState;
  handleDeleteOpen: () => void;
  onStart: () => void;
  startDisabled: boolean;
  showReset?: boolean;
  onReset?: () => void;
  examStageControls?: ExamStageControls;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
};

export const UserToolsPanel = ({
  spacedRepetition,
  handleDeleteOpen,
  onStart,
  startDisabled,
  showReset = false,
  onReset,
  examStageControls,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
}: UserToolsPanelProps) => {
  const phaseButton = examStageControls ? resolveExamPhaseButton(examStageControls) : null;
  const primaryButton = examStageControls ? resolveExamPrimaryButton(examStageControls) : null;

  return (
    <section className="panel sr-user-panel">
      {isCollapsible && onToggleCollapse && controlsId ? (
        <CollapsiblePanelHeader
          title="User Tools"
          isCollapsed={isCollapsed}
          onToggle={onToggleCollapse}
          controlsId={controlsId}
        />
      ) : (
        <div className="panel-header">
          <div>
            <h2>User Tools</h2>
          </div>
        </div>
      )}
      <div
        className="panel-body"
        id={controlsId}
        hidden={Boolean(isCollapsible && isCollapsed)}
        aria-hidden={Boolean(isCollapsible && isCollapsed)}
      >
        <div className="setting-row">
          <div className="setting-inline sr-user-actions">
            {phaseButton ? (
              <>
                <button
                  type="button"
                  className={`${primaryButton?.variant ?? "primary"} small`}
                  onClick={(primaryButton ?? phaseButton).onClick}
                  disabled={(primaryButton ?? phaseButton).disabled}
                >
                  {(primaryButton ?? phaseButton).label}
                </button>
                {examStageControls?.stage !== "finished" ? (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={examStageControls?.onResetExam}
                    aria-label="Reset session"
                  >
                    Reset
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ghost small"
                  onClick={onStart}
                  disabled={startDisabled}
                  aria-label="Start session for active user"
                >
                  Start
                </button>
                {showReset ? (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={onReset}
                    aria-label="Reset session"
                  >
                    Reset
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
        <UserRegistryControls
          spacedRepetition={spacedRepetition}
          handleDeleteOpen={handleDeleteOpen}
        />
      </div>
    </section>
  );
};
