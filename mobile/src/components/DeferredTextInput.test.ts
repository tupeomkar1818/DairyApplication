import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type ReactTestRendererInstance = ReturnType<typeof TestRenderer.create>;

vi.mock('react-native-paper', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    TextInput: ({ value, onChangeText, onBlur, ...props }: any) =>
      ReactModule.createElement('TextInput', { ...props, value, onChangeText, onBlur }),
  };
});

import { DeferredTextInput, type DeferredTextInputHandle } from '@/src/components/DeferredTextInput';

describe('DeferredTextInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces parent updates', () => {
    const onChangeText = vi.fn();
    let renderer: ReactTestRendererInstance;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(DeferredTextInput, { value: '', onChangeText, debounceMs: 250 }),
      );
    });

    const input = renderer!.root.findByType('TextInput');
    act(() => {
      input.props.onChangeText('ab');
    });
    expect(onChangeText).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onChangeText).toHaveBeenCalledWith('ab');
  });

  it('flushes pending text on blur before debounce elapses', () => {
    const onChangeText = vi.fn();
    let renderer: ReactTestRendererInstance;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(DeferredTextInput, { value: '', onChangeText, debounceMs: 500 }),
      );
    });

    const input = renderer!.root.findByType('TextInput');
    act(() => {
      input.props.onChangeText('save-me');
      input.props.onBlur();
    });
    expect(onChangeText).toHaveBeenCalledWith('save-me');
  });

  it('syncs when parent value changes externally', () => {
    const onChangeText = vi.fn();
    let renderer: ReactTestRendererInstance;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(DeferredTextInput, { value: 'initial', onChangeText }),
      );
    });

    act(() => {
      renderer!.update(React.createElement(DeferredTextInput, { value: 'reset', onChangeText }));
    });

    expect(renderer!.root.findByType('TextInput').props.value).toBe('reset');
  });

  it('flush() emits and returns pending text without waiting for blur or the debounce', () => {
    const onChangeText = vi.fn();
    const ref = React.createRef<DeferredTextInputHandle>();
    let renderer: ReactTestRendererInstance;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(DeferredTextInput, { ref, value: '100', onChangeText, debounceMs: 250 }),
      );
    });

    act(() => {
      renderer!.root.findByType('TextInput').props.onChangeText('1500');
    });
    expect(onChangeText).not.toHaveBeenCalled();

    let flushed = '';
    act(() => {
      flushed = ref.current!.flush();
    });
    expect(flushed).toBe('1500');
    expect(onChangeText).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('1500');

    // The cancelled debounce must not fire a second emit, and a repeat flush has nothing new to send.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      expect(ref.current!.flush()).toBe('1500');
    });
    expect(onChangeText).toHaveBeenCalledTimes(1);
  });

  it('flush() returns the current value when nothing is pending', () => {
    const onChangeText = vi.fn();
    const ref = React.createRef<DeferredTextInputHandle>();

    act(() => {
      TestRenderer.create(React.createElement(DeferredTextInput, { ref, value: 'kept', onChangeText }));
    });

    expect(ref.current!.flush()).toBe('kept');
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it('applies sanitize to what is shown and emitted', () => {
    const onChangeText = vi.fn();
    const ref = React.createRef<DeferredTextInputHandle>();
    let renderer: ReactTestRendererInstance;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(DeferredTextInput, {
          ref,
          value: '123',
          onChangeText,
          sanitize: (t: string) => t.replace(/\D/g, ''),
        }),
      );
    });

    act(() => {
      renderer!.root.findByType('TextInput').props.onChangeText('123a');
    });
    // Parent value is unchanged ('123'), so only local sanitizing keeps the stray letter off screen.
    expect(renderer!.root.findByType('TextInput').props.value).toBe('123');
    act(() => {
      expect(ref.current!.flush()).toBe('123');
    });
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it('does not let a late echo of an earlier commit clobber newer typing', () => {
    const onChangeText = vi.fn();
    let renderer: ReactTestRendererInstance;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(DeferredTextInput, { value: '', onChangeText, debounceMs: 250 }),
      );
    });

    act(() => {
      renderer!.root.findByType('TextInput').props.onChangeText('ab');
      vi.advanceTimersByTime(250);
    });
    expect(onChangeText).toHaveBeenLastCalledWith('ab');

    act(() => {
      renderer!.root.findByType('TextInput').props.onChangeText('abc');
    });
    // Parent commits the earlier 'ab' only now.
    act(() => {
      renderer!.update(React.createElement(DeferredTextInput, { value: 'ab', onChangeText, debounceMs: 250 }));
    });
    expect(renderer!.root.findByType('TextInput').props.value).toBe('abc');

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onChangeText).toHaveBeenLastCalledWith('abc');
  });
});
