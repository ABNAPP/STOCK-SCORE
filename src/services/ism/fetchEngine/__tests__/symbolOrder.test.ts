import { describe, it, expect } from 'vitest';
import type { ISMInstrumentIngest } from '../../../../types/ismIngest';
import { computeBootstrapSymbolOrder } from '../symbolOrder';

function row(partial: Partial<ISMInstrumentIngest> & Pick<ISMInstrumentIngest, 'symbolId'>): ISMInstrumentIngest {
  const baseQ = {
    missingTicker: false,
    missingSector: false,
    missingMarketCap: false,
    missingCurrency: false,
    missingDashboardDateOfUpdate: false,
    tickerNeedsReview: false,
  };
  const q = { ...baseQ, ...partial.quality };
  return {
    tickerRaw: partial.tickerRaw ?? 'X',
    tickerNormalized: partial.tickerNormalized ?? 'x',
    symbolId: partial.symbolId,
    companyName: partial.companyName ?? 'Co',
    sectorIsm: partial.sectorIsm ?? 'Sec',
    marketCap: partial.marketCap ?? null,
    dashboardDateOfUpdate: partial.dashboardDateOfUpdate ?? null,
    currency: partial.currency ?? 'USD',
    quality: q,
    readinessHints: partial.readinessHints ?? [],
  };
}

describe('computeBootstrapSymbolOrder', () => {
  it('orders finite market cap descending in top band, then qualified rest, then problem rows', () => {
    const rows: ISMInstrumentIngest[] = [
      row({
        symbolId: 'low',
        marketCap: null,
        quality: { missingTicker: true, missingSector: false, missingMarketCap: true, missingCurrency: false, missingDashboardDateOfUpdate: false, tickerNeedsReview: false },
      }),
      row({ symbolId: 'big', marketCap: 500e9 }),
      row({
        symbolId: 'mid_problem',
        marketCap: 50e9,
        quality: { missingTicker: false, missingSector: true, missingMarketCap: false, missingCurrency: false, missingDashboardDateOfUpdate: false, tickerNeedsReview: false },
      }),
      row({ symbolId: 'mid_ok', marketCap: 40e9 }),
    ];
    const { orderedSymbolIds } = computeBootstrapSymbolOrder(rows);
    expect(orderedSymbolIds[0]).toBe('big');
    expect(orderedSymbolIds[1]).toBe('mid_problem');
    expect(orderedSymbolIds[2]).toBe('mid_ok');
    expect(orderedSymbolIds[3]).toBe('low');
  });
});
