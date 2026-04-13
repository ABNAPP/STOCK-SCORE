import { describe, it, expect } from 'vitest';
import type { ISMInstrumentIngest } from '../../../../types/ismIngest';
import { buildIsmSymbolFirestoreDoc } from '../buildIsmSymbolFirestoreDoc';
import type { IsmFetchEngineState, IsmSymbolFetchState } from '../../fetchEngine/types';

function baseIngest(over: Partial<ISMInstrumentIngest> = {}): ISMInstrumentIngest {
  const quality: ISMInstrumentIngest['quality'] = {
    missingTicker: false,
    missingSector: false,
    missingMarketCap: false,
    missingCurrency: false,
    missingDashboardDateOfUpdate: false,
    tickerNeedsReview: false,
    ...over.quality,
  };
  const { quality: _q, readinessHints: _rh, ...rest } = over;
  return {
    tickerRaw: 'AAPL',
    tickerNormalized: 'unknown:aapl',
    symbolId: 'unknown_aapl',
    companyName: 'Apple Inc.',
    sectorIsm: 'Technology',
    marketCap: 3_000_000_000_000,
    dashboardDateOfUpdate: '2024-01-01',
    currency: 'USD',
    readinessHints: over.readinessHints ?? [],
    ...rest,
    quality,
  };
}

describe('buildIsmSymbolFirestoreDoc', () => {
  it('stays detected when ticker missing', () => {
    const doc = buildIsmSymbolFirestoreDoc({
      ingest: baseIngest({ quality: { missingTicker: true } as ISMInstrumentIngest['quality'] }),
      hasEntryExitRow: true,
      usdPerUnitLocalCurrency: 1,
      fetchState: null,
      fetchEngineState: null,
    });
    expect(doc.discovery_status).toBe('detected');
    expect(doc.needs_review_reason_codes).toContain('missing_ticker');
  });

  it('reaches currency_ready only with ENTRY/EXIT row, valid currency, and FX', () => {
    const noRow = buildIsmSymbolFirestoreDoc({
      ingest: baseIngest({ currency: '' }),
      hasEntryExitRow: false,
      usdPerUnitLocalCurrency: null,
      fetchState: null,
      fetchEngineState: null,
    });
    expect(noRow.discovery_status).not.toBe('currency_ready');

    const rowOk = buildIsmSymbolFirestoreDoc({
      ingest: baseIngest({ currency: 'USD' }),
      hasEntryExitRow: true,
      usdPerUnitLocalCurrency: 1,
      fetchState: null,
      fetchEngineState: null,
    });
    expect(rowOk.discovery_status).toBe('currency_ready');
    expect(rowOk.market_cap_currency).toBe('USD');
    expect(rowOk.market_cap_usd).toBeGreaterThan(0);
  });

  it('blocks currency_ready and USD cap when SEK FX is missing', () => {
    const doc = buildIsmSymbolFirestoreDoc({
      ingest: baseIngest({ currency: 'SEK' }),
      hasEntryExitRow: true,
      usdPerUnitLocalCurrency: null,
      fetchState: null,
      fetchEngineState: null,
    });
    expect(doc.discovery_status).not.toBe('currency_ready');
    expect(doc.needs_review_reason_codes).toContain('fx_mapping_missing');
    expect(doc.market_cap_usd).toBeNull();
  });

  it('uses usdBaseRates when explicit per-unit not passed', () => {
    const doc = buildIsmSymbolFirestoreDoc({
      ingest: baseIngest({ currency: 'SEK', marketCap: 100 }),
      hasEntryExitRow: true,
      usdBaseRates: { SEK: 10 },
      fetchState: null,
      fetchEngineState: null,
    });
    expect(doc.discovery_status).toBe('currency_ready');
    expect(doc.market_cap_currency).toBe('SEK');
    expect(doc.market_cap_usd).toBeCloseTo(10);
  });

  it('reaches qualified with history + price signal + top30 inclusion', () => {
    const fetchState: IsmSymbolFetchState = {
      symbolId: 'unknown_aapl',
      historyBootstrapStatus: 'complete',
      historyDaysFetched: 400,
      lastHistoryFetchAttemptAt: 1,
      lastHistoryFetchSuccessAt: 1,
      lastDailyPriceFetchAt: 1,
      priceProviderLastUsed: null,
      priceProviderLastSuccess: null,
      fetchFailureCount: 0,
      historyBootstrapNextChunkEnd: '2020-01-01',
    };
    const engine: IsmFetchEngineState = {
      schemaVersion: 1,
      universeFingerprint: 'x',
      lastSavedAt: 1,
      dailyCallBudgetUsed: 0,
      dailyCallBudgetDay: '2026-01-01',
      bootstrapOrderedSymbolIds: [],
      bootstrapCursor: 0,
      dailyCursor: 0,
      perSymbol: {},
      lastFxFetchAt: Date.now(),
      fxLastSuccess: null,
    };
    const doc = buildIsmSymbolFirestoreDoc({
      ingest: baseIngest(),
      hasEntryExitRow: true,
      usdPerUnitLocalCurrency: 1,
      fetchState,
      fetchEngineState: engine,
      latestPriceDateIso: '2026-04-01',
      top30IncludedSymbolIds: new Set(['unknown_aapl']),
    });
    expect(doc.discovery_status).toBe('qualified');
    expect(doc.has_sufficient_history).toBe(true);
    expect(doc.included_in_latest_rebalance).toBe(true);
    expect(doc.excluded_this_rebalance).toBe(false);
  });

  it('marks not_in_top_30 when qualified but outside set', () => {
    const fetchState: IsmSymbolFetchState = {
      symbolId: 'unknown_aapl',
      historyBootstrapStatus: 'complete',
      historyDaysFetched: 400,
      lastHistoryFetchAttemptAt: 1,
      lastHistoryFetchSuccessAt: 1,
      lastDailyPriceFetchAt: 1,
      priceProviderLastUsed: null,
      priceProviderLastSuccess: null,
      fetchFailureCount: 0,
      historyBootstrapNextChunkEnd: null,
    };
    const doc = buildIsmSymbolFirestoreDoc({
      ingest: baseIngest(),
      hasEntryExitRow: true,
      usdPerUnitLocalCurrency: 1,
      fetchState,
      fetchEngineState: null,
      latestPriceDateIso: '2026-04-01',
      top30IncludedSymbolIds: new Set(['other']),
    });
    expect(doc.discovery_status).toBe('qualified');
    expect(doc.included_in_latest_rebalance).toBe(false);
    expect(doc.excluded_this_rebalance).toBe(true);
    expect(doc.excluded_reason_codes).toContain('not_in_top_30');
  });
});
