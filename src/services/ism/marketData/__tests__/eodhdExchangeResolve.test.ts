import { describe, it, expect } from 'vitest';
import { eodhdSymbolFromIsmSlugs } from '../eodhdExchangeResolve';

describe('eodhdSymbolFromIsmSlugs', () => {
  it('defaults unknown exchange to US', () => {
    const r = eodhdSymbolFromIsmSlugs('aapl', 'unknown');
    expect(r.symbol).toBe('AAPL.US');
    expect(r.notes).toContain('eodhd_default_us_suffix');
  });

  it('maps Yahoo-style Paris slug epa to PA', () => {
    const r = eodhdSymbolFromIsmSlugs('mc', 'epa');
    expect(r.symbol).toBe('MC.PA');
    expect(r.notes).toContain('eodhd_slug_alias');
  });

  it('maps London lon to LSE', () => {
    const r = eodhdSymbolFromIsmSlugs('bab', 'lon');
    expect(r.symbol).toBe('BAB.LSE');
  });

  it('maps Amsterdam ams to AS', () => {
    const r = eodhdSymbolFromIsmSlugs('akza', 'ams');
    expect(r.symbol).toBe('AKZA.AS');
  });

  it('accepts canonical slugs already equal to EODHD Code (e.g. pa)', () => {
    const r = eodhdSymbolFromIsmSlugs('mc', 'pa');
    expect(r.symbol).toBe('MC.PA');
  });

  it('maps Vienna vie to VI', () => {
    const r = eodhdSymbolFromIsmSlugs('fdj', 'vie');
    expect(r.symbol).toBe('FDJ.VI');
  });
});
