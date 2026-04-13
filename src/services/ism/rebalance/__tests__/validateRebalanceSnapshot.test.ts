import { describe, it, expect } from 'vitest';
import { validateSectorRebalanceSnapshot } from '../validateRebalanceSnapshot';

describe('validateSectorRebalanceSnapshot', () => {
  it('accepts a minimal valid snapshot', () => {
    const snap = {
      ism_sector_rebalance_schema_version: 1,
      sector_id: 'tech',
      rebalance_date: '2026-04-10',
      rebalance_timestamp: 1,
      constituents: [
        {
          symbol_id: 'a',
          ticker_raw: 'A',
          company_name: 'A',
          market_cap_local: 100,
          local_currency: 'USD',
          market_cap_usd: 100,
          synthetic_shares: 1_000_000,
          rank: 1,
        },
      ],
      new_divisor: 1,
    };
    expect(validateSectorRebalanceSnapshot(snap as Record<string, unknown>)).toEqual({ ok: true });
  });

  it('rejects bad schema', () => {
    const r = validateSectorRebalanceSnapshot({} as Record<string, unknown>);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });
});
