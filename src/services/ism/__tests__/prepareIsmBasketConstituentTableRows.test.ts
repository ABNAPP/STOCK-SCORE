import { describe, expect, it } from 'vitest';
import { prepareIsmBasketConstituentTableRows } from '../prepareIsmBasketConstituentTableRows';

function isoDay(offset: number): string {
  const d = new Date(Date.UTC(2022, 0, 3 + offset));
  return d.toISOString().slice(0, 10);
}

/** Monotonic rising closes ending at `endClose` (enough bars for SMA). */
function buildRisingCloseMap(len: number, endClose: number): Map<string, number> {
  const m = new Map<string, number>();
  const start = endClose - (len - 1) * 0.5;
  for (let i = 0; i < len; i++) m.set(isoDay(i), start + i * 0.5);
  return m;
}

describe('prepareIsmBasketConstituentTableRows', () => {
  it('sorts by currentWeightPct descending', () => {
    const constituents = [
      { symbol_id: 'a', ticker_raw: 'AAA', company_name: 'A', synthetic_shares: 1_000_000, last_close: 10 },
      { symbol_id: 'b', ticker_raw: 'BBB', company_name: 'B', synthetic_shares: 1_000_000, last_close: 20 },
    ];
    const closeBySymbolId = new Map<string, Map<string, number>>([
      ['a', buildRisingCloseMap(250, 10)],
      ['b', buildRisingCloseMap(250, 20)],
    ]);
    const rows = prepareIsmBasketConstituentTableRows({
      constituents,
      closeBySymbolId,
      localParams: { sectorSmaLength: 20, slopeLookback: 5 },
      selectedSymbolIds: [],
    });
    expect(rows[0]!.symbol_id).toBe('b');
    expect(rows[1]!.symbol_id).toBe('a');
    const sum = (rows[0]!.currentWeightPct ?? 0) + (rows[1]!.currentWeightPct ?? 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it('marks isSelected only for ids in selectedSymbolIds', () => {
    const constituents = [
      { symbol_id: 'x', ticker_raw: 'XXX', company_name: 'X', synthetic_shares: 500_000, last_close: 50 },
      { symbol_id: 'y', ticker_raw: 'YYY', company_name: 'Y', synthetic_shares: 500_000, last_close: 50 },
    ];
    const closeBySymbolId = new Map<string, Map<string, number>>([
      ['x', buildRisingCloseMap(250, 50)],
      ['y', buildRisingCloseMap(250, 50)],
    ]);
    const rows = prepareIsmBasketConstituentTableRows({
      constituents,
      closeBySymbolId,
      localParams: { sectorSmaLength: 20, slopeLookback: 5 },
      selectedSymbolIds: ['y', 'ghost'],
    });
    expect(rows.find((r) => r.symbol_id === 'x')!.isSelected).toBe(false);
    expect(rows.find((r) => r.symbol_id === 'y')!.isSelected).toBe(true);
    expect(rows.some((r) => r.symbol_id === 'ghost')).toBe(false);
  });
});
