import type { ISMAllowedSizing, ISMRegime, ISMSectorCoverageStatus } from './ismPosturePositioning';

/** One sector row for ISM overview / navigation (official Firestore-backed fields only). */
export type IsmOverviewSectorRow = {
  sectorId: string;
  sectorDisplayName: string;
  docTradeDate: string | null;
  firestoreReady: boolean;
  missingDailyDoc: boolean;
  coverage_status: ISMSectorCoverageStatus | null;
  regime: ISMRegime | null;
  weighted_breadth_pct: number | null;
  breadth_confirmed: boolean | null;
  rs_above_rs_ma_252: boolean | null;
  rs_ma_252_rising: boolean | null;
  sector_above_sma_200: boolean | null;
  sector_sma_200_rising: boolean | null;
  allowed_sizing: ISMAllowedSizing | null;
  status_note: string | null;
  computed_at: number | null;
  active_rebalance_date: string | null;
  active_rebalance_timestamp: number | null;
};
