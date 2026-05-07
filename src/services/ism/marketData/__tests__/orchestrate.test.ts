import { describe, it, expect, vi } from 'vitest';
import type { IsmMarketProviderAdapter } from '../adapterInterface';
import type { IsmDailyBar, IsmDataRequestMode, IsmMarketDataResult, SymbolTranslationContext } from '../types';
import { ProviderKeyPool, parseKeyPool } from '../keyPool';
import { fetchIsmHistoricalDailyWithFallback } from '../orchestratePrice';
import { fetchIsmUsdFxRatesWithFallback } from '../orchestrateFx';
import { metaBase, withSuccessMeta } from '../resultHelpers';

const ctx: SymbolTranslationContext = {
  tickerRaw: 'MMM',
  exchangeSlug: 'unknown',
  symbolSlug: 'mmm',
};

function okBars(symbol: string): IsmMarketDataResult<IsmDailyBar[]> {
  const bars: IsmDailyBar[] = [
    { date: '2024-01-02', open: 10, high: 11, low: 9, close: 10.5, volume: 100 },
  ];
  return withSuccessMeta(metaBase('daily'), 'eodhd', 0, 'k', symbol, bars);
}

describe('fetchIsmHistoricalDailyWithFallback', () => {
  it('ISM chain is EODHD-only: invalid eodhd does not call other providers', async () => {
    const eodhd: IsmMarketProviderAdapter = {
      id: 'eodhd',
      fetchHistoricalDaily: vi.fn().mockResolvedValue({
        outcome: 'invalid',
        data: null,
        reason: 'bad',
        meta: metaBase('daily'),
      }),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const alpha: IsmMarketProviderAdapter = {
      id: 'alpha_vantage',
      fetchHistoricalDaily: vi.fn().mockResolvedValue(okBars('MMM')),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const ms: IsmMarketProviderAdapter = {
      id: 'marketstack',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const fh: IsmMarketProviderAdapter = {
      id: 'finnhub',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };

    const pools = new Map([
      ['eodhd', new ProviderKeyPool('eodhd', parseKeyPool('key1'))],
      ['alpha_vantage', new ProviderKeyPool('alpha_vantage', parseKeyPool('a1'))],
      ['marketstack', new ProviderKeyPool('marketstack', [])],
      ['finnhub', new ProviderKeyPool('finnhub', [])],
    ]);

    const adapters = { eodhd, alpha_vantage: alpha, marketstack: ms, finnhub: fh };
    const res = await fetchIsmHistoricalDailyWithFallback(
      ctx,
      '2024-01-01',
      '2024-01-31',
      'daily' as IsmDataRequestMode,
      pools,
      adapters
    );
    expect(res.outcome).toBe('invalid');
    expect(eodhd.fetchHistoricalDaily).toHaveBeenCalledTimes(1);
    expect(alpha.fetchHistoricalDaily).not.toHaveBeenCalled();
  });

  it('rotates keys on failed then succeeds', async () => {
    const eodhd: IsmMarketProviderAdapter = {
      id: 'eodhd',
      fetchHistoricalDaily: vi
        .fn()
        .mockResolvedValueOnce({ outcome: 'failed', data: null, reason: 'net', meta: metaBase('daily') })
        .mockResolvedValueOnce(okBars('MMM.US')),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const alpha: IsmMarketProviderAdapter = {
      id: 'alpha_vantage',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const ms: IsmMarketProviderAdapter = {
      id: 'marketstack',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const fh: IsmMarketProviderAdapter = {
      id: 'finnhub',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const pools = new Map([
      ['eodhd', new ProviderKeyPool('eodhd', parseKeyPool('k1,k2'))],
      ['alpha_vantage', new ProviderKeyPool('alpha_vantage', [])],
      ['marketstack', new ProviderKeyPool('marketstack', [])],
      ['finnhub', new ProviderKeyPool('finnhub', [])],
    ]);
    const res = await fetchIsmHistoricalDailyWithFallback(
      ctx,
      '2024-01-01',
      '2024-01-31',
      'daily',
      pools,
      { eodhd, alpha_vantage: alpha, marketstack: ms, finnhub: fh }
    );
    expect(res.outcome).toBe('valid');
    expect(eodhd.fetchHistoricalDaily).toHaveBeenCalledTimes(2);
    expect(res.meta.lastSuccess?.keyIndex).toBe(1);
  });

  it('withPreferredFirst resumes eodhd when resume meta matches chain', async () => {
    const eodhd: IsmMarketProviderAdapter = {
      id: 'eodhd',
      fetchHistoricalDaily: vi.fn().mockResolvedValue(okBars('MMM.US')),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const alpha: IsmMarketProviderAdapter = {
      id: 'alpha_vantage',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const ms: IsmMarketProviderAdapter = {
      id: 'marketstack',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const fh: IsmMarketProviderAdapter = {
      id: 'finnhub',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const pools = new Map([
      ['eodhd', new ProviderKeyPool('eodhd', parseKeyPool('k1'))],
      ['alpha_vantage', new ProviderKeyPool('alpha_vantage', parseKeyPool('a1'))],
      ['marketstack', new ProviderKeyPool('marketstack', [])],
      ['finnhub', new ProviderKeyPool('finnhub', [])],
    ]);
    const res = await fetchIsmHistoricalDailyWithFallback(
      ctx,
      '2024-01-01',
      '2024-01-31',
      'daily',
      pools,
      { eodhd, alpha_vantage: alpha, marketstack: ms, finnhub: fh },
      undefined,
      { resume: { providerId: 'eodhd', keyIndex: 0, keyFingerprint: '…test' } }
    );
    expect(res.outcome).toBe('valid');
    expect(eodhd.fetchHistoricalDaily).toHaveBeenCalledTimes(1);
    expect(alpha.fetchHistoricalDaily).not.toHaveBeenCalled();
  });
});

describe('fetchIsmUsdFxRatesWithFallback', () => {
  it('ISM FX chain is EODHD-only: no fallback after eodhd invalid', async () => {
    const eodhd: IsmMarketProviderAdapter = {
      id: 'eodhd',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn().mockResolvedValue({
        outcome: 'invalid',
        data: null,
        reason: 'fx_insufficient_pairs',
        meta: metaBase('daily'),
      }),
    };
    const alpha: IsmMarketProviderAdapter = {
      id: 'alpha_vantage',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn().mockResolvedValue(
        withSuccessMeta(metaBase('daily'), 'alpha_vantage', 0, 'b', 'USD', { USD: 1, SEK: 10 })
      ),
    };
    const ms: IsmMarketProviderAdapter = {
      id: 'marketstack',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const fh: IsmMarketProviderAdapter = {
      id: 'finnhub',
      fetchHistoricalDaily: vi.fn(),
      fetchLatestDailyClose: vi.fn(),
      fetchUsdFxRates: vi.fn(),
    };
    const pools = new Map([
      ['eodhd', new ProviderKeyPool('eodhd', ['a'])],
      ['alpha_vantage', new ProviderKeyPool('alpha_vantage', ['b'])],
      ['marketstack', new ProviderKeyPool('marketstack', ['ignored'])],
      ['finnhub', new ProviderKeyPool('finnhub', ['c'])],
    ]);
    const res = await fetchIsmUsdFxRatesWithFallback('daily', pools, {
      eodhd,
      alpha_vantage: alpha,
      marketstack: ms,
      finnhub: fh,
    });
    expect(res.outcome).toBe('invalid');
    expect(alpha.fetchUsdFxRates).not.toHaveBeenCalled();
    expect(fh.fetchUsdFxRates).not.toHaveBeenCalled();
  });
});
