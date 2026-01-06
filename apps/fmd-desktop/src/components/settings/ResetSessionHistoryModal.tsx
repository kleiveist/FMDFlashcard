type ResetSessionHistoryModalProps = {
  isOpen: boolean;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ResetSessionHistoryModal = ({
  isOpen,
  isPending = false,
  onCancel,
  onConfirm,
}: ResetSessionHistoryModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-session-history-title"
        aria-describedby="reset-session-history-body"
      >
        <h3 id="reset-session-history-title">Reset Session History</h3>
        <div className="modal-body" id="reset-session-history-body">
          <p className="muted">
            This will delete all saved session results (top scores and recent runs).
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Resetting..." : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
};
