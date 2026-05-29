import { describe, it, expect } from 'vitest';
import { buildEodSymbolUniverseForIsmIngest, eodSymbolFromTickerRaw } from '../eodAdjustedCacheSymbols';

describe('eodAdjustedCacheSymbols', () => {
  it('maps SPY to SPY.US', () => {
    expect(eodSymbolFromTickerRaw('SPY')).toBe('SPY.US');
  });

  it('buildEodSymbolUniverseForIsmIngest dedupes and includes benchmark', () => {
    const u = buildEodSymbolUniverseForIsmIngest([{ tickerRaw: 'AAPL' }, { tickerRaw: 'AAPL' }]);
    expect(u).toContain('SPY.US');
    expect(u).toContain('AAPL.US');
    expect(u.filter((x) => x === 'AAPL.US').length).toBe(1);
  });

  it('maps Yahoo-style exchange prefixes to EODHD codes (lon → LSE)', () => {
    expect(eodSymbolFromTickerRaw('lon:BAB')).toBe('BAB.LSE');
  });
});
