/**
 * @file apps/fmd-desktop/src/components/InlineRenameLabel.tsx
 */

import { useEffect, useRef } from "react";

type InlineRenameLabelProps = {
  value: string;
  isEditing: boolean;
  draft: string;
  error?: string;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  inputClassName?: string;
  selectRange?: { start: number; end: number } | null;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
};

export const InlineRenameLabel = ({
  value,
  isEditing,
  draft,
  error,
  placeholder,
  className,
  displayClassName,
  inputClassName,
  selectRange,
  onDraftChange,
  onCommit,
  onCancel,
}: InlineRenameLabelProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ignoreBlurRef = useRef(false);

  useEffect(() => {
    if (!isEditing || !inputRef.current) {
      return;
    }
    const input = inputRef.current;
    input.focus();
    if (selectRange) {
      input.setSelectionRange(selectRange.start, selectRange.end);
    } else {
      input.select();
    }
  }, [isEditing, selectRange]);

  if (!isEditing) {
    return <span className={displayClassName}>{value}</span>;
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        className={inputClassName}
        value={draft}
        placeholder={placeholder}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            ignoreBlurRef.current = true;
            onCommit();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            ignoreBlurRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (ignoreBlurRef.current) {
            ignoreBlurRef.current = false;
            return;
          }
          onCommit();
        }}
      />
      {error ? <span className="inline-rename-error">{error}</span> : null}
    </div>
  );
};
