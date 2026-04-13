import { ISM_FULL_COVERAGE_TARGET } from '../../../config/ismPostureDefaults';
import { ISM_SECTOR_REBALANCE_SCHEMA_VERSION } from '../../../types/ismSectorRebalanceSnapshot';

const SYNTHETIC_SHARE_BASE = 1_000_000;

export type RebalanceValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateSectorRebalanceSnapshot(data: Record<string, unknown>): RebalanceValidationResult {
  const errors: string[] = [];
  if (data.ism_sector_rebalance_schema_version !== ISM_SECTOR_REBALANCE_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  if (typeof data.sector_id !== 'string' || !data.sector_id) errors.push('sector_id');
  if (typeof data.rebalance_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.rebalance_date)) {
    errors.push('rebalance_date');
  }
  if (typeof data.rebalance_timestamp !== 'number') errors.push('rebalance_timestamp');
  const cons = data.constituents;
  if (!Array.isArray(cons)) errors.push('constituents');
  else {
    if (cons.length === 0) errors.push('constituents_empty');
    if (cons.length > ISM_FULL_COVERAGE_TARGET) errors.push('constituents_max');
    let sumShares = 0;
    let sumUsd = 0;
    for (const c of cons) {
      if (!c || typeof c !== 'object') {
        errors.push('constituent_shape');
        break;
      }
      const row = c as Record<string, unknown>;
      if (typeof row.symbol_id !== 'string') errors.push('symbol_id');
      if (typeof row.market_cap_usd !== 'number' || row.market_cap_usd <= 0) errors.push('market_cap_usd');
      if (typeof row.synthetic_shares !== 'number' || row.synthetic_shares < 0) errors.push('synthetic_shares');
      sumShares += (row.synthetic_shares as number) ?? 0;
      sumUsd += (row.market_cap_usd as number) ?? 0;
    }
    if (sumUsd <= 0) errors.push('sum_market_cap_usd');
    if (Math.abs(sumShares - SYNTHETIC_SHARE_BASE) > 1) errors.push('synthetic_shares_sum');
  }
  if (typeof data.new_divisor !== 'number' || !Number.isFinite(data.new_divisor) || (data.new_divisor as number) <= 0) {
    errors.push('new_divisor');
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
