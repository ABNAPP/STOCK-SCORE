/**
 * Shared read path for official `sector_index_daily` documents (no motor).
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { IsmOverviewSectorRow } from '../../../types/ismSectorOverview';
import type { ISMAllowedSizing, ISMRegime, ISMSectorCoverageStatus } from '../../../types/ismPosturePositioning';
import { ISM_SECTOR_INDEX_DAILY_COLLECTION, ismSectorDailyDocId } from './ismDailySectorFirestorePersistence';
import { addCalendarDays, isoTodayUtc } from '../fetchEngine/dateUtils';

export const SECTOR_INDEX_DAILY_LOOKBACK_DAYS = 14;

/** Full parsed official daily doc used by overview + detail. */
export type ParsedSectorIndexDaily = {
  trade_date: string | null;
  sector_id: string | null;
  benchmark: string | null;
  coverage_status: ISMSectorCoverageStatus | null;
  regime: ISMRegime | null;
  allowed_sizing: ISMAllowedSizing | null;
  status_note: string | null;
  index_value: number | null;
  index_base_100: number | null;
  constituent_count_active: number | null;
  sector_sma_200: number | null;
  sector_above_sma_200: boolean | null;
  sector_sma_200_rising: boolean | null;
  rs_value: number | null;
  rs_ma_252: number | null;
  rs_above_rs_ma_252: boolean | null;
  rs_ma_252_rising: boolean | null;
  histogram_value: number | null;
  histogram_positive: boolean | null;
  weighted_breadth_pct: number | null;
  weighted_breadth_threshold: number | null;
  breadth_confirmed: boolean | null;
  breadth_constituents_yes_count: number | null;
  breadth_constituents_no_count: number | null;
  qualified_count: number | null;
  excluded_count: number | null;
  needs_review_count: number | null;
  computed_at: number | null;
  price_snapshot_timestamp: number | null;
  fx_snapshot_timestamp: number | null;
  active_rebalance_date: string | null;
  active_rebalance_timestamp: number | null;
};

function num(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function int(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
}

function bool(data: Record<string, unknown>, key: string): boolean | null {
  const v = data[key];
  return typeof v === 'boolean' ? v : null;
}

function str(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  return typeof v === 'string' ? v : null;
}

export function parseSectorIndexDailyDocument(data: Record<string, unknown>): ParsedSectorIndexDaily | null {
  const coverage = data.coverage_status;
  const regime = data.regime;
  const allowed = data.allowed_sizing;
  return {
    trade_date: str(data, 'trade_date'),
    sector_id: str(data, 'sector_id'),
    benchmark: str(data, 'benchmark'),
    coverage_status:
      coverage === 'data_building' || coverage === 'limited' || coverage === 'full' ? coverage : null,
    regime:
      regime === 'strong' || regime === 'transition' || regime === 'weak' || regime === 'not_available'
        ? regime
        : null,
    allowed_sizing:
      allowed === 'core_allowed' || allowed === 'probe_only' || allowed === 'no_new_buys' ? allowed : null,
    status_note: str(data, 'status_note'),
    index_value: num(data, 'index_value'),
    index_base_100: num(data, 'index_base_100'),
    constituent_count_active: int(data, 'constituent_count_active'),
    sector_sma_200: num(data, 'sector_sma_200'),
    sector_above_sma_200: bool(data, 'sector_above_sma_200'),
    sector_sma_200_rising: bool(data, 'sector_sma_200_rising'),
    rs_value: num(data, 'rs_value'),
    rs_ma_252: num(data, 'rs_ma_252'),
    rs_above_rs_ma_252: bool(data, 'rs_above_rs_ma_252'),
    rs_ma_252_rising: bool(data, 'rs_ma_252_rising'),
    histogram_value: num(data, 'histogram_value'),
    histogram_positive: bool(data, 'histogram_positive'),
    weighted_breadth_pct: num(data, 'weighted_breadth_pct'),
    weighted_breadth_threshold: num(data, 'weighted_breadth_threshold'),
    breadth_confirmed: bool(data, 'breadth_confirmed'),
    breadth_constituents_yes_count: int(data, 'breadth_constituents_yes_count'),
    breadth_constituents_no_count: int(data, 'breadth_constituents_no_count'),
    qualified_count: int(data, 'qualified_count'),
    excluded_count: int(data, 'excluded_count'),
    needs_review_count: int(data, 'needs_review_count'),
    computed_at: typeof data.computed_at === 'number' ? data.computed_at : null,
    price_snapshot_timestamp: typeof data.price_snapshot_timestamp === 'number' ? data.price_snapshot_timestamp : null,
    fx_snapshot_timestamp: typeof data.fx_snapshot_timestamp === 'number' ? data.fx_snapshot_timestamp : null,
    active_rebalance_date: str(data, 'active_rebalance_date'),
    active_rebalance_timestamp:
      typeof data.active_rebalance_timestamp === 'number' ? data.active_rebalance_timestamp : null,
  };
}

export function parsedToOverviewRow(
  sectorId: string,
  sectorDisplayName: string,
  hit: { tradeDate: string; data: Record<string, unknown> } | null
): IsmOverviewSectorRow {
  if (!hit) {
    return {
      sectorId,
      sectorDisplayName,
      docTradeDate: null,
      firestoreReady: true,
      missingDailyDoc: true,
      coverage_status: null,
      regime: null,
      weighted_breadth_pct: null,
      breadth_confirmed: null,
      rs_above_rs_ma_252: null,
      rs_ma_252_rising: null,
      sector_above_sma_200: null,
      sector_sma_200_rising: null,
      allowed_sizing: null,
      status_note: null,
      computed_at: null,
      active_rebalance_date: null,
      active_rebalance_timestamp: null,
    };
  }
  const p = parseSectorIndexDailyDocument(hit.data);
  if (!p) {
    return {
      sectorId,
      sectorDisplayName,
      docTradeDate: hit.tradeDate,
      firestoreReady: true,
      missingDailyDoc: true,
      coverage_status: null,
      regime: null,
      weighted_breadth_pct: null,
      breadth_confirmed: null,
      rs_above_rs_ma_252: null,
      rs_ma_252_rising: null,
      sector_above_sma_200: null,
      sector_sma_200_rising: null,
      allowed_sizing: null,
      status_note: null,
      computed_at: null,
      active_rebalance_date: null,
      active_rebalance_timestamp: null,
    };
  }
  return {
    sectorId,
    sectorDisplayName,
    docTradeDate: hit.tradeDate,
    firestoreReady: true,
    missingDailyDoc: false,
    coverage_status: p.coverage_status,
    regime: p.regime,
    weighted_breadth_pct: p.weighted_breadth_pct,
    breadth_confirmed: p.breadth_confirmed,
    rs_above_rs_ma_252: p.rs_above_rs_ma_252,
    rs_ma_252_rising: p.rs_ma_252_rising,
    sector_above_sma_200: p.sector_above_sma_200,
    sector_sma_200_rising: p.sector_sma_200_rising,
    allowed_sizing: p.allowed_sizing,
    status_note: p.status_note,
    computed_at: p.computed_at,
    active_rebalance_date: p.active_rebalance_date,
    active_rebalance_timestamp: p.active_rebalance_timestamp,
  };
}

export async function fetchLatestSectorIndexDailyDoc(
  sectorId: string
): Promise<{ tradeDate: string; data: Record<string, unknown> } | null> {
  let iso = isoTodayUtc();
  for (let i = 0; i < SECTOR_INDEX_DAILY_LOOKBACK_DAYS; i++) {
    const ref = doc(db, ISM_SECTOR_INDEX_DAILY_COLLECTION, ismSectorDailyDocId(sectorId, iso));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      if (data.sector_id === sectorId && data.trade_date === iso) {
        return { tradeDate: iso, data };
      }
    }
    iso = addCalendarDays(iso, -1);
  }
  return null;
}
