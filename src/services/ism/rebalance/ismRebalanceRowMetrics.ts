/**
 * Shared ISM row metrics for symbol Firestore docs and weekly rebalance ranking.
 * Single source for DashBoard cap × ENTRY/EXIT currency × FX → USD (no default USD cap).
 */

import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import {
  ISM_MIN_HISTORY_DAYS_FOR_QUALIFIED,
  type IsmSymbolNeedsReviewReasonCode,
} from '../../../types/ismSymbolDocument';
import type { IsmSymbolFetchState } from '../fetchEngine/types';
import { validateEntryExitValue } from '../../../utils/inputValidator';
import { usdPerUnitFromUsdBaseRates } from '../symbols/usdPerUnitLocal';

export function hasPriceDataSignal(
  latestPriceDateIso: string | null | undefined,
  fetchState: IsmSymbolFetchState | null | undefined
): boolean {
  if (latestPriceDateIso && /^\d{4}-\d{2}-\d{2}$/.test(latestPriceDateIso)) return true;
  if (!fetchState) return false;
  if ((fetchState.historyDaysFetched ?? 0) > 0) return true;
  if (fetchState.lastDailyPriceFetchAt != null) return true;
  if (fetchState.lastHistoryFetchSuccessAt != null) return true;
  return false;
}

function isValidListedCurrency(code: string): boolean {
  const t = code.trim();
  if (!t) return false;
  return validateEntryExitValue('currency', t).isValid;
}

function buildNeedsReviewReasonCodes(
  ingest: ISMInstrumentIngest,
  hasEntryExitRow: boolean,
  currencyTrimmed: string,
  priceSeriesAnomaly: boolean,
  instrumentMappingConflict: boolean,
  fxUsdPerUnitResolved: number | null
): IsmSymbolNeedsReviewReasonCode[] {
  const codes: IsmSymbolNeedsReviewReasonCode[] = [];
  const q = ingest.quality;

  if (q.missingTicker) codes.push('missing_ticker');
  else if (q.tickerNeedsReview) codes.push('invalid_ticker');

  if (q.missingMarketCap) codes.push('invalid_market_cap');

  if (q.missingSector) codes.push('instrument_mapping_conflict');

  if (!hasEntryExitRow || currencyTrimmed.length === 0) {
    codes.push('missing_currency');
  } else if (!isValidListedCurrency(currencyTrimmed)) {
    codes.push('fx_mapping_missing');
  } else if (fxUsdPerUnitResolved === null) {
    codes.push('fx_mapping_missing');
  }

  if (instrumentMappingConflict) codes.push('instrument_mapping_conflict');
  if (priceSeriesAnomaly) codes.push('price_series_anomaly');

  return [...new Set(codes)];
}

export type IsmRebalanceRowMetricsInput = {
  ingest: ISMInstrumentIngest;
  hasEntryExitRow: boolean;
  usdPerUnitLocalCurrency?: number | null;
  usdBaseRates?: Record<string, number> | null;
  fetchState: IsmSymbolFetchState | null | undefined;
  latestPriceDateIso?: string | null;
  priceSeriesAnomaly?: boolean;
  instrumentMappingConflict?: boolean;
};

export type IsmRebalanceRowMetrics = {
  currencyTrimmed: string;
  identityOk: boolean;
  listedCurrencyOk: boolean;
  fxUsdPerUnit: number | null;
  currencyReady: boolean;
  capOk: boolean;
  marketCapUsd: number | null;
  marketCapCurrencyUpper: string | null;
  marketCapLocal: number | null;
  hasPriceSignal: boolean;
  hasSufficientHistory: boolean;
  historyDaysAvailable: number;
  latestPriceDate: string | null;
  needsReviewReasonCodes: IsmSymbolNeedsReviewReasonCode[];
  needsReview: boolean;
  apiFailure: boolean;
  /** Same gates as symbol `qualified` for ranking / top-30. */
  qualified: boolean;
};

export function computeIsmRebalanceRowMetrics(input: IsmRebalanceRowMetricsInput): IsmRebalanceRowMetrics {
  const { ingest, hasEntryExitRow, fetchState } = input;
  const currencyTrimmed = ingest.currency.trim();
  const cap = ingest.marketCap;
  const historyDaysAvailable = fetchState?.historyDaysFetched ?? 0;
  const hasSufficientHistory = historyDaysAvailable >= ISM_MIN_HISTORY_DAYS_FOR_QUALIFIED;
  const latestPriceDate =
    input.latestPriceDateIso && /^\d{4}-\d{2}-\d{2}$/.test(input.latestPriceDateIso)
      ? input.latestPriceDateIso
      : null;
  const hasPriceSignal = hasPriceDataSignal(latestPriceDate, fetchState);

  const identityOk = !ingest.quality.missingTicker && !ingest.quality.tickerNeedsReview;
  const listedCurrencyOk =
    hasEntryExitRow && currencyTrimmed.length > 0 && isValidListedCurrency(currencyTrimmed);

  let fxUsdPerUnit: number | null = null;
  if (listedCurrencyOk) {
    const upper = currencyTrimmed.toUpperCase();
    if (upper === 'USD') {
      fxUsdPerUnit = 1;
    } else if (
      input.usdPerUnitLocalCurrency != null &&
      Number.isFinite(input.usdPerUnitLocalCurrency) &&
      input.usdPerUnitLocalCurrency > 0
    ) {
      fxUsdPerUnit = input.usdPerUnitLocalCurrency;
    } else if (input.usdBaseRates) {
      fxUsdPerUnit = usdPerUnitFromUsdBaseRates(currencyTrimmed, input.usdBaseRates);
    }
    if (fxUsdPerUnit !== null && (!Number.isFinite(fxUsdPerUnit) || fxUsdPerUnit <= 0)) {
      fxUsdPerUnit = null;
    }
  }

  const currencyReady = identityOk && listedCurrencyOk && fxUsdPerUnit !== null;
  const capOk = cap !== null && cap !== undefined && Number.isFinite(cap) && cap > 0;
  const marketCapUsd =
    capOk && fxUsdPerUnit !== null ? Math.round((cap as number) * fxUsdPerUnit * 1e6) / 1e6 : null;
  const marketCapCurrencyUpper = capOk && listedCurrencyOk ? currencyTrimmed.toUpperCase() : null;

  const needsReviewReasonCodes = buildNeedsReviewReasonCodes(
    ingest,
    hasEntryExitRow,
    currencyTrimmed,
    Boolean(input.priceSeriesAnomaly),
    Boolean(input.instrumentMappingConflict),
    fxUsdPerUnit
  );
  const needsReview = needsReviewReasonCodes.length > 0;

  const apiFailure =
    fetchState?.historyBootstrapStatus === 'blocked' || (fetchState?.fetchFailureCount ?? 0) >= 5;

  const qualified =
    identityOk &&
    currencyReady &&
    capOk &&
    marketCapUsd !== null &&
    hasPriceSignal &&
    hasSufficientHistory &&
    !needsReview &&
    !apiFailure;

  return {
    currencyTrimmed,
    identityOk,
    listedCurrencyOk,
    fxUsdPerUnit,
    currencyReady,
    capOk,
    marketCapUsd,
    marketCapCurrencyUpper,
    marketCapLocal: capOk ? (cap as number) : null,
    hasPriceSignal,
    hasSufficientHistory,
    historyDaysAvailable,
    latestPriceDate,
    needsReviewReasonCodes,
    needsReview,
    apiFailure,
    qualified,
  };
}
