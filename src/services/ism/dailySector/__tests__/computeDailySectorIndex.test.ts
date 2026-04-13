import { describe, it, expect } from 'vitest';
import {
  computeDailySectorIndexRow,
  sliceActiveRebalanceFromFirestore,
} from '../computeDailySectorIndex';
import {
  ISM_FULL_COVERAGE_TARGET,
  ISM_MIN_QUALIFIED_FOR_REGIME,
} from '../../../../config/ismPostureDefaults';

function risingPrices(n: number, start = 100, perDay = 0.08): number[] {
  return Array.from({ length: n }, (_, i) => start + i * perDay);
}

describe('sliceActiveRebalanceFromFirestore', () => {
  it('parses a minimal valid snapshot slice', () => {
    const slice = sliceActiveRebalanceFromFirestore({
      sector_id: 'technology',
      rebalance_date: '2026-04-04',
      rebalance_timestamp: 1_700_000_000_000,
      new_divisor: 1_000_000,
      index_open_post_rebalance_target: 100,
      constituents: [{ symbol_id: 'sym_a', synthetic_shares: 1_000_000 }],
    } as Record<string, unknown>);
    expect(slice?.sector_id).toBe('technology');
    expect(slice?.constituents).toHaveLength(1);
  });

  it('returns null on bad shape', () => {
    expect(sliceActiveRebalanceFromFirestore({ sector_id: '' } as Record<string, unknown>)).toBeNull();
  });
});

describe('computeDailySectorIndexRow', () => {
  const N = 320;
  const symbolId = 'sym_x';
  const prices = risingPrices(N, 100, 0.09);
  const spy = Array(N).fill(100) as number[];
  const sectorHist = [...prices];
  const snap = {
    sector_id: 'technology',
    rebalance_date: '2026-04-04',
    rebalance_timestamp: 1_700_000_000_000,
    new_divisor: 1_000_000,
    index_open_post_rebalance_target: 100,
    constituents: [{ symbol_id: symbolId, synthetic_shares: 1_000_000 }],
    price_snapshot_timestamp: 1,
    fx_snapshot_timestamp: 2,
  };

  it('computes index_value from floating cap weights and divisor', () => {
    const row = computeDailySectorIndexRow({
      trade_date: '2026-04-10',
      snapshot: snap,
      latestCloseBySymbolId: { [symbolId]: prices[N - 1]! },
      spy_close_history: spy,
      sector_index_history: sectorHist,
      constituent_close_history_by_symbol_id: { [symbolId]: prices },
      qualified_count: ISM_MIN_QUALIFIED_FOR_REGIME,
      excluded_count: 0,
      needs_review_count: 0,
      reference_sector_index: prices[0]!,
      reference_spy_close: spy[0]!,
      computed_at_ms: 1,
    }) as Record<string, unknown>;

    expect(row.index_value).toBeCloseTo(prices[N - 1]!, 5);
    expect(row.constituent_count_active).toBe(1);
    expect(row.benchmark).toBe('SPY');
    expect(row.active_rebalance_date).toBe('2026-04-04');
  });

  it('maps coverage_status from qualified_count (official thresholds)', () => {
    const base = {
      trade_date: '2026-04-10',
      snapshot: snap,
      latestCloseBySymbolId: { [symbolId]: prices[N - 1]! },
      spy_close_history: spy,
      sector_index_history: sectorHist,
      constituent_close_history_by_symbol_id: { [symbolId]: prices },
      excluded_count: 0,
      needs_review_count: 0,
      reference_sector_index: prices[0]!,
      reference_spy_close: spy[0]!,
      computed_at_ms: 1,
    };
    expect((computeDailySectorIndexRow({ ...base, qualified_count: 5 }) as { coverage_status: string }).coverage_status).toBe(
      'data_building'
    );
    expect((computeDailySectorIndexRow({ ...base, qualified_count: 15 }) as { coverage_status: string }).coverage_status).toBe(
      'limited'
    );
    expect(
      (computeDailySectorIndexRow({ ...base, qualified_count: ISM_FULL_COVERAGE_TARGET }) as { coverage_status: string })
        .coverage_status
    ).toBe('full');
  });

  it('classifies strong regime when RS, sector SMA, breadth, and slopes align', () => {
    const row = computeDailySectorIndexRow({
      trade_date: '2026-04-10',
      snapshot: snap,
      latestCloseBySymbolId: { [symbolId]: prices[N - 1]! },
      spy_close_history: spy,
      sector_index_history: sectorHist,
      constituent_close_history_by_symbol_id: { [symbolId]: prices },
      qualified_count: ISM_FULL_COVERAGE_TARGET,
      excluded_count: 0,
      needs_review_count: 0,
      reference_sector_index: prices[0]!,
      reference_spy_close: spy[0]!,
      computed_at_ms: 1,
    }) as { regime: string; weighted_breadth_pct: number | null; breadth_confirmed: boolean };

    expect(row.weighted_breadth_pct).toBe(100);
    expect(row.breadth_confirmed).toBe(true);
    expect(row.regime).toBe('strong');
  });

  it('classifies weak when sector is below SMA200 and SMA200 is falling', () => {
    const flat = Array(N - 1).fill(100) as number[];
    const sectorWeak = [...flat, 80];
    const pxWeak = [...risingPrices(N - 1, 100, 0.09), 80];
    const row = computeDailySectorIndexRow({
      trade_date: '2026-04-10',
      snapshot: snap,
      latestCloseBySymbolId: { [symbolId]: pxWeak[N - 1]! },
      spy_close_history: spy,
      sector_index_history: sectorWeak,
      constituent_close_history_by_symbol_id: { [symbolId]: pxWeak },
      qualified_count: ISM_FULL_COVERAGE_TARGET,
      excluded_count: 0,
      needs_review_count: 0,
      reference_sector_index: 100,
      reference_spy_close: 100,
      computed_at_ms: 1,
    }) as { regime: string };
    expect(row.regime).toBe('weak');
  });

  it('uses not_available when qualified_count is below regime minimum', () => {
    const row = computeDailySectorIndexRow({
      trade_date: '2026-04-10',
      snapshot: snap,
      latestCloseBySymbolId: { [symbolId]: prices[N - 1]! },
      spy_close_history: spy,
      sector_index_history: sectorHist,
      constituent_close_history_by_symbol_id: { [symbolId]: prices },
      qualified_count: ISM_MIN_QUALIFIED_FOR_REGIME - 1,
      excluded_count: 0,
      needs_review_count: 0,
      reference_sector_index: prices[0]!,
      reference_spy_close: spy[0]!,
      computed_at_ms: 1,
    }) as { regime: string };
    expect(row.regime).toBe('not_available');
  });
});
