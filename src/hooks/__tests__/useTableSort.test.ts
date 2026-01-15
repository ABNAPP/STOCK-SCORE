import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSort } from '../useTableSort';
import { createMockScoreBoardData } from '../../test/helpers';

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useTableSort', () => {
  const mockData = [
    createMockScoreBoardData({ companyName: 'Company A', ticker: 'A', score: 50 }),
    createMockScoreBoardData({ companyName: 'Company B', ticker: 'B', score: 80 }),
    createMockScoreBoardData({ companyName: 'Company C', ticker: 'C', score: 30 }),
  ];

  it('should sort data by default key', () => {
    const { result } = renderHook(() =>
      useTableSort(mockData, 'companyName', 'asc')
    );

    expect(result.current.sortedData[0].companyName).toBe('Company A');
    expect(result.current.sortedData[1].companyName).toBe('Company B');
    expect(result.current.sortedData[2].companyName).toBe('Company C');
  });

  it('should sort in descending order', () => {
    const { result } = renderHook(() =>
      useTableSort(mockData, 'companyName', 'desc')
    );

    expect(result.current.sortedData[0].companyName).toBe('Company C');
    expect(result.current.sortedData[1].companyName).toBe('Company B');
    expect(result.current.sortedData[2].companyName).toBe('Company A');
  });

  it('should handle sort direction toggle', () => {
    const { result } = renderHook(() =>
      useTableSort(mockData, 'companyName', 'asc')
    );

    act(() => {
      result.current.handleSort('score');
    });

    expect(result.current.sortConfig.key).toBe('score');
    expect(result.current.sortConfig.direction).toBe('asc');

    act(() => {
      result.current.handleSort('score');
    });

    expect(result.current.sortConfig.direction).toBe('desc');
  });

  it('should sort numeric values correctly', () => {
    const { result } = renderHook(() =>
      useTableSort(mockData, 'score', 'asc')
    );

    expect(result.current.sortedData[0].score).toBe(30);
    expect(result.current.sortedData[1].score).toBe(50);
    expect(result.current.sortedData[2].score).toBe(80);
  });

  it('should handle null values in sorting', () => {
    const dataWithNulls = [
      createMockScoreBoardData({ companyName: 'Company A', score: null }),
      createMockScoreBoardData({ companyName: 'Company B', score: 50 }),
      createMockScoreBoardData({ companyName: 'Company C', score: null }),
    ];

    const { result } = renderHook(() =>
      useTableSort(dataWithNulls, 'score', 'asc')
    );

    // Items with null should be at the end
    const sorted = result.current.sortedData;
    expect(sorted[sorted.length - 1].score).toBeNull();
  });

  it('should handle N/A string values', () => {
    const dataWithNA = [
      createMockScoreBoardData({ companyName: 'Company A', score: 'N/A' as any }),
      createMockScoreBoardData({ companyName: 'Company B', score: 50 }),
    ];

    const { result } = renderHook(() =>
      useTableSort(dataWithNA, 'score', 'asc')
    );

    // N/A values should be at the end
    const sorted = result.current.sortedData;
    expect(sorted[sorted.length - 1].score).toBe('N/A');
  });
});
