type SrReviewActionsProps = {
  spacedRepetitionCanGoBack: boolean;
  spacedRepetitionCanGoNext: boolean;
  handleSpacedRepetitionPageBack: () => void;
  handleSpacedRepetitionPageNext: () => void;
};

export const SrReviewActions = ({
  spacedRepetitionCanGoBack,
  spacedRepetitionCanGoNext,
  handleSpacedRepetitionPageBack,
  handleSpacedRepetitionPageNext,
}: SrReviewActionsProps) => (
  <div className="flashcard-pagination">
    <button
      type="button"
      className="ghost small"
      onClick={handleSpacedRepetitionPageBack}
      disabled={!spacedRepetitionCanGoBack}
    >
      Back
    </button>
    <button
      type="button"
      className="ghost small"
      onClick={handleSpacedRepetitionPageNext}
      disabled={!spacedRepetitionCanGoNext}
    >
      Next
    </button>
  </div>
);
