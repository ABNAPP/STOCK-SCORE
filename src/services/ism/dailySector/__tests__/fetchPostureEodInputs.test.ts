import { describe, it, expect } from 'vitest';
import {
  ISM_POSTURE_EOD_LOOKBACK_CALENDAR_DAYS,
  postureEodWindowFromTradeDate,
} from '../fetchPostureEodInputs';

describe('fetchPostureEodInputs', () => {
  it('postureEodWindowFromTradeDate spans configured calendar days inclusive', () => {
    const tradeDate = '2026-05-03';
    const { fromIso, toIso } = postureEodWindowFromTradeDate(tradeDate);
    expect(toIso).toBe(tradeDate);
    expect(fromIso < toIso).toBe(true);
    // inclusive span = lookback - 1 delta from trade date to from date
    const from = new Date(`${fromIso}T00:00:00Z`);
    const to = new Date(`${toIso}T00:00:00Z`);
    const diffDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(ISM_POSTURE_EOD_LOOKBACK_CALENDAR_DAYS - 1);
  });
});
