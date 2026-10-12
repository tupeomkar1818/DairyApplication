import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native-paper';

export type DeferredTextInputProps = Omit<TextInputProps, 'onChangeText'> & {
  value: string;
  onChangeText?: (text: string) => void;
  debounceMs?: number;
  /**
   * Normalizes typed text before it is shown and emitted (e.g. digits only). Apply normalization here rather than in
   * `onChangeText`: a parent-side normalization that leaves the parent value unchanged never syncs back.
   */
  sanitize?: (text: string) => string;
};

type FocusableInput = { focus: () => void; blur: () => void };

export type DeferredTextInputHandle = {
  /**
   * Cancels the pending debounce, emits the current local text to `onChangeText` (when it differs from what the
   * parent last received) and returns it. Call from save handlers: on native, tapping a button does not blur.
   */
  flush: () => string;
  focus: () => void;
  blur: () => void;
};

/**
 * A TextInput wrapper that keeps typing instantaneous at 60fps by maintaining local state,
 * while debouncing the update to the parent component. This prevents massive root-level
 * re-renders from causing input lag.
 */
export const DeferredTextInput = forwardRef<DeferredTextInputHandle, DeferredTextInputProps>(function DeferredTextInput(
  { value, onChangeText, debounceMs = 250, sanitize, ...props },
  ref,
) {
  const [localValue, setLocalValue] = useState(value);
  const localValueRef = useRef(value);
  /** Last text the parent received from us (or adopted from the parent); separates our own echoes from resets. */
  const lastEmittedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<FocusableInput | null>(null);
  // Stable callback ref typed to the minimal shape both Paper ref variants satisfy.
  const setInputRef = useCallback((instance: FocusableInput | null) => {
    inputRef.current = instance;
  }, []);
  const onChangeTextRef = useRef(onChangeText);
  onChangeTextRef.current = onChangeText;
  const sanitizeRef = useRef(sanitize);
  sanitizeRef.current = sanitize;

  // Sync from parent only when it holds a genuinely different value (form reset / programmatic set). An echo of
  // what we emitted — possibly arriving after newer keystrokes — must not clobber the newer local text.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastEmittedRef.current = value;
    localValueRef.current = value;
    setLocalValue(value);
  }, [value]);

  const emit = useCallback((text: string) => {
    lastEmittedRef.current = text;
    onChangeTextRef.current?.(text);
  }, []);

  const flush = useCallback((): string => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const text = localValueRef.current;
    if (text !== lastEmittedRef.current) emit(text);
    return text;
  }, [emit]);

  useImperativeHandle(
    ref,
    () => ({
      flush,
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
    }),
    [flush],
  );

  const handleChangeText = (raw: string) => {
    const text = sanitizeRef.current ? sanitizeRef.current(raw) : raw;
    localValueRef.current = text;
    setLocalValue(text);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (text !== lastEmittedRef.current) emit(text);
    }, debounceMs);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        onChangeTextRef.current?.(localValueRef.current);
      }
    };
  }, []);

  return (
    <TextInput
      {...props}
      ref={setInputRef}
      value={localValue}
      onChangeText={handleChangeText}
      onBlur={(e) => {
        flush();
        props.onBlur?.(e);
      }}
    />
  );
});
