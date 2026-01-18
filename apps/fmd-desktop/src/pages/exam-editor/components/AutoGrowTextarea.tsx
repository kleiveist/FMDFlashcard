/**
 * @file apps/fmd-desktop/src/pages/exam-editor/components/AutoGrowTextarea.tsx
 */

import { useEffect, useRef } from "react";

type AutoGrowTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
};

export const AutoGrowTextarea = ({
  value,
  onChange,
  className,
  placeholder,
  rows,
  disabled,
  id,
  name,
  ariaLabel,
}: AutoGrowTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const manualHeightRef = useRef<number | null>(null);

  const syncHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    const nextHeight = Math.max(
      textarea.scrollHeight,
      manualHeightRef.current ?? 0,
    );
    textarea.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    syncHeight();
  }, [value]);

  const handlePointerUp = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    manualHeightRef.current = textarea.offsetHeight;
  };

  return (
    <textarea
      ref={textareaRef}
      className={className}
      rows={rows}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      name={name}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      onPointerUp={handlePointerUp}
    />
  );
};
