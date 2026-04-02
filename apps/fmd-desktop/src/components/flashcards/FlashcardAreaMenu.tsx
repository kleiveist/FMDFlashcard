/**
 * @file apps/fmd-desktop/src/components/flashcards/FlashcardAreaMenu.tsx
 */

import { useId, useRef, useState } from "react";
import { AnchoredPopup } from "../AnchoredPopup";
import { ChevronDownIcon } from "../icons";

type FlashcardAreaMenuTriggerProps = {
  enabled: boolean;
  pending: boolean;
  disabledReason?: string;
  error?: string;
  notice?: string;
  onToggle: (nextEnabled: boolean) => void;
};

type FlashcardAreaDropdownProps = {
  id: string;
  enabled: boolean;
  pending: boolean;
  disabledReason?: string;
  error?: string;
  notice?: string;
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

export const FlashcardAreaDropdown = ({
  id,
  enabled,
  pending,
  disabledReason,
  error,
  notice,
  onToggle,
}: FlashcardAreaDropdownProps) => {
  const isDisabled = Boolean(disabledReason);

  return (
    <section id={id} className="flashcard-area-dropdown" aria-label="Flashcard area">
      <div className="flashcard-area-dropdown-title-row">
        <span className="label">Flashcard</span>
        {pending ? <span className="muted small">Saving...</span> : null}
      </div>
      <div className="flashcard-area-dropdown-list">
        <FlashcardAreaToggleRow
          label={AREA_LABEL}
          enabled={enabled}
          disabled={isDisabled}
          pending={pending}
          onToggle={onToggle}
        />
      </div>
      <span className="muted small flashcard-area-dropdown-note">
        Applies to Flashcard, Fast Flashcard, and Repetition for the full task.
      </span>
      {disabledReason ? (
        <span className="muted small flashcard-area-dropdown-note">{disabledReason}</span>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      {!error && notice ? (
        <span className="muted small flashcard-area-dropdown-note">{notice}</span>
      ) : null}
    </section>
  );
};

export const FlashcardAreaMenuTrigger = ({
  enabled,
  pending,
  disabledReason,
  error,
  notice,
  onToggle,
}: FlashcardAreaMenuTriggerProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const popupId = useId();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ghost small flashcard-area-menu-trigger"
        aria-label="Toggle flashcard area"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={popupId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        Flashcard
        <span aria-hidden="true" className="flashcard-area-menu-trigger-icon">
          <ChevronDownIcon />
        </span>
      </button>
      <AnchoredPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={triggerRef}
        closeLayerId={`flashcard-area-menu-${popupId}`}
        ariaLabel="Flashcard menu"
        placement="bottom-end"
        className="flashcard-area-dropdown-popup"
      >
        <FlashcardAreaDropdown
          id={popupId}
          enabled={enabled}
          pending={pending}
          disabledReason={disabledReason}
          error={error}
          notice={notice}
          onToggle={onToggle}
        />
      </AnchoredPopup>
    </>
  );
};
