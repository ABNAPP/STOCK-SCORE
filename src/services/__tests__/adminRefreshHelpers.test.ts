/**
 * Unit tests for adminRefreshHelpers (runAdminRefresh).
 * Verifies threshold-industry is included in refresh and cutover respects VIEWDATA_MIGRATION_MODE.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appCacheWrites } from '../../test/mocks/firebaseAdmin';
import { runAdminRefresh } from '../../../functions/src/adminRefreshHelpers';

const THRESHOLD_SNAPSHOT = {
  ok: true,
  version: 1,
  headers: ['Industry', 'IRR', 'Leverage F2 Min', 'Leverage F2 Max', 'Ro40 Min', 'Ro40 Max', 'Cash/SDebt Min', 'Cash/SDebt Max', 'Current Ratio Min', 'Current Ratio Max'],
  rows: [
    { key: 'row1', values: ['Technology', 25, 0.5, 2.0, 10, 30, 0.5, 2.0, 1.0, 3.0] },
  ],
  generatedAt: new Date().toISOString(),
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  appCacheWrites.length = 0;
  mockFetch.mockImplementation((url: string | URL) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('sheet=ThresholdIndustry')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(THRESHOLD_SNAPSHOT),
      } as Response);
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
  vi.stubGlobal('fetch', mockFetch);
});

describe('adminRefreshHelpers - threshold-industry', () => {
  it('includes threshold-industry in refresh when force=true', async () => {
    const { refreshed, errors } = await runAdminRefresh(
      'https://script.example.com/exec',
      undefined,
      ['threshold-industry'],
      'admin-uid',
      'cutover',
      false
    );

    expect(errors).toHaveLength(0);
    const ti = refreshed.find((r) => r.viewId === 'threshold-industry');
    expect(ti).toBeDefined();
    expect(ti?.rows).toBe(1);
    expect(ti?.wroteViewData).toBe(true);
  });

  it('does NOT write to appCache for threshold-industry in cutover', async () => {
    await runAdminRefresh(
      'https://script.example.com/exec',
      undefined,
      ['threshold-industry'],
      'admin-uid',
      'cutover',
      false
    );

    const appCacheThreshold = appCacheWrites.filter((w) => w.docId === 'thresholdIndustry');
    expect(appCacheThreshold).toHaveLength(0);
  });

  it('DOES write to appCache for threshold-industry when migrationMode is dual-read', async () => {
    await runAdminRefresh(
      'https://script.example.com/exec',
      undefined,
      ['threshold-industry'],
      'admin-uid',
      'dual-read',
      false
    );

    const appCacheThreshold = appCacheWrites.filter((w) => w.docId === 'thresholdIndustry');
    expect(appCacheThreshold.length).toBeGreaterThanOrEqual(1);
  });
});
