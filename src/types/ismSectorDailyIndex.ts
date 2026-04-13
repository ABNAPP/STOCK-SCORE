import type { ISMAllowedSizing, ISMRegime, ISMSectorCoverageStatus } from './ismPosturePositioning';

/** Firestore doc `sector_index_daily/{sectorId}_{tradeDate}` (ISM v1). */
export const ISM_SECTOR_DAILY_SCHEMA_VERSION = 1 as const;

/** Typed view of persisted daily sector row (subset; Firestore may hold extra fields). */
export interface IsmSectorDailyIndexDoc {
  ism_sector_daily_schema_version: typeof ISM_SECTOR_DAILY_SCHEMA_VERSION;
  sector_id: string;
  trade_date: string;
  benchmark: 'SPY';
  index_value: number | null;
  index_base_100: number | null;
  constituent_count_active: number;
  sector_sma_200: number | null;
  sector_above_sma_200: boolean;
  sector_sma_200_rising: boolean;
  rs_value: number | null;
  rs_ma_252: number | null;
  rs_above_rs_ma_252: boolean;
  rs_ma_252_rising: boolean;
  histogram_value: number | null;
  histogram_positive: boolean;
  weighted_breadth_pct: number | null;
  weighted_breadth_threshold: number;
  breadth_confirmed: boolean;
  breadth_constituents_yes_count: number;
  breadth_constituents_no_count: number;
  regime: ISMRegime;
  allowed_sizing: ISMAllowedSizing;
  status_note: string;
  qualified_count: number;
  excluded_count: number;
  needs_review_count: number;
  coverage_status: ISMSectorCoverageStatus;
  computed_at: number;
  updated_at: unknown;
  price_snapshot_timestamp: number | null;
  fx_snapshot_timestamp: number | null;
  active_rebalance_date: string;
  active_rebalance_timestamp: number;
}
