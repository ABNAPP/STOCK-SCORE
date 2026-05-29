/**
 * ISM ingest: official DashBoard sheet row fields + ENTRY/EXIT currency only, keyed by ISM symbolId.
 */

/** Future readiness pipeline — populated from quality flags in v1 prep. */
export const ISM_READINESS_HINTS = {
  TICKER_PARSE_REVIEW: 'ticker_parse_review',
  MISSING_TICKER: 'missing_ticker',
  MISSING_SECTOR: 'missing_sector',
  MISSING_MARKET_CAP: 'missing_market_cap',
  MISSING_CURRENCY: 'missing_currency',
  MISSING_DASHBOARD_DATE: 'missing_dashboard_date',
  /** Reserved for when external price/readiness feeds exist */
  AWAIT_EXTERNAL_READINESS: 'await_external_readiness',
} as const;

export type ISMReadinessHint = (typeof ISM_READINESS_HINTS)[keyof typeof ISM_READINESS_HINTS];

/** Data-quality flags for one ingested instrument (ISM v1). */
export interface ISMIngestQualityFlags {
  missingTicker: boolean;
  missingSector: boolean;
  missingMarketCap: boolean;
  missingCurrency: boolean;
  missingDashboardDateOfUpdate: boolean;
  tickerNeedsReview: boolean;
}

/**
 * One row in the ISM internal universe: DashBoard fields + currency from existing ENTRY/EXIT read path.
 * Primary join identity is {@link symbolId} (from normalized DashBoard ticker).
 */
export interface ISMInstrumentIngest extends Record<string, unknown> {
  /** Ticker exactly as on DashBoard */
  tickerRaw: string;
  tickerNormalized: string;
  symbolId: string;
  companyName: string;
  /** ISM sector label from DashBoard `SECTOR (ISM)` only for snapshot ingest (Industry not used). */
  sectorIsm: string;
  marketCap: number | null;
  /** DashBoard date string — diagnostics only */
  dashboardDateOfUpdate: string | null;
  /** Currency from `EntryExitContext.getFieldValue` (Firestore `entiryExit`), read-only in v1 */
  currency: string;
  quality: ISMIngestQualityFlags;
  /** Non-authoritative hints for a future readiness engine */
  readinessHints: ISMReadinessHint[];
}

export interface ISMIngestSummary {
  rowCount: number;
  withMissingCurrency: number;
  withMissingMarketCap: number;
  withMissingSector: number;
  withTickerNeedsReview: number;
}
