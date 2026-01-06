import type { LoadState } from "../../../lib/types";
import type { VaultFile } from "../../../lib/tree";

type ExamEmptyState = {
  title: string;
  message: string;
};

type ExamIdlePanelProps = {
  selectedFile: VaultFile | null;
  previewState: LoadState;
  previewError: string;
  examEmptyState: ExamEmptyState | null;
  availableTaskCount: number;
  plannedTaskCount: number;
  plannedMaxPoints: number;
  hasTaskCountMismatch: boolean;
};

export const ExamIdlePanel = ({
  selectedFile,
  previewState,
  previewError,
  examEmptyState,
  availableTaskCount,
  plannedTaskCount,
  plannedMaxPoints,
  hasTaskCountMismatch,
}: ExamIdlePanelProps) => {
  if (!selectedFile) {
    return (
      <div className="empty-state">
        Select an exam file to begin.
      </div>
    );
  }

  if (previewState === "loading") {
    return <div className="empty-state">Loading exam file...</div>;
  }

  if (previewState === "error") {
    return <div className="error">{previewError || "Failed to load file."}</div>;
  }

  if (examEmptyState) {
    return (
      <div className="empty-state">
        <strong>{examEmptyState.title}</strong>
        <p>{examEmptyState.message}</p>
      </div>
    );
  }

  return (
    <div className="exam-idle">
      <p className="eyebrow">READY</p>
      <h2>Exam ready to start</h2>
      <p className="muted">
        {availableTaskCount} tasks detected. Max points this run: {plannedMaxPoints}.
      </p>
      {hasTaskCountMismatch ? (
        <p className="muted">
          Only {availableTaskCount} tasks available. The exam will run {plannedTaskCount}.
        </p>
      ) : null}
    </div>
  );
};
