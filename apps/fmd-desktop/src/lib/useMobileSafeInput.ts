import {
  useCallback,
  useRef,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type InputTarget = HTMLInputElement | HTMLTextAreaElement;

type UseMobileSafeInputOptions<T extends InputTarget> = {
  value: string;
  onValueChange: (value: string) => void;
  onFocus?: (event: FocusEvent<T>) => void;
  onBlur?: (event: FocusEvent<T>) => void;
  onChange?: (event: ChangeEvent<T>) => void;
  onInput?: (event: FormEvent<T>) => void;
  onKeyDown?: (event: KeyboardEvent<T>) => void;
  onBeforeInput?: (event: FormEvent<T>) => void;
  onCompositionStart?: (event: CompositionEvent<T>) => void;
  onCompositionEnd?: (event: CompositionEvent<T>) => void;
};

const computeDeleteContentBackward = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  if (selectionStart !== selectionEnd) {
    return value.slice(0, selectionStart) + value.slice(selectionEnd);
  }
  if (selectionStart <= 0) {
    return value;
  }
  return value.slice(0, selectionStart - 1) + value.slice(selectionEnd);
};

const computeDeleteContentForward = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  if (selectionStart !== selectionEnd) {
    return value.slice(0, selectionStart) + value.slice(selectionEnd);
  }
  if (selectionStart >= value.length) {
    return value;
  }
  return value.slice(0, selectionStart) + value.slice(selectionStart + 1);
};

const deleteInputTypes = new Set([
  "deleteContentBackward",
  "deleteContentForward",
  "deleteByCut",
]);

export const useMobileSafeInput = <T extends InputTarget>({
  value,
  onValueChange,
  onFocus,
  onBlur,
  onChange,
  onInput,
  onKeyDown,
  onBeforeInput,
  onCompositionStart,
  onCompositionEnd,
}: UseMobileSafeInputOptions<T>) => {
  const isComposingRef = useRef(false);
  const isEditingRef = useRef(false);

  const handleFocus = useCallback(
    (event: FocusEvent<T>) => {
      isEditingRef.current = true;
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<T>) => {
      isEditingRef.current = false;
      onBlur?.(event);
    },
    [onBlur],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<T>) => {
      onValueChange(event.currentTarget.value);
      onChange?.(event);
    },
    [onChange, onValueChange],
  );

  const handleNativeTextEvent = useCallback(
    (event: FormEvent<T>) => {
      const nativeEvent = event.nativeEvent as InputEvent | undefined;
      const inputType = nativeEvent?.inputType;
      if (!inputType || !deleteInputTypes.has(inputType)) {
        return false;
      }
      // Some OSKs (e.g., GNOME/Phosh, OEM Android) only emit delete via input events.
      const nextValue = event.currentTarget.value;
      if (nextValue !== value) {
        onValueChange(nextValue);
      }
      return true;
    },
    [onValueChange, value],
  );

  const handleBeforeInput = useCallback(
    (event: FormEvent<T>) => {
      if (event.defaultPrevented) {
        onBeforeInput?.(event);
        return;
      }
      // Mobile/virtual keyboards often skip keydown; beforeinput with inputType is more reliable.
      const nativeEvent = event.nativeEvent as InputEvent | undefined;
      if (!isComposingRef.current && nativeEvent?.inputType) {
        const target = event.currentTarget;
        const selectionStart = target.selectionStart;
        const selectionEnd = target.selectionEnd;
        if (
          typeof selectionStart === "number" &&
          typeof selectionEnd === "number"
        ) {
          let nextValue = target.value;
          if (nativeEvent.inputType === "deleteContentBackward") {
            nextValue = computeDeleteContentBackward(
              target.value,
              selectionStart,
              selectionEnd,
            );
          } else if (
            nativeEvent.inputType === "deleteContentForward" ||
            nativeEvent.inputType === "deleteByCut"
          ) {
            nextValue = computeDeleteContentForward(
              target.value,
              selectionStart,
              selectionEnd,
            );
          }
          if (nextValue !== value) {
            onValueChange(nextValue);
          }
        }
      }
      onBeforeInput?.(event);
    },
    [onBeforeInput, onValueChange, value],
  );

  const handleInput = useCallback(
    (event: FormEvent<T>) => {
      const handledDelete = handleNativeTextEvent(event);
      if (!handledDelete && !isComposingRef.current) {
        const nextValue = event.currentTarget.value;
        if (nextValue !== value) {
          onValueChange(nextValue);
        }
      }
      onInput?.(event);
    },
    [handleNativeTextEvent, onInput, onValueChange, value],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<T>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || isComposingRef.current) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }
      const target = event.currentTarget;
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      if (typeof selectionStart !== "number" || typeof selectionEnd !== "number") {
        return;
      }
      const nextValue =
        event.key === "Backspace"
          ? computeDeleteContentBackward(target.value, selectionStart, selectionEnd)
          : computeDeleteContentForward(target.value, selectionStart, selectionEnd);
      if (nextValue !== value) {
        onValueChange(nextValue);
      }
    },
    [onKeyDown, onValueChange, value],
  );

  const handleCompositionStart = useCallback(
    (event: CompositionEvent<T>) => {
      // IME composition should flow without forced mutations; finalize on compositionend.
      isComposingRef.current = true;
      onCompositionStart?.(event);
    },
    [onCompositionStart],
  );

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<T>) => {
      isComposingRef.current = false;
      onValueChange(event.currentTarget.value);
      onCompositionEnd?.(event);
    },
    [onCompositionEnd, onValueChange],
  );

  return {
    inputProps: {
      value,
      onChange: handleChange,
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onBeforeInput: handleBeforeInput,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
    isEditingRef,
  };
};
