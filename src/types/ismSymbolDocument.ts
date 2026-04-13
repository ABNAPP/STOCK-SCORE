/**
 * ISM symbol registry: one Firestore doc per `symbols/{symbolId}` (ISM-owned via schema version).
 * Field names follow the persisted snake_case contract.
 */

export const ISM_SYMBOL_DOC_SCHEMA_VERSION = 1 as const;

/** Readiness ladder for ISM inclusion pipeline. */
export type IsmSymbolDiscoveryStatus =
  | 'detected'
  | 'identity_ready'
  | 'currency_ready'
  | 'data_ready'
  | 'qualified';

/** Needs human or system review — orthogonal to discovery ladder. */
export type IsmSymbolNeedsReviewReasonCode =
  | 'missing_ticker'
  | 'invalid_ticker'
  | 'instrument_mapping_conflict'
  | 'missing_currency'
  | 'invalid_market_cap'
  | 'fx_mapping_missing'
  | 'price_series_anomaly';

export type IsmSymbolExcludedReasonCode =
  | 'not_in_top_30'
  | 'insufficient_history'
  | 'missing_price_data'
  | 'temporary_api_failure';

/** Minimum “history length” gate (v1 uses fetch-engine calendar coverage as proxy until OHLC bar counts exist). */
export const ISM_MIN_HISTORY_DAYS_FOR_QUALIFIED = 300;

/**
 * Payload written to `symbols/{symbolId}` (snake_case keys — Firestore document body).
 */
export interface IsmSymbolFirestoreDoc {
  ism_symbol_schema_version: typeof ISM_SYMBOL_DOC_SCHEMA_VERSION;
  symbol_id: string;
  ticker_raw: string;
  ticker_normalized: string;
  company_name: string;
  sector: string;
  /** ENTRY/EXIT listing currency (trimmed). */
  local_currency: string;
  /** Market cap figure from DashBoard (denominated in listing currency once that is known). */
  market_cap_local: number | null;
  /** ISO code for the cap’s denomination — same as local currency when cap exists and currency is valid. */
  market_cap_currency: string | null;
  /** Cap converted to USD only when local currency is valid and FX to USD exists. */
  market_cap_usd: number | null;
  discovery_status: IsmSymbolDiscoveryStatus;
  needs_review: boolean;
  needs_review_reason_codes: IsmSymbolNeedsReviewReasonCode[];
  excluded_this_rebalance: boolean;
  excluded_reason_codes: IsmSymbolExcludedReasonCode[];
  history_days_available: number;
  has_sufficient_history: boolean;
  latest_price_date: string | null;
  latest_fx_date: string | null;
  included_in_latest_rebalance: boolean;
  created_at: unknown;
  updated_at: unknown;
}
