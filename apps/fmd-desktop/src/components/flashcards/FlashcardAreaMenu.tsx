/**
 * @file apps/fmd-desktop/src/components/flashcards/FlashcardAreaMenu.tsx
 */

import { useId } from "react";

type FlashcardAreaMenuTriggerProps = {
  enabled: boolean;
  pending: boolean;
  disabledReason?: string;
  error?: string;
  notice?: string;
  locked?: boolean;
  lockedReason?: string;
  onToggle: (nextEnabled: boolean) => void;
};

type FlashcardAreaToggleRowProps = {
  label: string;
  enabled: boolean;
  disabled: boolean;
  pending: boolean;
  onToggle: (nextEnabled: boolean) => void;
};

const AREA_LABEL = "Flashcard";
const DEFAULT_LOCKED_REASON =
  "Diese Karte bleibt im Kartenpool, da sie falsch beantwortet wurde.";

export const FlashcardAreaToggleRow = ({
  label,
  enabled,
  disabled,
  pending,
  onToggle,
}: FlashcardAreaToggleRowProps) => {
  const inputId = useId();
  const isDisabled = disabled || pending;

  return (
    <label
      htmlFor={inputId}
      className={`choice-row flashcard-area-toggle-row ${isDisabled ? "is-disabled" : ""}`}
    >
      <span className="flashcard-area-toggle-row-label">{label}</span>
      <span className="switch">
        <input
          id={inputId}
          type="checkbox"
          checked={enabled}
          disabled={isDisabled}
          onChange={() => onToggle(!enabled)}
          aria-label={`${label} area toggle`}
        />
        <span className="slider" />
      </span>
    </label>
  );
};

export const FlashcardAreaMenuTrigger = ({
  enabled,
  pending,
  disabledReason,
  error,
  notice,
  locked = false,
  lockedReason,
  onToggle,
}: FlashcardAreaMenuTriggerProps) => {
  const isLocked = locked || Boolean(lockedReason);
  const lockNotice = isLocked ? lockedReason || DEFAULT_LOCKED_REASON : "";
  const isDisabled = Boolean(disabledReason) || isLocked;

  return (
    <section
      className={`flashcard-area-switch-panel ${isLocked ? "is-locked" : ""}`}
      aria-label="Flashcard pool"
    >
      <div className="flashcard-area-switch-row">
        <FlashcardAreaToggleRow
          label={AREA_LABEL}
          enabled={enabled}
          disabled={isDisabled}
          pending={pending}
          onToggle={onToggle}
        />
        {pending ? <span className="muted small">Saving...</span> : null}
      </div>
      {lockNotice ? (
        <div className="flashcard-area-switch-notice" role="status">
          {lockNotice}
        </div>
      ) : disabledReason ? (
        <span className="muted small flashcard-area-switch-note">{disabledReason}</span>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      {!error && notice ? (
        <span className="muted small flashcard-area-switch-note">{notice}</span>
      ) : null}
    </section>
  );
};
