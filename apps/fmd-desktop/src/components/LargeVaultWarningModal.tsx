type LargeVaultWarningModalProps = {
  count: number | null;
  onClose: () => void;
};

export const LargeVaultWarningModal = ({
  count,
  onClose,
}: LargeVaultWarningModalProps) => {
  if (count === null) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="large-vault-warning-title"
        aria-describedby="large-vault-warning-body"
      >
        <h3 id="large-vault-warning-title">Large Vault Detected</h3>
        <div className="modal-body" id="large-vault-warning-body">
          <p className="muted">
            This vault contains {count} Markdown files. Loading and scanning may be
            slower.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
