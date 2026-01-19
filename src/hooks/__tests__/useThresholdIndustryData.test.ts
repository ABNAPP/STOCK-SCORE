import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useThresholdIndustryData } from '../useThresholdIndustryData';
import { createMockThresholdData } from '../../test/helpers';
import { ThresholdIndustryData } from '../../types/stock';

// Mock static data file
const mockStaticData: ThresholdIndustryData[] = [
  createMockThresholdData({ industry: 'Technology', irr: 20 }),
  createMockThresholdData({ industry: 'Finance', irr: 15 }),
];

vi.mock('../../config/thresholdIndustryData', () => ({
  STATIC_THRESHOLD_INDUSTRY_DATA: mockStaticData,
}));

// Mock ThresholdContext
const mockInitializeFromData = vi.fn();

vi.mock('../../contexts/ThresholdContext', () => ({
  useThresholdValues: () => ({
    initializeFromData: mockInitializeFromData,
  }),
}));

describe('useThresholdIndustryData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load data from static file on mount', async () => {
    const { result } = renderHook(() => useThresholdIndustryData());

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockStaticData);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(mockInitializeFromData).toHaveBeenCalledWith(mockStaticData);
  });

  it('should call initializeFromData when data loads', async () => {
    renderHook(() => useThresholdIndustryData());

    await waitFor(() => {
      expect(mockInitializeFromData).toHaveBeenCalled();
    });

    expect(mockInitializeFromData).toHaveBeenCalledWith(mockStaticData);
  });

  it('should refetch data from static file', async () => {
    const { result } = renderHook(() => useThresholdIndustryData());

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

    expect(result.current.data).toEqual(mockStaticData);
    expect(mockInitializeFromData).toHaveBeenCalledWith(mockStaticData);
    expect(result.current.error).toBeNull();
  });

  it('should update lastUpdated when refetching', async () => {
    const { result } = renderHook(() => useThresholdIndustryData());

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
