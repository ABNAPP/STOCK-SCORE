import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTableSearch } from '../useTableSearch';
import { createMockScoreBoardData } from '../../test/helpers';

// Mock sanitizeSearchQuery
vi.mock('../../utils/inputValidator', async () => {
  const actual = await vi.importActual('../../utils/inputValidator');
  return {
    ...actual,
    sanitizeSearchQuery: (query: string) => query, // Simple passthrough for tests
  };
});

describe('useTableSearch', () => {
  const mockData = [
    createMockScoreBoardData({ companyName: 'Apple Inc', ticker: 'AAPL', industry: 'Technology' }),
    createMockScoreBoardData({ companyName: 'Microsoft Corp', ticker: 'MSFT', industry: 'Technology' }),
    createMockScoreBoardData({ companyName: 'Tesla Inc', ticker: 'TSLA', industry: 'Automotive' }),
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should filter data by search query', async () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchFields: ['companyName', 'ticker'],
      })
    );

    act(() => {
      result.current.setSearchValue('Apple');
    });

    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => {
      expect(result.current.filteredData).toHaveLength(1);
      expect(result.current.filteredData[0].companyName).toBe('Apple Inc');
    });
  });

  it('should filter by multiple fields', async () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchFields: ['companyName', 'ticker', 'industry'],
      })
    );

    act(() => {
      result.current.setSearchValue('Tech');
    });

    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => {
      expect(result.current.filteredData.length).toBeGreaterThan(0);
    });
  });

  it('should apply advanced filters', () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchFields: ['companyName'],
        advancedFilters: {
          industry: 'Technology',
        },
      })
    );

    expect(result.current.filteredData.length).toBe(2);
    expect(result.current.filteredData.every(item => item.industry === 'Technology')).toBe(true);
  });

  it('should handle empty search query', async () => {
    const { result } = renderHook(() =>
      useTableSearch({
        data: mockData,
        searchFields: ['companyName'],
      })
    );

    act(() => {
      result.current.setSearchValue('');
    });

    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => {
      expect(result.current.filteredData).toHaveLength(mockData.length);
    });
  });

  it('should handle number range filters', () => {
    const dataWithScores = [
      createMockScoreBoardData({ companyName: 'Company A', score: 50 }),
      createMockScoreBoardData({ companyName: 'Company B', score: 75 }),
      createMockScoreBoardData({ companyName: 'Company C', score: 90 }),
    ];

    const { result } = renderHook(() =>
      useTableSearch({
        data: dataWithScores,
        searchFields: ['companyName'],
        advancedFilters: {
          score: { min: 70, max: 80 },
        },
      })
    );

    expect(result.current.filteredData).toHaveLength(1);
    expect(result.current.filteredData[0].score).toBe(75);
  });
});
