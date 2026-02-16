import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalSearch } from '../useGlobalSearch';
import { createMockScoreBoardData, createMockBenjaminGrahamData, createMockPEIndustryData, createMockThresholdData } from '../../test/helpers';

// Mock the data hooks
vi.mock('../useScoreBoardData', () => ({
  useScoreBoardData: () => ({
    data: [
      createMockScoreBoardData({ companyName: 'Apple Inc', ticker: 'AAPL', industry: 'Technology' }),
      createMockScoreBoardData({ companyName: 'Microsoft Corp', ticker: 'MSFT', industry: 'Technology' }),
    ],
  }),
}));

vi.mock('../useBenjaminGrahamData', () => ({
  useBenjaminGrahamData: () => ({
    data: [
      createMockBenjaminGrahamData({ companyName: 'Apple Inc', ticker: 'AAPL' }),
    ],
  }),
}));

vi.mock('../usePEIndustryData', () => ({
  usePEIndustryData: () => ({
    data: [
      createMockPEIndustryData({ industry: 'Technology' }),
    ],
  }),
}));

vi.mock('../useIndustryThresholdData', () => ({
  useIndustryThresholdData: () => ({
    data: [
      createMockThresholdData({ industry: 'Technology' }),
    ],
  }),
}));

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array for empty query', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const results = result.current.search('');
    expect(results).toEqual([]);
  });

  it('should search by company name', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const results = result.current.search('Apple');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.companyName === 'Apple Inc')).toBe(true);
  });

  it('should search by ticker', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const results = result.current.search('AAPL');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.ticker === 'AAPL')).toBe(true);
  });

  it('should search by industry', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const results = result.current.search('Technology');

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.industry === 'Technology' || !r.industry)).toBe(true);
  });

  it('should search across all data types', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const results = result.current.search('Technology');

    // Should find results from multiple data types
    const types = results.map(r => r.type);
    expect(types).toContain('score-board');
    expect(types).toContain('pe-industry');
    expect(types).toContain('industry-threshold');
  });

  it('should limit results to 50', () => {
    const { result } = renderHook(() => useGlobalSearch());

    // Create a query that would match many items
    const results = result.current.search('Tech');

    expect(results.length).toBeLessThanOrEqual(50);
  });

  it('should be case-insensitive', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const results1 = result.current.search('apple');
    const results2 = result.current.search('APPLE');

    expect(results1.length).toBe(results2.length);
  });

  it('should remove duplicate results by id', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const results = result.current.search('Apple');

    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});
