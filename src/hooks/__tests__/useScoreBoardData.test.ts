import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useScoreBoardData } from '../useScoreBoardData';
import { fetchScoreBoardData } from '../../services/sheets';
import { getCachedData, setCachedData, CACHE_KEYS } from '../../services/cacheService';
import { createMockScoreBoardData } from '../../test/helpers';

// Mock dependencies
vi.mock('../../services/sheets', () => ({
  fetchScoreBoardData: vi.fn(),
}));

vi.mock('../../services/cacheService', async () => {
  const actual = await vi.importActual('../../services/cacheService');
  return {
    ...actual,
    getCachedData: vi.fn(),
    setCachedData: vi.fn(),
    isCacheFresh: vi.fn(),
    isCacheStale: vi.fn(),
  };
});

vi.mock('../../contexts/LoadingProgressContext', () => ({
  useLoadingProgress: () => ({
    updateProgress: vi.fn(),
  }),
}));

vi.mock('../usePageVisibility', () => ({
  usePageVisibility: () => true,
}));

vi.mock('../../utils/errorHandler', () => ({
  formatError: vi.fn((err) => ({ message: String(err), userMessage: String(err) })),
  logError: vi.fn(),
  createErrorHandler: vi.fn(() => (err: unknown) => ({ message: String(err), userMessage: String(err) })),
}));

describe('useScoreBoardData', () => {
  const mockData = [
    createMockScoreBoardData({ companyName: 'Company A', ticker: 'A' }),
    createMockScoreBoardData({ companyName: 'Company B', ticker: 'B' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load data from cache initially', () => {
    (getCachedData as any).mockReturnValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
  });

  it('should fetch data when cache is empty', async () => {
    (getCachedData as any).mockReturnValue(null);
    (fetchScoreBoardData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(fetchScoreBoardData).toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    (getCachedData as any).mockReturnValue(null);
    (fetchScoreBoardData as any).mockRejectedValue(new Error('Fetch error'));

    const { result } = renderHook(() => useScoreBoardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toEqual([]);
  });

  it('should support force refresh', async () => {
    (getCachedData as any).mockReturnValue(mockData);
    (fetchScoreBoardData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    await act(async () => {
      await result.current.refetch(true);
    });

    expect(fetchScoreBoardData).toHaveBeenCalledWith(true, expect.any(Function));
  });

  it('should update lastUpdated on successful fetch', async () => {
    (getCachedData as any).mockReturnValue(null);
    (fetchScoreBoardData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    await waitFor(() => {
      expect(result.current.lastUpdated).toBeTruthy();
    });
  });
});
