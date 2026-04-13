/**
 * ISM market data & FX — shared types (bootstrap vs daily, result tiers, metadata).
 */

/** Request lifecycle: bootstrap = heavier backfill; daily = incremental refresh. */
export type IsmDataRequestMode = 'bootstrap' | 'daily';

export type IsmMarketProviderId = 'eodhd' | 'alpha_vantage' | 'marketstack' | 'finnhub';

export type IsmMarketDataOutcome = 'valid' | 'invalid' | 'failed';

/** One daily OHLCV bar (close-focused for v1). */
export interface IsmDailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IsmProviderAttemptMeta {
  providerId: IsmMarketProviderId;
  /** Index within the provider key pool (0-based). */
  keyIndex: number;
  /** Non-sensitive fingerprint for support logs. */
  keyFingerprint: string;
}

export interface IsmMarketDataMeta {
  requestMode: IsmDataRequestMode;
  /** Provider-native symbol sent on successful call. */
  providerSymbol?: string;
  lastSuccess?: IsmProviderAttemptMeta;
  /** e.g. assumed US listing when exchange unknown */
  translationNotes?: string[];
}

export interface IsmMarketDataResult<T> {
  outcome: IsmMarketDataOutcome;
  data: T | null;
  /** HTTP status, provider message, or internal reason — safe to log. */
  reason?: string;
  meta: IsmMarketDataMeta;
}

export interface SymbolTranslationContext {
  tickerRaw: string;
  /** From ISM ticker parse: `unknown` | `nyse` | `nasdaq` | … */
  exchangeSlug: string;
  /** Normalized symbol segment (slug) without exchange prefix. */
  symbolSlug: string;
}
