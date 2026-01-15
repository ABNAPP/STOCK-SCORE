import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnVisibility, ColumnConfig } from '../useColumnVisibility';

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useColumnVisibility', () => {
  const mockColumns: ColumnConfig[] = [
    { key: 'col1', label: 'Column 1', defaultVisible: true },
    { key: 'col2', label: 'Column 2', defaultVisible: true },
    { key: 'col3', label: 'Column 3', defaultVisible: false },
    { key: 'col4', label: 'Column 4', required: true },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with default visibility', () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    expect(result.current.isColumnVisible('col1')).toBe(true);
    expect(result.current.isColumnVisible('col2')).toBe(true);
    expect(result.current.isColumnVisible('col3')).toBe(false);
    expect(result.current.isColumnVisible('col4')).toBe(true);
  });

  it('should load saved visibility from localStorage', () => {
    const savedVisibility = {
      col1: false,
      col2: true,
      col3: true,
    };
    localStorage.setItem('columnVisibility_test', JSON.stringify(savedVisibility));

    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    expect(result.current.isColumnVisible('col1')).toBe(false);
    expect(result.current.isColumnVisible('col2')).toBe(true);
    expect(result.current.isColumnVisible('col3')).toBe(true);
  });

  it('should toggle column visibility', () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    act(() => {
      result.current.toggleColumn('col1');
    });

    expect(result.current.isColumnVisible('col1')).toBe(false);
  });

  it('should not allow hiding required columns', () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    act(() => {
      result.current.toggleColumn('col4');
    });

    expect(result.current.isColumnVisible('col4')).toBe(true);
  });

  it('should save visibility to localStorage', () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    act(() => {
      result.current.toggleColumn('col1');
    });

    const saved = JSON.parse(localStorage.getItem('columnVisibility_test') || '{}');
    expect(saved.col1).toBe(false);
  });

  it('should show all columns', () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    act(() => {
      result.current.hideAllColumns();
      result.current.showAllColumns();
    });

    expect(result.current.isColumnVisible('col1')).toBe(true);
    expect(result.current.isColumnVisible('col2')).toBe(true);
    expect(result.current.isColumnVisible('col3')).toBe(true);
  });

  it('should hide all non-required columns', () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    act(() => {
      result.current.hideAllColumns();
    });

    expect(result.current.isColumnVisible('col1')).toBe(false);
    expect(result.current.isColumnVisible('col2')).toBe(false);
    expect(result.current.isColumnVisible('col3')).toBe(false);
    expect(result.current.isColumnVisible('col4')).toBe(true); // Required
  });

  it('should reset to defaults', () => {
    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    act(() => {
      result.current.toggleColumn('col1');
      result.current.toggleColumn('col2');
      result.current.resetToDefaults();
    });

    expect(result.current.isColumnVisible('col1')).toBe(true);
    expect(result.current.isColumnVisible('col2')).toBe(true);
    expect(result.current.isColumnVisible('col3')).toBe(false);
  });

  it('should handle corrupted localStorage data', () => {
    localStorage.setItem('columnVisibility_test', 'invalid json');

    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: mockColumns })
    );

    // Should fall back to defaults
    expect(result.current.isColumnVisible('col1')).toBe(true);
  });

  it('should merge saved state with new columns', () => {
    const savedVisibility = { col1: false };
    localStorage.setItem('columnVisibility_test', JSON.stringify(savedVisibility));

    const newColumns: ColumnConfig[] = [
      { key: 'col1', label: 'Column 1' },
      { key: 'col5', label: 'Column 5', defaultVisible: false },
    ];

    const { result } = renderHook(() =>
      useColumnVisibility({ tableId: 'test', columns: newColumns })
    );

    expect(result.current.isColumnVisible('col1')).toBe(false); // From saved
    expect(result.current.isColumnVisible('col5')).toBe(false); // From default
  });
});
