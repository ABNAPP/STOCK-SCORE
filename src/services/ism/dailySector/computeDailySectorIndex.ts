/**
 * Pure daily sector index row from latest active weekly rebalance snapshot + price histories.
 * Uses official defaults (SMA 200, RS MA 252, breadth threshold, slope lookback) from ismPostureDefaults.
 */

import {
  ISM_BREADTH_THRESHOLD_DEFAULT,
  ISM_FULL_COVERAGE_TARGET,
  ISM_MIN_QUALIFIED_FOR_REGIME,
  ISM_RS_MA_LENGTH_DEFAULT,
  ISM_SECTOR_SMA_LENGTH_DEFAULT,
  ISM_SLOPE_LOOKBACK_DEFAULT,
} from '../../../config/ismPostureDefaults';
import type { ISMAllowedSizing, ISMRegime, ISMSectorCoverageStatus } from '../../../types/ismPosturePositioning';
import { ISM_SECTOR_DAILY_SCHEMA_VERSION } from '../../../types/ismSectorDailyIndex';

export type DailySectorConstituent = {
  symbol_id: string;
  synthetic_shares: number;
};

export type ActiveRebalanceSnapshotSlice = {
  sector_id: string;
  rebalance_date: string;
  rebalance_timestamp: number;
  new_divisor: number;
  index_open_post_rebalance_target: number;
  constituents: DailySectorConstituent[];
  price_snapshot_timestamp?: number | null;
  fx_snapshot_timestamp?: number | null;
};

function smaLast(values: number[], length: number): number | null {
  if (values.length < length) return null;
  let s = 0;
  const start = values.length - length;
  for (let i = start; i < values.length; i++) s += values[i]!;
  return s / length;
}

/** Last `length` points simple moving average series (same length as input, null prefix). */
function smaSeries(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  for (let i = length - 1; i < values.length; i++) {
    let s = 0;
    for (let j = i - length + 1; j <= i; j++) s += values[j]!;
    out[i] = s / length;
  }
  return out;
}

function risingAtEnd(series: (number | null)[], lookback: number): boolean {
  const n = series.length;
  if (n < lookback + 1) return false;
  const a = series[n - 1];
  const b = series[n - 1 - lookback];
  return a != null && b != null && a > b;
}

function fallingAtEnd(series: (number | null)[], lookback: number): boolean {
  const n = series.length;
  if (n < lookback + 1) return false;
  const a = series[n - 1];
  const b = series[n - 1 - lookback];
  return a != null && b != null && a < b;
}

export type ComputeDailySectorIndexInput = {
  trade_date: string;
  snapshot: ActiveRebalanceSnapshotSlice;
  /** Latest close per symbol (USD); used for divisor index + floating weights. */
  latestCloseBySymbolId: Record<string, number | null | undefined>;
  /** SPY adjusted close for trade_date (last in array = today). */
  spy_close_history: number[];
  /**
   * Daily official index levels ending with trade_date (same calendar as spy_close_history tail).
   * Caller should append today's index_value after computing chain, or pass full history including today.
   */
  sector_index_history: number[];
  /**
   * Per-constituent close history (oldest first), aligned session calendar; last = trade_date.
   * Used for own SMA200 and 20-day SMA200 slope (breadth eligibility).
   */
  constituent_close_history_by_symbol_id: Record<string, number[]>;
  qualified_count: number;
  excluded_count: number;
  needs_review_count: number;
  /** Reference levels on rebalance session for RS ratio line (typically rebalance-day close / index). */
  reference_sector_index: number;
  reference_spy_close: number;
  computed_at_ms: number;
  price_snapshot_timestamp_ms?: number | null;
  fx_snapshot_timestamp_ms?: number | null;
};

function coverageFromQualified(q: number): ISMSectorCoverageStatus {
  if (q < 10) return 'data_building';
  if (q < ISM_FULL_COVERAGE_TARGET) return 'limited';
  return 'full';
}

function allowedSizingForRegime(r: ISMRegime): ISMAllowedSizing {
  if (r === 'strong') return 'core_allowed';
  if (r === 'weak') return 'no_new_buys';
  if (r === 'not_available') return 'no_new_buys';
  return 'probe_only';
}

function indexNumerator(
  constituents: DailySectorConstituent[],
  prices: Record<string, number | null | undefined>
): { numerator: number; active: number } {
  let num = 0;
  let active = 0;
  for (const c of constituents) {
    const px = prices[c.symbol_id];
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    active += 1;
    num += c.synthetic_shares * px;
  }
  return { numerator: num, active };
}

function floatingWeights(
  constituents: DailySectorConstituent[],
  prices: Record<string, number | null | undefined>
): Map<string, number> {
  const raw = new Map<string, number>();
  let sum = 0;
  for (const c of constituents) {
    const px = prices[c.symbol_id];
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    const w = px * c.synthetic_shares;
    raw.set(c.symbol_id, w);
    sum += w;
  }
  const out = new Map<string, number>();
  if (sum <= 0) return out;
  for (const [id, w] of raw) out.set(id, w / sum);
  return out;
}

export function computeDailySectorIndexRow(input: ComputeDailySectorIndexInput): Record<string, unknown> {
  const snap = input.snapshot;
  const divisor = snap.new_divisor;
  const { numerator, active: constituent_count_active } = indexNumerator(snap.constituents, input.latestCloseBySymbolId);
  const index_value =
    divisor > 0 && numerator > 0 && Number.isFinite(numerator / divisor) ? numerator / divisor : null;

  const ref = snap.index_open_post_rebalance_target;
  const index_base_100 =
    index_value != null && ref > 0 && Number.isFinite(ref) ? (index_value / ref) * 100 : null;

  const sectorHist = input.sector_index_history;
  const sectorSma200 = smaLast(sectorHist, ISM_SECTOR_SMA_LENGTH_DEFAULT);
  const sectorSmaSeries = smaSeries(sectorHist, ISM_SECTOR_SMA_LENGTH_DEFAULT);
  const sector_above_sma_200 =
    index_value != null && sectorSma200 != null ? index_value > sectorSma200 : false;
  const sector_sma_200_rising = risingAtEnd(sectorSmaSeries, ISM_SLOPE_LOOKBACK_DEFAULT);

  const spyHist = input.spy_close_history;
  const spy = spyHist.length > 0 ? spyHist[spyHist.length - 1]! : NaN;
  const rsRefSector = input.reference_sector_index;
  const rsRefSpy = input.reference_spy_close;
  const rs_value =
    index_value != null &&
    Number.isFinite(spy) &&
    spy > 0 &&
    rsRefSector > 0 &&
    rsRefSpy > 0 &&
    index_value > 0
      ? (index_value / rsRefSector) / (spy / rsRefSpy) * 100
      : null;

  const minLen = Math.min(sectorHist.length, spyHist.length);
  const rsSeries: number[] = [];
  const offsetSector = sectorHist.length - minLen;
  const offsetSpy = spyHist.length - minLen;
  for (let i = 0; i < minLen; i++) {
    const si = sectorHist[offsetSector + i]!;
    const pi = spyHist[offsetSpy + i]!;
    if (pi > 0 && si > 0 && rsRefSector > 0 && rsRefSpy > 0) {
      rsSeries.push((si / rsRefSector) / (pi / rsRefSpy) * 100);
    }
  }

  const rs_ma_252 = smaLast(rsSeries, ISM_RS_MA_LENGTH_DEFAULT);
  const rsMaSeries = smaSeries(rsSeries, ISM_RS_MA_LENGTH_DEFAULT);
  const rs_above_rs_ma_252 =
    rs_value != null && rs_ma_252 != null ? rs_value > rs_ma_252 : false;
  const rs_ma_252_rising = risingAtEnd(rsMaSeries, ISM_SLOPE_LOOKBACK_DEFAULT);

  const histogram_value =
    rs_value != null && rs_ma_252 != null ? rs_value - rs_ma_252 : null;
  const histogram_positive = histogram_value != null ? histogram_value > 0 : false;

  const weights = floatingWeights(snap.constituents, input.latestCloseBySymbolId);
  let breadthNum = 0;
  let breadthDen = 0;
  let breadth_yes = 0;
  let breadth_no = 0;
  const look = ISM_SLOPE_LOOKBACK_DEFAULT;
  const smaLen = ISM_SECTOR_SMA_LENGTH_DEFAULT;

  for (const c of snap.constituents) {
    const w = weights.get(c.symbol_id);
    if (w == null || w <= 0) continue;
    const hist = input.constituent_close_history_by_symbol_id[c.symbol_id];
    if (!hist || hist.length < smaLen + look + 1) continue;

    const closes = hist;
    const px = closes[closes.length - 1]!;
    const sma200Series = smaSeries(closes, smaLen);
    const smaNow = sma200Series[closes.length - 1];
    const smaPast = sma200Series[closes.length - 1 - look];
    const priceOk = smaNow != null && px > smaNow;
    const risingOk = smaNow != null && smaPast != null && smaNow > smaPast;
    const yes = priceOk && risingOk;

    breadthDen += w;
    if (yes) breadthNum += w;
    if (yes) breadth_yes += 1;
    else breadth_no += 1;
  }

  const weighted_breadth_pct =
    breadthDen > 0 ? (breadthNum / breadthDen) * 100 : null;
  const weighted_breadth_threshold = ISM_BREADTH_THRESHOLD_DEFAULT;
  const breadth_confirmed =
    weighted_breadth_pct != null && weighted_breadth_pct >= weighted_breadth_threshold;

  const coverage_status = coverageFromQualified(input.qualified_count);

  const canRegime =
    input.qualified_count >= ISM_MIN_QUALIFIED_FOR_REGIME &&
    index_value != null &&
    sectorSma200 != null &&
    rs_value != null &&
    rs_ma_252 != null &&
    weighted_breadth_pct != null &&
    rsMaSeries.some((x) => x != null) &&
    sectorSmaSeries.some((x) => x != null);

  let regime: ISMRegime = 'not_available';
  if (canRegime) {
    const rs_below = rs_value! < rs_ma_252!;
    const rs252_falling = fallingAtEnd(rsMaSeries, ISM_SLOPE_LOOKBACK_DEFAULT);
    const sector_below = index_value! < sectorSma200!;
    const sector_sma_falling = fallingAtEnd(sectorSmaSeries, ISM_SLOPE_LOOKBACK_DEFAULT);

    const weak = (rs_below && rs252_falling) || (sector_below && sector_sma_falling);

    const strong =
      rs_value! > rs_ma_252! &&
      risingAtEnd(rsMaSeries, ISM_SLOPE_LOOKBACK_DEFAULT) &&
      index_value! > sectorSma200! &&
      risingAtEnd(sectorSmaSeries, ISM_SLOPE_LOOKBACK_DEFAULT) &&
      weighted_breadth_pct! >= weighted_breadth_threshold;

    if (strong) regime = 'strong';
    else if (weak) regime = 'weak';
    else regime = 'transition';
  }

  const allowed_sizing = allowedSizingForRegime(regime);

  const statusParts: string[] = [];
  if (index_value == null) statusParts.push('missing_index');
  if (!Number.isFinite(spy) || spy <= 0) statusParts.push('missing_spy');
  if (constituent_count_active < snap.constituents.length) statusParts.push('partial_prices');
  const status_note = statusParts.length ? statusParts.join(';') : 'ok';

  return {
    ism_sector_daily_schema_version: ISM_SECTOR_DAILY_SCHEMA_VERSION,
    sector_id: snap.sector_id,
    trade_date: input.trade_date,
    benchmark: 'SPY',
    index_value,
    index_base_100,
    constituent_count_active,
    sector_sma_200: sectorSma200,
    sector_above_sma_200: sector_above_sma_200,
    sector_sma_200_rising: sector_sma_200_rising,
    rs_value,
    rs_ma_252,
    rs_above_rs_ma_252: rs_above_rs_ma_252,
    rs_ma_252_rising: rs_ma_252_rising,
    histogram_value,
    histogram_positive,
    weighted_breadth_pct,
    weighted_breadth_threshold: weighted_breadth_threshold,
    breadth_confirmed,
    breadth_constituents_yes_count: breadth_yes,
    breadth_constituents_no_count: breadth_no,
    regime,
    allowed_sizing,
    status_note,
    qualified_count: input.qualified_count,
    excluded_count: input.excluded_count,
    needs_review_count: input.needs_review_count,
    coverage_status,
    computed_at: input.computed_at_ms,
    price_snapshot_timestamp: input.price_snapshot_timestamp_ms ?? snap.price_snapshot_timestamp ?? null,
    fx_snapshot_timestamp: input.fx_snapshot_timestamp_ms ?? snap.fx_snapshot_timestamp ?? null,
    active_rebalance_date: snap.rebalance_date,
    active_rebalance_timestamp: snap.rebalance_timestamp,
  };
}

/**
 * Narrow Firestore weekly snapshot to the slice required for daily math (caller validates path).
 */
export function sliceActiveRebalanceFromFirestore(data: Record<string, unknown>): ActiveRebalanceSnapshotSlice | null {
  const sector_id = data.sector_id;
  const rebalance_date = data.rebalance_date;
  const rebalance_timestamp = data.rebalance_timestamp;
  const new_divisor = data.new_divisor;
  const index_open_post_rebalance_target = data.index_open_post_rebalance_target;
  const cons = data.constituents;
  if (typeof sector_id !== 'string' || !sector_id) return null;
  if (typeof rebalance_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rebalance_date)) return null;
  if (typeof rebalance_timestamp !== 'number') return null;
  if (typeof new_divisor !== 'number' || new_divisor <= 0) return null;
  if (typeof index_open_post_rebalance_target !== 'number' || index_open_post_rebalance_target <= 0) return null;
  if (!Array.isArray(cons) || cons.length === 0) return null;
  const constituents: DailySectorConstituent[] = [];
  for (const row of cons) {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    if (typeof r.symbol_id !== 'string' || typeof r.synthetic_shares !== 'number') return null;
    constituents.push({ symbol_id: r.symbol_id, synthetic_shares: r.synthetic_shares });
  }
  return {
    sector_id,
    rebalance_date,
    rebalance_timestamp,
    new_divisor,
    index_open_post_rebalance_target,
    constituents,
    price_snapshot_timestamp: typeof data.price_snapshot_timestamp === 'number' ? data.price_snapshot_timestamp : null,
    fx_snapshot_timestamp: typeof data.fx_snapshot_timestamp === 'number' ? data.fx_snapshot_timestamp : null,
  };
}
