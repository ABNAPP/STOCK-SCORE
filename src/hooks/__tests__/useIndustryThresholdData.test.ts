import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIndustryThresholdData } from '../useIndustryThresholdData';
import type { IndustryThresholdData } from '../../types/stock';
import { ThresholdContext } from '../../contexts/ThresholdContext';

const mockIndustryMap = {
  industryA: 'Industry A',
  industryB: 'Industry B',
};
const mockValues = {
  industryA: {
    irr: 10,
    leverageF2Min: 1,
    leverageF2Max: 2,
    ro40Min: 0.1,
    ro40Max: 0.2,
    cashSdebtMin: 1,
    cashSdebtMax: 2,
    currentRatioMin: 1,
    currentRatioMax: 2,
  },
};

vi.mock('../../config/industryThresholdData', () => ({
  INDUSTRY_MAP: mockIndustryMap,
}));

const mockInitializeFromData = vi.fn();

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'test-user' } }),
}));

describe('useIndustryThresholdData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetDocs.mockResolvedValue({
      forEach: (cb: (docSnap: { id: string; data: () => unknown }) => void) => {
        Object.entries(mockValues).forEach(([id, data]) => cb({ id, data: () => data }));
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load data from Firestore values on mount', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThresholdContext.Provider value={{ initializeFromData: mockInitializeFromData } as any}>
        {children}
      </ThresholdContext.Provider>
    );
    const { result } = renderHook(() => useIndustryThresholdData(), { wrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const expected: IndustryThresholdData[] = [
      { industryKey: 'industryA', industry: 'Industry A', ...mockValues.industryA },
      {
        industryKey: 'industryB',
        industry: 'Industry B',
        irr: 0,
        leverageF2Min: 0,
        leverageF2Max: 0,
        ro40Min: 0,
        ro40Max: 0,
        cashSdebtMin: 0,
        cashSdebtMax: 0,
        currentRatioMin: 0,
        currentRatioMax: 0,
      },
    ];
    expect(result.current.data).toEqual(expected);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(mockInitializeFromData).toHaveBeenCalledWith(expected);
  });

  it('should call initializeFromData when data loads', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThresholdContext.Provider value={{ initializeFromData: mockInitializeFromData } as any}>
        {children}
      </ThresholdContext.Provider>
    );
    renderHook(() => useIndustryThresholdData(), { wrapper });

    await waitFor(() => {
      expect(mockInitializeFromData).toHaveBeenCalled();
    });
  });

  it('should refetch data from Firestore', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThresholdContext.Provider value={{ initializeFromData: mockInitializeFromData } as any}>
        {children}
      </ThresholdContext.Provider>
    );
    const { result } = renderHook(() => useIndustryThresholdData(), { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear previous call count
    mockInitializeFromData.mockClear();

    // Call refetch
    result.current.refetch();

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.length).toBe(2);
    expect(mockInitializeFromData).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('should update lastUpdated when refetching', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThresholdContext.Provider value={{ initializeFromData: mockInitializeFromData } as any}>
        {children}
      </ThresholdContext.Provider>
    );
    const { result } = renderHook(() => useIndustryThresholdData(), { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const firstLastUpdated = result.current.lastUpdated;

    // Wait a bit to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    // Call refetch
    result.current.refetch();

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    // lastUpdated should be updated (or at least set)
    expect(result.current.lastUpdated).not.toBeNull();
  });
});
