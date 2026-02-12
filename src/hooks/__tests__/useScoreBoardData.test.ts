import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useScoreBoardData } from '../useScoreBoardData';
import { fetchScoreBoardData } from '../../services/sheets';
import { getCachedData, getDeltaCacheEntry } from '../../services/firestoreCacheService';
import { createMockScoreBoardData } from '../../test/helpers';

// Mock dependencies
vi.mock('../../services/sheets', () => ({
  fetchScoreBoardData: vi.fn(),
}));

vi.mock('../../services/firestoreCacheService', async () => {
  const actual = await vi.importActual('../../services/firestoreCacheService');
  return {
    ...actual,
    getCachedData: vi.fn(),
    getDeltaCacheEntry: vi.fn(),
    setCachedData: vi.fn(),
    setDeltaCacheEntry: vi.fn(),
  };
});

vi.mock('../../services/deltaSyncService', () => ({
  isDeltaSyncEnabled: vi.fn(() => false),
  initSync: vi.fn(),
  pollChanges: vi.fn(),
  loadSnapshot: vi.fn(),
  applyChangesToCache: vi.fn(),
  getPollIntervalMs: vi.fn(() => 900000),
  snapshotToTransformerFormat: vi.fn(),
}));

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

vi.mock('../../contexts/RefreshContext', () => ({
  useRefreshOptional: () => undefined,
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({ createNotification: vi.fn() }),
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

  it('should load data from cache initially', async () => {
    (getDeltaCacheEntry as any).mockResolvedValue(null);
    (getCachedData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should fetch data when cache is empty', async () => {
    (getDeltaCacheEntry as any).mockResolvedValue(null);
    (getCachedData as any).mockResolvedValue(null);
    (fetchScoreBoardData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(fetchScoreBoardData).toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    (getDeltaCacheEntry as any).mockResolvedValue(null);
    (getCachedData as any).mockResolvedValue(null);
    (fetchScoreBoardData as any).mockRejectedValue(new Error('Fetch error'));

    const { result } = renderHook(() => useScoreBoardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toEqual([]);
  });

  it('should support force refresh', async () => {
    (getDeltaCacheEntry as any).mockResolvedValue(null);
    (getCachedData as any).mockResolvedValue(mockData);
    (fetchScoreBoardData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    await act(async () => {
      await result.current.refetch(true);
    });

    expect(fetchScoreBoardData).toHaveBeenCalledWith(true, expect.any(Function));
  });

  it('should update lastUpdated on successful fetch', async () => {
    (getDeltaCacheEntry as any).mockResolvedValue(null);
    (getCachedData as any).mockResolvedValue(null);
    (fetchScoreBoardData as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useScoreBoardData());

    await waitFor(() => {
      expect(result.current.lastUpdated).toBeTruthy();
    });
  });
});
