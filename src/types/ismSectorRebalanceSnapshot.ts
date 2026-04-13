/** Firestore doc `sector_rebalances/{sectorId}/snapshots/{rebalanceDate}` (ISM v1). */
export const ISM_SECTOR_REBALANCE_SCHEMA_VERSION = 1 as const;

export interface IsmSectorRebalanceConstituent {
  symbol_id: string;
  ticker_raw: string;
  company_name: string;
  market_cap_local: number;
  local_currency: string;
  market_cap_usd: number;
  synthetic_shares: number;
  rank: number;
  /** Last close used for divisor math when available */
  last_close?: number | null;
}
