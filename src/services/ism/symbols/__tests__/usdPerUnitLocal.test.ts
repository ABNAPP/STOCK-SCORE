import { describe, it, expect } from 'vitest';
import { usdPerUnitFromUsdBaseRates } from '../usdPerUnitLocal';

describe('usdPerUnitFromUsdBaseRates', () => {
  it('returns 1 for USD', () => {
    expect(usdPerUnitFromUsdBaseRates('USD', { SEK: 10 })).toBe(1);
  });

  it('returns USD per unit from units-per-USD map', () => {
    expect(usdPerUnitFromUsdBaseRates('SEK', { SEK: 10 })).toBeCloseTo(0.1);
  });

  it('returns null when currency missing from map', () => {
    expect(usdPerUnitFromUsdBaseRates('SEK', { EUR: 0.9 })).toBeNull();
  });
});
