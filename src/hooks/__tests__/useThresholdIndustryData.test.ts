import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useThresholdIndustryData } from '../useThresholdIndustryData';
import { fetchThresholdIndustryData } from '../../services/sheets';
import { getCachedData } from '../../services/cacheService';
import { createMockThresholdData } from '../../test/helpers';

// Mock dependencies
vi.mock('../../services/sheets', () => ({
  fetchThresholdIndustryData: vi.fn(),
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

describe('useThresholdIndustryData', () => {
  const mockData = [
    createMockThresholdData({ industry: 'Technology', irr: 20 }),
    createMockThresholdData({ industry: 'Finance', irr: 15 }),
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

    const { result } = renderHook(() => useThresholdIndustryData());

    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
  });

  it('should fetch data when cache is empty', async () => {
    (getCachedData as any).mockReturnValue(null);
    (fetchThresholdIndustryData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useThresholdIndustryData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(fetchThresholdIndustryData).toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    (getCachedData as any).mockReturnValue(null);
    (fetchThresholdIndustryData as any).mockRejectedValue(new Error('Fetch error'));

    const { result } = renderHook(() => useThresholdIndustryData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
