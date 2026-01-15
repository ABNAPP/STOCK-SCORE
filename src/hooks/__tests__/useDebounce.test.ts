import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 300));
    expect(result.current).toBe('test');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial'); // Still initial

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should cancel previous timeout when value changes quickly', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'first' });
    await vi.advanceTimersByTimeAsync(100);

    rerender({ value: 'second' });
    await vi.advanceTimersByTimeAsync(100);

    rerender({ value: 'third' });
    await vi.advanceTimersByTimeAsync(300);

    expect(result.current).toBe('third');
  });

  it('should use custom delay', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    await vi.advanceTimersByTimeAsync(300);
    expect(result.current).toBe('initial'); // Still initial after 300ms

    await vi.advanceTimersByTimeAsync(200);
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should handle number values', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 100 });
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => {
      expect(result.current).toBe(100);
    });
  });

  it('should handle object values', async () => {
    const initial = { key: 'value' };
    const updated = { key: 'newValue' };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: initial } }
    );

    rerender({ value: updated });
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => {
      expect(result.current).toEqual(updated);
    });
  });
});
