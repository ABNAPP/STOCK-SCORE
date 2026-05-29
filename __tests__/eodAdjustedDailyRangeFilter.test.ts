import { describe, expect, it } from 'vitest';
import {
  filterEodPointsByPreset,
  rangeFromIsoForPreset,
} from '../src/utils/eodAdjustedDailyRangeFilter';

describe('rangeFromIsoForPreset', () => {
  it('returns YTD start on Jan 1 of same year', () => {
    expect(rangeFromIsoForPreset('2024-06-15', 'ytd')).toBe('2024-01-01');
  });

  it('returns MTD start on first of month', () => {
    expect(rangeFromIsoForPreset('2024-06-15', 'mtd')).toBe('2024-06-01');
  });

  it('returns 1 year back from end date', () => {
    expect(rangeFromIsoForPreset('2024-06-15', '1y')).toBe('2023-06-15');
  });

  it('returns 5 years back from end date', () => {
    expect(rangeFromIsoForPreset('2024-06-15', '5y')).toBe('2019-06-15');
  });

  it('returns null for invalid end date', () => {
    expect(rangeFromIsoForPreset('not-a-date', 'ytd')).toBeNull();
  });
});

describe('filterEodPointsByPreset', () => {
  const pts = [
    { date: '2022-01-04', price: 10 },
    { date: '2023-06-01', price: 11 },
    { date: '2024-05-20', price: 12 },
    { date: '2024-06-10', price: 13 },
  ];

  it('filters YTD by last bar year', () => {
    const out = filterEodPointsByPreset(pts, 'ytd');
    expect(out.map((p) => p.date)).toEqual(['2024-05-20', '2024-06-10']);
  });

  it('filters MTD by last bar month', () => {
    const out = filterEodPointsByPreset(pts, 'mtd');
    expect(out.map((p) => p.date)).toEqual(['2024-06-10']);
  });

  it('sorts unsorted input', () => {
    const shuffled = [pts[2]!, pts[0]!, pts[3]!, pts[1]!];
    const out = filterEodPointsByPreset(shuffled, 'ytd');
    expect(out[0]!.date).toBe('2024-05-20');
  });
});
