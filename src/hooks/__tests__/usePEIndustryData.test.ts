import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePEIndustryData } from '../usePEIndustryData';
import { fetchPEIndustryData } from '../../services/sheets';
import { getCachedData } from '../../services/cacheService';
import { createMockPEIndustryData } from '../../test/helpers';

// Mock dependencies
vi.mock('../../services/sheets', () => ({
  fetchPEIndustryData: vi.fn(),
}));

vi.mock('../../services/cacheService', async () => {
  const actual = await vi.importActual('../../services/cacheService');
  return {
    ...actual,
    getCachedData: vi.fn(),
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

describe('usePEIndustryData', () => {
  const mockData = [
    createMockPEIndustryData({ industry: 'Technology', pe: 20 }),
    createMockPEIndustryData({ industry: 'Finance', pe: 15 }),
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

    const { result } = renderHook(() => usePEIndustryData());

    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
  });

  it('should fetch data when cache is empty', async () => {
    (getCachedData as any).mockReturnValue(null);
    (fetchPEIndustryData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => usePEIndustryData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(fetchPEIndustryData).toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    (getCachedData as any).mockReturnValue(null);
    (fetchPEIndustryData as any).mockRejectedValue(new Error('Fetch error'));

    const { result } = renderHook(() => usePEIndustryData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
