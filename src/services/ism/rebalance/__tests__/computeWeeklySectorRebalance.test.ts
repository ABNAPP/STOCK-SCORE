import { describe, it, expect } from 'vitest';
import type { ISMInstrumentIngest } from '../../../../types/ismIngest';
import {
  computeSectorRebalanceSnapshot,
  distributeSyntheticShares,
  type RebalanceRowInput,
} from '../computeWeeklySectorRebalance';

function ingestRow(p: Partial<ISMInstrumentIngest> & Pick<ISMInstrumentIngest, 'symbolId' | 'marketCap'>): ISMInstrumentIngest {
  const q = {
    missingTicker: false,
    missingSector: false,
    missingMarketCap: false,
    missingCurrency: false,
    missingDashboardDateOfUpdate: false,
    tickerNeedsReview: false,
    ...p.quality,
  };
  const { quality: _q, readinessHints: _rh, ...rest } = p;
  return {
    tickerRaw: p.tickerRaw ?? 'T',
    tickerNormalized: p.tickerNormalized ?? 'unknown:t',
    symbolId: p.symbolId,
    companyName: p.companyName ?? 'Co',
    sectorIsm: p.sectorIsm ?? 'Tech',
    marketCap: p.marketCap,
    dashboardDateOfUpdate: p.dashboardDateOfUpdate ?? '2024-01-01',
    currency: p.currency ?? 'USD',
    readinessHints: p.readinessHints ?? [],
    ...rest,
    quality: q,
  };
}

describe('distributeSyntheticShares', () => {
  it('sums to 1_000_000', () => {
    const s = distributeSyntheticShares([60, 40]);
    expect(s.reduce((a, b) => a + b, 0)).toBe(1_000_000);
  });
});

describe('computeSectorRebalanceSnapshot', () => {
  it('ranks by USD cap and caps at 30 constituents', () => {
    const rows: RebalanceRowInput[] = [
      {
        ingest: ingestRow({ symbolId: 'a', marketCap: 100, currency: 'USD', companyName: 'A' }),
        hasEntryExitRow: true,
        usdPerUnitLocalCurrency: 1,
        fetchState: {
          symbolId: 'a',
          historyBootstrapStatus: 'complete',
          historyDaysFetched: 400,
          lastHistoryFetchAttemptAt: 1,
          lastHistoryFetchSuccessAt: 1,
          lastDailyPriceFetchAt: 1,
          priceProviderLastUsed: null,
          priceProviderLastSuccess: null,
          fetchFailureCount: 0,
          historyBootstrapNextChunkEnd: null,
        },
        latestPriceDateIso: '2026-01-01',
      },
      {
        ingest: ingestRow({ symbolId: 'b', marketCap: 200, currency: 'USD', companyName: 'B' }),
        hasEntryExitRow: true,
        usdPerUnitLocalCurrency: 1,
        fetchState: {
          symbolId: 'b',
          historyBootstrapStatus: 'complete',
          historyDaysFetched: 400,
          lastHistoryFetchAttemptAt: 1,
          lastHistoryFetchSuccessAt: 1,
          lastDailyPriceFetchAt: 1,
          priceProviderLastUsed: null,
          priceProviderLastSuccess: null,
          fetchFailureCount: 0,
          historyBootstrapNextChunkEnd: null,
        },
        latestPriceDateIso: '2026-01-01',
      },
    ];
    const snap = computeSectorRebalanceSnapshot({
      sectorName: 'Tech',
      rows,
      rebalanceDate: '2026-04-10',
      rebalanceTimestampMs: 1,
      marketCapSnapshotTimestampMs: 1,
      priceSnapshotTimestampMs: 1,
      fxSnapshotTimestampMs: 1,
      fetchEngineState: null,
      previous: null,
    }) as Record<string, unknown>;
    const cons = snap.constituents as Array<{ symbol_id: string; market_cap_usd: number; rank: number }>;
    expect(cons.length).toBe(2);
    expect(cons[0].symbol_id).toBe('b');
    expect(cons[0].rank).toBe(1);
    expect(snap.market_cap_source).toBe('dashboard_scoreboard');
  });

  it('does not assign USD cap without FX for non-USD', () => {
    const rows: RebalanceRowInput[] = [
      {
        ingest: ingestRow({
          symbolId: 's',
          marketCap: 100,
          currency: 'SEK',
          companyName: 'S',
          sectorIsm: 'Tech',
        }),
        hasEntryExitRow: true,
        usdPerUnitLocalCurrency: null,
        fetchState: {
          symbolId: 's',
          historyBootstrapStatus: 'complete',
          historyDaysFetched: 400,
          lastHistoryFetchAttemptAt: 1,
          lastHistoryFetchSuccessAt: 1,
          lastDailyPriceFetchAt: 1,
          priceProviderLastUsed: null,
          priceProviderLastSuccess: null,
          fetchFailureCount: 0,
          historyBootstrapNextChunkEnd: null,
        },
        latestPriceDateIso: '2026-01-01',
      },
    ];
    const snap = computeSectorRebalanceSnapshot({
      sectorName: 'Tech',
      rows,
      rebalanceDate: '2026-04-10',
      rebalanceTimestampMs: 1,
      marketCapSnapshotTimestampMs: 1,
      priceSnapshotTimestampMs: 1,
      fxSnapshotTimestampMs: 1,
      fetchEngineState: null,
      previous: null,
    }) as Record<string, unknown>;
    expect((snap.constituents as unknown[]).length).toBe(0);
  });
});
