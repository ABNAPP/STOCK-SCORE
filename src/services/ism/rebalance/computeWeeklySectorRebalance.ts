import {
  ISM_BREADTH_THRESHOLD_DEFAULT,
  ISM_FULL_COVERAGE_TARGET,
  ISM_RS_MA_LENGTH_DEFAULT,
  ISM_SECTOR_SMA_LENGTH_DEFAULT,
  ISM_SLOPE_LOOKBACK_DEFAULT,
} from '../../../config/ismPostureDefaults';
import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import {
  ISM_SECTOR_REBALANCE_SCHEMA_VERSION,
  type IsmSectorRebalanceConstituent,
} from '../../../types/ismSectorRebalanceSnapshot';
import type { IsmFetchEngineState, IsmSymbolFetchState } from '../fetchEngine/types';
import { computeIsmRebalanceRowMetrics } from './ismRebalanceRowMetrics';
import { ismSectorIdFromName } from './sectorSlug';

const SYNTHETIC_SHARE_BASE = 1_000_000;

export function distributeSyntheticShares(capUsd: number[]): number[] {
  const n = capUsd.length;
  if (n === 0) return [];
  const sum = capUsd.reduce((a, b) => a + b, 0);
  if (sum <= 0) return capUsd.map(() => 0);
  const raw = capUsd.map((c) => (c / sum) * SYNTHETIC_SHARE_BASE);
  const shares = raw.map((r) => Math.floor(r));
  let rem = SYNTHETIC_SHARE_BASE - shares.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f);
  let k = 0;
  while (rem > 0 && order.length > 0) {
    shares[order[k % order.length]!.i] += 1;
    rem--;
    k++;
  }
  return shares;
}

export type RebalanceRowInput = {
  ingest: ISMInstrumentIngest;
  hasEntryExitRow: boolean;
  usdPerUnitLocalCurrency: number | null;
  fetchState: IsmSymbolFetchState | null | undefined;
  latestPriceDateIso?: string | null;
};

export type PreviousSectorRebalanceMeta = {
  new_divisor?: number;
  index_open_post_rebalance_target?: number;
  index_close_pre_rebalance?: number;
  constituents?: Array<{ symbol_id: string; synthetic_shares: number }>;
};

export type ComputeSectorRebalanceParams = {
  sectorName: string;
  rows: RebalanceRowInput[];
  rebalanceDate: string;
  rebalanceTimestampMs: number;
  marketCapSnapshotTimestampMs: number;
  priceSnapshotTimestampMs: number;
  fxSnapshotTimestampMs: number;
  fetchEngineState: IsmFetchEngineState | null;
  previous: PreviousSectorRebalanceMeta | null;
  /** When all top-30 names have a last close, divisor continuity is applied. */
  latestCloseBySymbolId?: Record<string, number | null>;
};

function exclusionBucket(m: ReturnType<typeof computeIsmRebalanceRowMetrics>): string {
  if (m.apiFailure) return 'temporary_api_failure';
  if (!m.identityOk) return 'identity';
  if (!m.currencyReady) return 'currency_or_fx';
  if (!m.capOk) return 'market_cap';
  if (!m.hasPriceSignal) return 'missing_price_data';
  if (!m.hasSufficientHistory) return 'insufficient_history';
  if (m.needsReview) return m.needsReviewReasonCodes[0] ?? 'needs_review';
  return 'other';
}

/**
 * Pure sector snapshot for one rebalance date (no I/O). Uses same cap/FX/qualification path as symbol docs.
 */
export function computeSectorRebalanceSnapshot(
  p: ComputeSectorRebalanceParams
): Record<string, unknown> {
  const sectorId = ismSectorIdFromName(p.sectorName);
  const metrics = p.rows.map((r) => ({
    row: r,
    m: computeIsmRebalanceRowMetrics({
      ingest: r.ingest,
      hasEntryExitRow: r.hasEntryExitRow,
      usdPerUnitLocalCurrency: r.usdPerUnitLocalCurrency,
      fetchState: r.fetchState,
      latestPriceDateIso: r.latestPriceDateIso,
    }),
  }));

  const qualified = metrics.filter((x) => x.m.qualified);
  const ranked = [...qualified].sort((a, b) => (b.m.marketCapUsd ?? 0) - (a.m.marketCapUsd ?? 0));
  const top = ranked.slice(0, ISM_FULL_COVERAGE_TARGET);
  const capUsd = top.map((t) => t.m.marketCapUsd ?? 0);
  const shares = distributeSyntheticShares(capUsd);

  const constituents: IsmSectorRebalanceConstituent[] = top.map((t, i) => ({
    symbol_id: t.row.ingest.symbolId,
    ticker_raw: t.row.ingest.tickerRaw,
    company_name: t.row.ingest.companyName,
    market_cap_local: t.m.marketCapLocal ?? 0,
    local_currency: t.m.currencyTrimmed,
    market_cap_usd: t.m.marketCapUsd ?? 0,
    synthetic_shares: shares[i] ?? 0,
    rank: i + 1,
    last_close: p.latestCloseBySymbolId?.[t.row.ingest.symbolId] ?? null,
  }));

  const topSet = new Set(top.map((t) => t.row.ingest.symbolId));
  const exclusionCounts = new Map<string, number>();
  for (const { row, m } of metrics) {
    if (topSet.has(row.ingest.symbolId)) continue;
    const key = exclusionBucket(m);
    exclusionCounts.set(key, (exclusionCounts.get(key) ?? 0) + 1);
  }
  const top_exclusion_reasons = [...exclusionCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const added_symbols = top.map((t) => t.row.ingest.symbolId);
  const prevSet = new Set((p.previous?.constituents ?? []).map((c) => c.symbol_id));
  const unchanged_symbols = added_symbols.filter((id) => prevSet.has(id));
  const removed_symbols = [...prevSet].filter((id) => !topSet.has(id));
  const added_only = added_symbols.filter((id) => !prevSet.has(id));

  const previousDivisor = p.previous?.new_divisor ?? 1;
  const indexClosePre =
    p.previous?.index_open_post_rebalance_target ??
    p.previous?.index_close_pre_rebalance ??
    100;

  let newDivisor = previousDivisor;
  let divisorAdjustmentApplied = false;
  let indexOpenPost = indexClosePre;

  const prices = constituents.map((c) => p.latestCloseBySymbolId?.[c.symbol_id]);
  const haveAllPrices = prices.every((x) => x != null && Number.isFinite(x) && (x as number) > 0);

  let oldNumerator = 0;
  for (const oc of p.previous?.constituents ?? []) {
    const px = p.latestCloseBySymbolId?.[oc.symbol_id];
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    oldNumerator += oc.synthetic_shares * px;
  }
  let newNumerator = 0;
  for (const c of constituents) {
    const px = p.latestCloseBySymbolId?.[c.symbol_id];
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    newNumerator += c.synthetic_shares * px;
  }
  const haveForDivisor =
    oldNumerator > 0 &&
    newNumerator > 0 &&
    (p.previous?.constituents?.length ?? 0) > 0 &&
    constituents.length > 0;

  if (haveForDivisor) {
    const oldLevel = oldNumerator / previousDivisor;
    if (oldLevel > 0) {
      newDivisor = newNumerator / oldLevel;
      divisorAdjustmentApplied = true;
      indexOpenPost = newNumerator / newDivisor;
    }
  }

  return {
    ism_sector_rebalance_schema_version: ISM_SECTOR_REBALANCE_SCHEMA_VERSION,
    sector_id: sectorId,
    sector_name: p.sectorName,
    rebalance_date: p.rebalanceDate,
    rebalance_timestamp: p.rebalanceTimestampMs,
    benchmark: 'ism_sector_cap_weighted_v1',
    market_cap_source: 'dashboard_scoreboard',
    currency_source: 'entiry_exit',
    price_source: haveAllPrices ? 'ism_price_feed' : 'not_configured',
    fx_source: 'app_cache_currency_rates_usd',
    slope_lookback: ISM_SLOPE_LOOKBACK_DEFAULT,
    sector_sma_length: ISM_SECTOR_SMA_LENGTH_DEFAULT,
    rs_ma_length: ISM_RS_MA_LENGTH_DEFAULT,
    breadth_threshold: ISM_BREADTH_THRESHOLD_DEFAULT,
    max_constituents: ISM_FULL_COVERAGE_TARGET,
    total_candidates: p.rows.length,
    qualified_count: qualified.length,
    excluded_count: p.rows.length - top.length,
    needs_review_count: metrics.filter((x) => x.m.needsReview).length,
    market_cap_snapshot_timestamp: p.marketCapSnapshotTimestampMs,
    price_snapshot_timestamp: p.priceSnapshotTimestampMs,
    fx_snapshot_timestamp: p.fxSnapshotTimestampMs,
    previous_divisor: previousDivisor,
    new_divisor: newDivisor,
    divisor_adjustment_applied: divisorAdjustmentApplied,
    index_close_pre_rebalance: indexClosePre,
    index_open_post_rebalance_target: indexOpenPost,
    constituents,
    added_symbols: added_only,
    removed_symbols,
    unchanged_symbols,
    top_exclusion_reasons,
    notes: divisorAdjustmentApplied
      ? 'Divisor adjusted using prior constituents and last closes.'
      : 'Divisor unchanged: missing overlapping closes or first run.',
    is_active: false,
    snapshot_valid: false,
  };
}
