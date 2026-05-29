import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import {
  ISM_SYMBOL_DOC_SCHEMA_VERSION,
  type IsmSymbolDiscoveryStatus,
  type IsmSymbolExcludedReasonCode,
  type IsmSymbolFirestoreDoc,
} from '../../../types/ismSymbolDocument';
import type { IsmFetchEngineState, IsmSymbolFetchState } from '../fetchEngine/types';
import { computeIsmRebalanceRowMetrics } from '../rebalance/ismRebalanceRowMetrics';
import { eodSymbolFromTickerRaw } from '../dailySector/eodAdjustedCacheSymbols';

function isoDateFromMillis(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export type BuildIsmSymbolDocParams = {
  ingest: ISMInstrumentIngest;
  /** True when `getEntryExitValue(ticker, companyName)` returned a row (ENTRY/EXIT map). */
  hasEntryExitRow: boolean;
  /**
   * USD per one unit of local currency (same as `getExchangeRate(local, 'USD')`).
   * Omit or pass `null` when unknown (non‑USD then blocks `currency_ready` / `market_cap_usd`).
   */
  usdPerUnitLocalCurrency?: number | null;
  /** Optional map currency → units per 1 USD (cache convention); used when `usdPerUnitLocalCurrency` not set. */
  usdBaseRates?: Record<string, number> | null;
  fetchState: IsmSymbolFetchState | null | undefined;
  fetchEngineState: IsmFetchEngineState | null | undefined;
  /** When OHLC/daily pipeline supplies last bar date for this symbol. */
  latestPriceDateIso?: string | null;
  /** When rebalance slice is known: top-30 qualified symbol ids for inclusion. */
  top30IncludedSymbolIds?: Set<string> | null;
  priceSeriesAnomaly?: boolean;
  instrumentMappingConflict?: boolean;
};

/**
 * Build the canonical `symbols/{symbolId}` body from ingest + ENTRY/EXIT presence + official fetch engine slice.
 */
export function buildIsmSymbolFirestoreDoc(params: BuildIsmSymbolDocParams): Omit<
  IsmSymbolFirestoreDoc,
  'created_at' | 'updated_at'
> {
  const { ingest, hasEntryExitRow, fetchState, fetchEngineState } = params;
  const m = computeIsmRebalanceRowMetrics({
    ingest,
    hasEntryExitRow,
    usdPerUnitLocalCurrency: params.usdPerUnitLocalCurrency,
    usdBaseRates: params.usdBaseRates,
    fetchState,
    latestPriceDateIso: params.latestPriceDateIso,
    priceSeriesAnomaly: params.priceSeriesAnomaly,
    instrumentMappingConflict: params.instrumentMappingConflict,
  });

  const latestFxDate = isoDateFromMillis(fetchEngineState?.lastFxFetchAt ?? null);

  let discoveryStatus: IsmSymbolDiscoveryStatus = 'detected';
  if (m.identityOk) discoveryStatus = 'identity_ready';
  if (m.identityOk && m.currencyReady) discoveryStatus = 'currency_ready';
  if (m.identityOk && m.currencyReady && m.hasPriceSignal) discoveryStatus = 'data_ready';
  if (m.qualified) discoveryStatus = 'qualified';

  const top = params.top30IncludedSymbolIds;
  let includedInLatestRebalance = false;
  let excludedThisRebalance = false;
  const excludedReasonCodes: IsmSymbolExcludedReasonCode[] = [];

  if (top != null) {
    if (m.apiFailure) excludedReasonCodes.push('temporary_api_failure');
    if (m.qualified && !m.apiFailure && top.has(ingest.symbolId)) {
      includedInLatestRebalance = true;
      excludedThisRebalance = false;
    } else if (m.qualified && !m.apiFailure) {
      includedInLatestRebalance = false;
      excludedThisRebalance = true;
      excludedReasonCodes.push('not_in_top_30');
    } else {
      includedInLatestRebalance = false;
      excludedThisRebalance = true;
      if (!m.apiFailure) {
        if (!m.hasPriceSignal) excludedReasonCodes.push('missing_price_data');
        else if (!m.hasSufficientHistory) excludedReasonCodes.push('insufficient_history');
      }
    }
  }

  return {
    ism_symbol_schema_version: ISM_SYMBOL_DOC_SCHEMA_VERSION,
    symbol_id: ingest.symbolId,
    ticker_raw: ingest.tickerRaw,
    ticker_normalized: ingest.tickerNormalized,
    eodhd_symbol: eodSymbolFromTickerRaw(ingest.tickerRaw),
    company_name: ingest.companyName,
    sector: ingest.sectorIsm,
    local_currency: m.currencyTrimmed,
    market_cap_local: m.marketCapLocal,
    market_cap_currency: m.marketCapCurrencyUpper,
    market_cap_usd: m.marketCapUsd,
    discovery_status: discoveryStatus,
    needs_review: m.needsReview,
    needs_review_reason_codes: m.needsReviewReasonCodes,
    excluded_this_rebalance: excludedThisRebalance,
    excluded_reason_codes: excludedReasonCodes,
    history_days_available: m.historyDaysAvailable,
    has_sufficient_history: m.hasSufficientHistory,
    latest_price_date: m.latestPriceDate,
    latest_fx_date: latestFxDate,
    included_in_latest_rebalance: includedInLatestRebalance,
  };
}
