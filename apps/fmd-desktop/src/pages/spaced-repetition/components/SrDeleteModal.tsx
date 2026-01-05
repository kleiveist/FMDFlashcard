type SrDeleteModalProps = {
  isDeleteDialogOpen: boolean;
  deleteTargetName: string;
  deleteConfirmInput: string;
  setDeleteConfirmInput: (value: string) => void;
  handleDeleteCancel: () => void;
  handleDeleteConfirm: () => void;
  canConfirmDelete: boolean;
};

export const SrDeleteModal = ({
  isDeleteDialogOpen,
  deleteTargetName,
  deleteConfirmInput,
  setDeleteConfirmInput,
  handleDeleteCancel,
  handleDeleteConfirm,
  canConfirmDelete,
}: SrDeleteModalProps) =>
  isDeleteDialogOpen ? (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
      >
        <h3 id="delete-user-title">Delete user</h3>
        <p className="muted">
          This permanently deletes the user and all spaced repetition progress.
        </p>
        <div className="modal-body">
          <span className="label">Type {deleteTargetName} to confirm</span>
          <input
            type="text"
            className="text-input"
            value={deleteConfirmInput}
            onChange={(event) => setDeleteConfirmInput(event.target.value)}
            aria-label="Type the username to confirm deletion"
          />
          <span className="helper-text">
            Match is case-sensitive. Leading/trailing spaces are ignored.
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={handleDeleteCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleDeleteConfirm}
            disabled={!canConfirmDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  ) : null;
