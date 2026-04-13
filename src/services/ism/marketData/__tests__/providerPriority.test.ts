import { describe, it, expect } from 'vitest';
import { withPreferredFirst } from '../providerPriority';

describe('withPreferredFirst', () => {
  it('moves preferred provider to the front', () => {
    const base = ['eodhd', 'alpha_vantage', 'finnhub'] as const;
    expect(withPreferredFirst(base, 'finnhub')).toEqual(['finnhub', 'eodhd', 'alpha_vantage']);
  });

  it('returns a copy of base when preferred is missing', () => {
    const base = ['eodhd', 'alpha_vantage'] as const;
    expect(withPreferredFirst(base, 'marketstack')).toEqual(['eodhd', 'alpha_vantage']);
  });
});
