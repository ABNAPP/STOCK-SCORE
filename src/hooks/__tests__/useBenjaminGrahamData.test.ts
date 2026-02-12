import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBenjaminGrahamData } from '../useBenjaminGrahamData';
import * as sheetsService from '../../services/sheets';
import * as deltaSyncService from '../../services/deltaSyncService';
import * as firestoreCacheService from '../../services/firestoreCacheService';

// Mock dependencies
vi.mock('../../services/sheets');
vi.mock('../../services/deltaSyncService');
vi.mock('../../services/firestoreCacheService');
vi.mock('../../contexts/LoadingProgressContext', () => ({
  useLoadingProgress: () => ({
    updateProgress: vi.fn(),
  }),
}));
vi.mock('../usePageVisibility', () => ({
  usePageVisibility: () => true,
}));

vi.mock('../../contexts/RefreshContext', () => ({
  useRefreshOptional: () => undefined,
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({ createNotification: vi.fn() }),
}));

describe('useBenjaminGrahamData Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(firestoreCacheService, 'getViewDataWithFallback').mockResolvedValue(null);
    vi.spyOn(firestoreCacheService, 'setViewData').mockResolvedValue(undefined);
  });

  it('should handle fetch errors', async () => {
    const mockError = new Error('Failed to fetch data');
    vi.spyOn(sheetsService, 'fetchBenjaminGrahamData').mockRejectedValue(mockError);
    vi.spyOn(firestoreCacheService, 'getCachedData').mockResolvedValue(null);
    vi.spyOn(firestoreCacheService, 'getDeltaCacheEntry').mockResolvedValue(null);

    const { result } = renderHook(() => useBenjaminGrahamData());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle network errors', async () => {
    const networkError = new TypeError('Failed to fetch');
    vi.spyOn(sheetsService, 'fetchBenjaminGrahamData').mockRejectedValue(networkError);
    vi.spyOn(firestoreCacheService, 'getCachedData').mockResolvedValue(null);
    vi.spyOn(firestoreCacheService, 'getDeltaCacheEntry').mockResolvedValue(null);

    const { result } = renderHook(() => useBenjaminGrahamData());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toMatch(/Connection error|Network error|Unable to connect/i);
    });
  });

  it('should handle delta sync errors and fallback to regular fetch', async () => {
    const deltaError = new Error('Delta sync failed');
    vi.spyOn(deltaSyncService, 'initSync').mockRejectedValue(deltaError);
    vi.spyOn(sheetsService, 'fetchBenjaminGrahamData').mockResolvedValue([]);
    vi.spyOn(firestoreCacheService, 'getCachedData').mockResolvedValue(null);
    vi.spyOn(firestoreCacheService, 'getDeltaCacheEntry').mockResolvedValue(null);
    vi.spyOn(deltaSyncService, 'isDeltaSyncEnabled').mockReturnValue(true);

    const { result } = renderHook(() => useBenjaminGrahamData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle invalid data transformation', async () => {
    const invalidData = { data: null, meta: { fields: null } };
    vi.spyOn(sheetsService, 'fetchBenjaminGrahamData').mockImplementation(() => {
      throw new Error('Invalid data format');
    });
    vi.spyOn(firestoreCacheService, 'getCachedData').mockResolvedValue(null);
    vi.spyOn(firestoreCacheService, 'getDeltaCacheEntry').mockResolvedValue(null);

    const { result } = renderHook(() => useBenjaminGrahamData());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('should handle empty data gracefully', async () => {
    vi.spyOn(sheetsService, 'fetchBenjaminGrahamData').mockResolvedValue([]);
    vi.spyOn(firestoreCacheService, 'getCachedData').mockResolvedValue(null);
    vi.spyOn(firestoreCacheService, 'getDeltaCacheEntry').mockResolvedValue(null);

    const { result } = renderHook(() => useBenjaminGrahamData());

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
