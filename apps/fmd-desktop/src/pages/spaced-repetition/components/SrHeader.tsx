import type { Dispatch, SetStateAction } from "react";

type SrHeaderProps = {
  spacedRepetitionStatusLabel: string;
  isFocusMode: boolean;
  focusLabel: string;
  setIsFocusMode: Dispatch<SetStateAction<boolean>>;
};

export const SrHeader = ({
  spacedRepetitionStatusLabel,
  isFocusMode,
  focusLabel,
  setIsFocusMode,
}: SrHeaderProps) => (
  <div className="panel-header">
    <div>
      <h2>Flashcard</h2>
      <p className="muted">{spacedRepetitionStatusLabel}</p>
    </div>
    <div className="panel-actions">
      <button
        type="button"
        className={`focus-toggle ${isFocusMode ? "active" : ""}`}
        onClick={() => setIsFocusMode((prev) => !prev)}
        aria-pressed={isFocusMode}
        aria-label={focusLabel}
        title={focusLabel}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      </button>
    </div>
  </div>
);
