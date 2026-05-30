/**
 * Types for value-insight-be GET /ism/sectors/:sectorId
 */

export type IsmCoverageStatus = 'data_building' | 'limited' | 'full';
export type IsmRegime = 'strong' | 'transition' | 'weak' | 'not_available';
export type IsmAllowedSizing = 'core_allowed' | 'probe_only' | 'no_new_buys';

/** Parsed daily index fields (snake_case, matches Firestore / existing hook types). */
export interface IsmSectorIndexDto {
  trade_date: string | null;
  sector_id: string | null;
  benchmark: string | null;
  coverage_status: IsmCoverageStatus | null;
  regime: IsmRegime | null;
  allowed_sizing: IsmAllowedSizing | null;
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
}

export interface IsmConstituentDto {
  symbol_id: string;
  ticker_raw: string;
  company_name: string;
  rank: number;
  synthetic_shares: number;
  last_close: number | null;
  market_cap_usd: number;
}

export interface IsmSectorRebalanceDto {
  rebalanceDate: string | null;
  rebalanceTimestamp: number | null;
  usingPreviousActiveSnapshot: boolean;
  totalCandidates: number | null;
  marketCapSnapshotTimestamp: number | null;
  addedCount: number | null;
  removedCount: number | null;
  unchangedCount: number | null;
  previousDivisor: number | null;
  newDivisor: number | null;
  divisorAdjustmentApplied: boolean | null;
  topExclusionReasons: Array<{ reason: string; count: number }>;
}

export interface IsmSectorDetailApiResponse {
  sectorId: string;
  sectorName: string | null;
  docTradeDate: string | null;
  missingDailyDoc: boolean;
  index: IsmSectorIndexDto | null;
  constituents: IsmConstituentDto[];
  rebalance: IsmSectorRebalanceDto;
}

export interface IsmSectorApiErrorBody {
  error?: string;
}
