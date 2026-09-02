import {
  forwardRef,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MutableRefObject,
  type TextareaHTMLAttributes,
} from "react";
import { useMobileSafeInput } from "../lib/useMobileSafeInput";

type SharedSafeProps<T> = {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  editingRef?: MutableRefObject<boolean>;
  focusRef?: MutableRefObject<boolean>;
  onFocus?: (event: FocusEvent<T>) => void;
  onBlur?: (event: FocusEvent<T>) => void;
  onChange?: (event: ChangeEvent<T>) => void;
  onInput?: (event: FormEvent<T>) => void;
  onKeyDown?: (event: KeyboardEvent<T>) => void;
  onBeforeInput?: (event: FormEvent<T>) => void;
  onCompositionStart?: (event: CompositionEvent<T>) => void;
  onCompositionEnd?: (event: CompositionEvent<T>) => void;
};

type MobileSafeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | "value"
  | "onChange"
  | "onInput"
  | "onBeforeInput"
  | "onCompositionStart"
  | "onCompositionEnd"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
> &
  SharedSafeProps<HTMLInputElement>;

type MobileSafeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  | "value"
  | "onChange"
  | "onInput"
  | "onBeforeInput"
  | "onCompositionStart"
  | "onCompositionEnd"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
> &
  SharedSafeProps<HTMLTextAreaElement>;

const coerceValue = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export const MobileSafeInput = forwardRef<HTMLInputElement, MobileSafeInputProps>(
  (
    {
      value,
      onValueChange,
      editingRef,
      focusRef,
      onFocus,
      onBlur,
      onChange,
      onInput,
      onKeyDown,
      onBeforeInput,
      onCompositionStart,
      onCompositionEnd,
      ...rest
    },
    ref,
  ) => {
    const { inputProps } = useMobileSafeInput<HTMLInputElement>({
      value: coerceValue(value),
      onValueChange,
      editingRef,
      focusRef,
      onFocus,
      onBlur,
      onChange,
      onInput,
      onKeyDown,
      onBeforeInput,
      onCompositionStart,
      onCompositionEnd,
    });

    return <input ref={ref} {...rest} {...inputProps} />;
  },
);

MobileSafeInput.displayName = "MobileSafeInput";

export const MobileSafeTextarea = forwardRef<HTMLTextAreaElement, MobileSafeTextareaProps>(
  (
    {
      value,
      onValueChange,
      editingRef,
      focusRef,
      onFocus,
      onBlur,
      onChange,
      onInput,
      onKeyDown,
      onBeforeInput,
      onCompositionStart,
      onCompositionEnd,
      ...rest
    },
    ref,
  ) => {
    const { inputProps } = useMobileSafeInput<HTMLTextAreaElement>({
      value: coerceValue(value),
      onValueChange,
      editingRef,
      focusRef,
      onFocus,
      onBlur,
      onChange,
      onInput,
      onKeyDown,
      onBeforeInput,
      onCompositionStart,
      onCompositionEnd,
    });

    return <textarea ref={ref} {...rest} {...inputProps} />;
  },
);

MobileSafeTextarea.displayName = "MobileSafeTextarea";
