/**
 * ISM ingest merge: DashBoard rows (via ScoreBoardData) + currency from existing ENTRY/EXIT accessor.
 * No parallel fetch — callers pass data from `useScoreBoardData` and `getFieldValue` from `EntryExitContext`.
 */

import type { ScoreBoardData } from '../../types/stock';
import { isValidValue } from '../sheets/dataTransformers';
import { buildSymbolId, normalizeTicker, parseTickerParts } from '../../utils/ism/tickerIdentity';
import type {
  ISMIngestQualityFlags,
  ISMInstrumentIngest,
  ISMIngestSummary,
  ISMReadinessHint,
} from '../../types/ismIngest';
import { ISM_READINESS_HINTS } from '../../types/ismIngest';

export type GetIsmCurrencyFn = (
  ticker: string,
  companyName: string
) => string | number | null | undefined;

function buildQuality(
  row: ScoreBoardData,
  currencyTrimmed: string,
  parsedNeedsReview: boolean
): ISMIngestQualityFlags {
  const tickerTrim = row.ticker?.trim() ?? '';
  const sectorTrim = row.industry?.trim() ?? '';
  return {
    missingTicker: !isValidValue(tickerTrim),
    missingSector: !isValidValue(sectorTrim),
    missingMarketCap: row.marketCap === null || row.marketCap === undefined,
    missingCurrency: currencyTrimmed.length === 0,
    missingDashboardDateOfUpdate:
      row.dashboardDateOfUpdate === null ||
      row.dashboardDateOfUpdate === undefined ||
      !isValidValue(String(row.dashboardDateOfUpdate)),
    tickerNeedsReview: parsedNeedsReview,
  };
}

function hintsFromQuality(q: ISMIngestQualityFlags): ISMReadinessHint[] {
  const hints: ISMReadinessHint[] = [];
  if (q.tickerNeedsReview) hints.push(ISM_READINESS_HINTS.TICKER_PARSE_REVIEW);
  if (q.missingTicker) hints.push(ISM_READINESS_HINTS.MISSING_TICKER);
  if (q.missingSector) hints.push(ISM_READINESS_HINTS.MISSING_SECTOR);
  if (q.missingMarketCap) hints.push(ISM_READINESS_HINTS.MISSING_MARKET_CAP);
  if (q.missingCurrency) hints.push(ISM_READINESS_HINTS.MISSING_CURRENCY);
  if (q.missingDashboardDateOfUpdate) hints.push(ISM_READINESS_HINTS.MISSING_DASHBOARD_DATE);
  return hints;
}

/**
 * Merge Score Board rows with ENTRY/EXIT currency using ISM ticker identity.
 * Currency is read via the same contract as tables: `getFieldValue(ticker, companyName, 'currency')`.
 */
export function mergeIsmIngestRows(
  scoreBoardRows: ScoreBoardData[],
  getCurrency: GetIsmCurrencyFn
): ISMInstrumentIngest[] {
  return scoreBoardRows.map((row) => {
    const parsed = parseTickerParts(row.ticker);
    const currencyRaw = getCurrency(row.ticker, row.companyName);
    const currency =
      typeof currencyRaw === 'string' ? currencyRaw.trim() : String(currencyRaw ?? '').trim();

    const quality = buildQuality(row, currency, parsed.needsReview);
    const readinessHints = hintsFromQuality(quality);

    return {
      tickerRaw: row.ticker,
      tickerNormalized: normalizeTicker(row.ticker),
      symbolId: buildSymbolId(row.ticker),
      companyName: row.companyName,
      sectorIsm: row.industry ?? '',
      marketCap: row.marketCap ?? null,
      dashboardDateOfUpdate: row.dashboardDateOfUpdate ?? null,
      currency,
      quality,
      readinessHints,
    };
  });
}

export function summarizeIsmIngest(rows: ISMInstrumentIngest[]): ISMIngestSummary {
  return {
    rowCount: rows.length,
    withMissingCurrency: rows.filter((r) => r.quality.missingCurrency).length,
    withMissingMarketCap: rows.filter((r) => r.quality.missingMarketCap).length,
    withMissingSector: rows.filter((r) => r.quality.missingSector).length,
    withTickerNeedsReview: rows.filter((r) => r.quality.tickerNeedsReview).length,
  };
}
